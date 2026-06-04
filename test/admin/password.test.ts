import { describe, it, expect } from 'vitest';
import { verifyPassword } from '../../src/lib/auth/password';

describe('verifyPassword', () => {
  it('accepts the matching password', () => {
    expect(verifyPassword('hunter2', 'hunter2')).toBe(true);
  });
  it('rejects a wrong password', () => {
    expect(verifyPassword('wrong', 'hunter2')).toBe(false);
  });
  it('rejects when the expected secret is empty (unconfigured)', () => {
    expect(verifyPassword('anything', '')).toBe(false);
  });
  it('rejects an empty input against a real secret', () => {
    expect(verifyPassword('', 'hunter2')).toBe(false);
  });
});
