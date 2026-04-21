// Main application entry point
import { getCurrentUser, getSession } from './components/Auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await getCurrentUser();
  const session = await getSession();

  if (user && session) {
    updateNavigationForLoggedInUser(user);
  } else {
    updateNavigationForGuest();
  }
});

function updateNavigationForLoggedInUser(user) {
  const nav = document.querySelector('nav div:last-child');
  if (nav) {
    nav.innerHTML = `
      <a href="/upload.html">Upload</a> |
      <a href="/dashboard">Dashboard</a> |
      <a href="/pricing">Pricing</a> |
      <span>Welcome, ${user.email}</span> |
      <a href="#" id="logout">Logout</a>
    `;

    document.getElementById('logout').addEventListener('click', async (e) => {
      e.preventDefault();
      const { signOut } = await import('./components/Auth.js');
      await signOut();
      window.location.href = '/';
    });
  }
}

function updateNavigationForGuest() {
  const nav = document.querySelector('nav div:last-child');
  if (nav) {
    nav.innerHTML = `
      <a href="/upload.html">Upload</a> |
      <a href="/dashboard">Dashboard</a> |
      <a href="/pricing">Pricing</a> |
      <a href="/login">Login</a>
    `;
  }
}

/**
 * @param {string} priceId - Stripe price ID (price_…)
 */
window.startCheckout = async function startCheckoutGlobal(priceId) {
  try {
    const btn = typeof event !== 'undefined' ? event.target : null;
    const originalText = btn?.textContent;
    if (btn) {
      btn.textContent = 'Processing...';
      btn.disabled = true;
    }

    const id = (priceId || '').trim();
    if (!id) {
      throw new Error('Missing Stripe price ID');
    }

    const response = await fetch('/.netlify/functions/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId: id }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      throw new Error(data.error || 'Failed to create checkout session');
    }
  } catch (error) {
    alert('Failed to start checkout: ' + error.message);
    const btn = typeof event !== 'undefined' ? event.target : null;
    if (btn) {
      btn.textContent = btn.getAttribute('data-original-text') || 'Try Again';
      btn.disabled = false;
    }
  }
};
