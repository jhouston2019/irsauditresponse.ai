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

    // Stripe has confirmed payment. Reconcile DB here so /register works even if the webhook is still in flight.
    const supabase = getSupabaseAdmin();
    const md = session.metadata || {};
    const jobId = md.job_id != null && String(md.job_id).trim() !== "" ? String(md.job_id).trim() : "";
    const userIdMeta = md.user_id != null && String(md.user_id).trim() !== "" ? String(md.user_id).trim() : "";
    const customerEmail =
      session.customer_email ||
      (session.customer_details && session.customer_details.email) ||
      null;

    if (jobId) {
      const patch = {
        paid: true,
        is_unlocked: true,
        stripe_session_id: session.id,
      };
      if (customerEmail) patch.customer_email = customerEmail;
      if (userIdMeta) patch.user_id = userIdMeta;
      const { error: upErr } = await supabase.from("audit_jobs").update(patch).eq("id", jobId);
      if (upErr) {
        console.warn("verify-session audit_jobs update:", upErr.message);
      }
    }

    try {
      const row = {
        stripe_session_id: session.id,
        paid: true,
        is_unlocked: true,
      };
      if (jobId) row.id = jobId;
      if (userIdMeta) row.user_id = userIdMeta;
      if (customerEmail) row.customer_email = customerEmail;
      await supabase.from("audit_jobs").upsert(row, { onConflict: "stripe_session_id" });
    } catch (e) {
      console.warn("verify-session audit_jobs upsert:", e.message);
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
