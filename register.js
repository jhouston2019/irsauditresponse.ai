/**
 * register.js — Post-checkout account creation
 * Loaded by register.html as <script type="module" src="/register.js">
 */

const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

function getMeta(name) {
  return document.querySelector(`meta[name="${name}"]`)?.content?.trim() ?? '';
}

function getSupabaseUrl() { return getMeta('supabase-url'); }
function getSupabaseKey() { return getMeta('supabase-anon-key'); }

function placeholdersPresent() {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();
  return !url || !key || url.includes('%%') || key.includes('%%');
}

async function makeClient(persist = true) {
  const { createClient } = await import(CDN);
  return createClient(getSupabaseUrl(), getSupabaseKey(), {
    auth: {
      persistSession: persist,
      autoRefreshToken: persist,
      detectSessionInUrl: false,
    },
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function goPricing() { window.location.replace('/pricing'); }

// ── DOM refs ──────────────────────────────────────────────────────────────
const verifyPanel = document.getElementById('verifyPanel');
const verifyMsg   = document.getElementById('verifyMsg');
const formPanel   = document.getElementById('formPanel');
const formErr     = document.getElementById('formErr');

// ── 1. Read session_id from URL ───────────────────────────────────────────
const params    = new URLSearchParams(window.location.search);
const sessionId = params.get('session_id')?.trim() ?? '';
console.log('[register] session_id present:', Boolean(sessionId));

if (!sessionId) {
  console.log('[register] no session_id — go to pricing');
  goPricing();
} else {
  init();
}

async function init() {
  // ── 2. Verify payment (3 attempts) ──────────────────────────────────────
  let verified = false;
  let customerEmail = '';

  for (let i = 1; i <= 3; i++) {
    verifyMsg.textContent = 'Confirming your payment…';
    try {
      const res = await fetch('/.netlify/functions/verify-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (res.ok) {
        const j = await res.json().catch(() => ({}));
        customerEmail = typeof j.customer_email === 'string' ? j.customer_email.trim() : '';
        verified = true;
        break;
      }
      console.log('[register] verify-session attempt', i, 'status:', res.status);
    } catch (e) {
      console.log('[register] verify-session attempt', i, 'error:', e.message);
    }
    if (i < 3) await sleep(1500);
  }

  if (!verified) {
    console.log('[register] payment not verified — go to pricing');
    goPricing();
    return;
  }

  // ── 3. Show form ─────────────────────────────────────────────────────────
  verifyPanel.style.display = 'none';
  formPanel.style.display   = 'block';

  if (placeholdersPresent()) {
    formErr.textContent = 'Configuration error: Supabase env vars not set. Redeploy with SUPABASE_URL and SUPABASE_ANON_KEY.';
    return;
  }

  if (customerEmail) {
    const emailEl = document.getElementById('email');
    if (emailEl && !emailEl.value.trim()) emailEl.value = customerEmail;
  }

  // ── 4. Form submit ───────────────────────────────────────────────────────
  const form = document.getElementById('registerForm');
  let inFlight = false;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (inFlight) return;
    inFlight = true;

    const btn = form.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Creating account…'; }
    formErr.textContent = '';

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const password2 = document.getElementById('password2').value;

    if (password !== password2) {
      formErr.textContent = 'Passwords do not match.';
      reset(btn); inFlight = false; return;
    }
    if (password.length < 6) {
      formErr.textContent = 'Password must be at least 6 characters.';
      reset(btn); inFlight = false; return;
    }

    try {
      const client = await makeClient(true);

      // ── Step A: try sign up ──────────────────────────────────────────────
      let session = null;
      let userId  = null;

      const { data: signUpData, error: signUpError } = await client.auth.signUp({ email, password });

      const alreadyExists =
        signUpError && (
          signUpError.code === 'user_already_exists' ||
          String(signUpError.status) === '422' ||
          signUpError.message?.toLowerCase().includes('user already registered') ||
          signUpError.message?.toLowerCase().includes('already registered')
        );

      if (signUpError && !alreadyExists) {
        // Rate limit
        if (
          signUpError.message?.toLowerCase().includes('seconds') ||
          signUpError.code === 'over_request_rate_limit' ||
          String(signUpError.status) === '429'
        ) {
          formErr.textContent = 'Too many attempts. Wait a minute then try again.';
        } else {
          formErr.textContent = signUpError.message || 'Sign up failed.';
        }
        reset(btn); inFlight = false; return;
      }

      if (!signUpError && signUpData?.session) {
        // Fresh signup with immediate session (email confirm disabled)
        session = signUpData.session;
        userId  = signUpData.user?.id;
        console.log('[register] fresh signup, session obtained');
      } else {
        // Either alreadyExists OR signup succeeded but no session yet
        // → sign in with password
        console.log('[register] signing in with password');
        const { data: signInData, error: signInError } = await client.auth.signInWithPassword({ email, password });

        if (signInError) {
          formErr.textContent = signInError.message?.toLowerCase().includes('invalid')
            ? 'Incorrect password. Please try again.'
            : (signInError.message || 'Sign in failed.');
          reset(btn); inFlight = false; return;
        }

        session = signInData?.session;
        userId  = signInData?.user?.id;
        console.log('[register] sign in success');
      }

      if (!session?.access_token || !userId) {
        formErr.textContent = 'Could not obtain session. Try logging in.';
        reset(btn); inFlight = false; return;
      }

      console.log('[register] access token present: true');

      // ── Step B: record purchase ──────────────────────────────────────────
      const rec = await fetch('/.netlify/functions/record-purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ session_id: sessionId, user_id: userId }),
      });

      console.log('[register] record-purchase status:', rec.status);
      const recBody = await rec.json().catch(() => ({}));

      if (rec.ok || rec.status === 409) {
        // 409 = already recorded, treat as success
        const dest = typeof recBody.redirect === 'string' && recBody.redirect.startsWith('/')
          ? recBody.redirect
          : '/audit-defense.html';
        console.log('[register] redirecting to:', dest);
        window.location.href = dest;
        return;
      }

      // record-purchase failed but account exists — save for recovery
      sessionStorage.setItem('pending_purchase_session_id', sessionId);
      sessionStorage.setItem('pending_purchase_message', 'Your account was created. We are reconnecting your purchase.');
      console.log('[register] record-purchase failed, saving pending and going to dashboard');
      window.location.href = '/dashboard.html?purchase_reconnect=1';

    } catch (err) {
      console.error('[register] unexpected error:', err);
      formErr.textContent = err.message || 'Something went wrong. Please try again.';
    } finally {
      reset(btn);
      inFlight = false;
    }
  });
}

function reset(btn) {
  if (btn) { btn.disabled = false; btn.textContent = 'Create account'; }
}
