const { createClient } = require("@supabase/supabase-js");
const { corsHeaders } = require("./_wizardAuth.js");
const { getBillingSnapshot } = require("./_billing.js");

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

  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return json(405, event, { error: "Method not allowed" });
  }

  const auth =
    event.headers.authorization ||
    event.headers.Authorization ||
    "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return json(401, event, { authenticated: false });
  }

  const token = match[1].trim();
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return json(503, event, { error: "Server configuration error" });
  }

  const supabaseUser = createClient(url, anon, { auth: { persistSession: false } });
  const {
    data: { user },
    error,
  } = await supabaseUser.auth.getUser(token);

  if (error || !user) {
    return json(401, event, { authenticated: false, error: "Invalid or expired session" });
  }

  const billing = await getBillingSnapshot(user.id, user.email);
  return json(200, event, {
    authenticated: true,
    user: { id: user.id, email: user.email, created_at: user.created_at },
    billing,
  });
};
