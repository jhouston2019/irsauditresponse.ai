-- Audit wizard entitlements + align auth.users profiles with FK

create table if not exists public.audit_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete cascade,
  letter_full text,
  preview_text text,
  paid boolean not null default false,
  is_unlocked boolean not null default false,
  stripe_session_id text
);

create index if not exists idx_audit_jobs_user_id on public.audit_jobs (user_id);
create index if not exists idx_audit_jobs_stripe_session_id on public.audit_jobs (stripe_session_id);

alter table public.audit_jobs enable row level security;

drop policy if exists "audit_jobs_select_own" on public.audit_jobs;
create policy "audit_jobs_select_own" on public.audit_jobs
  for select using (auth.uid() = user_id);

drop policy if exists "audit_jobs_insert_own" on public.audit_jobs;
create policy "audit_jobs_insert_own" on public.audit_jobs
  for insert with check (auth.uid() = user_id);

drop policy if exists "audit_jobs_update_own" on public.audit_jobs;
create policy "audit_jobs_update_own" on public.audit_jobs
  for update using (auth.uid() = user_id);

-- Service role bypasses RLS for webhook/checkout server paths

do $$
begin
  alter table public.users alter column id drop default;
exception
  when others then null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fk_users_auth'
  ) then
    alter table public.users
      add constraint fk_users_auth foreign key (id) references auth.users(id) on delete cascade;
  end if;
end $$;

-- New signups populate public.users (and optional preferences row)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do update set email = coalesce(excluded.email, public.users.email);

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

