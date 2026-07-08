import { test, expect } from '@playwright/test';

test('home page shows the litter, birth story, cast, and nav works', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: "Meet Coco's puppies" })).toBeVisible();
  // Birth announcement replaced the pre-birth countdown.
  await expect(page.locator('#litter-age .num')).toBeVisible();
  await expect(page.locator('#countdown')).toHaveCount(0);
  // Stats band.
  await expect(page.getByText('9', { exact: true }).first()).toBeVisible();
  // Birth story now lives in the hero.
  await expect(page.getByRole('heading', { name: /They arrived a few days early/i })).toBeVisible();
  // All nine collar cards render, each naming its collar.
  await expect(page.getByText('Blue collar')).toBeVisible();
  await expect(page.getByText('Green collar')).toBeVisible();
  await expect(page.getByRole('link', { name: /Join the waitlist/i })).toBeVisible();
  // Nav still works.
  await page.getByRole('link', { name: 'The Journey' }).first().click();
  await expect(page).toHaveURL(/\/journey/);
  await expect(page.getByRole('heading', { name: 'The Journey' })).toBeVisible();
});

test('journey birth capstone links back to the home litter', async ({ page }) => {
  await page.goto('/journey');
  await expect(page.getByRole('heading', { name: /They're here!/ })).toBeVisible();
  await page.getByRole('link', { name: /Meet the whole litter/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: "Meet Coco's puppies" })).toBeVisible();
});

test('waitlist form shows a validation error on empty submit', async ({ page }) => {
  await page.goto('/waitlist');
  // Bypass native required validation to exercise the server error path.
  await page.evaluate(() => {
    document.querySelectorAll('#waitlist-form [required]').forEach((el) => el.removeAttribute('required'));
  });
  await page.getByRole('button', { name: 'Join the waitlist' }).click();
  await expect(page.locator('#wl-msg')).not.toHaveText('', { timeout: 5000 });
});

test('unsubscribe page shows an invalid-link message for a bogus token', async ({ page }) => {
  // A malformed token never verifies, so the page renders the invalid state
  // without touching the database.
  await page.goto('/unsubscribe?t=bogus');
  await expect(page.getByRole('heading', { name: 'This unsubscribe link is invalid' })).toBeVisible();
});
