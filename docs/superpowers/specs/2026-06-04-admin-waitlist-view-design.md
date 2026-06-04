# Admin Waitlist View — Design Spec

**Date:** 2026-06-04
**Status:** Approved for planning
**Author:** Brainstormed with Claude
**Parent spec:** [2026-06-03-coco-puppy-nursery-design.md](./2026-06-03-coco-puppy-nursery-design.md)

---

## 1. Overview

A password-gated `/admin` area where the two owners (developer + spouse) can review
waitlist submissions, set a **status** on each interested family, and keep **private
notes**. It is read + write (no CSV export). Access is controlled by a single shared
password.

This is a small feature layered onto the Phase 1 Nursery site. The parent spec lists
"any admin UI, any gating/password protection" as out of scope for Phase 1, so this
spec explicitly extends that scope. The auth gate is built so it can be **reused for
Phase 5's gated puppy-cam** ("gating middleware" in the parent roadmap).

### Goals

- Let both owners view every waitlist entry, newest first, on desktop or mobile.
- Track each family through a lifecycle status.
- Keep freeform private notes per family.
- Gate all of the above behind a shared password, without exposing the Supabase
  service-role key or weakening the existing public waitlist flow.

### Non-goals

- CSV / spreadsheet export.
- Individual user accounts or per-user audit trails (shared password only).
- Editing/deleting the underlying waitlist submission fields (status + notes only).
- Rate-limiting infrastructure beyond a strong password (see §6).

---

## 2. Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Authentication | **Shared password** | Two trusted users; simplest; matches parent spec's "shared password" gating plan |
| Gate implementation | **Astro middleware + signed session cookie** | Real branded login page, clean logout, reusable session model for Phase 5; only modestly more code than HTTP Basic Auth |
| Admin capabilities | **View + status + private notes** | What the owners asked for; CSV deferred |
| Status values | `new` → `contacted` → `approved` → `declined` | Covers the family-vetting lifecycle; can grow later |
| Write authorization | **Service-role key behind authed API** | Service role already configured; bypasses RLS; no new RLS policy needed |

---

## 3. Data Model Changes

One Supabase migration in `supabase/migrations/` adds two columns to the existing
`waitlist` table:

- `status` — `text`, `NOT NULL`, `DEFAULT 'new'`, with a `CHECK` constraint limiting
  values to `('new', 'contacted', 'approved', 'declined')`.
- `notes` — `text`, nullable.

**RLS unchanged.** Public clients still cannot read or write the table. The admin API
reads and writes using the existing **service-role key**, which bypasses RLS, so no new
policy is required. The public waitlist insert path (`/api/waitlist`) is untouched and
simply leaves `status` at its default and `notes` null.

---

## 4. Authentication & Session

### Environment variables (server-side only)

- **`ADMIN_PASSWORD`** — a long, randomly generated shared secret.
- **`ADMIN_SESSION_SECRET`** — HMAC signing key for the session cookie.

Both added to `.env.example` and configured in Vercel. Never shipped to the client.

### Flow

1. **Login** — `POST /api/admin/login` with the password.
   - Constant-time compare against `ADMIN_PASSWORD`.
   - On success: set a session cookie and redirect to `/admin`.
   - On failure: small fixed artificial delay, then redirect back to `/admin/login`
     with an error indication.
2. **Session cookie** — `httpOnly`, `secure`, `SameSite=Lax`, signed.
   - Value is an HMAC (using `ADMIN_SESSION_SECRET`) over an expiry timestamp.
   - ~30-day lifetime; verification rejects tampered or expired tokens.
3. **Logout** — `POST /api/admin/logout` clears the cookie.
4. **Guard** — `src/middleware.ts` runs on every request:
   - `/admin/*` page request without a valid cookie → redirect to `/admin/login`.
   - `/api/admin/*` request without a valid cookie → `401` JSON.
   - `/admin/login` and `/api/admin/login` are reachable while unauthenticated.

### Modules (small, focused — per coding-style)

- `src/lib/auth/session.ts` — sign / verify the session token.
- `src/lib/auth/password.ts` — constant-time password comparison.
- `src/lib/admin/waitlist-admin.ts` — fetch all entries; update one entry's status/notes.

---

## 5. Routes & UI

All admin pages are server-rendered (`export const prerender = false`) and carry a
`noindex` meta tag.

### Pages

- `src/pages/admin/login.astro` — on-brand login screen (Nunito, cream/navy palette),
  single password field, error state.
- `src/pages/admin/index.astro` — dashboard: responsive table of waitlist entries,
  newest first, showing all captured fields (name, email, phone, location, about,
  preferences, read_expectations, source, created_at), plus a **status dropdown** and a
  **notes textarea** per row, and a logout button.

### API routes

- `src/pages/api/admin/login.ts` — POST login.
- `src/pages/api/admin/logout.ts` — POST logout.
- `src/pages/api/admin/entry.ts` — POST update of one entry's `status` and/or `notes`;
  validates input with zod; requires a valid session.

### Components

- `src/components/admin/WaitlistTable.astro`
- `src/components/admin/WaitlistRow.astro` (status select + notes field)

### Inline saves (progressive enhancement)

Mirrors the existing public-form pattern. Each row is a real `<form>` that works without
JS (POST to `entry.ts` → reload). A tiny `fetch`-based island enhances it to save inline
and show a transient "saved ✓" state. Minimal JS, consistent with the site's static-first
ethos.

---

## 6. Security & Hygiene

- **Discoverability:** `robots.txt` disallows `/admin`; the sitemap integration excludes
  `/admin/*`; admin pages carry `noindex`. (Obscurity is not the protection — the
  password is — but the admin area should not be advertised or indexed.)
- **Brute force:** defended by a long random `ADMIN_PASSWORD`, constant-time compare, and
  a small fixed delay on failed login. A per-IP rate-limit table is noted as a deferred
  option, not built (overkill for two users). Revisit if abuse is observed.
- **Secrets:** the Supabase service-role key, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET`
  remain server-side only, never shipped to the client.
- **Input validation:** `entry.ts` validates `status` (against the allowed set) and `notes`
  (length-bounded) with zod before any write.

---

## 7. Testing

- **Unit:** session sign/verify (valid, tampered, expired tokens); constant-time password
  compare; admin query/row mapping.
- **Integration:** login with correct vs. incorrect password; middleware redirects pages
  and returns `401` for APIs when unauthenticated; `entry.ts` rejects unauthenticated
  writes and rejects invalid `status`/`notes`.
- **E2E (Playwright):** log in → see the table → change a status → add a note → reload
  shows persisted values → log out → `/admin` redirects back to login.

---

## 8. Out of Scope

CSV export, individual user accounts, audit logging, editing submitted waitlist fields,
deleting entries, and dedicated rate-limiting infrastructure. These can be added later
without reworking the gate or data model.
