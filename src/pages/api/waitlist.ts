export const prerender = false;
import type { APIRoute } from 'astro';
import { parseWaitlist } from '../../lib/waitlist';
import { getSupabase } from '../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const raw = Object.fromEntries(form.entries());
  const parsed = parseWaitlist(raw);

  if (!parsed.success) {
    // Honeypot or validation failure. If only the honeypot tripped, pretend success.
    if (typeof raw.website === 'string' && raw.website.length > 0) {
      return json({ ok: true, message: "Thanks! We'll be in touch." }, 200);
    }
    const firstError = parsed.error.issues[0]?.message ?? 'Please check your entries.';
    return json({ ok: false, error: firstError }, 400);
  }

  const { website: _website, read_expectations, ...rest } = parsed.data;
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('waitlist').insert({ ...rest, read_expectations });
    if (error) throw error;
  } catch {
    return json({ ok: false, error: 'Could not save your entry. Please try again.' }, 502);
  }

  return json({ ok: true, message: "You're on the list — we'll be in touch! 🐾" }, 200);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
