import { test, expect } from '@playwright/test';

test('home page shows the litter, birth story, cast, and nav works', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: "Meet Coco's puppies" })).toBeVisible();
  // Birth announcement replaced the pre-birth hero.
  await expect(page.locator('#litter-age .num')).toBeVisible();
  // The pre-birth countdown is gone, but a go-home countdown now runs.
  await expect(page.locator('#countdown')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Ready to go home' })).toBeVisible();
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

test('clicking a photo opens the lightbox, navigates, and closes', async ({ page }) => {
  await page.goto('/');
  // Open the lightbox from the first puppy card's carousel (Blue collar, first
  // in litter.md — now its own PhotoSwipe group of 9, since each carousel is a group).
  await page.locator('.cast .slide-img').first().click();
  const pswp = page.locator('.pswp');
  await expect(pswp).toBeVisible();
  await expect(page.locator('.pswp img.pswp__img').first()).toBeVisible();
  // Counter proves grouping; asserting it also waits out the open animation.
  const counter = page.locator('.pswp__counter');
  await expect(counter).toHaveText(/1\s*\/\s*9/);
  // Step to the next photo within the group. Scoped to the open lightbox:
  // the carousels behind it now also have "Next photo of <name>" buttons,
  // which collide with an unscoped `{ name: 'Next' }` substring match.
  await pswp.getByRole('button', { name: 'Next' }).click();
  await expect(counter).toHaveText(/2\s*\/\s*9/);
  // Let the slide transition settle — PhotoSwipe drops a close issued mid-animation.
  await page.waitForTimeout(500);
  // Close with Escape — the lightbox is no longer open.
  await page.keyboard.press('Escape');
  await expect(page.locator('.pswp--open')).toHaveCount(0);
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

test('a cast card carousels through that puppy\'s photos', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('article.pup', { hasText: 'Blue collar' });

  await expect(card.getByText(/^1 \/ \d+$/)).toBeVisible();

  // Controls are hover-revealed with `pointer-events: none`, so hover first —
  // otherwise Playwright's actionability check fails on the hit test.
  await card.hover();
  await card.getByRole('button', { name: 'Next photo of Blue' }).click();
  await expect(card.getByText(/^2 \/ \d+$/)).toBeVisible();

  await card.getByRole('button', { name: 'Previous photo of Blue' }).click();
  await expect(card.getByText(/^1 \/ \d+$/)).toBeVisible();
});

test('the carousel wraps backwards from the first photo to the last', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('article.pup', { hasText: 'Black collar' });

  await card.hover();
  await card.getByRole('button', { name: 'Previous photo of Black' }).click();
  await expect(card.getByText('6 / 6')).toBeVisible();
});

test('the home page no longer shows the first-days grid', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'First days' })).toHaveCount(0);
});
