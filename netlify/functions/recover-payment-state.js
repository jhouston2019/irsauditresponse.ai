const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");
const { getSupabaseAdmin } = require("./_supabase.js");
const { corsHeaders } = require("./_wizardAuth.js");
const { getBillingSnapshot } = require("./_billing.js");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function json(statusCode, event, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(event),
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(event), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return json(405, event, { error: "Method not allowed" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, event, { error: "Invalid JSON" });
  }

  const sessionId = body.session_id || body.sessionId;
  const supabase = getSupabaseAdmin();

  const auth =
    event.headers.authorization ||
    event.headers.Authorization ||
    "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  let user = null;
  if (match) {
    const token = match[1].trim();
    const url = process.env.SUPABASE_URL;
    const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (url && anon) {
      const supabaseUser = createClient(url, anon, { auth: { persistSession: false } });
      const { data } = await supabaseUser.auth.getUser(token);
      user = data?.user || null;
    }
  }

  if (user) {
    const snap = await getBillingSnapshot(user.id, user.email);
    if (snap.paid === true) {
      console.log(JSON.stringify({ PAYMENT_SESSION_VERIFIED: true, mode: "recover", userId: user.id }));
      return json(200, event, { state: "paid", redirect: "/app", billing: snap });
    }
  }

  if (sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === "paid") {
        return json(200, event, { state: "processing", redirect: "/success", query: { session_id: sessionId } });
      }
    } catch (_) {
      /* ignore */
    }

    const { data: proc } = await supabase
      .from("processed_sessions")
      .select("status")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (
      proc?.status === "pending" ||
      proc?.status === "verified" ||
      proc?.status === "expired" ||
      proc?.status === "failed"
    ) {
      return json(200, event, { state: "processing", redirect: "/success", query: { session_id: sessionId } });
    }
  }

  return json(200, event, { state: "none", redirect: "/pricing" });
};
