/**
 * Optional: trigger receipt email after checkout (extend with SendGrid if needed).
 */
const { corsHeaders } = require("./_wizardAuth.js");

function json(statusCode, event, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(event),
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(event), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return json(405, event, { error: "Method not allowed" });
  }

  return json(200, event, { ok: true, message: "Stripe sends receipts by default; no server action." });
};
