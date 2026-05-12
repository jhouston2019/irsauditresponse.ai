const Stripe = require("stripe");
const { getSupabaseAdmin } = require("./_supabase.js");

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { session_id: rawSid, letterRaw } = JSON.parse(event.body || "{}");
    const session_id = typeof rawSid === "string" ? rawSid.trim() : "";

    if (!session_id) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "session_id required" }),
      };
    }

    if (letterRaw == null || typeof letterRaw !== "string") {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "letterRaw required" }),
      };
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return {
        statusCode: 503,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "Stripe not configured" }),
      };
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      return {
        statusCode: 402,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "Payment required" }),
      };
    }

    const admin = getSupabaseAdmin();

    const { data: wsRow, error: selErr } = await admin
      .from("wizard_state")
      .select("state")
      .eq("stripe_session_id", session_id)
      .maybeSingle();

    if (selErr) {
      console.error("[update-wizard-state-letter] select:", selErr.message);
      return {
        statusCode: 500,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "Lookup failed" }),
      };
    }

    if (!wsRow) {
      return {
        statusCode: 404,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "Session not found" }),
      };
    }

    const prev =
      wsRow.state != null && typeof wsRow.state === "object" && !Array.isArray(wsRow.state)
        ? wsRow.state
        : {};
    const updatedState = { ...prev, letterRaw };

    const { error: upErr } = await admin
      .from("wizard_state")
      .update({ state: updatedState })
      .eq("stripe_session_id", session_id);

    if (upErr) {
      console.error("[update-wizard-state-letter] update failed:", upErr);
      return {
        statusCode: 500,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "Update failed" }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: true }),
    };
  } catch (e) {
    console.error("[update-wizard-state-letter] error:", e);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Internal error" }),
    };
  }
};
