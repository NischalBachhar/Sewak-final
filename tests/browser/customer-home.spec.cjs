const {test,expect}=require('./test.cjs');
const {seed,db}=require('./seed.cjs');
const {seedReviewedVerification}=require('./d1-fixtures.cjs');
test.beforeAll(async()=>{
 await seed();
 for(let i=0;i<8;i++) await db.doc(`vendors/discovery-${90+i}`).set({name:`Home Person ${i}`,location:'Pokhara',category:i===6?'household':'caregiver',workType:'parttime',shifts:['morning'],servicesOffered:[i===6?'catalog_housekeeping':'catalog_elderly_care'],hourlyRate:100+i*100,isApproved:true,isAvailable:i!==7,isSuspended:false,isBlacklisted:false});
 await seedReviewedVerification('discovery-90');
});
test.afterAll(async()=>{
 // Other browser suites share the loopback D1 fixture server. Retire only
 // this suite's profiles so their marketplace counts remain independent.
 for(let i=0;i<8;i++) await db.doc(`vendors/discovery-${90+i}`).update({isApproved:false});
});
async function login(page){await page.goto('/auth');await page.getByLabel('Email',{exact:true}).fill('e2e-customer@example.test');await page.getByLabel('Password',{exact:true}).fill('Local-test-only-123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).not.toHaveURL(/\/auth/);await page.goto('/user/home');await expect(page.locator('.home-caregiver').first()).toBeVisible();}
for(const width of [1440,768,375]) test(`customer marketplace first screen ${width}`,async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.setViewportSize({width,height:900});await login(page);
 await expect(page.getByRole('heading',{name:'Find care for the people who matter.'})).toBeVisible();
 const geometry=await page.evaluate(()=>({card:document.querySelector('.home-caregiver').getBoundingClientRect().top,action:document.querySelector('.home-caregiver .caregiver-preview__actions').getBoundingClientRect().bottom,secondary:document.querySelector('.home-booking-activity').getBoundingClientRect().top,columns:getComputedStyle(document.querySelector('.home-caregiver-grid')).gridTemplateColumns.split(' ').length,overflow:document.documentElement.scrollWidth>innerWidth}));
 expect(geometry.card).toBeLessThan(1100);expect(geometry.action).toBeLessThan(1700);expect(geometry.secondary).toBeGreaterThan(geometry.card);expect(geometry.columns).toBe(width===1440?3:width===768?2:1);expect(geometry.overflow).toBe(false);
 await page.screenshot({path:info.outputPath(`customer-home-${width}.png`),fullPage:true});expect(errors).toEqual([]);
});
test('customer marketplace filters, pagination, truthful verification and navigation',async({page})=>{
 await login(page);await page.getByLabel('City or location').fill('Pokhara');await expect(page.locator('.home-caregiver')).toHaveCount(6);await page.getByRole('button',{name:'Next caregivers'}).click();await expect(page.locator('.home-caregiver')).toHaveCount(1);await page.getByRole('button',{name:'First page'}).click();await expect(page.locator('.home-caregiver')).toHaveCount(6);
 await page.getByRole('button',{name:/More filters/}).click();await page.getByLabel('Minimum hourly price').fill('200');await page.getByLabel('Maximum hourly price').fill('300');await expect(page.locator('.home-caregiver')).toHaveCount(2);
 await page.getByLabel('Maximum hourly price').fill('100');await expect(page.getByRole('status')).toContainText('Minimum price');await expect(page.locator('.home-caregiver')).toHaveCount(0);
 await page.getByRole('button',{name:'Clear filters'}).click();await page.getByLabel('City or location').fill('No such city');await expect(page.getByRole('heading',{name:'No caregivers match your filters'})).toBeVisible();await page.getByRole('button',{name:'Reset filters'}).click();
 await page.getByLabel('City or location').fill('Pokhara');await page.getByLabel('Verified by Sewak only').check();await expect(page.locator('.home-caregiver')).toHaveCount(1);await expect(page.locator('.home-caregiver')).toContainText('Verified by Sewak');await page.getByRole('link',{name:'View Profile',exact:true}).click();await expect(page).toHaveURL(/\/user\/caregivers\/discovery-90/);
 await page.goto('/user/home');await page.getByLabel('City or location').fill('Pokhara');await page.getByRole('combobox',{name:'Requests',exact:true}).selectOption('unavailable');await expect(page.locator('.home-caregiver')).toHaveCount(1);await expect(page.locator('.home-caregiver')).toContainText('Verification not complete');await expect(page.getByRole('button',{name:'Booking unavailable'})).toBeDisabled();await expect(page.getByRole('link',{name:'Request care',exact:true})).toHaveCount(0);
 await page.getByRole('combobox',{name:'Requests',exact:true}).selectOption('accepting');await page.getByRole('combobox',{name:'Category',exact:true}).selectOption('household');await expect(page.locator('.home-caregiver')).toHaveCount(1);await page.getByRole('combobox',{name:'Service type',exact:true}).selectOption('catalog_housekeeping');await expect(page.locator('.home-caregiver')).toHaveCount(1);await page.getByRole('link',{name:'Book Now',exact:true}).click();await expect(page).toHaveURL(/\/user\/book\/discovery-96/);await expect(page.getByText('Booking unavailable',{exact:true})).toHaveCount(0);
});
test('customer discovery loading, error, retry and independent booking failure',async({page})=>{
 await login(page);
 await page.route('**/api/query',async route=>{const data=route.request().postDataJSON();if(data.path==='publicCaregivers'){await new Promise(r=>setTimeout(r,500));await route.fulfill({status:503,json:{error:{message:'Unavailable'}}});}else await route.continue();});
 await page.reload();await expect(page.getByText('Finding caregivers…',{exact:true})).toBeVisible();await expect(page.getByRole('alert')).toContainText('Caregiver profiles could not be loaded');await page.unroute('**/api/query');await page.getByRole('button',{name:'Try again',exact:true}).click();await expect(page.locator('.home-caregiver').first()).toBeVisible();
 await page.route('**/api/query',route=>route.request().postDataJSON().path==='bookings'?route.fulfill({status:503,json:{error:{message:'Unavailable'}}}):route.continue());await page.reload();await expect(page.locator('.home-caregiver').first()).toBeVisible();await expect(page.getByText('Bookings could not be loaded',{exact:true})).toBeVisible();
});
test('customer zero and completed booking activity stays below discovery',async({page})=>{
 await login(page);await expect(page.getByText('No upcoming care yet.',{exact:false})).toBeVisible();
 await db.doc('bookings/home-completed').set({userId:'e2e-customer',caregiverId:'e2e-caregiver',caregiverName:'Completed care example',serviceLabel:'General care support',status:'completed',date:'2026-01-01',time:'10:00',createdAt:new Date()});await page.reload();await expect(page.locator('.home-booking-activity')).toContainText('Completed care example');await expect(page.locator('.home-booking-activity')).toContainText('Completed');await page.locator('.home-booking-row').click();await expect(page).toHaveURL(/\/user\/bookings\/home-completed/);
});



