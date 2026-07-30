import { describe, it, expect } from 'vitest';
import { photosBySubject } from '../src/lib/photos';

const COLLAR_NAMES = ['Blue', 'Black', 'Brown', 'Yellow', 'Orange', 'Pink', 'Purple', 'Red', 'Green'];

describe('photosBySubject', () => {
  it('resolves the real photo tree — 12 subjects, 137 photos total', () => {
    // The only check that the glob pattern actually resolves against the real
    // tree: a wrong `../` count yields zero matches, and the build plus both
    // negative build tests would all pass silently while the site renders
    // empty. 137 is the current tree size (Task 2) — update this count when
    // photos are added or removed; that upkeep is the deliberate tradeoff for
    // catching a broken glob.
    const bySubject = photosBySubject(COLLAR_NAMES);

    expect(Object.keys(bySubject)).toHaveLength(12);

    const total = Object.values(bySubject).reduce((sum, photos) => sum + photos.length, 0);
    expect(total).toBe(137);
  });

  it('throws naming the collar(s) with no photo folder', () => {
    // Proves validation runs on every call, not just the first — there is no
    // memoization to skip it on a second invocation with a different list.
    //
    // Note: a name with no folder at all (rather than an omitted real name)
    // is what isolates the "no photo folder" branch of assertKnownSubjects —
    // passing e.g. just ['Blue'] instead makes every *other* real subject
    // folder look unknown (since it's absent from the passed list), which
    // throws too, but with an "unknown photo subject folder(s)" message, not
    // this one. See the fix report for detail.
    expect(() => photosBySubject([...COLLAR_NAMES, 'Teal'])).toThrow(
      /collar\(s\) with no photo folder: teal/,
    );
  });
});
