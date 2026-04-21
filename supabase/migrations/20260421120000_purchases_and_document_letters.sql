-- Purchases recorded after Stripe checkout + Supabase sign-up (service role insert).

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_session_id text unique not null,
  created_at timestamptz default now()
);

alter table public.purchases enable row level security;

-- Wizard-saved letters (client insert with anon key + RLS)

alter table public.documents
  add column if not exists notice_type text;

alter table public.documents
  add column if not exists letter_html text;

alter table public.documents
  alter column file_name drop not null;

alter table public.documents
  alter column file_path drop not null;

drop policy if exists "Users can view own documents" on public.documents;
drop policy if exists "Users can insert own documents" on public.documents;
drop policy if exists "Users can update own documents" on public.documents;
drop policy if exists "Users can delete own documents" on public.documents;
drop policy if exists "Users read own" on public.documents;
drop policy if exists "Users insert own" on public.documents;

create policy "Users read own" on public.documents for select using (auth.uid() = user_id);

create policy "Users insert own" on public.documents for insert with check (auth.uid() = user_id);
