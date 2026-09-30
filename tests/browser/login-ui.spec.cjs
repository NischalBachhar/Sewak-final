const { test, expect } = require('./test.cjs');
const { seed } = require('./seed.cjs');

test.beforeAll(seed);

for (const width of [360, 390, 768, 1024, 1440]) {
  test(`login presentation fits and remains usable at ${width}px`, async ({ page }, testInfo) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/auth');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.locator('.login-care-illustration')).toHaveJSProperty('complete', true);
    expect(await page.locator('.login-care-illustration').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const submitBox = await page.getByRole('button', { name: 'Sign in', exact: true }).boundingBox();
    expect(submitBox.y + submitBox.height).toBeLessThan(760);
    for (const label of ['Email', 'Password']) {
      const box = await page.getByLabel(label, { exact: true }).boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    // Stop decorative motion for a deterministic review artifact.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.screenshot({ path: testInfo.outputPath(`login-${width}.png`), fullPage: true });
    expect(await page.locator('.login-care-illustration').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await expect(page.getByRole('status')).toContainText('Contact your Sewak administrator');
    await page.getByRole('button', { name: 'Create an account' }).click();
    await expect(page.getByLabel('Full name')).toBeVisible();
    await expect(page.locator('.auth-shell--login')).toHaveCount(0);
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('minlength', '12');
    expect(errors).toEqual([]);
  });
}

for (const [role, destination] of [['customer', /\/user/], ['org', /\/organization/]]) {
  test(`login keyboard submission and password visibility preserve ${role} authentication`, async ({ page }) => {
    await page.goto('/auth');
    const email = page.getByLabel('Email', { exact: true });
    const password = page.getByLabel('Password', { exact: true });
    await email.fill(`e2e-${role}@example.test`);
    await expect(email).toHaveAttribute('autocomplete', 'email');
    await page.keyboard.press('Tab');
    await expect(password).toBeFocused();
    await password.fill('Local-test-only-123!');
    await expect(password).toHaveAttribute('autocomplete', 'current-password');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Show password' })).toBeFocused();
    await page.keyboard.press('Space');
    await expect(password).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Hide password' }).click();
    await expect(password).toHaveAttribute('type', 'password');
    await expect(password).toHaveValue('Local-test-only-123!');
    await password.press('Enter');
    await expect(page).toHaveURL(destination);
  });
}
