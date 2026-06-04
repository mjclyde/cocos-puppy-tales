export const prerender = false;
import type { APIRoute } from 'astro';
import { SESSION_COOKIE } from '../../../lib/auth/cookie';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete(SESSION_COOKIE, { path: '/' });
  return redirect('/admin/login');
};
