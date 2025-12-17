import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function handler(event) {
  try {
    // Debug: Check environment variables
    console.log('SITE_URL:', process.env.SITE_URL);
    console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? 'Set' : 'Missing');
    console.log('STRIPE_PRICE_RESPONSE:', process.env.STRIPE_PRICE_RESPONSE);
    
    const { recordId = null, customerEmail = null } = JSON.parse(event.body || "{}"); // send from client if available
    const priceId = process.env.STRIPE_PRICE_RESPONSE || process.env.STRIPE_PRICE_ID || "price_49USD_single";
    
    // Validate required environment variables
    if (!process.env.SITE_URL) {
      throw new Error('SITE_URL environment variable is not set');
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }
    if (!priceId || priceId === "price_49USD_single") {
      console.warn('Warning: Using default price ID. Consider setting STRIPE_PRICE_RESPONSE or STRIPE_PRICE_ID environment variable.');
    }

    let session;
    try {
      const sessionParams = {
        payment_method_types: ['card'],
        line_items: [{ 
          price: priceId, 
          quantity: 1 
        }],
        mode: 'payment',
        success_url: `${process.env.SITE_URL}/thank-you.html`,
        cancel_url: `${process.env.SITE_URL}/pricing.html`,
        metadata: recordId ? { recordId } : { plan: 'single' }
      };
      
      // Pre-fill customer email if provided, or use default business email
      if (customerEmail) {
        sessionParams.customer_email = customerEmail;
      } else if (process.env.DEFAULT_CHECKOUT_EMAIL) {
        // Use default business email if no user email provided
        sessionParams.customer_email = process.env.DEFAULT_CHECKOUT_EMAIL;
      }
      
      session = await stripe.checkout.sessions.create(sessionParams);
    } catch (stripeError) {
      // Provide more helpful error messages
      if (stripeError.type === 'StripeInvalidRequestError') {
        if (stripeError.message.includes('No such price')) {
          throw new Error(`Invalid Stripe price ID: ${priceId}. Please check your STRIPE_PRICE_RESPONSE or STRIPE_PRICE_ID environment variable.`);
        }
        throw new Error(`Stripe error: ${stripeError.message}`);
      }
      throw stripeError;
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ url: session.url })
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
}
