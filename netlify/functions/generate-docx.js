const { Document, Packer, Paragraph, TextRun } = require("docx");
const { authorizeWizardRequest, json, sanitizeString, corsHeaders } = require("./_wizardAuth.js");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(event), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return json(405, event, { error: "Method not allowed" });
  }

  const auth = await authorizeWizardRequest(event);
  if (!auth.ok) return auth.response;

  let text;
  let fileName = "irs-response-letter.docx";
  try {
    const body = JSON.parse(event.body || "{}");
    text = sanitizeString(body.text || "", 200000);
    fileName = sanitizeString(body.fileName || fileName, 120) || "irs-response-letter.docx";
  } catch {
    return json(400, event, { error: "Invalid JSON body" });
  }

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
