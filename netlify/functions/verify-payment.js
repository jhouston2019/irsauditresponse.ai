const Stripe = require("stripe");
const { getSupabaseAdmin } = require("./_supabase.js");
const { corsHeaders } = require("./_wizardAuth.js");
const { normalizePlanType, defaultLimitForPlan, getBillingSnapshot } = require("./_billing.js");
const {
  SESSION_STATUS,
  insertPaymentAudit,
  reconcileStripeSession,
  checkoutSessionEmail,
  checkoutStripeCustomerId,
  listStripeCustomerIdByEmail,
  resolveUserForCheckoutSession,
  isSessionAccessComplete,
  enforceLockedUser,
  ensureEntitlement,
  finalizeSession,
  markSessionVerifiedNoUser,
  markSessionPendingBinding,
  expireStalePending,
} = require("./_paymentReconcile.js");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function json(statusCode, event, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(event),
    },
    body: JSON.stringify(body),
  };
}

function logEvent(name, payload) {
  console.log(JSON.stringify({ [name]: true, ...payload }));
}

async function upsertAuditRow(supabase, sessionId, email, amountPaid, stripeCustomerId, session) {
  const { data: existing } = await supabase
    .from("audit_responses")
    .select("id")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  const patch = {
    user_email: email,
    stripe_payment_status: "paid",
    amount_paid: amountPaid,
    price_id: session.metadata?.price_id || "irs_audit_defense_49",
    audit_type: session.metadata?.audit_type || "irs_audit_response",
    status: "uploaded",
    metadata: {
      flow: session.metadata?.flow || "audit",
      stripe_customer_id: stripeCustomerId,
    },
  };
  if (existing?.id) {
    await supabase.from("audit_responses").update(patch).eq("id", existing.id);
    return;
  }
  await supabase.from("audit_responses").insert({
    ...patch,
    stripe_session_id: sessionId,
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(event), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return json(405, event, { error: "Method not allowed" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, event, { error: "Invalid JSON" });
  }

  const sessionId = body.session_id || body.sessionId;
  const emailOnly = typeof body.email === "string" && body.email.includes("@");

  if ((!sessionId || typeof sessionId !== "string") && emailOnly) {
    const supabase = getSupabaseAdmin();
    const { data: ulist } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1,
      filter: `email.eq.${body.email}`,
    });
    const uid = ulist?.users?.[0]?.id;
    if (!uid) {
      return json(200, event, { success: true, pending: true, hasPaid: false });
    }
    const snap = await getBillingSnapshot(uid, body.email);
    const paid = snap.paid === true;
    if (paid) {
      logEvent("PAYMENT_SESSION_VERIFIED", { mode: "email_only", hasPaid: true });
      await insertPaymentAudit(supabase, {
        session_id: "email_only",
        user_id: uid,
        event_type: "SESSION_VERIFIED",
        metadata: { mode: "email_only" },
      });
      return json(200, event, { success: true, hasPaid: true });
    }
    return json(200, event, { success: true, pending: true, hasPaid: false });
  }

  if (!sessionId || typeof sessionId !== "string") {
    return json(400, event, { error: "session_id required" });
  }

  const supabase = getSupabaseAdmin();

  try {
    const stripeResult = await reconcileStripeSession(stripe, sessionId);
    if (stripeResult.pending) {
      logEvent("VERIFY_PAYMENT_FINAL", { stripe_retrieve_error: stripeResult.error, sessionId });
      return json(200, event, { success: true, pending: true });
    }
    const session = stripeResult.session;

    if (session.payment_status !== "paid") {
      logEvent("VERIFY_PAYMENT_FINAL", { pending_payment: true, sessionId, pay: session.payment_status });
      return json(200, event, { success: true, pending: true });
    }

    let { data: procRow, error: procReadErr } = await supabase
      .from("processed_sessions")
      .select("status, user_id, locked_user_id, created_at, anonymous_finalize_used")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (procReadErr) {
      logEvent("VERIFY_PAYMENT_FINAL", { proc_read_error: procReadErr.message });
      return json(200, event, { success: true, pending: true });
    }

    procRow = await expireStalePending(supabase, procRow, sessionId, logEvent);

    if (procRow?.status === SESSION_STATUS.EXPIRED) {
      await supabase
        .from("processed_sessions")
        .update({ status: SESSION_STATUS.PENDING, error: "reverification_after_expiry" })
        .eq("session_id", sessionId);
      procRow = { ...procRow, status: SESSION_STATUS.PENDING };
    }

    const email = checkoutSessionEmail(session);
    let stripeCustomerId = checkoutStripeCustomerId(session);
    if (!stripeCustomerId && email) {
      stripeCustomerId = await listStripeCustomerIdByEmail(stripe, email);
    }

    const planRaw = session.metadata?.plan_type || session.metadata?.product_type || "single";
    const plan_type = normalizePlanType(planRaw);
    const review_limit = defaultLimitForPlan(plan_type);
    const amountPaid = session.amount_total != null ? session.amount_total : 4900;

    if (procRow?.status === SESSION_STATUS.COMPLETED && procRow.user_id) {
      const { data: entRow } = await supabase
        .from("billing_entitlements")
        .select("active, payment_verified")
        .eq("user_id", procRow.user_id)
        .maybeSingle();
      if (isSessionAccessComplete(procRow, entRow)) {
        logEvent("PAYMENT_SESSION_VERIFIED", { short_circuit: true, sessionId, userId: procRow.user_id });
        return json(200, event, { success: true });
      }
      logEvent("ENTITLEMENT_BACKFILLED", {
        reason: "completed_incomplete_entitlement",
        sessionId,
        userId: procRow.user_id,
      });
    }

    const { user: resolvedUser, error: resolveErr } = await resolveUserForCheckoutSession(
      supabase,
      session,
      stripe,
      stripeCustomerId
    );

    if (resolveErr === "binding_invalid" || resolveErr === "binding_email_mismatch") {
      logEvent("SESSION_REJECTED_SECURITY", { reason: resolveErr, sessionId, source: "verify" });
      await insertPaymentAudit(supabase, {
        session_id: sessionId,
        user_id: null,
        event_type: "SESSION_REJECTED",
        metadata: { reason: resolveErr, source: "verify" },
      });
      return json(200, event, { success: true, pending: true, code: resolveErr });
    }

    if (resolvedUser) {
      if (procRow?.status === SESSION_STATUS.COMPLETED && procRow.user_id) {
        if (String(resolvedUser.id) !== String(procRow.user_id)) {
          logEvent("SESSION_REJECTED_SECURITY", {
            reason: "completed_user_mismatch_stripe",
            sessionId,
            source: "verify",
          });
          await insertPaymentAudit(supabase, {
            session_id: sessionId,
            user_id: resolvedUser.id,
            event_type: "SESSION_REJECTED",
            metadata: { reason: "completed_user_mismatch_stripe", source: "verify" },
          });
          return json(200, event, { success: true, pending: true, code: "session_user_mismatch" });
        }
      }
      const lock2 = enforceLockedUser(procRow, resolvedUser.id, sessionId, logEvent);
      if (lock2 === "reject") {
        await insertPaymentAudit(supabase, {
          session_id: sessionId,
          user_id: resolvedUser.id,
          event_type: "SESSION_REJECTED",
          metadata: { reason: "locked_user_mismatch_resolved", source: "verify" },
        });
        return json(200, event, { success: true, pending: true, code: "session_lock_mismatch" });
      }
    }

    await upsertAuditRow(supabase, sessionId, email, amountPaid, stripeCustomerId, session);

    if (!resolvedUser) {
      await markSessionVerifiedNoUser(supabase, sessionId, "awaiting_user_binding");
      await insertPaymentAudit(supabase, {
        session_id: sessionId,
        user_id: null,
        event_type: "SESSION_VERIFIED",
        metadata: { stripe_paid: true, user_resolved: false },
      });
      logEvent("VERIFY_PAYMENT_FINAL", { pending: true, reason: "no_user_id", sessionId });
      return json(200, event, { success: true, pending: true });
    }

    const userId =
      procRow?.status === SESSION_STATUS.COMPLETED && procRow.user_id
        ? procRow.user_id
        : resolvedUser.id;

    const { data: entExisting } = await supabase
      .from("billing_entitlements")
      .select("active, payment_verified")
      .eq("user_id", userId)
      .maybeSingle();

    if (isSessionAccessComplete(procRow, entExisting)) {
      logEvent("PAYMENT_SESSION_VERIFIED", { short_circuit: true, sessionId, userId });
      return json(200, event, { success: true });
    }

    try {
      await ensureEntitlement(supabase, {
        userId,
        stripeCustomerId,
        plan_type,
        review_limit,
        sessionId,
      });
    } catch (e) {
      logEvent("VERIFY_PAYMENT_FINAL", { ensure_entitlement_error: e.message, sessionId });
      await markSessionPendingBinding(supabase, sessionId);
      return json(200, event, { success: true, pending: true });
    }

    await insertPaymentAudit(supabase, {
      session_id: sessionId,
      user_id: userId,
      event_type: "ENTITLEMENT_GRANTED",
      metadata: { source: "verify_reconcile" },
    });
    logEvent("ENTITLEMENT_GRANTED", { sessionId, userId, source: "verify_reconcile" });

    try {
      await finalizeSession(supabase, { sessionId, userId });
    } catch (e) {
      logEvent("VERIFY_PAYMENT_FINAL", { finalize_error: e.message, sessionId });
      return json(200, event, { success: true, pending: true });
    }

    await insertPaymentAudit(supabase, {
      session_id: sessionId,
      user_id: userId,
      event_type: "SESSION_COMPLETED",
      metadata: { source: "verify_reconcile" },
    });

    logEvent("PAYMENT_SESSION_VERIFIED", { sessionId, userId, email: email ? "[redacted]" : null });

    return json(200, event, { success: true });
  } catch (e) {
    console.error("VERIFY_PAYMENT_FINAL error", e);
    logEvent("VERIFY_PAYMENT_FINAL", { error: e.message || "verify_failed", sessionId, no_state_mutation: true });
    return json(200, event, { success: true, pending: true });
  }
};
