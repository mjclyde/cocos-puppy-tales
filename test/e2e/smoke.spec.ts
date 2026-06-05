import { test, expect } from '@playwright/test';

test('home page shows hero, countdown, and nav works', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: "Coco's Puppy Tales" })).toBeVisible();
  await expect(page.locator('#countdown .num').first()).toBeVisible();
  await page.getByRole('link', { name: 'The Journey' }).first().click();
  await expect(page).toHaveURL(/\/journey/);
  await expect(page.getByRole('heading', { name: 'The Journey' })).toBeVisible();
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
