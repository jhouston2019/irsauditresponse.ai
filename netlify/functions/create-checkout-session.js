// MANUAL STEP REQUIRED: Run this SQL in Supabase before deploying:
// create table wizard_state (
//   id uuid primary key default gen_random_uuid(),
//   stripe_session_id text unique not null,
//   state jsonb not null,
//   created_at timestamptz default now()
// );
// alter table wizard_state enable row level security;
// create policy "service role only"
//   on wizard_state for all
//   to service_role using (true);

const Stripe = require("stripe");
const { authorizeWizardRequest, corsHeaders, json } = require("./_wizardAuth.js");
const { getSupabaseAdmin } = require("./_supabase.js");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hasBearerToken(event) {
  const auth = event.headers.authorization || event.headers.Authorization || "";
  return /^Bearer\s+\S+/i.test(auth || "");
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(event), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return json(405, event, { error: "Method not allowed" });
  }

  try {
    const parsedBody = JSON.parse(event.body || "{}");
    const { priceId, email, wizardState } = parsedBody;
    if (!priceId || typeof priceId !== "string") {
      return json(400, event, { error: "priceId required" });
    }

    let jobIdRaw = "";
    if (typeof parsedBody.job_id === "string") jobIdRaw = parsedBody.job_id.trim();
    else if (typeof parsedBody.jobId === "string") jobIdRaw = parsedBody.jobId.trim();

    const site = (process.env.SITE_URL || "").replace(/\/$/, "");
    if (!site) {
      return json(500, event, { error: "SITE_URL is not set" });
    }

    const admin = getSupabaseAdmin();
    const bearer = hasBearerToken(event);
    const serviceKeyHeader =
      event.headers["x-service-key"] || event.headers["X-Service-Key"] || "";
    if (
      process.env.AUDIT_DEFENSE_SERVICE_KEY &&
      serviceKeyHeader &&
      serviceKeyHeader === process.env.AUDIT_DEFENSE_SERVICE_KEY
    ) {
      return json(403, event, { error: "Forbidden" });
    }

    let jobId = jobIdRaw;
    let customerEmail = null;
    let metadataUserId = null;

    if (bearer) {
      const auth = await authorizeWizardRequest(event);
      if (!auth.ok) return auth.response;
      if (!auth.user?.id) return json(403, event, { error: "Forbidden" });
      if (!jobId) {
        const ins = await admin.from("audit_jobs").insert({ user_id: auth.user.id }).select("id").single();
        if (ins.error || !ins.data?.id) {
          return json(500, event, { error: ins.error?.message || "Could not create job" });
        }
        jobId = ins.data.id;
      } else {
        const chk = await admin.from("audit_jobs").select("id,user_id").eq("id", jobId).maybeSingle();
        if (chk.error || !chk.data || chk.data.user_id !== auth.user.id) {
          return json(403, event, { error: "Job not found" });
        }
      }
      customerEmail = auth.user.email || null;
      metadataUserId = auth.user.id;
    } else {
      if (jobIdRaw && UUID_RE.test(jobIdRaw)) {
        const chk = await admin.from("audit_jobs").select("id").eq("id", jobIdRaw).maybeSingle();
        if (chk.data?.id) {
          jobId = chk.data.id;
          console.log(
            JSON.stringify({
              fn: "create-checkout-session",
              phase: "reuse_job",
              jobId,
            }),
          );
        }
      }
      if (!jobId) {
        const ins = await admin.from("audit_jobs").insert({ user_id: null }).select("id").single();
        if (ins.error || !ins.data?.id) {
          return json(500, event, { error: ins.error?.message || "Could not create job" });
        }
        jobId = ins.data.id;
        console.log(
          JSON.stringify({
            fn: "create-checkout-session",
            phase: "job_created_guest",
            jobId,
          }),
        );
      }
    }

    const metadata = {
      /** Required for post-payment record-purchase linking to the preview audit_jobs row */
      job_id: String(jobId),
      product_type: "audit_defense",
    };
    if (metadataUserId) metadata.user_id = String(metadataUserId);

    const params = {
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${site}/audit-defense.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/pricing`,
      metadata,
      customer_email: (typeof email === "string" && email.trim() ? email.trim() : undefined) || customerEmail || undefined,
    };

    const session = await stripe.checkout.sessions.create(params);
    console.log(
      JSON.stringify({
        fn: "create-checkout-session",
        phase: "checkout_session_created",
        jobId,
        stripeSessionId: session.id,
        metadataJobId: metadata.job_id,
      }),
    );

    if (
      wizardState != null &&
      typeof wizardState === "object" &&
      !Array.isArray(wizardState)
    ) {
      try {
        const statePayload = { ...wizardState, jobId };
        const { error: wsErr } = await admin.from("wizard_state").insert({
          stripe_session_id: session.id,
          state: statePayload,
          created_at: new Date().toISOString(),
        });
        if (wsErr) {
          console.warn("wizard_state insert:", wsErr.message);
        }
      } catch (e) {
        console.warn("wizard_state insert:", e.message);
      }
    }

    return json(200, event, { url: session.url });
  } catch (error) {
    return json(500, event, { error: error.message || "Checkout failed" });
  }
};
