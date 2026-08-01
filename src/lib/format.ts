/**
 * Presentation helpers for money and dates.
 *
 * Deliberately free of Astro imports so they can be unit-tested with plain
 * values, matching `countdown.ts` and `age.ts`.
 */

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** `3000` → `$3,000`. Whole dollars only — puppy prices have no cents. */
export function formatUsd(amount: number): string {
  return USD.format(amount);
}

const LONG_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  // Content dates are authored as UTC instants. Formatting in local time would
  // render the go-home date a day early for viewers west of the stored offset,
  // which matters when the date is a commitment. Same reasoning as `shootLabel`
  // in src/lib/photos/paths.ts.
  timeZone: 'UTC',
});

/** `2026-08-20T06:00:00Z` → `August 20, 2026`, stable across time zones. */
export function formatLongDate(date: Date): string {
  return LONG_DATE.format(date);
}
