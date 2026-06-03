# Coco's Puppy Nursery — Design Spec

**Date:** 2026-06-03
**Status:** Approved for Phase 1 planning
**Author:** Brainstormed with Claude

---

## 1. Overview

A public website to follow Coco — a Bernese Mountain Dog — through pregnancy, birth, and
raising her litter (vet estimates **at least 5 puppies**, due in **~3 weeks**). Coco's vibe:
loving, playful, goofy — "the best dog in the world."

The site serves **two goals equally**:

1. **Attract and vet good families** — a credible, professional place with breed info, a
   waitlist, and expectation-setting.
2. **Delight followers** — a fun, shareable place for family, friends, and future owners to
   obsess over the journey and keep coming back.

It is built to grow *with the puppies*: ship a small, polished launch now, then layer on
features as the litter arrives and grows.

---

## 2. Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Phasing strategy | **Nursery-first MVP**, grown over time | Puppies due in weeks; need something live fast, with architecture that supports later phases |
| Tech stack | **Astro + Vercel** | Content-heavy site with islands of interactivity; fast, great SEO, cheap hosting; dev wants to learn Astro |
| Content workflow | **Developer edits files + `git push`** | No admin panel needed; wife sends photos/text, dev publishes |
| Audience/access | **Public site, gated extras later** | Maximize reach + sharing; protect cam/location behind a shared password in later phases |
| Visual style | **Modern & Playful** (Nunito, rounded, bright) | Matches Coco's playful/goofy energy; social-native and friendly |
| Palette | **Bernese tricolor + navy/sage/honey** (see §7) | Rooted in Coco's coat; navy + sage primary, honey as a careful accent |
| Waitlist storage | **Supabase** (`waitlist` table) | User-submitted data needs server-writable storage; later phases (voting, draft board) require a DB anyway — stand it up once |
| Subscribe-for-updates | **Newsletter service** (e.g. Buttondown) | Bulk email needs unsubscribe/deliverability/compliance handled for us; least to build/maintain |

---

## 3. Architecture

**Static-first Astro site on Vercel.** Almost every page is pre-rendered HTML (fast, SEO-friendly).
Interactivity is opt-in via Astro islands. User-submitted data goes through serverless API routes
to Supabase or an external service.

```
src/
  content/                # typed, schema-validated content collections (files, dev-edited)
    coco/                 # Coco's bio, personality, health/pedigree (single entry)
    journey/              # one markdown file per weekly pregnancy update
    breed/                # Bernese info + "what to expect"
    site/                 # global config: due date, social links, contact, feature flags
    # reserved for later phases: puppies/, milestones/, blog/
  components/             # small, focused: Hero, CountdownTimer, UpdateCard,
                          # GalleryGrid, WaitlistForm, SubscribeForm, Nav, Footer
  layouts/               # shared page shell: <head>/SEO/OG, nav, footer
  pages/                 # one file per route (see §6) + api/ serverless routes
    api/
      waitlist.ts         # POST → validate (zod) → insert into Supabase
      subscribe.ts        # POST → forward to newsletter service API
  styles/                # design tokens (palette/spacing as CSS variables)
  assets/                # images optimized via Astro <Image>
public/                  # favicon, static OG image, robots, sitemap
```

**Interactivity (islands):** Only the **CountdownTimer** hydrates in Phase 1 (`client:load`),
reading the due date from `site` config. The waitlist and subscribe forms are progressively
enhanced and POST to API routes. Everything else is static HTML.

**Deployment:** Git push → Vercel auto-deploys. Vercel adapter enables the API routes.

**Secrets:** Supabase service key and newsletter API key live in Vercel environment variables,
used server-side only (never shipped to the client).

---

## 4. Content Model (Astro Content Collections)

Files the developer edits; validated by Zod schemas at build time.

- **`coco`** (single): `name`, `breed`, `bio` (markdown), `personalityTraits[]`, `healthFacts[]`,
  `pedigree?`, `heroImage`.
- **`journey`** (many; one file per update): `week` (number), `date`, `title`, `body` (markdown),
  `bellyPhoto?`, `bellySizeComparison?` (e.g. "Watermelon 🍉"), `published` (bool).
  Listed newest-first.
- **`breed`** (single or few sections): `body` (markdown) covering breed overview + honest
  "what owning a Bernese is like" expectations.
- **`site`** (single config): `dueDate`, `litterEstimate`, `socialLinks[]`, `contactEmail`,
  `featureFlags` (e.g. toggle gallery/sections on/off).

> Adding a weekly update = drop a markdown file in `content/journey/`, add the photo, `git push`.

---

## 5. Data Model (Supabase)

Phase 1 introduces one table. Later phases add more to the same project.

**`waitlist`**
- `id` (uuid, pk), `created_at` (timestamp)
- `name`, `email`, `phone?`, `location` (city/state)
- `about` (text — their home/family)
- `preferences?` (color/sex interest)
- `read_expectations` (bool — confirms they read the breed page)
- `source?` (text — where they heard about Coco)

**Security:** Inserts happen only via the server-side API route using the service key.
Row-level security blocks public reads. A honeypot field on the form provides basic spam
protection. (Subscribers are owned by the newsletter service, not stored here.)

*Reserved for later phases:* `votes` / `rankings` (Phase 4), `puppies` (may stay in content
collections; revisit if editing frequency warrants a DB).

---

## 6. Phase 1 Pages

1. **Home (`/`)** — Hero (large Coco photo, "Coco's Puppy Nursery", warm tagline), live
   **countdown** to due date, teaser links to Journey + Waitlist + Subscribe.
2. **Meet Coco (`/coco`)** — Her story, personality, photos, health/pedigree facts that build trust.
3. **The Journey (`/journey`)** — Weekly pregnancy updates, newest first. Each: week #, what's
   happening with the pups, a Coco note, belly photo, belly-size comparison.
4. **The Breed (`/breed`)** — Bernese overview + honest "what to expect" expectations. Doubles as
   buyer-vetting.
5. **Waitlist (`/waitlist`)** — On-brand form → Supabase. Captures interested families with light
   vetting questions (see §5).
6. **Gallery (`/gallery`)** — Simple, pretty photo gallery of Coco.

**Global:** Shared header/nav + footer (contact, social links), consistent branding, mobile-first,
SEO (per-page titles/descriptions), default Open Graph image so shared links look great, sitemap,
favicon. A **Subscribe-for-updates** form (newsletter service) appears in the footer and/or as a
section on Home + Journey, for people who want to follow the story without joining the waitlist.

---

## 7. Visual Identity

- **Style:** Modern & Playful — bright, rounded, friendly, social-native.
- **Typography:** Nunito (rounded sans), heavy weights for headlines.
- **Palette** (lean on ~3 dominant colors — cream, charcoal, navy — with brown/sage/honey as
  accents used carefully):

  | Token | Hex | Role |
  |---|---|---|
  | Charcoal | `#2b2926` | Primary text / dark surfaces |
  | Warm brown | `#a86b43` | Secondary accent (rust-coat nod) |
  | Cream | `#f7efe1` | Page background / canvas |
  | Sage | `#6f8f5e` | Highlight / chips |
  | Navy | `#2f4156` | Deep anchor / headings / avatars |
  | Honey | `#e9b949` | Sparing pop (buttons, paw accents) |

- **Tone of voice:** Warm, playful, a little goofy — channels "the best dog in the world."
- Rounded cards, soft shadows, generous whitespace, emoji used tastefully (🐾 🍼).

---

## 8. Non-Functional Requirements

- **Performance:** Static HTML, optimized images (Astro `<Image>`), minimal JS (only the
  countdown island). Target fast loads on mobile.
- **SEO/Sharing:** Per-page meta, Open Graph + Twitter card with a Coco hero image, sitemap.
- **Accessibility:** Semantic HTML, sufficient color contrast (verify navy/charcoal on cream and
  text on honey), alt text on all photos, keyboard-navigable forms.
- **Privacy:** No home address or location-precise info public. Form data stored securely in
  Supabase with RLS; subscriber emails owned by the newsletter service.
- **Error handling:** Forms validate input client- and server-side, show friendly success/error
  states, never silently fail.

---

## 9. Phased Roadmap

| Phase | Goal | Includes | Data/Infra added |
|---|---|---|---|
| **1 — Nursery (now)** | Credible, polished launch | Home + countdown · Meet Coco · Journey · Breed · Waitlist · Gallery · Subscribe · SEO/OG | Astro+Vercel, content collections, Supabase (`waitlist`), newsletter service |
| **2 — At birth** | Introduce the pups | Puppy profiles + photo timelines, "Meet the Puppies" | `puppies` collection |
| **3 — As they grow** | Retention | Growth/weight tracker + charts, milestone checklist, adventure blog, Puppy School | growth/milestone data |
| **4 — Fun/viral** | Shareability | Name generator, personality quiz, trading cards, draft board | `votes`/`rankings` (Supabase) |
| **5 — Live** | Real-time delight | Puppy cam (gated), community voting | gating middleware, cam stream service |

Only Phase 1 is fully specified here. Later phases are sketched so the architecture supports them
without rework.

---

## 10. Out of Scope (Phase 1)

Puppy profiles, growth tracker, milestones, adventure blog, Puppy School, puppy cam, community
voting, personality quiz, name generator, trading cards, draft board, any admin UI, any gating/
password protection.

---

## 11. Decisions Deferred to Implementation

- Specific newsletter service (Buttondown vs. ConvertKit vs. Mailchimp) — leaning Buttondown.
- Whether the on-brand subscribe form posts directly to the service or via an API route for styling.
- Exact waitlist vetting questions / wording.
- Whether to add lightweight spam protection beyond a honeypot (e.g. hCaptcha) on the forms.
