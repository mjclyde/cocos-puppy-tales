/**
 * Derives what the site says about which puppies are still open.
 *
 * Both the per-card badge and the count line above the cast grid read from the
 * same `collars` array, so one content edit moves them together and they cannot
 * drift out of sync.
 */

export type CollarStatus = 'available' | 'reserved';

/** The slice of a collar entry this module needs. */
export interface CollarLike {
  status: CollarStatus;
}

export function countAvailable(collars: CollarLike[]): number {
  return collars.filter((collar) => collar.status === 'available').length;
}

// Spelled-out counts read warmer than digits in a sentence, and a litter never
// runs past nine here. Anything larger falls back to digits rather than adding
// a number-to-words dependency.
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

const spell = (n: number): string => {
  const word = WORDS[n];
  if (!word) return String(n);
  return word.charAt(0).toUpperCase() + word.slice(1);
};

/**
 * `"Seven are still looking for their families."`
 *
 * Returns `null` when nothing is available so the caller omits the line
 * entirely rather than announcing "Zero are still looking".
 */
export function availabilityLine(collars: CollarLike[]): string | null {
  const open = countAvailable(collars);
  if (open === 0) return null;
  return open === 1
    ? `${spell(open)} is still looking for a family.`
    : `${spell(open)} are still looking for their families.`;
}
