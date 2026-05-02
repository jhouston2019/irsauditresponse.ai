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

module.exports = { enforcePaidAuditJob };
