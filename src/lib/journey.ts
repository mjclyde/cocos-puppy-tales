/**
 * Splits the journey timeline into its two phases.
 *
 * Week numbers restart after the birth — pregnancy runs to week 8, then puppy
 * weeks begin at 1 again. A single descending sort across both would put puppy
 * week 1 below pregnancy week 8 and run the timeline backwards, so the phases
 * are always filtered before they are sorted.
 */

export type JourneyPhase = 'pregnancy' | 'puppies';

/**
 * The slice of a journey collection entry this module needs.
 *
 * Astro nests frontmatter under `.data`, so this reads it there rather than
 * forcing every caller to flatten first.
 */
export interface JourneyEntryLike {
  data: { week: number; phase: JourneyPhase };
}

/** Entries for one phase, newest week first. Returns a new array. */
export function entriesForPhase<T extends JourneyEntryLike>(
  entries: T[],
  phase: JourneyPhase,
): T[] {
  return entries
    .filter((entry) => entry.data.phase === phase)
    .sort((a, b) => b.data.week - a.data.week);
}
