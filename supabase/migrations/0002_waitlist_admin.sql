-- Run in the Supabase SQL editor (or via the Supabase CLI / MCP).
-- Adds admin-only fields. RLS already blocks public access (migration 0001);
-- the service role used by our admin API bypasses RLS, so no new policy is needed.
alter table public.waitlist
  add column if not exists status text not null default 'new',
  add column if not exists notes text;

alter table public.waitlist
  drop constraint if exists waitlist_status_check;
alter table public.waitlist
  add constraint waitlist_status_check
  check (status in ('new', 'contacted', 'approved', 'declined'));
