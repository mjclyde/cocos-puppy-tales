import { defineConfig } from '@playwright/test';

// NOTE: the @astrojs/vercel adapter does not support `astro preview` for
// on-demand routes, so we run the smoke tests against `astro dev`.
// The smoke tests do not require real Supabase/Buttondown credentials.
export default defineConfig({
  testDir: './test/e2e',
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Inject deterministic admin creds. process.env overrides .env in Astro, so the
    // dev server and the tests below agree on the password without needing real secrets.
    env: {
      ...process.env,
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? 'test-admin-password',
      ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET ?? 'test-session-secret-please-change',
    },
  },
  use: { baseURL: 'http://localhost:4321' },
});
