import { defineMiddleware } from 'astro:middleware';
import { verifySessionToken } from './lib/auth/session';
import { SESSION_COOKIE } from './lib/auth/cookie';

// Reachable without a session: the login screen and its POST handler.
const PUBLIC_ADMIN_PATHS = new Set(['/admin/login', '/api/admin/login']);

function isAdminPath(pathname: string): boolean {
  return (
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname.startsWith('/api/admin')
  );
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  if (!isAdminPath(pathname) || PUBLIC_ADMIN_PATHS.has(pathname)) {
    return next();
  }

  const secret = import.meta.env.ADMIN_SESSION_SECRET ?? '';
  const token = context.cookies.get(SESSION_COOKIE)?.value;
  if (verifySessionToken(token, secret, Date.now())) {
    return next();
  }

  if (pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return context.redirect('/admin/login');
});
