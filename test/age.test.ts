import { describe, it, expect } from 'vitest';
import { formatAge, getAgeInDays } from '../src/lib/age';

describe('getAgeInDays', () => {
  it('is 0 on the birth day', () => {
    const born = new Date('2026-06-25T06:00:00Z');
    expect(getAgeInDays(born, new Date('2026-06-25T20:00:00Z'))).toEqual({ days: 0, weeks: 0 });
  });

  it('counts whole days and derives weeks', () => {
    const born = new Date('2026-06-25T06:00:00Z');
    expect(getAgeInDays(born, new Date('2026-07-06T06:00:00Z'))).toEqual({ days: 11, weeks: 1 });
  });

  it('rolls to 2 weeks at day 14', () => {
    const born = new Date('2026-06-25T06:00:00Z');
    expect(getAgeInDays(born, new Date('2026-07-09T06:00:00Z'))).toEqual({ days: 14, weeks: 2 });
  });

  it('clamps to 0 when now is before the birth date', () => {
    const born = new Date('2026-06-25T06:00:00Z');
    expect(getAgeInDays(born, new Date('2026-06-20T06:00:00Z'))).toEqual({ days: 0, weeks: 0 });
  });
});

describe('formatAge', () => {
  it('reads in weeks once there is at least one', () => {
    expect(formatAge({ days: 49, weeks: 7 })).toEqual({ value: 7, unit: 'weeks old' });
  });

  it('keeps the week singular at exactly one', () => {
    expect(formatAge({ days: 7, weeks: 1 })).toEqual({ value: 1, unit: 'week old' });
  });

  it('holds the week count through the days between weeks', () => {
    // 7w5d still reads "7 weeks old" — the chip rounds down rather than
    // rolling early, so it never claims an age the puppies have not reached.
    expect(formatAge({ days: 54, weeks: 7 })).toEqual({ value: 7, unit: 'weeks old' });
  });

  it('falls back to days before the first week', () => {
    expect(formatAge({ days: 3, weeks: 0 })).toEqual({ value: 3, unit: 'days old' });
  });

  it('keeps the day singular at exactly one', () => {
    expect(formatAge({ days: 1, weeks: 0 })).toEqual({ value: 1, unit: 'day old' });
  });
});
