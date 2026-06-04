export const prerender = false;
import type { APIRoute } from 'astro';
import { parseEntryUpdate } from '../../../lib/admin/entry-input';
import { updateWaitlistEntry } from '../../../lib/admin/waitlist-admin';
import { getSupabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const raw = Object.fromEntries(form.entries());
  const parsed = parseEntryUpdate(raw);
  const wantsJson = (request.headers.get('accept') ?? '').includes('application/json');

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Invalid update.';
    return wantsJson ? json({ ok: false, error: msg }, 400) : redirect('/admin');
  }

  const { id, status, notes } = parsed.data;
  const patch: { status?: typeof status; notes?: string } = {};
  if (status !== undefined) patch.status = status;
  if (notes !== undefined) patch.notes = notes;

  try {
    await updateWaitlistEntry(getSupabase(), id, patch);
  } catch {
    return wantsJson ? json({ ok: false, error: 'Could not save changes.' }, 502) : redirect('/admin');
  }

  return wantsJson ? json({ ok: true, message: 'Saved' }, 200) : redirect('/admin');
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
