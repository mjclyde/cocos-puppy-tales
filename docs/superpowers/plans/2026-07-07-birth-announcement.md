# Birth Announcement — "Meet the Litter" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flip the site from a pregnancy countdown to a birth celebration — a homepage announcement banner with a live days-old counter and a new shareable `/litter` page introducing all 9 puppies by collar color.

**Architecture:** A new `litter` single-entry content collection drives everything (content-driven, reversible). The homepage branches: published litter entry → announcement, else → existing countdown. A `/litter` page assembles small reusable components (`LitterStats`, `PuppyCard`, `LitterAge`) on top of the existing tokens/`GalleryGrid`. Photos are converted HEIC→JPEG with `sips`.

**Tech Stack:** Astro 6 (static + Vercel adapter), Astro content collections + Zod 4, `astro:assets` `<Image>`, Vitest 4 (node) for pure logic, Playwright for E2E smoke. Node ≥ 24.

**Branch:** `feat/birth-announcement` (already checked out; spec committed there).

---

## File Structure

**New files**
- `src/content/litter/litter.md` — litter data (frontmatter) + birth story (body)
- `src/lib/age.ts` — `getAgeInDays(born, now)` pure helper
- `src/components/LitterAge.astro` — days-old counter island
- `src/components/LitterStats.astro` — 3-card stat band (shared by homepage + `/litter`)
- `src/components/PuppyCard.astro` — one cast card (collar-color frame + nameplate)
- `src/pages/litter.astro` — the `/litter` page
- `src/content/journey/week-08.md` — "They're here!" journey capstone
- `src/assets/litter/**` — converted hero + per-collar + gallery JPEGs
- `public/og-litter.jpg` — social card for `/litter`
- `test/age.test.ts` — unit tests for `getAgeInDays`

**Modified files**
- `src/content.config.ts` — register the `litter` collection
- `src/styles/tokens.css` — add pastel gender tokens, deep-sage, and an accessible eyebrow token
- `src/components/UpdateCard.astro` — eyebrow uses the new accessible token (brand-wide contrast fix)
- `src/pages/index.astro` — countdown → announcement branch + featured teaser
- `src/components/Nav.astro` — add "The Litter"
- `test/e2e/smoke.spec.ts` — homepage now shows the announcement (not the countdown); add `/litter` + journey checks

---

## Task 1: Photo pipeline (HEIC → JPEG)

Convert the source photos (21 are `.heic`, which Astro/Sharp can't decode and non-Safari browsers can't show) into JPEGs under `src/assets/litter/`, plus a social card in `public/`.

**Files:**
- Create: `src/assets/litter/hero.jpg`, `src/assets/litter/collars/<color>.jpg` (×9), `src/assets/litter/gallery/*.jpg`, `public/og-litter.jpg`
- Source: `src/assets/meet-the-pups/**`

- [ ] **Step 1: Create target directories**

```bash
cd /Users/mjclyde/Oss/coco-puppy-tales
mkdir -p src/assets/litter/collars src/assets/litter/gallery
```

- [ ] **Step 2: Convert the hero (already JPEG) + one face per collar**

`sips` is built into macOS. Each collar folder has 2–3 `.heic`; this takes the **first** file as the cast face — eyeball each result and swap in a clearer shot if the first isn't the best.

```bash
cd /Users/mjclyde/Oss/coco-puppy-tales/src/assets/meet-the-pups
# Hero: the group nursing shot (already jpeg) — copy as-is
cp coco-feeding-pups-a.jpeg ../litter/hero.jpg
# One representative face per collar
for c in blue black brown yellow orange pink purple red green; do
  first=$(find "$c" -type f -iname '*.heic' | sort | head -1)
  sips -s format jpeg "$first" --out "../litter/collars/$c.jpg" >/dev/null
done
```

- [ ] **Step 3: Convert the "first few days" candids into the gallery**

```bash
cd /Users/mjclyde/Oss/coco-puppy-tales/src/assets/meet-the-pups/first-few-days
i=1
for f in $(find . -type f \( -iname '*.jpg' -o -iname '*.heic' \) | sort); do
  sips -s format jpeg "$f" --out "$(printf '../../litter/gallery/day-%02d.jpg' "$i")" >/dev/null
  i=$((i+1))
done
```

- [ ] **Step 4: Make the social card (`public/og-litter.jpg`)**

Pick a good landscape group shot if one exists; otherwise reuse the hero. `-Z 1200` caps the long edge and preserves aspect.

```bash
cd /Users/mjclyde/Oss/coco-puppy-tales
sips -s format jpeg -Z 1200 src/assets/litter/hero.jpg --out public/og-litter.jpg >/dev/null
```

- [ ] **Step 5: Verify the assets exist**

Run:
```bash
cd /Users/mjclyde/Oss/coco-puppy-tales
ls src/assets/litter/collars | wc -l   # expect 9
ls src/assets/litter/gallery | wc -l   # expect ~11
ls -la src/assets/litter/hero.jpg public/og-litter.jpg
```
Expected: 9 collar files, ~11 gallery files, hero + og-litter present.

- [ ] **Step 6: Commit**

```bash
git add src/assets/litter public/og-litter.jpg
git commit -m "feat: add converted litter photos (HEIC->JPEG) and OG card"
```

---

## Task 2: `getAgeInDays` helper (TDD)

**Files:**
- Create: `src/lib/age.ts`
- Test: `test/age.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/age.test.ts
import { describe, it, expect } from 'vitest';
import { getAgeInDays } from '../src/lib/age';

describe('getAgeInDays', () => {
  it('is 0 on the birth day', () => {
    const born = new Date('2026-06-25T06:00:00Z');
    expect(getAgeInDays(born, new Date('2026-06-25T20:00:00Z'))).toEqual({ days: 0, weeks: 0 });
  });

  it('counts whole days and derives weeks', () => {
    const born = new Date('2026-06-25T06:00:00Z');
    expect(getAgeInDays(born, new Date('2026-07-06T06:00:00Z'))).toEqual({ days: 11, weeks: 1 });
  });

  it('rolls to 2 weeks at day 14', () => {
    const born = new Date('2026-06-25T06:00:00Z');
    expect(getAgeInDays(born, new Date('2026-07-09T06:00:00Z'))).toEqual({ days: 14, weeks: 2 });
  });

  it('clamps to 0 when now is before the birth date', () => {
    const born = new Date('2026-06-25T06:00:00Z');
    expect(getAgeInDays(born, new Date('2026-06-20T06:00:00Z'))).toEqual({ days: 0, weeks: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/age.test.ts`
Expected: FAIL — cannot resolve `../src/lib/age`.

- [ ] **Step 3: Write the minimal implementation**

```typescript
// src/lib/age.ts
export interface Age {
  days: number;
  weeks: number;
}

/** Whole days (and derived weeks) elapsed since `born`, clamped at 0. */
export function getAgeInDays(born: Date, now: Date): Age {
  const diffMs = now.getTime() - born.getTime();
  const days = Math.max(0, Math.floor(diffMs / 86_400_000));
  return { days, weeks: Math.floor(days / 7) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/age.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/age.ts test/age.test.ts
git commit -m "feat: add getAgeInDays helper with tests"
```

---

## Task 3: `litter` content collection + content file

**Files:**
- Modify: `src/content.config.ts`
- Create: `src/content/litter/litter.md`

- [ ] **Step 1: Add the collection to `src/content.config.ts`**

Add this collection definition alongside the others (after the `breed` collection):

```typescript
const litter = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/litter' }),
  schema: ({ image }) => z.object({
    bornDate: z.coerce.date(),
    count: z.number(),
    boys: z.number(),
    girls: z.number(),
    weightRange: z.string(),
    headline: z.string(),
    heroImage: image(),
    collars: z.array(z.object({
      name: z.string(),
      hex: z.string(),
      sex: z.enum(['boy', 'girl']),
      note: z.string().optional(),
      photo: image(),
    })),
    published: z.boolean().default(true),
  }),
});
```

Then add `litter` to the exported `collections` object:

```typescript
export const collections = { coco, journey, breed, site, litter };
```

- [ ] **Step 2: Create `src/content/litter/litter.md`**

```markdown
---
bornDate: 2026-06-25T06:00:00.000Z
count: 9
boys: 5
girls: 4
weightRange: "14–20 oz"
headline: "Meet Coco's puppies"
heroImage: ../../assets/litter/hero.jpg
collars:
  - { name: "Blue",   hex: "#3b6fd6", sex: boy,  note: "First born — led the way.",              photo: ../../assets/litter/collars/blue.jpg }
  - { name: "Black",  hex: "#2a2a2a", sex: boy,  note: "The dramatic one — growing fastest.",     photo: ../../assets/litter/collars/black.jpg }
  - { name: "Brown",  hex: "#8a5a2b", sex: boy,  note: "Aka \"Potato\" — loves to sleep.",        photo: ../../assets/litter/collars/brown.jpg }
  - { name: "Yellow", hex: "#e0b031", sex: boy,  note: "Has the most unique markings.",           photo: ../../assets/litter/collars/yellow.jpg }
  - { name: "Orange", hex: "#e8863b", sex: boy,  note: "First to open his eyes.",                 photo: ../../assets/litter/collars/orange.jpg }
  - { name: "Pink",   hex: "#e58fb0", sex: girl, note: "Coco's little mini-me.",                  photo: ../../assets/litter/collars/pink.jpg }
  - { name: "Purple", hex: "#7b4fc9", sex: girl, note: "Last to arrive, worth the wait.",         photo: ../../assets/litter/collars/purple.jpg }
  - { name: "Red",    hex: "#d24a45", sex: girl, note: "Sweet and small — nicknamed \"Ruby.\"",  photo: ../../assets/litter/collars/red.jpg }
  - { name: "Green",  hex: "#5a9e4f", sex: girl, note: "Little, quiet & unbearably cute.",        photo: ../../assets/litter/collars/green.jpg }
published: true
---

In the early hours of June 25th — a few days ahead of schedule — Coco became a mom. Nine healthy
puppies arrived: five boys and four girls, every one a classic Bernese beauty, tipping the scales
between 14 and 20 ounces.

Blue led the way as our firstborn, and little Purple was the last to make her grand entrance. Mama and
babies are all doing wonderfully — nursing like champs and growing by the day. We couldn't be more in love.
```

- [ ] **Step 3: Verify the schema and image refs resolve**

Run: `npm run check`
Expected: 0 errors (the new collection validates; all 10 image paths resolve).

- [ ] **Step 4: Commit**

```bash
git add src/content.config.ts src/content/litter/litter.md
git commit -m "feat: add litter content collection and litter.md"
```

---

## Task 4: Design tokens + brand-wide eyebrow contrast fix

Add the pastel gender colors, a deep sage for the CTA band, and an **accessible eyebrow** color (the current brown `#a86b43` measures 4.33:1 on white — below AA). Apply the eyebrow token to `UpdateCard` too, since it shares the color.

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `src/components/UpdateCard.astro:61` (the `.puppy-growth__eyebrow` color)

- [ ] **Step 1: Add tokens to `src/styles/tokens.css`**

Inside `:root`, after the `--pop` line, add:

```css
  /* Litter announcement */
  --c-boy:       #a9c2df;   /* pastel blue  — charcoal text ≈ 7.9:1 */
  --c-girl:      #e7bccb;   /* pastel pink  — charcoal text ≈ 8.6:1 */
  --c-sage-deep: #4f6b40;   /* CTA band bg  — white text ≈ 6:1 */
  --eyebrow:     #935a30;   /* accessible brown for eyebrows ≈ 5.6:1 on white (was --c-brown 4.33:1) */
```

- [ ] **Step 2: Point `UpdateCard`'s eyebrow at the token**

In `src/components/UpdateCard.astro`, change the `.puppy-growth__eyebrow` color:

```css
  .puppy-growth__eyebrow {
    color: var(--eyebrow);
```
(was `color: var(--c-brown);`)

- [ ] **Step 3: Verify build still type-checks**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/styles/tokens.css src/components/UpdateCard.astro
git commit -m "feat: add pastel/deep-sage tokens; fix eyebrow contrast brand-wide"
```

---

## Task 5: `LitterStats`, `PuppyCard`, and `LitterAge` components

**Files:**
- Create: `src/components/LitterStats.astro`
- Create: `src/components/PuppyCard.astro`
- Create: `src/components/LitterAge.astro`

- [ ] **Step 1: Create `src/components/LitterStats.astro`** (3 count cards; labels are full-opacity charcoal at ≥12px)

```astro
---
interface Props { count: number; boys: number; girls: number; }
const { count, boys, girls } = Astro.props;
---
<div class="stat-band">
  <div class="stat"><span class="n">{count}</span><span class="l">puppies</span></div>
  <div class="stat stat-boy"><span class="n">{boys}</span><span class="l">boys</span></div>
  <div class="stat stat-girl"><span class="n">{girls}</span><span class="l">girls</span></div>
</div>
<style>
  .stat-band { display: flex; gap: 0.75rem; flex-wrap: wrap; }
  .stat { flex: 1; min-width: 92px; background: var(--c-navy); color: #fff; border-radius: var(--radius); text-align: center; padding: 0.9rem 0.5rem; }
  .stat .n { display: block; font-size: 1.9rem; font-weight: 900; line-height: 1; }
  .stat .l { display: block; margin-top: 0.3rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .stat-boy { background: var(--c-boy); color: var(--c-charcoal); }
  .stat-girl { background: var(--c-girl); color: var(--c-charcoal); }
</style>
```

- [ ] **Step 2: Create `src/components/PuppyCard.astro`** (collar-color top frame + nameplate; collar named in text for a11y)

```astro
---
import { Image } from 'astro:assets';
import type { ImageMetadata } from 'astro';
interface Props { name: string; hex: string; sex: 'boy' | 'girl'; note?: string; photo: ImageMetadata; }
const { name, hex, sex, note, photo } = Astro.props;
---
<article class="pup" style={`--collar: ${hex}`}>
  <Image src={photo} alt={`${name}-collar puppy`} class="pup-img" widths={[240, 480]} sizes="(max-width: 700px) 50vw, 240px" format="webp" quality={78} loading="lazy" />
  <div class="pup-body">
    <div class="nameplate">
      <span class="swatch" aria-hidden="true"></span>
      <span class="pup-name">{name} collar</span>
      <span class={`sex sex-${sex}`}>{sex}</span>
    </div>
    {note && <p class="pup-note">{note}</p>}
  </div>
</article>
<style>
  .pup { background: #fff; border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; border-top: 6px solid var(--collar); }
  .pup-img { width: 100%; height: 200px; object-fit: cover; }
  .pup-body { padding: 0.85rem 1rem 1.05rem; }
  .nameplate { display: flex; align-items: center; gap: 0.5rem; }
  .swatch { flex: 0 0 auto; width: 0.9rem; height: 0.9rem; border-radius: var(--radius-pill); background: var(--collar); box-shadow: 0 0 0 2px #fff, 0 1px 3px rgba(43, 41, 38, 0.35); }
  .pup-name { font-weight: 900; color: var(--heading); font-size: 1rem; }
  .sex { margin-left: auto; font-size: 0.75rem; font-weight: 800; color: var(--c-charcoal); padding: 0.15rem 0.6rem; border-radius: var(--radius-pill); }
  .sex-boy { background: var(--c-boy); }
  .sex-girl { background: var(--c-girl); }
  .pup-note { margin: 0.5rem 0 0; color: var(--text); font-size: 0.9rem; line-height: 1.4; }
</style>
```

- [ ] **Step 3: Create `src/components/LitterAge.astro`** (mirrors `CountdownTimer`; age changes daily, so it computes once on load to correct any build-time staleness — no interval needed)

```astro
---
import { getAgeInDays } from '../lib/age';
interface Props { bornDate: Date; }
const { bornDate } = Astro.props;
const bornIso = bornDate.toISOString();
const initial = getAgeInDays(bornDate, new Date()); // build-time paint; client corrects on load
---
<p class="litter-age" id="litter-age" data-born={bornIso} aria-live="polite">
  <span class="num" data-age-days>{initial.days}</span>
  <span class="lbl">days old</span>
</p>
<script>
  import { getAgeInDays } from '../lib/age';
  const el = document.getElementById('litter-age');
  if (el) {
    const born = new Date(el.dataset.born!);
    const span = el.querySelector('[data-age-days]');
    if (span) span.textContent = String(getAgeInDays(born, new Date()).days);
  }
</script>
<style>
  .litter-age { display: inline-flex; align-items: baseline; gap: 0.4rem; margin: 0.75rem 0 0; background: var(--c-navy); color: var(--c-cream); border-radius: var(--radius-pill); padding: 0.4rem 1rem; }
  .litter-age .num { font-size: 1.5rem; font-weight: 900; line-height: 1; }
  .litter-age .lbl { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; }
</style>
```

- [ ] **Step 4: Verify components type-check**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/LitterStats.astro src/components/PuppyCard.astro src/components/LitterAge.astro
git commit -m "feat: add LitterStats, PuppyCard, and LitterAge components"
```

---

## Task 6: The `/litter` page

**Files:**
- Create: `src/pages/litter.astro`

- [ ] **Step 1: Create `src/pages/litter.astro`**

```astro
---
import { Image } from 'astro:assets';
import BaseLayout from '../layouts/BaseLayout.astro';
import LitterStats from '../components/LitterStats.astro';
import LitterAge from '../components/LitterAge.astro';
import PuppyCard from '../components/PuppyCard.astro';
import GalleryGrid from '../components/GalleryGrid.astro';
import { getEntry, render } from 'astro:content';
import type { ImageMetadata } from 'astro';

const litter = await getEntry('litter', 'litter');
const { bornDate, count, boys, girls, headline, heroImage, collars } = litter!.data;
const { Content } = await render(litter!);
const bornStr = bornDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const galleryFiles = import.meta.glob<{ default: ImageMetadata }>('../assets/litter/gallery/*.{jpg,jpeg,png,webp}', { eager: true });
const galleryImages = Object.values(galleryFiles).map((m) => ({ src: m.default, alt: "Coco's puppies in their first few days" }));
---
<BaseLayout title="Meet the Litter — Coco's Puppy Tales" description="Coco's 9 puppies have arrived! Meet the whole litter, born June 25, 2026." ogImage="/og-litter.jpg">
  <section class="section hero-litter">
    <div class="container hero-grid">
      <div class="hero-copy">
        <span class="chip">🎉 They're here!</span>
        <h1>{headline}</h1>
        <p class="born">Born <strong>{bornStr}</strong></p>
        <LitterAge bornDate={bornDate} />
      </div>
      <Image src={heroImage} alt="Coco nursing her nine newborn puppies" class="hero-img" widths={[400, 800]} sizes="(max-width: 700px) 100vw, 480px" format="webp" quality={80} />
    </div>
  </section>

  <section class="section">
    <div class="container">
      <LitterStats count={count} boys={boys} girls={girls} />
    </div>
  </section>

  <section class="section">
    <div class="container narrow prose">
      <h2>They arrived a few days early!</h2>
      <Content />
    </div>
  </section>

  <section class="section">
    <div class="container">
      <p class="eyebrow">Meet the cast</p>
      <h2>Nine collars, nine personalities</h2>
      <div class="cast">
        {collars.map((c) => (
          <PuppyCard name={c.name} hex={c.hex} sex={c.sex} note={c.note} photo={c.photo} />
        ))}
      </div>
    </div>
  </section>

  {galleryImages.length > 0 && (
    <section class="section">
      <div class="container">
        <h2>First days</h2>
        <GalleryGrid images={galleryImages} />
      </div>
    </section>
  )}

  <section class="section">
    <div class="container">
      <div class="cta">
        <h2>Hoping to welcome one of these pups?</h2>
        <p>Families on the waitlist get first pick as the puppies grow.</p>
        <a class="btn" href="/waitlist">Join the waitlist →</a>
      </div>
    </div>
  </section>
</BaseLayout>

<style>
  .hero-litter { background: var(--c-cream); }
  .hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: center; }
  .hero-copy h1 { font-size: clamp(2rem, 5vw, 3rem); margin: 0.6rem 0 0.4rem; }
  .born { font-size: 1.15rem; margin: 0; }
  .hero-img { border-radius: var(--radius); box-shadow: var(--shadow-lg); width: 100%; height: auto; object-fit: cover; }
  .narrow { max-width: 68ch; }
  .prose :global(p) { font-size: 1.05rem; }
  .eyebrow { color: var(--eyebrow); font-size: 0.8rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 0.35rem; }
  .cast { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.25rem; }
  .cta { background: var(--c-sage-deep); color: #fff; border-radius: var(--radius); padding: 2rem; text-align: center; }
  .cta h2 { color: #fff; }
  .cta p { margin: 0.25rem 0 1.25rem; }
  @media (max-width: 700px) { .hero-grid { grid-template-columns: 1fr; } }
</style>
```

- [ ] **Step 2: Verify it builds and renders**

Run: `npm run check && npm run build`
Expected: 0 type errors; build succeeds and emits a `/litter` route.

- [ ] **Step 3: Eyeball it in dev (manual)**

Run: `npm run dev`, open `http://localhost:4321/litter`. Confirm: hero headline is large, "Born June 25, 2026" shows, days-old badge shows a number, 3 stat cards (9 / 5 boys / 4 girls), 9 cast cards each with a colored top frame + "<Color> collar" + sex chip + note, gallery grid, sage CTA. Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add src/pages/litter.astro
git commit -m "feat: add /litter page (hero, stats, cast, gallery, CTA)"
```

---

## Task 7: Homepage countdown → announcement flip

**Files:**
- Modify: `src/pages/index.astro` (full replacement below)

- [ ] **Step 1: Replace `src/pages/index.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import Hero from '../components/Hero.astro';
import CountdownTimer from '../components/CountdownTimer.astro';
import LitterStats from '../components/LitterStats.astro';
import LitterAge from '../components/LitterAge.astro';
import SubscribeForm from '../components/SubscribeForm.astro';
import { Image } from 'astro:assets';
import { getEntry } from 'astro:content';

const coco = await getEntry('coco', 'coco');
const site = await getEntry('site', 'config');
const { dueDate, litterEstimate, flags } = site!.data;

const litterEntry = await getEntry('litter', 'litter');
const litter = litterEntry?.data.published ? litterEntry.data : null;
const bornShort = litter ? litter.bornDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : '';
---
<BaseLayout title="Coco's Puppy Tales">
  <Hero image={coco!.data.heroImage} name={coco!.data.name} />

  {litter ? (
    <section class="section announce">
      <div class="container announce-grid">
        <div class="announce-copy">
          <span class="chip">🎉 They're here!</span>
          <h2>{litter.count} puppies have arrived</h2>
          <p class="born">Born <strong>{bornShort}</strong> — a few days early 💕</p>
          <LitterStats count={litter.count} boys={litter.boys} girls={litter.girls} />
          <LitterAge bornDate={litter.bornDate} />
          <div class="hero-cta"><a class="btn" href="/litter">Meet the litter →</a></div>
        </div>
        <Image src={litter.heroImage} alt="Coco nursing her nine newborn puppies" class="announce-img" widths={[400, 800]} sizes="(max-width: 700px) 100vw, 460px" format="webp" quality={80} />
      </div>
    </section>
  ) : (
    <section class="section countdown-section">
      <div class="container">
        <h2>Expected arrival</h2>
        <p>We're expecting {litterEstimate}! Here's the countdown:</p>
        <CountdownTimer dueDate={dueDate} />
      </div>
    </section>
  )}

  <section class="section">
    <div class="container teasers">
      <a class="card teaser" href="/litter"><h3>🐶 Meet the Litter</h3><p>Nine puppies have arrived! Meet the whole crew.</p></a>
      <a class="card teaser" href="/journey"><h3>📅 The Journey</h3><p>Weekly bump updates and Coco's pregnancy diary.</p></a>
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
  .announce-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: center; }
  .announce-copy h2 { font-size: clamp(1.7rem, 4vw, 2.6rem); margin: 0.5rem 0 0.3rem; }
  .born { font-size: 1.1rem; margin: 0 0 1rem; }
  .announce-copy :global(.stat-band) { margin-bottom: 0.5rem; }
  .announce-img { border-radius: var(--radius); box-shadow: var(--shadow-lg); width: 100%; height: auto; object-fit: cover; }
  .hero-cta { margin-top: 1.25rem; }
  .teasers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
  .teaser { text-decoration: none; color: inherit; transition: transform 0.12s, box-shadow 0.12s; }
  .teaser:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); }
  .subscribe-section { background: #fff; }
  @media (max-width: 700px) { .announce-grid { grid-template-columns: 1fr; } .teasers { grid-template-columns: 1fr; } }
</style>
```

- [ ] **Step 2: Verify build**

Run: `npm run check && npm run build`
Expected: 0 errors; build succeeds.

- [ ] **Step 3: Eyeball it (manual)**

Run: `npm run dev`, open `http://localhost:4321/`. Confirm the homepage shows the "🎉 They're here!" announcement (stat band + days-old + "Meet the litter →"), **not** the countdown, and the first teaser is "Meet the Litter". Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: flip homepage countdown to birth announcement"
```

---

## Task 8: Nav link + Week 8 journey capstone

**Files:**
- Modify: `src/components/Nav.astro:3-10` (the `links` array)
- Create: `src/content/journey/week-08.md`

- [ ] **Step 1: Add "The Litter" to the nav**

In `src/components/Nav.astro`, update the `links` array (add the litter link after Home):

```typescript
const links = [
  { href: '/', label: 'Home' },
  { href: '/litter', label: 'The Litter' },
  { href: '/coco', label: 'Meet Coco' },
  { href: '/journey', label: 'The Journey' },
  { href: '/breed', label: 'The Breed' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/waitlist', label: 'Waitlist' },
];
```

- [ ] **Step 2: Create `src/content/journey/week-08.md`**

```markdown
---
week: 8
date: 2026-06-25T06:00:00.000Z
title: "They're here! 🎉"
published: true
---

The wait is over — Coco's puppies arrived in the early morning of June 25th, a few days early!
Nine healthy babies, five boys and four girls, all snuggled up with their very proud mama.

[Meet the whole litter →](/litter)
```

- [ ] **Step 3: Verify build**

Run: `npm run check && npm run build`
Expected: 0 errors. `/journey` now lists Week 8 first (newest-first sort).

- [ ] **Step 4: Commit**

```bash
git add src/components/Nav.astro src/content/journey/week-08.md
git commit -m "feat: add The Litter nav link and Week 8 journey capstone"
```

---

## Task 9: E2E smoke updates + full verification

The existing smoke test asserts the homepage shows `#countdown` — the flip removes that, so this test **must** be updated or it will fail.

**Files:**
- Modify: `test/e2e/smoke.spec.ts` (replace the first test; add two new tests)

- [ ] **Step 1: Update the homepage test and add `/litter` + journey coverage**

Replace the first `test(...)` block in `test/e2e/smoke.spec.ts` with the following, and add the two new tests after it (leave the waitlist + unsubscribe tests unchanged):

```typescript
test('home page shows the birth announcement and nav works', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: "Coco's Puppy Tales" })).toBeVisible();
  // Announcement replaced the countdown.
  await expect(page.getByRole('heading', { name: /puppies have arrived/i })).toBeVisible();
  await expect(page.locator('#litter-age .num')).toBeVisible();
  await expect(page.locator('#countdown')).toHaveCount(0);
  await page.getByRole('link', { name: 'The Journey' }).first().click();
  await expect(page).toHaveURL(/\/journey/);
  await expect(page.getByRole('heading', { name: 'The Journey' })).toBeVisible();
});

test('litter page shows the cast and stats', async ({ page }) => {
  await page.goto('/litter');
  await expect(page.getByRole('heading', { name: "Meet Coco's puppies" })).toBeVisible();
  await expect(page.getByText('9', { exact: true }).first()).toBeVisible();
  // All nine collar cards render, each naming its collar.
  await expect(page.getByText('Blue collar')).toBeVisible();
  await expect(page.getByText('Green collar')).toBeVisible();
  await expect(page.getByRole('link', { name: /Join the waitlist/i })).toBeVisible();
});

test('journey shows the birth capstone linking to the litter', async ({ page }) => {
  await page.goto('/journey');
  await expect(page.getByRole('heading', { name: /They're here!/ })).toBeVisible();
  await page.getByRole('link', { name: /Meet the whole litter/i }).click();
  await expect(page).toHaveURL(/\/litter/);
});
```

- [ ] **Step 2: Run the full verification suite**

Run:
```bash
npm run check
npm test
npm run build
npm run test:e2e
```
Expected: `check` 0 errors; `vitest` all pass (incl. `age` + existing); `build` succeeds; Playwright smoke all pass (homepage announcement, `/litter`, journey capstone, waitlist, unsubscribe).

- [ ] **Step 3: Commit**

```bash
git add test/e2e/smoke.spec.ts
git commit -m "test: update smoke suite for birth announcement, /litter, and capstone"
```

---

## Task 10 (optional): Announcement email copy

Not code — a drafted subject + body for the owner to send via the existing manual admin-export flow (`GET /api/admin/subscribers` → mail merge). Produce only if the owner wants it.

- [ ] **Step 1: Draft** subject line + short body reusing the birth story, 1–2 photos, and the `https://cocos-puppy-tales.mjclyde.com/litter` link + the standard `{{unsubscribe_url}}` placeholder. Save to `docs/superpowers/announcement-email.md`. No commit required unless the owner keeps it.

---

## Self-Review

**Spec coverage:**
- New `litter` collection → Task 3 ✓
- Homepage flip → Task 7 ✓
- `/litter` page (hero, 3-stat band, story w/ weight in prose, cast, gallery, CTA) → Task 6 ✓
- `PuppyCard` (collar frame + nameplate, named in text) → Task 5 ✓
- `LitterAge` + `getAgeInDays` + tests → Tasks 2, 5 ✓
- Week 8 capstone → Task 8 ✓
- Nav + sitemap/OG → Task 8 (nav), Task 6 (`ogImage`), sitemap already includes `/litter` (no change needed) ✓
- HEIC→JPEG pipeline → Task 1 ✓
- Contrast/a11y incl. brand-wide eyebrow fix (UpdateCard) → Task 4; stat labels full-opacity ≥12px (Task 5); deep-sage CTA (Task 6) ✓
- Lock 5 boys / 4 girls → Task 3 content + Task 7 reads `litter.boys`/`litter.girls` ✓
- Trim eyebrows to one on `/litter` → Task 6 (single `.eyebrow`) ✓
- Scaled hero + promoted date + days-old on `/litter` → Task 6 ✓
- Emoji dialed back → only the "🎉 They're here!" chip + one 💕; type/color/collar carry the rest ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code; the one "pick the clearest face" note (Task 1) is a real human judgment with a working default command, not a code gap.

**Type consistency:** `getAgeInDays(born, now) → {days, weeks}` used identically in `age.ts`, `LitterAge.astro`, and `test/age.test.ts`. `getEntry('litter', 'litter')` used identically in `litter.astro` and `index.astro`. `LitterStats` props `{count, boys, girls}` and `PuppyCard` props `{name, hex, sex, note?, photo}` match their call sites. Tokens `--c-boy`/`--c-girl`/`--c-sage-deep`/`--eyebrow` defined in Task 4 before first use in Tasks 5–6.

**Verification note:** Tasks 7 and 9 are coupled — the homepage flip (Task 7) makes the *old* smoke assertion fail; Task 9 updates it. Both land in this same branch/PR, so the suite is green only after Task 9.
