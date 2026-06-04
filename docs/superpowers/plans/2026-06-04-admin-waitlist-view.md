# Admin Waitlist View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a password-gated `/admin` area where the two owners can view every waitlist entry, set a status, and keep private notes.

**Architecture:** A signed session cookie (HMAC) issued after a constant-time password check gates `/admin/*` pages and `/api/admin/*` routes via Astro middleware. Admin pages are server-rendered (`prerender = false`) and read/write the existing `waitlist` table through the Supabase service-role key (which bypasses RLS). Status/notes edits use the site's progressive-enhancement pattern: a real `<form>` that works without JS, enhanced with `fetch` for inline saves.

**Tech Stack:** Astro 6 + Vercel adapter, Supabase (`@supabase/supabase-js`), zod, Node `crypto` (HMAC/SHA-256), vitest (unit), Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-06-04-admin-waitlist-view-design.md`

---

## File Structure

**Pure libraries (unit-tested with vitest):**
- `src/lib/auth/session.ts` — create / verify the HMAC session token.
- `src/lib/auth/password.ts` — constant-time password comparison.
- `src/lib/auth/cookie.ts` — shared cookie name, TTL, and cookie options (DRY across middleware + login/logout).
- `src/lib/admin/entry-input.ts` — allowed status values + zod schema for status/notes updates.

**Supabase access (covered by E2E):**
- `src/lib/admin/waitlist-admin.ts` — `fetchWaitlistEntries` / `updateWaitlistEntry`.

**Server routes & guard (covered by E2E):**
- `src/middleware.ts` — guards `/admin/*` and `/api/admin/*`.
- `src/pages/api/admin/login.ts`, `logout.ts`, `entry.ts`.
- `src/pages/admin/login.astro`, `src/pages/admin/index.astro`.

**Presentation:**
- `src/layouts/AdminLayout.astro` — minimal, `noindex`, no public nav/footer.
- `src/components/admin/WaitlistTable.astro`, `src/components/admin/WaitlistRow.astro`.

**Data & config:**
- `supabase/migrations/0002_waitlist_admin.sql` — adds `status` + `notes`.
- `.env.example`, `public/robots.txt`, `astro.config.mjs` — env keys + hygiene.

**Tests:**
- `test/admin/session.test.ts`, `test/admin/password.test.ts`, `test/admin/entry-input.test.ts`
- `test/e2e/admin.spec.ts`

---

## Task 1: Allowed statuses + update schema

**Files:**
- Create: `src/lib/admin/entry-input.ts`
- Test: `test/admin/entry-input.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/admin/entry-input.test.ts
import { describe, it, expect } from 'vitest';
import { parseEntryUpdate, WAITLIST_STATUSES } from '../../src/lib/admin/entry-input';

const id = '00000000-0000-0000-0000-000000000001';

describe('parseEntryUpdate', () => {
  it('accepts a valid status update', () => {
    const r = parseEntryUpdate({ id, status: 'approved' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe('approved');
  });

  it('accepts a notes-only update (including empty notes)', () => {
    expect(parseEntryUpdate({ id, notes: 'nice yard' }).success).toBe(true);
    expect(parseEntryUpdate({ id, notes: '' }).success).toBe(true);
  });

  it('rejects an unknown status', () => {
    expect(parseEntryUpdate({ id, status: 'maybe' }).success).toBe(false);
  });

  it('rejects a non-uuid id', () => {
    expect(parseEntryUpdate({ id: 'nope', status: 'new' }).success).toBe(false);
  });

  it('rejects an update with neither status nor notes', () => {
    expect(parseEntryUpdate({ id }).success).toBe(false);
  });

  it('exposes the four lifecycle statuses', () => {
    expect(WAITLIST_STATUSES).toEqual(['new', 'contacted', 'approved', 'declined']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/admin/entry-input.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/admin/entry-input`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/admin/entry-input.ts
import { z } from 'zod';

export const WAITLIST_STATUSES = ['new', 'contacted', 'approved', 'declined'] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];

export const entryUpdateSchema = z
  .object({
    id: z.string().uuid('A valid entry id is required'),
    status: z.enum(WAITLIST_STATUSES).optional(),
    notes: z.string().max(4000).optional().or(z.literal('')),
  })
  .refine((d) => d.status !== undefined || d.notes !== undefined, {
    message: 'Nothing to update',
  });

export type EntryUpdateInput = z.infer<typeof entryUpdateSchema>;

export function parseEntryUpdate(data: unknown) {
  return entryUpdateSchema.safeParse(data);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/admin/entry-input.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/entry-input.ts test/admin/entry-input.test.ts
git commit -m "feat: add waitlist admin update schema and statuses"
```

---

## Task 2: Session token sign/verify

**Files:**
- Create: `src/lib/auth/session.ts`
- Test: `test/admin/session.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/admin/session.test.ts
import { describe, it, expect } from 'vitest';
import { createSessionToken, verifySessionToken } from '../../src/lib/auth/session';

const SECRET = 'unit-test-secret';
const TTL = 1000 * 60 * 60; // 1 hour
const NOW = 1_000_000;

describe('session token', () => {
  it('verifies a freshly minted token', () => {
    const token = createSessionToken(SECRET, NOW, TTL);
    expect(verifySessionToken(token, SECRET, NOW + 60_000)).toBe(true);
  });

  it('rejects an expired token', () => {
    const token = createSessionToken(SECRET, NOW, TTL);
    expect(verifySessionToken(token, SECRET, NOW + TTL + 1)).toBe(false);
  });

  it('rejects a token signed with a different secret', () => {
    const token = createSessionToken(SECRET, NOW, TTL);
    expect(verifySessionToken(token, 'other-secret', NOW)).toBe(false);
  });

  it('rejects a tampered expiry', () => {
    const token = createSessionToken(SECRET, NOW, TTL);
    const [, sig] = token.split('.');
    const forged = `${NOW + TTL * 10}.${sig}`;
    expect(verifySessionToken(forged, SECRET, NOW)).toBe(false);
  });

  it('rejects undefined and malformed tokens', () => {
    expect(verifySessionToken(undefined, SECRET, NOW)).toBe(false);
    expect(verifySessionToken('garbage', SECRET, NOW)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/admin/session.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/auth/session`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/auth/session.ts
import { createHmac, timingSafeEqual } from 'node:crypto';

const SEP = '.';

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Create a session token that expires at `now + ttlMs`. */
export function createSessionToken(secret: string, now: number, ttlMs: number): string {
  const expiry = String(now + ttlMs);
  return `${expiry}${SEP}${sign(expiry, secret)}`;
}

/** True only if the signature is valid AND the token has not expired as of `now`. */
export function verifySessionToken(
  token: string | undefined,
  secret: string,
  now: number,
): boolean {
  if (!token) return false;
  const idx = token.indexOf(SEP);
  if (idx <= 0) return false;
  const expiry = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = sign(expiry, secret);
  if (sig.length !== expected.length) return false; // timingSafeEqual needs equal lengths
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const expiryNum = Number(expiry);
  if (!Number.isFinite(expiryNum)) return false;
  return expiryNum > now;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/admin/session.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/session.ts test/admin/session.test.ts
git commit -m "feat: add HMAC-signed admin session tokens"
```

---

## Task 3: Constant-time password check

**Files:**
- Create: `src/lib/auth/password.ts`
- Test: `test/admin/password.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/admin/password.test.ts
import { describe, it, expect } from 'vitest';
import { verifyPassword } from '../../src/lib/auth/password';

describe('verifyPassword', () => {
  it('accepts the matching password', () => {
    expect(verifyPassword('hunter2', 'hunter2')).toBe(true);
  });
  it('rejects a wrong password', () => {
    expect(verifyPassword('wrong', 'hunter2')).toBe(false);
  });
  it('rejects when the expected secret is empty (unconfigured)', () => {
    expect(verifyPassword('anything', '')).toBe(false);
  });
  it('rejects an empty input against a real secret', () => {
    expect(verifyPassword('', 'hunter2')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/admin/password.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/auth/password`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/auth/password.ts
import { createHash, timingSafeEqual } from 'node:crypto';

function sha256(input: string): Buffer {
  return createHash('sha256').update(input, 'utf8').digest();
}

/**
 * Constant-time password check. Comparing SHA-256 digests means length never leaks
 * and `timingSafeEqual` always receives two equal-length (32-byte) buffers.
 */
export function verifyPassword(input: string, expected: string): boolean {
  if (!expected) return false; // an unconfigured secret must never match
  return timingSafeEqual(sha256(input), sha256(expected));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/admin/password.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/password.ts test/admin/password.test.ts
git commit -m "feat: add constant-time admin password check"
```

---

## Task 4: Shared cookie config

**Files:**
- Create: `src/lib/auth/cookie.ts`

No dedicated test (pure config consumed by middleware + routes; exercised in E2E). Keep it tiny.

- [ ] **Step 1: Write the implementation**

```ts
// src/lib/auth/cookie.ts
export const SESSION_COOKIE = 'coco_admin_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Options for the admin session cookie. `secure` is off in dev so http://localhost works. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: no new errors from `src/lib/auth/cookie.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/cookie.ts
git commit -m "feat: add admin session cookie config"
```

---

## Task 5: Supabase admin queries

**Files:**
- Create: `src/lib/admin/waitlist-admin.ts`

Covered by the data-flow E2E (Task 16). Pure async wrappers over the existing client.

- [ ] **Step 1: Write the implementation**

```ts
// src/lib/admin/waitlist-admin.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { WaitlistStatus } from './entry-input';

export interface WaitlistEntry {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  location: string;
  about: string;
  preferences: string | null;
  read_expectations: boolean;
  source: string | null;
  status: WaitlistStatus;
  notes: string | null;
}

/** All waitlist entries, newest first. */
export async function fetchWaitlistEntries(client: SupabaseClient): Promise<WaitlistEntry[]> {
  const { data, error } = await client
    .from('waitlist')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as WaitlistEntry[];
}

/** Update one entry's status and/or notes. */
export async function updateWaitlistEntry(
  client: SupabaseClient,
  id: string,
  patch: { status?: WaitlistStatus; notes?: string },
): Promise<void> {
  const { error } = await client.from('waitlist').update(patch).eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/waitlist-admin.ts
git commit -m "feat: add Supabase waitlist admin read/update helpers"
```

---

## Task 6: Database migration (status + notes)

**Files:**
- Create: `supabase/migrations/0002_waitlist_admin.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0002_waitlist_admin.sql
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
```

- [ ] **Step 2: Apply the migration**

Apply against the project's Supabase database using ONE of:
- Supabase MCP: `mcp__supabase__apply_migration` with name `waitlist_admin` and the SQL above, OR
- Supabase SQL editor: paste and run the SQL above, OR
- Supabase CLI: `supabase db push` (if the project is linked locally).

- [ ] **Step 3: Verify the columns exist**

Verify via `mcp__supabase__list_tables` (or the Supabase dashboard) that `public.waitlist` now has `status` (default `'new'`) and `notes`.
Expected: both columns present; `waitlist_status_check` constraint listed.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_waitlist_admin.sql
git commit -m "feat: add status and notes columns to waitlist table"
```

---

## Task 7: Admin layout

**Files:**
- Create: `src/layouts/AdminLayout.astro`

- [ ] **Step 1: Write the layout**

```astro
---
// src/layouts/AdminLayout.astro
import '../styles/global.css';
interface Props { title: string; }
const { title } = Astro.props;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <title>{title}</title>
  </head>
  <body class="admin-body">
    <slot />
    <style is:global>
      body.admin-body { background: var(--c-cream); color: var(--c-charcoal); margin: 0; }
    </style>
  </body>
</html>
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/layouts/AdminLayout.astro
git commit -m "feat: add minimal noindex admin layout"
```

---

## Task 8: Auth middleware

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Write the middleware**

```ts
// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';
import { verifySessionToken } from './lib/auth/session';
import { SESSION_COOKIE } from './lib/auth/cookie';

// Reachable without a session: the login screen and its POST handler.
const PUBLIC_ADMIN_PATHS = new Set(['/admin/login', '/api/admin/login']);

function isAdminPath(pathname: string): boolean {
  return (
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname.startsWith('/api/admin')
  );
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  if (!isAdminPath(pathname) || PUBLIC_ADMIN_PATHS.has(pathname)) {
    return next();
  }

  const secret = import.meta.env.ADMIN_SESSION_SECRET ?? '';
  const token = context.cookies.get(SESSION_COOKIE)?.value;
  if (verifySessionToken(token, secret, Date.now())) {
    return next();
  }

  if (pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return context.redirect('/admin/login');
});
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: guard admin routes with session middleware"
```

---

## Task 9: Login API route

**Files:**
- Create: `src/pages/api/admin/login.ts`

- [ ] **Step 1: Write the route**

```ts
// src/pages/api/admin/login.ts
export const prerender = false;
import type { APIRoute } from 'astro';
import { verifyPassword } from '../../../lib/auth/password';
import { createSessionToken } from '../../../lib/auth/session';
import { SESSION_COOKIE, SESSION_TTL_MS, sessionCookieOptions } from '../../../lib/auth/cookie';

const FAIL_DELAY_MS = 600; // small fixed delay blunts password guessing
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const password = String(form.get('password') ?? '');
  const expected = import.meta.env.ADMIN_PASSWORD ?? '';
  const secret = import.meta.env.ADMIN_SESSION_SECRET ?? '';

  if (!verifyPassword(password, expected)) {
    await delay(FAIL_DELAY_MS);
    return redirect('/admin/login?error=1');
  }

  const token = createSessionToken(secret, Date.now(), SESSION_TTL_MS);
  cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return redirect('/admin');
};
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/admin/login.ts
git commit -m "feat: add admin login API route"
```

---

## Task 10: Logout API route

**Files:**
- Create: `src/pages/api/admin/logout.ts`

- [ ] **Step 1: Write the route**

```ts
// src/pages/api/admin/logout.ts
export const prerender = false;
import type { APIRoute } from 'astro';
import { SESSION_COOKIE } from '../../../lib/auth/cookie';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete(SESSION_COOKIE, { path: '/' });
  return redirect('/admin/login');
};
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/admin/logout.ts
git commit -m "feat: add admin logout API route"
```

---

## Task 11: Login page

**Files:**
- Create: `src/pages/admin/login.astro`

- [ ] **Step 1: Write the page**

```astro
---
// src/pages/admin/login.astro
export const prerender = false;
import AdminLayout from '../../layouts/AdminLayout.astro';
const hasError = Astro.url.searchParams.has('error');
---
<AdminLayout title="Admin · Coco's Puppy Tales">
  <main class="login">
    <h1>🐾 Admin</h1>
    <form method="POST" action="/api/admin/login">
      <label for="pw">Password</label>
      <input id="pw" name="password" type="password" required autocomplete="current-password" autofocus />
      {hasError && <p class="err" role="alert">Incorrect password. Try again.</p>}
      <button type="submit">Log in</button>
    </form>
  </main>
  <style>
    .login { max-width: 360px; margin: 12vh auto; padding: 2rem; display: grid; gap: 1rem; }
    h1 { margin: 0; }
    form { display: grid; gap: 0.75rem; }
    label { font-weight: 700; }
    input { padding: 0.6rem 0.8rem; border-radius: 10px; border: 2px solid rgba(43,41,38,0.2); font: inherit; }
    input:focus { outline: none; border-color: var(--c-navy); }
    button { background: var(--c-navy); color: #fff; border: 0; border-radius: 999px; padding: 0.6rem 1.2rem; font: inherit; font-weight: 800; cursor: pointer; }
    .err { color: var(--c-brown); font-weight: 700; margin: 0; }
  </style>
</AdminLayout>
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/login.astro
git commit -m "feat: add admin login page"
```

---

## Task 12: Entry update API route

**Files:**
- Create: `src/pages/api/admin/entry.ts`

- [ ] **Step 1: Write the route**

```ts
// src/pages/api/admin/entry.ts
export const prerender = false;
import type { APIRoute } from 'astro';
import { parseEntryUpdate } from '../../../lib/admin/entry-input';
import { updateWaitlistEntry } from '../../../lib/admin/waitlist-admin';
import { getSupabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const raw = Object.fromEntries(form.entries());
  const parsed = parseEntryUpdate(raw);
  const wantsJson = (request.headers.get('accept') ?? '').includes('application/json');

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Invalid update.';
    return wantsJson ? json({ ok: false, error: msg }, 400) : redirect('/admin');
  }

  const { id, status, notes } = parsed.data;
  const patch: { status?: typeof status; notes?: string } = {};
  if (status !== undefined) patch.status = status;
  if (notes !== undefined) patch.notes = notes;

  try {
    await updateWaitlistEntry(getSupabase(), id, patch);
  } catch {
    return wantsJson ? json({ ok: false, error: 'Could not save changes.' }, 502) : redirect('/admin');
  }

  return wantsJson ? json({ ok: true, message: 'Saved' }, 200) : redirect('/admin');
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/admin/entry.ts
git commit -m "feat: add admin entry status/notes update route"
```

---

## Task 13: Waitlist row component

**Files:**
- Create: `src/components/admin/WaitlistRow.astro`

- [ ] **Step 1: Write the component**

```astro
---
// src/components/admin/WaitlistRow.astro
import type { WaitlistEntry } from '../../lib/admin/waitlist-admin';
import { WAITLIST_STATUSES } from '../../lib/admin/entry-input';
interface Props { entry: WaitlistEntry; }
const { entry } = Astro.props;
const created = new Date(entry.created_at).toLocaleDateString();
---
<tr>
  <td class="who">
    <strong>{entry.name}</strong><br />
    <a href={`mailto:${entry.email}`}>{entry.email}</a>
    {entry.phone && <><br />{entry.phone}</>}
    <div class="meta">{entry.location} · {created}{entry.source && <> · via {entry.source}</>}</div>
  </td>
  <td class="about">
    <p>{entry.about}</p>
    {entry.preferences && <p class="prefs"><em>Prefs:</em> {entry.preferences}</p>}
    <p class="read">{entry.read_expectations ? '✅ Read expectations' : '⚠️ Did not confirm expectations'}</p>
  </td>
  <td class="manage">
    <form class="entry-form" method="POST" action="/api/admin/entry">
      <input type="hidden" name="id" value={entry.id} />
      <label>Status
        <select name="status">
          {WAITLIST_STATUSES.map((s) => <option value={s} selected={s === entry.status}>{s}</option>)}
        </select>
      </label>
      <label>Notes
        <textarea name="notes" rows="3">{entry.notes ?? ''}</textarea>
      </label>
      <button type="submit">Save</button>
      <span class="saved" role="status" aria-live="polite"></span>
    </form>
  </td>
</tr>
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/WaitlistRow.astro
git commit -m "feat: add admin waitlist row component"
```

---

## Task 14: Waitlist table component (+ inline-save enhancement)

**Files:**
- Create: `src/components/admin/WaitlistTable.astro`

- [ ] **Step 1: Write the component**

```astro
---
// src/components/admin/WaitlistTable.astro
import type { WaitlistEntry } from '../../lib/admin/waitlist-admin';
import WaitlistRow from './WaitlistRow.astro';
interface Props { entries: WaitlistEntry[]; }
const { entries } = Astro.props;
---
{entries.length === 0 ? (
  <p class="empty">No waitlist entries yet. 🐾</p>
) : (
  <table class="wl">
    <thead><tr><th>Family</th><th>About</th><th>Manage</th></tr></thead>
    <tbody>
      {entries.map((entry) => <WaitlistRow entry={entry} />)}
    </tbody>
  </table>
)}

<script>
  // Progressive enhancement: save each row inline without a full-page reload.
  document.querySelectorAll<HTMLFormElement>('form.entry-form').forEach((form) => {
    const saved = form.querySelector<HTMLElement>('.saved');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (saved) { saved.textContent = 'Saving…'; saved.style.color = 'var(--c-navy)'; }
      try {
        const res = await fetch('/api/admin/entry', {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new FormData(form),
        });
        const data = await res.json();
        if (saved) {
          saved.textContent = data.ok ? 'Saved ✓' : (data.error ?? 'Error');
          saved.style.color = data.ok ? 'var(--c-sage)' : 'var(--c-brown)';
        }
      } catch {
        if (saved) { saved.textContent = 'Error'; saved.style.color = 'var(--c-brown)'; }
      }
    });
  });
</script>

<style>
  .wl { width: 100%; border-collapse: collapse; }
  .wl th, .wl td { text-align: left; vertical-align: top; padding: 0.75rem; border-bottom: 1px solid rgba(43,41,38,0.12); }
  .meta { font-size: 0.8rem; opacity: 0.7; margin-top: 0.25rem; }
  .about p { margin: 0 0 0.4rem; }
  .prefs, .read { font-size: 0.85rem; }
  .entry-form { display: grid; gap: 0.4rem; min-width: 220px; }
  .entry-form label { font-weight: 700; font-size: 0.85rem; display: grid; gap: 0.2rem; }
  .entry-form select, .entry-form textarea { font: inherit; padding: 0.4rem; border-radius: 8px; border: 2px solid rgba(43,41,38,0.2); }
  .entry-form button { background: var(--c-honey); color: var(--c-charcoal); border: 0; border-radius: 999px; padding: 0.4rem 1rem; font-weight: 800; cursor: pointer; }
  .saved { font-weight: 700; font-size: 0.85rem; min-height: 1.1em; }
  .empty { font-weight: 700; }
  @media (max-width: 800px) {
    .wl, .wl thead, .wl tbody, .wl tr, .wl th, .wl td { display: block; }
    .wl thead { display: none; }
    .wl tr { border: 2px solid rgba(43,41,38,0.12); border-radius: 12px; margin-bottom: 1rem; padding: 0.5rem; }
  }
</style>
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/WaitlistTable.astro
git commit -m "feat: add admin waitlist table with inline save"
```

---

## Task 15: Dashboard page

**Files:**
- Create: `src/pages/admin/index.astro`

- [ ] **Step 1: Write the page**

```astro
---
// src/pages/admin/index.astro
export const prerender = false;
import AdminLayout from '../../layouts/AdminLayout.astro';
import WaitlistTable from '../../components/admin/WaitlistTable.astro';
import { getSupabase } from '../../lib/supabase';
import { fetchWaitlistEntries, type WaitlistEntry } from '../../lib/admin/waitlist-admin';

let entries: WaitlistEntry[] = [];
let loadError = false;
try {
  entries = await fetchWaitlistEntries(getSupabase());
} catch {
  loadError = true;
}
---
<AdminLayout title="Waitlist · Admin">
  <main class="dash">
    <header class="bar">
      <h1>Waitlist <span class="count">{entries.length}</span></h1>
      <form method="POST" action="/api/admin/logout"><button type="submit">Log out</button></form>
    </header>
    {loadError
      ? <p class="err">Couldn't load the waitlist. Check the Supabase configuration and try again.</p>
      : <WaitlistTable entries={entries} />}
  </main>
  <style>
    .dash { max-width: 1100px; margin: 0 auto; padding: 1.5rem; }
    .bar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
    .bar h1 { margin: 0; }
    .count { background: var(--c-sage); color: #fff; border-radius: 999px; padding: 0.1rem 0.6rem; font-size: 1rem; vertical-align: middle; }
    .bar button { background: transparent; border: 2px solid var(--c-navy); color: var(--c-navy); border-radius: 999px; padding: 0.4rem 1rem; font: inherit; font-weight: 800; cursor: pointer; }
    .err { color: var(--c-brown); font-weight: 700; }
  </style>
</AdminLayout>
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/index.astro
git commit -m "feat: add admin waitlist dashboard page"
```

---

## Task 16: Config & hygiene (env, robots, sitemap)

**Files:**
- Modify: `.env.example`
- Modify: `public/robots.txt`
- Modify: `astro.config.mjs`

- [ ] **Step 1: Add env keys to `.env.example`**

Append these lines to `.env.example`:

```
# Admin gate for /admin waitlist view (server-side only — never expose to the client)
ADMIN_PASSWORD=choose-a-long-random-password
ADMIN_SESSION_SECRET=choose-a-long-random-hex-string
```

- [ ] **Step 2: Disallow `/admin` in `public/robots.txt`**

Replace the file contents with:

```
User-agent: *
Allow: /
Disallow: /admin
Sitemap: https://cocospuppynursery.com/sitemap-index.xml
```

- [ ] **Step 3: Exclude `/admin` from the sitemap**

In `astro.config.mjs`, change the integrations line from:

```js
  integrations: [sitemap()],
```

to:

```js
  integrations: [sitemap({ filter: (page) => !page.includes('/admin') })],
```

- [ ] **Step 4: Type-check / build sanity**

Run: `npm run check`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add .env.example public/robots.txt astro.config.mjs
git commit -m "chore: add admin env keys, robots disallow, sitemap exclude"
```

---

## Task 17: Configure local + Vercel env vars

**Files:** none (environment configuration).

- [ ] **Step 1: Generate strong secrets**

Run: `node -e "console.log('ADMIN_PASSWORD=' + require('crypto').randomBytes(18).toString('base64url')); console.log('ADMIN_SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"`
Expected: two lines you can paste into `.env`.

- [ ] **Step 2: Add to local `.env`**

Add both lines to the project `.env` (gitignored). Confirm the existing `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are also present so the dashboard can load entries locally.

- [ ] **Step 3: Add to Vercel**

Add `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` to the Vercel project's Environment Variables (Production + Preview). If the Vercel CLI is installed: `vercel env add ADMIN_PASSWORD` and `vercel env add ADMIN_SESSION_SECRET`. Otherwise add them in the Vercel dashboard. (No commit — secrets are not stored in git.)

---

## Task 18: E2E — auth flow (no Supabase required)

**Files:**
- Modify: `playwright.config.ts`
- Create: `test/e2e/admin.spec.ts`

- [ ] **Step 1: Inject test admin secrets into the Playwright dev server**

In `playwright.config.ts`, add an `env` block to `webServer` so the dev server has deterministic admin credentials. Change:

```ts
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
```

to:

```ts
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? 'test-admin-password',
      ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET ?? 'test-session-secret-please-change',
    },
  },
```

- [ ] **Step 2: Write the auth-flow E2E test**

```ts
// test/e2e/admin.spec.ts
import { test, expect } from '@playwright/test';

const PASSWORD = process.env.ADMIN_PASSWORD ?? 'test-admin-password';

test('unauthenticated /admin redirects to login', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByLabel('Password')).toBeVisible();
});

test('wrong password shows an error', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Password').fill('definitely-wrong');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/admin\/login\?error/);
  await expect(page.getByRole('alert')).toBeVisible();
});

test('correct password logs in; logout returns to login', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  // Dashboard renders even if Supabase isn't configured (shows entries or a load error).
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
});
```

- [ ] **Step 3: Run the auth-flow tests**

Run: `npx playwright test test/e2e/admin.spec.ts`
Expected: 3 tests PASS. (If browsers are missing: `npx playwright install` first.)

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts test/e2e/admin.spec.ts
git commit -m "test: e2e admin auth flow (login, error, logout)"
```

---

## Task 19: E2E — data flow (opt-in, requires Supabase)

**Files:**
- Modify: `test/e2e/admin.spec.ts`

This test seeds a row via the public waitlist API, then edits it as admin. It needs real Supabase credentials in the dev server's env, so it is skipped unless `E2E_SUPABASE=1`.

- [ ] **Step 1: Append the guarded data-flow test**

Add to the end of `test/e2e/admin.spec.ts`:

```ts
const RUN_DATA_E2E = process.env.E2E_SUPABASE === '1';

test.describe('admin data flow (requires Supabase)', () => {
  test.skip(!RUN_DATA_E2E, 'Set E2E_SUPABASE=1 with real Supabase env to run.');

  test('status and notes persist across reload', async ({ page, request }) => {
    // Seed a uniquely named entry through the public waitlist API.
    const tag = `e2e-${Date.now()}`;
    const res = await request.post('/api/waitlist', {
      form: {
        name: tag,
        email: `${tag}@example.com`,
        location: 'Testville, TS',
        about: 'E2E seed entry.',
        read_expectations: 'on',
        website: '',
      },
    });
    expect(res.ok()).toBeTruthy();

    // Log in.
    await page.goto('/admin/login');
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // Edit the seeded row.
    const row = page.locator('tr', { hasText: tag });
    await row.locator('select[name="status"]').selectOption('approved');
    await row.locator('textarea[name="notes"]').fill('Lovely family.');
    await row.getByRole('button', { name: 'Save' }).click();
    await expect(row.locator('.saved')).toHaveText(/Saved/);

    // Reload and confirm persistence.
    await page.reload();
    const row2 = page.locator('tr', { hasText: tag });
    await expect(row2.locator('select[name="status"]')).toHaveValue('approved');
    await expect(row2.locator('textarea[name="notes"]')).toHaveValue('Lovely family.');
  });
});
```

- [ ] **Step 2: Run it (opt-in)**

Run: `E2E_SUPABASE=1 npx playwright test test/e2e/admin.spec.ts`
Expected: the data-flow test PASSES against the real Supabase project (the 3 auth tests still pass). Without `E2E_SUPABASE=1` it is skipped.

- [ ] **Step 3: Commit**

```bash
git add test/e2e/admin.spec.ts
git commit -m "test: opt-in e2e for admin status/notes persistence"
```

---

## Task 20: Full verification

**Files:** none.

- [ ] **Step 1: Type-check the whole project**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 2: Run all unit tests**

Run: `npm test`
Expected: all suites pass, including the new `test/admin/*` suites and existing `waitlist`/`subscribe`/`countdown` tests.

- [ ] **Step 3: Run the auth E2E**

Run: `npx playwright test test/e2e/admin.spec.ts`
Expected: 3 auth tests pass; data-flow test skipped (unless `E2E_SUPABASE=1`).

- [ ] **Step 4: Run the existing smoke E2E to confirm no regressions**

Run: `npx playwright test test/e2e/smoke.spec.ts`
Expected: existing smoke tests still pass (the public site is unaffected).

- [ ] **Step 5: Manual sanity (optional, local)**

With `.env` populated (incl. Supabase + admin secrets): `npm run dev`, visit `/admin`, log in, change a status, add a note, reload — values persist. Visit `/` and confirm the public site and waitlist form still behave normally.

---

## Spec Coverage Check

- §1 view + status + notes, gated, reusable gate → Tasks 6, 8, 12–15.
- §2 shared password / middleware+cookie / status values / service-role writes → Tasks 1–5, 8, 9.
- §3 `status` (default `new`, CHECK) + `notes`, RLS unchanged → Task 6.
- §4 env vars, login (constant-time + delay), signed httpOnly/secure/lax cookie ~30d, logout, middleware guard (redirect / 401), focused modules → Tasks 2–4, 8–10, 17.
- §5 admin pages SSR + noindex, login + dashboard, status dropdown + notes, logout, progressive-enhancement inline save → Tasks 7, 9–15.
- §6 robots disallow, sitemap exclude, noindex, brute-force defenses, secrets server-side, zod validation → Tasks 1, 7, 12, 16.
- §7 unit (session/password/entry-input), middleware redirect/401, login right/wrong, entry rejects bad input, E2E full flow → Tasks 1–3, 18, 19.
