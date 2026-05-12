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

const ANALYSIS_SYSTEM_PROMPT = `You are an expert IRS correspondence analyst with 20 years of experience
in tax controversy, audit defense, and IRS notice resolution.

Analyze the provided IRS notice and return a JSON object with this exact structure:

{
  "noticeType": "string — e.g. CP2000",
  "noticeNumber": "string — reference number if present",
  "taxYear": "string — e.g. 2022",
  "taxYearFull": "string — e.g. December 31, 2022",
  "deadline": "string — exact date or 'Not specified'",
  "daysUntilDeadline": number or null,
  "irsProposedAmount": "string — dollar amount with $ sign or 'Not specified'",
  "riskLevel": "low" | "moderate" | "high" | "critical",
  "riskRationale": "string — one sentence explaining risk level",
  "irsPosition": "string — precise description of what the IRS claims",
  "discrepancies": [
    {
      "source": "payer name",
      "type": "1099-B | 1099-NEC | 1099-MISC | W-2 | Other",
      "irsAmount": "dollar amount",
      "reportedAmount": "dollar amount or 'Not reported'",
      "difference": "dollar amount"
    }
  ],
  "plainEnglish": "string — 3-4 sentence plain English explanation a non-expert can understand",
  "whatHappensIfIgnored": "string — specific legal consequence with timeline",
  "keyIssuesToAddress": ["array of specific items that must be responded to"],
  "availableStrategies": [
    {
      "id": "agree",
      "title": "Full Agreement",
      "subtitle": "Accept IRS position",
      "description": "string — when to choose this and what it means",
      "recommended": boolean,
      "risk": "low | moderate | high",
      "outcome": "string — what happens after this response"
    },
    {
      "id": "partial",
      "title": "Partial Agreement",
      "subtitle": "Agree in part, dispute in part",
      "description": "...",
      "recommended": boolean,
      "risk": "...",
      "outcome": "..."
    },
    {
      "id": "dispute",
      "title": "Full Dispute",
      "subtitle": "Contest IRS position",
      "description": "...",
      "recommended": boolean,
      "risk": "...",
      "outcome": "..."
    },
    {
      "id": "extension",
      "title": "Request Extension",
      "subtitle": "Buy more time",
      "description": "...",
      "recommended": boolean,
      "risk": "...",
      "outcome": "..."
    }
  ],
  "recommendedStrategy": "agree | partial | dispute | extension",
  "recommendedStrategyRationale": "string — why this strategy is recommended",
  "irsContactInfo": {
    "phone": "IRS phone number from the notice or null",
    "address": "Complete IRS mailing address from the notice header or return address block — include street, city, state, ZIP. This is where the taxpayer mails their response. Extract exactly as it appears. null if not found.",
    "faxNumber": "IRS fax number if present or null"
  },
  "relevantIRSCodes": ["array of relevant IRC sections e.g. IRC § 6662"],
  "documentationNeeded": ["array of specific documents taxpayer should gather"],
  "urgency": "routine | elevated | urgent | critical"
}

When riskLevel is "critical" (e.g. CP90, LT11, CP3219A, levy or deficiency
warnings), riskRationale must be one sentence in this spirit: "High-stakes
enforcement action. Download your response letter and consider professional
review before mailing." Never tell the user not to use this tool, not to rely
on a drafted response, or to seek professional help instead of responding.

Be precise. Extract actual numbers. Do not invent information not in the notice.
If a field cannot be determined from the notice, use null.
Return ONLY the JSON object. No preamble, no markdown.`;

function stripJsonFences(s) {
  let t = s.trim();
  if (t.includes("```")) {
    t = t.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
  }
  return t;
}

function fallbackAnalysis(reason) {
  return {
    noticeType: "Unknown",
    noticeNumber: null,
    taxYear: null,
    taxYearFull: null,
    deadline: "Not specified",
    daysUntilDeadline: null,
    irsProposedAmount: "Not specified",
    riskLevel: "high",
    riskRationale: reason || "Automated analysis could not be completed; manual review is needed.",
    irsPosition: "Unable to determine from the notice text provided.",
    discrepancies: [],
    plainEnglish:
      "We could not fully parse this notice automatically. Review the original IRS document carefully and consider professional assistance.",
    whatHappensIfIgnored:
      "Ignoring IRS correspondence typically leads to assessment of proposed tax, penalties, and interest, and may reduce appeal rights after statutory notices.",
    keyIssuesToAddress: ["Review the full notice and identify each item the IRS requests or proposes."],
    availableStrategies: [
      {
        id: "agree",
        title: "Full Agreement",
        subtitle: "Accept IRS position",
        description: "Choose if the IRS is correct on all proposed changes.",
        recommended: false,
        risk: "low",
        outcome: "IRS will process agreement and issue a bill or confirmation.",
      },
      {
        id: "partial",
        title: "Partial Agreement",
        subtitle: "Agree in part, dispute in part",
        description: "Use when some proposed items are correct and others are not.",
        recommended: true,
        risk: "moderate",
        outcome: "IRS may adjust the proposed assessment after reviewing your explanation.",
      },
      {
        id: "dispute",
        title: "Full Dispute",
        subtitle: "Contest IRS position",
        description: "Use when you believe the notice is wrong on the facts or law.",
        recommended: false,
        risk: "high",
        outcome: "May lead to further examination, appeals, or deficiency procedures.",
      },
      {
        id: "extension",
        title: "Request Extension",
        subtitle: "Buy more time",
        description: "Request additional time to gather records before responding.",
        recommended: false,
        risk: "low",
        outcome: "If granted, extends the response window; not guaranteed.",
      },
    ],
    recommendedStrategy: "partial",
    recommendedStrategyRationale: "Until the notice is fully understood, a measured partial response path is often appropriate; confirm with a professional if exposure is large.",
    irsContactInfo: { phone: null, address: null, faxNumber: null },
    relevantIRSCodes: [],
    documentationNeeded: ["Copy of the IRS notice", "Tax return for the year at issue", "Supporting statements for income and deductions cited"],
    urgency: "elevated",
  };
}

async function resolveCanonicalJobId(admin, event, wizardPreview, userId, jobIdTrim) {
  const sid = stripeSessionFromEvent(event);
  const log = (step, extra = {}) =>
    console.log(
      JSON.stringify({
        fn: "analyze-notice",
        phase: "job_resolution",
        step,
        userId: userId || null,
        jobIdCandidate: jobIdTrim || null,
        hasStripeHeader: Boolean(sid),
        ...extra,
      }),
    );

  if (!wizardPreview) {
    if (!jobIdTrim || !UUID_RE.test(jobIdTrim)) {
      log("reject_missing_job_id");
      return { errorResponse: json(400, event, { error: "job_id is required", code: "missing_job_id" }) };
    }
    const { data: job, error: selErr } = await admin
      .from("audit_jobs")
      .select("id,user_id")
      .eq("id", jobIdTrim)
      .maybeSingle();
    if (selErr) {
      log("db_error", { message: selErr.message });
      return { errorResponse: json(500, event, { error: "Database error", code: "job_lookup_failed" }) };
    }
    if (!job) {
      log("reject_unknown_job");
      return { errorResponse: json(400, event, { error: "Invalid job_id", code: "invalid_job" }) };
    }
    if (job.user_id !== userId) {
      log("reject_user_mismatch");
      return { errorResponse: json(403, event, { error: "Forbidden", code: "job_forbidden" }) };
    }
    log("resolved", { resolvedJobId: jobIdTrim });
    return { jobId: jobIdTrim };
  }

  if (process.env.DISABLE_WIZARD_PREVIEW === "true") {
    return { errorResponse: json(403, event, { error: "Wizard preview is disabled.", code: "preview_disabled" }) };
  }

  if (sid) {
    const { data: byStripe } = await admin
      .from("audit_jobs")
      .select("id,user_id,stripe_session_id")
      .eq("stripe_session_id", sid)
      .maybeSingle();
    if (byStripe?.id) {
      if (jobIdTrim && UUID_RE.test(jobIdTrim) && byStripe.id !== jobIdTrim) {
        log("reject_stripe_job_mismatch");
        return {
          errorResponse: json(400, event, {
            error: "job_id does not match this checkout session",
            code: "job_stripe_mismatch",
          }),
        };
      }
      if (userId && byStripe.user_id && byStripe.user_id !== userId) {
        return { errorResponse: json(403, event, { error: "Forbidden", code: "job_forbidden" }) };
      }
      log("resolved_by_stripe", { resolvedJobId: byStripe.id });
      return { jobId: byStripe.id };
    }
  }

  if (jobIdTrim && UUID_RE.test(jobIdTrim)) {
    const { data: job, error: selErr } = await admin
      .from("audit_jobs")
      .select("id,user_id,stripe_session_id")
      .eq("id", jobIdTrim)
      .maybeSingle();
    if (selErr) {
      log("db_error", { message: selErr.message });
      return { errorResponse: json(500, event, { error: "Database error", code: "job_lookup_failed" }) };
    }
    if (!job) {
      log("reject_unknown_job");
      return { errorResponse: json(400, event, { error: "Invalid job_id", code: "invalid_job" }) };
    }
    if (sid && job.stripe_session_id && job.stripe_session_id !== sid) {
      log("reject_stripe_mismatch");
      return { errorResponse: json(403, event, { error: "Stripe session does not match this job", code: "stripe_mismatch" }) };
    }
    if (userId && job.user_id && job.user_id !== userId) {
      return { errorResponse: json(403, event, { error: "Forbidden", code: "job_forbidden" }) };
    }
    log("resolved", { resolvedJobId: jobIdTrim });
    return { jobId: jobIdTrim };
  }

  const insert = {
    user_id: userId || null,
  };
  if (sid) insert.stripe_session_id = sid;

  const { data: created, error: insErr } = await admin.from("audit_jobs").insert(insert).select("id").single();
  if (insErr || !created?.id) {
    log("create_failed", { message: insErr?.message });
    return {
      errorResponse: json(500, event, {
        error: insErr?.message || "Could not create audit job",
        code: "job_create_failed",
      }),
    };
  }
  log("job_created", { resolvedJobId: created.id });
  return { jobId: created.id };
}

async function persistAnalysisToJob(admin, json, event, wizardPreview, jobId, analysis) {
  let preview_src =
    typeof analysis?.plainEnglish === "string" && analysis.plainEnglish.trim()
      ? analysis.plainEnglish.trim()
      : typeof analysis?.noticeType === "string"
        ? `Notice (${analysis.noticeType}): summarized preview saved; open the wizard for full drafting tools.`
        : "Notice analysis preview saved. Continue in the wizard for details.";
  const preview_text = sanitizeString(preview_src, 8000);

  let letter_full;
  try {
    letter_full = JSON.stringify(analysis);
  } catch {
    letter_full = JSON.stringify(fallbackAnalysis("Could not serialize analysis."));
  }
  if (letter_full.length > 4_800_000) letter_full = letter_full.slice(0, 4_800_000);

  const updatedAt = new Date().toISOString();
  console.log(JSON.stringify({ fn: "analyze-notice", phase: "persist_attempt", jobId, wizardPreview }));

  const { data, error } = await admin
    .from("audit_jobs")
    .update({
      letter_full,
      preview_text,
      updated_at: updatedAt,
    })
    .eq("id", jobId)
    .select("id");

  if (error) {
    console.error(JSON.stringify({ fn: "analyze-notice", phase: "persist_error", jobId, message: error.message }));
    return json(503, event, {
      error: "Could not save analysis.",
      code: "PERSIST_FAILED",
      details: error.message,
    });
  }
  if (!data || data.length === 0) {
    console.error(JSON.stringify({ fn: "analyze-notice", phase: "persist_zero_rows", jobId }));
    return json(503, event, {
      error: "Analysis save matched no rows.",
      code: "PERSIST_ZERO_ROWS",
    });
  }

  console.log(JSON.stringify({ fn: "analyze-notice", phase: "persist_ok", jobId, rowsUpdated: data.length }));

  return json(200, event, {
    recordId: jobId,
    preview_text,
    analysis,
    wizard_preview_only: wizardPreview,
  });
}

async function extractTextFromFile(fileBase64, fileType) {
  if (!fileBase64) return "";
  const buffer = Buffer.from(fileBase64, "base64");
  const ft = (fileType || "").toLowerCase();

  if (ft.includes("text") || ft.includes("plain")) {
    return buffer.toString("utf8");
  }

  return "";
}

/**
 * PDF: pdf-parse via dynamic import (lib entry; no load-time require).
 */
async function extractPdfNoticeText(fileBase64) {
  try {
    const pdfBuffer = Buffer.from(fileBase64, "base64");

    const pdfParse = await import("pdf-parse/lib/pdf-parse.js");
    const fn = pdfParse.default || pdfParse;
    const pdfData = await fn(pdfBuffer, { max: 0 });
    const text = (pdfData.text || "").trim();

    console.log(
      JSON.stringify({
        fn: "analyze-notice",
        extraction: "pdf-parse",
        charCount: text.length,
      })
    );
    return text;
  } catch (err) {
    console.log(
      JSON.stringify({
        fn: "analyze-notice",
        pdfParseError: err.message,
      })
    );
    return "";
  }
}

async function extractTextWithVision(openai, mimeType, base64) {
  const dataUrl = `data:${mimeType};base64,${base64}`;
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You extract every line of text visible in this IRS or tax document image. Output plain text only, preserving reading order. No commentary.",
      },
      {
        role: "user",
        content: [{ type: "text", text: "Extract all text from this notice." }, { type: "image_url", image_url: { url: dataUrl } }],
      },
    ],
    max_tokens: 4096,
  });
  const t = completion.choices?.[0]?.message?.content || "";
  if (completion.usage) console.log(JSON.stringify({ fn: "analyze-notice-vision", usage: completion.usage }));
  return t.trim();
}

async function runAnalysisModel(openai, userContent, isRetry) {
  const messages = [
    { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
    {
      role: "user",
      content:
        userContent +
        (isRetry
          ? "\n\nYour previous reply was not valid JSON. Respond with ONLY a single raw JSON object matching the schema. No markdown, no prose."
          : ""),
    },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    temperature: 0.2,
    response_format: { type: "json_object" },
    max_tokens: 8192,
  });

  const usage = completion.usage || null;
  if (usage) console.log(JSON.stringify({ fn: "analyze-notice", usage }));

  let raw = completion.choices?.[0]?.message?.content || "{}";
  raw = stripJsonFences(raw);
  return { parsed: JSON.parse(raw), usage };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(event), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return json(405, event, { error: "Method not allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return json(503, event, { error: "Analysis service is not configured." });
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
  }

  const {
    text: rawText,
    fileBase64: rawB64,
    fileType,
    noticeType,
    taxYear,
    context,
    job_id,
  } = body;

  const jobIdTrim = typeof job_id === "string" ? job_id.trim() : "";
  console.log(
    JSON.stringify({
      fn: "analyze-notice",
      phase: "request_accepted",
      wizardPreview,
      hasJobId: Boolean(jobIdTrim && UUID_RE.test(jobIdTrim)),
    }),
  );
  const admin = getSupabaseAdmin();
  const userId = authUser?.id || null;

  const textHead = sanitizeString(rawText || "");
  let fileBase64 = typeof rawB64 === "string" ? rawB64.replace(/^data:[^;]+;base64,/, "") : "";
  if (fileBase64.length > 14 * 1024 * 1024) {
    return json(413, event, { error: "File too large. Upload a smaller file or paste text." });
  }
  const hasAnyInput = textHead.trim().length > 0 || fileBase64.length > 0;
  if (!hasAnyInput) {
    return json(400, event, { error: "Paste your notice or upload a file before analyzing." });
  }

  const jobResolve = await resolveCanonicalJobId(admin, event, wizardPreview, userId, jobIdTrim);
  if (jobResolve.errorResponse) return jobResolve.errorResponse;
  const resolvedJobId = jobResolve.jobId;
  console.log(
    JSON.stringify({
      fn: "analyze-notice",
      phase: "canonical_job_resolved",
      resolvedJobId,
      requestJobIdTrim: jobIdTrim || null,
      dbRowId: resolvedJobId,
    }),
  );

  if (!wizardPreview) {
    const payDenied = await enforcePaidAuditJob(admin, json, event, userId, resolvedJobId);
    if (payDenied) return payDenied;
  }

  const text = textHead;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let noticeText = text;
  const ft = sanitizeString(fileType || "", 200);

  if (fileBase64) {
    if (ft.includes("image")) {
      try {
        const visionText = await extractTextWithVision(openai, ft || "image/jpeg", fileBase64);
        noticeText = [noticeText, visionText].filter(Boolean).join("\n\n");
      } catch (e) {
        console.error("analyze-notice vision error:", e);
        const analysisFb = fallbackAnalysis("Image text extraction failed.");
        return persistAnalysisToJob(admin, json, event, wizardPreview, resolvedJobId, analysisFb);
      }
    } else if (ft.includes("pdf")) {
      const extracted = await extractPdfNoticeText(fileBase64);
      noticeText = [noticeText, extracted].filter(Boolean).join("\n\n");
      if (!extracted.trim()) {
        const analysisFb = fallbackAnalysis(
          "Could not extract text from this PDF. Paste the notice text or try a clearer scan."
        );
        return persistAnalysisToJob(admin, json, event, wizardPreview, resolvedJobId, analysisFb);
      }
    } else {
      const extracted = await extractTextFromFile(fileBase64, ft);
      noticeText = [noticeText, extracted].filter(Boolean).join("\n\n");
    }
  }

  noticeText = sanitizeString(noticeText, 150000).trim();
  if (!noticeText) {
    return json(400, event, { error: "No notice text available. Paste text or upload a file." });
  }

  const overrideLines = [];
  if (noticeType) overrideLines.push(`User-selected notice type override: ${sanitizeString(noticeType, 80)}`);
  if (taxYear) overrideLines.push(`User-selected tax year override: ${sanitizeString(taxYear, 40)}`);
  if (context) overrideLines.push(`Taxpayer context (employment/business profile): ${sanitizeString(context, 200)}`);
  const userBlob = `IRS NOTICE TEXT:\n${noticeText}\n\n${overrideLines.join("\n")}`;

  let analysis;
  let confidence = "high";
  let lastUsage = null;

  try {
    try {
      const out = await runAnalysisModel(openai, userBlob, false);
      analysis = out.parsed;
      lastUsage = out.usage;
    } catch (parseErr) {
      console.error("analyze-notice first parse failed:", parseErr.message);
      try {
        const out = await runAnalysisModel(openai, userBlob, true);
        analysis = out.parsed;
        lastUsage = out.usage;
        confidence = "medium";
      } catch (second) {
        console.error("analyze-notice retry failed:", second.message);
        analysis = fallbackAnalysis("The model returned data that could not be parsed as JSON.");
        confidence = "low";
      }
    }

    if (!analysis || typeof analysis !== "object") {
      analysis = fallbackAnalysis("Invalid analysis structure.");
      confidence = "low";
    }

    if (analysis && typeof analysis === "object") {
      const rl = typeof analysis.riskLevel === "string" ? analysis.riskLevel.toLowerCase() : "";
      if (rl === "critical") {
        analysis.riskRationale =
          "High-stakes enforcement action. Download your response letter and consider professional review before mailing.";
      }
    }
  } catch (e) {
    console.error("analyze-notice OpenAI error:", e);
    const analysisFb = fallbackAnalysis("The analysis service returned an error.");
    return persistAnalysisToJob(admin, json, event, wizardPreview, resolvedJobId, analysisFb);
  }

  if (lastUsage) {
    console.log(JSON.stringify({ fn: "analyze-notice", confidence, usage: lastUsage }));
  }

  return persistAnalysisToJob(admin, json, event, wizardPreview, resolvedJobId, analysis);
};
