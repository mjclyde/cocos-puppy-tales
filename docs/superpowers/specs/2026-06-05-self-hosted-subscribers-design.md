# Self-Hosted Subscribers + Unsubscribe — Design

**Date:** 2026-06-05
**Status:** Approved (pending spec review)

## Summary

Replace Buttondown with a self-hosted newsletter subscriber list stored in
Supabase. New subscribers are inserted into a dedicated `subscribers` table.
Outgoing emails (sent manually by the owner) include a stateless, HMAC-signed
unsubscribe link; clicking it removes the subscriber from the active list. An
admin-protected export endpoint returns the active list with ready-to-use
unsubscribe URLs for the manual send.

The existing `waitlist` table (adoption applications) is unrelated and left
unchanged.

## Goals

- Own the subscriber list in our own database (no third-party newsletter SaaS).
- A subscribe flow that is idempotent and reactivates previously-unsubscribed
  emails.
- A one-click unsubscribe link that is tamper-proof and needs no server-side
  token storage.
- A simple way for the owner to pull the active list + unsubscribe URLs at send
  time.

## Non-Goals (YAGNI)

- Double opt-in / confirmation emails.
- An admin UI page listing subscribers (export endpoint only for now).
- CSV export (JSON only; revisit if needed).
- RFC 8058 `List-Unsubscribe` / one-click POST headers.
- Sending email from the app (the owner sends manually).

## Architecture

### 1. Database — `subscribers` table

New migration `supabase/migrations/0003_subscribers.sql`, following the
`waitlist` pattern (RLS on, no anon/authenticated policies, service role only):

```sql
create table if not exists public.subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique,        -- stored normalized: trim + lowercase
  created_at      timestamptz not null default now(),
  unsubscribed_at timestamptz                   -- null = active subscriber
);

alter table public.subscribers enable row level security;
-- No policies => only the service role (server API routes) may access it.
```

- **Active subscriber** := `unsubscribed_at IS NULL`.
- `email` is stored normalized (trimmed + lowercased) so the unique constraint
  and the HMAC token are stable regardless of input casing.
- Soft delete: unsubscribe sets `unsubscribed_at`; the row is never deleted, so
  an accidental unsubscribe is reversible in Supabase and re-subscribes are
  distinguishable from brand-new ones.

### 2. Unsubscribe token — stateless HMAC

New helper `src/lib/newsletter/unsubscribe-token.ts`, mirroring the style of
`src/lib/auth/session.ts` (hex digest, `timingSafeEqual`, fail-closed on empty
secret):

- **Format:** `base64url(email) + "." + hmacSha256Hex(email, secret)`
  - Payload is the normalized email (base64url-encoded so it is URL-safe and the
    separator is unambiguous).
  - No expiry — links must keep working in already-sent emails indefinitely.
- **`createUnsubscribeToken(email, secret)`** → token string.
- **`verifyUnsubscribeToken(token, secret)`** → `string | null` (the normalized
  email if the signature is valid, else `null`). Fail closed when `secret` is
  empty; reject malformed tokens (missing separator, non-decodable payload,
  wrong-length signature) without throwing.
- **Secret:** dedicated env var `NEWSLETTER_UNSUBSCRIBE_SECRET`, kept separate
  from `ADMIN_SESSION_SECRET` so unsubscribe and admin-session key material do
  not overlap. Added to `.env.example`.

### 3. Subscribe flow — drop Buttondown

`src/lib/subscribe.ts`:
- Keep `isValidEmail` (Zod).
- Add `normalizeEmail(value): string` (`trim().toLowerCase()`).
- Remove `buildSubscribePayload` and the `SubscribePayload` interface (Buttondown
  shape).

`src/pages/api/subscribe.ts`:
- Validate email → `normalizeEmail` → upsert into `subscribers`.
- Upsert semantics (single statement on the `email` unique key):
  - New email → insert (`unsubscribed_at = null`).
  - Existing **active** email → no-op success (idempotent).
  - Existing **unsubscribed** email → reactivate by setting
    `unsubscribed_at = null`.
- On DB error, log server-side and return the existing generic 502 message.
- Preserve the current JSON response contract (`{ ok, message }` / `{ ok, error }`)
  so `SubscribeForm.astro` needs no changes.

Implementation note: use Supabase
`upsert(..., { onConflict: 'email' })` with `unsubscribed_at: null` so insert and
reactivate are one call.

### 4. Unsubscribe endpoint — instant one-click

New page `src/pages/unsubscribe.astro` with `export const prerender = false`.

`GET /unsubscribe?t=<token>`:
- Missing / malformed / invalid-signature token → render a friendly
  "This unsubscribe link is invalid" message (HTTP 200; no DB write).
- Valid token → `update subscribers set unsubscribed_at = now() where email = ?`
  (idempotent if already unsubscribed) → render "You've been unsubscribed. 🐾".
- Instant one-click per product decision. The token is unguessable and the soft
  delete makes any prefetch-triggered unsubscribe reversible in Supabase.

### 5. Admin export endpoint

New `src/pages/api/admin/subscribers.ts`, `prerender = false`. Lives under
`/api/admin/*`, already guarded by `src/middleware.ts`.

`GET /api/admin/subscribers`:
- Query active subscribers (`unsubscribed_at IS NULL`), ordered by `created_at`.
- For each, build `unsubscribe_url` from the configured site origin
  (`import.meta.env.SITE`, set via `astro.config.mjs` `site`) +
  `/unsubscribe?t=<token>`.
- Respond `200` with JSON `[{ email, unsubscribe_url }]`.
- On DB error, log server-side and return a generic error (mirrors existing admin
  endpoints).

### 6. Cleanup

- Remove `BUTTONDOWN_API_KEY` from `.env.example`; add
  `NEWSLETTER_UNSUBSCRIBE_SECRET`.
- Remove the Buttondown comment/reference in `playwright.config.ts`.
- No remaining references to `buttondown` anywhere in code or config.

## Data Flow

**Subscribe:** `SubscribeForm.astro` → `POST /api/subscribe` → validate +
normalize → `subscribers` upsert → JSON `{ ok: true }`.

**Send (manual):** owner → `GET /api/admin/subscribers` (admin cookie) →
`[{ email, unsubscribe_url }]` → owner's mail merge embeds `unsubscribe_url`.

**Unsubscribe:** reader clicks link → `GET /unsubscribe?t=…` → verify token →
set `unsubscribed_at` → confirmation page.

## Error Handling

- Invalid email on subscribe → 400 with friendly message (unchanged).
- Missing Supabase env → existing `getSupabase()` throws; caught per-route and
  surfaced as a generic 500/502, logged server-side.
- Missing `NEWSLETTER_UNSUBSCRIBE_SECRET` → token verify fails closed (no
  unsubscribe possible) and token creation should throw at the export endpoint so
  the misconfiguration is loud rather than emitting unverifiable links.
- Malformed/forged unsubscribe token → "invalid link" page, no DB write.

## Testing

**Unit (Vitest, `test/`):**
- `unsubscribe-token`: sign→verify round-trip returns the email; tampered
  payload/signature returns `null`; empty secret returns `null`; malformed token
  returns `null`; casing-normalized email produces a stable token.
- `subscribe`: `normalizeEmail` behavior; `isValidEmail` unchanged.
- Replace the existing Buttondown `buildSubscribePayload` test
  (`test/subscribe.test.ts`).
- Upsert/reactivate logic covered at the pure-logic level where practical
  (Supabase client mocked).

**E2E (Playwright):** keep at smoke level (pages render, subscribe form present,
unsubscribe page renders with a dummy/invalid token shows the invalid-link
message). A full subscribe→unsubscribe DB round-trip needs live Supabase and is
out of scope for the smoke suite, consistent with the current setup.

**Coverage target:** maintain the project's 80% minimum on the new pure-logic
modules (token + normalization).

## Files Touched

- `supabase/migrations/0003_subscribers.sql` — new
- `src/lib/newsletter/unsubscribe-token.ts` — new
- `src/lib/subscribe.ts` — edit (add `normalizeEmail`, remove Buttondown payload)
- `src/pages/api/subscribe.ts` — edit (Supabase upsert instead of Buttondown)
- `src/pages/unsubscribe.astro` — new
- `src/pages/api/admin/subscribers.ts` — new
- `.env.example` — edit (drop `BUTTONDOWN_API_KEY`, add
  `NEWSLETTER_UNSUBSCRIBE_SECRET`)
- `playwright.config.ts` — edit (remove Buttondown comment)
- `test/subscribe.test.ts` — edit (replace Buttondown test)
- `test/newsletter/unsubscribe-token.test.ts` — new
