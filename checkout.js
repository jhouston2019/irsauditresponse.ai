/**
 * Handles Stripe checkout process for different subscription plans
 * @param {string} plan - The plan name (STANDARD, COMPLEX, STARTER, PRO, PROPLUS)
 */
async function startCheckout(plan, email) {
  try {
    // Validate plan parameter
    if (!plan) {
      throw new Error('Plan parameter is required');
    }
    const userEmail = (email || '').trim();
    if (!userEmail || !userEmail.includes('@')) {
      throw new Error('A valid email is required for checkout');
    }

    // Make POST request to Netlify function
    const response = await fetch('/.netlify/functions/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ plan, userEmail })
    });

    // Check if request was successful
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    // Parse the response
    const data = await response.json();
    
    // Check if we received a checkout URL
    if (!data.url) {
      throw new Error('No checkout URL received from server');
    }

    // Redirect to Stripe checkout session
    window.location.href = data.url;
    
  } catch (error) {
    // Handle errors gracefully with alert
    console.error('Checkout error:', error);
    alert(`Checkout failed: ${error.message}`);
  }
}

// Export the function for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { startCheckout };
}
