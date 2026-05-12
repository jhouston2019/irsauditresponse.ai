-- Wizard lifecycle + deliverable tracking (dashboard, cross-session)

alter table public.audit_jobs
  add column if not exists wizard_status text not null default 'draft';

alter table public.audit_jobs
  add column if not exists selected_strategy text;

alter table public.audit_jobs
  add column if not exists updated_at timestamptz default now();

comment on column public.audit_jobs.wizard_status is 'draft | analyzed | letter_ready | error';
