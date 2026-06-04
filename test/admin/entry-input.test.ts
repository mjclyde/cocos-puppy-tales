import { describe, it, expect } from 'vitest';
import { parseEntryUpdate, WAITLIST_STATUSES } from '../../src/lib/admin/entry-input';

const id = '00000000-0000-0000-0000-000000000001';

describe('parseEntryUpdate', () => {
  it('accepts a valid status update', () => {
    const r = parseEntryUpdate({ id, status: 'approved' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe('approved');
  });

  it('accepts a notes-only update (including empty notes)', () => {
    expect(parseEntryUpdate({ id, notes: 'nice yard' }).success).toBe(true);
    expect(parseEntryUpdate({ id, notes: '' }).success).toBe(true);
  });

  it('rejects an unknown status', () => {
    expect(parseEntryUpdate({ id, status: 'maybe' }).success).toBe(false);
  });

  it('rejects a non-uuid id', () => {
    expect(parseEntryUpdate({ id: 'nope', status: 'new' }).success).toBe(false);
  });

  it('rejects an update with neither status nor notes', () => {
    expect(parseEntryUpdate({ id }).success).toBe(false);
  });

  it('rejects notes longer than 4000 characters', () => {
    expect(parseEntryUpdate({ id, notes: 'x'.repeat(4001) }).success).toBe(false);
  });

  it('exposes the four lifecycle statuses', () => {
    expect(WAITLIST_STATUSES).toEqual(['new', 'contacted', 'approved', 'declined']);
  });
});
