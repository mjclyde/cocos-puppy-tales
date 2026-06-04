import { test, expect } from '@playwright/test';

// Mirrors the fallback in playwright.config.ts so the typed password matches the
// password the dev server was started with (process.env overrides .env in Astro).
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'test-admin-password';

test('unauthenticated /admin redirects to login', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByLabel('Password')).toBeVisible();
});

test('wrong password shows an error', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Password').fill('definitely-wrong');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/admin\/login\?error/);
  await expect(page.getByRole('alert')).toBeVisible();
});

test('correct password logs in; logout returns to login', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  // The dashboard renders even if Supabase isn't configured (shows entries or a load error).
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  // The session must actually be cleared: /admin should redirect back to login.
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
});

// The data-flow test needs real Supabase credentials in the dev server's env, so it
// is skipped unless E2E_SUPABASE=1. It seeds a row via the public waitlist API, then
// edits it as admin and confirms persistence.
const RUN_DATA_E2E = process.env.E2E_SUPABASE === '1';

test.describe('admin data flow (requires Supabase)', () => {
  test.skip(!RUN_DATA_E2E, 'Set E2E_SUPABASE=1 with real Supabase env to run.');

  test('status and notes persist across reload', async ({ page, request, baseURL }) => {
    // Seed a uniquely named entry through the public waitlist API. Astro's CSRF
    // protection requires a matching Origin header on form POSTs.
    const tag = `e2e-${Date.now()}`;
    const res = await request.post('/api/waitlist', {
      headers: { Origin: baseURL ?? 'http://localhost:4321' },
      form: {
        name: tag,
        email: `${tag}@example.com`,
        location: 'Testville, TS',
        about: 'E2E seed entry.',
        read_expectations: 'on',
        website: '',
      },
    });
    expect(res.ok()).toBeTruthy();

    // Log in.
    await page.goto('/admin/login');
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // Edit the seeded row.
    const row = page.locator('tr', { hasText: tag });
    await row.locator('select[name="status"]').selectOption('approved');
    await row.locator('textarea[name="notes"]').fill('Lovely family.');
    await row.getByRole('button', { name: 'Save' }).click();
    await expect(row.locator('.saved')).toHaveText(/Saved/);

    // Reload and confirm persistence.
    await page.reload();
    const row2 = page.locator('tr', { hasText: tag });
    await expect(row2.locator('select[name="status"]')).toHaveValue('approved');
    await expect(row2.locator('textarea[name="notes"]')).toHaveValue('Lovely family.');
  });
});
