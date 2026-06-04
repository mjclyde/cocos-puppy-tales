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
  },
  use: { baseURL: 'http://localhost:4321' },
});
