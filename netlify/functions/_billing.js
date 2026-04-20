/**
 * Single source of truth for billing + usage reads in Netlify functions.
 * Access (paid) requires billing_entitlements.payment_verified AND active (fail-closed).
 */
const { getSupabaseAdmin } = require("./_supabase.js");

const PLAN_DEFAULT_LIMITS = {
  single: 1,
  premier: 10,
  enterprise: -1,
};

/** Legacy helper for admin / migration tooling only — not used for access control. */
async function legacyEmailHasPaid(supabase, email) {
  if (!email) return false;
  const { data: tlh } = await supabase
    .from("tlh_letters")
    .select("id")
    .eq("user_email", email)
    .eq("stripe_payment_status", "paid")
    .limit(1);
  if (tlh?.length) return true;
  const { data: audit } = await supabase
    .from("audit_responses")
    .select("id")
    .eq("user_email", email)
    .eq("stripe_payment_status", "paid")
    .limit(1);
  return !!(audit && audit.length > 0);
}

function normalizePlanType(raw) {
  const p = (raw || "single").toLowerCase();
  if (p === "premier" || p === "pro" || p === "proplus") return "premier";
  if (p === "enterprise" || p === "business") return "enterprise";
  return "single";
}

function defaultLimitForPlan(planType) {
  return PLAN_DEFAULT_LIMITS[normalizePlanType(planType)] ?? 1;
}

/**
 * paid === true only when entitlement is active AND payment_verified === true (explicit authority).
 * On any error or missing row: paid === false (fail-closed).
 */
async function getBillingSnapshot(userId, email) {
  void email;
  const supabase = getSupabaseAdmin();
  let plan_type = "single";
  let active = false;
  let payment_verified = false;
  let renewal_at = null;
  let review_limit = 1;
  let paid = false;

  const { data: ent, error: entErr } = await supabase
    .from("billing_entitlements")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (entErr) {
    console.error("getBillingSnapshot entitlements", entErr.message);
    paid = false;
    active = false;
    payment_verified = false;
  } else if (ent) {
    plan_type = normalizePlanType(ent.plan_type);
    active = !!ent.active;
    payment_verified = ent.payment_verified === true;
    renewal_at = ent.renewal_at || null;
    review_limit =
      typeof ent.review_limit === "number" && ent.review_limit !== 0
        ? ent.review_limit
        : defaultLimitForPlan(plan_type);
    paid = active === true && payment_verified === true;
  } else {
    paid = false;
    active = false;
    payment_verified = false;
  }

  let reviews_used = 0;
  const { data: usageRow, error: usageErr } = await supabase
    .from("user_review_usage")
    .select("reviews_used")
    .eq("user_id", userId)
    .maybeSingle();

  if (usageErr) {
    console.error("getBillingSnapshot usage", usageErr.message);
  } else {
    reviews_used = usageRow?.reviews_used ?? 0;
  }

  return {
    plan_type,
    active,
    payment_verified,
    renewal_at,
    paid,
    usage: { used: reviews_used, limit: review_limit },
  };
}

/**
 * Fail-closed: block unless paid is strictly true.
 */
function shouldBlockWizard(snap) {
  return snap.paid !== true;
}

async function incrementReviewUsage(userId) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc("increment_review_usage", { p_user_id: userId });
  if (error) {
    console.error("increment_review_usage RPC failed", error.message);
    const { data: row } = await supabase.from("user_review_usage").select("reviews_used").eq("user_id", userId).maybeSingle();
    const next = (row?.reviews_used ?? 0) + 1;
    await supabase.from("user_review_usage").upsert(
      { user_id: userId, reviews_used: next, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  }
}

module.exports = {
  getBillingSnapshot,
  legacyEmailHasPaid,
  normalizePlanType,
  defaultLimitForPlan,
  shouldBlockWizard,
  incrementReviewUsage,
};
