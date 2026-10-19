const { test, expect } = require('./test.cjs');
const { seed } = require('./seed.cjs');
const axe = require('axe-core');
const fs = require('node:fs');
const path = require('node:path');

test.beforeAll(seed);
const directory = path.resolve('docs/design/reference-marketplace');
async function noOverflow(page, width) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}
async function capture(page, label) {
  fs.mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, label + '.png'), fullPage: true });
}

for (const width of [320, 375, 430, 768, 1024, 1366, 1440, 1920]) {
  test('Homepage reference-video marketplace accessibility ' + width + 'px', async ({ page }) => {
    const height = 1000;
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('.sewak-cinematic-hero')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: /Connecting families with/ })).toBeVisible();
    await expect(page.getByRole('search', { name: 'Start finding care' })).toBeVisible();
    const marketplace = page.getByRole('region', { name: 'Caregivers accepting requests' });
    await expect(marketplace).toBeVisible();
    await expect(marketplace.getByRole('search', { name: 'Find caregivers on Sewak' })).toBeVisible();
    await expect(marketplace.locator('.caregiver-preview-card')).toHaveCount(1);
    await expect(marketplace).toContainText('Test Caregiver');
    await expect(marketplace).toContainText('Accepting requests');
    await expect(marketplace.getByRole('button', { name: /Sign in to book/ })).toBeEnabled();
    const position = await page.evaluate(() => {
      const first = document.querySelector('#main-content').firstElementChild;
      const box = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
      return { first: first.className, search: box('.sewak-hero-search'), card: box('.home-marketplace .caregiver-preview-card'), hero: box('.sewak-cinematic-hero'), categories: box('.sewak-category-area'), services: box('#services') };
    });
    expect(position.first).toContain('sewak-cinematic-hero');
    expect(position.search.top).toBeLessThan(height);
    expect(position.hero.top).toBeLessThan(position.categories.top);
    expect(position.categories.top).toBeLessThan(position.card.top);
    expect(position.card.top).toBeLessThan(position.services.top);
    await expect(page.locator('.sewak-category-card')).toHaveCount(6);
    await noOverflow(page, width);
    await page.evaluate(axe.source);
    const violations = await page.evaluate(async () => (await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
    })).violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) })));
    expect(violations).toEqual([]);
    expect(errors).toEqual([]);
    await capture(page, 'care-marketplace-' + width);
  });
}

test('Homepage service cards open same-page caregivers with that service selected', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const services = page.locator('.sewak-service-link');
  await expect(services.first()).toHaveAttribute('href', /^\/\?service=.+#caregivers$/);
  await services.first().click();
  await expect(page).toHaveURL(/\/\?service=.+#caregivers$/);
  await expect(page.getByRole('region', { name: 'Caregivers accepting requests' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Service' })).not.toHaveValue('');
});

test('Homepage filters genuine profiles without visiting another search page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const queries = [];
  page.on('request', request => {
    if (request.url().endsWith('/api/query') && request.postDataJSON()?.path === 'publicCaregivers') queries.push(request.postDataJSON());
  });
  await page.goto('/');
  const marketplace = page.getByRole('region', { name: 'Caregivers accepting requests' });
  await expect(marketplace).toContainText('Test Caregiver');
  await marketplace.getByRole('searchbox', { name: 'Caregiver or area' }).fill('Test Caregiver');
  await marketplace.getByRole('combobox', { name: 'Service' }).selectOption('e2e-care');
  await marketplace.getByRole('button', { name: 'More filters' }).click();
  await marketplace.getByRole('textbox', { name: 'City or locality' }).fill('Hetauda');
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
  const marketplace = page.getByRole('region', { name: 'Caregivers accepting requests' });
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
  const marketplace = page.getByRole('region', { name: 'Caregivers accepting requests' });
  await expect(marketplace).toContainText('Caregiver profiles could not be loaded');
  failed = false;
  await marketplace.getByRole('button', { name: 'Try again' }).click();
  await expect(marketplace).toContainText('No caregivers are accepting requests right now');
});

test('Homepage catalog still expands and remains behind caregiver booking', async ({ page }) => {
  await page.goto('/');
  const services = page.locator('.sewak-service-link');
  await expect(services).toHaveCount(8);
  const toggle = page.locator('.sewak-service-more');
  await toggle.click();
  await expect(services).toHaveCount(16);
  await expect(toggle).toContainText('Show fewer services');
  await toggle.click();
  await expect(services).toHaveCount(8);
});
