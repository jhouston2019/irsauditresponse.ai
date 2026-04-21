/**
 * Start Stripe Checkout for a given Stripe Price ID.
 * @param {string} priceId - Stripe price_… ID
 */
async function startCheckout(priceId) {
  try {
    const id = (priceId || '').trim();
    if (!id) {
      throw new Error('priceId is required');
    }

    const response = await fetch('/.netlify/functions/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ priceId: id }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.url) {
      throw new Error('No checkout URL received from server');
    }

    window.location.href = data.url;
  } catch (error) {
    console.error('Checkout error:', error);
    alert(`Checkout failed: ${error.message}`);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { startCheckout };
}
