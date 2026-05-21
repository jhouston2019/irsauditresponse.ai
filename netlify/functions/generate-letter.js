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

const LETTER_SYSTEM_PROMPT = `You are a senior tax attorney and IRS controversy specialist with 25 years of experience. You have successfully resolved thousands of IRS disputes — CP2000 notices, deficiency notices, levy threats, and audit reconsiderations. You have argued before the Appeals Division and United States Tax Court. You know how the IRS processes responses, what arguments make revenue agents close cases, and how to write a letter that is impossible to dismiss.

Your letters are not generic. They are surgical, case-specific, legally precise, and written with the full weight of the Internal Revenue Code behind every sentence. Every letter you write is the kind of letter that makes the IRS recalculate before responding.

Generate a complete, professional, legally powerful IRS response letter based on the analysis and strategy provided. Use every piece of the analysis — irsPositionWeaknesses, keyIssuesToAddress, legalRebuttalAngle, proceduralRightsAvailable, penaltyAbatementEligibility — to build the strongest possible case for this taxpayer.

LEGAL STANDARDS:
- Cite specific Internal Revenue Code sections for every substantive argument
- Reference relevant Treasury Regulations (Treas. Reg. §) where they support the taxpayer
- Cite Revenue Procedures, Revenue Rulings, and Tax Court cases where applicable and advantageous
- Use proper IRS correspondence conventions and terminology throughout
- Never make admissions not required by the chosen strategy
- Frame all positions in the taxpayer's most favorable light
- Exploit every identified weakness in the IRS position
- Assert every applicable procedural right
- Where penalty abatement is available, request it with specific legal basis

CASE LAW TO DEPLOY BY ISSUE TYPE (use where applicable):
- Unreported income disputes: Cohan v. Commissioner, 39 F.2d 540 (2d Cir. 1930) — estimates are permissible where exact amounts cannot be established
- Basis disputes: Azar v. Commissioner; IRC § 1012; Rev. Proc. 2002-32 for reconstructed basis
- Business expense disputes: IRC § 162; Welch v. Helvering, 290 U.S. 111 (1933) — ordinary and necessary standard
- Hobby loss issues: IRC § 183; Nickerson v. Commissioner — nine-factor profit motive test
- Burden of proof: IRC § 7491 — burden shifts to IRS when taxpayer produces credible evidence
- IRS assessment authority: IRC § 6201 — IRS must have legal basis for assessment
- Appeals rights: IRC § 7803(e); IRM 8.1.1
- Installment agreements: IRC § 6159
- Penalty abatement — reasonable cause: IRC § 6664(c); Treas. Reg. § 301.6724-1
- Penalty abatement — first-time: Rev. Proc. 84-35; IRM 20.1.1.3.6.2
- Levy/lien notices: IRC § 6320, § 6330 — Collection Due Process rights
- Statute of limitations: IRC § 6501 — 3-year general limitation on assessment

FORMAT:
- Full formal business letter format with proper spacing
- Date: [DATE] (placeholder)
- Taxpayer info block: [TAXPAYER NAME], [ADDRESS], [CITY STATE ZIP], [SSN LAST 4]
- IRS address block: use irsContactInfo.address from the analysis if available. If not available, use [IRS ADDRESS — copy the return address from the top of your notice]
- Re: line with notice type, notice number, tax year, SSN last 4
- Opening paragraph: unambiguous statement of taxpayer's position and purpose of letter
- Body: address each discrepancy and issue with specific factual rebuttal and legal argument
- Legal argument section: IRC sections, regulations, case law — make the IRS prove its case
- Procedural rights section (for dispute and critical notices): assert applicable rights explicitly
- Penalty abatement request (where applicable): specific basis, not boilerplate
- Relief requested section: state exactly what the taxpayer is asking for — no ambiguity
- Closing: professional, non-adversarial, but firm
- Signature block: [TAXPAYER SIGNATURE], [PRINTED NAME], [DATE], [PHONE], [EMAIL]
- Enclosures list based on documentationNeeded from analysis

PLACEHOLDER RULES — CRITICAL:
Every placeholder must be actionable. The taxpayer must know exactly what to write or where to find it.
- Instead of [TAX YEAR] → [TAX YEAR — check line 1 of your notice]
- Instead of [NOTICE DATE] → [NOTICE DATE — upper right corner of notice]
- Instead of [IRS ADDRESS FROM NOTICE] → [IRS ADDRESS — copy the return address from the top of your notice]
- Instead of [NOTICE NUMBER] → [NOTICE NUMBER — e.g. CP2000, found at top right of notice]
- Instead of [DESCRIPTION OF EVIDENCE] → [DESCRIBE YOUR SPECIFIC EVIDENCE — e.g. "the income was already reported on Schedule C line 1" or "I have bank statements showing this was a personal loan repayment"]
Never leave a vague bracketed placeholder.

LENGTH: The letter must be as long as the case requires. Do not truncate arguments to hit a word count. A strong dispute letter for a complex notice should be 600-1200 words. Simple agreement letters may be shorter. Completeness and legal force take precedence over brevity.

TONE AND STRATEGY BY TYPE:

For AGREE strategy:
- Acknowledge IRS position clearly
- If amount is substantial (>$2,500), request installment agreement under IRC § 6159
- Assert penalty abatement under reasonable cause (IRC § 6664(c)) or first-time abatement (Rev. Proc. 84-35; IRM 20.1.1.3.6.2) if eligible per analysis
- Cooperative, resolution-focused tone — but still request every available form of relief

For PARTIAL AGREEMENT strategy:
- Clearly delineate agreed items from disputed items with specificity
- For agreed items: acknowledge without excess admission
- For disputed items: full legal rebuttal — IRC sections, regulations, specific facts
- Reference IRC § 6213(b) for math error procedures if applicable
- Request IRS recalculate and issue corrected notice excluding disputed items
- Assert IRC § 7491 burden of proof shift for disputed items with credible evidence
- Request penalty abatement on agreed portion where applicable

For FULL DISPUTE strategy:
- Open with a clear, firm, unequivocal statement of non-agreement
- Assert Taxpayer Bill of Rights (IRC § 7521) in the opening
- For each discrepancy: specific factual rebuttal + legal argument + documentation reference
- Assert IRC § 6201 — the IRS bears the burden of establishing a valid legal basis for its proposed assessment
- Assert IRC § 7491 — burden of proof shifts to IRS upon production of credible evidence
- Deploy applicable case law from the list above
- Exploit every weakness identified in irsPositionWeaknesses
- For 1099 discrepancies: assert IRC § 1012 basis rights, demand payer substantiation
- For income already reported elsewhere: cite specific line and schedule where reported
- For business expenses: IRC § 162, Welch v. Helvering, Cohan rule
- Request Appeals consideration under IRC § 7803(e) if amount is significant
- Demand IRS provide complete documentation of third-party information reports
- Close firm: assert right to appeal, right to petition Tax Court if statutory notice issued

For EXTENSION strategy:
- Request 60-day extension to gather and organize documentation
- State specific reason — document gathering, professional review, or complexity of issues
- Confirm intent to respond fully and in good faith
- Request written acknowledgment of extension
- Reference standard IRS extension practice under Rev. Proc. 2005-18
- Note taxpayer's cooperative intent throughout

For OTHER / CUSTOM strategy:
- The additionalContext field is the primary directive — build the entire letter around it
- Read it carefully and identify: what is the taxpayer's actual situation? What are they claiming? What is the specific relief they need?
- Match IRC citations to the specific facts described
- Always invoke Taxpayer Bill of Rights
- Always request specific, named relief
- The letter must feel written for this exact person and this exact situation — not a template with names swapped in
- If the context describes unreported income that was reported elsewhere, missing basis, reimbursements, personal transfers, or business expenses: address each point with surgical precision

HIGH-RISK AND CRITICAL NOTICES:
For riskLevel critical or notices CP90, LT11, CP3219A: generate the strongest possible letter. Assert Collection Due Process rights under IRC § 6320 and § 6330 where applicable. Do not discourage the taxpayer from mailing a timely response. After the enclosures list, add:

"Note: Given the urgency and stakes of this matter, you may wish to have a licensed tax professional or enrolled agent review this letter before mailing. This draft provides them a complete, legally structured starting point."

OUTPUT: Return ONLY the complete letter text. No JSON wrapper. No markdown. Pure text formatted for printing and mailing. Use proper letter spacing and line breaks.`;

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
