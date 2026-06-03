export const prerender = false;
import type { APIRoute } from 'astro';
import { isValidEmail, buildSubscribePayload } from '../../lib/subscribe';

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim();

  if (!isValidEmail(email)) {
    return json({ ok: false, error: 'Please enter a valid email.' }, 400);
  }

  const apiKey = import.meta.env.BUTTONDOWN_API_KEY;
  if (!apiKey) {
    return json({ ok: false, error: 'Subscriptions are temporarily unavailable.' }, 500);
  }

  const res = await fetch('https://api.buttondown.email/v1/subscribers', {
    method: 'POST',
    headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildSubscribePayload(email)),
  });

  // 201 created; 400 often means "already subscribed" — treat as success for UX.
  if (res.ok || res.status === 400) {
    return json({ ok: true, message: "You're on the list! 🐾" }, 200);
  }
  return json({ ok: false, error: 'Something went wrong. Please try again.' }, 502);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
