import { describe, it, expect } from 'vitest';
import { isValidEmail, normalizeEmail } from '../src/lib/subscribe';

describe('subscribe helpers', () => {
  it('accepts a valid email', () => {
    expect(isValidEmail('fan@example.com')).toBe(true);
  });
  it('rejects an invalid email', () => {
    expect(isValidEmail('nope')).toBe(false);
  });
  it('normalizes email by trimming and lowercasing', () => {
    expect(normalizeEmail('  Fan@Example.COM  ')).toBe('fan@example.com');
  });
  it('leaves an already-normalized email unchanged', () => {
    expect(normalizeEmail('fan@example.com')).toBe('fan@example.com');
  });
});
