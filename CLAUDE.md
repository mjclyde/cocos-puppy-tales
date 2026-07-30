# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Coco's Puppy Tales" — a static marketing/journey site for an upcoming dog litter, built with **Astro 6** and deployed to **Vercel**. It announces a due date, shows a photo gallery and pregnancy journey, and collects a puppy waitlist and an email subscriber list backed by **Supabase**. A password-gated `/admin` area views and exports the waitlist.

## Commands

```bash
npm run dev          # astro dev on http://localhost:4321
npm run build        # astro build (static output + Vercel adapter)
npm run preview      # astro preview (NOTE: cannot serve on-demand routes; see below)
npm run check        # astro check — type-check .astro/.ts (run before committing)

npm test             # vitest run — unit tests in test/**/*.test.ts
npm run test:watch   # vitest watch
npm run test:e2e     # playwright — boots its own `astro dev`, see test/e2e/

# Run a single unit test file / filter:
npx vitest run test/waitlist.test.ts
npx vitest run -t "honeypot"
```

Node >= 24.0.0 required.

## Architecture

### Static-by-default, opt-out endpoints
`output: "static"` in `astro.config.mjs` — every page prerenders at build time. Server-rendered routes (API handlers and dynamic pages) must declare `export const prerender = false;` as their **first line**. This is how the waitlist/subscribe/admin endpoints become real Vercel functions while the marketing pages stay static. The `@astrojs/vercel` adapter does **not** support `astro preview` for these on-demand routes — use `astro dev` (Playwright's `webServer` does this).

### Layered request handling
- `src/pages/api/**` — thin HTTP handlers. They parse `FormData`, delegate validation to a `src/lib` module, call Supabase, and return a JSON envelope `{ ok, error?, message? }`. Keep business logic out of the route; put it in `src/lib`.
- `src/lib/**` — pure, testable logic organized by domain (`auth/`, `admin/`, `newsletter/`, plus `waitlist.ts`, `subscribe.ts`, `countdown.ts`). Validation uses **Zod** schemas (`parseX` → `safeParse`). These modules are where the unit tests point.
- `src/middleware.ts` — gates all `/admin` and `/api/admin/` paths (except the login screen + its POST) behind a signed session cookie.

### Auth (custom, no library)
HMAC-signed stateless session tokens, not a third-party auth provider. `src/lib/auth/session.ts` signs `expiry.hmac(expiry)` with `ADMIN_SESSION_SECRET`; verification **fails closed** on an empty secret and uses `timingSafeEqual` on hex-decoded buffers. Login (`api/admin/login.ts`) checks `ADMIN_PASSWORD` with a fixed fail-delay to blunt guessing. Cookie config lives in `src/lib/auth/cookie.ts`.

### Supabase access
`src/lib/supabase.ts` lazily creates a **service-role** client (`getSupabase()`, memoized, `persistSession: false`). Tables (`waitlist`, `subscribers`) have **RLS enabled with no anon/authenticated policies** — only the server's service-role client can touch them (see `supabase/migrations/`). Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client; all DB access goes through server endpoints. Migrations are applied manually via the Supabase SQL editor / CLI (the `.sql` files are the source of truth).

### Content collections
`src/content.config.ts` defines Zod-validated collections: `coco`, `journey`, `breed` (markdown via `glob` loader) and `site` (a single `config.json` via `file` loader). Site-wide settings — due date, contact email, feature flags (`showGallery`, `showSubscribe`) — live in `src/content/site/config.json`, not in code. Reference content via `getCollection`/`getEntry`, not direct file reads.

### Newsletter unsubscribe
One-click unsubscribe uses signed tokens (`src/lib/newsletter/unsubscribe-token.ts`, secret `NEWSLETTER_UNSUBSCRIBE_SECRET`) so links work without auth. `/admin` and `/unsubscribe` are excluded from the sitemap (`astro.config.mjs` filter).

## Conventions

- **Honeypot anti-spam:** public forms include a `website` field that must be empty; if a bot fills it, the endpoint returns a fake success (see `api/waitlist.ts`). Preserve this pattern on new public forms.
- **JSON envelope:** API responses are always `{ ok: boolean, error?, message? }` with appropriate status codes (400 validation, 401 unauthorized, 502 upstream).
- **Immutability:** never mutate inputs; return new objects (global preference).
- **Secrets** are all server-side env vars (`import.meta.env.*`), enumerated in `.env.example`. There are no public/`PUBLIC_` Supabase keys by design.
- **Photos:** every photo lives at `src/assets/photos/<shoot>/<subject>/<subject>-NN.jpg`, where
  `<shoot>` is an ISO date (or `pre-litter`) and `<subject>` is a lowercase collar name, `group`,
  `coco`, or `first-days`. Cap the long edge at 2048px. Adding a shoot means adding a dated folder —
  `src/lib/photos/` picks it up, orders it newest-first, and fails the build on an unknown subject
  folder or a collar with no photos. The cast cards lead with the shoot named by `cardCoverShoot`
  in `src/content/site/config.json` (the rest stay newest-first); omit it for plain newest-first.

## Testing

- **Unit (vitest, node env):** `test/**/*.test.ts` mirror `src/lib/**`. Test the lib modules directly — token signing/expiry, validation, normalization, countdown math.
- **E2E (playwright):** `test/e2e/` boots its own `astro dev` and injects deterministic admin creds (`ADMIN_PASSWORD`/`ADMIN_SESSION_SECRET`) so smoke tests run without real Supabase/newsletter secrets.

## Planning docs

`docs/superpowers/specs/` and `docs/superpowers/plans/` hold the design specs and implementation plans for each feature phase (puppy nursery, admin waitlist view, self-hosted subscribers). Consult these for intent/history before reworking a feature.
