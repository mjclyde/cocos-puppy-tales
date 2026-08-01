import { describe, it, expect } from 'vitest';
import { countAvailable, availabilityLine } from '../src/lib/availability';
import type { CollarLike } from '../src/lib/availability';

const collars = (...statuses: CollarLike['status'][]): CollarLike[] =>
  statuses.map((status) => ({ status }));

describe('countAvailable', () => {
  it('counts only the available collars', () => {
    expect(countAvailable(collars('available', 'reserved', 'available'))).toBe(2);
  });

  it('returns 0 when every collar is reserved', () => {
    expect(countAvailable(collars('reserved', 'reserved'))).toBe(0);
  });

  it('returns 0 for an empty litter', () => {
    expect(countAvailable([])).toBe(0);
  });

  it('does not mutate the input', () => {
    const input = collars('available', 'reserved');
    const copy = [...input];
    countAvailable(input);
    expect(input).toEqual(copy);
  });
});

describe('availabilityLine', () => {
  it('spells out the count for the current litter — seven of nine open', () => {
    const litter = collars(
      'available', 'available', 'available', 'reserved', 'reserved',
      'available', 'available', 'available', 'available',
    );
    expect(availabilityLine(litter)).toBe('Seven are still looking for their families.');
  });

  it('uses singular wording for exactly one', () => {
    expect(availabilityLine(collars('available', 'reserved'))).toBe(
      'One is still looking for a family.',
    );
  });

  it('returns null when none are available, so the caller renders nothing', () => {
    expect(availabilityLine(collars('reserved', 'reserved'))).toBeNull();
  });

  it('returns null for an empty litter', () => {
    expect(availabilityLine([])).toBeNull();
  });

  it('falls back to digits above nine', () => {
    expect(availabilityLine(collars(...Array(12).fill('available' as const)))).toBe(
      '12 are still looking for their families.',
    );
  });
});
