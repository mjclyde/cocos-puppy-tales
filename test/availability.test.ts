import { describe, it, expect } from 'vitest';
import { countAvailable, availabilityLine } from '../src/lib/availability';
import type { CollarLike, CollarStatus, NamedCollarLike } from '../src/lib/availability';

const collars = (...statuses: CollarLike['status'][]): NamedCollarLike[] =>
  statuses.map((status, i) => ({ name: `Collar ${i + 1}`, status }));

const named = (...entries: [string, CollarStatus][]): NamedCollarLike[] =>
  entries.map(([name, status]) => ({ name, status }));

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
  it('spells out the count for a part-open litter', () => {
    const litter = collars(
      'available', 'available', 'available', 'reserved', 'reserved',
      'available', 'available', 'available', 'available',
    );
    expect(availabilityLine(litter)).toBe('Seven are still looking for their families.');
  });

  it('names the collar for the last puppy — the current litter', () => {
    const litter = named(
      ['Blue', 'reserved'], ['Black', 'reserved'], ['Brown', 'reserved'],
      ['Yellow', 'available'],
      ['Orange', 'reserved'], ['Pink', 'reserved'], ['Purple', 'reserved'],
      ['Red', 'reserved'], ['Green', 'reserved'],
    );
    expect(availabilityLine(litter)).toBe('Just one puppy left — the Yellow collar.');
  });

  it('names whichever collar is the open one, wherever it sits in the litter', () => {
    expect(availabilityLine(named(['Pink', 'available'], ['Blue', 'reserved']))).toBe(
      'Just one puppy left — the Pink collar.',
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

  it('does not mutate the input', () => {
    const input = named(['Yellow', 'available'], ['Blue', 'reserved']);
    const copy = structuredClone(input);
    availabilityLine(input);
    expect(input).toEqual(copy);
  });
});
