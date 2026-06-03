import { describe, it, expect } from 'vitest';
import { getCountdown } from '../src/lib/countdown';

describe('getCountdown', () => {
  it('computes days/hours/minutes/seconds remaining', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    const due = new Date('2026-06-03T01:02:03Z'); // 2d 1h 2m 3s later
    expect(getCountdown(due, now)).toEqual({
      days: 2, hours: 1, minutes: 2, seconds: 3, isPast: false,
    });
  });

  it('flags isPast and zeroes out when the due date has passed', () => {
    const now = new Date('2026-06-25T00:00:00Z');
    const due = new Date('2026-06-22T00:00:00Z');
    expect(getCountdown(due, now)).toEqual({
      days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true,
    });
  });
});
