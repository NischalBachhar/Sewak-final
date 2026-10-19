const { test, expect } = require('./test.cjs');
const { seed } = require('./seed.cjs');
test.beforeAll(seed);

async function fits(page, width) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}
async function signIn(page, role) {
  await page.goto('/auth');
  await page.getByLabel('Email', { exact: true }).fill(`e2e-${role}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Local-test-only-123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/auth/);
}

for (const width of [320, 375, 430, 768, 1024, 1366, 1920]) {
  test(`Care market public, auth and organization pages at ${width}px`, async ({page}, info) => {
    await page.setViewportSize({width, height: 1000});
    await page.emulateMedia({reducedMotion:'reduce'});
    const errors=[]; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.getByRole('heading',{name:/Connecting families with/})).toBeVisible();
    await expect(page.locator('.sewak-cinematic-hero')).toBeVisible();
    await expect(page.locator('.sewak-hero-scene')).toHaveCount(3);
    await expect(page.locator('.sewak-service-link').first()).toBeVisible();
    await fits(page,width);
    await page.screenshot({path:info.outputPath(`home-${width}.png`),fullPage:true});
    await page.locator('#services').scrollIntoViewIfNeeded();
    await expect(page.getByRole('heading',{name:'Support for every kind of day'})).toBeVisible();
    await page.goto('/browse');
    await expect(page.getByRole('heading',{name:/Care that feels/})).toBeVisible();
    await fits(page,width);
    await page.screenshot({path:info.outputPath(`browse-${width}.png`),fullPage:true});
    await page.goto('/#how-it-works');
    await expect(page.getByRole('heading',{name:'How Sewak works'})).toBeVisible();
    for(const [route,name] of [['/auth','login'],['/auth?mode=register','signup']]) {
      await page.goto(route); await expect(page.locator('.auth-card')).toBeVisible(); await fits(page,width);
      await page.screenshot({path:info.outputPath(`${name}-${width}.png`),fullPage:true});
    }
    await signIn(page,'org');
    for(const tab of ['overview','bookings','caregivers','services','settings']) {
      await page.goto(`/organization?tab=${tab}`);
      await expect(page.locator('.org-workspace')).toBeVisible(); await fits(page,width);
      await page.screenshot({path:info.outputPath(`organization-${tab}-${width}.png`),fullPage:width<500||width>1300});
    }
    expect(errors).toEqual([]);
  });
}

test('Homepage service error, retry and empty catalog are truthful',async({page})=>{
  let mode='error';
  await page.route('**/api/query',async route=>{
    const data=route.request().postDataJSON();
    if(data.resource==='publicServices'||data.path==='publicServices') {
      if(mode==='error') return route.fulfill({status:503,json:{error:'unavailable'}});
      if(mode==='empty') return route.fulfill({status:200,json:{items:[],nextCursor:null}});
    }
    await route.continue();
  });
  await page.goto('/');
  await expect(page.locator('#services').getByRole('alert')).toContainText("We couldn't load the current service catalog");
  mode='ready'; await page.locator('#services').getByRole('button',{name:'Retry'}).click();
  await expect(page.locator('.sewak-service-link').first()).toBeVisible();
  mode='empty'; await page.reload();
  await expect(page.getByText('No services have been published yet.')).toBeVisible();
  await expect(page.locator('.sewak-service-link')).toHaveCount(0);
});

test('Homepage keyboard skip link and customer workspace use available width',async({page})=>{
  await page.setViewportSize({width:1920,height:1080});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Connecting families with quality, local caregivers'})).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link',{name:'Skip to content'})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main-content$/);
  await signIn(page,'customer'); await page.goto('/user/home');
  const dashboard=page.getByRole('main',{name:'Customer homepage'});
  await expect(dashboard).toBeVisible();
  const box=await dashboard.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(1200); expect(box.width).toBeLessThanOrEqual(1420);
  await fits(page,1920);
});
