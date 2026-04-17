import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  try {
    const { userId, actionType, documentId } = JSON.parse(event.body);
    
    // Get user's current subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Check if user has remaining usage
    if (subscription) {
      const { data: usage } = await supabase
        .from('usage_tracking')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', subscription.current_period_start)
        .lte('created_at', subscription.current_period_end);
      
      const usageCount = usage?.length || 0;
      const planLimits = getPlanLimits(subscription.plan_type);
      
      // Check if user has exceeded their limit
      if (planLimits.lettersPerMonth !== -1 && usageCount >= planLimits.lettersPerMonth) {
        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ 
            error: 'Usage limit exceeded',
            message: 'You have reached your monthly limit. Please upgrade your plan.',
            usage: {
              current: usageCount,
              limit: planLimits.lettersPerMonth
            }
          })
        };
      }
    } else {
      // No active subscription - check if they have a free trial
      const { data: freeUsage } = await supabase
        .from('usage_tracking')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)); // Last 7 days
      
      if (freeUsage && freeUsage.length >= 1) {
        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ 
            error: 'Free trial limit exceeded',
            message: 'You have used your free trial. Please subscribe to continue.',
            usage: {
              current: freeUsage.length,
              limit: 1
            }
          })
        };
      }
    }

    // Track the usage
    const { error: trackError } = await supabase
      .from('usage_tracking')
      .insert({
        user_id: userId,
        subscription_id: subscription?.id,
        action_type: actionType,
        document_id: documentId
      });

    if (trackError) {
      throw trackError;
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: true,
        message: 'Usage tracked successfully'
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
        error: 'Failed to track usage',
        details: error.message 
      })
    };
  }
}

function getPlanLimits(planType) {
  const limits = {
    'FREE': { lettersPerMonth: 0 },
    'STANDARD': { lettersPerMonth: 1 },
    'COMPLEX': { lettersPerMonth: 1 },
    'STARTER': { lettersPerMonth: 1 },
    'PRO': { lettersPerMonth: 3 },
    'PROPLUS': { lettersPerMonth: -1 } // unlimited
  };
  
  return limits[planType] || limits['FREE'];
}
