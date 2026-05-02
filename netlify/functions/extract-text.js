const OpenAI = require("openai");
const { authorizeWizardRequest, corsHeaders, json } = require("./_wizardAuth.js");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        ...corsHeaders(event),
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  const auth = await authorizeWizardRequest(event);
  if (!auth.ok) return auth.response;
  if (!auth.user?.id) return json(403, event, { error: "Forbidden" });

  if (event.httpMethod !== "POST") {
    return json(405, event, { error: "Method not allowed" });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { imageData, mimeType } = JSON.parse(event.body || "{}");

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all text from this image. Return only the text content, preserving the original formatting and structure. Do not add any commentary or analysis.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageData}`,
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
    });

    const extractedText = response.choices?.[0]?.message?.content || "";

    return json(200, event, { text: extractedText });
  } catch (error) {
    return json(500, event, { error: "Failed to extract text from image", details: error.message });
  }
};
