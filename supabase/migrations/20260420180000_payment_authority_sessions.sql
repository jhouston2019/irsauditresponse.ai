-- Payment authority: explicit verification flag, session lock, audit trail, stricter session states.

-- 1) Entitlements: payment must be explicitly verified (not inferred from legacy flags alone)
alter table public.billing_entitlements
  add column if not exists payment_verified boolean not null default false;

-- Existing active subscribers: treat as already verified so we do not lock them out post-migration.
update public.billing_entitlements
set payment_verified = true
where active = true and payment_verified = false;

-- 2) processed_sessions: permanent lock + anonymous finalize tracking
alter table public.processed_sessions
  add column if not exists locked_user_id uuid references auth.users (id) on delete set null,
  add column if not exists anonymous_finalize_used boolean not null default false;

-- Normalize invalid rows before new constraints
update public.processed_sessions
set
  status = 'pending',
  error = coalesce(nullif(trim(error), ''), 'invalid_completed_no_user'),
  completed_at = null
where status = 'completed' and user_id is null;

update public.processed_sessions
set locked_user_id = user_id
where status = 'completed' and user_id is not null and locked_user_id is null;

-- Replace status enum constraint
alter table public.processed_sessions drop constraint if exists processed_sessions_status_check;

alter table public.processed_sessions
  add constraint processed_sessions_status_check
  check (status in ('pending', 'verified', 'completed', 'expired', 'failed'));

-- completed requires user bound to self-consistent lock
alter table public.processed_sessions drop constraint if exists processed_sessions_completed_user_lock;

alter table public.processed_sessions
  add constraint processed_sessions_completed_user_lock
  check (
    status <> 'completed'
    or (
      user_id is not null
      and locked_user_id is not null
      and user_id = locked_user_id
    )
  );

-- 3) Audit log (service_role writes only in app code)
create table if not exists public.payment_audit_log (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  user_id uuid references auth.users (id) on delete set null,
  event_type text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_payment_audit_log_session_id on public.payment_audit_log (session_id);
create index if not exists idx_payment_audit_log_created_at on public.payment_audit_log (created_at desc);

alter table public.payment_audit_log enable row level security;
