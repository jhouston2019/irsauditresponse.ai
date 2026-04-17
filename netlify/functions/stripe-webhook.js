import Stripe from "stripe";
import { getSupabaseAdmin } from "./_supabase.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = { path: "/.netlify/functions/stripe-webhook" };

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
          (typeof session.success_url === "string" && session.success_url.includes("audit-success"));

        if (isAuditFlow) {
          const { data: existing } = await supabase
            .from("audit_responses")
            .select("id")
            .eq("stripe_session_id", session.id)
            .maybeSingle();

          if (!existing) {
            const email =
              session.customer_email ||
              session.customer_details?.email ||
              session.metadata?.user_email ||
              null;
            const amountPaid = session.amount_total != null ? session.amount_total : 4900;
            const payStatus = session.payment_status === "paid" ? "paid" : session.payment_status || "paid";

            await supabase.from("audit_responses").insert({
              user_email: email,
              stripe_session_id: session.id,
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
        }
      }
    }

    return { statusCode: 200, body: "ok" };
  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
}
