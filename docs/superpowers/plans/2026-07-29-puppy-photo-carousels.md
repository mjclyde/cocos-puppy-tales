# Per-Puppy Photo Carousels and Filterable Gallery — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn each "Meet the cast" card into a carousel of that puppy's complete photo history, and give the gallery per-puppy filtering, backed by one consolidated photo tree.

**Architecture:** All 137 photos move under `src/assets/photos/<shoot>/<subject>/`. A pure module (`src/lib/photos/paths.ts`) owns parsing, ordering, validation, and alt text; a thin wrapper (`src/lib/photos/index.ts`) runs `import.meta.glob` over the tree and hands typed `Photo` objects to the pages. The home page renders a `PuppyCarousel` per card; the gallery renders one section per subject with collar chips that hide non-matching sections.

**Tech Stack:** Astro 6 (static output), TypeScript, Zod content collections, PhotoSwipe v5, vitest, Playwright, `sips` (macOS, built in) for the one-time photo migration.

**Spec:** `docs/superpowers/specs/2026-07-29-puppy-photo-carousels-design.md`

## Global Constraints

- Node >= 24.0.0. Astro `output: "static"` — every page in this plan is prerendered; do not add `prerender = false` anywhere.
- Run `npm run check` (astro check) before every commit. It must pass with 0 errors.
- Run `npm test` (vitest) before every commit once Task 1 lands.
- Never mutate inputs — return new objects (`{ ...x, y }`, `[...xs]`).
- No `console.log` in `src/`.
- Conventional commit messages (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`). **Never add `Co-Authored-By` lines.**
- Subject folder names are lowercase: the nine collar colors plus `group`, `coco`, `first-days`.
- Shoot folder names are either an ISO date (`2026-07-23`) or an undated slug (`pre-litter`).
- Photo filenames are `<subject>-NN.jpg`, zero-padded from 01, lowercase `.jpg` only.
- Max photo long edge is 2048px.
- Reuse the existing `.visually-hidden` class from `src/styles/global.css:40` for screen-reader-only text. `.pswp-item { display: contents; }` is already global (`global.css:44`) — carousel and grid CSS must not assume the anchor creates a layout box.

---

### Task 1: Pure photo-path logic

The parsing, ordering, validation, and alt-text rules, with no Vite, Astro, or image imports — so they can be unit-tested with plain strings.

**Files:**
- Create: `src/lib/photos/paths.ts`
- Test: `test/photos-paths.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface PhotoRef { shoot: string; subject: string; file: string }`
  - `const NON_PUPPY_SUBJECTS: readonly ['group', 'coco', 'first-days']`
  - `type NonPuppySubject = typeof NON_PUPPY_SUBJECTS[number]`
  - `const SECTION_TITLES: Record<NonPuppySubject, string>`
  - `parsePhotoPath(path: string): PhotoRef`
  - `isDatedShoot(shoot: string): boolean`
  - `compareShoots(a: string, b: string): number`
  - `comparePhotos(a: PhotoRef, b: PhotoRef): number`
  - `groupBySubject<T extends PhotoRef>(refs: T[]): Record<string, T[]>`
  - `assertKnownSubjects(subjects: string[], collarNames: string[]): void`
  - `shootLabel(shoot: string): string | null`
  - `photoAlt(ref: PhotoRef, collarDisplayName?: string): string`

---

- [ ] **Step 1: Write the failing tests for parsing, ordering, and grouping**

Create `test/photos-paths.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  parsePhotoPath,
  isDatedShoot,
  compareShoots,
  comparePhotos,
  groupBySubject,
} from '../src/lib/photos/paths';

describe('parsePhotoPath', () => {
  it('splits a glob key into shoot, subject, and file', () => {
    expect(parsePhotoPath('../../assets/photos/2026-07-23/blue/blue-01.jpg')).toEqual({
      shoot: '2026-07-23',
      subject: 'blue',
      file: 'blue-01.jpg',
    });
  });

  it('handles an absolute path just as well', () => {
    expect(parsePhotoPath('/repo/src/assets/photos/pre-litter/coco/coco-07.jpg')).toEqual({
      shoot: 'pre-litter',
      subject: 'coco',
      file: 'coco-07.jpg',
    });
  });

  it('throws when the path is not under src/assets/photos', () => {
    expect(() => parsePhotoPath('../../assets/litter/hero.jpg')).toThrow(/not under/i);
  });

  it('throws when the path is missing a subject folder', () => {
    expect(() => parsePhotoPath('../../assets/photos/2026-07-23/blue-01.jpg')).toThrow(
      /shoot\/subject\/file/i,
    );
  });

  it('throws when the path is nested too deeply', () => {
    expect(() => parsePhotoPath('../../assets/photos/2026-07-23/blue/extra/blue-01.jpg')).toThrow(
      /shoot\/subject\/file/i,
    );
  });
});

describe('isDatedShoot', () => {
  it('accepts an ISO date folder', () => {
    expect(isDatedShoot('2026-07-23')).toBe(true);
  });

  it('rejects a slug folder', () => {
    expect(isDatedShoot('pre-litter')).toBe(false);
  });

  it('rejects a partial date', () => {
    expect(isDatedShoot('2026-07')).toBe(false);
  });
});

describe('compareShoots', () => {
  it('puts the newer dated shoot first', () => {
    expect(compareShoots('2026-07-24', '2026-07-23')).toBeLessThan(0);
    expect(compareShoots('2026-06-26', '2026-07-07')).toBeGreaterThan(0);
  });

  it('puts undated shoots after every dated shoot', () => {
    expect(compareShoots('pre-litter', '2026-07-24')).toBeGreaterThan(0);
    expect(compareShoots('2026-06-26', 'pre-litter')).toBeLessThan(0);
  });

  it('orders two undated shoots alphabetically', () => {
    expect(compareShoots('archive', 'pre-litter')).toBeLessThan(0);
  });

  it('sorts a real shoot list newest first, undated last', () => {
    const shoots = ['2026-06-26', 'pre-litter', '2026-07-24', '2026-07-07', '2026-07-23'];
    expect([...shoots].sort(compareShoots)).toEqual([
      '2026-07-24',
      '2026-07-23',
      '2026-07-07',
      '2026-06-26',
      'pre-litter',
    ]);
  });
});

describe('comparePhotos', () => {
  const ref = (shoot: string, file: string) => ({ shoot, subject: 'blue', file });

  it('orders by shoot before filename', () => {
    expect(comparePhotos(ref('2026-07-24', 'blue-09.jpg'), ref('2026-07-23', 'blue-01.jpg'))).toBeLessThan(0);
  });

  it('falls back to filename within one shoot', () => {
    expect(comparePhotos(ref('2026-07-24', 'blue-01.jpg'), ref('2026-07-24', 'blue-02.jpg'))).toBeLessThan(0);
  });
});

describe('groupBySubject', () => {
  it('groups by subject and sorts each list newest shoot first', () => {
    const refs = [
      { shoot: '2026-07-07', subject: 'blue', file: 'blue-01.jpg' },
      { shoot: '2026-07-24', subject: 'pink', file: 'pink-02.jpg' },
      { shoot: '2026-07-24', subject: 'blue', file: 'blue-02.jpg' },
      { shoot: '2026-07-24', subject: 'blue', file: 'blue-01.jpg' },
      { shoot: '2026-07-23', subject: 'blue', file: 'blue-01.jpg' },
    ];

    const grouped = groupBySubject(refs);

    expect(Object.keys(grouped).sort()).toEqual(['blue', 'pink']);
    expect(grouped.blue.map((r) => `${r.shoot}/${r.file}`)).toEqual([
      '2026-07-24/blue-01.jpg',
      '2026-07-24/blue-02.jpg',
      '2026-07-23/blue-01.jpg',
      '2026-07-07/blue-01.jpg',
    ]);
  });

  it('does not mutate the input array', () => {
    const refs = [
      { shoot: '2026-07-07', subject: 'blue', file: 'blue-01.jpg' },
      { shoot: '2026-07-24', subject: 'blue', file: 'blue-01.jpg' },
    ];
    const snapshot = refs.map((r) => r.shoot);

    groupBySubject(refs);

    expect(refs.map((r) => r.shoot)).toEqual(snapshot);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/photos-paths.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/photos/paths"`.

- [ ] **Step 3: Implement parsing, ordering, and grouping**

Create `src/lib/photos/paths.ts`:

```ts
/**
 * Pure helpers for the `src/assets/photos/<shoot>/<subject>/<file>` tree.
 *
 * Deliberately free of Astro/Vite imports so the ordering and validation rules
 * can be unit-tested with plain strings.
 */

const PHOTOS_ROOT = '/assets/photos/';
const DATED_SHOOT = /^\d{4}-\d{2}-\d{2}$/;

export interface PhotoRef {
  shoot: string;
  subject: string;
  file: string;
}

/** Subjects that are not a single puppy. Also the display order of their gallery sections. */
export const NON_PUPPY_SUBJECTS = ['group', 'coco', 'first-days'] as const;
export type NonPuppySubject = (typeof NON_PUPPY_SUBJECTS)[number];

export const SECTION_TITLES: Record<NonPuppySubject, string> = {
  group: 'Group photos',
  coco: 'Coco',
  'first-days': 'First days',
};

/** Split a photo path (glob key or absolute) into its shoot/subject/file parts. */
export function parsePhotoPath(path: string): PhotoRef {
  const start = path.indexOf(PHOTOS_ROOT);
  if (start === -1) {
    throw new Error(`Photo path is not under src/assets/photos: ${path}`);
  }
  const segments = path.slice(start + PHOTOS_ROOT.length).split('/');
  if (segments.length !== 3) {
    throw new Error(`Photo path must be shoot/subject/file under src/assets/photos: ${path}`);
  }
  const [shoot, subject, file] = segments;
  return { shoot, subject, file };
}

/** True for an ISO-dated shoot folder like `2026-07-23`. */
export function isDatedShoot(shoot: string): boolean {
  return DATED_SHOOT.test(shoot);
}

/** Dated shoots newest first; undated shoots last, alphabetically among themselves. */
export function compareShoots(a: string, b: string): number {
  const aDated = isDatedShoot(a);
  const bDated = isDatedShoot(b);
  if (aDated !== bDated) return aDated ? -1 : 1;
  if (!aDated) return a.localeCompare(b);
  return b.localeCompare(a);
}

/** Shoot order first, then filename — which is why filenames are zero-padded. */
export function comparePhotos(a: PhotoRef, b: PhotoRef): number {
  const byShoot = compareShoots(a.shoot, b.shoot);
  return byShoot !== 0 ? byShoot : a.file.localeCompare(b.file);
}

/** Group photos by subject, each list in display order. Does not mutate `refs`. */
export function groupBySubject<T extends PhotoRef>(refs: T[]): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};
  for (const ref of [...refs].sort(comparePhotos)) {
    grouped[ref.subject] = [...(grouped[ref.subject] ?? []), ref];
  }
  return grouped;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/photos-paths.test.ts`
Expected: PASS — 16 tests.

- [ ] **Step 5: Write the failing tests for validation and alt text**

Append to `test/photos-paths.test.ts`, and extend the import at the top of the file to:

```ts
import {
  parsePhotoPath,
  isDatedShoot,
  compareShoots,
  comparePhotos,
  groupBySubject,
  assertKnownSubjects,
  shootLabel,
  photoAlt,
} from '../src/lib/photos/paths';
```

```ts
const COLLARS = ['Blue', 'Black', 'Brown', 'Yellow', 'Orange', 'Pink', 'Purple', 'Red', 'Green'];

describe('assertKnownSubjects', () => {
  const allSubjects = [...COLLARS.map((c) => c.toLowerCase()), 'group', 'coco', 'first-days'];

  it('accepts the real subject set', () => {
    expect(() => assertKnownSubjects(allSubjects, COLLARS)).not.toThrow();
  });

  it('rejects a subject folder that is neither a collar nor a known extra', () => {
    expect(() => assertKnownSubjects([...allSubjects, 'teal'], COLLARS)).toThrow(/teal/);
  });

  it('rejects a collar that has no photo folder', () => {
    const missingGreen = allSubjects.filter((s) => s !== 'green');
    expect(() => assertKnownSubjects(missingGreen, COLLARS)).toThrow(/green/);
  });

  it('reports both problems at once', () => {
    const broken = [...allSubjects.filter((s) => s !== 'red'), 'teal'];
    expect(() => assertKnownSubjects(broken, COLLARS)).toThrow(/teal[\s\S]*red|red[\s\S]*teal/);
  });

  it('matches collars case-insensitively', () => {
    expect(() => assertKnownSubjects(allSubjects, ['BLUE', 'Black', 'Brown', 'Yellow', 'Orange', 'Pink', 'Purple', 'Red', 'Green'])).not.toThrow();
  });
});

describe('shootLabel', () => {
  it('formats a dated shoot in US long form', () => {
    expect(shootLabel('2026-07-23')).toBe('July 23, 2026');
  });

  it('does not drift a day due to local time zone', () => {
    expect(shootLabel('2026-01-01')).toBe('January 1, 2026');
  });

  it('returns null for an undated shoot', () => {
    expect(shootLabel('pre-litter')).toBeNull();
  });
});

describe('photoAlt', () => {
  it('names the collar and the shoot date for a puppy', () => {
    expect(photoAlt({ shoot: '2026-07-23', subject: 'blue', file: 'blue-01.jpg' }, 'Blue')).toBe(
      'Blue collar puppy — July 23, 2026',
    );
  });

  it('describes a group shot', () => {
    expect(photoAlt({ shoot: '2026-07-24', subject: 'group', file: 'group-01.jpg' })).toBe(
      "Coco's litter — July 24, 2026",
    );
  });

  it('describes a first-days candid without a date', () => {
    expect(photoAlt({ shoot: '2026-06-26', subject: 'first-days', file: 'first-days-01.jpg' })).toBe(
      "Coco's puppies in their first few days",
    );
  });

  it('dates a Coco photo when the shoot is dated', () => {
    expect(photoAlt({ shoot: '2026-07-24', subject: 'coco', file: 'coco-01.jpg' })).toBe(
      'Coco — July 24, 2026',
    );
  });

  it('omits the date for an undated Coco photo', () => {
    expect(photoAlt({ shoot: 'pre-litter', subject: 'coco', file: 'coco-01.jpg' })).toBe('Coco');
  });

  it('throws for a subject it cannot describe', () => {
    expect(() => photoAlt({ shoot: '2026-07-24', subject: 'teal', file: 'teal-01.jpg' })).toThrow(/teal/);
  });
});
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npx vitest run test/photos-paths.test.ts`
Expected: FAIL — `assertKnownSubjects is not a function` (and the same for `shootLabel`, `photoAlt`).

- [ ] **Step 7: Implement validation and alt text**

Append to `src/lib/photos/paths.ts`:

```ts
/**
 * Fail the build when the photo tree and `litter.md` disagree. A typo'd folder
 * would otherwise silently empty a puppy's card, which is invisible in a diff.
 */
export function assertKnownSubjects(subjects: string[], collarNames: string[]): void {
  const collars = new Set(collarNames.map((name) => name.toLowerCase()));
  const present = new Set(subjects);

  const unknown = [...new Set(subjects)]
    .filter((s) => !collars.has(s) && !NON_PUPPY_SUBJECTS.includes(s as NonPuppySubject))
    .sort();
  const missing = [...collars].filter((c) => !present.has(c)).sort();

  if (unknown.length === 0 && missing.length === 0) return;

  const problems = [
    unknown.length > 0 ? `unknown photo subject folder(s): ${unknown.join(', ')}` : '',
    missing.length > 0 ? `collar(s) with no photo folder: ${missing.join(', ')}` : '',
  ].filter(Boolean);

  throw new Error(`src/assets/photos is misconfigured — ${problems.join('; ')}`);
}

/** `2026-07-23` → `July 23, 2026`. Undated shoots have no label. */
export function shootLabel(shoot: string): string | null {
  if (!isDatedShoot(shoot)) return null;
  return new Date(`${shoot}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Generated alt text. Pass `collarDisplayName` for a puppy subject; omit it for
 * `group`/`coco`/`first-days`.
 */
export function photoAlt(ref: PhotoRef, collarDisplayName?: string): string {
  const label = shootLabel(ref.shoot);
  const dated = (base: string) => (label ? `${base} — ${label}` : base);

  if (collarDisplayName) return dated(`${collarDisplayName} collar puppy`);

  switch (ref.subject) {
    case 'group':
      return dated("Coco's litter");
    case 'first-days':
      return "Coco's puppies in their first few days";
    case 'coco':
      return dated('Coco');
    default:
      throw new Error(`Cannot build alt text for unknown subject: ${ref.subject}`);
  }
}
```

- [ ] **Step 8: Run the full unit suite**

Run: `npm test`
Expected: PASS — all existing suites plus 30 tests in `photos-paths`.

- [ ] **Step 9: Type-check**

Run: `npm run check`
Expected: `0 errors`.

- [ ] **Step 10: Commit**

```bash
git add src/lib/photos/paths.ts test/photos-paths.test.ts
git commit -m "feat: add pure photo-path parsing, ordering, and validation helpers"
```

---

### Task 2: Migrate the photos on disk

Build `src/assets/photos/` from the five existing sources. **Copies only** — nothing is deleted here, so the build stays green and the old globs keep working until Tasks 4 and 5 replace them.

**Files:**
- Create: `scripts/migrate-photos.sh` (one-shot, deleted in Task 6)
- Create: `src/assets/photos/**` (137 `.jpg` files)
- Read-only sources: `src/assets/2026-07-23/`, `src/assets/2026-07-24/`, `src/assets/litter/collars/`, `src/assets/litter/gallery/`, `src/assets/gallery/`

**Interfaces:**
- Consumes: nothing.
- Produces: the on-disk tree that Task 3's glob reads. Exact layout in Step 4's expected output.

---

- [ ] **Step 1: Write the migration script**

Create `scripts/migrate-photos.sh`:

```bash
#!/usr/bin/env bash
# One-shot migration into src/assets/photos/<shoot>/<subject>/<subject>-NN.jpg.
# macOS only — uses the built-in `sips` and `mdls`. Copies; deletes nothing.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=src/assets
DEST=src/assets/photos
COLLARS="blue black brown yellow orange pink purple red green"
MAX_EDGE=2048

# Copy one file to DEST/<shoot>/<subject>/<subject>-NN.jpg, downscaling only when
# it is oversized. `sips -Z` UPSCALES anything smaller than the target, which would
# blur the three sub-2048px Coco photos — hence the branch.
emit() {
  local src="$1" shoot="$2" subject="$3" n="$4" dir out long
  dir="$DEST/$shoot/$subject"
  mkdir -p "$dir"
  out="$(printf '%s/%s-%02d.jpg' "$dir" "$subject" "$n")"
  long="$(sips -g pixelWidth -g pixelHeight "$src" \
          | awk '/pixelWidth/{w=$2}/pixelHeight/{h=$2}END{print (w>h?w:h)}')"
  if [ "$long" -gt "$MAX_EDGE" ]; then
    sips -s format jpeg -s formatOptions 82 -Z "$MAX_EDGE" "$src" --out "$out" >/dev/null
  else
    sips -s format jpeg -s formatOptions 82 "$src" --out "$out" >/dev/null
  fi
}

# List a folder's photos in capture order. Spotlight knows the EXIF date for every
# file here; anything it cannot date sorts last, then by path.
by_capture() {
  find "$1" -type f \( -iname '*.jpg' -o -iname '*.jpeg' \) -print0 \
  | while IFS= read -r -d '' f; do
      d="$(mdls -name kMDItemContentCreationDate -raw "$f" 2>/dev/null || true)"
      case "$d" in ''|'(null)') d='9999-99-99' ;; esac
      printf '%s\t%s\n' "$d" "$f"
    done | sort | cut -f2-
}

rm -rf "$DEST"

# --- 2026-07-23: outdoor headshots, 2 per puppy -----------------------------
for c in $COLLARS; do
  n=1
  by_capture "$SRC/2026-07-23/$c" | while read -r f; do
    emit "$f" 2026-07-23 "$c" "$n"; n=$((n + 1))
  done
done

# --- 2026-07-24: studio shots, group, and Coco ------------------------------
for c in $COLLARS; do
  n=1
  by_capture "$SRC/2026-07-24/$c" | while read -r f; do
    b="$(basename "$f")"
    # IMG_4109/IMG_4122 are byte-identical copies of two of Blue's shots that were
    # also filed under yellow. Their numbering sits inside Blue's run — keep Blue's.
    if [ "$c" = "yellow" ] && { [ "$b" = "IMG_4109.jpeg" ] || [ "$b" = "IMG_4122.jpeg" ]; }; then
      continue
    fi
    emit "$f" 2026-07-24 "$c" "$n"; n=$((n + 1))
  done
done

n=1
by_capture "$SRC/2026-07-24/group-photos" | while read -r f; do
  emit "$f" 2026-07-24 group "$n"; n=$((n + 1))
done

emit "$SRC/2026-07-24/coco.jpeg" 2026-07-24 coco 1

# --- 2026-07-07: one newborn portrait per puppy -----------------------------
for c in $COLLARS; do
  emit "$SRC/litter/collars/$c.jpg" 2026-07-07 "$c" 1
done

# --- 2026-06-26: first-days candids -----------------------------------------
n=1
for f in "$SRC"/litter/gallery/day-*.jpg; do
  emit "$f" 2026-06-26 first-days "$n"; n=$((n + 1))
done

# --- pre-litter: Coco before the puppies ------------------------------------
n=1
by_capture "$SRC/gallery" | while read -r f; do
  emit "$f" pre-litter coco "$n"; n=$((n + 1))
done

echo "done: $(find "$DEST" -type f | wc -l | tr -d ' ') photos"
```

- [ ] **Step 2: Make it executable and run it**

```bash
chmod +x scripts/migrate-photos.sh
./scripts/migrate-photos.sh
```

Expected: takes a minute or two (it re-encodes 137 files), then prints `done: 137 photos`.

- [ ] **Step 3: Verify the counts per folder**

Run:
```bash
for d in src/assets/photos/*/*/; do printf '%4d  %s\n' "$(ls "$d" | wc -l)" "$d"; done
```

Expected counts, folder by folder:

| Folder | Files |
|---|---|
| `2026-06-26/first-days/` | 11 |
| `2026-07-07/{blue,black,brown,yellow,orange,pink,purple,red,green}/` | 1 each (9) |
| `2026-07-23/{each of the nine}/` | 2 each (18) |
| `2026-07-24/black/` | 3 |
| `2026-07-24/{brown,green,orange,red}/` | 5 each (20) |
| `2026-07-24/{blue,pink,purple,yellow}/` | 6 each (24) |
| `2026-07-24/group/` | 28 |
| `2026-07-24/coco/` | 1 |
| `pre-litter/coco/` | 23 |

**Yellow must be 6, not 8** — that is the duplicate drop working.

- [ ] **Step 4: Verify the total, the size, and that nothing exceeds 2048px**

Run:
```bash
find src/assets/photos -type f | wc -l
du -sh src/assets/photos
find src/assets/photos -type f -exec sips -g pixelWidth -g pixelHeight {} \; \
  | awk '/pixelWidth/{w=$2} /pixelHeight/{print (w > $2 ? w : $2)}' \
  | sort -rn | head -1
```

Expected: `137`; `88M` (down from ~209 MB across all five source locations); max long edge `2048`.

Most sources were already at 2048px, so for them this is a re-encode, not a downscale — which is why
the total lands at 88 MB. Do not chase a smaller number by lowering quality; `sips` output is nearly
flat from 82 down to 75, and 60 costs visible fur detail.

- [ ] **Step 5: Spot-check that the downscaled photos still look right**

Open a few of the heavily downscaled ones (the 07-23 shoot went from 4–5k px to 2048):

```bash
open src/assets/photos/2026-07-23/blue/blue-01.jpg \
     src/assets/photos/2026-07-07/pink/pink-01.jpg \
     src/assets/photos/pre-litter/coco/coco-01.jpg
```

Expected: sharp, correctly oriented, not upscaled or washed out. **If any look wrong, stop and fix the script before committing** — the source folders are still intact.

- [ ] **Step 6: Confirm the build is still green**

Nothing references the new tree yet, and no source was deleted, so this must still pass:

Run: `npm run check && npm run build`
Expected: both succeed.

- [ ] **Step 7: Commit**

```bash
git add scripts/migrate-photos.sh src/assets/photos
git commit -m "feat: consolidate all litter photos into src/assets/photos"
```

---

### Task 3: Photo index module

The `import.meta.glob` wrapper that turns the tree into typed `Photo` objects, validated at build time.

**Files:**
- Create: `src/lib/photos/index.ts`

**Interfaces:**
- Consumes: everything Task 1 produces from `./paths`.
- Produces:
  - `interface Photo extends PhotoRef { src: ImageMetadata; alt: string }`
  - `photosBySubject(collarNames: string[]): Record<string, Photo[]>`
  - Re-exports `NON_PUPPY_SUBJECTS`, `SECTION_TITLES`, and the `Photo`/`PhotoRef` types so pages import from one place.

---

- [ ] **Step 1: Write the module**

Create `src/lib/photos/index.ts`:

```ts
import type { ImageMetadata } from 'astro';
import {
  assertKnownSubjects,
  groupBySubject,
  parsePhotoPath,
  photoAlt,
  type PhotoRef,
} from './paths';

export { NON_PUPPY_SUBJECTS, SECTION_TITLES } from './paths';
export type { PhotoRef, NonPuppySubject } from './paths';

export interface Photo extends PhotoRef {
  src: ImageMetadata;
  alt: string;
}

// Eager so Astro resolves every image at build time. The tree is 137 files.
const files = import.meta.glob<{ default: ImageMetadata }>(
  '../../assets/photos/**/*.jpg',
  { eager: true },
);

/**
 * Every photo grouped by subject, each list newest shoot first.
 *
 * `collarNames` comes from `litter.md` and is what the tree is validated
 * against — an unknown folder or a collar with no folder throws here, failing
 * the build rather than shipping an empty card.
 *
 * Deliberately not memoized. Grouping 137 items costs microseconds, and a
 * module-level cache would have to be keyed on `collarNames` to stay correct:
 * `astro dev` keeps this module alive across requests, so an unkeyed cache
 * would skip validation on every request after the first and silently render
 * an empty card for a collar renamed mid-session.
 */
export function photosBySubject(collarNames: string[]): Record<string, Photo[]> {
  const refs = Object.entries(files).map(([path, mod]) => ({
    ...parsePhotoPath(path),
    src: mod.default,
  }));

  assertKnownSubjects([...new Set(refs.map((r) => r.subject))], collarNames);

  const displayName = new Map(collarNames.map((n) => [n.toLowerCase(), n]));

  return Object.fromEntries(
    Object.entries(groupBySubject(refs)).map(([subject, list]) => [
      subject,
      list.map((ref) => ({ ...ref, alt: photoAlt(ref, displayName.get(subject)) })),
    ]),
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: `0 errors`. (Nothing imports the module yet; this confirms the glob type and the `paths` signatures line up.)

- [ ] **Step 3: Prove the validation actually fails the build**

This module's whole job is to fail loudly, so verify it does. Plant a bad folder, and temporarily import the module from a page so the glob is reachable:

```bash
mkdir -p src/assets/photos/2026-07-23/teal
cp src/assets/photos/2026-07-23/blue/blue-01.jpg src/assets/photos/2026-07-23/teal/teal-01.jpg
```

Add these two lines to the frontmatter of `src/pages/gallery.astro`, just below the existing imports:

```ts
import { photosBySubject } from '../lib/photos';
photosBySubject(['Blue', 'Black', 'Brown', 'Yellow', 'Orange', 'Pink', 'Purple', 'Red', 'Green']);
```

Run: `npm run build`
Expected: FAIL with `src/assets/photos is misconfigured — unknown photo subject folder(s): teal`.

- [ ] **Step 4: Prove the missing-folder half fails too**

A collar counts as "present" if it has a folder under **any** shoot, so all three of Green's
folders have to go for this to trip:

```bash
rm -rf src/assets/photos/2026-07-23/teal
mkdir -p /tmp/green-shoots
mv src/assets/photos/2026-07-07/green /tmp/green-shoots/2026-07-07-green
mv src/assets/photos/2026-07-23/green /tmp/green-shoots/2026-07-23-green
mv src/assets/photos/2026-07-24/green /tmp/green-shoots/2026-07-24-green
```

Run: `npm run build`
Expected: FAIL with `collar(s) with no photo folder: green`.

- [ ] **Step 5: Restore and confirm green**

```bash
mv /tmp/green-shoots/2026-07-07-green src/assets/photos/2026-07-07/green
mv /tmp/green-shoots/2026-07-23-green src/assets/photos/2026-07-23/green
mv /tmp/green-shoots/2026-07-24-green src/assets/photos/2026-07-24/green
rmdir /tmp/green-shoots
```

Then revert the two temporary lines in `src/pages/gallery.astro`:

```bash
git checkout src/pages/gallery.astro
```

Run: `npm run build && find src/assets/photos -type f | wc -l`
Expected: build succeeds; `137`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/photos/index.ts
git commit -m "feat: add build-validated photo index over src/assets/photos"
```

---

### Task 4: Carousel component and home page

Replace the single-photo cast cards with carousels, drop the now-redundant `photo` field from the litter content, and move "First days" off the home page.

**Files:**
- Create: `src/components/PuppyCarousel.astro`
- Modify: `src/components/PuppyCard.astro` (whole file)
- Modify: `src/pages/index.astro:1-35` (frontmatter), `:63-82` (cast + First days sections)
- Modify: `src/content.config.ts:51-57` (collar schema)
- Modify: `src/content/litter/litter.md:10-18` (collar rows)
- Test: `test/e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: `photosBySubject(collarNames)` and the `Photo` type from `src/lib/photos`.
- Produces: `PuppyCarousel` with props `{ name: string; photos: Photo[] }`; `PuppyCard` with props `{ name: string; hex: string; sex: 'boy' | 'girl'; note?: string; photos: Photo[] }` (the `photo: ImageMetadata` prop is gone).

---

- [ ] **Step 1: Write the carousel component**

Create `src/components/PuppyCarousel.astro`:

```astro
---
// A single puppy's photos in a square frame. Slides are plain hidden/shown
// elements rather than a scroller so hidden ones are never fetched.
//
// The wrapper is the PhotoSwipe group, so the lightbox is scoped to this one
// puppy. Hidden slides stay in the DOM and are still queried by PhotoSwipe,
// which is what makes the full-screen view the whole set.
import { Image } from 'astro:assets';
import ZoomableImage from './ZoomableImage.astro';
import type { Photo } from '../lib/photos';

interface Props {
  name: string;
  photos: Photo[];
}

const { name, photos } = Astro.props;
const many = photos.length > 1;
---
<div
  class="carousel pswp-gallery"
  data-carousel
  role="group"
  aria-roledescription="carousel"
  aria-label={`${name} collar photos`}
>
  <div class="frame">
    {photos.map((photo, i) => (
      <div class="slide" data-slide hidden={i !== 0}>
        <ZoomableImage src={photo.src}>
          <Image
            src={photo.src}
            alt={photo.alt}
            class="slide-img"
            widths={[240, 480]}
            sizes="(max-width: 700px) 50vw, 240px"
            format="webp"
            quality={78}
            loading="lazy"
          />
        </ZoomableImage>
      </div>
    ))}

    {many && (
      <>
        <button class="nav prev" type="button" data-prev hidden aria-label={`Previous photo of ${name}`}>
          <span aria-hidden="true">‹</span>
        </button>
        <button class="nav next" type="button" data-next hidden aria-label={`Next photo of ${name}`}>
          <span aria-hidden="true">›</span>
        </button>
        <span class="counter" data-counter aria-hidden="true">1 / {photos.length}</span>
      </>
    )}
  </div>

  {many && (
    <p class="visually-hidden" aria-live="polite" data-live>Photo 1 of {photos.length}</p>
  )}
</div>

<style>
  .carousel { position: relative; }
  .frame { position: relative; aspect-ratio: 1 / 1; overflow: hidden; background: #e8e0d2; }
  .slide { height: 100%; }
  /* `.pswp-item` is `display: contents`, so the image is the frame's layout child. */
  .slide-img { width: 100%; height: 100%; object-fit: cover; display: block; }
  /* Beat the `.slide { height }` rule — `[hidden]` alone loses to any display value. */
  .slide[hidden], .nav[hidden] { display: none; }

  .nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 2rem;
    height: 2rem;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: var(--radius-pill);
    background: rgba(255, 255, 255, 0.88);
    color: var(--c-charcoal);
    font-size: 1.1rem;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(43, 41, 38, 0.28);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease;
  }
  .prev { left: 0.45rem; }
  .next { right: 0.45rem; }
  .nav:focus-visible { outline: 3px solid var(--c-navy); outline-offset: 2px; }

  .counter {
    position: absolute;
    right: 0.5rem;
    bottom: 0.5rem;
    background: rgba(43, 41, 38, 0.66);
    color: #fff;
    font-size: 0.7rem;
    font-weight: 800;
    padding: 0.15rem 0.5rem;
    border-radius: var(--radius-pill);
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  /* Controls appear only once the script has wired them up. */
  [data-ready] .counter { opacity: 1; }

  @media (hover: hover) {
    [data-ready]:hover .nav,
    [data-ready]:focus-within .nav { opacity: 1; pointer-events: auto; }
  }

  /* No hover on touch, so a hover-only control is an invisible control. */
  @media (hover: none) {
    [data-ready] .nav { opacity: 1; pointer-events: auto; }
  }

  @media (prefers-reduced-motion: reduce) {
    .nav, .counter { transition: none; }
  }
</style>

<script>
  document.querySelectorAll<HTMLElement>('[data-carousel]').forEach((carousel) => {
    const slides = [...carousel.querySelectorAll<HTMLElement>('[data-slide]')];
    if (slides.length < 2) return;

    const prev = carousel.querySelector<HTMLButtonElement>('[data-prev]');
    const next = carousel.querySelector<HTMLButtonElement>('[data-next]');
    const counter = carousel.querySelector<HTMLElement>('[data-counter]');
    const live = carousel.querySelector<HTMLElement>('[data-live]');
    if (!prev || !next || !counter || !live) return;

    let index = 0;

    const show = (n: number) => {
      index = (n + slides.length) % slides.length;
      slides.forEach((slide, i) => slide.toggleAttribute('hidden', i !== index));
      counter.textContent = `${index + 1} / ${slides.length}`;
      live.textContent = `Photo ${index + 1} of ${slides.length}`;
    };

    prev.hidden = false;
    next.hidden = false;
    prev.addEventListener('click', () => show(index - 1));
    next.addEventListener('click', () => show(index + 1));

    carousel.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); show(index - 1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); show(index + 1); }
    });

    let startX: number | null = null;
    carousel.addEventListener('pointerdown', (event) => { startX = event.clientX; });
    carousel.addEventListener('pointerup', (event) => {
      if (startX === null) return;
      const dx = event.clientX - startX;
      startX = null;
      if (Math.abs(dx) <= 30) return;
      show(dx < 0 ? index + 1 : index - 1);
      // A swipe must not also open the lightbox: `click` fires after `pointerup`.
      carousel.addEventListener(
        'click',
        (click) => { click.preventDefault(); click.stopPropagation(); },
        { capture: true, once: true },
      );
    });

    carousel.dataset.ready = '';
  });
</script>
```

- [ ] **Step 2: Rewrite `PuppyCard` to use it**

Replace `src/components/PuppyCard.astro` entirely:

```astro
---
import PuppyCarousel from './PuppyCarousel.astro';
import type { Photo } from '../lib/photos';

interface Props {
  name: string;
  hex: string;
  sex: 'boy' | 'girl';
  note?: string;
  photos: Photo[];
}

const { name, hex, sex, note, photos } = Astro.props;
---
<article class="pup" style={`--collar: ${hex}`}>
  <PuppyCarousel name={name} photos={photos} />
  <div class="pup-body">
    <div class="nameplate">
      <svg class="swatch" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
      <span class="pup-name">{name} collar</span>
      <span class={`sex sex-${sex}`}>{sex}</span>
    </div>
    {note && <p class="pup-note">{note}</p>}
  </div>
</article>
<style>
  .pup { background: #fff; border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; border-bottom: 8px solid var(--collar); }
  .pup-body { padding: 0.85rem 1rem 1.05rem; }
  .nameplate { display: flex; align-items: center; gap: 0.5rem; }
  .swatch { flex: 0 0 auto; display: block; width: 1.2rem; height: 1.2rem; fill: var(--collar); filter: drop-shadow(0 1px 2px rgba(43, 41, 38, 0.35)); }
  .pup-name { font-weight: 900; color: var(--heading); font-size: 1rem; }
  .sex { margin-left: auto; font-size: 0.75rem; font-weight: 800; color: var(--c-charcoal); padding: 0.15rem 0.6rem; border-radius: var(--radius-pill); }
  .sex-boy { background: var(--c-boy); }
  .sex-girl { background: var(--c-girl); }
  .pup-note { margin: 0.5rem 0 0; color: var(--text); font-size: 0.9rem; line-height: 1.4; }
</style>
```

- [ ] **Step 3: Drop `photo` from the litter schema**

In `src/content.config.ts`, the `collars` array in the `litter` collection becomes:

```ts
    collars: z.array(z.object({
      name: z.string(),
      hex: z.string(),
      sex: z.enum(['boy', 'girl']),
      note: z.string().optional(),
    })),
```

(`heroImage: image()` above it is unchanged, so the `({ image })` schema signature stays.)

- [ ] **Step 4: Drop `photo` from the litter content**

In `src/content/litter/litter.md`, the nine collar rows become:

```yaml
collars:
  - { name: "Blue",   hex: "#3b6fd6", sex: boy,  note: "First born — led the way." }
  - { name: "Black",  hex: "#2a2a2a", sex: boy,  note: "The dramatic one — growing fastest." }
  - { name: "Brown",  hex: "#8a5a2b", sex: boy,  note: "Aka \"Potato\" — loves to sleep." }
  - { name: "Yellow", hex: "#e0b031", sex: boy,  note: "Has the most unique markings." }
  - { name: "Orange", hex: "#e8863b", sex: boy,  note: "First to open his eyes." }
  - { name: "Pink",   hex: "#e58fb0", sex: girl, note: "Coco's little mini-me." }
  - { name: "Purple", hex: "#7b4fc9", sex: girl, note: "Last to arrive, worth the wait." }
  - { name: "Red",    hex: "#d24a45", sex: girl, note: "Sweet and small — nicknamed \"Ruby.\"" }
  - { name: "Green",  hex: "#5a9e4f", sex: girl, note: "Little, quiet & unbearably cute." }
```

Everything else in the file (frontmatter above and below, and the body prose) is unchanged.

- [ ] **Step 5: Wire the home page**

In `src/pages/index.astro`:

**5a.** In the frontmatter, remove the `GalleryGrid` import and the `galleryImages` glob (currently lines 9 and 31–35), and add the photo index. The frontmatter's import block and litter setup become:

```ts
import { Image } from 'astro:assets';
import BaseLayout from '../layouts/BaseLayout.astro';
import Hero from '../components/Hero.astro';
import CountdownTimer from '../components/CountdownTimer.astro';
import LitterStats from '../components/LitterStats.astro';
import LitterAge from '../components/LitterAge.astro';
import PuppyCard from '../components/PuppyCard.astro';
import ZoomableImage from '../components/ZoomableImage.astro';
import SubscribeForm from '../components/SubscribeForm.astro';
import { getEntry, render } from 'astro:content';
import { photosBySubject } from '../lib/photos';

const coco = await getEntry('coco', 'coco');
const site = await getEntry('site', 'config');
const { dueDate, litterEstimate, flags } = site!.data;

const litterEntry = await getEntry('litter', 'litter');
// Gate on `published`: the home page shows the birth announcement once the
// litter is live, and falls back to the pre-birth countdown otherwise. `/`
// can never redirect to itself, so both states must render here.
const litter = litterEntry?.data.published ? litterEntry.data : null;
const { Content } = litter && litterEntry ? await render(litterEntry) : { Content: null };
const bornStr = litter ? litter.bornDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
const pageDescription = litter
  ? `Coco's ${litter.count} puppies have arrived! Meet the whole litter, born ${bornStr}.`
  : undefined;
const pageOgImage = litter ? '/og-litter.jpg' : undefined;

// Validate and index against every collar in the content, published or not —
// the photo tree does not change when the announcement is toggled off.
const photos = photosBySubject((litterEntry?.data.collars ?? []).map((c) => c.name));
```

Note `type ImageMetadata` is no longer imported — the glob that needed it is gone.

**5b.** Replace the cast section (currently lines 63–73). The `pswp-gallery` class moves off `.cast` and onto each card, so the lightbox scopes per puppy:

```astro
      <section class="section">
        <div class="container">
          <p class="eyebrow">Meet the cast</p>
          <h2>Nine collars, nine personalities</h2>
          <div class="cast">
            {litter.collars.map((c) => (
              <PuppyCard
                name={c.name}
                hex={c.hex}
                sex={c.sex}
                note={c.note}
                photos={photos[c.name.toLowerCase()] ?? []}
              />
            ))}
          </div>
        </div>
      </section>
```

**5c.** Delete the entire "First days" block (currently lines 75–82) — the `{galleryImages.length > 0 && (...)}` section. Those photos now live in the gallery.

- [ ] **Step 6: Type-check and build**

Run: `npm run check && npm run build`
Expected: `0 errors`, build succeeds. If `check` complains that `photo` does not exist on the collar type, a `photo:` key was left behind in `litter.md`.

- [ ] **Step 7: Look at it**

Run: `npm run dev`, open http://localhost:4321

Expected: nine square cards; hovering one reveals `‹`/`›`; the counter reads `1 / 9` for Blue, Pink, Purple, and Yellow, `1 / 6` for Black, `1 / 8` for the rest. Clicking a photo opens PhotoSwipe containing **only that puppy**. No "First days" grid below the cards. Stop the dev server when done.

- [ ] **Step 8: Write the failing e2e tests**

Append to `test/e2e/smoke.spec.ts`:

```ts
test('a cast card carousels through that puppy\'s photos', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('article.pup', { hasText: 'Blue collar' });

  await expect(card.getByText(/^1 \/ \d+$/)).toBeVisible();

  // Controls are hover-revealed with `pointer-events: none`, so hover first —
  // otherwise Playwright's actionability check fails on the hit test.
  await card.hover();
  await card.getByRole('button', { name: 'Next photo of Blue' }).click();
  await expect(card.getByText(/^2 \/ \d+$/)).toBeVisible();

  await card.getByRole('button', { name: 'Previous photo of Blue' }).click();
  await expect(card.getByText(/^1 \/ \d+$/)).toBeVisible();
});

test('the carousel wraps backwards from the first photo to the last', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('article.pup', { hasText: 'Black collar' });

  await card.hover();
  await card.getByRole('button', { name: 'Previous photo of Black' }).click();
  await expect(card.getByText('6 / 6')).toBeVisible();
});

test('the home page no longer shows the first-days grid', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'First days' })).toHaveCount(0);
});
```

- [ ] **Step 9: Run the e2e tests**

Run: `npm run test:e2e`
Expected: PASS, including the three new tests and the pre-existing smoke assertions (`Blue collar` and `Green collar` still render).

- [ ] **Step 10: Commit**

```bash
git add src/components/PuppyCarousel.astro src/components/PuppyCard.astro \
        src/pages/index.astro src/content.config.ts src/content/litter/litter.md \
        test/e2e/smoke.spec.ts
git commit -m "feat: carousel every puppy's photos on the cast cards"
```

---

### Task 5: Filterable gallery

Rebuild `/gallery` as sectioned subjects with collar-color filter chips.

**Files:**
- Modify: `src/pages/gallery.astro` (whole file)
- Test: `test/e2e/gallery.spec.ts` (create)

**Interfaces:**
- Consumes: `photosBySubject`, `NON_PUPPY_SUBJECTS`, `SECTION_TITLES` from `src/lib/photos`; `GalleryGrid` unchanged.
- Produces: no exports. DOM contract used by the tests: `[data-chip="<id>"]` buttons, `[data-section="<id>"]` sections, `aria-pressed` on the active chip, `#<id>` in the URL hash.

---

- [ ] **Step 1: Rewrite the gallery page**

Replace `src/pages/gallery.astro` entirely:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import GalleryGrid from '../components/GalleryGrid.astro';
import { getEntry } from 'astro:content';
import { photosBySubject, NON_PUPPY_SUBJECTS, SECTION_TITLES } from '../lib/photos';

const site = await getEntry('site', 'config');
const showGallery = site!.data.flags.showGallery;

// Collars drive both the chip row and the photo-tree validation. Read them
// regardless of `published` — the photo tree does not change when the
// announcement is toggled off.
const litterEntry = await getEntry('litter', 'litter');
const collars = litterEntry?.data.collars ?? [];
const photos = photosBySubject(collars.map((c) => c.name));

// Group / Coco / First days first, then the puppies in litter order.
const sections = [
  ...NON_PUPPY_SUBJECTS.map((subject) => ({
    id: subject,
    title: SECTION_TITLES[subject],
    photos: photos[subject] ?? [],
  })),
  ...collars.map((collar) => ({
    id: collar.name.toLowerCase(),
    title: `${collar.name} collar`,
    photos: photos[collar.name.toLowerCase()] ?? [],
  })),
].filter((section) => section.photos.length > 0);

const total = sections.reduce((n, section) => n + section.photos.length, 0);
---
<BaseLayout title="Gallery — Coco's Puppy Tales" description="Photos of Coco and her nine puppies.">
  <section class="section">
    <div class="container">
      <h1>Gallery</h1>

      {!showGallery && <p>The gallery is coming soon. 🐾</p>}
      {showGallery && total === 0 && <p>Photos coming soon. 🐾</p>}

      {showGallery && total > 0 && (
        <>
          {/* Hidden until the script wires it up: without JS every section shows,
              which is still a complete gallery. */}
          <div class="chips" data-chips hidden>
            <button class="chip" type="button" data-chip="all" aria-pressed="true">All</button>
            {collars.map((collar) => (
              <button class="chip" type="button" data-chip={collar.name.toLowerCase()} aria-pressed="false">
                <span class="sw" style={`--sw: ${collar.hex}`} aria-hidden="true"></span>{collar.name}
              </button>
            ))}
          </div>

          {sections.map((section) => (
            <section class="gsection" data-section={section.id}>
              <h2 class="gtitle">{section.title} <span class="gcount">{section.photos.length}</span></h2>
              <GalleryGrid images={section.photos} />
            </section>
          ))}
        </>
      )}
    </div>
  </section>
</BaseLayout>

<style>
  .chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0 0 1.5rem; }
  .chips[hidden] { display: none; }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: #fff;
    border: 1px solid rgba(43, 41, 38, 0.14);
    border-radius: var(--radius-pill);
    padding: 0.35rem 0.85rem;
    font: inherit;
    font-size: 0.85rem;
    font-weight: 800;
    color: var(--c-charcoal);
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(43, 41, 38, 0.06);
  }
  .chip:hover { border-color: rgba(43, 41, 38, 0.3); }
  .chip:focus-visible { outline: 3px solid var(--c-navy); outline-offset: 2px; }
  .chip[aria-pressed='true'] { background: var(--c-navy); color: #fff; border-color: var(--c-navy); }
  .sw { width: 0.75rem; height: 0.75rem; border-radius: var(--radius-pill); background: var(--sw); box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12); }

  .gsection { margin-bottom: 2rem; }
  .gsection[hidden] { display: none; }
  .gtitle { font-size: 1.1rem; margin: 0 0 0.65rem; }
  .gcount { font-size: 0.8rem; font-weight: 600; color: var(--text); opacity: 0.55; margin-left: 0.3rem; }
  /* One puppy selected: the chip already says whose photos these are. */
  .gsection.is-solo .gtitle { display: none; }
</style>

<script>
  const chips = document.querySelector<HTMLElement>('[data-chips]');

  if (chips) {
    const buttons = [...chips.querySelectorAll<HTMLButtonElement>('[data-chip]')];
    const sections = [...document.querySelectorAll<HTMLElement>('[data-section]')];
    const known = new Set(buttons.map((b) => b.dataset.chip));

    const apply = (id: string) => {
      // An unknown hash falls back to All rather than an empty grid.
      const target = known.has(id) ? id : 'all';
      const solo = target !== 'all';

      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.chip === target)));
      sections.forEach((section) => {
        const match = !solo || section.dataset.section === target;
        section.hidden = !match;
        section.classList.toggle('is-solo', solo);
      });

      history.replaceState(null, '', solo ? `#${target}` : location.pathname);
    };

    buttons.forEach((b) => b.addEventListener('click', () => apply(b.dataset.chip ?? 'all')));

    chips.hidden = false;
    apply(location.hash.slice(1) || 'all');
  }
</script>
```

- [ ] **Step 2: Type-check and build**

Run: `npm run check && npm run build`
Expected: `0 errors`, build succeeds.

- [ ] **Step 3: Look at it**

Run: `npm run dev`, open http://localhost:4321/gallery

Expected: chips read `All Blue Black Brown Yellow Orange Pink Purple Red Green`, each with its collar dot. Default view is sections in order Group photos (28) → Coco (24) → First days (11) → Blue collar (9) → … → Green collar (8). Clicking Pink leaves only Pink's nine photos, hides the heading, and puts `#pink` in the address bar. Clicking a photo opens a lightbox scoped to that section. Stop the dev server when done.

- [ ] **Step 4: Write the failing e2e tests**

Create `test/e2e/gallery.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('the gallery shows every section by default', async ({ page }) => {
  await page.goto('/gallery');
  await expect(page.getByRole('heading', { name: /^Group photos/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^First days/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Blue collar/ })).toBeVisible();
  await expect(page.locator('[data-section]')).toHaveCount(12);
});

test('a collar chip isolates that puppy and updates the hash', async ({ page }) => {
  await page.goto('/gallery');
  await page.getByRole('button', { name: 'Pink' }).click();

  await expect(page.locator('[data-section="pink"]')).toBeVisible();
  await expect(page.locator('[data-section="group"]')).toBeHidden();
  await expect(page.locator('[data-section="blue"]')).toBeHidden();
  await expect(page).toHaveURL(/#pink$/);
  await expect(page.getByRole('button', { name: 'Pink' })).toHaveAttribute('aria-pressed', 'true');
});

test('All restores every section', async ({ page }) => {
  await page.goto('/gallery');
  await page.getByRole('button', { name: 'Pink' }).click();
  await page.getByRole('button', { name: 'All' }).click();

  await expect(page.locator('[data-section="group"]')).toBeVisible();
  await expect(page.locator('[data-section="pink"]')).toBeVisible();
  await expect(page).not.toHaveURL(/#/);
});

test('a hash in the URL applies the filter on load', async ({ page }) => {
  await page.goto('/gallery#blue');

  await expect(page.locator('[data-section="blue"]')).toBeVisible();
  await expect(page.locator('[data-section="group"]')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Blue' })).toHaveAttribute('aria-pressed', 'true');
});

test('an unknown hash falls back to All rather than an empty page', async ({ page }) => {
  await page.goto('/gallery#teal');

  await expect(page.locator('[data-section="group"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
});
```

- [ ] **Step 5: Run the e2e tests**

Run: `npm run test:e2e`
Expected: PASS — the five new gallery tests plus everything from Task 4.

The count of 12 in the first test is 3 non-puppy sections + 9 puppies. If it fails at 11, a section came back empty — check the Task 2 folder counts.

- [ ] **Step 6: Commit**

```bash
git add src/pages/gallery.astro test/e2e/gallery.spec.ts
git commit -m "feat: filter the gallery by puppy with collar chips"
```

---

### Task 6: Remove the old photo folders

Nothing references the old trees now. Delete them, along with the one-shot migration script.

**Files:**
- Delete: `src/assets/litter/collars/`, `src/assets/litter/gallery/`, `src/assets/gallery/`, `src/assets/meet-the-pups/`, `src/assets/untitled folder/`, `src/assets/2026-07-23/`, `src/assets/2026-07-24/`, `scripts/migrate-photos.sh`
- Keep: `src/assets/litter/hero.jpg`, `src/assets/coco-hero.jpg`, `src/assets/journey/`, `src/assets/photos/`, `public/og-litter.jpg`

---

- [ ] **Step 1: Confirm nothing references the folders about to be deleted**

Run:
```bash
grep -rn "assets/gallery\|litter/collars\|litter/gallery\|meet-the-pups\|assets/2026-07" \
  --include="*.astro" --include="*.ts" --include="*.md" --include="*.json" --include="*.mjs" \
  src/ astro.config.mjs test/
```

Expected: **no output.** Any hit under `src/` or `test/` must be fixed before deleting. (Hits under `docs/` are historical plans and are fine — that path is excluded above.)

- [ ] **Step 2: Confirm `hero.jpg` is still referenced and present**

Run:
```bash
grep -n "heroImage" src/content/litter/litter.md && ls src/assets/litter/hero.jpg
```

Expected: the `heroImage: ../../assets/litter/hero.jpg` line, and the file exists. This is the one file inside `src/assets/litter/` that must survive.

- [ ] **Step 3: Delete**

```bash
git rm -r --quiet src/assets/litter/collars src/assets/litter/gallery src/assets/gallery src/assets/meet-the-pups
rm -rf "src/assets/untitled folder" src/assets/2026-07-23 src/assets/2026-07-24
rm -f scripts/migrate-photos.sh
rmdir scripts 2>/dev/null || true
```

(The last three trees are untracked or empty, hence `rm` rather than `git rm`. `rmdir` only removes `scripts/` if the migration script was the only thing in it.)

- [ ] **Step 4: Verify what remains**

Run:
```bash
ls src/assets
find src/assets/photos -type f | wc -l
du -sh src/assets
```

Expected: `coco-hero.jpg  journey  litter  photos`; `137`; roughly `92M` total (down from ~209 MB) —
88 MB of that is `photos/`, the rest is `hero.jpg`, `coco-hero.jpg`, and `journey/`.

- [ ] **Step 5: Full verification**

Run: `npm run check && npm test && npm run build && npm run test:e2e`
Expected: `0 errors`; all vitest suites pass; build succeeds; all Playwright tests pass.

- [ ] **Step 6: Confirm the built output actually has the photos**

Run:
```bash
ls dist/_astro/*.webp | wc -l
```

Expected: several hundred (each photo generates thumbnail widths plus a 1600px lightbox variant). A number under 100 means the glob missed the tree.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove the superseded photo folders and migration script"
```

- [ ] **Step 8: Update the project guide**

In `CLAUDE.md`, add to the **Conventions** section:

```markdown
- **Photos:** every photo lives at `src/assets/photos/<shoot>/<subject>/<subject>-NN.jpg`, where
  `<shoot>` is an ISO date (or `pre-litter`) and `<subject>` is a lowercase collar name, `group`,
  `coco`, or `first-days`. Cap the long edge at 2048px. Adding a shoot means adding a dated folder —
  `src/lib/photos/` picks it up, orders it newest-first, and fails the build on an unknown subject
  folder or a collar with no photos.
```

- [ ] **Step 9: Commit the docs**

```bash
git add CLAUDE.md
git commit -m "docs: describe the photo tree convention"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| §1 Photo storage, path contract, shoot ordering | 1 (rules), 2 (tree) |
| §1 Migration table, extension/filename/downscale normalization | 2 |
| §1 Duplicates (yellow `IMG_4109`/`IMG_4122`) | 2, Step 1 |
| §1 Safety — sources kept until verified | 2 (copies only), 6 (deletes) |
| §2 `paths.ts` pure module | 1 |
| §2 `index.ts` glob wrapper | 3 |
| §2 Generated alt text | 1 (`photoAlt`) |
| §3 `litter.md` drops `photo` | 4, Steps 3–4 |
| §4 `PuppyCarousel` — frame, slides, controls, a11y, no-JS | 4, Step 1 |
| §5 Lightbox scoping via `.pswp-gallery` placement | 4 (cards), 5 (sections) |
| §6 Gallery chips, sections, hash, no-JS | 5 |
| §7 Home page drops "First days" | 4, Step 5c |
| §8 Error handling | 1 (throws), 3 (Steps 3–4 prove it), 5 (hash fallback) |
| §9 Unit tests | 1 |
| §9 E2E tests | 4, 5 |
| §9 Manual downscale check | 2, Step 5 |

No gaps.

**Placeholder scan:** No TBD/TODO. Every code step carries the actual code. Task 2's expected folder counts are a table of real numbers, and Task 4's expected counter values (`1 / 9`, `1 / 6`, `1 / 8`) match the Task 2 counts.

**Type consistency:** `PhotoRef`, `Photo`, `NON_PUPPY_SUBJECTS`, `SECTION_TITLES`, `parsePhotoPath`, `isDatedShoot`, `compareShoots`, `comparePhotos`, `groupBySubject`, `assertKnownSubjects`, `shootLabel`, `photoAlt`, and `photosBySubject` are spelled identically in Tasks 1, 3, 4, and 5. `PuppyCard`'s prop changes from `photo: ImageMetadata` to `photos: Photo[]` in Task 4 Step 2, and Step 5b passes `photos={...}` accordingly.
