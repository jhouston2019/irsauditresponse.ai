// Main application entry point
import { getCurrentUser, getSession } from './components/Auth.js';

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
  // Check if user is logged in
  const user = await getCurrentUser();
  const session = await getSession();
  
  if (user && session) {
    // User is logged in, show dashboard link
    updateNavigationForLoggedInUser(user);
  } else {
    // User is not logged in, show login/signup
    updateNavigationForGuest();
  }
});

function updateNavigationForLoggedInUser(user) {
  const nav = document.querySelector('nav div:last-child');
  if (nav) {
    nav.innerHTML = `
      <a href="/payment.html">Upload</a> |
      <a href="/dashboard.html">Dashboard</a> |
      <a href="/pricing.html">Pricing</a> |
      <span>Welcome, ${user.email}</span> |
      <a href="#" id="logout">Logout</a>
    `;
    
    // Add logout functionality
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
      <a href="/payment.html">Upload</a> |
      <a href="/dashboard.html">Dashboard</a> |
      <a href="/pricing.html">Pricing</a> |
      <a href="/login.html">Login</a>
    `;
  }
}

// Global checkout function for pricing buttons
window.startCheckout = async function(plan) {
  try {
    // Check if user is logged in
    const user = await getCurrentUser();
    if (!user) {
      alert('Please login to purchase a plan');
      window.location.href = '/login.html';
      return;
    }

    // Show loading state
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = 'Processing...';
    button.disabled = true;

    // Get current user's email if logged in
    let userEmail = null;
    if (user && user.email) {
      userEmail = user.email;
    }
    
    const response = await fetch('/.netlify/functions/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        plan: plan,
        customerEmail: userEmail
      })
    });
    
    // Check if response is ok before parsing
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
      throw new Error(errorData.error || errorData.details || `Server error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.url) {
      window.location.href = data.url;
    } else {
      throw new Error(data.error || data.details || 'Failed to create checkout session');
    }
  } catch (error) {
    alert('Failed to start checkout: ' + error.message);
    const button = event.target;
    button.textContent = button.getAttribute('data-original-text') || 'Try Again';
    button.disabled = false;
  }
};
