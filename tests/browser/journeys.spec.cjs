const {test,expect}=require('./test.cjs');
const {seed,db,createTestAccount}=require('./seed.cjs');
test.beforeAll(seed);
async function signIn(page,role){
 await page.goto('/auth');await page.getByLabel('Email',{exact:true}).fill(`e2e-${role}@example.test`);await page.getByLabel('Password',{exact:true}).fill('Local-test-only-123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page).not.toHaveURL(/\/auth/);
}
async function checkOverflow(page){const result=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,url:location.pathname,outside:[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+2).slice(0,10).map(el=>({tag:el.tagName,class:el.className,right:el.getBoundingClientRect().right}))}));expect(result.scroll,JSON.stringify(result)).toBeLessThanOrEqual(result.width+2);}
test('asset security headers allow Cloudflare sessions without external auth origins',async({page})=>{
 await page.addInitScript(()=>{window.__cspViolations=[];document.addEventListener('securitypolicyviolation',e=>window.__cspViolations.push({directive:e.effectiveDirective,blocked:e.blockedURI}));});
 const response=await page.goto('/auth');const headers=response.headers();
 expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
 expect(headers['content-security-policy']).toContain("connect-src 'self';");
 expect(headers['content-security-policy']).not.toMatch(/firebase|googleapis/);
 expect(headers['x-content-type-options']).toBe('nosniff');expect(headers['x-frame-options']).toBe('DENY');
 expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');expect(headers['permissions-policy']).toContain('camera=()');
 await signIn(page,'customer');await page.goto('/user/profile');await expect(page.getByRole('button',{name:'Save Profile',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>window.__cspViolations)).toEqual([]);
});
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
test('real D1 customer request -> caregiver acceptance/start/complete -> refreshed verified review',async({browser})=>{
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
 await customer.reload();
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
 await page.getByLabel('Email',{exact:true}).fill('missing@example.test');await page.getByRole('button',{name:'Forgot password?'}).click();await expect(page.getByText(/Contact your Sewak administrator/)).toBeVisible();
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
  await vendorRef.update({organizationId:null});await signIn(page,'org');await page.goto('/organization?tab=bookings');await expect(page.getByText('Test Customer').first()).toBeVisible();
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
 await createTestAccount({uid:'e2e-recovery',email:'e2e-recovery@example.test',password:'Local-test-only-123!'});
 await page.goto('/auth');await page.getByLabel('Email',{exact:true}).fill('e2e-recovery@example.test');await page.getByLabel('Password',{exact:true}).fill('Local-test-only-123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByLabel('Full name')).toBeVisible();await page.getByLabel('Full name').fill('Recovered Test Applicant');await page.getByRole('radio',{name:/Organization\/Company/}).check();await page.getByLabel('Organization/Company Name').fill('Recovered Test Organization');await page.getByRole('button',{name:'Sign up',exact:true}).click();
 await expect(page).toHaveURL(/\/user\/profile/);await expect.poll(async()=> (await db.doc('users/e2e-recovery').get()).data()?.role).toBe('user');await expect.poll(async()=> (await db.doc('organizationApplications/e2e-recovery').get()).data()?.status).toBe('pending');await expect(page.getByRole('button',{name:/Account menu for Recovered Test Applicant/})).toBeVisible();
});

test('organization pagination preserves global and filtered counts with legacy missing earnings',async({page})=>{
 await db.doc('users/archived-customer').set({role:'user'});await db.doc('vendors/departed-caregiver').set({name:'Archived caregiver'});
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

test('browser photo compression uploads bounded binary images and replaces the existing profile reference',async({browser},testInfo)=>{
 const requireWorker=require('node:module').createRequire(require.resolve('../../worker/package.json'));const sharp=requireWorker('sharp');
 const source=await sharp({create:{width:1600,height:900,channels:3,background:'#b68164'}}).png().toBuffer();
 const context=await browser.newContext();await require('./media-observation.cjs').observeMediaBlobs(context);
 const page=await context.newPage();await signIn(page,'customer');await page.goto('/user/profile');
 await page.locator('input[type="tel"]').fill('9800000000');
 await page.locator('#profile-picture-upload').setInputFiles({name:'large-source.png',mimeType:'image/png',buffer:source});
 const upload=page.waitForResponse(r=>r.url().includes('/api/profiles/e2e-customer/image')&&r.request().method()==='PUT');
 await page.getByRole('button',{name:'Save Profile',exact:true}).click();const response=await upload;expect(response.status()).toBe(200);const image=await response.json();expect(image.size).toBeLessThanOrEqual(200000);expect(Math.max(image.width,image.height)).toBeLessThanOrEqual(512);
 expect(response.request().headers()['content-type']).toMatch(/^image\/(webp|jpeg)$/);
 await expect(page).not.toHaveURL(/\/user\/profile/);
 expect((await db.doc('users/e2e-customer').get()).data().profile_image_id).toBe('profile_e2e-customer');
 expect((await db.doc('users/e2e-customer').get()).data().city).toBe('Hetauda');
 const mediaRead=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/media/profile_e2e-customer'&&r.request().method()==='GET');
 await page.goto('/user/profile');const mediaResponse=await mediaRead;
 expect(mediaResponse.status()).toBe(200);expect(mediaResponse.headers()['content-type']).toMatch(/^image\/(webp|jpeg)$/);
 expect((await mediaResponse.request().allHeaders()).cookie).toMatch(/__Host-sewak_session=swk_/);
 expect(mediaResponse.request().headers().authorization).toBeUndefined();
 await mediaResponse.finished();const mediaBytes=await mediaResponse.body();const mediaHeaders=mediaResponse.headers();
 await expect.poll(()=>page.evaluate(id=>window.__sewakMediaObservations.find(entry=>entry.requestId===id)?.objectUrlCreated,mediaHeaders['x-sewak-test-request-id'])).toBe(true);
 const applicationBlob=await page.evaluate(id=>window.__sewakMediaObservations.find(entry=>entry.requestId===id),mediaHeaders['x-sewak-test-request-id']);
 const applicationBytes=Buffer.from(await page.evaluate(id=>Array.from(window.__sewakMediaBytes.get(id)),mediaHeaders['x-sewak-test-request-id']));
 const boundaryEvidence={requestId:mediaHeaders['x-sewak-test-request-id'],browserVersion:browser.version(),playwrightVersion:require('@playwright/test/package.json').version,serverBytes:Number(mediaHeaders['x-sewak-test-body-bytes']),serverSHA256:mediaHeaders['x-sewak-test-body-sha256'],applicationBlob,playwrightBytes:mediaBytes.length,playwrightSHA256:require('node:crypto').createHash('sha256').update(mediaBytes).digest('hex'),networkSizes:await mediaResponse.request().sizes(),uploadBytes:image.size};
 await testInfo.attach('authenticated-media-boundaries',{body:JSON.stringify(boundaryEvidence,null,2),contentType:'application/json'});
 expect(boundaryEvidence.serverBytes).toBeGreaterThan(0);expect(applicationBlob.blobBytes).toBeGreaterThan(0);expect(applicationBlob.blobBytes).toBeLessThanOrEqual(200000);expect(applicationBlob.blobBytes).toBe(image.size);
 expect(applicationBlob.arrayBufferBytes).toBe(boundaryEvidence.serverBytes);expect(applicationBlob.sha256).toBe(boundaryEvidence.serverSHA256);
 expect(applicationBytes.length).toBeGreaterThan(0);expect(applicationBytes.length).toBe(image.size);
 expect(require('node:crypto').createHash('sha256').update(applicationBytes).digest('hex')).toBe(boundaryEvidence.serverSHA256);
 expect(applicationBlob.status).toBe(200);expect(applicationBlob.mime).toMatch(/^image\/(webp|jpeg)$/);expect(applicationBlob.objectUrlBytes).toBe(applicationBytes.length);
 expect(boundaryEvidence.networkSizes.responseBodySize).toBeGreaterThan(0);
 // Chromium's DevTools body capture can be empty even when fetch().blob()
 // delivered the complete image. Validate the exact Blob passed to the app's
 // createObjectURL; compare DevTools bytes too whenever capture is available.
 if(mediaBytes.length)expect(mediaBytes.equals(applicationBytes)).toBe(true);
 await expect(page.locator('img[alt="Profile"]')).toBeVisible();
 await expect.poll(()=>page.locator('img[alt="Profile"]').evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
 const displayed=await page.locator('img[alt="Profile"]').evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight,objectUrl:img.src.startsWith('blob:')}));
 expect(displayed.height).toBeGreaterThan(0);expect(Math.max(displayed.width,displayed.height)).toBeLessThanOrEqual(512);expect(displayed.objectUrl).toBe(true);
 const decoded=await sharp(applicationBytes).metadata();expect(decoded.format).toMatch(/^(webp|jpeg)$/);expect(displayed.width).toBe(decoded.width);expect(displayed.height).toBe(decoded.height);
 const anonymousContext=await browser.newContext();
 const anonymous=await anonymousContext.request.get('/api/media/profile_e2e-customer');expect(anonymous.status()).toBe(403);await anonymousContext.close();
 await context.close();
 const caregiverContext=await browser.newContext(),caregiver=await caregiverContext.newPage();await signIn(caregiver,'caregiver');await caregiver.goto('/caregiver/profile');
 for(const color of ['#64517d','#e2a15f']){
  const buffer=await sharp({create:{width:1000,height:1000,channels:3,background:color}}).jpeg().toBuffer();
  const uploaded=caregiver.waitForResponse(r=>r.url().includes('/api/profiles/e2e-caregiver/image')&&r.request().method()==='PUT');
  await caregiver.getByLabel('Profile photo',{exact:true}).setInputFiles({name:'caregiver.jpg',mimeType:'image/jpeg',buffer});expect((await uploaded).status()).toBe(200);
 }
 expect((await db.doc('vendors/e2e-caregiver').get()).data().profile_image_id).toBe('profile_e2e-caregiver');
 const publicPhoto=await caregiverContext.request.get('/api/media/profile_e2e-caregiver');expect(publicPhoto.status()).toBe(200);expect(publicPhoto.headers()['cache-control']).toContain('public');const publicBytes=await publicPhoto.body();expect(publicBytes.length).toBeGreaterThan(0);expect(publicBytes.length).toBeLessThanOrEqual(200000);
 await caregiverContext.close();
});
