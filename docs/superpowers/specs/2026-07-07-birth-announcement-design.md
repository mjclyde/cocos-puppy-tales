# Birth Announcement — "Meet the Litter" — Design Spec

**Date:** 2026-07-07
**Status:** Approved (pending spec review)
**Author:** Brainstormed with Claude; design critiqued via the `impeccable` skill
**Roadmap:** Phase 2 ("At birth — introduce the pups") from `2026-06-03-coco-puppy-nursery-design.md`

---

## 1. Summary

Coco gave birth to **9 puppies on June 25, 2026** (early morning, a few days ahead of the June 27
due date). The site is currently built entirely around *anticipation* — a live countdown, "we're
expecting," weekly bump updates. This feature flips the site to celebrate the arrival:

1. **Homepage** — the stale "Expected arrival" countdown becomes a **"They're here!"** announcement
   banner with a live **days-old** counter and a link to the litter.
2. **New `/litter` page** — the shareable centerpiece: an announcement hero, a birth-story, a
   **"Meet the cast"** grid introducing all 9 pups by collar color, a photo gallery, and a waitlist CTA.
3. **Journey capstone** — a final **Week 8 "They're here!"** entry closes the pregnancy arc.

This is the "Meet the Litter" scope (a real, shareable moment) — **not** full individual puppy
profiles with reservation status (that remains a later phase). It reuses the existing content-collection,
component, and token patterns throughout.

## 2. Goals

- Turn the homepage from "counting down" to "they've arrived" automatically, with no stale UI.
- Give the litter one clean, shareable URL (`/litter`) that looks great when texted or posted.
- Introduce all 9 pups with personality via their **collar colors** — the litter's identity system —
  without committing to nine maintained profiles.
- Keep the pregnancy journey coherent by ending it on the birth.
- Land cleanly inside the existing design system (tokens, components, patterns) with high a11y.

## 3. Non-Goals (YAGNI)

- Individual puppy **profile pages** or a `puppies` collection with per-pup routes.
- **Reservation / "reserved vs available"** status tied to the waitlist (later phase).
- Growth/weight tracker, milestone timeline, puppy cam, voting (later phases).
- Sending the announcement **email from the app** — the subscriber system is send-manually by design
  (see `2026-06-05-self-hosted-subscribers-design.md`). Email copy is a drafted deliverable, not code.
- Any new admin UI.

## 4. Litter Facts (source data)

- **9 puppies**, born **early morning June 25, 2026**, a few days early. All healthy, classic Bernese
  tricolor, nursing well. Birth weights **14–20 oz**.
- **5 boys / 4 girls.** Each pup wears a distinct collar color used to tell them apart.

| Collar | Hex (swatch) | Sex | Personality note |
|---|---|---|---|
| Blue | `#3b6fd6` | boy | First born — led the way. |
| Black | `#2a2a2a` | boy | The dramatic one — growing fastest. |
| Brown | `#8a5a2b` | boy | Aka "Potato" — loves to sleep. |
| Yellow | `#e0b031` | boy | Has the most unique markings. |
| Orange | `#e8863b` | boy | First to open his eyes. |
| Pink | `#e58fb0` | girl | Coco's little mini-me. |
| Purple | `#7b4fc9` | girl | Last to arrive, worth the wait. |
| Red | `#d24a45` | girl | Sweet and small — nicknamed "Ruby." |
| Green | `#5a9e4f` | girl | Little, quiet & unbearably cute. |

> Collar hex values are chosen for legible swatches/borders on the cream palette; final values
> confirmed at implementation. `Yellow` is nudged darker than `--c-honey` so the two don't clash.

## 5. Architecture

### 5.1 New content collection: `litter`

A single markdown entry, mirroring `coco/coco.md`. Add to `src/content.config.ts`:

```ts
const litter = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/litter' }),
  schema: ({ image }) => z.object({
    bornDate: z.coerce.date(),
    count: z.number(),
    boys: z.number(),
    girls: z.number(),
    weightRange: z.string(),                 // e.g. "14–20 oz" — rendered in prose, not a stat card
    headline: z.string(),                    // hero H1, e.g. "Meet Coco's puppies"
    heroImage: image(),                      // Coco nursing the litter (group shot)
    motherPhoto: image().optional(),
    gallery: z.array(image()).default([]),   // "first few days" candids
    collars: z.array(z.object({
      name: z.string(),                      // "Blue"
      hex: z.string(),                       // "#3b6fd6"
      sex: z.enum(['boy', 'girl']),
      note: z.string().optional(),
      photo: image().optional(),
    })).default([]),
    published: z.boolean().default(true),
  }),
});
```

Content lives in `src/content/litter/litter.md`; the markdown **body is the birth story**. Adding/editing
the litter = edit one file + `git push`, consistent with the journey workflow.

### 5.2 Homepage flip (`src/pages/index.astro`)

Branch on the litter entry: `const litter = await getEntry('litter', 'litter')` (glob-loaded, so the id
derives from the `litter.md` filename — same pattern as `getEntry('coco', 'coco')`). If a **published**
`litter` entry exists, render the announcement; otherwise render the existing countdown section. This is
content-driven (no manual flag) and fully reversible.

- **Announcement banner** replaces the "Expected arrival" `<section>`: the `🎉 They're here!` chip, a
  headline, **"Born June 25"** promoted as a proud standalone element, the stat row
  (`9 · 5 boys · 4 girls`), the live **days-old** counter (§5.4), the hero photo, and a
  **"Meet the litter →"** button to `/litter`.
- The obsolete `litterEstimate` copy ("We're expecting at least 5 puppies!") is not shown once announced.
- Teaser cards: add a featured **"Meet the Litter"** card linking to `/litter` (first position).
- `CountdownTimer` and `getCountdown` stay in the repo (still used by the pre-birth branch + tested).

### 5.3 New page: `src/pages/litter.astro`

Static (prerendered). Sections top-to-bottom:

1. **Announcement hero** — `🎉 They're here!` chip · large H1 (`headline`, scaled to true hero size,
   `clamp(2rem, 5vw, 3rem)`) · **"Born June 25, 2026"** as a proud standalone element · live days-old
   counter · `heroImage` (Coco nursing) via `<Image>`.
2. **Stat band** — **three** count cards only: `9 puppies` (navy), `5 boys` (pastel blue `#a9c2df`),
   `4 girls` (pastel pink `#e7bccb`). Weight range lives in the birth story, not here.
3. **Birth story** — the markdown body (2 short paragraphs; warm, includes the 14–20 oz weights and
   "arrived a few days early").
4. **Meet the cast** — a responsive grid of 9 `PuppyCard`s (§5.5). One deliberate section, no eyebrow.
5. **Photo gallery** — reuse the existing **`GalleryGrid`** component with `gallery` + `motherPhoto`.
6. **Waitlist CTA band** — warm sage/navy band → `/waitlist` (see §7 contrast fix).

### 5.4 Days-old counter

- New pure helper in `src/lib/countdown.ts` (or `src/lib/age.ts`): `getAgeInDays(born, now)` →
  `{ days, weeks }`. Same build-time-paint + client-correct pattern as `getCountdown`.
- New island `src/components/LitterAge.astro` (mirrors `CountdownTimer.astro`): renders `"{days} days old"`
  (and may show weeks once ≥14 days), hydrating client-side from `bornDate`. Used on the homepage banner
  and the `/litter` hero so the moment feels *alive*, not frozen.

### 5.5 `PuppyCard` component (`src/components/PuppyCard.astro`)

Design direction chosen in the critique — **"color frame + nameplate"** (photo dominates, collar color
is a strong accent, and the color is **named in text** for colorblind/screen-reader users):

- A **thick top border** in the pup's collar `hex` (e.g. `border-top: 6px solid {hex}`).
- The pup **photo** (`<Image>`, lazy).
- A **nameplate**: a small collar-color swatch + **"{Name} collar"** in text + a **sex chip** (pastel
  blue for boys / pastel pink for girls, full-opacity charcoal text).
- The **personality note** line when present.

Props: `{ name, hex, sex, note?, photo? }`. Grid: `repeat(auto-fit, minmax(200px, 1fr))` so it reflows
without orphan-specific breakpoints.

### 5.6 Journey capstone (`src/content/journey/week-08.md`)

A final entry: `week: 8`, `date: 2026-06-25`, `title: "They're here! 🎉"`, a newborn/hero photo, a short
body that links to `/litter`. Uses the existing `UpdateCard` (its `bellySizeComparison`/`puppyGrowth`
fields are optional and omitted here). Journey remains newest-first, so this becomes the top entry.

### 5.7 Nav & discoverability (`src/components/Nav.astro`)

Add **"The Litter"** → `/litter`, placed early (e.g. after Home): the litter is the current headline.
This makes **7** top-level links — above the ideal ceiling but acceptable because the real nav already
collapses to a hamburger on mobile. *Deferred (not now):* consolidating nav (e.g. Gallery under The Litter)
if it grows further.

`/litter` **stays in the sitemap** (it is meant to be shared) and gets a per-page **OG image = the hero
photo** so texted/posted links preview well. (`/admin` and `/unsubscribe` remain excluded.)

## 6. Photo pipeline (HEIC → JPEG)

Source photos live in `src/assets/meet-the-pups/`. **21 are `.heic`**, which Astro's image pipeline
cannot decode and non-Safari browsers cannot display — so they must be converted first, using macOS's
built-in **`sips`** (no new dependency):

```
sips -s format jpeg <input>.heic --out <output>.jpg
```

Target layout under `src/assets/litter/`:

- `hero.jpg` — the group nursing shot (`coco-feeding-pups-a.jpeg`, already JPEG).
- `mother.jpg` — optional (`coco-feeding-pups-b.heic` → convert).
- `collars/{blue,black,brown,yellow,orange,pink,purple,red,green}.jpg` — one representative photo per
  collar (each source folder has 2–3 `.heic`; pick one as the cast face, remaining may feed the gallery).
- `gallery/*.jpg` — the "first few days" candids (10 `.jpg` + 1 `.heic` → convert).

A tiny throwaway shell loop (or manual `sips` calls) performs the conversion during implementation; the
converted JPEGs are the committed source of truth. Original `.heic` files can be left in place or removed.

## 7. Visual & accessibility decisions (from the `impeccable` critique)

Critique snapshot: `.impeccable/critique/2026-07-07T19-52-50Z__src-pages-litter-astro.md` (36/40).
Fixes baked into this spec:

- **Collar color is the cast card's identity** (§5.5), named in text — not a tiny dot.
- **Contrast (WCAG AA ≥ 4.5:1 for small text):**
  - Stat-card labels: **full-opacity charcoal** (not 70%) on the pastels (→ ~7.9:1); label/chip type
    **≥ 12px**.
  - CTA band: **darken the sage** (or use navy) so white body text clears 4.5:1; no reduced-opacity subtext.
  - **Eyebrow**: darken the brown so eyebrow text clears 4.5:1 on white — a **brand-wide** fix, since
    `UpdateCard.astro`'s `.puppy-growth__eyebrow` shares the color (currently `#a86b43` ≈ 4.33:1).
- **Trim the AI "eyebrow" cadence**: at most **one** section eyebrow on `/litter`; headings carry the rest.
- **Scale the peak**: hero H1 to true hero size; **"June 25" promoted** to a standalone element; bring the
  **days-old counter** onto `/litter`.
- **Stat band = 3 clean count cards**; the "14–20 oz" range moves into prose (it was a category error in a
  counter's clothing).
- **Emoji dialed back** so typography, scale, and color carry the joy (not 🎉💕🐶 alone).
- **Lock 5 boys / 4 girls** everywhere (an earlier note said "5 girls / 4 boys" — that was a slip).
- Cast card sex uses **text ("boy"/"girl")**, not glyph-only; all images have meaningful `alt`
  (e.g. "Blue-collar puppy" / "Coco nursing her nine newborn puppies").
- Tap targets (CTA button) ≥ 44px; verify on the real build.

## 8. Testing

- **Unit (Vitest, `test/`):** `getAgeInDays` — 0 on the birth day, positive for past dates, week
  rollover, and stability across times of day (mirror the `countdown` tests).
- **Build:** `astro check` validates the new `litter` schema and image refs.
- **E2E (Playwright smoke, `test/e2e/`):** extend the existing suite — `/litter` renders (hero, 3-card
  stat band, 9 cast cards, gallery, CTA); the homepage shows the announcement (days-old element present,
  countdown absent) when a published litter exists; nav contains "The Litter"; `/journey` shows the Week 8
  entry. No live Supabase/secrets needed (consistent with current smoke setup).
- Maintain the project's **80%** coverage floor on new pure-logic (`getAgeInDays`).

## 9. Files touched

**New**
- `src/content/litter/litter.md` — litter data + birth story
- `src/components/PuppyCard.astro` — cast card (collar-color frame + nameplate)
- `src/components/LitterAge.astro` — days-old counter island
- `src/pages/litter.astro` — the litter page
- `src/content/journey/week-08.md` — "They're here!" capstone
- `src/assets/litter/**` — converted hero/mother/collar/gallery JPEGs
- `test/age.test.ts` (or extend `test/countdown.test.ts`) — `getAgeInDays`

**Edited**
- `src/content.config.ts` — add the `litter` collection
- `src/pages/index.astro` — countdown → announcement branch + featured teaser
- `src/lib/countdown.ts` — add `getAgeInDays` (or new `src/lib/age.ts`)
- `src/components/Nav.astro` — add "The Litter"
- `src/styles/tokens.css` / `global.css` — pastel gender tokens; eyebrow-contrast fix (brand-wide)
- `src/components/UpdateCard.astro` — eyebrow color fix (shares the token)
- `astro.config.mjs` — confirm `/litter` OG image handling (sitemap already includes it)
- `test/e2e/*` — extend smoke coverage

## 10. Optional deliverable — announcement email

A drafted **subject + body** (reusing the birth story, a couple of photos, and the `/litter` link) that
the owner sends via the existing manual admin-export flow (`GET /api/admin/subscribers` → mail merge).
Not code; produced alongside implementation if wanted.

## 11. Open items (fill anytime; not blockers)

- Confirm final collar **hex** values for legible swatches on cream.
- Choose the single **cast face** photo per collar from each folder's 2–3 shots.
- Decide whether `LitterAge` shows weeks once ≥ 14 days, or always days.
