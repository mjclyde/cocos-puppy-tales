import { describe, it, expect } from 'vitest';
import { formatUsd, formatLongDate } from '../src/lib/format';

describe('formatUsd', () => {
  it('formats thousands with a separator and no cents', () => {
    expect(formatUsd(3000)).toBe('$3,000');
  });

  it('formats hundreds without a separator', () => {
    expect(formatUsd(250)).toBe('$250');
  });

  it('drops trailing cents rather than showing .00', () => {
    expect(formatUsd(3000)).not.toContain('.');
  });

  it('formats zero', () => {
    expect(formatUsd(0)).toBe('$0');
  });
});

describe('formatLongDate', () => {
  it('formats a date in US long form', () => {
    expect(formatLongDate(new Date('2026-08-20T06:00:00.000Z'))).toBe('August 20, 2026');
  });

  it('does not drift a day due to the local time zone', () => {
    // A UTC midnight date must not render as the 19th for viewers west of UTC.
    expect(formatLongDate(new Date('2026-08-20T00:00:00.000Z'))).toBe('August 20, 2026');
  });

  it('formats a January date without an off-by-one year', () => {
    expect(formatLongDate(new Date('2027-01-01T00:00:00.000Z'))).toBe('January 1, 2027');
  });
});
