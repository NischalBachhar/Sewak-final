const { test, expect } = require('./test.cjs');
const { seed } = require('./seed.cjs');
const axe = require('axe-core');
const fs = require('node:fs');
const path = require('node:path');

test.beforeAll(seed);
const directory = path.resolve('docs/design/homepage-booking-first');
async function noOverflow(page, width) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}
async function capture(page, label) {
  fs.mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, label + '.png'), fullPage: true });
}

for (const width of [320, 375, 430, 768, 1024, 1366, 1440, 1920]) {
  test('Homepage booking-first layout ' + width + 'px', async ({ page }) => {
    const height = 1000;
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    const marketplace = page.getByRole('region', { name: 'Find and book a caregiver' });
    await expect(marketplace).toBeVisible();
    await expect(marketplace.getByRole('heading', { level: 1 })).toHaveText('Find and book a caregiver');
    await expect(marketplace.getByRole('search', { name: 'Find caregivers on Sewak' })).toBeVisible();
    await expect(marketplace.locator('.caregiver-preview-card')).toHaveCount(1);
    await expect(marketplace).toContainText('Test Caregiver');
    await expect(marketplace).toContainText('Accepting requests');
    await expect(marketplace.getByRole('button', { name: /Sign in to book/ })).toBeEnabled();
    const position = await page.evaluate(() => {
      const first = document.querySelector('#main-content').firstElementChild;
      const box = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
      return { first: first.id, card: box('.home-marketplace .caregiver-preview-card'), hero: box('.home-hero'), services: box('#services') };
    });
    expect(position.first).toBe('caregivers');
    expect(position.card.top).toBeLessThan(height);
    expect(position.card.top).toBeLessThan(position.hero.top);
    expect(position.hero.top).toBeLessThan(position.services.top);
    await expect(page.locator('.home-service')).toHaveCount(6);
    await noOverflow(page, width);
    await page.evaluate(axe.source);
    const violations = await page.evaluate(async () => (await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
    })).violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) })));
    expect(violations).toEqual([]);
    expect(errors).toEqual([]);
    await capture(page, 'caregiver-first-' + width);
  });
}

test('Homepage service cards open same-page caregivers with that service selected', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const services = page.locator('.home-service a');
  await expect(services.first()).toHaveAttribute('href', /^\/\?service=.+#caregivers$/);
  await services.first().click();
  await expect(page).toHaveURL(/\/\?service=.+#caregivers$/);
  await expect(page.getByRole('region', { name: 'Find and book a caregiver' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Service' })).not.toHaveValue('');
});

test('Homepage filters genuine profiles without visiting another search page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const queries = [];
  page.on('request', request => {
    if (request.url().endsWith('/api/query') && request.postDataJSON()?.path === 'publicCaregivers') queries.push(request.postDataJSON());
  });
  await page.goto('/');
  const marketplace = page.getByRole('region', { name: 'Find and book a caregiver' });
  await expect(marketplace).toContainText('Test Caregiver');
  await marketplace.getByRole('combobox', { name: 'Service' }).selectOption('e2e-care');
  await marketplace.getByRole('textbox', { name: 'City or locality' }).fill('Hetauda');
  await marketplace.getByRole('button', { name: 'More filters' }).click();
  await marketplace.getByRole('searchbox', { name: 'Caregiver name or keyword' }).fill('Test Caregiver');
  await marketplace.getByRole('combobox', { name: 'Support type' }).selectOption('caregiver');
  await marketplace.getByRole('button', { name: /Find caregivers/ }).click();
  await expect(marketplace).toContainText('Test Caregiver');
  expect(queries.some(query => query.search?.text === 'Test Caregiver'
    && query.search?.serviceId === 'e2e-care'
    && query.search?.location === 'Hetauda'
    && query.search?.category === 'caregiver')).toBe(true);
  await expect(page).toHaveURL(/\/$/);
});

test('Homepage booking action preserves selected caregiver through sign-in', async ({ page }) => {
  await page.goto('/');
  const marketplace = page.getByRole('region', { name: 'Find and book a caregiver' });
  await marketplace.getByRole('button', { name: /Sign in to book/ }).click();
  await expect(page).toHaveURL(/\/auth$/);
  expect(await page.evaluate(() => localStorage.getItem('pendingBookingCaregiverId'))).toBe('e2e-caregiver');
});

test('Homepage caregiver loading failure is retryable without imaginary profiles', async ({ page }) => {
  let failed = true;
  await page.route('**/api/query', async route => {
    if (route.request().postDataJSON()?.path !== 'publicCaregivers') return route.continue();
    return failed ? route.fulfill({ status: 503, json: { error: { code: 'unavailable' } } }) :
      route.fulfill({ json: { items: [], total: 0, nextCursor: null } });
  });
  await page.goto('/');
  const marketplace = page.getByRole('region', { name: 'Find and book a caregiver' });
  await expect(marketplace).toContainText('Caregiver profiles could not be loaded');
  failed = false;
  await marketplace.getByRole('button', { name: 'Try again' }).click();
  await expect(marketplace).toContainText('No caregivers are accepting requests right now');
});

test('Homepage catalog still expands and remains behind caregiver booking', async ({ page }) => {
  await page.goto('/');
  const services = page.locator('.home-service');
  await expect(services).toHaveCount(6);
  const toggle = page.locator('.home-services-toggle');
  await toggle.click();
  await expect(services).toHaveCount(16);
  await expect(toggle).toHaveText('Show fewer services');
  await toggle.click();
  await expect(services).toHaveCount(6);
});


test('At 1366×768, a new visitor sees caregiver, price, and booking action without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  const marketplace = page.getByRole('region', { name: 'Find and book a caregiver' });
  const card = marketplace.locator('.caregiver-preview-card');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Test Caregiver');
  await expect(card).toContainText('Accepting requests');
  await expect(card).toContainText('Verification not complete');
  await expect(card).toContainText('NPR ');
  const book = card.getByRole('button', { name: /Sign in to book/ });
  await expect(book).toBeVisible();
  const rect = await book.boundingBox();
  expect(rect).toBeTruthy();
  expect(rect.y + rect.height).toBeLessThan(768);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await capture(page, 'desktop-first-screen-1366x768');
});

test('On a 390px phone, essential care search and the booking action are reachable promptly', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/');
  const marketplace = page.getByRole('region', { name: 'Find and book a caregiver' });
  const card = marketplace.locator('.caregiver-preview-card');
  await expect(card).toHaveCount(1);
  await expect(marketplace.getByRole('combobox', { name: 'Service' })).toBeVisible();
  await expect(marketplace.getByRole('textbox', { name: 'City or locality' })).toBeVisible();
  await expect(marketplace.getByRole('button', { name: 'More filters' })).toBeVisible();
  const booking = card.getByRole('button', { name: /Sign in to book/ });
  await expect(booking).toBeVisible();
  const position = await booking.boundingBox();
  expect(position).toBeTruthy();
  expect(position.y + position.height).toBeLessThan(1000);
  await noOverflow(page, 390);
  await capture(page, 'mobile-first-screen-390x900');
});

test('Quick service chips filter real server-side results instantly', async ({ page }) => {
  const queries = [];
  page.on('request', request => {
    if (request.url().endsWith('/api/query') && request.postDataJSON()?.path === 'publicCaregivers') {
      queries.push(request.postDataJSON());
    }
  });
  await page.goto('/');
  const shortcuts = page.getByRole('group', { name: 'Quick service filters' });
  const first = shortcuts.locator('button').first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => queries.some(query => Boolean(query.search?.serviceId))).toBe(true);
  await first.click();
  await expect(first).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => queries.length).toBeGreaterThan(2);
});
