-- Spectre — demo request capture table.
-- Run this in the Supabase SQL Editor for the Spectre project
-- (Dashboard → SQL Editor → New query → paste → Run).

create table if not exists public.demo_requests (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null,
  email      text not null,
  company    text,
  source     text not null default 'book-a-demo'
);

-- Row-Level Security: visitors may INSERT a lead and nothing else.
-- No SELECT/UPDATE/DELETE policy => the anon (public) key cannot read leads.
-- Read your leads from the Dashboard (Table editor) or with the service role.
alter table public.demo_requests enable row level security;

drop policy if exists "Public can submit demo requests" on public.demo_requests;
create policy "Public can submit demo requests"
  on public.demo_requests
  for insert
  to anon, authenticated
  with check (true);
