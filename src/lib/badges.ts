/**
 * The trust row shown on the home page — the same four promises as the printed
 * flyer, so a visitor who scanned the QR code sees what they just read.
 *
 * The labels live in `src/content/site/config.json`; only the icon vocabulary is
 * code, because each name has to map to a drawing in `TrustBadges.astro`.
 */

export const BADGE_ICONS = ['home', 'check', 'ribbon', 'shield'] as const;

export type BadgeIcon = (typeof BADGE_ICONS)[number];

export interface Badge {
  label: string;
  icon: BadgeIcon;
}
