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

/**
 * Float one shoot to the front, leaving the order within each part alone.
 *
 * The cast cards lead with the portrait shoot — the held-up headshots that read
 * as "this is who this puppy is" — while everything behind the cover stays in
 * newest-first order. Returns a copy; a missing or unmatched `coverShoot` is a
 * no-op, so the cards simply fall back to newest-first.
 */
export function withCoverFirst<T extends PhotoRef>(photos: T[], coverShoot?: string): T[] {
  if (!coverShoot) return [...photos];
  return [
    ...photos.filter((photo) => photo.shoot === coverShoot),
    ...photos.filter((photo) => photo.shoot !== coverShoot),
  ];
}

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
