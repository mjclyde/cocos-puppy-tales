---
target: birth-announcement design (/litter + homepage flip)
total_score: 36
p0_count: 0
p1_count: 3
timestamp: 2026-07-07T19-52-50Z
slug: src-pages-litter-astro
---
Method: dual-agent (A: design-review · B: detector + browser evidence) — isolated & parallel. Target: pre-implementation design (companion mockups + shipping design system).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|:---:|-----------|
| 1 | Visibility of System Status | 3 | `/litter` drops the homepage's live days-old counter; all frozen birth-day stats |
| 2 | Match System / Real World | 4 | "Meet the cast," collar names, warm plain language |
| 3 | User Control & Freedom | 4 | Easy to leave; cast cards *look* clickable but have no action |
| 4 | Consistency & Standards | 3 | Nav 6→7 links; stat band mixes counts with a weight *range* |
| 5 | Error Prevention | 4 | n/a — no input on this page (form lives on /waitlist) |
| 6 | Recognition Rather Than Recall | 4 | 18px collar dot too small to recognize a color |
| 7 | Flexibility & Efficiency | 4 | Shareable /litter + homepage banner = right IA |
| 8 | Aesthetic & Minimalist Design | 2 | 3 stacked eyebrows, redundant eyebrow/h2 pairs, "14–20 oz" noise, "Note to come" placeholders |
| 9 | Error Recovery | 4 | n/a — no error states |
| 10 | Help & Documentation | 4 | n/a — announcement page |
| **Total** | | **36/40** | **Good** |

## Anti-Patterns Verdict

**LLM assessment:** Partial slop — the palette and the gender-pastel idea are real and rescue it, but the AI landing-page skeleton fires: three stacked tracked-uppercase eyebrows, a hero-metric stat band, an identical 9-card grid, and emoji doing the emotional work type/color should. Shared absolute bans (side-stripe, gradient text, glass) are clean.

**Deterministic scan:** `detect.mjs` exit 0, **0 findings** on both mockups — no banned patterns present. Agreement point: the *bans* are clean; the slop here is **compositional cadence**, which a regex detector structurally can't catch — the design review caught what the scanner can't.

**Visual overlays:** No persistent in-page overlay was injected. Both assessors captured desktop (1280) + mobile (390) screenshots instead — so there's no live overlay in your browser to look at.

## Overall Impression

Structurally right, emotionally under-powered. The IA is correct and it drops into your system cleanly — but it currently celebrates the biggest moment the site will ever show more *quietly* than your everyday homepage, and the collar system (the litter's whole identity) is nearly invisible. Single biggest opportunity: **make the collar color the star.**

## What's Working

1. **Gender pastel-coding** — a real idea, executed consistently from stat cards to sex chips, without inventing colors.
2. **The IA** — dedicated shareable `/litter` + homepage banner flip is the correct structure.
3. **System fit** — navy/cream/honey/sage, pill chips, `--radius` cards, sage CTA all mirror `tokens.css`; low implementation risk.

## Priority Issues

**[P1] Collar color is buried by the identical card grid.** Both assessors' #1. Newborn Berners look near-identical in photos, so the collar color *is* each pup's identity — yet it's an 18px corner dot. It's simultaneously the "identical grid" AI tell and a real recognition/accessibility failure. **Fix:** make the collar color the card's primary driver (full-width colored header/nameplate or thick color band), and name it in text ("Blue collar") for colorblind/screen-reader users. *Command: /impeccable layout.*

**[P1] Measured contrast failures.** Both agents agree: gender stat labels (charcoal @70% opacity on pastel) ≈ **4.0 (blue) / 4.2 (pink)**; CTA subtext (white @95% on sage) ≈ **3.45**; brown eyebrow on white **4.33** — all under 4.5:1 AA; smallest type is 9.6px. **Fix:** full-opacity charcoal labels (jumps to ~7.9), darken sage CTA bg or switch subtext to cream, lift min type to ≥12px, fix the eyebrow brand-wide (it's in `UpdateCard.astro` too). *Command: /impeccable audit → harden.*

**[P1] AI-slop cadence — trim the eyebrows.** Three stacked uppercase eyebrows, two redundant with their own h2 ("FIRST DAYS" over "Photo gallery" adds nothing). **Fix:** keep at most one as a genuine divider; let the h2s carry the sections. *Command: /impeccable distill / typeset.*

**[P2] The peak is under-scaled.** Hero h1 renders at 1.9rem — *smaller* than the evergreen homepage hero (3.2rem); the birth date is buried in a subhead; the desktop hero floats in an empty cream void. **Fix:** scale h1 to true hero size, promote "June 25" to a proud standalone element, and bring the live **days-old counter** onto `/litter` so the moment feels alive, not frozen. *Command: /impeccable bolder / layout.*

**[P2] Content/data risks.** (a) The homepage-flip mockup shows **"5 girls / 4 boys" — swapped** (real = 5 boys / 4 girls; lock it in the spec). (b) `/litter` ships "Note to come ✍️" on Brown, Yellow, Red — write all 9 notes or omit the note line until ready; don't ship placeholders. Also fold in: the **"14–20 oz" stat card is a category error** (a range in a counter's clothing) — move weight into the birth-story prose and keep 3 clean count cards.

## Persona Red Flags

**Jordan (first-timer, desktop):** undersold hero (small h1/pill, empty cream void); stumbles on "14–20 oz" among counters; cast cards carry click-affordance (border/shadow) but do nothing.

**Casey (distracted mobile, one-handed):** 7-item hamburger; the one CTA sits below ~5 rows of large cards; the orphaned full-width "14–20 OZ" bar on mobile is a false affordance under the thumb; verify the real `.btn` clears the 44px target (mockup span was ~30–36px).

**Sam (screen reader / low vision):** gender labels + CTA subtext fail AA; collar color is a dot with **no text** — colorblind/SR users can't tell Blue from Black from Purple, so the color must be named; ♂/♀ glyphs are saved only by the adjacent "boy/girl" words; heading order is clean.

## Minor Observations

- Mockup nav (4 links) under-represents the real nav (6→7) — validate the 7-item hamburger + desktop row against `Nav.astro`.
- 2-col mobile orphans "Green" alone on the last row; consider centering.
- Gallery: decide between reusing `GalleryGrid.astro` (auto-fill) and the mockup's 4-col grid — they look noticeably different. Pick intentionally.
- Keep the en-dash typographic care; just move the emphasis off the weight range.

## Questions to Consider

1. If you deleted every emoji, would the page still feel joyful — or is 🎉💕🐶 doing the work the typography, scale, and color should?
2. If the collar color *were* the card, would you even need the puppy photo to tell them apart?
3. This is the happiest moment your site will ever show — why does its headline render *smaller* than the everyday homepage hero, and where's the goosebump?
