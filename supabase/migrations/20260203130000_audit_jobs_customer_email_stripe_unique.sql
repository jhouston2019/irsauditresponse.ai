-- customer_email for Stripe fallback matching; unique stripe_session_id for webhook upserts
alter table public.audit_jobs add column if not exists customer_email text;

create unique index if not exists audit_jobs_stripe_session_id_key
  on public.audit_jobs (stripe_session_id)
  where stripe_session_id is not null;
