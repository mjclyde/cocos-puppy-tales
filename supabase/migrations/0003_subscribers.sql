-- Run in the Supabase SQL editor (or via the Supabase CLI).
create table if not exists public.subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique,        -- stored normalized: trim + lowercase
  created_at      timestamptz not null default now(),
  unsubscribed_at timestamptz                   -- null = active subscriber
);

-- Lock the table down: only the service role (used by our server API routes) may access it.
alter table public.subscribers enable row level security;
-- No policies for anon/authenticated => no public read/write. The service role bypasses RLS.
