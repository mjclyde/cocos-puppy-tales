export const prerender = false;
import type { APIRoute } from 'astro';
import { verifyPassword } from '../../../lib/auth/password';
import { createSessionToken } from '../../../lib/auth/session';
import { SESSION_COOKIE, SESSION_TTL_MS, sessionCookieOptions } from '../../../lib/auth/cookie';

const FAIL_DELAY_MS = 600; // small fixed delay blunts password guessing
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const password = String(form.get('password') ?? '');
  const expected = import.meta.env.ADMIN_PASSWORD ?? '';
  const secret = import.meta.env.ADMIN_SESSION_SECRET ?? '';

  if (!verifyPassword(password, expected)) {
    await delay(FAIL_DELAY_MS);
    return redirect('/admin/login?error=1');
  }

  const token = createSessionToken(secret, Date.now(), SESSION_TTL_MS);
  cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return redirect('/admin');
};
