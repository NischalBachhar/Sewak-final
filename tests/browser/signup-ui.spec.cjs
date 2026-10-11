const { test, expect } = require('./test.cjs');
const { db } = require('./seed.cjs');

async function account(page, email = 'step.layout@gmail.com') {
  await page.getByLabel('Full name').fill('Synthetic Signup');
  await page.getByLabel('Email', {exact:true}).fill(email);
  await page.getByLabel('Password', {exact:true}).fill('Local-test-only-123!');await page.getByLabel('Confirm password',{exact:true}).fill('Local-test-only-123!');
}
async function organization(page) {
  await page.getByLabel('Organization/Company Name').fill('Synthetic Care Organization');
  await page.getByRole('combobox',{name:'Organization Type *',exact:true}).selectOption('Caregiver Agency');
  await page.getByLabel('Phone Number *').fill('9800000000');
  await page.getByRole('combobox',{name:'City *',exact:true}).selectOption('Other');
  await page.getByLabel('Enter your city *').fill('Hetauda');
  await page.getByLabel('Address *',{exact:true}).fill('Synthetic Road 12');
}

test('signup branding remains stable on a shorter desktop viewport',async({page})=>{
  await page.setViewportSize({width:1440,height:800});await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/auth?mode=register');await account(page);
  const brand=await page.locator('.signup-brand').boundingBox();
  await page.getByRole('radio',{name:/Organization\/Company/}).check();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  expect((await page.locator('.signup-brand').boundingBox()).y).toBeCloseTo(brand.y,0);
  await organization(page);await page.getByRole('button',{name:'Continue',exact:true}).click();
  expect((await page.locator('.signup-brand').boundingBox()).y).toBeCloseTo(brand.y,0);
});

for (const width of [320, 360, 375, 390, 414, 430, 768, 1024, 1440]) {
  test(`signup fits both roles and respects reduced motion at ${width}px`, async ({ page }, testInfo) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/auth?mode=register');
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const brand = await page.locator('.signup-brand').boundingBox();
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
    await expect(page.getByLabel('Organization/Company Name')).not.toBeVisible();
    const progressLabels = await page.locator('.signup-progress li > span:last-child').evaluateAll(labels => labels.map(label => { const rect=label.getBoundingClientRect();return {left:rect.left,right:rect.right}; }));
    expect(progressLabels[0].right).toBeLessThanOrEqual(progressLabels[1].left);
    expect(progressLabels[1].right).toBeLessThanOrEqual(progressLabels[2].left);
    if(width>760)expect((await page.locator('.signup-brand').boundingBox()).y).toBeCloseTo(brand.y,0);
    else await expect(page.locator('.signup-scene')).not.toBeVisible();
    await account(page);
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Organization details',exact:true})).toBeFocused();
    await expect(page.getByLabel('Organization/Company Name')).toBeVisible();
    if(width>760)expect((await page.locator('.signup-brand').boundingBox()).y).toBeCloseTo(brand.y,0);
    await organization(page);
    await page.getByLabel('Registration Number (optional)').fill('QA-123');
    await page.getByLabel('PAN/VAT (optional)').fill('QA-456');
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Services and confirmation',exact:true})).toBeFocused();
    await page.getByLabel('Elderly Care',{exact:true}).check();
    await expect(page.getByText('1 selected',{exact:true}).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if(width>760){
      const beforeScroll=await page.locator('.signup-brand').boundingBox();
      expect(beforeScroll.y).toBeCloseTo(brand.y,0);
      await page.evaluate(()=>window.scrollBy(0,200));
      expect((await page.locator('.signup-brand').boundingBox()).y).toBeCloseTo(brand.y,0);
    }
    await page.screenshot({ path: testInfo.outputPath(`signup-organization-${width}.png`), fullPage: true });
    await page.getByRole('button',{name:'Back',exact:true}).click();
    await expect(page.getByLabel('Organization/Company Name')).toHaveValue('Synthetic Care Organization');
    await expect(page.getByLabel('Enter your city *')).toHaveValue('Hetauda');
    await page.getByRole('button',{name:'Back',exact:true}).click();
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
  await page.keyboard.type('signup-keyboard@gmail.com');
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
  await expect(password).toHaveAttribute('minlength', '8');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Confirm password',{exact:true})).toBeFocused();
  await page.keyboard.type('short');await page.keyboard.press('Tab');
  await expect(page.getByRole('radio', { name: /Customer/ })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio', { name: /Organization\/Company/ })).toBeChecked();
  expect(await page.locator('.signup-role--selected').evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:'Continue',exact:true})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(password).toBeFocused();
  expect(await password.evaluate(el => el.validity.tooShort)).toBe(true);
  await expect(password).toHaveAttribute('aria-invalid','true');
  await expect(page.getByText('Use a password containing 8 to 128 characters.')).toBeVisible();
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
    const email = `signup.${role}.${Date.now()}@gmail.com`;
    await page.getByLabel('Full name').fill('Synthetic Signup');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill('Local-test-only-123!');await page.getByLabel('Confirm password',{exact:true}).fill('Local-test-only-123!');
    await page.getByRole('radio', { name }).check();
    if (role === 'orgadmin') {
      await page.getByRole('button',{name:'Continue',exact:true}).click();
      await page.getByLabel('Organization/Company Name').fill('Synthetic Care Organization');
      await page.getByRole('combobox',{name:'Organization Type *',exact:true}).selectOption('Caregiver Agency');
      await page.getByLabel('Phone Number *').fill('9800000000');
      await page.getByRole('combobox',{name:'City *',exact:true}).selectOption('Other');
      await expect(page.getByLabel('Enter your city *')).toBeVisible();
      await page.getByLabel('Enter your city *').fill('Hetauda');
      await page.getByLabel('Address *',{exact:true}).fill('Synthetic Road 12');
      await page.getByRole('button',{name:'Continue',exact:true}).click();
      await page.getByLabel('Elderly Care',{exact:true}).check();
    }
    const completed = page.waitForResponse(response => response.url().endsWith('/api/auth/register'));
    await page.getByRole('button', { name: role === 'orgadmin' ? 'Submit application' : 'Sign up', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Creating account...' })).toBeDisabled();
    // A repeated activation of the disabled control must not start another registration.
    await page.getByRole('button', { name: 'Creating account...' }).evaluate(button => button.click());
    await expect.poll(() => calls.length).toBe(1);
    releaseRegistration();
    const response = await completed;
    expect(response.status()).toBe(200);
    await expect(page.getByRole('heading',{name:'Verify your Gmail'})).toBeVisible();
    const emailBody=await require('./d1-fixtures.cjs').mail(email);const token=new URLSearchParams(emailBody.text.match(/https:\/\/\S+/)[0].split('#')[1]).get('token');
    const verify=await page.request.post('/api/auth/verify-email',{data:{token}});expect(verify.status()).toBe(200);await page.getByRole('button',{name:'Check verification status'}).click();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ email, password: 'Local-test-only-123!', name: 'Synthetic Signup', selectedRole:role });
    await expect(page).toHaveURL(role === 'orgadmin' ? /\/organization\/profile/ : /\/user\/profile/);
    const users = (await db.collection('users').get()).docs;
    const user = users.find(doc => doc.data().email === email);
    expect(user.data().role).toBe(role);
    if (role === 'orgadmin') {
      expect((await db.doc(`organizationApplications/${user.id}`).get()).data().status).toBe('pending');
      expect((await db.doc(`organizations/${user.id}`).get()).data()).toMatchObject({ adminUid:user.id, businessCity:'Hetauda', servicesOffered:['catalog_elderly_care'], isApproved:false });
      await page.reload(); await expect(page.getByText('Pending Verification',{exact:true})).toBeVisible();
      await expect(page.getByRole('combobox',{name:'City *',exact:true})).toHaveValue('Hetauda');
    }
    expect(errors).toEqual([]);
  });
}

test('signup retains validation errors and associates them with the form', async ({ page }) => {
  await page.goto('/auth?mode=register');
  await page.getByLabel('Full name').fill('X');
  await page.getByLabel('Email', { exact: true }).fill('validation@gmail.com');
  await page.getByLabel('Password', { exact: true }).fill('Local-test-only-123!');await page.getByLabel('Confirm password',{exact:true}).fill('Local-test-only-123!');
  await page.getByRole('button', { name: 'Sign up', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Check the highlighted fields to continue.');
  await expect(page.getByText('Enter your full name.',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Full name')).toHaveAttribute('aria-describedby', 'signup-fullName-error');
  await expect(page.getByRole('button', { name: 'Sign up', exact: true })).toBeEnabled();
  await page.getByLabel('Full name').fill('Synthetic Applicant');
  await page.getByRole('radio', { name: /Organization\/Company/ }).check();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByLabel('Organization/Company Name').fill('X');
  await page.getByRole('combobox',{name:'Organization Type *',exact:true}).selectOption('Caregiver Agency');
  await page.getByLabel('Phone Number *').fill('9800000000');
  await page.getByRole('combobox',{name:'City *',exact:true}).selectOption('Hetauda');
  await page.getByLabel('Address *',{exact:true}).fill('Test street 12');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('Enter your organization name.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('Local-test-only-123!');
});

test('organization steps validate locally and retain city, services and account edits',async({page})=>{
  const registrations=[];page.on('request',request=>{if(request.url().endsWith('/api/auth/register'))registrations.push(request);});
  await page.goto('/auth?mode=register');await account(page);
  await page.getByRole('radio',{name:/Organization\/Company/}).check();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await organization(page);
  await page.getByLabel('Enter your city *').fill('');
  await page.getByLabel('Phone Number *').fill('123');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByLabel('Phone Number *')).toHaveAttribute('aria-invalid','true');
  await expect(page.getByLabel('Enter your city *')).toHaveAttribute('aria-invalid','true');
  await expect(page.getByRole('heading',{name:'Organization details',exact:true})).toBeVisible();
  await page.getByLabel('Phone Number *').fill('9800000000');await page.getByLabel('Enter your city *').fill('Tansen Town');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('searchbox',{name:'Search services'}).fill('elderly');
  await page.getByRole('searchbox',{name:'Search services'}).press('Enter');
  expect(registrations).toHaveLength(0);
  await page.getByLabel('Elderly Care',{exact:true}).check();
  await expect(page.getByLabel('Housekeeping',{exact:true})).toHaveCount(0);
  await page.getByRole('searchbox',{name:'Search services'}).fill('');
  await page.getByRole('combobox',{name:'Service category',exact:true}).selectOption('household');
  await page.getByLabel('Housekeeping',{exact:true}).check();
  await expect(page.getByText('2 selected',{exact:true}).first()).toBeVisible();
  await expect(page.locator('.signup-review')).toContainText('Tansen Town');
  await page.getByRole('button',{name:'Edit account',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Account information',exact:true})).toBeFocused();
  await expect(page.getByLabel('Password',{exact:true})).toHaveValue('Local-test-only-123!');
  await page.getByRole('radio',{name:/Customer/}).check();await expect(page.getByRole('button',{name:'Sign up',exact:true})).toBeVisible();
  await page.getByRole('radio',{name:/Organization\/Company/}).check();await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByLabel('Enter your city *')).toHaveValue('Tansen Town');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByLabel('Elderly Care',{exact:true})).toBeChecked();await expect(page.getByLabel('Housekeeping',{exact:true})).toBeChecked();
  await page.getByRole('button',{name:'Remove Elderly Care',exact:true}).click();await expect(page.getByText('1 selected',{exact:true}).first()).toBeVisible();
  expect(registrations).toHaveLength(0);
});
