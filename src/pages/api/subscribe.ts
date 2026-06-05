export const prerender = false;
import type { APIRoute } from 'astro';
import { isValidEmail, normalizeEmail } from '../../lib/subscribe';
import { getSupabase } from '../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const email = normalizeEmail(String(form.get('email') ?? ''));

  if (!isValidEmail(email)) {
    return json({ ok: false, error: 'Please enter a valid email.' }, 400);
  }

  try {
    // Insert new, or reactivate a previously-unsubscribed email, in one call.
    // created_at is omitted so existing rows keep their original timestamp.
    const { error } = await getSupabase()
      .from('subscribers')
      .upsert({ email, unsubscribed_at: null }, { onConflict: 'email' });

    if (error) {
      console.error('subscribe: upsert failed', error);
      return json({ ok: false, error: 'Something went wrong. Please try again.' }, 502);
    }
  } catch (err) {
    console.error('subscribe: unexpected error', err);
    return json({ ok: false, error: 'Subscriptions are temporarily unavailable.' }, 500);
  }

  return json({ ok: true, message: "You're on the list! 🐾" }, 200);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
