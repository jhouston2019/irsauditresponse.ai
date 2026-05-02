/**
 * Shared CORS, auth, and access control for IRS Audit Defense wizard functions.
 */
const { createClient } = require("@supabase/supabase-js");

function getAllowedOrigins() {
  const site = (process.env.SITE_URL || "https://irsauditresponseai.netlify.app").replace(/\/$/, "");
  const extras = (process.env.CORS_EXTRA_ORIGINS || "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return new Set([
    site,
    ...extras,
    "http://localhost:8888",
    "http://127.0.0.1:8888",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);
}

function corsHeaders(event, extra = {}) {
  const origin = event.headers.origin || event.headers.Origin || "";
  const allowed = getAllowedOrigins();
  const site = (process.env.SITE_URL || "https://irsauditresponseai.netlify.app").replace(/\/$/, "");
  const allowOrigin = origin && allowed.has(origin) ? origin : site;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Service-Key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    ...extra,
  };
}

function json(statusCode, event, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(event),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function sanitizeString(s, maxLen = 150000) {
  if (s == null) return "";
  const str = String(s).replace(/\0/g, "");
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

/**
 * Requires Bearer JWT (Supabase), unless:
 * - X-Service-Key matches AUDIT_DEFENSE_SERVICE_KEY (server-side only; never expose in client HTML)
 */
async function authorizeWizardRequest(event) {
  if (process.env.AUDIT_DEFENSE_BYPASS_PAYMENT === "true") {
    throw new Error("AUDIT_DEFENSE_BYPASS_PAYMENT must not be enabled");
  }

  const serviceKey = process.env.AUDIT_DEFENSE_SERVICE_KEY;
  const providedService = event.headers["x-service-key"] || event.headers["X-Service-Key"];
  if (serviceKey && providedService === serviceKey) {
    return { ok: true, email: "service@internal", internal: true };
  }

  const auth =
    event.headers.authorization ||
    event.headers.Authorization ||
    "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, response: json(401, event, { error: "Authentication required" }) };
  }
  const token = match[1].trim();
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    console.error("wizardAuth: missing SUPABASE_URL or SUPABASE_ANON_KEY");
    return { ok: false, response: json(503, event, { error: "Server configuration error" }) };
  }

  const supabaseUser = createClient(url, anon, { auth: { persistSession: false } });
  const {
    data: { user },
    error,
  } = await supabaseUser.auth.getUser(token);

  if (error || !user || !user.email) {
    return { ok: false, response: json(401, event, { error: "Invalid or expired session" }) };
  }

  return { ok: true, email: user.email, userId: user.id, user };
}

module.exports = {
  corsHeaders,
  json,
  sanitizeString,
  authorizeWizardRequest,
};
