import { test, expect } from '@playwright/test';

test('home page leads with the nine puppies, their promises, and nav works', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: "Meet Coco's nine puppies" })).toBeVisible();
  // The age chip reads in weeks at this stage, not days.
  await expect(page.locator('#litter-age')).toContainText(/weeks old/);
  await expect(page.getByText('Cache Valley, Utah')).toBeVisible();
  // The printed flyer's four promises, so a visitor who scanned the QR code
  // lands on the same claims they just read.
  for (const promise of ['Family raised', 'Vet checked', 'AKC registered', 'Vaccinated']) {
    await expect(page.getByText(promise, { exact: true })).toBeVisible();
  }
  // The birth is no longer the home page's story: no born date, no arrival
  // write-up, and no go-home countdown now that the puppies are ready.
  await expect(page.getByText(/^Born /)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /They arrived a few days early/i })).toHaveCount(0);
  await expect(page.locator('#countdown')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Ready to go home' })).toHaveCount(0);
  // The intro carries the derived availability notice plus the editable tagline.
  await expect(page.getByText('Just one puppy left — the Yellow collar.')).toBeVisible();
  await expect(page.getByText('Eight of the nine have found their families.')).toBeVisible();
  // The plural count wording belongs to a litter with more than one collar open.
  await expect(page.getByText(/still looking for their families/i)).toHaveCount(0);
  // All nine collar cards render, each naming its collar.
  await expect(page.getByText('Blue collar')).toBeVisible();
  await expect(page.getByText('Green collar')).toBeVisible();
  // One CTA phrase site-wide, so the nav link shares it — scope to <main> to
  // count just the page's two: the opening block and the closing band.
  const ctas = page.locator('main').getByRole('link', { name: /^Take one home/i });
  await expect(ctas).toHaveCount(2);
  await expect(ctas.first()).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link', { name: /^Take one home/i })).toBeVisible();
  // Nav still works.
  await page.getByRole('link', { name: 'The Journey' }).first().click();
  await expect(page).toHaveURL(/\/journey/);
  await expect(page.getByRole('heading', { name: 'The Journey' })).toBeVisible();
});

test('clicking a photo opens the lightbox, navigates, and closes', async ({ page }) => {
  await page.goto('/');
  // Open the lightbox from the first puppy card's carousel (Blue collar, first
  // in litter.md). Each carousel is its own PhotoSwipe group, so the lightbox
  // holds only that puppy's photos.
  const card = page.locator('article.pup').first();
  // The card's own counter reads "1 / <that puppy's photos>". Reading the total
  // from it rather than hardcoding one keeps this a grouping assertion — the
  // lightbox must show one puppy's set, not the whole page's — that survives a
  // new shoot being added.
  const total = (await card.getByText(/^\d+ \/ \d+$/).innerText()).split('/')[1].trim();
  await card.locator('.slide-img').first().click();
  const pswp = page.locator('.pswp');
  await expect(pswp).toBeVisible();
  await expect(page.locator('.pswp img.pswp__img').first()).toBeVisible();
  // Counter proves grouping; asserting it also waits out the open animation.
  const counter = page.locator('.pswp__counter');
  await expect(counter).toHaveText(new RegExp(`1\\s*/\\s*${total}`));
  // Step to the next photo within the group. Scoped to the open lightbox:
  // the carousels behind it now also have "Next photo of <name>" buttons,
  // which collide with an unscoped `{ name: 'Next' }` substring match.
  await pswp.getByRole('button', { name: 'Next' }).click();
  await expect(counter).toHaveText(new RegExp(`2\\s*/\\s*${total}`));
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
  await expect(page.getByRole('heading', { name: "Meet Coco's nine puppies" })).toBeVisible();
});

test('waitlist form shows a validation error on empty submit', async ({ page }) => {
  await page.goto('/waitlist');
  // Bypass native required validation to exercise the server error path.
  await page.evaluate(() => {
    document.querySelectorAll('#waitlist-form [required]').forEach((el) => el.removeAttribute('required'));
  });
  await page.getByRole('button', { name: /Send my info/ }).click();
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
  const counter = card.getByText(/^\d+ \/ \d+$/);
  // Read the set size off the counter: the wrap is what's under test, and
  // pinning a photo count here would red this spec every time a shoot lands.
  const total = (await counter.innerText()).split('/')[1].trim();

  await card.hover();
  await card.getByRole('button', { name: 'Previous photo of Black' }).click();
  await expect(counter).toHaveText(`${total} / ${total}`);
});

test('the home page no longer shows the first-days grid', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'First days' })).toHaveCount(0);
});

test('the cast marks the eight taken puppies and leaves the last one open', async ({ page }) => {
  await page.goto('/');
  // Eight collars carry `status: reserved` in litter.md, so eight cards wear the
  // Adopted badge and the dimmed photo — and exactly one does not.
  await expect(page.getByText('Adopted', { exact: true })).toHaveCount(8);
  await expect(page.locator('article.pup.is-adopted')).toHaveCount(8);
  const open = page.locator('article.pup:not(.is-adopted)');
  await expect(open).toHaveCount(1);
  await expect(open).toContainText('Yellow collar');
  // "Reserved" was the badge's old wording; nothing should still say it.
  await expect(page.getByText('Reserved', { exact: true })).toHaveCount(0);
});

test('the details block answers price and go-home date before the form', async ({ page }) => {
  await page.goto('/waitlist');
  await expect(page.getByRole('heading', { name: 'Take one home' })).toBeVisible();
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
