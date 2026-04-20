/**
 * Idempotent Stripe ↔ DB reconciliation helpers.
 * Webhook is the primary completion path; verify-payment backfills gaps only.
 */
const { normalizePlanType, defaultLimitForPlan } = require("./_billing.js");

const SESSION_STATUS = {
  PENDING: "pending",
  VERIFIED: "verified",
  COMPLETED: "completed",
  EXPIRED: "expired",
  FAILED: "failed",
};

const PENDING_STALE_MS = 30 * 60 * 1000;

function normEmail(e) {
  return (e || "").trim().toLowerCase();
}

async function insertPaymentAudit(supabase, { session_id, user_id, event_type, metadata = {} }) {
  try {
    await supabase.from("payment_audit_log").insert({
      session_id,
      user_id: user_id || null,
      event_type,
      metadata,
    });
  } catch (e) {
    console.error("payment_audit_log insert failed", e.message);
  }
}

/**
 * @returns {{ session: object } | { pending: true, error?: string }}
 */
async function reconcileStripeSession(stripe, sessionId) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["customer"],
    });
    return { session };
  } catch (e) {
    return { pending: true, error: e.message };
  }
}

function checkoutSessionEmail(session) {
  return (
    session.customer_email ||
    session.customer_details?.email ||
    session.metadata?.user_email ||
    null
  );
}

function checkoutStripeCustomerId(session) {
  if (typeof session.customer === "string") return session.customer;
  if (session.customer && session.customer.id) return session.customer.id;
  return null;
}

async function listStripeCustomerIdByEmail(stripe, email) {
  if (!email) return null;
  const customers = await stripe.customers.list({ email, limit: 1 });
  return customers.data[0]?.id || null;
}

async function getOrCreateAuthUser(supabase, email, stripeCustomerId) {
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1,
    filter: `email.eq.${email}`,
  });
  if (!listErr && list?.users?.length) {
    const u = list.users[0];
    if (stripeCustomerId) {
      await supabase.auth.admin.updateUserById(u.id, {
        user_metadata: { ...u.user_metadata, stripe_customer_id: stripeCustomerId },
      });
    }
    return u;
  }

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { stripe_customer_id: stripeCustomerId || null },
  });

  if (createErr) {
    if (createErr.message?.includes("already been registered")) {
      const { data: again } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1,
        filter: `email.eq.${email}`,
      });
      if (again?.users?.length) return again.users[0];
    }
    throw createErr;
  }
  return created.user;
}

/**
 * Resolve auth user for a paid Checkout session (same rules as finalize endpoint).
 */
async function resolveUserForCheckoutSession(supabase, session, stripe, stripeCustomerId) {
  const email = checkoutSessionEmail(session);
  const boundRaw = session.client_reference_id || session.metadata?.supabase_user_id || null;
  const bound = boundRaw ? String(boundRaw).trim() : null;

  let cid = stripeCustomerId;
  if (!cid && email) {
    cid = await listStripeCustomerIdByEmail(stripe, email);
  }

  if (bound) {
    const { data: uData, error: gErr } = await supabase.auth.admin.getUserById(bound);
    if (gErr || !uData?.user) return { user: null, error: "binding_invalid" };
    if (email && normEmail(uData.user.email) !== normEmail(email)) {
      return { user: null, error: "binding_email_mismatch" };
    }
    if (cid) {
      await supabase.auth.admin.updateUserById(uData.user.id, {
        user_metadata: { ...uData.user.user_metadata, stripe_customer_id: cid },
      });
    }
    return { user: uData.user };
  }

  if (cid) {
    const { data: ent } = await supabase
      .from("billing_entitlements")
      .select("user_id")
      .eq("stripe_customer_id", cid)
      .maybeSingle();
    if (ent?.user_id) {
      const { data: uData, error: gErr } = await supabase.auth.admin.getUserById(ent.user_id);
      if (!gErr && uData?.user) return { user: uData.user };
    }
  }

  if (!email) return { user: null };

  const user = await getOrCreateAuthUser(supabase, email, cid);
  return { user };
}

function isSessionAccessComplete(proc, entRow) {
  if (!proc || proc.status !== SESSION_STATUS.COMPLETED) return false;
  if (!proc.user_id || !proc.locked_user_id || String(proc.user_id) !== String(proc.locked_user_id)) {
    return false;
  }
  if (!entRow) return false;
  return entRow.active === true && entRow.payment_verified === true;
}

/**
 * Reject if session already locked to a different user.
 * @returns { 'ok' | 'reject' }
 */
function enforceLockedUser(procRow, resolvedUserId, sessionId, logSecurity) {
  if (!procRow?.locked_user_id || !resolvedUserId) return "ok";
  if (String(procRow.locked_user_id) === String(resolvedUserId)) return "ok";
  logSecurity("SESSION_REJECTED_SECURITY", {
    reason: "locked_user_mismatch",
    sessionId,
    locked: procRow.locked_user_id,
    resolved: resolvedUserId,
  });
  return "reject";
}

async function ensureEntitlement(supabase, { userId, stripeCustomerId, plan_type, review_limit, sessionId }) {
  const { error } = await supabase.from("billing_entitlements").upsert(
    {
      user_id: userId,
      stripe_customer_id: stripeCustomerId,
      plan_type,
      active: true,
      payment_verified: true,
      renewal_at: null,
      review_limit,
      last_stripe_session_id: sessionId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

/**
 * Mark session completed with mandatory lock (DB constraint enforces user_id = locked_user_id).
 */
async function finalizeSession(supabase, { sessionId, userId }) {
  const { error } = await supabase.from("processed_sessions").upsert(
    {
      session_id: sessionId,
      status: SESSION_STATUS.COMPLETED,
      completed_at: new Date().toISOString(),
      user_id: userId,
      locked_user_id: userId,
      error: null,
    },
    { onConflict: "session_id" }
  );
  if (error) throw error;
}

async function markSessionVerifiedNoUser(supabase, sessionId, errMsg) {
  await supabase.from("processed_sessions").upsert(
    {
      session_id: sessionId,
      status: SESSION_STATUS.VERIFIED,
      user_id: null,
      error: errMsg || "awaiting_user_binding",
      completed_at: null,
    },
    { onConflict: "session_id" }
  );
}

async function markSessionPendingBinding(supabase, sessionId) {
  await supabase.from("processed_sessions").upsert(
    {
      session_id: sessionId,
      status: SESSION_STATUS.PENDING,
      error: "awaiting_user_binding",
      user_id: null,
      completed_at: null,
    },
    { onConflict: "session_id" }
  );
}

async function expireStalePending(supabase, procRow, sessionId, logFn) {
  if (!procRow || procRow.status !== SESSION_STATUS.PENDING || !procRow.created_at) return procRow;
  const age = Date.now() - new Date(procRow.created_at).getTime();
  if (age <= PENDING_STALE_MS) return procRow;
  await supabase
    .from("processed_sessions")
    .update({
      status: SESSION_STATUS.EXPIRED,
      error: "pending_expired_reverify",
    })
    .eq("session_id", sessionId);
  logFn("VERIFY_PAYMENT_FINAL", { pending_expired: true, sessionId });
  const { data: again } = await supabase
    .from("processed_sessions")
    .select("status, user_id, locked_user_id, created_at, anonymous_finalize_used")
    .eq("session_id", sessionId)
    .maybeSingle();
  return again || { ...procRow, status: SESSION_STATUS.EXPIRED };
}

module.exports = {
  SESSION_STATUS,
  PENDING_STALE_MS,
  insertPaymentAudit,
  reconcileStripeSession,
  checkoutSessionEmail,
  checkoutStripeCustomerId,
  listStripeCustomerIdByEmail,
  resolveUserForCheckoutSession,
  getOrCreateAuthUser,
  isSessionAccessComplete,
  enforceLockedUser,
  ensureEntitlement,
  finalizeSession,
  markSessionVerifiedNoUser,
  markSessionPendingBinding,
  expireStalePending,
  normEmail,
};
