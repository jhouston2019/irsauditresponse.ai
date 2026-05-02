const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const { authorizeWizardRequest, json, sanitizeString, corsHeaders } = require("./_wizardAuth.js");
const { getSupabaseAdmin } = require("./_supabase.js");
const { enforcePaidAuditJob } = require("./_auditJobs.js");

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 72;
const FONT_SIZE = 12;
const LINE_HEIGHT = FONT_SIZE * 1.45;
const HEADER_BAND = 56;

function wrapLineToWidth(text, font, size, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function buildWrappedLines(fullText, font, size, maxWidth) {
  const rawLines = String(fullText).split(/\r?\n/);
  const out = [];
  for (const raw of rawLines) {
    if (!raw.trim()) {
      out.push("");
      continue;
    }
    out.push(...wrapLineToWidth(raw, font, size, maxWidth));
  }
  return out;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(event), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return json(405, event, { error: "Method not allowed" });
  }

  const auth = await authorizeWizardRequest(event);
  if (!auth.ok) return auth.response;
  if (!auth.user?.id) {
    return json(403, event, { error: "Forbidden" });
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
  const payDenied = await enforcePaidAuditJob(admin, json, event, auth.user.id, jobIdTrim);
  if (payDenied) return payDenied;

  const text = sanitizeString(body.text || "", 200000);
  const fileName = sanitizeString(body.fileName || "irs-response-letter.pdf", 120) || "irs-response-letter.pdf";

  if (!text) {
    return json(400, event, { error: "No text provided for PDF generation" });
  }

  try {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const maxWidth = PAGE_WIDTH - MARGIN * 2;
    const lines = buildWrappedLines(text, font, FONT_SIZE, maxWidth);

    const contentBottom = MARGIN + 28;
    const contentTopStart = PAGE_HEIGHT - MARGIN - HEADER_BAND;
    let lineIndex = 0;
    const pages = [];

    while (lineIndex < lines.length) {
      const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pages.push(page);

      page.drawLine({
        start: { x: MARGIN, y: PAGE_HEIGHT - MARGIN + 8 },
        end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - MARGIN + 8 },
        thickness: 0.75,
        color: rgb(0.2, 0.2, 0.2),
      });

      page.drawText("SENT VIA CERTIFIED MAIL", {
        x: MARGIN,
        y: PAGE_HEIGHT - MARGIN - 4,
        size: 9,
        font: fontBold,
        color: rgb(0.25, 0.25, 0.25),
      });

      let y = contentTopStart;
      while (lineIndex < lines.length && y > contentBottom + LINE_HEIGHT) {
        const line = lines[lineIndex];
        if (line) {
          page.drawText(line, {
            x: MARGIN,
            y,
            size: FONT_SIZE,
            font,
            color: rgb(0, 0, 0),
          });
        }
        y -= LINE_HEIGHT;
        lineIndex++;
      }
    }

    const totalPages = pages.length;
    for (let i = 0; i < totalPages; i++) {
      const page = pages[i];
      const footer = `Page ${i + 1} of ${totalPages}`;
      const w = font.widthOfTextAtSize(footer, 9);
      page.drawText(footer, {
        x: (PAGE_WIDTH - w) / 2,
        y: MARGIN - 18,
        size: 9,
        font,
        color: rgb(0.35, 0.35, 0.35),
      });
    }

    const pdfBytes = await pdfDoc.save();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
        ...corsHeaders(event),
      },
      body: Buffer.from(pdfBytes).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error("generate-pdf error:", error);
    return json(503, event, { error: "PDF generation failed. Please try again." });
  }
};
