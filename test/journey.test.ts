import { describe, it, expect } from 'vitest';
import { entriesForPhase } from '../src/lib/journey';
import type { JourneyEntryLike, JourneyPhase } from '../src/lib/journey';

// Mirrors the shape Astro hands back: week and phase live under `.data`.
const entry = (week: number, phase: JourneyPhase): JourneyEntryLike => ({ data: { week, phase } });
const weeks = (entries: JourneyEntryLike[]) => entries.map((e) => e.data.week);

describe('entriesForPhase', () => {
  it('keeps only the requested phase', () => {
    const all = [entry(6, 'pregnancy'), entry(1, 'puppies'), entry(8, 'pregnancy')];
    expect(entriesForPhase(all, 'puppies')).toEqual([entry(1, 'puppies')]);
  });

  it('sorts newest week first within the phase', () => {
    const all = [entry(1, 'puppies'), entry(5, 'puppies'), entry(3, 'puppies')];
    expect(weeks(entriesForPhase(all, 'puppies'))).toEqual([5, 3, 1]);
  });

  it('does not let a puppy week sort against a pregnancy week', () => {
    // The regression this exists to prevent: a single descending sort across
    // both phases puts puppy week 1 below pregnancy week 8, running the
    // timeline backwards.
    const all = [entry(8, 'pregnancy'), entry(1, 'puppies'), entry(5, 'puppies')];
    expect(weeks(entriesForPhase(all, 'puppies'))).toEqual([5, 1]);
    expect(weeks(entriesForPhase(all, 'pregnancy'))).toEqual([8]);
  });

  it('returns an empty array for a phase with no entries', () => {
    expect(entriesForPhase([entry(6, 'pregnancy')], 'puppies')).toEqual([]);
  });

  it('does not mutate the input', () => {
    const all = [entry(1, 'puppies'), entry(5, 'puppies')];
    const copy = [...all];
    entriesForPhase(all, 'puppies');
    expect(all).toEqual(copy);
  });

  it('preserves the rest of the entry it returns', () => {
    const rich = [{ data: { week: 3, phase: 'puppies' as const, title: 'Eyes open' } }];
    expect(entriesForPhase(rich, 'puppies')[0].data.title).toBe('Eyes open');
  });
});
