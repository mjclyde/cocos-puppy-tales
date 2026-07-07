import { describe, it, expect } from 'vitest';
import { getAgeInDays } from '../src/lib/age';

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
