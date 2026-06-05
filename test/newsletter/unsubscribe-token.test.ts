import { describe, it, expect } from 'vitest';
import {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from '../../src/lib/newsletter/unsubscribe-token';

const SECRET = 'test-secret-please-change';

describe('unsubscribe token', () => {
  it('round-trips a valid token back to the normalized email', () => {
    const token = createUnsubscribeToken('fan@example.com', SECRET);
    expect(verifyUnsubscribeToken(token, SECRET)).toBe('fan@example.com');
  });

  it('normalizes case so an upper-case email verifies to the lower-case form', () => {
    const token = createUnsubscribeToken('  Fan@Example.COM ', SECRET);
    expect(verifyUnsubscribeToken(token, SECRET)).toBe('fan@example.com');
  });

  it('rejects a token signed with a different secret', () => {
    const token = createUnsubscribeToken('fan@example.com', SECRET);
    expect(verifyUnsubscribeToken(token, 'other-secret')).toBeNull();
  });

  it('rejects a tampered signature', () => {
    const token = createUnsubscribeToken('fan@example.com', SECRET);
    const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
    expect(verifyUnsubscribeToken(tampered, SECRET)).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const token = createUnsubscribeToken('fan@example.com', SECRET);
    const [, sig] = token.split('.');
    const forgedPayload = Buffer.from('evil@example.com', 'utf8').toString('base64url');
    expect(verifyUnsubscribeToken(`${forgedPayload}.${sig}`, SECRET)).toBeNull();
  });

  it('returns null for a malformed token (no separator)', () => {
    expect(verifyUnsubscribeToken('not-a-token', SECRET)).toBeNull();
  });

  it('returns null for an undefined token', () => {
    expect(verifyUnsubscribeToken(undefined, SECRET)).toBeNull();
  });

  it('fails closed when the secret is empty on verify', () => {
    const token = createUnsubscribeToken('fan@example.com', SECRET);
    expect(verifyUnsubscribeToken(token, '')).toBeNull();
  });

  it('throws when creating a token with an empty secret', () => {
    expect(() => createUnsubscribeToken('fan@example.com', '')).toThrow();
  });
});
