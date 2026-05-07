const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isFkViolation(err) {
  if (!err) return false;
  if (err.code === "23503") return true;
  const msg = String(err.message || "");
  return (
    msg.includes("foreign key constraint") ||
    msg.includes("audit_jobs_user_id_fkey")
  );
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

    const userId = String(user_id).trim();
    if (!UUID_RE.test(userId)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
        body: JSON.stringify({
          code: "BAD_USER_ID",
          error: "user_id must be a valid UUID",
        }),
      };
    }

    let jobRows = null;
    for (let attempt = 0; attempt <= 21; attempt++) {
      const { data, error: upJob } = await supabase
        .from("audit_jobs")
        .update({ user_id: userId })
        .eq("stripe_session_id", session_id)
        .select("id");

      if (upJob) {
        console.error("record-purchase audit_jobs update:", upJob);
        if (isFkViolation(upJob)) {
          await sleep(280 + attempt * 45);
          continue;
        }
        return {
          statusCode: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders() },
          body: JSON.stringify({ error: upJob.message, step: "audit_jobs_update" }),
        };
      }

      if (data && data.length > 0) {
        jobRows = data;
        break;
      }

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

    if (!jobRows || jobRows.length === 0) {
      return {
        statusCode: 409,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
        body: JSON.stringify({
          code: "FK_AUDIT_JOB_RETRY_EXHAUSTED",
          error:
            "Could not link this purchase after retries—foreign key failures usually mean Netlify must use SUPABASE_SERVICE_ROLE_KEY (service role), not the anon key, for this function.",
        }),
      };
    }

    const { error: insErr } = await supabase.from("purchases").insert({
      user_id: userId,
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
