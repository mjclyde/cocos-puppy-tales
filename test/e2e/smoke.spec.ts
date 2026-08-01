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

test('home page shows availability — two reserved, seven open', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Seven are still looking for their families.')).toBeVisible();
  // Only Orange and Yellow are reserved.
  await expect(page.getByText('Reserved', { exact: true })).toHaveCount(2);
  await expect(page.locator('article.pup.is-reserved')).toHaveCount(2);
  await expect(page.locator('article.pup', { hasText: 'Yellow collar' })).toHaveClass(/is-reserved/);
  await expect(page.locator('article.pup', { hasText: 'Blue collar' })).not.toHaveClass(/is-reserved/);
});

test('the details block answers price and go-home date before the form', async ({ page }) => {
  await page.goto('/waitlist');
  await expect(page.getByRole('heading', { name: 'Bring one home' })).toBeVisible();
  await expect(page.getByText('August 20, 2026')).toBeVisible();
  await expect(page.getByText('$3,000')).toBeVisible();
  await expect(page.getByText('$250').first()).toBeVisible();
  await expect(page.getByText(/cash, check, Venmo, or Apple Pay/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Every puppy goes home with' })).toBeVisible();
  await expect(page.getByText('AKC registration papers')).toBeVisible();
  await expect(page.getByText(/health guarantee is included in your puppy contract/i)).toBeVisible();
  // The details precede the form in the DOM, so nobody applies blind.
  const detailsY = (await page.locator('.details').boundingBox())!.y;
  const formY = (await page.locator('#waitlist-form').boundingBox())!.y;
  expect(detailsY).toBeLessThan(formY);
});

test('no page leaks a payment handle or phone number', async ({ page }) => {
  // Hardcoded rather than imported from src/content/site/config.json: this
  // spec asserts on rendered page text only, and the site's own contact
  // email is the one legitimate handle-shaped string the guard must let
  // through — stripping it first, rather than carving an exception into the
  // regex, keeps the pattern itself simple and still able to fail.
  const CONTACT_EMAIL = 'cocos-puppy-tales@mjclyde.com';
  for (const path of ['/', '/waitlist', '/coco', '/journey', '/breed', '/gallery']) {
    await page.goto(path);
    const body = (await page.locator('body').innerText()).replaceAll(CONTACT_EMAIL, '');
    expect(body).not.toMatch(/@[A-Za-z0-9_.-]{3,}/); // Venmo-style handle
    expect(body).not.toMatch(/\b\d{3}[.\-\s]\d{3}[.\-\s]\d{4}\b/); // phone number
  }
});

test('the parents page shows both dogs with their credentials', async ({ page }) => {
  await page.goto('/coco');
  await expect(page.getByRole('heading', { name: /Meet Coco and Rocko/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Coco', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rocko', exact: true })).toBeVisible();
  // Exact match: a loose substring match also catches "a mom for the first
  // time" in Coco's bio prose, which is unrelated legitimate content.
  await expect(page.getByText('Mom', { exact: true })).toBeVisible();
  await expect(page.getByText('Dad', { exact: true })).toBeVisible();
  // Both parents carry the same four credentials.
  await expect(page.getByText(/OFA certified/)).toHaveCount(2);
  await expect(page.getByText(/CHIC certified/)).toHaveCount(2);
});

test('the journey runs puppies-first with correctly ordered weeks', async ({ page }) => {
  await page.goto('/journey');
  await expect(page.getByRole('heading', { name: 'The puppies' })).toBeVisible();
  await expect(page.getByRole('heading', { name: "Coco's pregnancy" })).toBeVisible();
  // Puppy weeks descend and are labelled distinctly from pregnancy weeks.
  const chips = await page.locator('.phase').first().locator('.chip').allInnerTexts();
  expect(chips).toEqual(['Puppy week 5', 'Puppy week 4', 'Puppy week 3', 'Puppy week 1']);
  // Week 7 is unpublished until the vet visit happens.
  await expect(page.getByText('Puppy week 7')).toHaveCount(0);
  // The puppies section precedes the pregnancy section.
  const headings = await page.locator('.phase h2').allInnerTexts();
  expect(headings).toEqual(['The puppies', "Coco's pregnancy"]);
});
