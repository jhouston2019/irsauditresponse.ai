const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");
const { getSupabaseAdmin } = require("./_supabase.js");
const { corsHeaders } = require("./_wizardAuth.js");
const { normalizePlanType, defaultLimitForPlan } = require("./_billing.js");
const {
  SESSION_STATUS,
  insertPaymentAudit,
  checkoutStripeCustomerId,
  listStripeCustomerIdByEmail,
  getOrCreateAuthUser,
  enforceLockedUser,
  ensureEntitlement,
  finalizeSession,
  normEmail,
} = require("./_paymentReconcile.js");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const rateBucket = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;

function logEvent(name, payload) {
  console.log(JSON.stringify({ [name]: true, ...payload }));
}

function getClientIp(event) {
  const xf = event.headers["x-forwarded-for"] || event.headers["X-Forwarded-For"] || "";
  if (typeof xf === "string" && xf.trim()) return xf.split(",")[0].trim();
  return String(event.headers["client-ip"] || event.headers["x-real-ip"] || "unknown");
}

function assertRateLimit(ip) {
  const now = Date.now();
  let hits = rateBucket.get(ip) || [];
  hits = hits.filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) return false;
  hits.push(now);
  rateBucket.set(ip, hits);
  return true;
}

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

async function getJwtUser(event) {
  const auth = event.headers.authorization || event.headers.Authorization || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const supabaseUser = createClient(url, anon, { auth: { persistSession: false } });
  const {
    data: { user },
    error,
  } = await supabaseUser.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(event), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return json(405, event, { error: "Method not allowed" });
  }

  const ip = getClientIp(event);
  if (!assertRateLimit(ip)) {
    logEvent("SESSION_REJECTED_SECURITY", { reason: "rate_limit", ip: "[redacted]" });
    return json(429, event, { error: "Too many requests", code: "rate_limited" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, event, { error: "Invalid JSON" });
  }

  const sessionId = body.session_id || body.sessionId;
  if (!sessionId || typeof sessionId !== "string") {
    return json(400, event, { error: "session_id required" });
  }

  const jwtUser = await getJwtUser(event);
  const supabase = getSupabaseAdmin();

  try {
    const { data: proc } = await supabase
      .from("processed_sessions")
      .select("status, user_id, locked_user_id, anonymous_finalize_used")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (body.refresh_magic_link) {
      if (!jwtUser) {
        logEvent("SESSION_REJECTED_SECURITY", { reason: "refresh_requires_jwt", sessionId });
        return json(401, event, { error: "Authorization required", code: "auth_required" });
      }
      if (proc?.status === SESSION_STATUS.COMPLETED && proc.user_id) {
        if (String(jwtUser.id) !== String(proc.user_id)) {
          logEvent("SESSION_REJECTED_SECURITY", { reason: "refresh_jwt_user_mismatch", sessionId });
          return json(403, event, { error: "Forbidden", code: "binding_mismatch" });
        }
      }
    }

    if (proc?.status === SESSION_STATUS.COMPLETED && proc.user_id && !body.refresh_magic_link) {
      logEvent("SESSION_REJECTED_SECURITY", { reason: "session_already_finalized", sessionId });
      return json(403, event, {
        error: "Session already finalized",
        code: "session_already_finalized",
      });
    }

    if (proc?.status === SESSION_STATUS.COMPLETED && proc.user_id && body.refresh_magic_link) {
      const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["customer"] });
      if (session.payment_status !== "paid") {
        return json(400, event, { error: "Checkout session is not paid" });
      }
      const bound = session.client_reference_id || session.metadata?.supabase_user_id;
      if (bound && String(bound) !== String(proc.user_id)) {
        logEvent("SESSION_REJECTED_SECURITY", { reason: "refresh_client_ref_mismatch", sessionId });
        return json(403, event, { error: "Binding mismatch", code: "binding_mismatch" });
      }
      const { data: uData, error: gErr } = await supabase.auth.admin.getUserById(proc.user_id);
      const emailResolved = uData?.user?.email;
      if (gErr || !emailResolved) {
        return json(400, event, { error: "User not found for refresh" });
      }
      const siteBase = (process.env.SITE_URL || "").replace(/\/$/, "");
      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: emailResolved,
        options: { redirectTo: `${siteBase}/app` },
      });
      if (linkErr || !linkData?.properties?.hashed_token) {
        return json(500, event, { error: "Could not create login session" });
      }
      await insertPaymentAudit(supabase, {
        session_id: sessionId,
        user_id: proc.user_id,
        event_type: "SESSION_VERIFIED",
        metadata: { mode: "refresh_magic_link" },
      });
      logEvent("SESSION_FINALIZED", { mode: "refresh_magic_link", sessionId, userId: proc.user_id });
      return json(200, event, {
        finalized: true,
        hashed_token: linkData.properties.hashed_token,
        email: emailResolved,
        user_id: proc.user_id,
      });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["customer"],
    });

    if (session.payment_status !== "paid") {
      return json(400, event, { error: "Checkout session is not paid yet" });
    }

    const boundRaw = session.client_reference_id || session.metadata?.supabase_user_id || null;
    const bound = boundRaw ? String(boundRaw).trim() : null;

    if (bound && !jwtUser) {
      logEvent("SESSION_REJECTED_SECURITY", { reason: "sign_in_required_for_bound_checkout", sessionId });
      await insertPaymentAudit(supabase, {
        session_id: sessionId,
        user_id: null,
        event_type: "SESSION_REJECTED",
        metadata: { reason: "sign_in_required_for_bound_checkout" },
      });
      return json(401, event, {
        error: "Sign in required to complete this purchase",
        code: "auth_required",
      });
    }

    if (bound && jwtUser && String(jwtUser.id) !== bound) {
      logEvent("SESSION_REJECTED_SECURITY", { reason: "jwt_binding_mismatch", sessionId });
      await insertPaymentAudit(supabase, {
        session_id: sessionId,
        user_id: jwtUser.id,
        event_type: "SESSION_REJECTED",
        metadata: { reason: "jwt_binding_mismatch" },
      });
      return json(403, event, { error: "Checkout binding mismatch", code: "binding_mismatch" });
    }

    let stripeCustomerId = checkoutStripeCustomerId(session);

    const email =
      session.customer_email ||
      session.customer_details?.email ||
      session.metadata?.user_email ||
      null;

    if (!email) {
      return json(400, event, { error: "Could not resolve customer email from Stripe session" });
    }

    if (!stripeCustomerId) {
      stripeCustomerId = await listStripeCustomerIdByEmail(stripe, email);
    }

    if (!bound && jwtUser && normEmail(jwtUser.email) !== normEmail(email)) {
      logEvent("SESSION_REJECTED_SECURITY", { reason: "jwt_email_mismatch_stripe", sessionId });
      return json(403, event, { error: "Account email does not match checkout", code: "binding_mismatch" });
    }

    let user = null;

    if (bound) {
      const { data: uData, error: gErr } = await supabase.auth.admin.getUserById(bound);
      if (gErr || !uData?.user) {
        logEvent("SESSION_REJECTED_SECURITY", { reason: "invalid_client_reference_user", sessionId });
        return json(403, event, { error: "Invalid checkout binding", code: "binding_invalid" });
      }
      if (normEmail(uData.user.email) !== normEmail(email)) {
        logEvent("SESSION_REJECTED_SECURITY", { reason: "client_reference_email_mismatch", sessionId });
        return json(403, event, { error: "Checkout binding mismatch", code: "binding_mismatch" });
      }
      user = uData.user;
      if (stripeCustomerId) {
        await supabase.auth.admin.updateUserById(user.id, {
          user_metadata: { ...user.user_metadata, stripe_customer_id: stripeCustomerId },
        });
      }
    } else {
      if (stripeCustomerId) {
        const { data: ent } = await supabase
          .from("billing_entitlements")
          .select("user_id")
          .eq("stripe_customer_id", stripeCustomerId)
          .maybeSingle();
        if (ent?.user_id) {
          const { data: uData, error: gErr } = await supabase.auth.admin.getUserById(ent.user_id);
          if (!gErr && uData?.user) user = uData.user;
        }
      }
      if (!user) {
        user = await getOrCreateAuthUser(supabase, email, stripeCustomerId);
      }
    }

    if (bound && String(user.id) !== bound) {
      logEvent("SESSION_REJECTED_SECURITY", { reason: "resolved_user_mismatch", sessionId });
      return json(403, event, { error: "User binding failed validation", code: "binding_mismatch" });
    }

    if (enforceLockedUser(proc, user.id, sessionId, logEvent) === "reject") {
      await insertPaymentAudit(supabase, {
        session_id: sessionId,
        user_id: user.id,
        event_type: "SESSION_REJECTED",
        metadata: { reason: "locked_user_mismatch", source: "auth_create" },
      });
      return json(403, event, { error: "Session locked to another account", code: "session_lock_mismatch" });
    }

    const planRaw = session.metadata?.plan_type || "single";
    const plan_type = normalizePlanType(planRaw);
    const review_limit = defaultLimitForPlan(plan_type);

    await ensureEntitlement(supabase, {
      userId: user.id,
      stripeCustomerId,
      plan_type,
      review_limit,
      sessionId,
    });

    await insertPaymentAudit(supabase, {
      session_id: sessionId,
      user_id: user.id,
      event_type: "ENTITLEMENT_GRANTED",
      metadata: { source: "auth_create" },
    });
    logEvent("ENTITLEMENT_GRANTED", { sessionId, userId: user.id, stage: "auth_create" });

    const siteBase = (process.env.SITE_URL || "").replace(/\/$/, "");
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: `${siteBase}/app`,
      },
    });

    if (linkErr) {
      console.error("SESSION_FINALIZED magic link", linkErr);
      return json(500, event, { error: "Could not create login session" });
    }

    const hashed_token = linkData?.properties?.hashed_token;
    if (!hashed_token) {
      return json(500, event, { error: "Magic link token missing" });
    }

    await finalizeSession(supabase, { sessionId, userId: user.id });

    if (!jwtUser) {
      await supabase
        .from("processed_sessions")
        .update({ anonymous_finalize_used: true })
        .eq("session_id", sessionId);
    }

    await insertPaymentAudit(supabase, {
      session_id: sessionId,
      user_id: user.id,
      event_type: "SESSION_COMPLETED",
      metadata: { source: "auth_create" },
    });

    logEvent("SESSION_FINALIZED", { sessionId, userId: user.id });

    return json(200, event, {
      hashed_token,
      email,
      user_id: user.id,
    });
  } catch (e) {
    console.error("SESSION_FINALIZED error", e);
    return json(500, event, { error: e.message || "session_creation_failed" });
  }
};
