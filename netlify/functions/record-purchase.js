const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };
  }

  if (!supabaseUrl || !supabaseKey) {
    return {
      statusCode: 503,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
      body: JSON.stringify({ error: "Server configuration error" }),
    };
  }

  try {
    const { session_id, user_id } = JSON.parse(event.body || "{}");
    if (!session_id || !user_id) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
        body: JSON.stringify({ error: "session_id and user_id required" }),
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    const {
      data: jobRows,
      error: upJob,
    } = await supabase.from("audit_jobs").update({ user_id }).eq("stripe_session_id", session_id).select("id");

    if (upJob) {
      console.error("record-purchase audit_jobs update:", upJob);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
        body: JSON.stringify({ error: upJob.message, step: "audit_jobs_update" }),
      };
    }

    if (!jobRows || jobRows.length === 0) {
      console.error("record-purchase: no audit_jobs row for stripe_session_id", session_id);
      return {
        statusCode: 422,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
        body: JSON.stringify({
          error:
            "No checkout record matched this session. Your payment may still process—try again shortly or contact support.",
          code: "NO_AUDIT_JOB",
        }),
      };
    }

    const { error: insErr } = await supabase.from("purchases").insert({
      user_id,
      stripe_session_id: session_id,
      created_at: new Date().toISOString(),
    });

    if (insErr && insErr.code !== "23505") {
      console.warn("record-purchase purchases insert skipped (non-fatal):", insErr.code, insErr.message);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
      body: JSON.stringify({ ok: true }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
      body: JSON.stringify({ error: e.message || "error" }),
    };
  }
};
