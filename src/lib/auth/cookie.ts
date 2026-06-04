export const SESSION_COOKIE = 'coco_admin_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Options for the admin session cookie. `secure` is off in dev so http://localhost works. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}
