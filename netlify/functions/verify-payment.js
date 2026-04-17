const { getSupabaseAdmin } = require('./_supabase.js');
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
    const { email } = JSON.parse(event.body || '{}');
    
    if (!email) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(event),
        },
        body: JSON.stringify({ error: 'Email is required' })
      };
    }

    const supabase = getSupabaseAdmin();
    
    // Check if user has any successful payments in either table
    const { data: tlhLetters, error: tlhError } = await supabase
      .from('tlh_letters')
      .select('id, stripe_payment_status')
      .eq('user_email', email)
      .eq('stripe_payment_status', 'paid')
      .limit(1);
    
    const { data: auditResponses, error: auditError } = await supabase
      .from('audit_responses')
      .select('id, stripe_payment_status')
      .eq('user_email', email)
      .eq('stripe_payment_status', 'paid')
      .limit(1);

    const hasPaid = (tlhLetters && tlhLetters.length > 0) || (auditResponses && auditResponses.length > 0);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(event),
      },
      body: JSON.stringify({ 
        hasPaid: hasPaid,
        email: email
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
        error: 'Failed to verify payment status',
        details: error.message 
      })
    };
  }
};
