import type { ImageMetadata } from 'astro';
import {
  assertKnownSubjects,
  groupBySubject,
  parsePhotoPath,
  photoAlt,
  type PhotoRef,
} from './paths';

export { NON_PUPPY_SUBJECTS, SECTION_TITLES, withCoverFirst } from './paths';
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
