const {test,expect}=require('./test.cjs');
const {seed,db}=require('./seed.cjs');
const axe=require('axe-core');
test.beforeAll(async()=>{await seed();await db.doc('bookings/ui-priority').set({userId:'e2e-customer',caregiverId:'e2e-caregiver',organizationId:'e2e-org',userName:'Priority family',caregiverName:'Upcoming care professional',serviceLabel:'Refinement support',status:'pending',paymentStatus:'pending',date:'2026-10-30',time:'10:00',durationHours:2,totalAmount:1000,careNeeds:'Help with meals and mobility',address:'Hetauda'});});
test.afterAll(async()=>{await db.doc('bookings/ui-priority').update({status:'cancelled'});});
async function login(page,role){await page.goto('/auth');await page.getByLabel('Email',{exact:true}).fill(`e2e-${role}@example.test`);await page.getByLabel('Password',{exact:true}).fill('Local-test-only-123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).not.toHaveURL(/\/auth/);}
test.beforeEach(async({page})=>{await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});});

test('customer upcoming care precedes search and shortcuts on mobile',async({page})=>{
  await login(page,'customer');await page.goto('/user/home');
  const priority=page.getByRole('region',{name:'Your upcoming care'});await expect(priority).toContainText('Upcoming care professional');
  await expect(page.locator('.home-caregiver').first()).toBeVisible();
  const positions=await page.evaluate(()=>({priority:document.querySelector('.home-booking-activity').getBoundingClientRect().bottom,search:document.querySelector('.home-discovery').getBoundingClientRect().top}));
  expect(positions.priority).toBeLessThan(500);expect(positions.priority).toBeLessThan(positions.search);
  await priority.getByRole('link',{name:/Upcoming care professional/}).click();await expect(page).toHaveURL(/\/user\/bookings\/ui-priority$/);
});

test('caregiver request decisions keep care needs visible and payment details expandable',async({page})=>{
  await login(page,'caregiver');await page.goto('/caregiver');
  const review=page.getByRole('button',{name:'Review requests'});await expect(review).toBeVisible();expect(await review.evaluate(e=>e.getBoundingClientRect().bottom)).toBeLessThan(650);
  await expect(page.getByRole('heading',{name:'No upcoming care scheduled',exact:true})).toBeVisible();
  await review.click();const card=page.locator('.care-job-card').filter({hasText:'Refinement support'});await expect(card).toContainText('Help with meals and mobility');await expect(card.getByRole('button',{name:'Accept',exact:true})).toBeEnabled();await expect(card.getByRole('button',{name:'Decline',exact:true})).toBeEnabled();
  await expect(card.getByText('Booking ID',{exact:true})).not.toBeVisible();await card.locator('summary').click();await expect(card).toContainText('ui-priority');
  await page.getByRole('combobox',{name:'Caregiver section'}).selectOption('schedule');await expect(page.getByRole('button',{name:'Next week'})).toBeVisible();await expect(page.locator('.sewak-role-hero')).toHaveCount(0);
});

test('organization mobile bookings are readable cards with usable details',async({page})=>{
  await login(page,'org');await page.goto('/organization');await expect(page.getByRole('button',{name:/Review booking requests/})).toBeVisible();
  await page.getByRole('combobox',{name:'Organization section'}).selectOption('bookings');await expect(page.locator('.sewak-role-hero')).toHaveCount(0);
  const row=page.locator('.org-booking-table tbody tr').filter({hasText:'Refinement support'});await expect(row).toBeVisible();
  expect(await row.evaluate(e=>e.getBoundingClientRect().width)).toBeLessThan(390);await row.getByRole('button',{name:'View details'}).click();await expect(page.getByRole('dialog')).toContainText('Priority family');await page.getByRole('button',{name:'Close booking details'}).click();
});

test('superadmin review work appears before the compact overview media',async({page})=>{
  await login(page,'admin');await page.goto('/superadmin/overview');
  const queue=page.getByRole('heading',{name:'Review queue'});await expect(queue).toBeVisible();expect(await queue.evaluate(e=>e.getBoundingClientRect().bottom)).toBeLessThan(650);
  await page.getByRole('combobox',{name:'Administration section'}).selectOption('caregivers');const maintenance=page.getByRole('group',{name:'Listing maintenance'});await expect(maintenance).not.toHaveAttribute('open','');await expect(page.getByRole('button',{name:'Sync public listings',exact:true})).not.toBeVisible();
  await page.locator('.admin-listing-maintenance summary').click();await expect(page.getByRole('button',{name:'Sync public listings',exact:true})).toBeEnabled();
  await page.getByRole('combobox',{name:'Administration section'}).selectOption('admins');await expect(page.getByRole('heading',{name:'Superadmin access',exact:true})).toBeVisible();await expect(page.locator('.admin-access-card')).toContainText('Active');
});

test('booking banner remains readable and accessible',async({page})=>{
  await login(page,'customer');await page.goto('/user/mybookings');const title=page.getByRole('heading',{name:'My Bookings',exact:true});await expect(title).toBeVisible();expect(await title.evaluate(e=>getComputedStyle(e).color)).toBe('rgb(255, 255, 255)');
  await page.evaluate(axe.source);const violations=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations);expect(violations.map(v=>v.id)).toEqual([]);
});

test('empty care search retains the care-job destination through sign-in',async({page})=>{
  await page.goto('/browse?location=No-such-care-city');await page.getByRole('link',{name:'Post a care request'}).click();await expect(page).toHaveURL(/\/auth\?intent=post-care-job$/);
  await page.getByLabel('Email',{exact:true}).fill('e2e-customer@example.test');await page.getByLabel('Password',{exact:true}).fill('Local-test-only-123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(/\/user\/jobs$/);await expect(page.getByRole('heading',{name:'Post a care job',exact:true})).toBeVisible();
});
