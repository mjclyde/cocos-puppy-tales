# Coco's Puppy Nursery — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a polished, public launch site for Coco's litter — countdown, Coco's story, weekly journey updates, breed info, a Supabase-backed waitlist, an on-brand newsletter subscribe, and a photo gallery — deployable to Vercel.

**Architecture:** Static-first Astro site on Vercel. Pages prerender to HTML; the countdown is a client island; user-submitted data flows through two on-demand API endpoints (`prerender = false`) — waitlist → Supabase, subscribe → Buttondown. Content (Coco bio, journey, breed, site config) lives in typed Astro content collections that the developer edits and pushes.

**Tech Stack:** Astro 6 (`npm create astro` resolved 6.4.x as current stable), `@astrojs/vercel`, `@astrojs/sitemap`, `@fontsource/nunito`, `@supabase/supabase-js`, `zod` (v4), Vitest (unit), Playwright (smoke). Verified the content-collection and on-demand-endpoint APIs carry from Astro 5 → 6.

**Spec:** `docs/superpowers/specs/2026-06-03-coco-puppy-nursery-design.md`

---

## File Structure

```
src/
  content.config.ts            # collection schemas (coco, journey, breed, site)
  content/
    coco/coco.md               # Coco bio (single entry)
    breed/about.md             # Bernese info + expectations
    journey/week-06.md         # one file per weekly update
    site/config.json           # dueDate, social links, contact, flags
  lib/
    countdown.ts               # pure getCountdown(due, now)
    waitlist.ts                # zod waitlistSchema + parseWaitlist()
    subscribe.ts               # buildSubscribePayload() + validateEmail()
    supabase.ts                # lazy server-side Supabase client
  components/
    Nav.astro  Footer.astro  Hero.astro
    CountdownTimer.astro       # island (bundled <script>)
    UpdateCard.astro  GalleryGrid.astro
    WaitlistForm.astro  SubscribeForm.astro
  layouts/
    BaseLayout.astro           # <head>/SEO/OG, Nav, Footer, global styles
  styles/
    tokens.css  global.css     # palette variables + base styles
  pages/
    index.astro  coco.astro  journey.astro  breed.astro  gallery.astro  waitlist.astro
    api/
      waitlist.ts  subscribe.ts
public/
  favicon.svg  og-default.jpg  robots.txt  (photos under public/photos/)
test/
  countdown.test.ts  waitlist.test.ts  subscribe.test.ts
  e2e/smoke.spec.ts
```

---

## Task 1: Scaffold project, adapters, tooling, git

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `.env.example`
- Note: `.gitignore` already exists in the repo root.

- [ ] **Step 1: Scaffold a minimal Astro project in the current directory**

Run (in the repo root `/Users/mjclyde/Oss/coco-puppy-tales`):
```bash
npm create astro@latest . -- --template minimal --no-install --no-git --typescript strict --yes
```
Expected: creates `src/`, `astro.config.mjs`, `package.json`, `tsconfig.json`. If it refuses because the directory is non-empty, answer to continue/merge (existing `docs/`, `.gitignore`, and `initial-idea-conversation.md` must be preserved).

- [ ] **Step 2: Install runtime + dev dependencies**

```bash
npm install @supabase/supabase-js zod @fontsource/nunito
npm install -D vitest @astrojs/check typescript
npx astro add vercel --yes
npx astro add sitemap --yes
```
Expected: `@astrojs/vercel` and `@astrojs/sitemap` added to `astro.config.mjs` and `package.json`.

- [ ] **Step 3: Write `astro.config.mjs`**

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://cocospuppynursery.com', // update to the real domain when known
  output: 'static',                       // pages prerender; endpoints opt out per-file
  adapter: vercel(),
  integrations: [sitemap()],
});
```

- [ ] **Step 4: Write `vitest.config.ts`**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 5: Add scripts to `package.json`**

Ensure the `scripts` block contains:
```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 6: Write `.env.example`**

```bash
# Supabase (server-side only — never expose the service role key to the client)
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# Buttondown newsletter
BUTTONDOWN_API_KEY=your-buttondown-api-key
```

- [ ] **Step 7: Initialize git and make the first commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Astro project with Vercel, sitemap, Vitest"
```
Expected: a clean initial commit; `.gitignore` keeps `node_modules/`, `.env`, `dist/`, `.superpowers/` out.

- [ ] **Step 8: Verify the dev server boots**

Run: `npm run build`
Expected: build succeeds (an empty/minimal site builds without error).

---

## Task 2: Design tokens & global styles

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/global.css`

- [ ] **Step 1: Write `src/styles/tokens.css`** (the locked palette as variables)

```css
:root {
  /* Bernese palette (spec §7) */
  --c-charcoal: #2b2926;
  --c-brown:    #a86b43;
  --c-cream:    #f7efe1;
  --c-sage:     #6f8f5e;
  --c-navy:     #2f4156;
  --c-honey:    #e9b949;

  /* Roles — lean on cream/charcoal/navy; brown/sage/honey are accents */
  --bg:         var(--c-cream);
  --text:       var(--c-charcoal);
  --heading:    var(--c-navy);
  --accent:     var(--c-sage);
  --accent-2:   var(--c-brown);
  --pop:        var(--c-honey);

  --font-body: 'Nunito', system-ui, -apple-system, sans-serif;
  --radius: 16px;
  --radius-pill: 999px;
  --shadow: 0 4px 18px rgba(43, 41, 38, 0.10);
  --shadow-lg: 0 10px 28px rgba(43, 41, 38, 0.16);
  --maxw: 1100px;
  --space: 1rem;
}
```

- [ ] **Step 2: Write `src/styles/global.css`** (imports tokens + font, base styles)

```css
@import '@fontsource/nunito/400.css';
@import '@fontsource/nunito/700.css';
@import '@fontsource/nunito/900.css';
@import './tokens.css';

*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  font-family: var(--font-body);
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  font-weight: 400;
}
h1, h2, h3 { color: var(--heading); font-weight: 900; line-height: 1.1; margin: 0 0 0.5em; }
a { color: var(--c-navy); }
img { max-width: 100%; display: block; }
.container { max-width: var(--maxw); margin: 0 auto; padding: 0 1.25rem; }
.section { padding: 3rem 0; }
.btn {
  display: inline-flex; align-items: center; gap: 0.5rem;
  background: var(--pop); color: var(--c-charcoal);
  font-weight: 900; text-decoration: none;
  padding: 0.7rem 1.4rem; border-radius: var(--radius-pill);
  border: none; cursor: pointer; transition: transform 0.12s, filter 0.12s;
}
.btn:hover { transform: translateY(-2px); filter: brightness(1.03); }
.btn-secondary { background: var(--c-navy); color: var(--c-cream); }
.chip {
  display: inline-flex; align-items: center; gap: 0.4rem;
  background: var(--c-sage); color: #fff; font-weight: 700; font-size: 0.85rem;
  padding: 0.4rem 0.9rem; border-radius: var(--radius-pill);
}
.card { background: #fff; border-radius: var(--radius); box-shadow: var(--shadow); padding: 1.25rem; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/
git commit -m "feat: add design tokens and global styles"
```

---

## Task 3: Content collections schema + sample content

**Files:**
- Create: `src/content.config.ts`, `src/content/coco/coco.md`, `src/content/breed/about.md`, `src/content/journey/week-06.md`, `src/content/site/config.json`

- [ ] **Step 1: Write `src/content.config.ts`**

```ts
import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

const coco = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/coco' }),
  schema: ({ image }) => z.object({
    name: z.string(),
    breed: z.string(),
    heroImage: image(),
    personalityTraits: z.array(z.string()),
    healthFacts: z.array(z.string()).default([]),
    pedigree: z.string().optional(),
  }),
});

const journey = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/journey' }),
  schema: ({ image }) => z.object({
    week: z.number(),
    date: z.coerce.date(),
    title: z.string(),
    bellyPhoto: image().optional(),
    bellySizeComparison: z.string().optional(),
    published: z.boolean().default(true),
  }),
});

const breed = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/breed' }),
  schema: z.object({ title: z.string() }),
});

const site = defineCollection({
  loader: file('./src/content/site/config.json'),
  schema: z.object({
    dueDate: z.coerce.date(),
    litterEstimate: z.string(),
    contactEmail: z.string().email(),
    socialLinks: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
    flags: z.object({
      showGallery: z.boolean().default(true),
      showSubscribe: z.boolean().default(true),
    }).default({}),
  }),
});

export const collections = { coco, journey, breed, site };
```

- [ ] **Step 2: Add a placeholder Coco hero image**

Place any Bernese photo at `src/assets/coco-hero.jpg` (a real photo from the owner; a placeholder is fine during the build). Create the directory if needed.

- [ ] **Step 3: Write `src/content/coco/coco.md`**

```md
---
name: Coco
breed: Bernese Mountain Dog
heroImage: ../../assets/coco-hero.jpg
personalityTraits:
  - Loving
  - Playful
  - Goofy
healthFacts:
  - Health-tested per Bernese breed recommendations
  - Up to date on vaccinations
---

Coco is, objectively, the best dog in the world. She greets every morning like it's a
party, leans her whole body into hugs, and has never met a snack she didn't respect.
Now she's expecting her first litter — and we couldn't be more excited to share the journey.
```

- [ ] **Step 4: Write `src/content/breed/about.md`**

```md
---
title: About the Bernese Mountain Dog
---

## Gentle giants from the Swiss Alps

Bernese Mountain Dogs are big, affectionate, family-first dogs known for their striking
tricolor coats and calm, goofy charm.

## What owning a Berner is really like

- **Size & space:** They grow large (70–115 lbs). They need room and gentle exercise.
- **Shedding:** That gorgeous coat sheds. A lot. Regular grooming is a must.
- **People-oriented:** Berners want to be *with* you. They do not thrive left alone all day.
- **Health & lifespan:** A larger breed with a shorter lifespan; responsible health testing matters.

If that sounds like your kind of dog, we'd love to hear from you. 🐾
```

- [ ] **Step 5: Write `src/content/journey/week-06.md`**

```md
---
week: 6
date: 2026-06-01
title: "Week 6 — Belly's Growing!"
bellySizeComparison: "Watermelon 🍉"
published: true
---

The puppies can hear sounds now, and Coco is *loving* the extra snacks that come with
eating for six-plus. She's slowing down on walks and claiming the comfiest spot on every
couch. Not long now!
```

- [ ] **Step 6: Write `src/content/site/config.json`**

> Astro's `file()` loader requires an **array of entries each with an `id`** (or an object keyed by id), NOT a bare flat object. The single site-config entry therefore uses `id: "config"`, and downstream code retrieves it with `getEntry('site', 'config')`.

```json
[
  {
    "id": "config",
    "dueDate": "2026-06-22T00:00:00.000Z",
    "litterEstimate": "at least 5 puppies",
    "contactEmail": "hello@cocospuppynursery.com",
    "socialLinks": [],
    "flags": { "showGallery": true, "showSubscribe": true }
  }
]
```

- [ ] **Step 7: Verify content builds**

Run: `npm run build`
Expected: build succeeds; no schema validation errors. If `image()` errors because the asset is missing, add the placeholder from Step 2.

- [ ] **Step 8: Commit**

```bash
git add src/content.config.ts src/content/ src/assets/
git commit -m "feat: add content collections and sample content"
```

---

## Task 4: Countdown logic (TDD) + CountdownTimer island

**Files:**
- Create: `src/lib/countdown.ts`, `test/countdown.test.ts`, `src/components/CountdownTimer.astro`

- [ ] **Step 1: Write the failing test** — `test/countdown.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { getCountdown } from '../src/lib/countdown';

describe('getCountdown', () => {
  it('computes days/hours/minutes/seconds remaining', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    const due = new Date('2026-06-03T01:02:03Z'); // 2d 1h 2m 3s later
    expect(getCountdown(due, now)).toEqual({
      days: 2, hours: 1, minutes: 2, seconds: 3, isPast: false,
    });
  });

  it('flags isPast and zeroes out when the due date has passed', () => {
    const now = new Date('2026-06-25T00:00:00Z');
    const due = new Date('2026-06-22T00:00:00Z');
    expect(getCountdown(due, now)).toEqual({
      days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../src/lib/countdown`.

- [ ] **Step 3: Write `src/lib/countdown.ts`**

```ts
export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
}

export function getCountdown(due: Date, now: Date): Countdown {
  const diffMs = due.getTime() - now.getTime();
  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  }
  const total = Math.floor(diffMs / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    isPast: false,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS (2 tests).

- [ ] **Step 5: Write `src/components/CountdownTimer.astro`**

```astro
---
import { getCountdown } from '../lib/countdown';
interface Props { dueDate: Date; }
const { dueDate } = Astro.props;
const dueIso = dueDate.toISOString();
const initial = getCountdown(dueDate, new Date()); // build-time paint; client corrects on load
const units = [
  { key: 'days', label: 'days' },
  { key: 'hours', label: 'hrs' },
  { key: 'minutes', label: 'min' },
  { key: 'seconds', label: 'sec' },
] as const;
---
<div class="countdown" id="countdown" data-due={dueIso} aria-live="polite">
  {units.map((u) => (
    <div class="unit">
      <span class="num" data-unit={u.key}>{String(initial[u.key]).padStart(2, '0')}</span>
      <span class="lbl">{u.label}</span>
    </div>
  ))}
</div>

<script>
  import { getCountdown } from '../lib/countdown';
  const el = document.getElementById('countdown');
  if (el) {
    const due = new Date(el.dataset.due!);
    const tick = () => {
      const c = getCountdown(due, new Date());
      (['days','hours','minutes','seconds'] as const).forEach((k) => {
        const span = el.querySelector(`[data-unit="${k}"]`);
        if (span) span.textContent = String(c[k]).padStart(2, '0');
      });
      if (c.isPast) {
        el.classList.add('is-past');
        clearInterval(timer);
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
  }
</script>

<style>
  .countdown { display: flex; gap: 0.75rem; flex-wrap: wrap; }
  .unit {
    background: var(--c-navy); color: var(--c-cream);
    border-radius: var(--radius); padding: 0.75rem 1rem; min-width: 64px; text-align: center;
  }
  .num { display: block; font-size: 1.9rem; font-weight: 900; line-height: 1; }
  .lbl { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.85; }
  .is-past { opacity: 0.7; }
</style>
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/countdown.ts test/countdown.test.ts src/components/CountdownTimer.astro
git commit -m "feat: add countdown logic (TDD) and CountdownTimer island"
```

---

## Task 5: BaseLayout, Nav, Footer

**Files:**
- Create: `src/layouts/BaseLayout.astro`, `src/components/Nav.astro`, `src/components/Footer.astro`

- [ ] **Step 1: Write `src/components/Nav.astro`**

```astro
---
const links = [
  { href: '/', label: 'Home' },
  { href: '/coco', label: 'Meet Coco' },
  { href: '/journey', label: 'The Journey' },
  { href: '/breed', label: 'The Breed' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/waitlist', label: 'Waitlist' },
];
const path = Astro.url.pathname;
---
<nav class="nav">
  <div class="container nav-inner">
    <a href="/" class="brand">🐾 Coco's Puppy Nursery</a>
    <ul>
      {links.map((l) => (
        <li><a href={l.href} class={path === l.href ? 'active' : ''}>{l.label}</a></li>
      ))}
    </ul>
  </div>
</nav>
<style>
  .nav { background: var(--c-cream); border-bottom: 1px solid rgba(43,41,38,0.08); position: sticky; top: 0; z-index: 10; }
  .nav-inner { display: flex; align-items: center; justify-content: space-between; padding-top: 0.75rem; padding-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem; }
  .brand { font-weight: 900; color: var(--c-navy); text-decoration: none; font-size: 1.1rem; }
  ul { display: flex; gap: 1rem; list-style: none; margin: 0; padding: 0; flex-wrap: wrap; }
  a { color: var(--c-charcoal); text-decoration: none; font-weight: 700; font-size: 0.95rem; }
  a.active { color: var(--c-brown); }
  a:hover { color: var(--c-brown); }
</style>
```

- [ ] **Step 2: Write `src/components/Footer.astro`**

```astro
---
import { getEntry } from 'astro:content';
const site = await getEntry('site', 'config');
const { contactEmail, socialLinks } = site!.data;
---
<footer class="footer">
  <div class="container">
    <p>🐾 Coco's Puppy Nursery — following the journey from bump to homecoming.</p>
    <p>
      <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
      {socialLinks.map((s) => (<> · <a href={s.url}>{s.label}</a></>))}
    </p>
    <p class="fine">© {new Date().getFullYear()} Coco's Puppy Nursery.</p>
  </div>
</footer>
<style>
  .footer { background: var(--c-navy); color: var(--c-cream); margin-top: 3rem; padding: 2rem 0; }
  .footer a { color: var(--c-honey); }
  .fine { opacity: 0.7; font-size: 0.85rem; }
</style>
```

- [ ] **Step 3: Write `src/layouts/BaseLayout.astro`** (SEO/OG + global styles)

```astro
---
import '../styles/global.css';
import Nav from '../components/Nav.astro';
import Footer from '../components/Footer.astro';

interface Props {
  title: string;
  description?: string;
  ogImage?: string;
}
const {
  title,
  description = "Follow Coco the Bernese Mountain Dog from pregnancy to puppy homecoming.",
  ogImage = '/og-default.jpg',
} = Astro.props;
const canonical = new URL(Astro.url.pathname, Astro.site);
const ogUrl = new URL(ogImage, Astro.site);
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonical.href} />
    <meta property="og:type" content="website" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:image" content={ogUrl.href} />
    <meta property="og:url" content={canonical.href} />
    <meta name="twitter:card" content="summary_large_image" />
  </head>
  <body>
    <Nav />
    <main>
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: succeeds (layout + components compile; pages added in later tasks).

- [ ] **Step 5: Commit**

```bash
git add src/layouts/ src/components/Nav.astro src/components/Footer.astro
git commit -m "feat: add BaseLayout with SEO/OG, Nav, and Footer"
```

---

## Task 6: Hero component + Home page

**Files:**
- Create: `src/components/Hero.astro`, `src/pages/index.astro`
- Replace: any scaffolded `src/pages/index.astro` from Task 1.

- [ ] **Step 1: Write `src/components/Hero.astro`**

```astro
---
import { Image } from 'astro:assets';
import type { ImageMetadata } from 'astro';
interface Props { image: ImageMetadata; name: string; }
const { image, name } = Astro.props;
---
<section class="hero">
  <div class="container hero-grid">
    <div class="hero-copy">
      <span class="chip">🐾 Coco's litter</span>
      <h1>Coco's Puppy Nursery</h1>
      <p class="lede">Follow {name}'s journey from pregnancy to puppy homecoming. 💕</p>
      <div class="hero-cta">
        <a class="btn" href="/journey">Follow the journey →</a>
        <a class="btn btn-secondary" href="/waitlist">Join the waitlist</a>
      </div>
    </div>
    <Image src={image} alt={`${name}, our Bernese Mountain Dog`} class="hero-img" widths={[400, 800]} sizes="(max-width: 700px) 100vw, 480px" />
  </div>
</section>
<style>
  .hero { background: var(--c-cream); padding: 2.5rem 0; }
  .hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: center; }
  .hero-copy h1 { font-size: clamp(2rem, 5vw, 3.2rem); margin-top: 0.6rem; }
  .lede { font-size: 1.15rem; }
  .hero-cta { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1.25rem; }
  .hero-img { border-radius: var(--radius); box-shadow: var(--shadow-lg); width: 100%; height: auto; object-fit: cover; }
  @media (max-width: 700px) { .hero-grid { grid-template-columns: 1fr; } }
</style>
```

- [ ] **Step 2: Write `src/pages/index.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import Hero from '../components/Hero.astro';
import CountdownTimer from '../components/CountdownTimer.astro';
import SubscribeForm from '../components/SubscribeForm.astro';
import { getEntry } from 'astro:content';

const coco = await getEntry('coco', 'coco');
const site = await getEntry('site', 'config');
const { dueDate, litterEstimate, flags } = site!.data;
---
<BaseLayout title="Coco's Puppy Nursery">
  <Hero image={coco!.data.heroImage} name={coco!.data.name} />

  <section class="section countdown-section">
    <div class="container">
      <h2>Expected arrival</h2>
      <p>We're expecting {litterEstimate}! Here's the countdown:</p>
      <CountdownTimer dueDate={dueDate} />
    </div>
  </section>

  <section class="section">
    <div class="container teasers">
      <a class="card teaser" href="/journey"><h3>📅 The Journey</h3><p>Weekly bump updates and Coco's pregnancy diary.</p></a>
      <a class="card teaser" href="/coco"><h3>🐶 Meet Coco</h3><p>The best dog in the world. We may be biased.</p></a>
      <a class="card teaser" href="/waitlist"><h3>🧸 Waitlist</h3><p>Hoping to welcome a puppy? Start here.</p></a>
    </div>
  </section>

  {flags.showSubscribe && (
    <section class="section subscribe-section">
      <div class="container">
        <h2>Follow along</h2>
        <p>Want updates without joining the waitlist? Get an email when there's big news.</p>
        <SubscribeForm />
      </div>
    </section>
  )}
</BaseLayout>

<style>
  .teasers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
  .teaser { text-decoration: none; color: inherit; transition: transform 0.12s, box-shadow 0.12s; }
  .teaser:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); }
  .subscribe-section { background: #fff; }
  @media (max-width: 700px) { .teasers { grid-template-columns: 1fr; } }
</style>
```

> Note: `SubscribeForm` is created in Task 11 and `WaitlistForm`/pages later. If building strictly in order, temporarily comment out the `SubscribeForm` import/usage and restore it after Task 11. (Subagent-driven execution will surface this; that's expected.)

- [ ] **Step 3: Commit**

```bash
git add src/components/Hero.astro src/pages/index.astro
git commit -m "feat: add Hero and Home page with countdown and teasers"
```

---

## Task 7: Meet Coco page

**Files:**
- Create: `src/pages/coco.astro`

- [ ] **Step 1: Write `src/pages/coco.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { Image } from 'astro:assets';
import { getEntry, render } from 'astro:content';

const coco = await getEntry('coco', 'coco');
const { Content } = await render(coco!);
const { name, breed, heroImage, personalityTraits, healthFacts, pedigree } = coco!.data;
---
<BaseLayout title={`Meet ${name} — Coco's Puppy Nursery`} description={`Meet ${name}, our ${breed}.`}>
  <section class="section">
    <div class="container coco-grid">
      <Image src={heroImage} alt={`${name} the ${breed}`} class="coco-img" widths={[400, 800]} sizes="(max-width: 700px) 100vw, 420px" />
      <div>
        <span class="chip">{breed}</span>
        <h1>Meet {name}</h1>
        <div class="traits">
          {personalityTraits.map((t) => <span class="trait">{t}</span>)}
        </div>
        <div class="prose"><Content /></div>
        {healthFacts.length > 0 && (
          <>
            <h3>Health & pedigree</h3>
            <ul>{healthFacts.map((f) => <li>{f}</li>)}</ul>
            {pedigree && <p>{pedigree}</p>}
          </>
        )}
      </div>
    </div>
  </section>
</BaseLayout>

<style>
  .coco-grid { display: grid; grid-template-columns: 420px 1fr; gap: 2rem; align-items: start; }
  .coco-img { border-radius: var(--radius); box-shadow: var(--shadow-lg); width: 100%; height: auto; }
  .traits { display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 0.75rem 0; }
  .trait { background: var(--c-sage); color: #fff; border-radius: var(--radius-pill); padding: 0.3rem 0.8rem; font-weight: 700; font-size: 0.85rem; }
  @media (max-width: 700px) { .coco-grid { grid-template-columns: 1fr; } }
</style>
```

- [ ] **Step 2: Verify build & commit**

Run: `npm run build`
Expected: `/coco` builds.
```bash
git add src/pages/coco.astro
git commit -m "feat: add Meet Coco page"
```

---

## Task 8: Journey page + UpdateCard

**Files:**
- Create: `src/components/UpdateCard.astro`, `src/pages/journey.astro`

- [ ] **Step 1: Write `src/components/UpdateCard.astro`**

```astro
---
import { Image } from 'astro:assets';
import type { ImageMetadata } from 'astro';
interface Props {
  week: number;
  title: string;
  date: Date;
  bellySizeComparison?: string;
  bellyPhoto?: ImageMetadata;
}
const { week, title, date, bellySizeComparison, bellyPhoto } = Astro.props;
const dateStr = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
---
<article class="card update">
  {bellyPhoto && <Image src={bellyPhoto} alt={`Coco at week ${week}`} class="update-img" widths={[400, 800]} sizes="(max-width: 700px) 100vw, 320px" />}
  <div class="update-body">
    <div class="meta">
      <span class="chip">Week {week}</span>
      <span class="date">{dateStr}</span>
    </div>
    <h3>{title}</h3>
    {bellySizeComparison && <p class="belly">Belly size: <strong>{bellySizeComparison}</strong></p>}
    <div class="prose"><slot /></div>
  </div>
</article>
<style>
  .update { display: grid; grid-template-columns: 320px 1fr; gap: 1.25rem; align-items: start; margin-bottom: 1.5rem; }
  .update-img { border-radius: var(--radius); width: 100%; height: auto; object-fit: cover; }
  .meta { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.4rem; }
  .date { color: var(--c-brown); font-weight: 700; font-size: 0.9rem; }
  .belly { margin: 0.25rem 0 0.5rem; }
  @media (max-width: 700px) { .update { grid-template-columns: 1fr; } }
</style>
```

- [ ] **Step 2: Write `src/pages/journey.astro`** (newest-first, only published)

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import UpdateCard from '../components/UpdateCard.astro';
import { getCollection, render } from 'astro:content';

const updates = (await getCollection('journey', ({ data }) => data.published))
  .sort((a, b) => b.data.week - a.data.week);

const rendered = await Promise.all(updates.map(async (u) => ({
  data: u.data,
  Content: (await render(u)).Content,
})));
---
<BaseLayout title="The Journey — Coco's Puppy Nursery" description="Weekly pregnancy updates following Coco's journey.">
  <section class="section">
    <div class="container">
      <h1>The Journey</h1>
      <p>Weekly updates from Coco's pregnancy — newest first.</p>
      {rendered.length === 0 && <p>Updates are coming soon. 🐾</p>}
      {rendered.map(({ data, Content }) => (
        <UpdateCard week={data.week} title={data.title} date={data.date} bellySizeComparison={data.bellySizeComparison} bellyPhoto={data.bellyPhoto}>
          <Content />
        </UpdateCard>
      ))}
    </div>
  </section>
</BaseLayout>
```

- [ ] **Step 3: Verify build & commit**

Run: `npm run build`
Expected: `/journey` lists Week 6.
```bash
git add src/components/UpdateCard.astro src/pages/journey.astro
git commit -m "feat: add Journey page and UpdateCard"
```

---

## Task 9: Breed page

**Files:**
- Create: `src/pages/breed.astro`

- [ ] **Step 1: Write `src/pages/breed.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { getEntry, render } from 'astro:content';
const breed = await getEntry('breed', 'about');
const { Content } = await render(breed!);
---
<BaseLayout title="The Breed — Coco's Puppy Nursery" description="About Bernese Mountain Dogs and what to expect as an owner.">
  <section class="section">
    <div class="container prose-page">
      <Content />
      <p class="cta-line"><a class="btn" href="/waitlist">Sounds like your dog? Join the waitlist →</a></p>
    </div>
  </section>
</BaseLayout>
<style>
  .prose-page { max-width: 760px; }
  .cta-line { margin-top: 2rem; }
</style>
```

- [ ] **Step 2: Verify build & commit**

Run: `npm run build`
Expected: `/breed` renders the markdown.
```bash
git add src/pages/breed.astro
git commit -m "feat: add Breed page"
```

---

## Task 10: Gallery page + GalleryGrid

**Files:**
- Create: `src/components/GalleryGrid.astro`, `src/pages/gallery.astro`

- [ ] **Step 1: Write `src/components/GalleryGrid.astro`**

```astro
---
import { Image } from 'astro:assets';
import type { ImageMetadata } from 'astro';
interface Props { images: { src: ImageMetadata; alt: string }[]; }
const { images } = Astro.props;
---
<div class="grid">
  {images.map((img) => (
    <Image src={img.src} alt={img.alt} class="grid-img" widths={[300, 600]} sizes="(max-width: 700px) 50vw, 260px" />
  ))}
</div>
<style>
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem; }
  .grid-img { border-radius: var(--radius); width: 100%; height: 220px; object-fit: cover; box-shadow: var(--shadow); }
</style>
```

- [ ] **Step 2: Write `src/pages/gallery.astro`** (uses `import.meta.glob` so dropping photos in `src/assets/gallery/` auto-includes them)

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import GalleryGrid from '../components/GalleryGrid.astro';
import { getEntry } from 'astro:content';

const site = await getEntry('site', 'config');
const showGallery = site!.data.flags.showGallery;

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/gallery/*.{jpg,jpeg,png,webp}', { eager: true });
import type { ImageMetadata } from 'astro';
const images = Object.entries(files).map(([path, mod]) => ({
  src: mod.default,
  alt: 'Coco ' + path.split('/').pop()!.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
}));
---
<BaseLayout title="Gallery — Coco's Puppy Nursery" description="Photos of Coco.">
  <section class="section">
    <div class="container">
      <h1>Gallery</h1>
      {!showGallery && <p>The gallery is coming soon. 🐾</p>}
      {showGallery && images.length === 0 && <p>Photos coming soon. 🐾</p>}
      {showGallery && images.length > 0 && <GalleryGrid images={images} />}
    </div>
  </section>
</BaseLayout>
```

> Create the folder `src/assets/gallery/` and add at least one photo so the glob resolves. If empty, the page shows the "coming soon" message.

- [ ] **Step 3: Verify build & commit**

Run: `npm run build`
Expected: `/gallery` builds (with or without photos).
```bash
git add src/components/GalleryGrid.astro src/pages/gallery.astro
git commit -m "feat: add Gallery page and GalleryGrid"
```

---

## Task 11: Subscribe — logic (TDD), API route, form

**Files:**
- Create: `src/lib/subscribe.ts`, `test/subscribe.test.ts`, `src/pages/api/subscribe.ts`, `src/components/SubscribeForm.astro`

- [ ] **Step 1: Write the failing test** — `test/subscribe.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { isValidEmail, buildSubscribePayload } from '../src/lib/subscribe';

describe('subscribe helpers', () => {
  it('accepts a valid email', () => {
    expect(isValidEmail('fan@example.com')).toBe(true);
  });
  it('rejects an invalid email', () => {
    expect(isValidEmail('nope')).toBe(false);
  });
  it('builds the Buttondown payload', () => {
    expect(buildSubscribePayload('fan@example.com')).toEqual({
      email_address: 'fan@example.com',
      tags: ['coco-nursery'],
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../src/lib/subscribe`.

- [ ] **Step 3: Write `src/lib/subscribe.ts`**

```ts
import { z } from 'zod';

const emailSchema = z.string().email();

export function isValidEmail(value: string): boolean {
  return emailSchema.safeParse(value).success;
}

export interface SubscribePayload {
  email_address: string;
  tags: string[];
}

export function buildSubscribePayload(email: string): SubscribePayload {
  return { email_address: email, tags: ['coco-nursery'] };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS (3 tests).

- [ ] **Step 5: Write `src/pages/api/subscribe.ts`** (on-demand endpoint → Buttondown)

```ts
export const prerender = false;
import type { APIRoute } from 'astro';
import { isValidEmail, buildSubscribePayload } from '../../lib/subscribe';

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim();

  if (!isValidEmail(email)) {
    return json({ ok: false, error: 'Please enter a valid email.' }, 400);
  }

  const apiKey = import.meta.env.BUTTONDOWN_API_KEY;
  if (!apiKey) {
    return json({ ok: false, error: 'Subscriptions are temporarily unavailable.' }, 500);
  }

  const res = await fetch('https://api.buttondown.email/v1/subscribers', {
    method: 'POST',
    headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildSubscribePayload(email)),
  });

  // 201 created; 400 often means "already subscribed" — treat as success for UX.
  if (res.ok || res.status === 400) {
    return json({ ok: true, message: "You're on the list! 🐾" }, 200);
  }
  return json({ ok: false, error: 'Something went wrong. Please try again.' }, 502);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 6: Write `src/components/SubscribeForm.astro`** (progressive enhancement)

```astro
---
---
<form class="subscribe" id="subscribe-form" action="/api/subscribe" method="POST">
  <label class="visually-hidden" for="sub-email">Email address</label>
  <input id="sub-email" name="email" type="email" required placeholder="you@example.com" />
  <button class="btn" type="submit">Get updates</button>
  <p class="msg" id="sub-msg" role="status" aria-live="polite"></p>
</form>

<script>
  const form = document.getElementById('subscribe-form') as HTMLFormElement | null;
  const msg = document.getElementById('sub-msg');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!msg) return;
    msg.textContent = 'Subscribing…';
    const res = await fetch('/api/subscribe', { method: 'POST', body: new FormData(form) });
    const data = await res.json();
    msg.textContent = data.ok ? data.message : data.error;
    if (data.ok) form.reset();
  });
</script>

<style>
  .subscribe { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
  .subscribe input { padding: 0.7rem 1rem; border-radius: var(--radius-pill); border: 2px solid var(--c-navy); min-width: 240px; font: inherit; }
  .msg { width: 100%; margin: 0.5rem 0 0; font-weight: 700; color: var(--c-sage); }
</style>
```

- [ ] **Step 7: Restore the SubscribeForm usage on the Home page** (if commented out in Task 6), then build.

Run: `npm run build`
Expected: builds; `/api/subscribe` compiles as a Vercel function.

- [ ] **Step 8: Commit**

```bash
git add src/lib/subscribe.ts test/subscribe.test.ts src/pages/api/subscribe.ts src/components/SubscribeForm.astro src/pages/index.astro
git commit -m "feat: add subscribe logic (TDD), API route, and on-brand form"
```

---

## Task 12: Waitlist — validation (TDD), Supabase client, API route, form, page

**Files:**
- Create: `src/lib/waitlist.ts`, `test/waitlist.test.ts`, `src/lib/supabase.ts`, `src/pages/api/waitlist.ts`, `src/components/WaitlistForm.astro`, `src/pages/waitlist.astro`

- [ ] **Step 1: Write the failing test** — `test/waitlist.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { parseWaitlist } from '../src/lib/waitlist';

const valid = {
  name: 'Jordan Rivera',
  email: 'jordan@example.com',
  phone: '555-123-4567',
  location: 'Boise, ID',
  about: 'We have a fenced yard and work from home.',
  preferences: 'Female, any color',
  read_expectations: 'on',
  source: 'Instagram',
  website: '', // honeypot — must be empty
};

describe('parseWaitlist', () => {
  it('parses a valid submission and coerces the checkbox to boolean', () => {
    const result = parseWaitlist(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.read_expectations).toBe(true);
      expect(result.data.email).toBe('jordan@example.com');
    }
  });

  it('fails when required fields are missing', () => {
    const result = parseWaitlist({ ...valid, email: '', name: '' });
    expect(result.success).toBe(false);
  });

  it('fails when the honeypot is filled (spam)', () => {
    const result = parseWaitlist({ ...valid, website: 'http://spam.example' });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../src/lib/waitlist`.

- [ ] **Step 3: Write `src/lib/waitlist.ts`**

```ts
import { z } from 'zod';

const optionalText = (max: number) =>
  z.string().max(max).optional().or(z.literal(''));

export const waitlistSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('A valid email is required'),
  phone: optionalText(40),
  location: z.string().min(1, 'Location is required').max(120),
  about: z.string().min(1, 'Tell us a little about your home').max(2000),
  preferences: optionalText(500),
  read_expectations: z
    .union([z.literal('on'), z.literal('true'), z.boolean()])
    .transform((v) => v === true || v === 'on' || v === 'true'),
  source: optionalText(200),
  // Honeypot: real users never fill this; bots do. Must be empty.
  website: z.literal('').optional(),
});

export type WaitlistInput = z.infer<typeof waitlistSchema>;

export function parseWaitlist(data: unknown) {
  return waitlistSchema.safeParse(data);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS (3 tests).

- [ ] **Step 5: Write `src/lib/supabase.ts`** (lazy server-side client)

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.SUPABASE_URL;
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase env vars are not configured');
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
```

- [ ] **Step 6: Write `src/pages/api/waitlist.ts`**

```ts
export const prerender = false;
import type { APIRoute } from 'astro';
import { parseWaitlist } from '../../lib/waitlist';
import { getSupabase } from '../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const raw = Object.fromEntries(form.entries());
  const parsed = parseWaitlist(raw);

  if (!parsed.success) {
    // Honeypot or validation failure. If only the honeypot tripped, pretend success.
    if (typeof raw.website === 'string' && raw.website.length > 0) {
      return json({ ok: true, message: 'Thanks! We\'ll be in touch.' }, 200);
    }
    const firstError = parsed.error.issues[0]?.message ?? 'Please check your entries.';
    return json({ ok: false, error: firstError }, 400);
  }

  const { website, read_expectations, ...rest } = parsed.data;
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('waitlist').insert({ ...rest, read_expectations });
    if (error) throw error;
  } catch {
    return json({ ok: false, error: 'Could not save your entry. Please try again.' }, 502);
  }

  return json({ ok: true, message: "You're on the list — we'll be in touch! 🐾" }, 200);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 7: Write `src/components/WaitlistForm.astro`**

```astro
---
---
<form class="waitlist" id="waitlist-form" action="/api/waitlist" method="POST">
  <div class="field"><label for="wl-name">Your name *</label><input id="wl-name" name="name" required maxlength="100" /></div>
  <div class="field"><label for="wl-email">Email *</label><input id="wl-email" name="email" type="email" required /></div>
  <div class="field"><label for="wl-phone">Phone</label><input id="wl-phone" name="phone" type="tel" maxlength="40" /></div>
  <div class="field"><label for="wl-location">City & state *</label><input id="wl-location" name="location" required maxlength="120" /></div>
  <div class="field full"><label for="wl-about">Tell us about your home & family *</label><textarea id="wl-about" name="about" required maxlength="2000" rows="4"></textarea></div>
  <div class="field full"><label for="wl-prefs">Any preferences? (color / sex)</label><input id="wl-prefs" name="preferences" maxlength="500" /></div>
  <div class="field full"><label for="wl-source">How did you hear about Coco?</label><input id="wl-source" name="source" maxlength="200" /></div>
  <div class="field full check">
    <label><input type="checkbox" name="read_expectations" required /> I've read <a href="/breed">what owning a Bernese is like</a>. *</label>
  </div>
  <!-- Honeypot: hidden from humans -->
  <div class="hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off" /></label></div>
  <button class="btn" type="submit">Join the waitlist</button>
  <p class="msg" id="wl-msg" role="status" aria-live="polite"></p>
</form>

<script>
  const form = document.getElementById('waitlist-form') as HTMLFormElement | null;
  const msg = document.getElementById('wl-msg');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!msg) return;
    msg.textContent = 'Sending…';
    const res = await fetch('/api/waitlist', { method: 'POST', body: new FormData(form) });
    const data = await res.json();
    msg.textContent = data.ok ? data.message : data.error;
    msg.style.color = data.ok ? 'var(--c-sage)' : 'var(--c-brown)';
    if (data.ok) form.reset();
  });
</script>

<style>
  .waitlist { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; max-width: 720px; }
  .field { display: flex; flex-direction: column; gap: 0.3rem; }
  .field.full { grid-column: 1 / -1; }
  label { font-weight: 700; font-size: 0.9rem; }
  input, textarea { padding: 0.6rem 0.8rem; border-radius: 10px; border: 2px solid rgba(43,41,38,0.2); font: inherit; }
  input:focus, textarea:focus { outline: none; border-color: var(--c-navy); }
  .check label { font-weight: 400; }
  .hp { position: absolute; left: -9999px; }
  .msg { grid-column: 1 / -1; margin: 0; font-weight: 700; }
  @media (max-width: 600px) { .waitlist { grid-template-columns: 1fr; } }
</style>
```

- [ ] **Step 8: Write `src/pages/waitlist.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import WaitlistForm from '../components/WaitlistForm.astro';
---
<BaseLayout title="Waitlist — Coco's Puppy Nursery" description="Join the waitlist for one of Coco's puppies.">
  <section class="section">
    <div class="container">
      <h1>Join the waitlist</h1>
      <p>Hoping to welcome one of Coco's puppies? Tell us about your home. We read every submission and reach out personally — this isn't first-come, first-served.</p>
      <WaitlistForm />
    </div>
  </section>
</BaseLayout>
```

- [ ] **Step 9: Build & commit**

Run: `npm run build`
Expected: builds; `/api/waitlist` compiles as a Vercel function; `/waitlist` renders.
```bash
git add src/lib/waitlist.ts test/waitlist.test.ts src/lib/supabase.ts src/pages/api/waitlist.ts src/components/WaitlistForm.astro src/pages/waitlist.astro
git commit -m "feat: add waitlist validation (TDD), Supabase client, API route, form, and page"
```

---

## Task 13: Supabase `waitlist` table (SQL migration)

**Files:**
- Create: `supabase/migrations/0001_waitlist.sql` (documentation + runnable SQL)

- [ ] **Step 1: Write `supabase/migrations/0001_waitlist.sql`**

```sql
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
```

- [ ] **Step 2: Apply it**

In the Supabase dashboard → SQL Editor, paste and run the migration. Confirm the `waitlist` table exists with RLS enabled and no public policies.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0001_waitlist.sql
git commit -m "chore: add Supabase waitlist table migration"
```

---

## Task 14: Favicon, OG image, robots

**Files:**
- Create: `public/favicon.svg`, `public/robots.txt`
- Add: `public/og-default.jpg`

- [ ] **Step 1: Write `public/favicon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#2f4156"/>
  <text x="32" y="44" font-size="36" text-anchor="middle">🐾</text>
</svg>
```

- [ ] **Step 2: Write `public/robots.txt`**

```text
User-agent: *
Allow: /
Sitemap: https://cocospuppynursery.com/sitemap-index.xml
```

- [ ] **Step 3: Add a default Open Graph image**

Place a 1200×630 image of Coco at `public/og-default.jpg` (used by `BaseLayout` for social shares). A placeholder is acceptable until a real photo is ready.

- [ ] **Step 4: Build & commit**

Run: `npm run build`
Expected: `sitemap-index.xml` is generated by `@astrojs/sitemap`; favicon/robots present.
```bash
git add public/favicon.svg public/robots.txt public/og-default.jpg
git commit -m "feat: add favicon, robots, and default OG image"
```

---

## Task 15: E2E smoke test (Playwright)

**Files:**
- Create: `playwright.config.ts`, `test/e2e/smoke.spec.ts`

- [ ] **Step 1: Install Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Write `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

// NOTE: the @astrojs/vercel adapter does not support `astro preview` for
// on-demand routes, so we run the smoke tests against `astro dev`, which
// serves both static pages and the API endpoints. The smoke tests do not
// require real Supabase/Buttondown credentials (they only exercise the
// validation path, which returns before any external call).
export default defineConfig({
  testDir: './test/e2e',
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: { baseURL: 'http://localhost:4321' },
});
```

- [ ] **Step 3: Write `test/e2e/smoke.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('home page shows hero, countdown, and nav works', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: "Coco's Puppy Nursery" })).toBeVisible();
  await expect(page.locator('#countdown .num').first()).toBeVisible();
  await page.getByRole('link', { name: 'The Journey' }).first().click();
  await expect(page).toHaveURL(/\/journey/);
  await expect(page.getByRole('heading', { name: 'The Journey' })).toBeVisible();
});

test('waitlist form shows a validation error on empty submit', async ({ page }) => {
  await page.goto('/waitlist');
  // Bypass native required validation to exercise the server error path.
  await page.evaluate(() => {
    document.querySelectorAll('#waitlist-form [required]').forEach((el) => el.removeAttribute('required'));
  });
  await page.getByRole('button', { name: 'Join the waitlist' }).click();
  await expect(page.locator('#wl-msg')).not.toHaveText('', { timeout: 5000 });
});
```

> Note: the waitlist test exercises the server validation path; it needs the dev/preview server but not a live Supabase (validation fails before any DB call). Run with placeholder env vars.

- [ ] **Step 4: Add the e2e script to `package.json`**

```json
{ "scripts": { "test:e2e": "playwright test" } }
```

- [ ] **Step 5: Run the smoke tests**

Run: `npm run test:e2e`
Expected: both tests PASS.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts test/e2e/ package.json package-lock.json
git commit -m "test: add Playwright smoke tests for home and waitlist"
```

---

## Task 16: Deploy to Vercel

**Files:** none (deployment configuration)

- [ ] **Step 1: Push to a Git remote** (GitHub) and import the repo into Vercel, or run `npx vercel`.

- [ ] **Step 2: Set environment variables in the Vercel project settings**

```
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BUTTONDOWN_API_KEY
```
(Match `.env.example`. Service role key is server-only — never a `PUBLIC_` var.)

- [ ] **Step 3: Update `site` in `astro.config.mjs` and `robots.txt`** to the real production domain, then commit.

- [ ] **Step 4: Trigger a deploy and verify the live site**

Manually verify: home + countdown ticks, all nav pages load, waitlist submit writes a row in Supabase (check the table editor), subscribe adds a Buttondown subscriber, social-share preview shows the OG image.

- [ ] **Step 5: Final full check**

Run locally: `npm run check && npm test && npm run build`
Expected: type-check clean, all unit tests pass, build succeeds.

---

## Self-Review Notes (author)

- **Spec coverage:** Home+countdown (T6), Meet Coco (T7), Journey (T8), Breed (T9), Gallery (T10), Subscribe/newsletter (T11), Waitlist→Supabase (T12–T13), SEO/OG/sitemap/favicon (T5 head, T14, T1 sitemap), palette/visual identity (T2), content model (T3), non-functional: accessibility (labels, aria-live, alt text), perf (static + `<Image>`), privacy (RLS, no public reads), error handling (friendly form messages) — all mapped.
- **Deferred-by-spec items honored:** newsletter service chosen as Buttondown (spec §11 "leaning Buttondown"); honeypot spam protection included; hCaptcha intentionally left out of Phase 1.
- **Ordering caveat:** Home page (T6) references `SubscribeForm` (T11); the note in T6/T11 handles the temporary comment-out for strictly-ordered execution.
- **Type consistency:** `getCountdown`, `parseWaitlist`/`waitlistSchema`, `getSupabase`, `isValidEmail`/`buildSubscribePayload` names are consistent across tests, libs, and routes.
