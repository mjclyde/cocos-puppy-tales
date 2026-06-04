import { describe, it, expect } from 'vitest';
import { createSessionToken, verifySessionToken } from '../../src/lib/auth/session';

const SECRET = 'unit-test-secret';
const TTL = 1000 * 60 * 60; // 1 hour
const NOW = 1_000_000;

describe('session token', () => {
  it('verifies a freshly minted token', () => {
    const token = createSessionToken(SECRET, NOW, TTL);
    expect(verifySessionToken(token, SECRET, NOW + 60_000)).toBe(true);
  });

  it('rejects an expired token', () => {
    const token = createSessionToken(SECRET, NOW, TTL);
    expect(verifySessionToken(token, SECRET, NOW + TTL + 1)).toBe(false);
  });

  it('rejects a token signed with a different secret', () => {
    const token = createSessionToken(SECRET, NOW, TTL);
    expect(verifySessionToken(token, 'other-secret', NOW)).toBe(false);
  });

  it('rejects a tampered expiry', () => {
    const token = createSessionToken(SECRET, NOW, TTL);
    const [, sig] = token.split('.');
    const forged = `${NOW + TTL * 10}.${sig}`;
    expect(verifySessionToken(forged, SECRET, NOW)).toBe(false);
  });

  it('rejects undefined and malformed tokens', () => {
    expect(verifySessionToken(undefined, SECRET, NOW)).toBe(false);
    expect(verifySessionToken('garbage', SECRET, NOW)).toBe(false);
  });

  it('fails closed when the secret is empty, even for an empty-secret token', () => {
    const token = createSessionToken('', NOW, TTL);
    expect(verifySessionToken(token, '', NOW)).toBe(false);
  });
});
