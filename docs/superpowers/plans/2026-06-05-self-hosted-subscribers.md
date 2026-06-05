# Self-Hosted Subscribers + Unsubscribe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Buttondown with a self-hosted Supabase `subscribers` table, a stateless HMAC unsubscribe link, and an admin export endpoint that returns the active list with unsubscribe URLs.

**Architecture:** New `subscribers` table (service-role RLS, soft delete via `unsubscribed_at`). The subscribe API route upserts into it. Unsubscribe links carry an HMAC-signed token (no DB token storage); a one-click `/unsubscribe` page verifies the token and sets `unsubscribed_at`. An admin-guarded JSON export builds each subscriber's unsubscribe URL from the configured site origin.

**Tech Stack:** Astro 6 (API routes + `.astro` SSR pages), Supabase JS (service role), Node `crypto` HMAC, Zod, Vitest.

**Design spec:** `docs/superpowers/specs/2026-06-05-self-hosted-subscribers-design.md`

**Ordering note:** Tasks are sequenced so every commit builds green. `buildSubscribePayload` is removed only in Task 5 — the same commit that stops the route from importing it.

---

## File Structure

- `supabase/migrations/0003_subscribers.sql` — new table (Task 1)
- `src/lib/subscribe.ts` — add `normalizeEmail`; later drop Buttondown payload (Tasks 2, 5)
- `src/lib/newsletter/unsubscribe-token.ts` — HMAC token create/verify (Task 3)
- `src/lib/newsletter/links.ts` — `buildUnsubscribeUrl` (Task 4)
- `src/pages/api/subscribe.ts` — Supabase upsert instead of Buttondown (Task 5)
- `src/pages/unsubscribe.astro` — one-click unsubscribe page (Task 6)
- `src/pages/api/admin/subscribers.ts` — admin JSON export (Task 7)
- `.env.example`, `playwright.config.ts` — cleanup (Task 8)
- Tests: `test/subscribe.test.ts` (edit), `test/newsletter/unsubscribe-token.test.ts` (new), `test/newsletter/links.test.ts` (new)

---

## Task 1: Create the `subscribers` migration

**Files:**
- Create: `supabase/migrations/0003_subscribers.sql`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/0003_subscribers.sql`:

```sql
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
```

- [ ] **Step 2: Verify SQL is well-formed**

Run: `grep -c "create table" supabase/migrations/0003_subscribers.sql`
Expected: `1`

(The migration is applied manually in Supabase, matching the existing `0001`/`0002` workflow — no automated apply step here.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_subscribers.sql
git commit -m "feat: add subscribers table migration"
```

---

## Task 2: Add `normalizeEmail` helper

**Files:**
- Modify: `src/lib/subscribe.ts`
- Test: `test/subscribe.test.ts`

This task is additive — `buildSubscribePayload` stays until Task 5 so the route keeps building.

- [ ] **Step 1: Write the failing test**

Add to `test/subscribe.test.ts` inside the existing `describe('subscribe helpers', ...)` block:

```typescript
  it('normalizes email by trimming and lowercasing', () => {
    expect(normalizeEmail('  Fan@Example.COM  ')).toBe('fan@example.com');
  });
  it('leaves an already-normalized email unchanged', () => {
    expect(normalizeEmail('fan@example.com')).toBe('fan@example.com');
  });
```

And update the import line at the top of `test/subscribe.test.ts`:

```typescript
import { isValidEmail, buildSubscribePayload, normalizeEmail } from '../src/lib/subscribe';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/subscribe.test.ts`
Expected: FAIL — `normalizeEmail is not a function` / import has no such export.

- [ ] **Step 3: Add the implementation**

In `src/lib/subscribe.ts`, add this export (leave the existing `isValidEmail`, `SubscribePayload`, and `buildSubscribePayload` in place for now):

```typescript
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/subscribe.test.ts`
Expected: PASS (all cases, including the still-present `buildSubscribePayload` test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/subscribe.ts test/subscribe.test.ts
git commit -m "feat: add normalizeEmail helper"
```

---

## Task 3: HMAC unsubscribe token helper

**Files:**
- Create: `src/lib/newsletter/unsubscribe-token.ts`
- Test: `test/newsletter/unsubscribe-token.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/newsletter/unsubscribe-token.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from '../../src/lib/newsletter/unsubscribe-token';

const SECRET = 'test-secret-please-change';

describe('unsubscribe token', () => {
  it('round-trips a valid token back to the normalized email', () => {
    const token = createUnsubscribeToken('fan@example.com', SECRET);
    expect(verifyUnsubscribeToken(token, SECRET)).toBe('fan@example.com');
  });

  it('normalizes case so an upper-case email verifies to the lower-case form', () => {
    const token = createUnsubscribeToken('  Fan@Example.COM ', SECRET);
    expect(verifyUnsubscribeToken(token, SECRET)).toBe('fan@example.com');
  });

  it('rejects a token signed with a different secret', () => {
    const token = createUnsubscribeToken('fan@example.com', SECRET);
    expect(verifyUnsubscribeToken(token, 'other-secret')).toBeNull();
  });

  it('rejects a tampered signature', () => {
    const token = createUnsubscribeToken('fan@example.com', SECRET);
    const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
    expect(verifyUnsubscribeToken(tampered, SECRET)).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const token = createUnsubscribeToken('fan@example.com', SECRET);
    const [, sig] = token.split('.');
    const forgedPayload = Buffer.from('evil@example.com', 'utf8').toString('base64url');
    expect(verifyUnsubscribeToken(`${forgedPayload}.${sig}`, SECRET)).toBeNull();
  });

  it('returns null for a malformed token (no separator)', () => {
    expect(verifyUnsubscribeToken('not-a-token', SECRET)).toBeNull();
  });

  it('returns null for an undefined token', () => {
    expect(verifyUnsubscribeToken(undefined, SECRET)).toBeNull();
  });

  it('fails closed when the secret is empty on verify', () => {
    // Build a token with a real secret, then verify with an empty one.
    const token = createUnsubscribeToken('fan@example.com', SECRET);
    expect(verifyUnsubscribeToken(token, '')).toBeNull();
  });

  it('throws when creating a token with an empty secret', () => {
    expect(() => createUnsubscribeToken('fan@example.com', '')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/newsletter/unsubscribe-token.test.ts`
Expected: FAIL — module `src/lib/newsletter/unsubscribe-token` not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/newsletter/unsubscribe-token.ts`:

```typescript
import { createHmac, timingSafeEqual } from 'node:crypto';
import { normalizeEmail } from '../subscribe';

const SEP = '.';

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Build a stateless unsubscribe token for an email.
 * Format: base64url(normalizedEmail) + "." + hmacSha256Hex(normalizedEmail, secret).
 * No expiry — links must keep working in already-sent emails indefinitely.
 */
export function createUnsubscribeToken(email: string, secret: string): string {
  if (!secret) {
    throw new Error('NEWSLETTER_UNSUBSCRIBE_SECRET is not configured');
  }
  const normalized = normalizeEmail(email);
  const payload = Buffer.from(normalized, 'utf8').toString('base64url');
  return `${payload}${SEP}${sign(normalized, secret)}`;
}

/**
 * Verify a token. Returns the normalized email if the signature is valid,
 * otherwise null. Fails closed on empty secret or malformed input.
 */
export function verifyUnsubscribeToken(
  token: string | undefined,
  secret: string,
): string | null {
  if (!token) return null;
  // Fail closed: an empty secret must never validate a token.
  if (!secret) return null;

  const idx = token.indexOf(SEP);
  if (idx <= 0) return null;

  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);

  const email = Buffer.from(payload, 'base64url').toString('utf8');
  if (!email) return null;

  const expected = sign(email, secret);
  // Decode as hex so timingSafeEqual gets equal-length buffers; a malformed sig
  // decodes to a buffer that won't match rather than throwing.
  const sigBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  return email;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/newsletter/unsubscribe-token.test.ts`
Expected: PASS (all 9 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/newsletter/unsubscribe-token.ts test/newsletter/unsubscribe-token.test.ts
git commit -m "feat: add HMAC unsubscribe token helper"
```

---

## Task 4: `buildUnsubscribeUrl` helper

**Files:**
- Create: `src/lib/newsletter/links.ts`
- Test: `test/newsletter/links.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/newsletter/links.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildUnsubscribeUrl } from '../../src/lib/newsletter/links';
import { verifyUnsubscribeToken } from '../../src/lib/newsletter/unsubscribe-token';

const SECRET = 'test-secret-please-change';

describe('buildUnsubscribeUrl', () => {
  it('builds a URL under the given origin pointing at /unsubscribe', () => {
    const url = buildUnsubscribeUrl('fan@example.com', SECRET, 'https://example.com');
    expect(url.startsWith('https://example.com/unsubscribe?t=')).toBe(true);
  });

  it('strips a trailing slash from the origin', () => {
    const url = buildUnsubscribeUrl('fan@example.com', SECRET, 'https://example.com/');
    expect(url.startsWith('https://example.com/unsubscribe?t=')).toBe(true);
    expect(url.includes('.com//unsubscribe')).toBe(false);
  });

  it('embeds a token that verifies back to the email', () => {
    const url = buildUnsubscribeUrl('Fan@Example.com', SECRET, 'https://example.com');
    const token = decodeURIComponent(new URL(url).searchParams.get('t') ?? '');
    expect(verifyUnsubscribeToken(token, SECRET)).toBe('fan@example.com');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/newsletter/links.test.ts`
Expected: FAIL — module `src/lib/newsletter/links` not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/newsletter/links.ts`:

```typescript
import { createUnsubscribeToken } from './unsubscribe-token';

/** Build the absolute one-click unsubscribe URL for an email. */
export function buildUnsubscribeUrl(
  email: string,
  secret: string,
  origin: string,
): string {
  const token = createUnsubscribeToken(email, secret);
  const base = origin.replace(/\/+$/, '');
  return `${base}/unsubscribe?t=${encodeURIComponent(token)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/newsletter/links.test.ts`
Expected: PASS (all 3 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/newsletter/links.ts test/newsletter/links.test.ts
git commit -m "feat: add buildUnsubscribeUrl helper"
```

---

## Task 5: Subscribe route → Supabase upsert (remove Buttondown)

**Files:**
- Modify: `src/pages/api/subscribe.ts`
- Modify: `src/lib/subscribe.ts` (remove Buttondown payload)
- Modify: `test/subscribe.test.ts` (drop the Buttondown payload test)

This is one commit so the build never references a removed export.

- [ ] **Step 1: Update the test to drop the Buttondown payload case**

In `test/subscribe.test.ts`:
- Change the import back to drop `buildSubscribePayload`:

```typescript
import { isValidEmail, normalizeEmail } from '../src/lib/subscribe';
```

- Delete the entire `it('builds the Buttondown payload', ...)` test case.

The remaining file should contain only the `isValidEmail` and `normalizeEmail` cases.

- [ ] **Step 2: Run the test to confirm it still passes**

Run: `npx vitest run test/subscribe.test.ts`
Expected: PASS. We only removed the test case and its import; `isValidEmail` and `normalizeEmail` still exist (Buttondown source is removed in Step 3).

- [ ] **Step 3: Remove the Buttondown payload from the lib**

In `src/lib/subscribe.ts`, delete the `SubscribePayload` interface and `buildSubscribePayload` function. The file should end up as:

```typescript
import { z } from 'zod';

const emailSchema = z.string().email();

export function isValidEmail(value: string): boolean {
  return emailSchema.safeParse(value).success;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
```

- [ ] **Step 4: Rewrite the subscribe route to upsert into Supabase**

Replace the entire contents of `src/pages/api/subscribe.ts` with:

```typescript
export const prerender = false;
import type { APIRoute } from 'astro';
import { isValidEmail, normalizeEmail } from '../../lib/subscribe';
import { getSupabase } from '../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const email = normalizeEmail(String(form.get('email') ?? ''));

  if (!isValidEmail(email)) {
    return json({ ok: false, error: 'Please enter a valid email.' }, 400);
  }

  try {
    // Insert new, or reactivate a previously-unsubscribed email, in one call.
    // created_at is omitted so existing rows keep their original timestamp.
    const { error } = await getSupabase()
      .from('subscribers')
      .upsert({ email, unsubscribed_at: null }, { onConflict: 'email' });

    if (error) {
      console.error('subscribe: upsert failed', error);
      return json({ ok: false, error: 'Something went wrong. Please try again.' }, 502);
    }
  } catch (err) {
    console.error('subscribe: unexpected error', err);
    return json({ ok: false, error: 'Subscriptions are temporarily unavailable.' }, 500);
  }

  return json({ ok: true, message: "You're on the list! 🐾" }, 200);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 5: Run the unit suite and a type/build check**

Run: `npx vitest run`
Expected: PASS (no remaining reference to `buildSubscribePayload`).

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors. (If `npm run build` requires env vars and fails for unrelated reasons, instead run `npx astro check` and expect no type errors in `src/lib/subscribe.ts` or `src/pages/api/subscribe.ts`.)

- [ ] **Step 6: Commit**

```bash
git add src/pages/api/subscribe.ts src/lib/subscribe.ts test/subscribe.test.ts
git commit -m "feat: store subscribers in Supabase instead of Buttondown"
```

---

## Task 6: One-click unsubscribe page

**Files:**
- Create: `src/pages/unsubscribe.astro`

- [ ] **Step 1: Write the page**

Create `src/pages/unsubscribe.astro`:

```astro
---
export const prerender = false;
import { verifyUnsubscribeToken } from '../lib/newsletter/unsubscribe-token';
import { getSupabase } from '../lib/supabase';

const token = Astro.url.searchParams.get('t') ?? undefined;
const secret = import.meta.env.NEWSLETTER_UNSUBSCRIBE_SECRET ?? '';
const email = verifyUnsubscribeToken(token, secret);

let status: 'ok' | 'invalid' | 'error' = 'invalid';

if (email) {
  try {
    // Idempotent: updates 0 rows if the email is unknown or already unsubscribed.
    const { error } = await getSupabase()
      .from('subscribers')
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq('email', email);
    status = error ? 'error' : 'ok';
    if (error) console.error('unsubscribe: update failed', error);
  } catch (err) {
    console.error('unsubscribe: unexpected error', err);
    status = 'error';
  }
}
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Unsubscribe — Coco's Puppy Tales</title>
  </head>
  <body style="font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1rem; line-height: 1.5;">
    {status === 'ok' && (
      <>
        <h1>You've been unsubscribed 🐾</h1>
        <p>You won't receive any more emails from Coco's Puppy Tales. We'll miss you!</p>
      </>
    )}
    {status === 'invalid' && (
      <>
        <h1>This unsubscribe link is invalid</h1>
        <p>The link may be incomplete or out of date. If you keep getting emails you don't want, just reply to one and we'll remove you.</p>
      </>
    )}
    {status === 'error' && (
      <>
        <h1>Something went wrong</h1>
        <p>We couldn't process your request right now. Please try again later, or reply to one of our emails and we'll remove you manually.</p>
      </>
    )}
  </body>
</html>
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: Build succeeds; `/unsubscribe` is emitted as an on-demand (non-prerendered) route. (If build needs env and fails unrelated, run `npx astro check` and expect no type errors in `src/pages/unsubscribe.astro`.)

- [ ] **Step 3: Manual smoke (optional but recommended)**

With a dev server running (`npm run dev`), visit `http://localhost:4321/unsubscribe?t=bogus`.
Expected: "This unsubscribe link is invalid" message renders (no DB write).

- [ ] **Step 4: Commit**

```bash
git add src/pages/unsubscribe.astro
git commit -m "feat: add one-click unsubscribe page"
```

---

## Task 7: Admin subscriber export endpoint

**Files:**
- Create: `src/pages/api/admin/subscribers.ts`

The route lives under `/api/admin/*`, already guarded by `src/middleware.ts` (returns 401 JSON without a valid admin session), so no auth code is needed here.

- [ ] **Step 1: Write the endpoint**

Create `src/pages/api/admin/subscribers.ts`:

```typescript
export const prerender = false;
import type { APIRoute } from 'astro';
import { getSupabase } from '../../../lib/supabase';
import { buildUnsubscribeUrl } from '../../../lib/newsletter/links';

export const GET: APIRoute = async ({ request }) => {
  const secret = import.meta.env.NEWSLETTER_UNSUBSCRIBE_SECRET ?? '';
  if (!secret) {
    console.error('admin/subscribers: NEWSLETTER_UNSUBSCRIBE_SECRET is not configured');
    return json({ ok: false, error: 'Unsubscribe links are not configured.' }, 500);
  }

  // Prefer the configured site origin; fall back to the request origin.
  const origin = import.meta.env.SITE ?? new URL(request.url).origin;

  try {
    const { data, error } = await getSupabase()
      .from('subscribers')
      .select('email')
      .is('unsubscribed_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('admin/subscribers: query failed', error);
      return json({ ok: false, error: 'Could not load subscribers.' }, 502);
    }

    const subscribers = (data ?? []).map((row) => ({
      email: row.email as string,
      unsubscribe_url: buildUnsubscribeUrl(row.email as string, secret, origin),
    }));

    return json({ ok: true, subscribers }, 200);
  } catch (err) {
    console.error('admin/subscribers: unexpected error', err);
    return json({ ok: false, error: 'Subscribers are temporarily unavailable.' }, 500);
  }
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: Build succeeds. (Or `npx astro check` — no type errors in `src/pages/api/admin/subscribers.ts`.)

- [ ] **Step 3: Manual smoke (optional but recommended)**

With `npm run dev` and no admin session cookie, request `http://localhost:4321/api/admin/subscribers`.
Expected: HTTP 401 `{"ok":false,"error":"Unauthorized"}` (enforced by middleware).

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/admin/subscribers.ts
git commit -m "feat: add admin subscriber export endpoint"
```

---

## Task 8: Remove remaining Buttondown references + env

**Files:**
- Modify: `.env.example`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Update `.env.example`**

In `.env.example`, replace the Buttondown block:

```
# Buttondown newsletter
BUTTONDOWN_API_KEY=your-buttondown-api-key
```

with:

```
# Newsletter unsubscribe-link signing secret (server-side only — never expose to the client)
NEWSLETTER_UNSUBSCRIBE_SECRET=choose-a-long-random-hex-string
```

- [ ] **Step 2: Update `playwright.config.ts`**

Open `playwright.config.ts:5` and remove/replace the comment referencing Buttondown so it no longer mentions the removed service. For example, change a line like `// smoke tests don't require Buttondown` to `// smoke tests don't require newsletter secrets`.

- [ ] **Step 3: Verify no Buttondown references remain**

Run: `grep -ri buttondown src .env.example playwright.config.ts; echo "exit: $?"`
Expected: no matches printed (grep exit `1` after the echo, i.e. the only line is `exit: 1`).

- [ ] **Step 4: Run the full unit suite**

Run: `npx vitest run`
Expected: PASS (all suites).

- [ ] **Step 5: Commit**

```bash
git add .env.example playwright.config.ts
git commit -m "chore: drop Buttondown env and references"
```

---

## Final Verification

- [ ] `npx vitest run` — all unit tests pass.
- [ ] `npm run build` (or `npx astro check`) — no type errors.
- [ ] `grep -ri buttondown src` — no matches.
- [ ] Migration `0003_subscribers.sql` applied in Supabase (manual, before deploy).
- [ ] `NEWSLETTER_UNSUBSCRIBE_SECRET` set in the deployment environment (and locally in `.env`).
- [ ] Manual end-to-end (against a real/staged Supabase): subscribe via the form → row appears with `unsubscribed_at = null`; hit `/api/admin/subscribers` with an admin session → returns the email + `unsubscribe_url`; open that URL → page shows "unsubscribed" and the row's `unsubscribed_at` is set; re-subscribe with the same email → `unsubscribed_at` returns to null.
