import { createClient } from '@supabase/supabase-js';

function getSupabaseUrl() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) {
    return import.meta.env.VITE_SUPABASE_URL;
  }
  if (typeof document !== 'undefined') {
    const m = document.querySelector('meta[name="supabase-url"]')?.content;
    if (m && !String(m).includes('%%')) return m;
  }
  return '';
}

function getSupabaseAnon() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) {
    return import.meta.env.VITE_SUPABASE_ANON_KEY;
  }
  if (typeof document !== 'undefined') {
    const m = document.querySelector('meta[name="supabase-anon-key"]')?.content;
    if (m && !String(m).includes('%%')) return m;
  }
  return '';
}

let _client;
export function getSupabase() {
  if (!_client) {
    const url = getSupabaseUrl();
    const key = getSupabaseAnon();
    if (!url || !key) throw new Error('Supabase is not configured');
    _client = createClient(url, key);
  }
  return _client;
}

/** Magic link (passwordless) — primary sign-in */
export async function signInWithMagicLink(email, redirectTo) {
  const supabase = getSupabase();
  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo:
        redirectTo ||
        (typeof location !== 'undefined' ? `${location.origin}/app` : undefined),
    },
  });
}

export async function signOut() {
  return getSupabase().auth.signOut();
}

export async function getCurrentUser() {
  const { data: { user } } = await getSupabase().auth.getUser();
  return user;
}

export async function getSession() {
  const { data: { session } } = await getSupabase().auth.getSession();
  return session;
}
