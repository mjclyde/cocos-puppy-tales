import { test, expect } from '@playwright/test';

test('the gallery shows every section by default', async ({ page }) => {
  await page.goto('/gallery');
  await expect(page.getByRole('heading', { name: /^Group photos/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^First days/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Blue collar/ })).toBeVisible();
  await expect(page.locator('[data-section]')).toHaveCount(12);
});

test('a collar chip isolates that puppy and updates the hash', async ({ page }) => {
  await page.goto('/gallery');
  await page.getByRole('button', { name: 'Pink' }).click();

  await expect(page.locator('[data-section="pink"]')).toBeVisible();
  await expect(page.locator('[data-section="group"]')).toBeHidden();
  await expect(page.locator('[data-section="blue"]')).toBeHidden();
  await expect(page).toHaveURL(/#pink$/);
  await expect(page.getByRole('button', { name: 'Pink' })).toHaveAttribute('aria-pressed', 'true');
});

test('All restores every section', async ({ page }) => {
  await page.goto('/gallery');
  await page.getByRole('button', { name: 'Pink' }).click();
  await page.getByRole('button', { name: 'All' }).click();

  await expect(page.locator('[data-section="group"]')).toBeVisible();
  await expect(page.locator('[data-section="pink"]')).toBeVisible();
  await expect(page).not.toHaveURL(/#/);
});

test('a hash in the URL applies the filter on load', async ({ page }) => {
  await page.goto('/gallery#blue');

  await expect(page.locator('[data-section="blue"]')).toBeVisible();
  await expect(page.locator('[data-section="group"]')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Blue' })).toHaveAttribute('aria-pressed', 'true');
});

test('an unknown hash falls back to All rather than an empty page', async ({ page }) => {
  await page.goto('/gallery#teal');

  await expect(page.locator('[data-section="group"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
});
