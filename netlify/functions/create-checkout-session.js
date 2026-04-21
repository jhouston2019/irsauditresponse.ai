const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function resHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: resHeaders(), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: resHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { priceId } = JSON.parse(event.body || "{}");
    if (!priceId || typeof priceId !== "string") {
      return {
        statusCode: 400,
        headers: resHeaders(),
        body: JSON.stringify({ error: "priceId required" }),
      };
    }

    const site = (process.env.SITE_URL || "").replace(/\/$/, "");
    if (!site) {
      return {
        statusCode: 500,
        headers: resHeaders(),
        body: JSON.stringify({ error: "SITE_URL is not set" }),
      };
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${site}/register?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/pricing`,
    });

    return {
      statusCode: 200,
      headers: resHeaders(),
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: resHeaders(),
      body: JSON.stringify({ error: error.message || "Checkout failed" }),
    };
  }
};
