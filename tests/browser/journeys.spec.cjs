const {test,expect}=require('@playwright/test');
const {seed,db}=require('./seed.cjs');
test.beforeAll(seed);
async function signIn(page,role){
 await page.goto('/auth');await page.getByLabel('Email',{exact:true}).fill(`e2e-${role}@example.test`);await page.getByLabel('Password',{exact:true}).fill('Local-test-only-123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page).not.toHaveURL(/\/auth/);
}
async function checkOverflow(page){const result=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,url:location.pathname,outside:[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+2).slice(0,10).map(el=>({tag:el.tagName,class:el.className,right:el.getBoundingClientRect().right}))}));expect(result.scroll,JSON.stringify(result)).toBeLessThanOrEqual(result.width+2);}
for(const width of [320,375,430,768,1366,1920])test(`public and four authenticated role routes at ${width}px`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height:900}});const page=await context.newPage();
 await page.goto('/browse');await expect(page.getByRole('heading',{name:/Care that feels/})).toBeVisible();await checkOverflow(page);
 await page.getByRole('button',{name:'Create an account',exact:true}).click();await expect(page.getByLabel('Full name')).toBeVisible();
 for(const [role,route,heading]of[['customer','/user/home','Welcome back'],['caregiver','/caregiver/jobs',''],['org','/organization?tab=bookings','Organization Dashboard'],['admin','/superadmin/caregivers','Admin Dashboard']]){
  const roleContext=await browser.newContext({viewport:{width,height:900}});const p=await roleContext.newPage();await signIn(p,role);await p.goto(route);
  if(heading)await expect(p.getByRole('heading',{name:new RegExp(heading)}).first()).toBeVisible();else await expect(p.getByRole('heading',{name:/Test caregiver|Caregiver|My jobs|Jobs/i}).first()).toBeVisible();
  await checkOverflow(p);await p.reload();await expect(p.getByRole('button',{name:/Account menu for/})).toBeVisible();await checkOverflow(p);
  if(role==='org'){await p.goto('/organization?tab=caregivers');await p.getByRole('button',{name:'Add New Caregiver',exact:true}).first().click();await expect(p.getByRole('dialog')).toBeVisible();await p.keyboard.press('Escape');await expect(p.getByRole('dialog')).toHaveCount(0);}
  await roleContext.close();
 }
 await context.close();
});
test('real customer request -> caregiver acceptance/start/complete -> immediate verified review',async({browser})=>{
 const customerContext=await browser.newContext();const customer=await customerContext.newPage();await signIn(customer,'customer');await customer.goto('/user/book/e2e-caregiver');
 await customer.getByLabel('Person needing care').fill('Synthetic recipient');await customer.getByLabel('What help is required?').fill('Synthetic care needs');await customer.getByLabel('Care or support needed').selectOption('e2e-care');await customer.getByRole('button',{name:'Continue',exact:true}).click();
 await customer.locator('#booking-date').fill('2090-01-01');await customer.locator('#booking-time').fill('10:00');await customer.getByRole('button',{name:'Continue',exact:true}).click();
 await customer.getByLabel('Additional instructions').fill('Synthetic additional notes');await customer.getByRole('button',{name:'Continue',exact:true}).click();
 expect((await db.collection('bookings').get()).size).toBe(0);
 await customer.getByRole('button',{name:'Confirm booking',exact:true}).evaluate(button=>{button.click();button.click();});
 await expect(customer.getByRole('heading',{name:/Your request is with/})).toBeVisible();await customer.getByRole('button',{name:'View booking',exact:true}).click();
 const bookingId=new URL(customer.url()).pathname.split('/').pop();
 expect((await db.collection('bookings').get()).size).toBe(1);
 const caregiverContext=await browser.newContext();const caregiver=await caregiverContext.newPage();await signIn(caregiver,'caregiver');await caregiver.goto('/caregiver/jobs');
 await caregiver.getByRole('combobox').first().selectOption('All jobs');await caregiver.getByRole('button',{name:'Accept',exact:true}).last().click();await caregiver.getByRole('button',{name:/I've arrived/}).last().click();
 await caregiver.getByRole('button',{name:/Finish shift/}).last().click();
 await expect(customer.getByRole('heading',{name:'How was your care experience?'})).toBeVisible();await customer.getByLabel('Share a short note').fill('Synthetic verified feedback');await customer.getByRole('button',{name:'Submit verified review'}).click();await expect(customer.getByRole('heading',{name:'Thank you for your feedback'})).toBeVisible();
 const booking=(await db.doc(`bookings/${bookingId}`).get()).data();expect(booking.status).toBe('completed');expect(booking.paymentStatus).toBe('pending');expect(booking.commissionRate).toBe(12.5);
 await customer.reload();await expect(customer.getByText('Synthetic additional notes')).toBeVisible();
 await customerContext.close();await caregiverContext.close();
});
test('superadmin profile editor saves a validated profile and supports keyboard dismissal',async({page})=>{
 await signIn(page,'admin');await page.goto('/superadmin/caregivers');await page.getByRole('button',{name:'Edit Caregiver',exact:true}).first().click();
 const dialog=page.getByRole('dialog',{name:'Edit caregiver profile'});await expect(dialog).toBeVisible();await dialog.getByLabel('Biography').fill('Updated synthetic biography');await dialog.getByRole('button',{name:'Save profile'}).click();await expect(dialog).toHaveCount(0);await expect(page.getByText('Caregiver profile saved.')).toBeVisible();
 expect((await db.doc('vendors/e2e-caregiver').get()).data().organizationId).toBe('e2e-org');
});
test('not-found, direct-link refresh, private metadata and recovery action',async({page})=>{
 await page.goto('/missing-page');await expect(page.getByRole('heading',{name:'Page not found'})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'Page not found'})).toBeVisible();
 const response=await page.goto('/auth');expect(response.headers()['x-robots-tag']).toContain('noindex');await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex,nofollow');
 await page.getByLabel('Email',{exact:true}).fill('missing@example.test');await page.getByRole('button',{name:'Forgot password?'}).click();await expect(page.getByText(/If this address can receive/)).toBeVisible();
});

test('report submission, duplicate retry, private moderator data and safe history agree',async({page})=>{
 const prior=(await db.collection('bookings').limit(1).get()).docs[0];expect(prior).toBeTruthy();
 await signIn(page,'caregiver');await page.goto(`/caregiver/reportuser?bookingId=${prior.id}`);
 await page.getByLabel('Reason').selectOption('Safety concerns');await page.getByLabel('What happened?').fill('Synthetic conduct concern for local regression testing.');await page.getByRole('button',{name:'Submit report for review'}).click();await expect(page.getByText(/Report submitted for review/)).toBeVisible();
 await db.doc(`blacklistReports/${prior.id}`).update({moderatorNote:'PRIVATE_MODERATOR_DETAIL'});
 await page.getByRole('button',{name:'Return to jobs'}).click();await expect(page.getByRole('heading',{name:'Report history'})).toBeVisible();await expect(page.getByText('PRIVATE_MODERATOR_DETAIL')).toHaveCount(0);
 await page.goto(`/caregiver/reportuser?bookingId=${prior.id}`);await page.getByLabel('Reason').selectOption('Other');await page.getByLabel('What happened?').fill('Duplicate attempt');await page.getByRole('button',{name:'Submit report for review'}).click();await expect(page.getByText(/Report submitted for review/)).toBeVisible();
 expect((await db.doc(`blacklistReports/${prior.id}`).get()).data().reason).toBe('Safety concerns');expect((await db.collection('reportReceipts').get()).size).toBe(1);
});

test('organization retains booking history after caregiver leaves roster; customer cancellation and account switching work',async({browser})=>{
 const vendorRef=db.doc('vendors/e2e-caregiver'),vendor=(await vendorRef.get()).data();
 const prior=(await db.collection('bookings').limit(1).get()).docs[0];const id=`e2e-customer_${require('node:crypto').randomUUID()}`;
 await db.doc(`bookings/${id}`).set({...prior.data(),status:'pending',careRecipient:'Cancellation test'});
 const context=await browser.newContext(),page=await context.newPage();
 try {
  await vendorRef.delete();await signIn(page,'org');await page.goto('/organization?tab=bookings');await expect(page.getByText('Test Customer').first()).toBeVisible();
  await page.getByRole('button',{name:/Account menu for/}).click();await page.getByRole('button',{name:/Logout/}).click();await expect(page.getByRole('button',{name:/Account menu for/})).toHaveCount(0);
  await signIn(page,'customer');await page.goto('/user/mybookings');page.on('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:/Cancel request|Cancel booking|^Cancel$/}).last().click();await expect.poll(async()=> (await db.doc(`bookings/${id}`).get()).data().status).toBe('cancelled');
  await page.reload();await expect(page.getByText(/Cancelled/).last()).toBeVisible();await page.goBack();await expect(page.getByRole('button',{name:/Account menu for Test Customer/})).toBeVisible();
 } finally {await vendorRef.set(vendor);await context.close();}
});

test('slow loading and offline authentication show recoverable state; local navigation timings are recorded',async({page,context},testInfo)=>{
 await page.route('**/*.js',async route=>{await new Promise(resolve=>setTimeout(resolve,150));await route.continue();});
 await page.goto('/browse');await expect(page.getByRole('heading',{name:/Care that feels/})).toBeVisible();
 const metrics=await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];return {environment:'local Chrome, synthetic 150ms script delay; not field Web Vitals',domContentLoadedMs:n.domContentLoadedEventEnd,loadMs:n.loadEventEnd,paint:performance.getEntriesByType('paint').map(p=>({name:p.name,startTime:p.startTime})),scripts:performance.getEntriesByType('resource').filter(r=>r.initiatorType==='script').length};});await testInfo.attach('local-navigation-metrics',{body:JSON.stringify(metrics,null,2),contentType:'application/json'});
 await page.goto('/auth');await page.getByLabel('Email',{exact:true}).fill('offline@example.test');await page.getByLabel('Password',{exact:true}).fill('Local-test-only-123!');await context.setOffline(true);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible({timeout:30000});await context.setOffline(false);await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeEnabled();
});

test('an authenticated account without a profile can resume organization signup without a second sign-in or elevated permissions',async({page})=>{
 const req=require('node:module').createRequire(require.resolve('../../functions/package.json'));const {getAuth}=req('firebase-admin/auth');
 await getAuth().createUser({uid:'e2e-recovery',email:'e2e-recovery@example.test',password:'Local-test-only-123!'});
 await page.goto('/auth');await page.getByLabel('Email',{exact:true}).fill('e2e-recovery@example.test');await page.getByLabel('Password',{exact:true}).fill('Local-test-only-123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByLabel('Full name')).toBeVisible();await page.getByLabel('Full name').fill('Recovered Test Applicant');await page.getByRole('radio',{name:/Organization\/Company/}).check();await page.getByLabel('Organization/Company Name').fill('Recovered Test Organization');await page.getByRole('button',{name:'Sign up',exact:true}).click();
 await expect(page).toHaveURL(/\/user\/profile/);await expect.poll(async()=> (await db.doc('users/e2e-recovery').get()).data()?.role).toBe('user');await expect.poll(async()=> (await db.doc('organizationApplications/e2e-recovery').get()).data()?.status).toBe('pending');await expect(page.getByRole('button',{name:/Account menu for Recovered Test Applicant/})).toBeVisible();
});

test('organization pagination preserves global and filtered counts with legacy missing earnings',async({page})=>{
 const batch=db.batch();for(let i=0;i<28;i++)batch.set(db.doc(`bookings/pagination-${String(i).padStart(2,'0')}`),{organizationId:'e2e-org',caregiverId:'departed-caregiver',userId:'archived-customer',userName:`Archived Customer ${i}`,status:'completed',totalAmount:100,...(i%2?{vendorEarnings:85}:{})});await batch.commit();
 await signIn(page,'org');await page.goto('/organization?tab=bookings');await expect(page.getByRole('button',{name:'Bookings (30)',exact:true})).toBeVisible();await expect(page.getByText('30 matching bookings. Showing up to 25 per page.')).toBeVisible();
 await page.getByLabel('Booking status').selectOption('completed');await expect(page.getByText('29 matching bookings. Showing up to 25 per page.')).toBeVisible();await page.getByRole('button',{name:'Next page'}).click();await expect(page.getByText(/^Customer:/)).toHaveCount(4);await expect(page.getByRole('button',{name:'Next page'})).toBeDisabled();await expect(page.getByRole('button',{name:'Bookings (30)',exact:true})).toBeVisible();await page.getByRole('button',{name:'Previous page'}).click();await expect(page.getByText(/^Customer:/)).toHaveCount(25);
});

test('unknown authenticated dashboard paths render not-found without losing the signed-in account',async({page})=>{
 await signIn(page,'admin');await page.goto('/superadmin/unknown-section');await expect(page.getByRole('heading',{name:'Page not found'})).toBeVisible();await expect(page.getByRole('button',{name:/Account menu for/})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'Page not found'})).toBeVisible();
});

test('long form text, keyboard containment and mobile bottom navigation remain usable',async({browser})=>{
 const context=await browser.newContext({viewport:{width:320,height:900}}),page=await context.newPage();
 await signIn(page,'org');await page.goto('/organization?tab=caregivers');const trigger=page.getByRole('button',{name:'Add New Caregiver',exact:true});await trigger.click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await dialog.locator('input').first().fill('SyntheticLongName'.repeat(7));await checkOverflow(page);
 await page.keyboard.press('Shift+Tab');expect(await page.evaluate(()=>Boolean(document.activeElement.closest('[role="dialog"]')))).toBe(true);await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
 await page.getByRole('button',{name:/Account menu for/}).click();await page.getByRole('button',{name:/Logout/}).click();await signIn(page,'customer');await page.goto('/user/home');const nav=page.getByRole('navigation',{name:'Customer navigation'});await expect(nav).toBeVisible();const bounds=await nav.boundingBox();expect(bounds.y+bounds.height).toBeLessThanOrEqual(902);await nav.getByRole('button',{name:'Bookings',exact:true}).click();await expect(page).toHaveURL(/\/user\/mybookings/);await expect(nav.getByRole('button',{name:'Bookings',exact:true})).toHaveAttribute('aria-current','page');await checkOverflow(page);await context.close();
});
