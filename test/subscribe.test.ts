import { describe, it, expect } from 'vitest';
import { isValidEmail, buildSubscribePayload, normalizeEmail } from '../src/lib/subscribe';

describe('subscribe helpers', () => {
  it('accepts a valid email', () => {
    expect(isValidEmail('fan@example.com')).toBe(true);
  });
  it('rejects an invalid email', () => {
    expect(isValidEmail('nope')).toBe(false);
  });
  it('builds the Buttondown payload', () => {
    expect(buildSubscribePayload('fan@example.com')).toEqual({
      email_address: 'fan@example.com',
      tags: ['coco-nursery'],
    });
  });
  it('normalizes email by trimming and lowercasing', () => {
    expect(normalizeEmail('  Fan@Example.COM  ')).toBe('fan@example.com');
  });
  it('leaves an already-normalized email unchanged', () => {
    expect(normalizeEmail('fan@example.com')).toBe('fan@example.com');
  });
});
