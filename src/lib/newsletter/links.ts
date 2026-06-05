import { createUnsubscribeToken } from './unsubscribe-token';

/** Build the absolute one-click unsubscribe URL for an email. */
export function buildUnsubscribeUrl(
  email: string,
  secret: string,
  origin: string,
): string {
  const token = createUnsubscribeToken(email, secret);
  const base = origin.replace(/\/+$/, '');
  return `${base}/unsubscribe?t=${encodeURIComponent(token)}`;
}
