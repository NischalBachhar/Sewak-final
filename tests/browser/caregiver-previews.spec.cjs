const { test, expect } = require('./test.cjs');
const { seed, db } = require('./seed.cjs');
const axe = require('axe-core');
const fs = require('node:fs');
const path = require('node:path');
test.beforeAll(seed);

async function login(page) {
  await page.goto('/auth');
  await page.getByLabel('Email', { exact: true }).fill('e2e-customer@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Local-test-only-123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/user\/home$/);
}
const fits = async (page, width) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
async function capture(page, name) {
  const output = path.resolve('docs/design/caregiver-previews');
  fs.mkdirSync(output, { recursive: true });
  await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
}

for (const width of [320, 390, 768, 1440]) test(`real public and customer caregiver previews at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const publicQueries = [];
  page.on('request', request => { if (request.url().endsWith('/api/query')) publicQueries.push(request.postDataJSON()); });
  await page.goto('/');
  const preview = page.getByRole('region', { name: 'Meet Sewak Care Professionals' });
  await expect(preview.locator('.caregiver-preview-card')).toHaveCount(1);
  await expect(preview).toContainText('Test Caregiver');
  await expect(preview).toContainText('General care support');
  await expect(preview).toContainText('Accepting requests');
  await expect(preview).toContainText('Verification not complete');
  await expect(preview).toContainText('No verified reviews yet');
  expect(publicQueries.filter(q => q.path === 'publicCaregivers')).toEqual([expect.objectContaining({ search: {}, limit: 3 })]);
  expect(publicQueries.filter(q => q.path === 'publicServices')).toHaveLength(1);
  await fits(page, width); await capture(page, `public-${width}`);
  await page.evaluate(axe.source);
  const accessibility = await page.evaluate(async () => (await window.axe.run(document.querySelector('.caregiver-preview'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(({ id }) => id));
  expect(accessibility).toEqual([]);
  await preview.getByRole('button', { name: 'View profile' }).click();
  await expect(page).toHaveURL(/\/caregivers\/e2e-caregiver$/);
  await expect(page.getByRole('heading', { name: 'Test Caregiver', exact: true })).toBeVisible();
  await page.goto('/'); await preview.getByRole('button', { name: /Sign in to book/ }).click();
  await expect(page).toHaveURL(/\/auth$/);
  expect(await page.evaluate(() => localStorage.getItem('pendingBookingCaregiverId'))).toBe('e2e-caregiver');
  await page.evaluate(() => localStorage.removeItem('pendingBookingCaregiverId'));
  await login(page);
  const customerPreview = page.getByRole('region', { name: 'Find caregivers' });
  await expect(customerPreview.locator('.home-caregiver')).toHaveCount(1);
  await expect(customerPreview.getByRole('link', { name: 'Find All Caregivers' })).toHaveAttribute('href', '/user');
  await fits(page, width); await capture(page, `customer-${width}`);
  await customerPreview.getByRole('link', { name: 'View Profile', exact: true }).click();
  await expect(page).toHaveURL(/\/user\/caregivers\/e2e-caregiver$/);
  await page.goto('/user/home');
  await customerPreview.getByRole('link', { name: 'Book Now', exact: true }).click();
  await expect(page).toHaveURL(/\/user\/book\/e2e-caregiver$/);
  await expect(page.getByRole('heading', { name: 'Who needs care?', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('preview loading, error recovery and empty results are useful', async ({ page }) => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  let mode = 'loading';
  await page.route('**/api/query', async route => {
    if (route.request().postDataJSON().path !== 'publicCaregivers') return route.continue();
    if (mode === 'loading') await pending;
    if (mode === 'error') return route.fulfill({ status: 503, json: { error: { code: 'unavailable', message: 'Retry' } } });
    return route.fulfill({ json: { items: [], nextCursor: null, total: 0 } });
  });
  await page.goto('/');
  const preview = page.getByRole('region', { name: 'Meet Sewak Care Professionals' });
  await expect(preview.getByRole('status')).toHaveText('Loading caregiver profiles…');
  mode = 'error'; release();
  await expect(preview.getByRole('alert')).toContainText('We couldn’t load caregiver profiles');
  mode = 'empty'; await preview.getByRole('button', { name: 'Try again' }).click();
  await expect(preview).toContainText('No care professionals are accepting requests');
});

test('one or two Find Care results are balanced, and unavailable profiles disable bookings', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/browse');
  await expect(page.locator('.browse-result-count')).toHaveText('1 match');
  const card = page.locator('.browse-caregiver-grid .browse-caregiver-card');
  const gridBox = await page.locator('.browse-caregiver-grid').boundingBox();
  const cardBox = await card.boundingBox();
  expect(cardBox.width).toBeLessThanOrEqual(480);
  expect(Math.abs((cardBox.x + cardBox.width / 2) - (gridBox.x + gridBox.width / 2))).toBeLessThan(2);
  await expect(page.getByText('Top-rated caregivers')).toHaveCount(0);
  await capture(page, 'find-care-single-1440');
  const original = (await db.doc('vendors/e2e-caregiver').get()).data();
  try {
    await db.doc('vendors/e2e-preview-second').set({ ...original, name: 'Second Professional', organizationId: null, organizationName: '', servicesOffered: ['catalog_elderly_care'] });
    await page.reload(); await expect(page.locator('.browse-result-count')).toHaveText('2 matches');
    await expect(page.locator('.browse-caregiver-grid--pair .browse-caregiver-card')).toHaveCount(2);
    await capture(page, 'find-care-pair-1440');
    await db.doc('vendors/e2e-caregiver').update({ isAvailable: false });
    await page.goto('/caregivers/e2e-caregiver');
    await expect(page.getByText('Not accepting requests', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in to book' }).first()).toBeDisabled();
    await expect(page.getByText('This professional is not accepting booking requests.')).toBeVisible();
    await page.goto('/');
    await expect(page.locator('.caregiver-preview')).toContainText('Second Professional');
    await expect(page.locator('.caregiver-preview')).not.toContainText('Test Caregiver');
    const unknown = { ...original }; delete unknown.isAvailable;
    await db.doc('vendors/e2e-caregiver').set(unknown);
    await page.goto('/caregivers/e2e-caregiver');
    await expect(page.getByText('Availability not confirmed', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in to book' }).first()).toBeDisabled();
    await db.doc('vendors/e2e-caregiver').update({ isAvailable: true, isSuspended: true });
    await page.goto('/caregivers/e2e-caregiver');
    await expect(page.getByRole('heading', { name: 'Caregiver profile unavailable' })).toBeVisible();
  } finally {
    await db.doc('vendors/e2e-caregiver').set(original);
    await db.doc('vendors/e2e-preview-second').update({ isApproved: false });
  }
});

test('previews stay bounded to three server profiles on desktop and mobile', async ({ page }) => {
  const original = (await db.doc('vendors/e2e-caregiver').get()).data();
  const ids = ['e2e-preview-a', 'e2e-preview-b', 'e2e-preview-c'];
  try {
    for (const id of ids) await db.doc('vendors/' + id).set({ ...original, name: 'Preview Professional ' + id.slice(-1).toUpperCase(), organizationId: null, organizationName: '', servicesOffered: ['catalog_elderly_care'] });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/');
      await expect(page.locator('.caregiver-preview-card')).toHaveCount(3);
      await fits(page, width);
      await capture(page, 'public-three-' + width);
    }
  } finally {
    for (const id of ids) await db.doc('vendors/' + id).update({ isApproved: false });
  }
});
