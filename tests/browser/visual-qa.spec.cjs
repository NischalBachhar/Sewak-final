const { test, expect } = require('./test.cjs');
const { seed } = require('./seed.cjs');

// The QA accounts and D1 data exist only in the loopback fixture server.
// Never use real accounts, public origins or production data for screenshot runs.
test.beforeAll(seed);

async function signIn(page, role) {
  await page.goto('/auth');
  await page.getByLabel('Email', { exact: true }).fill('e2e-' + role + '@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Local-test-only-123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/auth/);
}

async function assertUsableViewport(page, width, description) {
  const geometry = await page.evaluate(() => {
    const root = document.documentElement;
    const nodes = [...document.querySelectorAll('body *')].filter(el =>
      el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    const outside = nodes.filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.right > window.innerWidth + 3 && getComputedStyle(el).position !== 'fixed';
    }).slice(0, 5).map(el => ({ tag: el.tagName, className: String(el.className).slice(0,100), right: Math.ceil(el.getBoundingClientRect().right) }));
    return { viewport: window.innerWidth, documentWidth: root.scrollWidth, documentHeight: root.scrollHeight, outside };
  });
  expect(geometry.documentWidth, description + ': ' + JSON.stringify(geometry)).toBeLessThanOrEqual(width + 3);
}

const ROLE_ROUTES = {
  customer: [
    ['overview', '/user/home', '.customer-home'],
    ['find-care', '/user', '.browse-list'],
    ['my-bookings', '/user/mybookings', '.customer-bookings'],
    ['profile', '/user/profile', '.customer-detail-shell'],
    ['caregiver-details', '/user/caregivers/e2e-caregiver', '.customer-detail-shell'],
    ['booking-request', '/user/book/e2e-caregiver', '.customer-detail-shell'],
  ],
  caregiver: [
    ['overview', '/caregiver?tab=home', '.sewak-workspace--caregiver'],
    ['jobs', '/caregiver?tab=jobs', '.sewak-workspace--caregiver'],
    ['schedule', '/caregiver?tab=schedule', '.sewak-workspace--caregiver'],
    ['earnings', '/caregiver?tab=earnings', '.sewak-workspace--caregiver'],
    ['profile', '/caregiver?tab=profile', '.sewak-workspace--caregiver'],
  ],
  admin: [
    ['overview', '/superadmin/overview', '.sewak-workspace--admin'],
    ['caregivers', '/superadmin/caregivers', '.sewak-workspace--admin'],
    ['bookings', '/superadmin/bookings', '.sewak-workspace--admin'],
    ['organizations', '/superadmin/organizations', '.sewak-workspace--admin'],
    ['safety-reports', '/superadmin/blacklist', '.sewak-workspace--admin'],
    ['analytics', '/superadmin/analytics', '.sewak-workspace--admin'],
    ['administrators', '/superadmin/admins', '.sewak-workspace--admin'],
  ],
};

for (const width of [320, 390, 768, 1024, 1440]) {
  for (const role of ['customer', 'caregiver', 'admin']) {
    test('Visual QA: authenticated ' + role + ' routes at ' + width + 'px', async ({ browser }, testInfo) => {
      const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [], failedRequests = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.status() >= 500) failedRequests.push(r.status() + ' ' + new URL(r.url()).pathname); });
      try {
        await signIn(page, role);
        for (const [label, route, selector] of ROLE_ROUTES[role]) {
          await page.goto(route);
          await expect(page.locator(selector).first(), role + '/' + label).toBeVisible({ timeout: 25000 });
          await assertUsableViewport(page, width, role + '/' + label);
          // Screenshots are recorded even when no seeded bookings exist.
          await page.screenshot({
            path: testInfo.outputPath(role + '-' + width + '-' + label + '.png'),
            fullPage: width === 390 || width === 1440,
            animations: 'disabled',
          });
          if (role !== 'customer') {
            const nav = page.getByRole('navigation', { name: role === 'admin' ? 'Administration sections' : 'Caregiver sections' });
            await expect(nav).toBeVisible();
          }
          if (role === 'customer' && label === 'my-bookings') {
            const filters = page.getByRole('navigation', { name: 'Booking status filters' });
            await expect(filters).toBeVisible();
            await filters.getByRole('button', { name: /^Pending/ }).click();
            await expect(filters.getByRole('button', { name: /^Pending/ })).toHaveAttribute('aria-pressed', 'true');
          }
          if (role === 'caregiver' && label === 'jobs') {
            await expect(page.locator('.sewak-jobs-heading [role="status"]')).toHaveText(/^\d+ requests? shown$/);
            const filters = page.getByRole('navigation', { name: 'Job status filters' });
            await filters.getByRole('button', { name: /^All\b/ }).click();
            await expect(filters.getByRole('button', { name: /^All\b/ })).toHaveAttribute('aria-pressed', 'true');
          }
          if (role === 'admin' && label === 'bookings') {
            await expect(page.locator('.sewak-admin-booking__head').first()).toBeVisible();
          }
          if (role === 'caregiver' && label === 'schedule') {
            const next = page.getByRole('button', { name: 'Next week' });
            await expect(next).toBeVisible();
            await next.click();
            await expect(page.getByRole('button', { name: 'This week' })).toBeVisible();
          }
        }
        expect(errors, 'Uncaught browser errors for ' + role + ' at ' + width).toEqual([]);
        expect(failedRequests, 'Unexpected server errors for ' + role + ' at ' + width).toEqual([]);
      } finally { await context.close(); }
    });
  }
}

test('Visual QA: iPhone-size touch navigation across customer, caregiver and superadmin', async ({ browser }, testInfo) => {
  for (const [role, destination, name] of [
    ['customer', '/user/home', 'Customer navigation'],
    ['caregiver', '/caregiver?tab=home', 'Caregiver sections'],
    ['admin', '/superadmin/overview', 'Administration sections'],
  ]) {
    const context = await browser.newContext({
      viewport: { width: 393, height: 852 },
      isMobile: true, hasTouch: true, deviceScaleFactor: 3,
      reducedMotion: 'reduce',
    });
    try {
      const page = await context.newPage();
      await signIn(page, role);
      await page.goto(destination);
      await expect(page.getByRole('navigation', { name })).toBeVisible();
      await assertUsableViewport(page, 393, role + '/iPhone touch');
      await page.screenshot({ path: testInfo.outputPath(role + '-iphone-touch.png'), fullPage: true, animations: 'disabled' });
    } finally { await context.close(); }
  }
});
