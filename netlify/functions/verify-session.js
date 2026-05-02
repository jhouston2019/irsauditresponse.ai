const Stripe = require("stripe");
const { getSupabaseAdmin } = require("./_supabase.js");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { session_id } = JSON.parse(event.body || "{}");
    if (!session_id) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
        body: JSON.stringify({ error: "Missing session_id" }),
      };
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      return {
        statusCode: 402,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
        body: JSON.stringify({ error: "Payment not completed" }),
      };
    }

    const supabase = getSupabaseAdmin();
    const { data: job } = await supabase
      .from("audit_jobs")
      .select("paid, is_unlocked")
      .eq("stripe_session_id", session_id)
      .maybeSingle();

    if (!job || (!job.paid && !job.is_unlocked)) {
      return {
        statusCode: 402,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
        body: JSON.stringify({ error: "Payment entitlements pending" }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
      body: JSON.stringify({ paid: true }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
      body: JSON.stringify({ error: e.message || "error" }),
    };
  }
};
