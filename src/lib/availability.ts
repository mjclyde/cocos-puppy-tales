/**
 * Derives what the site says about which puppies are still open.
 *
 * Both the per-card badge and the notice above the cast grid read from the same
 * `collars` array, so one content edit moves them together and they cannot
 * drift out of sync.
 */

export type CollarStatus = 'available' | 'reserved';

/** The slice of a collar entry this module needs. */
export interface CollarLike {
  status: CollarStatus;
}

/** A collar the copy can name, not just count. */
export interface NamedCollarLike extends CollarLike {
  name: string;
}

const isAvailable = (collar: CollarLike): boolean => collar.status === 'available';

export function countAvailable(collars: CollarLike[]): number {
  return collars.filter(isAvailable).length;
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
 * The availability notice, in three shapes:
 *
 * - `"Just one puppy left — the Yellow collar."` at exactly one, because the
 *   last puppy deserves to be pointed at by name rather than counted.
 * - `"Seven are still looking for their families."` above that.
 * - `null` when nothing is available, so the caller omits the line entirely
 *   rather than announcing "Zero are still looking".
 */
export function availabilityLine(collars: NamedCollarLike[]): string | null {
  const open = collars.filter(isAvailable);
  if (open.length === 0) return null;
  if (open.length === 1) return `Just one puppy left — the ${open[0].name} collar.`;
  return `${spell(open.length)} are still looking for their families.`;
}
