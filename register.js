/**
 * Post-checkout registration (loaded by register.html).
 */
import { getSupabase } from '/src/components/Auth.js';

function supabaseConfiguredInPage() {
  const url = document.querySelector('meta[name="supabase-url"]')?.content?.trim?.() ?? '';
  const key = document.querySelector('meta[name="supabase-anon-key"]')?.content?.trim?.() ?? '';
  return !!(url && key && !url.includes('%%') && !key.includes('%%'));
}

async function loadCreateClient() {
  return (await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')).createClient;
}

async function getSupabaseEphemeralSignup() {
  const url = document.querySelector('meta[name="supabase-url"]')?.content?.trim?.() ?? '';
  const key = document.querySelector('meta[name="supabase-anon-key"]')?.content?.trim?.() ?? '';
  if (!url || !key || url.includes('%%') || key.includes('%%')) {
    throw new Error(
      'Auth is not wired on this build (missing SUPABASE_URL / SUPABASE_ANON_KEY in Netlify env, or placeholders not substituted). Fix env vars and redeploy.',
    );
  }
  const createClient = await loadCreateClient();
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

function goPricing() {
  window.location.replace('/pricing');
}

function showRecoveryActions(visible) {
  const el = document.getElementById('recoveryActions');
  if (el) el.style.display = visible ? 'block' : 'none';
}

function showReconnectBanner(text) {
  const el = document.getElementById('reconnectBanner');
  if (!el) return;
  el.textContent = text;
  el.style.display = 'block';
}

const params = new URLSearchParams(window.location.search);
const sessionId = params.get('session_id');
console.log('[register] session_id present:', Boolean(sessionId && sessionId.trim()));

const verifyPanel = document.getElementById('verifyPanel');
const verifyMsg = document.getElementById('verifyMsg');
const formPanel = document.getElementById('formPanel');
const formErr = document.getElementById('formErr');

if (!sessionId) {
  console.log('[register] no session_id — redirecting to /pricing');
  goPricing();
} else {
  (async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let ok = false;
    let stripeCustomerEmail = '';
    for (let attempt = 1; attempt <= 3; attempt++) {
      verifyMsg.textContent = 'Confirming your payment…';
      try {
        const res = await fetch('/.netlify/functions/verify-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        });
        if (res.ok) {
          try {
            const j = await res.json();
            stripeCustomerEmail = typeof j.customer_email === 'string' ? j.customer_email.trim() : '';
          } catch {
            stripeCustomerEmail = '';
          }
          ok = true;
          break;
        }
      } catch {
        /* retry */
      }
      if (attempt < 3) await sleep(1500);
    }
    if (!ok) {
      goPricing();
      return;
    }
    verifyPanel.style.display = 'none';
    formPanel.style.display = 'block';
    formErr.textContent = '';
    if (stripeCustomerEmail) {
      const emailEl = document.getElementById('email');
      if (emailEl && !emailEl.value.trim()) emailEl.value = stripeCustomerEmail;
    }
    if (params.get('purchase_reconnect') === '1' || params.get('reconnect') === '1') {
      showReconnectBanner('Your account was created. We are reconnecting your purchase.');
    }
    if (!supabaseConfiguredInPage()) {
      formErr.innerHTML =
        'This deployed page doesn’t include Supabase keys (missing or still <code>%%</code> placeholders). In Netlify: set <strong>SUPABASE_URL</strong> and <strong>SUPABASE_ANON_KEY</strong>, redeploy so account creation works.';
      formErr.style.textAlign = 'left';
      formErr.style.color = '#b45309';
    }
      })();
}

document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn?.disabled) return;

  showRecoveryActions(false);
  formErr.textContent = '';
  formErr.style.color = '';
  formErr.style.textAlign = '';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const password2 = document.getElementById('password2').value;
  if (password !== password2) {
    formErr.textContent = 'Passwords do not match.';
    return;
  }

  const sid =
    (typeof sessionId === 'string' && sessionId.trim()
      ? sessionId.trim()
      : new URLSearchParams(window.location.search).get('session_id')) || '';
  if (!sid) {
    formErr.textContent = 'Missing checkout session. Start again from pricing.';
    return;
  }

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating account…';
    }

    console.log('[register] signUp via ephemeral client (avoids auth lock hang)');
    const supabaseEphem = await getSupabaseEphemeralSignup();
    const { data, error } = await withTimeout(
      supabaseEphem.auth.signUp({ email, password }),
      45000,
      'Sign-up request timed out. Check your network, disable extensions that block requests, and try again.',
    );

    if (error) {
      const msg = error.message || '';
      const lc = msg.toLowerCase();
      const code = error.code ?? '';
      if (
        lc.includes('seconds') ||
        lc.includes('rate') ||
        lc.includes('too many requests') ||
        code === 'over_request_rate_limit' ||
        String(error.status) === '429'
      ) {
        formErr.textContent =
          'Supabase briefly limited signup attempts. Wait about one minute, then tap Create account once (avoid double-clicks).';
      } else {
        formErr.textContent = msg;
      }
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      formErr.textContent = 'Could not create user. Try again or log in if you already have an account.';
      return;
    }
    console.log('[register] signup success, user id:', userId);

    const supabase = getSupabase();
    if (!data.session) {
      const { error: signInErr } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        45000,
        'Sign-in after sign-up timed out. Try logging in manually.',
      );
      if (signInErr) {
        console.log('[register] signIn after signup failed:', signInErr.message);
        window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname + window.location.search);
        return;
      }
    }

    const {
      data: { session: sessAfter },
    } = await supabase.auth.getSession();
    const accessToken = sessAfter?.access_token;
    if (!accessToken) {
      formErr.textContent = 'Signed up but could not read session token. Try Log in.';
      window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname + window.location.search);
      return;
    }
    console.log('[register] access token present:', true);

    const rec = await fetch('/.netlify/functions/record-purchase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ session_id: sid, user_id: userId }),
    });

    console.log('[register] record-purchase status:', rec.status);

    let recBody = {};
    try {
      recBody = await rec.json();
    } catch {
      recBody = {};
    }

    if (rec.ok) {
      const dest = typeof recBody.redirect === 'string' && recBody.redirect.startsWith('/')
        ? recBody.redirect
        : '/audit-defense.html';
      console.log('[register] redirect destination:', dest);
      window.location.href = dest;
      return;
    }

    if (rec.status === 401 || rec.status === 403) {
      sessionStorage.setItem('pending_purchase_session_id', sid);
      sessionStorage.setItem(
        'pending_purchase_message',
        'Your account was created. We are reconnecting your purchase.',
      );
      window.location.href =
        '/login?next=' + encodeURIComponent('/dashboard.html?purchase_reconnect=1');
      return;
    }

    if (rec.status === 409) {
      formErr.style.color = '#b91c1c';
      formErr.textContent =
        recBody.error ||
        'We could not link this checkout to your account (policy conflict).';
      showRecoveryActions(true);
      return;
    }

    /** Account exists; reconnect purchase later */
    sessionStorage.setItem('pending_purchase_session_id', sid);
    sessionStorage.setItem(
      'pending_purchase_message',
      'Your account was created. We are reconnecting your purchase.',
    );
    console.log('[register] record-purchase failed; saved pending_purchase_session_id');
    window.location.href = '/dashboard.html?purchase_reconnect=1';
  } catch (err) {
    formErr.textContent = err.message || 'Something went wrong.';
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create account';
    }
  }
});
