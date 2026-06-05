import { createHmac, timingSafeEqual } from 'node:crypto';
import { normalizeEmail } from '../subscribe';

const SEP = '.';

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Build a stateless unsubscribe token for an email.
 * Format: base64url(normalizedEmail) + "." + hmacSha256Hex(normalizedEmail, secret).
 * No expiry — links must keep working in already-sent emails indefinitely.
 */
export function createUnsubscribeToken(email: string, secret: string): string {
  if (!secret) {
    throw new Error('NEWSLETTER_UNSUBSCRIBE_SECRET is not configured');
  }
  const normalized = normalizeEmail(email);
  const payload = Buffer.from(normalized, 'utf8').toString('base64url');
  return `${payload}${SEP}${sign(normalized, secret)}`;
}

/**
 * Verify a token. Returns the normalized email if the signature is valid,
 * otherwise null. Fails closed on empty secret or malformed input.
 */
export function verifyUnsubscribeToken(
  token: string | undefined,
  secret: string,
): string | null {
  if (!token) return null;
  // Fail closed: an empty secret must never validate a token.
  if (!secret) return null;

  const idx = token.indexOf(SEP);
  if (idx <= 0) return null;

  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);

  const email = Buffer.from(payload, 'base64url').toString('utf8');
  if (!email) return null;

  const expected = sign(email, secret);
  // Decode as hex so timingSafeEqual gets equal-length buffers; a malformed sig
  // decodes to a buffer that won't match rather than throwing.
  const sigBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  return email;
}
