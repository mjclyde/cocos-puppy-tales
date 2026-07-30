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

let cache: Record<string, Photo[]> | null = null;

/**
 * Every photo grouped by subject, each list newest shoot first.
 *
 * `collarNames` comes from `litter.md` and is what the tree is validated
 * against — an unknown folder or a collar with no folder throws here, failing
 * the build rather than shipping an empty card. Memoized: the collar list is
 * content and does not change within a build.
 */
export function photosBySubject(collarNames: string[]): Record<string, Photo[]> {
  if (cache) return cache;

  const refs = Object.entries(files).map(([path, mod]) => ({
    ...parsePhotoPath(path),
    src: mod.default,
  }));

  assertKnownSubjects([...new Set(refs.map((r) => r.subject))], collarNames);

  const displayName = new Map(collarNames.map((n) => [n.toLowerCase(), n]));

  cache = Object.fromEntries(
    Object.entries(groupBySubject(refs)).map(([subject, list]) => [
      subject,
      list.map((ref) => ({ ...ref, alt: photoAlt(ref, displayName.get(subject)) })),
    ]),
  );

  return cache;
}
