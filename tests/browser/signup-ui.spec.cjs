const { test, expect } = require('./test.cjs');
const { db } = require('./seed.cjs');

for (const width of [320, 360, 375, 390, 414, 430, 768, 1024, 1440]) {
  test(`signup fits both roles and respects reduced motion at ${width}px`, async ({ page }, testInfo) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/auth?mode=register');
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const name of [/Customer/, /Organization\/Company/]) {
      await page.getByRole('radio', { name }).check();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      for (const label of ['Full name', 'Email', 'Password']) {
        const box = await page.getByLabel(label, { exact: true }).boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(50);
        expect(box.x).toBeGreaterThanOrEqual(16);
        expect(box.x + box.width).toBeLessThanOrEqual(width - 16);
      }
    }
    await expect(page.getByLabel('Organization/Company Name')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`signup-organization-${width}.png`), fullPage: true });
    await page.getByRole('radio', { name: /Customer/ }).check();
    await page.screenshot({ path: testInfo.outputPath(`signup-${width}.png`), fullPage: true });
    for (const selector of ['.signup-caregiver', '.signup-family', '.signup-heart', '.signup-verified']) {
      expect(await page.locator(selector).evaluate(el => getComputedStyle(el).animationName)).toBe('none');
    }
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.locator('.auth-shell--signup')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('signup keyboard navigation, password visibility and native validation', async ({ page }) => {
  await page.goto('/auth?mode=register');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Full name')).toBeFocused();
  await page.keyboard.type('Synthetic Customer');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Email', { exact: true })).toBeFocused();
  await page.keyboard.type('signup-keyboard@example.test');
  await page.keyboard.press('Tab');
  const password = page.getByLabel('Password', { exact: true });
  await expect(password).toBeFocused();
  await page.keyboard.type('short');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Show password' })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue('short');
  await page.keyboard.press('Space');
  await expect(password).toHaveAttribute('type', 'password');
  await expect(password).toHaveAttribute('autocomplete', 'new-password');
  await expect(password).toHaveAttribute('minlength', '12');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('radio', { name: /Customer/ })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio', { name: /Organization\/Company/ })).toBeChecked();
  expect(await page.locator('.signup-role--selected').evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Organization/Company Name')).toBeFocused();
  await page.keyboard.type('Synthetic Organization');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Sign up', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(password).toBeFocused();
  expect(await password.evaluate(el => el.validity.tooShort)).toBe(true);
  await expect(page).toHaveURL(/\/auth/);
});

for (const [role, name] of [['user', /Customer/], ['orgadmin', /Organization\/Company/]]) {
  test(`signup preserves real local D1 ${role} registration, payload, loading and redirect`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const calls = [];
    let releaseRegistration;
    const gate = new Promise(resolve => { releaseRegistration = resolve; });
    await page.route('**/api/auth/register', async route => {
      calls.push(route.request().postDataJSON());
      await gate;
      await route.continue();
    });
    await page.goto('/auth?mode=register');
    const email = `signup-${role}-${Date.now()}@example.test`;
    await page.getByLabel('Full name').fill('Synthetic Signup');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill('Local-test-only-123!');
    await page.getByRole('radio', { name }).check();
    if (role === 'orgadmin') await page.getByLabel('Organization/Company Name').fill('Synthetic Care Organization');
    const completed = page.waitForResponse(response => response.url().endsWith('/api/auth/complete-registration'));
    await page.getByRole('button', { name: 'Sign up', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Creating account...' })).toBeDisabled();
    // A repeated activation of the disabled control must not start another registration.
    await page.getByRole('button', { name: 'Creating account...' }).evaluate(button => button.click());
    await expect.poll(() => calls.length).toBe(1);
    releaseRegistration();
    const response = await completed;
    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON()).toEqual({ name: 'Synthetic Signup', selectedRole: role, organizationName: role === 'orgadmin' ? 'Synthetic Care Organization' : '' });
    expect(calls).toEqual([{ email, password: 'Local-test-only-123!', name: 'Synthetic Signup' }]);
    await expect(page).toHaveURL(/\/user\/profile/);
    const users = (await db.collection('users').get()).docs;
    const user = users.find(doc => doc.data().email === email);
    expect(user.data().role).toBe('user');
    if (role === 'orgadmin') expect((await db.doc(`organizationApplications/${user.id}`).get()).data().status).toBe('pending');
    expect(errors).toEqual([]);
  });
}

test('signup retains validation errors and associates them with the form', async ({ page }) => {
  await page.goto('/auth?mode=register');
  await page.getByLabel('Full name').fill('X');
  await page.getByLabel('Email', { exact: true }).fill('validation@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Local-test-only-123!');
  await page.getByRole('button', { name: 'Sign up', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Enter your full name.');
  await expect(page.getByLabel('Full name')).toHaveAttribute('aria-describedby', 'auth-error');
  await expect(page.getByRole('button', { name: 'Sign up', exact: true })).toBeEnabled();
  await page.getByLabel('Full name').fill('Synthetic Applicant');
  await page.getByRole('radio', { name: /Organization\/Company/ }).check();
  await page.getByLabel('Organization/Company Name').fill('X');
  await page.getByRole('button', { name: 'Sign up', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Enter your organization name.');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('Local-test-only-123!');
});
