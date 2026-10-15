import assert from 'node:assert/strict';

export async function verifyVerificationViews(browser, {origin, worker, accounts}) {
  for (const {role, email, password} of accounts) {
    const context = await browser.newContext();
    context.setDefaultTimeout(45000);
    context.setDefaultNavigationTimeout(45000);
    try {
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.name));
      await page.goto(origin + '/auth');
      await page.getByLabel('Email', {exact:true}).fill(email);
      await page.getByLabel('Password', {exact:true}).fill(password);
      await page.getByRole('button', {name:'Sign in', exact:true}).click();
      await page.waitForURL(url => url.pathname !== '/auth');
      const caregiver = role === 'caregiver';
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({width, height:900});
        const loaded = page.waitForResponse(response => new URL(response.url()).pathname === (caregiver ? '/api/verification/me' : '/api/verification/queue') && response.request().method() === 'GET');
        await page.goto(origin + (caregiver ? '/caregiver?tab=verification' : '/superadmin/verification'));
        assert.equal((await loaded).status(), 200, 'Verification data must load successfully');
        await page.getByRole('heading', {name:caregiver ? 'My Verification' : 'Verification Management', exact:true}).waitFor();
        await page.getByRole('status').filter({hasText:caregiver ? 'Loading your verification' : 'Loading requests'}).waitFor({state:'hidden'});
        if (caregiver) {
          await page.locator('.verification-card').nth(4).waitFor();
          assert.equal(await page.locator('.verification-card').count(), 5);
        } else await page.locator('.verification-queue').waitFor();
        assert.equal(await page.locator('.verification-workspace [role="alert"]').count(), 0);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
        await page.screenshot({path:`.local-tools/verification-live-${worker}-${role}-${width}.png`, fullPage:true});
      }
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return {roles:accounts.length, widths:[320,390,1440], pageErrors:0, dataLoaded:true};
}
