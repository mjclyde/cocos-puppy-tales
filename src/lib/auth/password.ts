import { createHash, timingSafeEqual } from 'node:crypto';

function sha256(input: string): Buffer {
  return createHash('sha256').update(input, 'utf8').digest();
}

/**
 * Constant-time password check. Comparing SHA-256 digests means length never leaks
 * and `timingSafeEqual` always receives two equal-length (32-byte) buffers.
 */
export function verifyPassword(input: string, expected: string): boolean {
  if (!expected) return false; // an unconfigured secret must never match
  return timingSafeEqual(sha256(input), sha256(expected));
}
