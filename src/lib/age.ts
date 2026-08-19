export interface Age {
  days: number;
  weeks: number;
}

/** Whole days (and derived weeks) elapsed since `born`, clamped at 0. */
export function getAgeInDays(born: Date, now: Date): Age {
  const diffMs = now.getTime() - born.getTime();
  const days = Math.max(0, Math.floor(diffMs / 86_400_000));
  return { days, weeks: Math.floor(days / 7) };
}

export interface AgeLabel {
  value: number;
  unit: string;
}

/**
 * The number and unit for the age chip — `{ value: 7, unit: 'weeks old' }`.
 *
 * Weeks are the unit families think in once there is at least one; before that
 * a week count would read "0 weeks old", so it falls back to days. Rounds down
 * with `getAgeInDays`, so the chip never claims an age not yet reached.
 */
export function formatAge({ days, weeks }: Age): AgeLabel {
  if (weeks < 1) return { value: days, unit: days === 1 ? 'day old' : 'days old' };
  return { value: weeks, unit: weeks === 1 ? 'week old' : 'weeks old' };
}
