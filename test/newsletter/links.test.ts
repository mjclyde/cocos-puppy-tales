import { describe, it, expect } from 'vitest';
import { buildUnsubscribeUrl } from '../../src/lib/newsletter/links';
import { verifyUnsubscribeToken } from '../../src/lib/newsletter/unsubscribe-token';

const SECRET = 'test-secret-please-change';

describe('buildUnsubscribeUrl', () => {
  it('builds a URL under the given origin pointing at /unsubscribe', () => {
    const url = buildUnsubscribeUrl('fan@example.com', SECRET, 'https://example.com');
    expect(url.startsWith('https://example.com/unsubscribe?t=')).toBe(true);
  });

  it('strips a trailing slash from the origin', () => {
    const url = buildUnsubscribeUrl('fan@example.com', SECRET, 'https://example.com/');
    expect(url.startsWith('https://example.com/unsubscribe?t=')).toBe(true);
    expect(url.includes('.com//unsubscribe')).toBe(false);
  });

  it('embeds a token that verifies back to the email', () => {
    const url = buildUnsubscribeUrl('Fan@Example.com', SECRET, 'https://example.com');
    const token = decodeURIComponent(new URL(url).searchParams.get('t') ?? '');
    expect(verifyUnsubscribeToken(token, SECRET)).toBe('fan@example.com');
  });
});
