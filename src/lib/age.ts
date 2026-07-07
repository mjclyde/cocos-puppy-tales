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
