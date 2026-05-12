-- Generated response letter text for dashboard / exports (separate from letter_full JSON analysis)

alter table public.audit_jobs
  add column if not exists letter_html text;
