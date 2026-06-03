import { describe, it, expect } from 'vitest';
import { parseWaitlist } from '../src/lib/waitlist';

const valid = {
  name: 'Jordan Rivera',
  email: 'jordan@example.com',
  phone: '555-123-4567',
  location: 'Boise, ID',
  about: 'We have a fenced yard and work from home.',
  preferences: 'Female, any color',
  read_expectations: 'on',
  source: 'Instagram',
  website: '', // honeypot — must be empty
};

describe('parseWaitlist', () => {
  it('parses a valid submission and coerces the checkbox to boolean', () => {
    const result = parseWaitlist(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.read_expectations).toBe(true);
      expect(result.data.email).toBe('jordan@example.com');
    }
  });

  it('fails when required fields are missing', () => {
    const result = parseWaitlist({ ...valid, email: '', name: '' });
    expect(result.success).toBe(false);
  });

  it('fails when the honeypot is filled (spam)', () => {
    const result = parseWaitlist({ ...valid, website: 'http://spam.example' });
    expect(result.success).toBe(false);
  });
});
