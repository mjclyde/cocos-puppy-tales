# Ad parity: pricing, the sire, and the raising story

**Date:** 2026-07-31
**Status:** Draft — awaiting review

## Problem

We posted a classifieds ad (Craigslist, Facebook Marketplace) for Coco's litter. The ad carries
substantially more information than the website it points people to:

| Ad content | Site today |
| --- | --- |
| Go-home date: August 20, 2026 | Absent everywhere — and it is 20 days out |
| $3,000, $250 deposit to hold a spot | Absent |
| What each puppy goes home with (6 items) | Absent |
| Parents' credentials — AKC, OFA, CHIC, pedigree | `/coco` has two vague lines |
| A sire exists | Site never mentions a second parent |
| Raising program — ENS, ESI, socialization, potty training | Absent; `/journey` stops at pregnancy week 8 |
| Health guarantee | Absent |
| Personality-matching offer | Half-echoed on `/waitlist` |

A visitor arriving from the ad expects the website to be the authoritative, fuller version and finds
less. That inverts the trust gradient at exactly the moment a family is weighing a $3,000 decision,
three weeks before the puppies leave.

## Goals

- Every fact in the ad has a home on the site, in the place a visitor would look for it.
- `/waitlist` answers "what would I be committing to?" *before* presenting the form.
- Both parents are visible with their health credentials.
- The home page conveys urgency (go-home date) and availability (which puppies are still open).
- The puppy-raising program becomes narrative rather than a bullet list.
- Price can be hidden site-wide by flipping one flag.

## Non-goals

- **No payment processing.** The deposit is arranged in conversation. No Stripe, no checkout, no
  deposit form. The site names accepted methods and nothing more.
- **No availability in a database.** Puppy status is content, edited and committed like everything
  else. A 20-day window does not justify making the cast cards dynamic.
- No changes to auth, admin, subscribe, or the waitlist API contract.
- No new top-level pages. Everything lands on pages that already exist.
- No public payment handles or phone numbers (see §3).

---

## 1. Content model

Facts land wherever they semantically belong. Per-litter facts go in `litter.md`; site-wide toggles
go in `site/config.json`; per-dog facts go in the `coco` collection.

### `src/content/litter/litter.md` — new frontmatter

```yaml
goHomeDate: 2026-08-20T06:00:00.000Z
price: 3000
deposit: 250
depositMethods: ["Cash", "Check", "Venmo", "Apple Pay"]
healthGuarantee: "A written health guarantee is included in your puppy contract."
goesHomeWith:
  - Vet exam and age-appropriate first shots
  - Dewormed on schedule
  - AKC registration papers
  - Leash, collar, and a blanket that smells like mama
  - A surprise keepsake
  - Quality kibble for the first week at home
```

Price and deposit are stored as **numbers**, formatted at render with `Intl.NumberFormat`. Storing
`"$3,000"` as a string would put presentation in content and break any future arithmetic.

### `collars[]` — new per-puppy field

```yaml
collars:
  - { name: "Blue",   hex: "#3b6fd6", sex: boy,  status: available, note: "…" }
  - { name: "Yellow", hex: "#e0b031", sex: boy,  status: reserved,  note: "…" }
  - { name: "Orange", hex: "#e8863b", sex: boy,  status: reserved,  note: "…" }
```

Schema: `status: z.enum(['available', 'reserved']).default('available')`. Defaulting to `available`
means the seven open collars need no edit, and a forgotten field fails safe — a puppy is shown as
open rather than silently hidden from interested families.

Current state: **Orange and Yellow reserved, seven available** (Blue, Black, Brown, Pink, Purple,
Red, Green).

### `src/content/site/config.json` — new flag

```json
"flags": { "showGallery": true, "showSubscribe": true, "showPricing": true }
```

Matches the existing flag convention. `showPricing` gates the price and deposit figures only — the
go-home date, what's-included list, and health guarantee always render, since those are not
sensitive and are the reason the block exists.

`dueDate` stays. It still drives the pre-birth branch of `index.astro`, which remains reachable if
`litter.published` is ever toggled off.

---

## 2. The sire — `/coco` becomes both parents

The `coco` collection is already a `glob` over `src/content/coco/**/*.md`. It is plural-capable
today; nothing has ever added a second file. The sire is one new markdown file.

**New:** `src/content/coco/sire.md`

The filename is `sire.md`, not `rocko.md`. His name's spelling is unverified, and a role-based
filename means a correction is a one-word content edit rather than a file rename plus a content-id
change.

### Schema change

The existing schema covers `name`, `breed`, `heroImage`, `personalityTraits`, `healthFacts`, and
`pedigree` — all of which fit the sire unchanged. One field is added:

```ts
role: z.enum(['dam', 'sire']).default('dam'),
```

`role` rather than a numeric `order` because it is semantic: it drives display order (dam first),
the section heading ("Mom" / "Dad"), and alt text. Defaulting to `dam` means `coco.md` needs no edit.

### Page change

`coco.astro` currently does `getEntry('coco', 'coco')` — hardcoded to one dog. It becomes
`getCollection('coco')` sorted dam-first, rendering the existing two-column portrait-plus-prose
layout once per parent.

Page title becomes "Meet the parents"; the nav entry stays **"Meet Coco"**, since she is the
recognizable name and the reason people are on the site.

### Portrait aspect ratio

Coco's hero is 1161×1451 (4:5 portrait). The sire photo is 1170×1148 (effectively square). Stacked
parent sections at mismatched ratios read as unpolished.

Fix in CSS, not on disk: `.parent-img { aspect-ratio: 4 / 5; object-fit: cover; }`. Non-destructive,
and it holds when either photo is later swapped for a better one.

### Health credentials

Per the ad, and per confirmation that the sire holds the same certifications, both parents get the
same `healthFacts` list:

```yaml
healthFacts:
  - AKC registered
  - Health tested
  - OFA certified — hips, elbows, eyes, and heart; DM normal; vWD cleared
  - CHIC certified (CHIC number available on request)
pedigree: "Advanced pedigree available on request."
```

This replaces Coco's current two lines ("Health-tested per Bernese breed recommendations", "Up to
date on vaccinations").

The two lists are intentionally duplicated per-dog rather than shared. Individual dogs carry
individual results and individual CHIC numbers, so per-dog is the correct shape even though the
values coincide today. **Consequence: verifying certifications means editing two files.** This is
recorded in §10.

---

## 3. Practical details — `/waitlist`

`/waitlist` currently drops visitors straight into a form. It gains a details block **above** the
form, so nobody applies without knowing the terms.

New component: `src/components/PuppyDetails.astro`

Renders, in order:

1. **Ready to come home** — August 20, 2026
2. **Price** — $3,000, with a $250 deposit to hold a spot *(gated on `flags.showPricing`)*
3. **Accepted for deposits** — cash, check, Venmo, or Apple Pay *(also gated on `flags.showPricing`
   — naming payment methods for a deposit whose amount is hidden reads as a non-sequitur, so items 2
   and 3 hide together as one unit)*
4. **Every puppy goes home with** — the six-item list
5. **Health guarantee** — one line, pointing at the contract
6. **How we raise them** — four-item condensed list (raised in our home, ENS, ESI, daily
   socialization and enrichment, potty training started) with a link to `/journey` for the full story
7. **Finding the right fit** — the personality-matching offer from the ad's closing paragraph

### Deposit process copy

"$250 holds a spot" without saying *how* creates a dead end at the conversion moment. The block
names the accepted methods and states the sequence explicitly: **we talk first, then we arrange the
deposit.** No amount is collected through the site.

**Security constraint:** the site lists payment *method names only*. No Venmo handle, no phone
number, no Apple Cash address. Breeder pages carrying payment handles are precisely what
puppy-scam impersonators scrape to pose as the seller. Those details belong in direct conversation.

### Condensed vs. full raising story

Item 6 above overlaps `/journey` by design, and is not duplication: `/waitlist` needs *proof at the
moment of decision*, `/journey` tells the *story over time*. The waitlist version is four bullets and
a link; the journey version is narrative with photos.

---

## 4. Availability — home page cast cards

`PuppyCard.astro` gains a `status` prop and renders a badge in the existing `.nameplate` row beside
the sex chip.

- `available` → no badge. Nine "Available" badges is visual noise, and open is the default state.
- `reserved` → a muted "Reserved" pill, plus `.pup { opacity: 0.75 }` on the card.

Reserved puppies stay visible and stay in the carousel. They are part of the litter's story, and
hiding them would make the cast contradict the litter stats (nine puppies, seven cards).

Above the cast grid, the existing "Nine collars, nine personalities" heading gains a count line:
**"Seven still looking for their families."** Derived from the collar data, never hand-written, so it
cannot drift out of sync with the badges.

Both the badge and the count come from the same `collars[]` array, so a single content edit moves
them together.

---

## 5. Go-home countdown — home page

`CountdownTimer.astro` already exists and is generic — it takes a `Date`, and `getCountdown` in
`src/lib/countdown.ts` already computes `isPast`. It currently renders **only** in the pre-birth
branch of `index.astro`, which is unreachable while `litter.published` is true. It is live code with
no live caller.

Changes:

- Rename its prop `dueDate` → `targetDate`. It now serves two different dates; the old name would be
  actively misleading in the go-home case. This means updating the **existing** call site in the
  pre-birth branch (`<CountdownTimer dueDate={dueDate} />`) as well as adding the new one — two
  call sites total, both in `index.astro`.
- Add an optional `pastLabel` prop.
- Render it in the litter branch beside the existing `LitterAge` badge, pointed at `goHomeDate`.

**Past state matters here.** A countdown that hits zero and sits at `00:00:00:00` looks broken. When
`isPast`, the component renders `pastLabel` instead of the digit grid — "The puppies are home! 🐾".
The existing `.is-past` class already fires; only the past-state markup is new.

Section copy: "Ready to go home" above the timer.

---

## 6. The raising story — `/journey`

`journey.astro` sorts on `data.week` descending. The moment a post-birth week 1 entry lands, it sorts
*below* pregnancy week 8 — the timeline silently runs backwards.

### Schema change

```ts
phase: z.enum(['pregnancy', 'puppies']).default('pregnancy'),
```

Defaulting to `pregnancy` means `week-06.md`, `week-07.md`, and `week-08.md` need no edit.

### Page change

Two grouped timelines, each sorted by `week` descending:

- **"The puppies"** (`phase: 'puppies'`) — first, newest at top
- **"Coco's pregnancy"** (`phase: 'pregnancy'`) — below, collapsed under its own heading

Page intro changes from "Weekly updates from Coco's pregnancy" to cover both. `UpdateCard`'s
`bellyPhoto` and `bellySizeComparison` are already optional, so puppy entries simply omit them. The
`Week {week}` chip needs phase-aware wording so a puppy week 3 does not read as a pregnancy week 3 —
puppy entries render "Week 3" against a distinct chip color, pregnancy entries keep the current
style.

### New entries

The ad's "About the Puppies" bullets are undated. Section 10 records that the week-by-week timing
needs confirmation. The proposed initial grouping, drawn strictly from the ad:

| Week | Date | Content |
| --- | --- | --- |
| 1 | Jun 25 | Born, weights, ENS and ESI begin, weight tracking |
| 3 | Jul 9 | Eyes open, socialization sounds, textured surfaces |
| 4 | Jul 16 | Puppy mush, first toys |
| 5 | Jul 23 | Many faces — toddlers, men with hats, great grandma; potty training begins |
| 7 | Aug 8 | Vet check, dewormed, first vaccinations, on to kibble |

Copy is written fresh from the bullets, not pasted. The ad's typos are not carried over: "inside
*out* home" → "inside our home", "daily love socialization" → "daily love, socialization", "life
long" → "lifelong".

---

## 7. Photos and assets

**Sire hero:** the supplied photo (1170×1148, 376 KB, JPEG) is committed as
`src/assets/sire-hero.jpg`. Under the 2048px long-edge cap, so no downscale. Sits beside
`coco-hero.jpg`, outside the `photos/` tree — consistent with how hero images are already handled.

**Additional sire photos** (optional, none supplied yet) would go at
`src/assets/photos/pre-litter/sire/sire-NN.jpg`. `pre-litter` is an existing undated shoot folder, so
this needs no new path rules.

`src/lib/photos/paths.ts` changes:

- `NON_PUPPY_SUBJECTS` — add `'sire'`
- `SECTION_TITLES` — add `sire: 'Dad'`
- `photoAlt` — add a `case 'sire'` arm returning a dated "Rocko" label

`assertKnownSubjects` only requires folders for *collars*, so adding `'sire'` to the non-puppy list
does not force a folder to exist. The gallery gains a "Dad" section only once photos are added.

Filenames use `sire-`, not `rocko-`, for the same spelling-safety reason as §2.

---

## 8. Navigation

`Nav.astro`: the `/waitlist` label changes from **"Waitlist"** to **"Bring one home."**

"Waitlist" does not signal that pricing and the go-home date live there. The **URL stays
`/waitlist`** — the ad is already published with links to it, and changing the path would break them
and discard accumulated SEO.

`/coco` keeps its "Meet Coco" label despite becoming a two-parent page (§2).

---

## 9. Testing

**Unit (vitest):**

- `photos-paths.test.ts` — extend for the `sire` subject: `photoAlt` returns a dated Dad label,
  `assertKnownSubjects` accepts a `sire` folder and still rejects unknown folders, and `SECTION_TITLES`
  covers every `NON_PUPPY_SUBJECTS` member.
- `countdown.test.ts` — extend for the past state now that `isPast` drives visible markup.
- New `availability.test.ts` — available-count derivation from `collars[]`: all available, some
  reserved, all reserved, singular wording, and immutability of the input.
- New `journey.test.ts` — grouping and per-group descending sort, including the regression this
  fixes: a puppy week 1 must not sort below a pregnancy week 8.
- New `format.test.ts` — currency formatting without cents, and long-date formatting that does not
  drift a day across time zones.

Test filenames mirror their lib module (`availability.ts` → `availability.test.ts`), matching the
existing `countdown.ts` → `countdown.test.ts` convention.

Availability counting and journey grouping are extracted into `src/lib/` as pure functions so they
are testable without rendering Astro components, matching how `countdown.ts` and `age.ts` are
already structured.

**E2E (playwright), `smoke.spec.ts`:**

- `/waitlist` shows the go-home date, `$3,000`, and `$250` with `showPricing` true.
- Price and deposit disappear with `showPricing` false while the go-home date and what's-included
  list survive — the flag's actual contract.
- `/coco` renders both parents.
- Home page shows two "Reserved" badges and the "Seven still looking" count.
- No page exposes a payment handle or phone number.

`npm run check` must pass — the schema additions touch typed frontmatter across four pages.

---

## 10. Open items

Recorded rather than resolved. None blocks implementation; all are content edits afterward.

1. **Sire's name spelling.** "Rocko" is unverified. Every file and folder is role-named (`sire.md`,
   `sire-hero.jpg`, `pre-litter/sire/`) so a correction touches content strings only. The name
   appears in `sire.md` frontmatter and the `photoAlt` sire arm.
2. **Both parents' OFA/CHIC results.** Published now as written in the ad, per explicit decision,
   with the understanding that these are health claims families rely on. Verification means editing
   `coco.md` and `sire.md` (§2).
3. **CHIC numbers** are "available on request" rather than printed. If they should be printed,
   that is a one-line edit per parent.
4. **Journey week timing** (§6). The ad's bullets are undated; the proposed grouping is a guess and
   needs correcting against what actually happened when.
5. **Sire's personality traits.** `personalityTraits` is required by the schema. Needs 2–3 words to
   match Coco's "Loving / Playful / Goofy."
6. **Availability upkeep.** Seven puppies open, 20 days to go-home. Each reservation is a content
   edit plus a commit. Accepted deliberately over a database (see Non-goals).
