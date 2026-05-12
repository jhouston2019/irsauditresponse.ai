// Hardening: JWT via authorizeWizardRequest + enforcePaidAuditJob before OpenAI; no public.users queries in this function.
const OpenAI = require("openai");
const { authorizeWizardRequest, json, sanitizeString, corsHeaders } = require("./_wizardAuth.js");
const { getSupabaseAdmin } = require("./_supabase.js");
const { enforcePaidAuditJob } = require("./_auditJobs.js");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function stripeSessionFromEvent(event) {
  const h = event.headers["x-stripe-session"] || event.headers["X-Stripe-Session"] || "";
  return String(h).trim();
}

function persistError(message, code, statusHint = 500) {
  const e = new Error(message);
  e.code = code;
  e.statusHint = statusHint;
  return e;
}

/**
 * Single canonical persistence path for letter + analysis snapshot + strategy + status.
 */
async function persistLetterDeliverables(admin, event, opts) {
  const { wizardPreview, authUser, jobIdTrim, strat, analysis, letter } = opts;

  console.log(
    JSON.stringify({
      fn: "generate-letter",
      phase: "persist_start",
      jobId: jobIdTrim,
      wizardPreview,
    }),
  );

  if (!jobIdTrim || !UUID_RE.test(jobIdTrim)) {
    throw persistError("job_id is required and must be a valid UUID", "INVALID_JOB_ID", 400);
  }
  const text = String(letter || "");
  if (!text.trim()) {
    throw persistError("Letter body empty", "EMPTY_LETTER", 500);
  }
  if (text.length > 4_800_000) {
    throw persistError("Letter too large", "LETTER_TOO_LARGE", 413);
  }

  const { data: job, error: selErr } = await admin
    .from("audit_jobs")
    .select("id,user_id,stripe_session_id,paid,is_unlocked")
    .eq("id", jobIdTrim)
    .maybeSingle();

  if (selErr) {
    console.error(JSON.stringify({ fn: "generate-letter", phase: "job_lookup", error: selErr.message }));
    throw persistError(selErr.message, "JOB_LOOKUP_FAILED", 500);
  }
  if (!job) {
    throw persistError("Job not found", "JOB_NOT_FOUND", 404);
  }

  const sid = stripeSessionFromEvent(event);
  const paid = !!(job.paid || job.is_unlocked);

  if (!wizardPreview) {
    if (!authUser?.id) {
      throw persistError("Authentication required", "AUTH_REQUIRED", 401);
    }
    if (job.user_id !== authUser.id) {
      throw persistError("Job does not belong to this user", "JOB_FORBIDDEN", 403);
    }
    if (!paid) {
      throw persistError("Payment required", "PAYMENT_REQUIRED", 402);
    }
  } else if (sid) {
    if (job.stripe_session_id !== sid) {
      throw persistError("Stripe session does not match this job", "STRIPE_MISMATCH", 403);
    }
    if (!paid) {
      throw persistError("Payment required", "PAYMENT_REQUIRED", 402);
    }
  } else {
    if (job.user_id) {
      throw persistError("Sign in to save this letter to your account job", "PREVIEW_AUTH_REQUIRED", 403);
    }
    if (job.stripe_session_id) {
      throw persistError("Stripe session required for this job", "STRIPE_HEADER_REQUIRED", 400);
    }
  }

  let letter_full_json;
  try {
    letter_full_json = JSON.stringify(analysis);
  } catch {
    letter_full_json = "{}";
  }
  if (letter_full_json.length > 4_800_000) letter_full_json = letter_full_json.slice(0, 4_800_000);

  const updatedAt = new Date().toISOString();
  const patch = {
    letter_html: text,
    letter_full: letter_full_json,
    selected_strategy: strat,
    updated_at: updatedAt,
  };

  console.log(
    JSON.stringify({
      fn: "generate-letter",
      phase: "persist_update_attempt",
      jobId: jobIdTrim,
    }),
  );

  const { data: updated, error: upErr } = await admin
    .from("audit_jobs")
    .update(patch)
    .eq("id", jobIdTrim)
    .select("id");

  if (upErr) {
    console.error(JSON.stringify({ fn: "generate-letter", phase: "persist_db_error", message: upErr.message }));
    throw persistError(upErr.message || "Update failed", "UPDATE_FAILED", 500);
  }
  if (!updated || updated.length === 0) {
    console.error(JSON.stringify({ fn: "generate-letter", phase: "persist_zero_rows", jobId: jobIdTrim }));
    throw persistError("Letter save matched no rows", "PERSIST_ZERO_ROWS", 500);
  }

  console.log(
    JSON.stringify({
      fn: "generate-letter",
      phase: "persist_ok",
      jobId: jobIdTrim,
      rowsUpdated: updated.length,
    }),
  );
}

const LETTER_SYSTEM_PROMPT = `You are a senior tax attorney and IRS correspondence specialist with 25 years
of experience handling IRS audits, CP2000 notices, deficiency notices, and
tax controversy matters. You have successfully resolved thousands of IRS disputes.

Generate a complete, professional, legally defensible IRS response letter based
on the analysis and strategy provided.

The letter must:

LEGAL STANDARDS:
- Cite specific Internal Revenue Code sections where applicable
- Reference relevant Treasury Regulations (Treas. Reg. §)
- Cite applicable Revenue Procedures and Revenue Rulings where relevant
- Use proper IRS correspondence conventions and terminology
- Never make admissions not required by the chosen strategy
- Frame all positions in the taxpayer's most favorable light
- For dispute strategy: invoke taxpayer rights under IRC § 7521 and the 
  Taxpayer Bill of Rights where applicable

FORMAT:
- Full formal business letter format
- Date: [DATE] (placeholder)
- Taxpayer info block: [TAXPAYER NAME], [ADDRESS], [CITY STATE ZIP], [SSN LAST 4]
- IRS address block: use irsContactInfo.address from the analysis if available. If not available, use [IRS ADDRESS — copy the return address from the top of your notice].
- Re: line with notice number, tax year, SSN last 4
- Opening paragraph: clearly state purpose and taxpayer position
- Body: methodically address each discrepancy/issue
- Supporting argument section: legal basis, relevant code sections
- Request for relief section: specific resolution requested
- Closing: professional, non-adversarial, cooperative tone
- Signature block: [TAXPAYER SIGNATURE], [PRINTED NAME], [DATE], [PHONE], [EMAIL]
- Enclosures list (based on documentationNeeded from analysis)

PLACEHOLDER RULES — CRITICAL:
If a specific value is not available from the analysis
(tax year, notice date, IRS address, notice number,
reference number), do NOT use a generic placeholder.
Instead write a specific instructional placeholder that
tells the taxpayer exactly what to find and where:

- Instead of [TAX YEAR] → [TAX YEAR — check line 1 of your notice]
- Instead of [NOTICE DATE] → [NOTICE DATE — upper right corner of notice]
- Instead of [IRS ADDRESS FROM NOTICE] → [IRS ADDRESS — copy the return address from the top of your notice]
- Instead of [NOTICE NUMBER] → [NOTICE NUMBER — e.g. CP90, found at top of notice]
- Instead of [TAX YEAR] → [TAX YEAR — found near top of notice]
- Instead of [BRIEF DESCRIPTION OF EVIDENCE OR ISSUES, IF KNOWN] → [DESCRIBE YOUR SPECIFIC SITUATION — e.g. 'the income was already reported on my return' or 'I have receipts for these deductions']

Every placeholder must be actionable. The taxpayer must
know exactly what to write or where to find the information.
Never leave a vague bracketed placeholder.

TONE AND STRATEGY INSTRUCTIONS BY TYPE:

For AGREE strategy:
- Acknowledge IRS position clearly and without ambiguity
- Request payment plan if amount is substantial (>$2,500)
- Reference installment agreement under IRC § 6159 if applicable
- Request penalty abatement under reasonable cause if first-time issue
- Request first-time abatement (FTA) under Rev. Proc. 84-35 if eligible
- Closing: cooperative and resolution-focused

For PARTIAL AGREEMENT strategy:
- Clearly delineate agreed items from disputed items
- Agree on items with appropriate acknowledgment
- Dispute remaining items with specific factual and legal basis
- For each disputed item: state taxpayer's position, cite support, 
  request specific relief
- Request that IRS recalculate proposed amount excluding disputed items
- Reference IRC § 6213(b) for Math Error procedures if applicable

For FULL DISPUTE strategy:
- Open with clear, firm statement of taxpayer's non-agreement
- Assert all applicable taxpayer rights under Taxpayer Bill of Rights
- For each discrepancy: provide specific factual rebuttal
- Cite IRC § 6201 (IRS burden of assessment), § 7491 (burden of proof)
- Reference Cohan rule (Cohan v. Commissioner, 39 F.2d 540) if 
  documentation is imperfect but amounts are credible
- For 1099 discrepancies involving basis: assert IRC § 1012 cost basis rights
- For self-employment income disputes: cite reasonable business expense 
  deductions under IRC § 162
- Request Appeals consideration under IRC § 7803(e) if appropriate
- Demand that IRS provide substantiation of third-party reports
- Closing: firm but professional, assert right to appeal

For EXTENSION strategy:
- Request 30/60-day extension to respond
- State reason for extension (gathering documentation)
- Confirm taxpayer's intent to respond fully
- Request IRS acknowledge extension in writing
- Reference standard IRS extension practice under Rev. Proc. 2005-18

For OTHER / CUSTOM strategy:
- Read the additionalContext field carefully — it contains
  the taxpayer's specific situation and desired approach
- Build the entire letter around that specific context
- If the context suggests dispute: use dispute-style language,
  cite relevant IRC sections based on the specific issue described
- If the context suggests agreement with explanation: use
  cooperative tone with clear factual explanation
- If the context describes unreported income that was actually
  reported elsewhere, missing basis, reimbursements, or
  personal transfers: address each point specifically
- Always invoke Taxpayer Bill of Rights
- Always request specific relief based on the described situation
- The letter must feel custom-written for this exact situation,
  not generic
- IRC citations must match the specific issue described in
  additionalContext

HIGH-RISK AND CRITICAL NOTICES:
If the analysis indicates riskLevel is critical and/or the notice is a
high-stakes type (e.g. CP90, LT11, CP3219A), generate the strongest
possible letter. Do not discourage the taxpayer from using this response
or imply they should not mail a timely reply. For critical notices
(CP90, LT11, CP3219A), at the end of the letter, after the enclosures
list, add this line:

Note: Given the urgency of this matter, you may wish to have a licensed tax professional or enrolled agent review this letter before mailing. This draft gives them a complete, structured starting point.

OUTPUT: Return ONLY the complete letter text. No JSON wrapper.
No markdown. Pure text formatted for printing/mailing.
The letter should be 400-800 words depending on complexity.
Use actual line breaks and spacing appropriate for a formal letter.`;

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(event), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return json(405, event, { error: "Method not allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return json(503, event, { error: "Letter generation is not configured." });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, event, { error: "Invalid JSON body" });
  }

  const wizardPreview = body.wizard_preview === true;

  let authUser = null;
  if (!wizardPreview) {
    const auth = await authorizeWizardRequest(event);
    if (!auth.ok) return auth.response;
    if (!auth.user?.id) {
      return json(403, event, { error: "Forbidden" });
    }
    authUser = auth.user;
  } else if (process.env.DISABLE_WIZARD_PREVIEW === "true") {
    return json(403, event, { error: "Wizard preview is disabled.", code: "preview_disabled" });
  }

  const { strategy, taxpayerName, taxpayerAddress, additionalContext, job_id, analysis: analysisBody } = body;

  const jobIdTrim = typeof job_id === "string" ? job_id.trim() : "";
  if (!jobIdTrim || !UUID_RE.test(jobIdTrim)) {
    console.log(JSON.stringify({ fn: "generate-letter", phase: "reject", code: "missing_job_id" }));
    return json(400, event, {
      error: "job_id is required and must be a valid UUID",
      code: "missing_job_id",
    });
  }

  console.log(JSON.stringify({ fn: "generate-letter", phase: "request_accepted", jobId: jobIdTrim, wizardPreview }));

  const admin = getSupabaseAdmin();

  let analysis;

  if (wizardPreview) {
    analysis = analysisBody;
    if (!analysis || typeof analysis !== "object") {
      return json(400, event, {
        error: "wizard_preview requires an analysis object in the request body (copy from Analyze step)",
      });
    }
  } else {
    const userId = authUser.id;
    const payDenied = await enforcePaidAuditJob(admin, json, event, userId, jobIdTrim);
    if (payDenied) return payDenied;

    const row = await admin.from("audit_jobs").select("letter_full").eq("id", jobIdTrim).eq("user_id", userId).maybeSingle();

    if (row.error || !row.data?.letter_full?.trim()) {
      return json(400, event, { error: "Run notice analysis before generating a letter." });
    }

    try {
      analysis = JSON.parse(row.data.letter_full);
    } catch {
      return json(400, event, { error: "Stored analysis is invalid; run Analyze again." });
    }
  }

  if (!analysis || typeof analysis !== "object") {
    return json(400, event, { error: "Stored analysis is missing structured fields." });
  }

  const strat = sanitizeString(strategy || "", 32);
  if (!["agree", "partial", "dispute", "extension", "other", "custom"].includes(strat)) {
    return json(400, event, { error: "strategy must be agree, partial, dispute, extension, other, or custom" });
  }

  let analysisJson;
  try {
    analysisJson = JSON.stringify(analysis).slice(0, 120000);
  } catch {
    return json(400, event, { error: "Invalid analysis payload" });
  }

  const userMessage = `Analysis: ${analysisJson}
Strategy selected: ${strat} (agree = Full Agreement; partial = Partial Agreement; dispute = Full Dispute; extension = Request Extension; other/custom = follow additionalContext)
Taxpayer name: ${sanitizeString(taxpayerName || "TAXPAYER NAME", 200)}
Taxpayer address: ${sanitizeString(taxpayerAddress || "ADDRESS", 500)}
Additional context: ${sanitizeString(additionalContext || "None provided", 4000)}

Generate the complete response letter now.`;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: LETTER_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.35,
      max_tokens: 4096,
    });

    const usage = completion.usage || null;
    if (usage) console.log(JSON.stringify({ fn: "generate-letter", usage }));

    const letter = (completion.choices?.[0]?.message?.content || "").trim();
    if (!letter) {
      return json(503, event, { error: "Letter generation produced no content. Please try again." });
    }

    await persistLetterDeliverables(admin, event, {
      wizardPreview,
      authUser,
      jobIdTrim,
      strat,
      analysis,
      letter,
    });

    const payload = { letter };
    if (wizardPreview) payload.wizard_preview_only = true;
    if (usage) payload.usage = usage;
    return json(200, event, payload);
  } catch (e) {
    if (e.code && typeof e.statusHint === "number") {
      const status = e.statusHint;
      console.error(
        JSON.stringify({
          fn: "generate-letter",
          phase: "persist_or_validation_error",
          code: e.code,
          message: e.message,
        }),
      );
      return json(status, event, {
        error: e.message,
        code: e.code,
      });
    }
    console.error("generate-letter error:", e);
    return json(503, event, { error: "Letter generation is temporarily unavailable. Please try again." });
  }
};
