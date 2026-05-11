const Stripe = require("stripe");

/**
 * Validates X-Stripe-Session: paid Stripe Checkout session whose metadata.job_id matches body job_id.
 */
async function authorizeExportViaStripeSession(event, jobIdTrim, json) {
  const raw =
    event.headers["x-stripe-session"] || event.headers["X-Stripe-Session"] || "";
  const checkoutSessionId = String(raw || "").trim();
  if (!checkoutSessionId) {
    return { ok: false, skip: true };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      ok: false,
      response: json(503, event, { error: "Stripe not configured" }),
    };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  try {
    const sess = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    if (sess.payment_status !== "paid") {
      return {
        ok: false,
        response: json(401, event, { error: "Authentication required" }),
      };
    }
    const mdJob =
      sess.metadata?.job_id != null ? String(sess.metadata.job_id).trim() : "";
    if (!mdJob || mdJob !== jobIdTrim) {
      return {
        ok: false,
        response: json(401, event, { error: "Authentication required" }),
      };
    }
    return { ok: true };
  } catch (e) {
    console.warn("authorizeExportViaStripeSession:", e.message);
    return {
      ok: false,
      response: json(401, event, { error: "Authentication required" }),
    };
  }
}

module.exports = { authorizeExportViaStripeSession };
