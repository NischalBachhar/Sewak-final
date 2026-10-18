const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const axe = require('axe-core');
// Reuse Playwright's bundled PNG decoder for exact hero pixel comparisons.
const { PNG } = require(path.resolve('node_modules/playwright-core/lib/utilsBundle.js'));
const phase = process.env.SEWAK_HOME_PHASE || 'after';
const output = path.resolve('docs/design/homepage-refinement', phase);
const catalog = [
  ['child_care_babysitting', 'Child Care / Babysitting'],
  ['cooking_meal_preparation', 'Cooking / Meal Preparation', 'household'],
  ['daily_living_assistance', 'Daily Living Assistance'],
  ['disability_support', 'Disability Support'],
  ['elderly_care', 'Elderly Care'],
  ['elderly_companionship', 'Elderly Companionship'],
  ['house_cleaning', 'House Cleaning', 'household'],
  ['housekeeping', 'Housekeeping', 'household'],
  ['laundry_ironing', 'Laundry / Ironing', 'household'],
  ['mobility_assistance', 'Mobility Assistance'],
  ['newborn_care_nonmedical', 'Newborn Care (nonmedical)'],
  ['patient_care_attendant_support', 'Patient Care Attendant Support'],
  ['personal_care_assistance', 'Personal Care Assistance'],
  ['post_hospital_assistance_nonmedical', 'Post Hospital Assistance (nonmedical)'],
  ['live_in_household_help', 'Live-in Household Help', 'household'],
  ['general_household_assistance', 'General Household Assistance', 'household'],
  ['future_household', 'Future Household Service', 'vendor'],
  ['future_care', 'Future Care Service'],
].map(([id, label, category = 'caregiver']) => ({ id: `catalog_${id}`, data: { label, category, isActive: true } }));

async function mockCatalog(page, mode = () => 'ready') {
  await page.route('**/api/query', async route => {
    const request = route.request().postDataJSON();
    if ((request.path || request.resource) !== 'publicServices') return route.continue();
    if (mode() === 'loading') return; // Kept pending until the page closes.
    if (mode() === 'error') return route.fulfill({status:503,json:{error:{code:'unavailable',message:'Unavailable'}}});
    return route.fulfill({json:{items:mode() === 'empty' ? [] : catalog,nextCursor:null}});
  });
}

for (const width of [320,375,430,768,1024,1366,1440,1920]) {
  test(`Homepage refinement layout ${width}px`, async ({page,browser}) => {
    const rendering={platform:process.platform,browserVersion:browser.version()};
    fs.mkdirSync(output,{recursive:true});
    await page.setViewportSize({width,height:1000});
    await page.emulateMedia({reducedMotion:'reduce'});
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    await mockCatalog(page);
    await page.goto('/');
    await expect(page.locator('.home-service')).toHaveCount(6);
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode()));});
    const measure = () => page.evaluate(()=>({document:document.documentElement.scrollHeight,belowHero:document.documentElement.scrollHeight-document.querySelector('.home-values').getBoundingClientRect().top-window.scrollY,hero:document.querySelector('.home-hero').getBoundingClientRect().toJSON(),joinHeight:document.querySelector('.home-join').getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth}));
    const collapsed=await measure(); expect(collapsed.overflow).toBe(false);
    const hero=await page.locator('.home-hero').screenshot();
    const heroSHA256=crypto.createHash('sha256').update(hero).digest('hex');
    const screenshot = await page.screenshot({path:path.join(output,`home-${width}.png`),fullPage:true});
    if (phase==='after') {
      const before=JSON.parse(fs.readFileSync(path.resolve('docs/design/homepage-refinement/before',`height-${width}.json`)));
      // Pixel/height comparisons require the same platform fonts and Chrome
      // version as the captured baseline. Linux CI still checks all behavior,
      // responsive columns, overflow, touch targets and accessibility below.
      if(before.rendering?.platform===rendering.platform && before.rendering?.browserVersion===rendering.browserVersion) {
      const baseline = PNG.sync.read(fs.readFileSync(path.resolve('docs/design/homepage-refinement/before',`home-${width}.png`)));
      const current = PNG.sync.read(screenshot);
      const box=collapsed.hero;
      let changedPixels=0;
      for(let y=Math.ceil(box.top);y<Math.floor(box.bottom);y++) {
        const start=(y*width+box.left)*4,end=(y*width+box.right)*4;
        for(let i=start;i<end;i+=4) if(!current.data.subarray(i,i+4).equals(baseline.data.subarray(i,i+4))) changedPixels++;
      }
      // Allow at most 0.01% corner rasterization differences in Chromium.
      expect(changedPixels/(box.width*Math.floor(box.height))).toBeLessThanOrEqual(.0001);
      expect(collapsed.hero).toEqual(before.collapsed.hero);
      if(width>=1024) {
        const reduction=(before.collapsed.belowHero-collapsed.belowHero)/before.collapsed.belowHero;
        expect(reduction).toBeGreaterThanOrEqual(.15);expect(reduction).toBeLessThanOrEqual(.20);
      }
      }
      await expect(page.locator('.home-join').getByRole('link',{name:'Find Care for My Family'})).toHaveAttribute('href','/browse');
      await expect(page.locator('.home-join').getByRole('link',{name:'Register My Organization'})).toHaveAttribute('href','/auth?mode=register');
      await page.evaluate(axe.source);
      const accessibility=await page.evaluate(async()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));
      expect(accessibility.violations.map(({id,nodes})=>({id,targets:nodes.map(node=>node.target)}))).toEqual([]);
      const columns=await page.locator('.home-services').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
      expect(columns).toBe(width<=480?1:width<=900?2:3);
    }
    const toggle=page.getByRole('button',{name:`View all ${catalog.length} services`});
    await toggle.click(); await expect(page.getByRole('button',{name:'Show fewer services'})).toHaveAttribute('aria-expanded','true');
    await expect(page.locator('.home-service')).toHaveCount(catalog.length);
    const expanded=await measure();expect(expanded.overflow).toBe(false);
    for(const link of await page.locator('.home-service a').all()) {await expect(link).toHaveAttribute('href','/browse');const box=await link.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);}
    if(phase==='after') {
      const icons=await page.locator('.home-service .home-icon svg').evaluateAll(els=>els.map(el=>el.innerHTML));
      expect(new Set(icons.slice(0,8)).size).toBe(8);
      await expect(page.locator('.home-service').nth(16)).toContainText('Household support');
      await expect(page.locator('.home-service').nth(17)).toContainText('Caregiver support');
    }
    await page.getByRole('button',{name:'Show fewer services'}).click();
    await expect(page.locator('.home-service')).toHaveCount(6);
    fs.writeFileSync(path.join(output,`height-${width}.json`),JSON.stringify({width,viewportHeight:1000,catalogCount:catalog.length,rendering,heroSHA256,collapsed,expanded},null,2)+'\n');
    expect(errors).toEqual([]);
  });
}

test('Homepage refinement catalog states and keyboard actions',async({page})=>{
  let mode='loading'; await mockCatalog(page,()=>mode);
  await page.goto('/');await expect(page.getByRole('status')).toContainText('Loading available services');
  await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Skip to content'})).toBeFocused();
  await page.keyboard.press('Enter');await expect(page).toHaveURL(/#main-content$/);
  mode='error';await page.reload();await expect(page.getByRole('alert')).toContainText('We couldn’t load services');
  mode='ready';await page.getByRole('button',{name:'Try again'}).click();await expect(page.locator('.home-service')).toHaveCount(6);
  await page.keyboard.press('Tab');
  const toggle=page.locator('.home-services-toggle');await toggle.focus();
  expect(await toggle.evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('solid');
  await page.keyboard.press('Enter');await expect(page.locator('.home-service')).toHaveCount(catalog.length);
  await page.keyboard.press('Space');await expect(page.locator('.home-service')).toHaveCount(6);
  const service=page.locator('.home-service a').first();await service.focus();
  expect(await service.evaluate(el=>getComputedStyle(el,'::after').outlineStyle)).toBe('solid');
  await page.locator('.home-service a').first().click();await expect(page).toHaveURL(/\/browse$/);await expect(page.getByRole('searchbox')).toBeVisible();
  await page.goto('/');await page.locator('.home-join a[href="/auth?mode=register"]').click();await expect(page.locator('.auth-card')).toBeVisible();
  await expect(page.getByRole('radio',{name:/organization/i})).toBeVisible();
  mode='empty';await page.goto('/');await expect(page.getByText('There are no published services to show yet. Please check back soon.')).toBeVisible();await expect(page.locator('.home-service')).toHaveCount(0);
});
