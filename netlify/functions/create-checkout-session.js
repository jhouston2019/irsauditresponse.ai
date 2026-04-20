import { createRequire } from "module";
import Stripe from "stripe";

const require = createRequire(import.meta.url);
const { getSupabaseAdmin } = require("./_supabase.js");
const { insertPaymentAudit } = require("./_paymentReconcile.js");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const SITE = () => (process.env.SITE_URL || "").replace(/\/$/, "");

function logEvent(name, payload) {
  console.log(JSON.stringify({ [name]: true, ...payload }));
}

export async function handler(event) {
  try {
    const body = JSON.parse(event.body || "{}");
    const recordId = body.recordId ?? null;
    const userEmail = (body.userEmail || body.customerEmail || "").trim() || null;
    const supabaseUserId = (body.supabase_user_id || body.supabaseUserId || "").trim() || null;

    if (!process.env.SITE_URL) {
      throw new Error("SITE_URL environment variable is not set");
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }

    if (!userEmail || !userEmail.includes("@")) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "customer_email_required",
          details: "A valid email is required for checkout.",
        }),
      };
    }

    const priceId = process.env.STRIPE_PRICE_RESPONSE || process.env.STRIPE_PRICE_ID || null;

    const successUrl = `${SITE()}/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${SITE()}/pricing`;

    const baseMeta = recordId
      ? { recordId, flow: "tlh", user_email: userEmail }
      : {
          flow: "audit",
          plan_type: "single",
          product_type: "irs_audit_response",
          user_email: userEmail,
        };

    if (supabaseUserId) {
      baseMeta.supabase_user_id = supabaseUserId;
    }

    const sessionParams = {
      payment_method_types: ["card"],
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: userEmail,
      metadata: baseMeta,
    };

    if (supabaseUserId) {
      sessionParams.client_reference_id = supabaseUserId;
    }

    if (priceId) {
      sessionParams.line_items = [{ price: priceId, quantity: 1 }];
    } else {
      sessionParams.line_items = [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "IRS Audit Defense Pro",
              description:
                "One-time preparation guidance for IRS audits using a constrained, risk-aware system.",
              metadata: {
                product_type: "irs_audit_response",
                pricing_model: "one_time",
              },
            },
            unit_amount: 4900,
          },
          quantity: 1,
        },
      ];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    logEvent("PAYMENT_SESSION_CREATED", {
      sessionId: session.id,
      hasClientRef: !!supabaseUserId,
    });

    try {
      const supabase = getSupabaseAdmin();
      await insertPaymentAudit(supabase, {
        session_id: session.id,
        user_id: supabaseUserId || null,
        event_type: "SESSION_CREATED",
        metadata: { flow: recordId ? "tlh" : "audit", hasClientRef: !!supabaseUserId },
      });
    } catch (auditErr) {
      console.error("SESSION_CREATED audit log failed", auditErr.message);
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: JSON.stringify({ url: session.url, sessionId: session.id }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to create checkout session",
        details: error.message,
      }),
    };
  }
}
