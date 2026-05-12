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
      const { data: updatedById, error: upErr } = await supabase
        .from("audit_jobs")
        .update(patch)
        .eq("id", jobId)
        .select("id");
      if (upErr) {
        console.error(
          JSON.stringify({
            fn: "verify-session",
            phase: "audit_jobs_update_error",
            jobId,
            message: upErr.message,
          }),
        );
      } else {
        const n = updatedById?.length ?? 0;
        console.log(
          JSON.stringify({
            fn: "verify-session",
            phase: "audit_jobs_update_by_id",
            jobId,
            rowsUpdated: n,
            stripeSessionId: session.id,
          }),
        );
        if (n === 0) {
          console.error(
            JSON.stringify({
              fn: "verify-session",
              phase: "audit_jobs_zero_rows",
              jobId,
              hint: "No row matched id — job_id metadata may not match preview row or migration issue",
            }),
          );
        }
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

    let wizardState = null;
    try {
      const { data: wsRow, error: wsErr } = await supabase
        .from("wizard_state")
        .select("state")
        .eq("stripe_session_id", session_id)
        .maybeSingle();
      if (wsErr) {
        console.warn("verify-session wizard_state:", wsErr.message);
      } else {
        wizardState = wsRow?.state ?? null;
      }
    } catch (e) {
      console.warn("verify-session wizard_state:", e.message);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
      body: JSON.stringify({
        paid: true,
        customer_email: customerEmail || null,
        wizardState,
        jobId: jobId || null,
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
      body: JSON.stringify({ error: e.message || "error" }),
    };
  }
};
