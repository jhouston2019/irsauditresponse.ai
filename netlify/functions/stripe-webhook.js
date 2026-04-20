import { createRequire } from "module";
import Stripe from "stripe";
import { getSupabaseAdmin } from "./_supabase.js";

const require = createRequire(import.meta.url);
const { normalizePlanType, defaultLimitForPlan } = require("./_billing.js");
const {
  SESSION_STATUS,
  insertPaymentAudit,
  checkoutSessionEmail,
  checkoutStripeCustomerId,
  listStripeCustomerIdByEmail,
  resolveUserForCheckoutSession,
  enforceLockedUser,
  ensureEntitlement,
  finalizeSession,
  markSessionVerifiedNoUser,
} = require("./_paymentReconcile.js");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = { path: "/.netlify/functions/stripe-webhook" };

async function handleAuditCheckoutCompleted(session) {
  const supabase = getSupabaseAdmin();
  const sessionId = session.id;

  let { data: procRow } = await supabase
    .from("processed_sessions")
    .select("status, user_id, locked_user_id")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (!procRow) {
    await supabase.from("processed_sessions").insert({
      session_id: sessionId,
      status: SESSION_STATUS.PENDING,
    });
    const { data: again } = await supabase
      .from("processed_sessions")
      .select("status, user_id, locked_user_id")
      .eq("session_id", sessionId)
      .maybeSingle();
    procRow = again;
  }

  const { data: existing } = await supabase
    .from("audit_responses")
    .select("id")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();

  if (!existing) {
    const email = checkoutSessionEmail(session);
    const amountPaid = session.amount_total != null ? session.amount_total : 4900;
    const payStatus = session.payment_status === "paid" ? "paid" : session.payment_status || "paid";

    await supabase.from("audit_responses").insert({
      user_email: email,
      stripe_session_id: sessionId,
      stripe_payment_status: payStatus,
      amount_paid: amountPaid,
      price_id: "irs_audit_defense_49",
      audit_type: session.metadata?.audit_type || "irs_audit_response",
      status: "uploaded",
      metadata: {
        flow: "audit",
        payment_intent: session.payment_intent || null,
      },
    });
  }

  if (session.payment_status !== "paid") {
    await insertPaymentAudit(supabase, {
      session_id: sessionId,
      user_id: null,
      event_type: "SESSION_VERIFIED",
      metadata: { webhook: true, payment_status: session.payment_status },
    });
    return;
  }

  let stripeCustomerId = checkoutStripeCustomerId(session);
  const email = checkoutSessionEmail(session);
  if (!stripeCustomerId && email) {
    stripeCustomerId = await listStripeCustomerIdByEmail(stripe, email);
  }

  const plan_type = normalizePlanType(session.metadata?.plan_type || "single");
  const review_limit = defaultLimitForPlan(plan_type);

  const { user: resolvedUser, error: resolveErr } = await resolveUserForCheckoutSession(
    supabase,
    session,
    stripe,
    stripeCustomerId
  );

  if (resolveErr === "binding_invalid" || resolveErr === "binding_email_mismatch") {
    console.log(
      JSON.stringify({
        SESSION_REJECTED_SECURITY: true,
        source: "webhook",
        sessionId,
        reason: resolveErr,
      })
    );
    await insertPaymentAudit(supabase, {
      session_id: sessionId,
      user_id: null,
      event_type: "SESSION_REJECTED",
      metadata: { reason: resolveErr, source: "webhook" },
    });
    return;
  }

  if (!resolvedUser) {
    await markSessionVerifiedNoUser(supabase, sessionId, "awaiting_user_binding");
    await insertPaymentAudit(supabase, {
      session_id: sessionId,
      user_id: null,
      event_type: "SESSION_VERIFIED",
      metadata: { webhook: true, stripe_paid: true, user_resolved: false },
    });
    console.log(JSON.stringify({ PAYMENT_WEBHOOK_CHECKOUT_COMPLETE: true, sessionId, phase: "verified_no_user" }));
    return;
  }

  const userId = resolvedUser.id;
  const logSec = (name, payload) => console.log(JSON.stringify({ [name]: true, ...payload }));

  if (enforceLockedUser(procRow || {}, userId, sessionId, logSec) === "reject") {
    await insertPaymentAudit(supabase, {
      session_id: sessionId,
      user_id: userId,
      event_type: "SESSION_REJECTED",
      metadata: { reason: "locked_user_mismatch", source: "webhook" },
    });
    return;
  }

  await ensureEntitlement(supabase, {
    userId,
    stripeCustomerId,
    plan_type,
    review_limit,
    sessionId,
  });

  await insertPaymentAudit(supabase, {
    session_id: sessionId,
    user_id: userId,
    event_type: "ENTITLEMENT_GRANTED",
    metadata: { source: "webhook" },
  });
  console.log(
    JSON.stringify({
      ENTITLEMENT_GRANTED: true,
      source: "webhook",
      sessionId,
      userId,
    })
  );

  await finalizeSession(supabase, { sessionId, userId });

  await insertPaymentAudit(supabase, {
    session_id: sessionId,
    user_id: userId,
    event_type: "SESSION_COMPLETED",
    metadata: { source: "webhook" },
  });

  console.log(
    JSON.stringify({
      PAYMENT_WEBHOOK_CHECKOUT_COMPLETE: true,
      sessionId,
      phase: "completed",
      userId,
    })
  );
}

export async function handler(event) {
  try {
    const sig = event.headers["stripe-signature"];
    const rawBody = event.isBase64Encoded ? Buffer.from(event.body, "base64") : Buffer.from(event.body || "");
    let evt;

    try {
      evt = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return { statusCode: 400, body: `Webhook Error: ${err.message}` };
    }

    if (evt.type === "checkout.session.completed") {
      const session = evt.data.object;
      const supabase = getSupabaseAdmin();
      const recordId = session.metadata?.recordId || null;

      if (recordId) {
        await supabase
          .from("tlh_letters")
          .update({
            stripe_session_id: session.id,
            stripe_payment_status: session.payment_status || "paid",
          })
          .eq("id", recordId);
      } else {
        const isAuditFlow =
          session.metadata?.flow === "audit" ||
          (typeof session.success_url === "string" &&
            (session.success_url.includes("success") || session.success_url.includes("audit-success")));

        if (isAuditFlow) {
          await handleAuditCheckoutCompleted(session);
        }
      }
    }

    return { statusCode: 200, body: "ok" };
  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
}
