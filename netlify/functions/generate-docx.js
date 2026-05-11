// Hardening: JWT via authorizeWizardRequest + enforcePaidAuditJob before export; no public.users queries in this function.
const { Document, Packer, Paragraph, TextRun } = require("docx");
const { authorizeWizardRequest, json, sanitizeString, corsHeaders } = require("./_wizardAuth.js");
const { getSupabaseAdmin } = require("./_supabase.js");
const { enforcePaidAuditJob } = require("./_auditJobs.js");
const { authorizeExportViaStripeSession } = require("./_stripeSessionExportAuth.js");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(event), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return json(405, event, { error: "Method not allowed" });
  }

  const authHeader =
    event.headers.authorization || event.headers.Authorization || "";
  const hasBearer = /^Bearer\s+\S+/i.test(authHeader || "");

  const auth = await authorizeWizardRequest(event);
  let userId = null;
  if (auth.ok && auth.user?.id) {
    userId = auth.user.id;
  } else if (hasBearer) {
    return auth.response || json(401, event, { error: "Authentication required" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, event, { error: "Invalid JSON body" });
  }

  const jobIdTrim = typeof body.job_id === "string" ? body.job_id.trim() : "";
  if (!jobIdTrim) return json(400, event, { error: "job_id is required" });

  const admin = getSupabaseAdmin();

  if (userId) {
    const payDenied = await enforcePaidAuditJob(admin, json, event, userId, jobIdTrim);
    if (payDenied) return payDenied;
  } else {
    const stripeAuth = await authorizeExportViaStripeSession(event, jobIdTrim, json);
    if (!stripeAuth.ok) {
      return (
        stripeAuth.response ||
        json(401, event, { error: "Authentication required" })
      );
    }
  }

  const text = sanitizeString(body.text || "", 200000);
  const fileName = sanitizeString(body.fileName || "irs-response-letter.docx", 120) || "irs-response-letter.docx";

  if (!text) {
    return json(400, event, { error: "No text provided for DOCX generation" });
  }

  try {
    const paragraphs = text.split(/\r?\n/).map(
      (line) =>
        new Paragraph({
          children: [
            new TextRun({
              text: line.length ? line : " ",
              font: "Georgia",
              size: 24,
            }),
          ],
        })
    );

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
        ...corsHeaders(event),
      },
      body: Buffer.from(buffer).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error("generate-docx error:", error);
    return json(503, event, { error: "DOCX generation failed. Please try again." });
  }
};
