export const prerender = false;
import type { APIRoute } from 'astro';
import { getSupabase } from '../../../lib/supabase';
import { buildUnsubscribeUrl } from '../../../lib/newsletter/links';

export const GET: APIRoute = async ({ request }) => {
  const secret = import.meta.env.NEWSLETTER_UNSUBSCRIBE_SECRET ?? '';
  if (!secret) {
    console.error('admin/subscribers: NEWSLETTER_UNSUBSCRIBE_SECRET is not configured');
    return json({ ok: false, error: 'Unsubscribe links are not configured.' }, 500);
  }

  // Prefer the configured site origin; fall back to the request origin.
  const origin = import.meta.env.SITE ?? new URL(request.url).origin;

  try {
    const { data, error } = await getSupabase()
      .from('subscribers')
      .select('email')
      .is('unsubscribed_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('admin/subscribers: query failed', error);
      return json({ ok: false, error: 'Could not load subscribers.' }, 502);
    }

    const subscribers = (data ?? []).map((row) => ({
      email: row.email as string,
      unsubscribe_url: buildUnsubscribeUrl(row.email as string, secret, origin),
    }));

    return json({ ok: true, subscribers }, 200);
  } catch (err) {
    console.error('admin/subscribers: unexpected error', err);
    return json({ ok: false, error: 'Subscribers are temporarily unavailable.' }, 500);
  }
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
