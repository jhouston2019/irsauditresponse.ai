// AUDIT CORE — HIGH RISK — DO NOT MODIFY WITHOUT FULL TEST SUITE
// Stripe Checkout for IRS Audit Response ($19 one-time)
// Purpose: Create checkout session for audit response product

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    const { 
      userEmail,
      auditType = 'irs_audit_response',
      returnUrl = process.env.SITE_URL || 'https://auditresponse.ai'
    } = JSON.parse(event.body || '{}');

    if (!userEmail) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email is required' })
      };
    }

    // IRS Audit Response Product Configuration
    // $19.00 USD - One-time payment
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'IRS Audit Response Preparation',
              description: 'One-time preparation guidance for IRS audits using a constrained, risk-aware system designed to help limit scope and reduce over-disclosure during examinations.',
              metadata: {
                product_type: 'irs_audit_response',
                pricing_model: 'one_time',
                risk_level: 'high',
                ai_mode: 'constrained_procedural',
                audit_only: 'true',
                not_chat_based: 'true'
              }
            },
            unit_amount: 1900, // $19.00 in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: userEmail,
      success_url: `${returnUrl}/audit-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}/audit-cancel.html`,
      metadata: {
        product_type: 'irs_audit_response',
        audit_type: auditType,
        user_email: userEmail,
        pricing_model: 'one_time',
        price_amount: '19.00'
      }
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        sessionId: session.id,
        url: session.url
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Failed to create checkout session',
        details: error.message 
      })
    };
  }
};

