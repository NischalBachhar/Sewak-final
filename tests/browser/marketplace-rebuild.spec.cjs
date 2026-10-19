const { test, expect } = require('./test.cjs');
const { seed } = require('./seed.cjs');
test.beforeAll(seed);
async function privateGet(page,path){
 return page.evaluate(async url=>{
  const response=await fetch(url,{credentials:'same-origin',cache:'no-store'});
  return {status:response.status,data:await response.json()};
 },path);
}

async function signIn(page, role) {
  await page.goto('/auth');
  await page.getByLabel('Email', { exact: true }).fill('e2e-' + role + '@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Local-test-only-123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/auth/);
}

test('customer sees owned notification inbox and messaging workspace on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, 'customer');
  await page.goto('/user/notifications');
  await expect(page.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Notifications/ })).toBeVisible();
  const response = await privateGet(page,'/api/care-notifications');
  expect(response.status).toBe(200);
  const body = response.data;
  expect(Array.isArray(body.items)).toBe(true);
  await page.goto('/user/inbox');
  await expect(page.getByRole('heading', { name: 'Messages', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('approved caregiver can block and unblock future availability through the signed-in UI', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, 'caregiver');
  await page.goto('/caregiver/availability');
  await expect(page.getByRole('heading', { name: 'Manage your time' })).toBeVisible();
  const day = new Date(Date.now() + 290 * 86400000).toISOString().slice(0, 10);
  await page.getByLabel('Date', { exact: true }).fill(day);
  await page.getByLabel('From').fill('09:00');
  await page.getByLabel('Until').fill('17:00');
  await page.getByRole('button', { name: 'Block this time' }).click();
  await expect(page.getByText('Time blocked. New booking requests cannot overlap this period.')).toBeVisible();
  await expect(page.getByText(day, { exact: true })).toBeVisible();
  const availability = await privateGet(page,'/api/care-schedule');
  expect(availability.status).toBe(200);
  expect(availability.data.blocks.some(item => item.day === day)).toBe(true);
  await page.getByRole('button', { name: 'Remove' }).first().click();
  await expect(page.getByText('No blocks set. Your profile\'s normal availability still applies.')).toBeVisible();
  await page.goto('/caregiver/inbox');
  await expect(page.getByRole('heading', { name: 'Messages', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('customer can preview membership preferences without payment or a subscription', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, 'customer');
  await page.goto('/user/membership');
  await expect(page.getByRole('heading', { name: 'Care made simpler, for everyone.' })).toBeVisible();
  await expect(page.getByText('Demo mode — no charges')).toBeVisible();
  const acknowledgement = page.getByRole('checkbox', { name: /I understand these are demo plan preferences/ });
  const plus = page.getByRole('button', { name: 'Select Care Plus preview' });
  await expect(plus).toBeDisabled();
  await acknowledgement.check();
  await plus.click();
  await expect(page.getByRole('status')).toContainText('No payment was made or subscription created');
  const saved = await privateGet(page,'/api/membership');
  expect(saved.status).toBe(200);
  const preference = saved.data;
  expect(preference).toMatchObject({
    tier: 'plus_preview', mode: 'demo-only', priceNpr: 0,
    charged: false, realSubscription: false,
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Your selected preview' })).toBeVisible();
  await page.getByRole('checkbox', { name: /I understand these are demo plan preferences/ }).check();
  await page.getByRole('button', { name: 'Select Care essentials' }).click();
  await expect(page.getByRole('status')).toContainText('No payment was made');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('caregiver account cannot open customer membership data', async ({ page }) => {
  await signIn(page, 'caregiver');
  const result = await privateGet(page,'/api/membership');
  expect(result.status).toBe(403);
});

test('caregiver can publish recurring weekly working hours and families see truthful booking availability',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await signIn(page,'caregiver');
  await page.goto('/caregiver/availability');
  await expect(page.getByRole('heading',{name:'Recurring weekly hours'})).toBeVisible();
  const date='2091-05-09';
  const weekday=new Date(date+'T00:00:00Z').getUTCDay();
  await page.getByLabel('Day of week').selectOption(String(weekday));
  await page.locator('#weekly-start').fill('09:00');
  await page.locator('#weekly-end').fill('17:00');
  await page.getByRole('button',{name:'Add hours'}).click();
  await expect(page.getByRole('status')).toContainText('Weekly working hours saved');
  const inside=await privateGet(page,'/api/care-schedule?caregiverId=e2e-caregiver&day='+date+'&time=10:00&hours=2');
  expect(inside.status).toBe(200);
  expect(inside.data.available).toBe(true);
  const outside=await privateGet(page,'/api/care-schedule?caregiverId=e2e-caregiver&day='+date+'&time=19:00&hours=2');
  expect(outside.status).toBe(200);
  expect(outside.data.available).toBe(false);
  await page.getByRole('button',{name:'Remove hours'}).click();
  await expect(page.getByText('You have not set any recurring working hours. Your normal profile availability applies.')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
