const Stripe = require("stripe");
const { getSupabaseAdmin } = require("./_supabase.js");
const { authorizeWizardRequest, corsHeaders, json } = require("./_wizardAuth.js");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isFkViolation(err) {
  if (!err) return false;
  if (err.code === "23503") return true;
  const msg = String(err.message || "");
  return (
    msg.includes("foreign key constraint") ||
    msg.includes("audit_jobs_user_id_fkey")
  );
}

/**
 * POST body: { session_id: string, user_id?: string, stripe_session_id?: string (must match session_id) }
 * Header: Authorization: Bearer <Supabase access token>
 */
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(event), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return json(405, event, { error: "Method not allowed" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(event) },
      body: JSON.stringify({
        error: "Server misconfigured: SUPABASE_SERVICE_ROLE_KEY missing.",
      }),
    };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return json(500, event, {
      error: "Server misconfigured: STRIPE_SECRET_KEY missing.",
    });
  }

  const auth = await authorizeWizardRequest(event);
  if (!auth.ok) return auth.response;

  const jwtUserId = auth.userId;
  const jwtEmail = String(auth.user?.email || auth.email || "")
    .trim()
    .toLowerCase();

  let sessionId;
  try {
    const body = JSON.parse(event.body || "{}");
    sessionId =
      typeof body.session_id === "string" ? body.session_id.trim() : "";
    const stripeSessionIdBody =
      typeof body.stripe_session_id === "string"
        ? body.stripe_session_id.trim()
        : "";
    if (stripeSessionIdBody && stripeSessionIdBody !== sessionId) {
      return json(400, event, {
        error: "stripe_session_id must match session_id",
        code: "STRIPE_SESSION_MISMATCH",
      });
    }
    if (body.user_id != null && String(body.user_id).trim() !== jwtUserId) {
      return json(400, event, {
        error: "user_id does not match authenticated user",
        code: "USER_MISMATCH",
      });
    }
  } catch {
    return json(400, event, { error: "Invalid JSON body" });
  }

  if (!sessionId) {
    return json(400, event, { error: "session_id required" });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let stripeSession;
  try {
    stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    console.error("record-purchase Stripe retrieve:", err.message);
    return json(400, event, {
      error: "Could not retrieve Stripe checkout session",
      code: "STRIPE_SESSION_INVALID",
    });
  }

  if (stripeSession.payment_status !== "paid") {
    return json(402, event, {
      error: "Payment not completed",
      code: "NOT_PAID",
    });
  }

  const md = stripeSession.metadata || {};
  const jobIdMeta =
    md.job_id != null && String(md.job_id).trim() !== ""
      ? String(md.job_id).trim()
      : "";
  if (!jobIdMeta) {
    console.warn(
      "[record-purchase] missing job_id in Stripe session metadata — unlocking entitlement for paid session anyway",
    );
  }

  const stripeEmailRaw =
    stripeSession.customer_details?.email ||
    stripeSession.customer_email ||
    "";
  const stripeEmail = String(stripeEmailRaw).trim().toLowerCase();
  if (
    stripeEmail &&
    jwtEmail &&
    stripeEmail !== jwtEmail &&
    jwtEmail.includes("@") &&
    stripeEmail.includes("@")
  ) {
    return json(409, event, {
      error:
        "This payment was tied to a different email than your account — sign up or log in with the same checkout email.",
      code: "CHECKOUT_EMAIL_MISMATCH",
    });
  }

  const customerEmailForRow =
    stripeSession.customer_details?.email ||
    stripeSession.customer_email ||
    null;

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    return json(500, event, {
      error: "Server misconfigured: SUPABASE_SERVICE_ROLE_KEY missing.",
    });
  }

  const [
    { data: jobBySession },
    { data: purchaseRow },
    { data: procRow },
    { data: entRow },
  ] = await Promise.all([
    supabase
      .from("audit_jobs")
      .select("id,user_id,stripe_session_id,paid,is_unlocked")
      .eq("stripe_session_id", sessionId)
      .maybeSingle(),
    supabase
      .from("purchases")
      .select("user_id,stripe_session_id")
      .eq("stripe_session_id", sessionId)
      .maybeSingle(),
    supabase
      .from("processed_sessions")
      .select("locked_user_id,user_id,status,session_id")
      .eq("session_id", sessionId)
      .maybeSingle(),
    supabase
      .from("billing_entitlements")
      .select("user_id,last_stripe_session_id")
      .eq("user_id", jwtUserId)
      .maybeSingle(),
  ]);

  let procConflict = false;
  if (
    procRow &&
    procRow.status === "completed" &&
    procRow.locked_user_id &&
    procRow.locked_user_id !== jwtUserId
  ) {
    procConflict = true;
  }
  if (
    procRow &&
    procRow.status === "completed" &&
    procRow.user_id &&
    procRow.user_id !== jwtUserId
  ) {
    procConflict = true;
  }

  if (
    purchaseRow?.user_id &&
    purchaseRow.user_id !== jwtUserId
  ) {
    return json(409, event, {
      error:
        "This checkout session has already been linked to a different account.",
      code: "SESSION_ALREADY_LINKED",
    });
  }
  if (
    jobBySession?.user_id &&
    jobBySession.user_id !== jwtUserId
  ) {
    return json(409, event, {
      error:
        "This purchase is already tied to another user.",
      code: "JOB_OWNED_BY_OTHER_USER",
    });
  }
  if (procConflict) {
    return json(409, event, {
      error:
        "This checkout was already finalized under a different account.",
      code: "PROCESSED_SESSION_CONFLICT",
    });
  }

  const alreadyProcessed =
    (purchaseRow?.user_id === jwtUserId) ||
    (jobBySession?.user_id === jwtUserId && jobBySession?.paid === true) ||
    (procRow?.status === "completed" &&
      (procRow.locked_user_id === jwtUserId || procRow.user_id === jwtUserId)) ||
    (entRow?.last_stripe_session_id === sessionId);

  async function upsertSideTables() {
    const { error: pIns } = await supabase.from("purchases").upsert(
      {
        user_id: jwtUserId,
        stripe_session_id: sessionId,
        created_at: new Date().toISOString(),
      },
      { onConflict: "stripe_session_id" },
    );
    if (pIns && pIns.code !== "23505") {
      console.warn("record-purchase purchases upsert:", pIns.code, pIns.message);
    }

    const { error: psErr } = await supabase.from("processed_sessions").upsert(
      {
        session_id: sessionId,
        status: "completed",
        completed_at: new Date().toISOString(),
        user_id: jwtUserId,
        locked_user_id: jwtUserId,
      },
      { onConflict: "session_id" },
    );
    if (psErr) {
      console.warn("record-purchase processed_sessions upsert:", psErr.message);
    }

    const stripeCustRaw = stripeSession.customer;
    const stripeCust =
      typeof stripeCustRaw === "string"
        ? stripeCustRaw
        : stripeCustRaw &&
            typeof stripeCustRaw === "object" &&
            stripeCustRaw !== null &&
            typeof stripeCustRaw.id === "string"
          ? stripeCustRaw.id
          : null;

    const { error: beErr } = await supabase
      .from("billing_entitlements")
      .upsert(
        {
          user_id: jwtUserId,
          active: true,
          payment_verified: true,
          last_stripe_session_id: sessionId,
          updated_at: new Date().toISOString(),
          ...(stripeCust ? { stripe_customer_id: stripeCust } : {}),
        },
        { onConflict: "user_id" },
      );
    if (beErr) {
      console.warn(
        "record-purchase billing_entitlements upsert:",
        beErr.message,
      );
    }
  }

  async function provisionOrLinkAuditJob() {
    const patch = {
      user_id: jwtUserId,
      paid: true,
      is_unlocked: true,
    };
    if (customerEmailForRow) patch.customer_email = customerEmailForRow;

    /** 1) Link row already keyed by this Stripe session (FK backoff) */
    for (let attempt = 0; attempt <= 21; attempt++) {
      const { data: updRows, error: upErr } = await supabase
        .from("audit_jobs")
        .update(patch)
        .eq("stripe_session_id", sessionId)
        .or(`user_id.is.null,user_id.eq.${jwtUserId}`)
        .select("id");

      if (upErr) {
        console.error("record-purchase audit_jobs update:", upErr);
        if (isFkViolation(upErr)) {
          await sleep(280 + attempt * 45);
          continue;
        }
        throw Object.assign(new Error(upErr.message), { step: "audit_jobs_update" });
      }

      if (updRows?.length > 0) return updRows[0].id;
      break;
    }

    /** 2) Preview flow: reconcile using session.metadata.job_id */
    if (jobIdMeta && UUID_RE.test(jobIdMeta)) {
      const { data: byId } = await supabase
        .from("audit_jobs")
        .select("id,user_id,stripe_session_id")
        .eq("id", jobIdMeta)
        .maybeSingle();

      if (byId) {
        if (byId.user_id && byId.user_id !== jwtUserId) {
          throw Object.assign(new Error("JOB_USER_CONFLICT"), { code409: true });
        }
        const patchById = {
          stripe_session_id: sessionId,
          paid: true,
          is_unlocked: true,
          user_id: jwtUserId,
        };
        if (customerEmailForRow) patchById.customer_email = customerEmailForRow;

        let lastFk = null;
        for (let i = 0; i <= 21; i++) {
          const { error: pidErr } = await supabase
            .from("audit_jobs")
            .update(patchById)
            .eq("id", jobIdMeta)
            .or(`user_id.is.null,user_id.eq.${jwtUserId}`);

          if (!pidErr) return byId.id;
          console.error("record-purchase audit_jobs update by job_id:", pidErr);
          if (isFkViolation(pidErr)) {
            lastFk = pidErr;
            await sleep(280 + i * 45);
            continue;
          }
          throw Object.assign(new Error(pidErr.message), {
            step: "audit_jobs_update_by_id",
          });
        }
        throw Object.assign(
          lastFk || new Error("audit_jobs FK retry exhausted"),
          { step: "audit_jobs_update_by_id_fk" },
        );
      }

      const insertPayload = {
        id: jobIdMeta,
        stripe_session_id: sessionId,
        paid: true,
        is_unlocked: true,
        user_id: jwtUserId,
      };
      if (customerEmailForRow) insertPayload.customer_email = customerEmailForRow;

      for (let j = 0; j <= 21; j++) {
        const { error: insErr } = await supabase
          .from("audit_jobs")
          .insert(insertPayload);

        if (!insErr) return jobIdMeta;
        console.error("record-purchase audit_jobs insert by job_id:", insErr);

        if (insErr.code === "23505") {
          /** Race — row now exists under this Stripe session */
          const { data: raced } = await supabase
            .from("audit_jobs")
            .select("id,user_id,stripe_session_id")
            .eq("stripe_session_id", sessionId)
            .maybeSingle();
          if (raced?.user_id && raced.user_id !== jwtUserId) {
            throw Object.assign(new Error("JOB_USER_CONFLICT"), { code409: true });
          }
          if (raced?.id) {
            for (let u = 0; u <= 21; u++) {
              const { data: rr, error: rErr } = await supabase
                .from("audit_jobs")
                .update(patch)
                .eq("stripe_session_id", sessionId)
                .or(`user_id.is.null,user_id.eq.${jwtUserId}`)
                .select("id");
              if (rErr && isFkViolation(rErr)) {
                await sleep(280 + u * 45);
                continue;
              }
              if (rErr) {
                throw Object.assign(new Error(rErr.message), { step: "audit_jobs_race_relink" });
              }
              if (rr?.length) return rr[0].id;
              break;
            }
          }
          continue;
        }
        if (isFkViolation(insErr)) {
          await sleep(280 + j * 45);
          continue;
        }
        throw Object.assign(new Error(insErr.message), {
          step: "audit_jobs_insert_by_id",
        });
      }
    }

    /** 3) No preview job row yet — provision by stripe_session_id (upsert + FK backoff) */
    const minimal = {
      stripe_session_id: sessionId,
      paid: true,
      is_unlocked: true,
      user_id: jwtUserId,
    };
    if (customerEmailForRow) minimal.customer_email = customerEmailForRow;

    for (let k = 0; k <= 21; k++) {
      const { data: inserted, error: minErr } = await supabase
        .from("audit_jobs")
        .upsert(minimal, { onConflict: "stripe_session_id" })
        .select("id");

      const rowId = inserted?.[0]?.id ?? null;
      if (!minErr) return rowId;

      console.error("record-purchase audit_jobs upsert minimal:", minErr);
      if (minErr.code === "23503" || isFkViolation(minErr)) {
        await sleep(280 + k * 45);
        continue;
      }
      throw Object.assign(new Error(minErr.message), {
        step: "audit_jobs_minimal_upsert",
      });
    }

    throw new Error(
      "Could not link purchase after FK retries — verify SUPABASE_SERVICE_ROLE_KEY is set to the Supabase **service_role** key on Netlify.",
    );
  }

  try {
    await provisionOrLinkAuditJob();
  } catch (err) {
    if (err.code409) {
      return json(409, event, {
        error:
          "This wizard job belongs to another account.",
        code: "JOB_OWNED_BY_OTHER_USER",
      });
    }
    if (err.step) {
      return json(500, event, {
        error: err.message,
        step: err.step,
        code: String(err.step).toUpperCase(),
      });
    }
    console.error("record-purchase provisioning:", err);
    return json(500, event, { error: err.message || "Link failed", code: "PROVISION_FAILED" });
  }

  await upsertSideTables();

  return json(200, event, {
    ok: true,
    already_processed: !!alreadyProcessed,
  });
};
