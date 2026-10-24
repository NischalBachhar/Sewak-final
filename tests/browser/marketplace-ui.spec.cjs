const { test, expect } = require('./test.cjs');
const { seed } = require('./seed.cjs');
const axe = require('axe-core');
const fs = require('node:fs');
const path = require('node:path');
test.beforeAll(seed);
const shots = path.resolve('.local-tools/marketplace-ui');
async function capture(page, name) { fs.mkdirSync(shots,{recursive:true}); await page.screenshot({path:path.join(shots,name+'.jpg'),type:'jpeg',quality:70,fullPage:false}); }
async function noOverflow(page,width) { expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); }
for (const width of [320,390,768,1366]) {
  test('public marketplace layout, real pricing and accessibility '+width, async ({page}) => {
    const errors=[]; page.on('pageerror',err=>errors.push(err.message));
    await page.setViewportSize({width,height:936}); await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('/');
    await expect(page.getByRole('heading',{name:'Test Caregiver',exact:true})).toBeVisible();
    await expect(page.locator('.care-search-hero').getByRole('search')).toBeVisible();
    await expect(page.locator('.care-listing-card')).toHaveCount(1);
    await expect(page.locator('.care-listing-card').getByText('NPR 500/hour')).toBeVisible();
    await expect(page.locator('.care-listing-card').getByRole('button',{name:/Request availability/})).toBeEnabled();
    if(width>=1000) expect((await page.locator('.care-listing-card').boundingBox()).y+(await page.locator('.care-listing-card').boundingBox()).height).toBeLessThan(936);
    await noOverflow(page,width); await capture(page,'home-'+width);
    await page.evaluate(axe.source);
    const violations=await page.evaluate(async()=> (await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
    expect(violations).toEqual([]); expect(errors).toEqual([]);
    await page.goto('/browse'); await expect(page.locator('.care-listing-card')).toHaveCount(1);
    await expect(page.locator('.browse-preferences')).toHaveCount(0);
    await expect(page.getByRole('combobox',{name:'Service',exact:true})).toHaveCount(1);
    await noOverflow(page,width); await capture(page,'browse-'+width);
    await page.goto('/caregivers/e2e-caregiver'); await expect(page.getByRole('heading',{name:'Test Caregiver',exact:true})).toBeVisible();
    await expect(page.locator('.public-header')).toBeVisible(); await noOverflow(page,width); await capture(page,'profile-'+width);
    await page.goto('/auth?mode=register'); await expect(page.getByRole('radio',{name:/Find care/})).toBeVisible();
    await expect(page.getByLabel('Full name')).toBeHidden(); await noOverflow(page,width); await capture(page,'signup-'+width);
  });
}
test('category links apply service filters and organization links choose the organization flow',async({page})=>{
  await page.goto('/');
  await page.locator('.care-category-tile').filter({hasText:'Child care'}).click();
  await expect(page).toHaveURL(/browse\?service=catalog_child_care_babysitting/);
  await expect(page.getByRole('combobox',{name:'Service',exact:true})).toHaveValue('catalog_child_care_babysitting');
  await page.goto('/'); await page.getByRole('link',{name:'Register My Organization'}).click();
  await expect(page).toHaveURL(/role=orgadmin/); await expect(page.getByRole('list',{name:'Organization registration progress'})).toBeVisible();
  await expect(page.getByLabel('Full name')).toBeVisible();
  await page.getByRole('button',{name:'Change account type'}).click();
  await expect(page.getByRole('radio',{name:/Register an organization/})).toBeChecked();
});
test('request preferences survive sign-in and arrive in the existing booking form',async({page})=>{
  await page.goto('/'); await page.locator('.care-listing-card').getByRole('button',{name:/Request availability/}).click();
  await expect(page).toHaveURL(/caregivers\/e2e-caregiver\?request=1#request-care/);
  const date=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
  await page.getByLabel('Preferred date (optional)').fill(date); await page.getByLabel('Preferred start time (optional)').fill('09:30');
  await page.getByRole('button',{name:/Continue to request/}).click(); await expect(page).toHaveURL(/\/auth/);
  await page.getByLabel('Email',{exact:true}).fill('e2e-customer@example.test'); await page.getByLabel('Password',{exact:true}).fill('Local-test-only-123!');
  await page.getByRole('button',{name:'Sign in',exact:true}).click(); await expect(page).toHaveURL(/\/user\/book\/e2e-caregiver/);
  await expect(page.locator('#booking-date')).toHaveValue(date); await expect(page.locator('#booking-time')).toHaveValue('09:30');
});
test('resources, services and pricing share working navigation on a phone',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  for(const route of ['/care-services','/pricing','/safety','/get-started','/auth']) {
    await page.goto(route); await expect(page.locator('h1')).toBeVisible(); await noOverflow(page,390);
    await capture(page,route.replaceAll('/','')+'-390');
  }
  await page.goto('/pricing'); await page.getByRole('button',{name:'Open navigation'}).click();
  await expect(page.locator('#public-navigation')).toBeVisible();
  await expect(page.getByRole('link',{name:'Log in',exact:true}).first()).toBeVisible();
});
