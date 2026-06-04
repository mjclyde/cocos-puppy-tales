import { createHmac, timingSafeEqual } from 'node:crypto';

const SEP = '.';

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Create a session token that expires at `now + ttlMs`. */
export function createSessionToken(secret: string, now: number, ttlMs: number): string {
  const expiry = String(now + ttlMs);
  return `${expiry}${SEP}${sign(expiry, secret)}`;
}

/** True only if the signature is valid AND the token has not expired as of `now`. */
export function verifySessionToken(
  token: string | undefined,
  secret: string,
  now: number,
): boolean {
  if (!token) return false;
  // Fail closed: an empty secret must never validate a token, otherwise a token
  // forged with an empty-key HMAC would be accepted in a misconfigured deployment.
  if (!secret) return false;
  const idx = token.indexOf(SEP);
  if (idx <= 0) return false;
  const expiry = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = sign(expiry, secret);
  // Decode as hex so timingSafeEqual always gets equal-length byte buffers.
  // A malformed (non-hex / multi-byte) sig decodes to a buffer that won't match,
  // rather than throwing a RangeError on a length mismatch.
  const sigBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return false;
  const expiryNum = Number(expiry);
  if (!Number.isFinite(expiryNum)) return false;
  return expiryNum > now;
}
