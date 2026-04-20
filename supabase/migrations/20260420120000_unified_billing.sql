-- Unified billing, idempotency, and usage (run in Supabase SQL editor or CLI)

create table if not exists public.processed_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  status text not null check (status in ('pending', 'completed', 'failed')),
  completed_at timestamptz,
  created_at timestamptz default now(),
  user_id uuid references auth.users (id) on delete set null,
  error text
);

create index if not exists idx_processed_sessions_status on public.processed_sessions (status);

create table if not exists public.user_review_usage (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reviews_used int not null default 0,
  updated_at timestamptz default now()
);

create table if not exists public.billing_entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text unique,
  plan_type text not null default 'single',
  active boolean not null default false,
  renewal_at timestamptz,
  review_limit int not null default 1,
  updated_at timestamptz default now(),
  last_stripe_session_id text
);

create index if not exists idx_billing_stripe_customer on public.billing_entitlements (stripe_customer_id);

create or replace function public.increment_review_usage(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_review_usage (user_id, reviews_used)
  values (p_user_id, 1)
  on conflict (user_id) do update
    set reviews_used = public.user_review_usage.reviews_used + 1,
        updated_at = now();
end;
$$;

grant execute on function public.increment_review_usage(uuid) to service_role;
