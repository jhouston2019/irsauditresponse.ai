const { authorizeExportViaStripeSession } = require("./_stripeSessionExportAuth.js");

async function enforcePaidAuditJob(admin, json, event, userId, jobId) {
  if (!jobId) {
    return json(400, event, { error: "job_id is required", code: "missing_job_id" });
  }

  const { data: job } = await admin
    .from("audit_jobs")
    .select("paid, is_unlocked")
    .eq("user_id", userId)
    .eq("id", jobId)
    .maybeSingle();

  if (!job || (!job.paid && !job.is_unlocked)) {
    return json(402, event, {
      error: "Payment required",
      code: "payment_required",
    });
  }

  return null;
}

/**
 * Paid export: prefer JWT + audit_jobs row (user owns paid job).
 * If that fails with 402 (e.g. paid in Stripe but user_id not linked yet), allow when
 * X-Stripe-Session is a paid checkout whose metadata.job_id matches body.job_id.
 */
async function enforcePaidExportAccess(admin, json, event, userId, jobIdTrim) {
  if (userId) {
    const denied = await enforcePaidAuditJob(admin, json, event, userId, jobIdTrim);
    if (!denied) return null;
    const stripeAuth = await authorizeExportViaStripeSession(event, jobIdTrim, json);
    if (stripeAuth.ok) return null;
    if (stripeAuth.skip) return denied;
    return stripeAuth.response || denied;
  }
  const stripeAuth = await authorizeExportViaStripeSession(event, jobIdTrim, json);
  if (!stripeAuth.ok) {
    return (
      stripeAuth.response ||
      json(401, event, { error: "Authentication required" })
    );
  }
  return null;
}

module.exports = { enforcePaidAuditJob, enforcePaidExportAccess };
