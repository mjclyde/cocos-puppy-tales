-- Run in the Supabase SQL editor (or via the Supabase CLI).
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  phone text,
  location text not null,
  about text not null,
  preferences text,
  read_expectations boolean not null default false,
  source text
);

-- Lock the table down: only the service role (used by our server API route) may access it.
alter table public.waitlist enable row level security;
-- No policies for anon/authenticated => no public read/write. The service role bypasses RLS.
