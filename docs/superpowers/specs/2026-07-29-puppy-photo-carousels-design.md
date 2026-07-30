# Per-puppy photo carousels and a filterable gallery

**Date:** 2026-07-29
**Status:** Approved

## Problem

Two new photo shoots (2026-07-23 and 2026-07-24) added 97 photos to `src/assets/`, none of them
wired into the site. Meanwhile the "Meet the cast" cards on the home page show exactly one photo per
puppy — the newborn collar shot from 2026-07-07 — so there is no way to see a puppy grow, and no way
to browse the gallery by puppy at all.

The site also has no single place that answers "show me every photo of Blue." Photos are scattered
across four unrelated conventions (`litter/collars/`, `litter/gallery/`, `gallery/`, and the two new
dated folders), each globbed by a different page.

## Goals

- Every puppy card on the home page carousels through that puppy's complete photo history.
- The gallery can be filtered to a single puppy, and shows group/Coco/first-days photos as their own
  sections when unfiltered.
- Adding a future photo shoot means dropping a dated folder on disk — no code change.
- New photos do not bloat the repo or the Vercel build.

## Non-goals

- No captions, favorites, sorting UI, or per-photo metadata. Alt text is generated.
- No admin upload flow. Photos are committed to the repo, as they are today.
- No changes to the waitlist, subscribe, admin, or auth surfaces.

---

## 1. Photo storage

All photos move into one tree, organized shoot-first — matching how they already arrive from a
camera roll:

```
src/assets/photos/
  pre-litter/    coco/          23   Coco before the litter (mixed 2023–2026 dates)
  2026-06-26/    first-days/    11   newborn candids, whole litter
  2026-07-07/    blue/ … green/  9   one newborn portrait per puppy
  2026-07-23/    blue/ … green/ 18   outdoor headshots, 2 per puppy
  2026-07-24/    blue/ … green/ 47   studio/basket shots, 3–6 per puppy
                 group/         28   whole-litter pile shots
                 coco/           1   mama
```

**137 photos total:** 74 puppy, 28 group, 24 Coco, 11 first-days.

### Path contract

Every photo path is exactly `src/assets/photos/<shoot>/<subject>/<file>`.

- `<shoot>` is either an ISO date (`2026-07-23`) or an undated slug (`pre-litter`).
- `<subject>` is a lowercase collar name (`blue`, `black`, `brown`, `yellow`, `orange`, `pink`,
  `purple`, `red`, `green`) or one of `group`, `coco`, `first-days`.
- `<file>` is `<subject>-NN.jpg`, numbered from 01 in capture order.

A subject that matches neither a collar in `litter.md` nor a known non-puppy subject is a **build
error**, not a silent omission. A collar in `litter.md` with no photo folder is likewise a build
error. This is the only protection against a typo'd folder quietly emptying a puppy's card.

### Shoot ordering

Within a subject, shoots sort **newest first**; undated shoots sort last. So Blue's carousel runs
07-24 → 07-23 → 07-07, ending on his newborn portrait, and Coco's gallery section runs 07-24 →
`pre-litter`. A new dated folder lands in the right position automatically.

### Migration from the current layout

| From | To | Notes |
|---|---|---|
| `litter/collars/<color>.jpg` (9) | `photos/2026-07-07/<color>/<color>-01.jpg` | Downscale; 5712px sources |
| `litter/gallery/day-NN.jpg` (11) | `photos/2026-06-26/first-days/first-days-NN.jpg` | Already 2048px |
| `gallery/coco-gallery-NN.*` (23) | `photos/pre-litter/coco/coco-NN.jpg` | Already 2048px; one `.JPG` |
| `2026-07-23/<color>/IMG_*.jpeg` (18) | `photos/2026-07-23/<color>/<color>-NN.jpg` | Downscale; 4–5k px sources |
| `2026-07-24/<color>/*` (49) | `photos/2026-07-24/<color>/<color>-NN.jpg` | Drop 2 duplicates (below) |
| `2026-07-24/group-photos/*` (28) | `photos/2026-07-24/group/group-NN.jpg` | |
| `2026-07-24/coco.jpeg` (1) | `photos/2026-07-24/coco/coco-01.jpg` | |

Also removed: `src/assets/meet-the-pups/` (the `.heic` originals these were all derived from,
unreferenced since the birth announcement shipped) and the empty `src/assets/untitled folder/`.

**Kept where they are:** `src/assets/litter/hero.jpg` (the home page hero, referenced by
`litter.md`'s `heroImage`), `src/assets/coco-hero.jpg`, `src/assets/journey/`, and
`public/og-litter.jpg`. Only the `collars/` and `gallery/` subfolders of `src/assets/litter/` go
away — not the directory itself.

Three normalizations happen during the move:

1. **Extensions lowercase to `.jpg`.** Sources include `.jpeg`, `.JPG`, and `.jpg`; Vite's glob is
   case-sensitive, and one canonical extension avoids a glob pattern that has to enumerate cases.
2. **Filenames become `<subject>-NN.jpg`, ordered by EXIF capture time.** Within-shoot order is
   alphabetical by filename, so deterministic names are what make the order deterministic. This
   matters most for `2026-07-24/pink/`, whose six files are UUID-named and sort randomly today.
3. **Long edge caps at 2048px.** The 07-23 shoot is 41 MB for 18 files at 4–5k px, and
   `litter/collars/` is 5712px. Uncapped, the build pushes ~411 image transforms through 20-megapixel
   sources. Capping takes ~105 MB of new photos to roughly 25 MB with no visible difference — the
   largest variant the site ever serves is 1600px.

### Duplicates

`IMG_4109.jpeg` and `IMG_4122.jpeg` are byte-identical in both `2026-07-24/blue/` and
`2026-07-24/yellow/`. Their numbering falls inside blue's run (4109–4148), so both are treated as
Blue's and the yellow copies are dropped. Yellow goes from 8 to 6 photos in that shoot.

### Safety

Downscaled copies are written into `photos/`; the untracked source folders `2026-07-23/` and
`2026-07-24/` stay on disk until the result has been eyeballed, then get deleted. Everything else
being moved is already tracked in git, so history holds the originals.

---

## 2. Modules

### `src/lib/photos/paths.ts` — pure, unit-tested

No Vite, no Astro, no `ImageMetadata`. Operates on path strings and plain records:

- `parsePhotoPath(path)` → `{ shoot, subject, file }`, throws on a malformed path
- `isDatedShoot(shoot)` / `compareShoots(a, b)` — dated descending, undated last
- `groupBySubject(entries)` → `Record<subject, Entry[]>`, each list shoot-sorted then filename-sorted
- `assertKnownSubjects(subjects, collarNames)` — throws listing every unknown subject and every
  collar missing a folder

### `src/lib/photos/index.ts` — the glob wrapper

Runs `import.meta.glob('../../assets/photos/**/*.jpg', { eager: true })`, feeds the paths through
`paths.ts`, and exports:

- `photosBySubject: Record<string, Photo[]>` where `Photo = { src: ImageMetadata; alt: string; shoot: string }`
- `getPuppyPhotos(collarName)` — that puppy's photos, newest shoot first
- `nonPuppySections()` — group / Coco / first-days, in display order

Splitting these two ways means the ordering and validation logic is testable with plain strings,
with no need to mock Vite's glob.

### Generated alt text

| Subject | Alt |
|---|---|
| collar | `Blue collar puppy — July 23, 2026` |
| `group` | `Coco's litter — July 24, 2026` |
| `first-days` | `Coco's puppies in their first few days` |
| `coco` | `Coco — July 24, 2026`, or just `Coco` for `pre-litter` |

Undated shoots omit the date suffix.

---

## 3. Content change: `litter.md` drops `photo`

`collars[].photo` currently pins each card's image. With covers derived from the photo index it is
dead weight and a second place to keep in sync. Remove it from the `litter` schema in
`src/content.config.ts` and from all nine collar lines. The link between a collar and its photos
becomes `name.toLowerCase()` → subject folder, enforced by `assertKnownSubjects`.

`heroImage` stays as-is.

---

## 4. `PuppyCarousel.astro`

New component, rendered inside `PuppyCard`.

**Frame.** 1:1, `object-fit: cover`. The 07-23 headshots are portrait and the 07-24 studio shots are
landscape; a square frame is the only ratio that treats both fairly. It also keeps the nine cards
short enough to scan without heavy scrolling.

**Slides.** All of that puppy's photos in index order. Inactive slides are `display: none`, so the
browser never fetches a photo nobody advanced to.

**Controls.**

- Prev/next arrows overlaying the frame, hidden by default. Revealed on `:hover` or `:focus-within`
  under `@media (hover: hover)`; **always visible** under `@media (hover: none)`, because a
  hover-only control is an invisible control on a phone.
- A `3 / 9` counter pill, bottom-right, always visible in both modes — it is the only persistent
  signal that more photos exist. A dot row was rejected: it degrades past ~8 items and four puppies
  (Blue, Pink, Purple, Yellow) have 9.
- Swipe (pointer events, 30px threshold) and Left/Right arrow keys when the carousel has focus.

**Accessibility.** `role="group"` with `aria-roledescription="carousel"` and
`aria-label="Blue collar photos"`; buttons labelled "Previous photo of Blue" / "Next photo of Blue";
a visually-hidden `aria-live="polite"` region announcing "Photo 3 of 9". No autoplay — it fights the
lightbox and moves the picture out from under someone mid-look.

**Without JavaScript.** Controls are hidden by CSS until the script sets `data-ready` on the
carousel. The result degrades to a single static photo that still opens in the lightbox.

---

## 5. Lightbox scoping

Scoping falls out of where `.pswp-gallery` sits — **no change to `Lightbox.astro` is needed**.
PhotoSwipe binds one group per element matching `.pswp-gallery` and scopes `children` within it, so:

- **Carousel** — the class moves from `.cast` (the whole grid) down onto each card. Opening
  full-screen from Blue's card shows Blue's photos and nothing else. Slides hidden with
  `display: none` are still queried, so all nine are in the lightbox and it opens at the clicked index.
- **Gallery** — each section's `GalleryGrid` is already its own `.pswp-gallery`, so a click in the
  group-photos section stays within group photos. Chip filtering hides whole sections, which removes
  their photos from reach without any per-item flagging.

An earlier draft filtered with `a.pswp-item:not([data-filtered])`. Hiding whole sections makes that
unnecessary — dropped.

---

## 6. Gallery page

**Chips.** `All` plus the nine collar colors, each with its collar-colored swatch — the same cue as
the card nameplates. Real `<button>`s with `aria-pressed`. Group, Coco, and first-days deliberately
get no chip; the row stays one consistent kind of thing.

**All (default).** Sections with headings, in this order: Group photos → Coco → First days → the
nine puppies in `litter.md` order. Every non-puppy photo stays reachable without a chip of its own.

**A collar selected.** That puppy's flat grid, heading suppressed, all other sections hidden.

**URL.** The selected chip syncs to the hash (`/gallery#pink`) via `history.replaceState`, and the
hash is applied on load, so a filtered view is linkable.

**Without JavaScript.** The chip row does not render; every section shows. Still a complete,
sectioned gallery.

`GalleryGrid.astro` is reused unchanged for each section's grid.

---

## 7. Home page

`src/pages/index.astro` loses the "First days" section — those 11 photos now live in the gallery.
With nine carousels directly above it, a second photo grid on the front page pushed the waitlist CTA
too far down. The page becomes: hero → stats → Meet the cast (carousels) → CTA → subscribe.

The `litter/gallery/*` glob in `index.astro` is deleted along with it.

---

## 8. Error handling

- **Unknown subject folder / collar with no folder** — throws during the build with every offending
  name listed. Fails the deploy rather than shipping an empty card.
- **Malformed photo path** — `parsePhotoPath` throws naming the path.
- **Empty photo set for a puppy** — cannot happen; `assertKnownSubjects` catches it first.
- **Gallery hash naming an unknown collar** — falls back to `All` rather than an empty grid.
- **PhotoSwipe fails to load** — the `ZoomableImage` anchor's `href` still points at the large webp,
  so clicking a photo opens it directly. Unchanged from today.

---

## 9. Testing

**Unit (vitest) — `test/photos-paths.test.ts`:**

- `parsePhotoPath` on valid paths, and throwing on too-few/too-many segments
- `compareShoots`: dated descending; `pre-litter` sorts after every dated shoot
- `groupBySubject`: shoot order first, filename order within a shoot
- `assertKnownSubjects`: rejects an unknown subject; rejects a collar with no folder; passes the real set
- alt-text generation for each of the four subject kinds, dated and undated

**E2E (playwright) — extends `test/e2e/`:**

- Home: a card shows `1 / N`, clicking next advances the photo and the counter
- Home: arrows are reachable by keyboard
- Gallery: clicking the Pink chip leaves only Pink's photos visible and sets `#pink`
- Gallery: loading `/gallery#blue` directly applies the filter

**Manual:** confirm the downscaled photos look right before deleting the source folders.

---

## Files

**New:** `src/lib/photos/paths.ts`, `src/lib/photos/index.ts`, `src/components/PuppyCarousel.astro`,
`test/photos-paths.test.ts`, `src/assets/photos/**`

**Modified:** `src/components/PuppyCard.astro`, `src/pages/gallery.astro`, `src/pages/index.astro`,
`src/content.config.ts`, `src/content/litter/litter.md`, `test/e2e/`

**Unchanged:** `src/components/Lightbox.astro`, `src/components/GalleryGrid.astro`,
`src/components/ZoomableImage.astro`

**Deleted:** `src/assets/litter/collars/`, `src/assets/litter/gallery/`, `src/assets/gallery/`,
`src/assets/meet-the-pups/`, `src/assets/untitled folder/`, `src/assets/2026-07-23/`,
`src/assets/2026-07-24/`
