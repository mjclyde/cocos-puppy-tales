import { describe, it, expect } from 'vitest';
import { isValidEmail, buildSubscribePayload } from '../src/lib/subscribe';

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
});
