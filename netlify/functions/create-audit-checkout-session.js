// AUDIT CORE — HIGH RISK — DO NOT MODIFY WITHOUT FULL TEST SUITE
// Stripe Checkout for IRS Audit Defense Pro ($49 one-time)
// Purpose: Create checkout session for audit response product

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { corsHeaders } = require('./_wizardAuth.js');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders(event),
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
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
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(event),
        },
        body: JSON.stringify({ error: 'Email is required' })
      };
    }

    // IRS Audit Defense Pro Product Configuration
    // $49.00 USD - One-time payment
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'IRS Audit Defense Pro',
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
            unit_amount: 4900, // $49.00 in cents
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
        price_amount: '49.00'
      }
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(event),
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
        ...corsHeaders(event),
      },
      body: JSON.stringify({ 
        error: 'Failed to create checkout session',
        details: error.message 
      })
    };
  }
};

