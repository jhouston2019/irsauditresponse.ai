const Stripe = require("stripe");
const { getSupabaseAdmin } = require("./_supabase.js");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (process.env.AUDIT_DEFENSE_BYPASS_PAYMENT === "true") {
    throw new Error("AUDIT_DEFENSE_BYPASS_PAYMENT must not be enabled");
  }

  try {
    const sig = event.headers["stripe-signature"];
    const payload = event.isBase64Encoded ? Buffer.from(event.body, "base64") : Buffer.from(event.body || "");

    const stripeEvent = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET);

    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;
      const supabase = getSupabaseAdmin();

      const md = session.metadata || {};
      const jobId = md.job_id;
      const userId = md.user_id;

      if (jobId) {
        const { data: existing } = await supabase
          .from("audit_jobs")
          .select("paid")
          .eq("id", jobId)
          .maybeSingle();

        if (!existing) {
          return {
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: "ok",
          };
        }

        if (!existing.paid) {
          const patch = {
            paid: true,
            is_unlocked: true,
            stripe_session_id: session.id,
          };
          if (userId) patch.user_id = userId;

          await supabase.from("audit_jobs").update(patch).eq("id", jobId);
        }
      }
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: "ok",
    };
  } catch (err) {
    return {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: `Webhook Error: ${err.message}`,
    };
  }
};
