alter table public.audit_jobs
  add column if not exists selected_strategy text;

alter table public.audit_jobs
  add column if not exists updated_at timestamptz default now();
