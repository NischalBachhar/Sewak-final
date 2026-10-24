const {test,expect}=require('./test.cjs');
const {seed,db,createTestAccount}=require('./seed.cjs');
const axe=require('axe-core');
test.beforeAll(seed);

for(const [role,path]of [['customer','/user/home'],['caregiver','/caregiver'],['org','/organization'],['admin','/superadmin']])for(const width of [390,1440])test(`role hero video playback and pause: ${role} at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'no-preference'});
 await page.goto('/auth');await page.getByLabel('Email',{exact:true}).fill('e2e-'+role+'@example.test');await page.getByLabel('Password',{exact:true}).fill('Local-test-only-123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).not.toHaveURL(/\/auth/);await page.goto(path);
 const video=page.locator('.sewak-role-hero video').first();await video.scrollIntoViewIfNeeded();await expect(video).toHaveClass('is-ready');await expect.poll(()=>video.evaluate(v=>v.paused)).toBe(false);
 await page.getByRole('button',{name:'Pause background video',exact:true}).first().click();expect(await video.evaluate(v=>v.paused)).toBe(true);
 await page.getByRole('button',{name:'Play background video',exact:true}).first().click();await expect.poll(()=>video.evaluate(v=>v.paused)).toBe(false);
 await info.attach('role-media-state',{body:JSON.stringify(await video.evaluate(v=>({readyState:v.readyState,paused:v.paused,error:v.error?.code||null}))),contentType:'application/json'});
 await page.emulateMedia({reducedMotion:'reduce'});await expect(video).toHaveCount(0);
});

test('self-hosted Sewak media preserves the static fallback when delivery fails',async({page})=>{
 const external=[];
 page.on('request',request=>{if(/images\.unsplash\.com|videos\.pexels\.com/.test(request.url()))external.push(request.url());});
 await page.route('**/videos/**',route=>route.abort('failed'));
 await page.route('**/images/sewak2-senior-care.webp',route=>route.abort('failed'));
 await page.emulateMedia({reducedMotion:'no-preference'});
 const response=await page.goto('/');
 expect(response.headers()['content-security-policy']).toContain("media-src 'self';");
 expect(response.headers()['content-security-policy']).toContain("img-src 'self' blob: data:;");
 const fallback=page.locator('.care-search-hero .sewak-care-media img');
 await expect(fallback).toHaveAttribute('src','/images/care-for-every-generation.webp');
 await expect.poll(()=>fallback.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
 await expect(page.getByRole('button',{name:'Pause background video'})).toHaveCount(0);
 expect(external).toEqual([]);
});

for(const width of [320,360,390,720,1440])test(`original hero MP4 plays, can be paused and preserves its static fallback at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:900});
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.goto('/');
 const video=page.locator('.care-search-hero .sewak-care-media video');
 await expect(video).toHaveClass('is-ready');
 await expect.poll(()=>video.evaluate(el=>el.readyState)).toBeGreaterThanOrEqual(2);
 await page.getByRole('button',{name:'Pause background video'}).click();
 await expect.poll(()=>video.evaluate(el=>el.paused)).toBe(true);
 await page.getByRole('button',{name:'Play background video'}).click();
 await expect.poll(()=>video.evaluate(el=>el.paused)).toBe(false);
 const control=page.getByRole('button',{name:'Pause background video'}),box=await control.boundingBox();
 expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
 for(const link of await page.locator('.care-category-tile').all()){
  const target=await link.boundingBox();expect(box.x<target.x+target.width&&box.x+box.width>target.x&&box.y<target.y+target.height&&box.y+box.height>target.y).toBe(false);
 }
 await control.focus();await page.keyboard.press('Enter');await expect.poll(()=>video.evaluate(el=>el.paused)).toBe(true);
 await page.getByRole('button',{name:'Play background video'}).click();await expect.poll(()=>video.evaluate(el=>el.paused)).toBe(false);
 await page.screenshot({path:info.outputPath(`public-player-${width}.png`),animations:'disabled'});
 await page.emulateMedia({reducedMotion:'reduce'});
 await expect(video).toHaveCount(0);
 await expect(page.locator('.care-search-hero .sewak-care-media img')).toBeVisible();
});

for(const width of [320,390,768,1440,1920])test(`expanded marketplace screens and organization at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:900});
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const [role,routes] of [['customer',['/user/notifications','/user/inbox','/user/jobs','/user/membership']],['caregiver',['/caregiver/availability','/caregiver/notifications']],['org',['/organization?tab=overview','/organization?tab=caregivers','/organization?tab=bookings','/organization/notifications']],['admin',['/superadmin/accounts','/superadmin/audit']]]){
   await page.goto('/auth');
   await page.getByLabel('Email',{exact:true}).fill(`e2e-${role}@example.test`);
   await page.getByLabel('Password',{exact:true}).fill('Local-test-only-123!');
   await page.getByRole('button',{name:'Sign in',exact:true}).click();
   await expect(page).not.toHaveURL(/\/auth/);
   for(const route of routes){
     await page.goto(route);
     await expect(page.locator('main h1').first()).toBeVisible();
     await expect(page.locator('main')).toHaveCount(1);
     expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
     expect(await page.locator('video').count()).toBe(0);
     await page.evaluate(axe.source);
     const violations=await page.evaluate(async()=> (await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations);
     expect(violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),route).toEqual([]);
     await page.screenshot({path:info.outputPath(role+'-'+route.replace(/[^a-z0-9]/gi,'-')+'-'+width+'.png'),fullPage:true,animations:'disabled'});
   }
   await page.getByRole('button',{name:/Account menu for/}).click();
   await page.getByRole('button',{name:/Logout/}).click();
   await expect(page.getByRole('button',{name:/Account menu for/})).toHaveCount(0);
 }
});

test('superadmin can restrict and tombstone an account with visible audit evidence',async({page})=>{
 const uid='e2e-managed-account';
 await createTestAccount({uid,email:uid+'@example.test',password:'Local-test-only-123!'});
 await db.doc('users/'+uid).set({uid,name:'Managed Account',email:uid+'@example.test',role:'user',profileComplete:true,isSuspended:false,isBlacklisted:false});
 await page.goto('/auth');await page.getByLabel('Email',{exact:true}).fill('e2e-admin@example.test');await page.getByLabel('Password',{exact:true}).fill('Local-test-only-123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).not.toHaveURL(/\/auth/);
 await page.goto('/superadmin/accounts');
 const account=page.locator('.admin-operations__records li').filter({has:page.getByRole('heading',{name:'Managed Account',exact:true})});
 await account.getByRole('button',{name:'Blacklist account'}).click();
 await page.getByRole('dialog').getByLabel('Reason').fill('Synthetic account moderation test');
 await page.getByRole('dialog').getByRole('button',{name:'Confirm blacklist'}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await account.getByRole('button',{name:'Delete account'}).click();
 const dialog=page.getByRole('dialog');
 await expect(dialog.getByRole('button',{name:'Confirm deletion'})).toBeDisabled();
 await dialog.getByLabel('Type Managed Account to confirm').fill('Managed Account');
 await dialog.getByRole('button',{name:'Confirm deletion'}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(account).toContainText('Deleted from active use');
 expect((await db.doc('users/'+uid).get()).data().deletedAt).toBeTruthy();
 await page.goto('/superadmin/audit');
 await expect(page.getByRole('heading',{name:'care account deleted',exact:true})).toBeVisible();
});
