const {test,expect}=require('./test.cjs');
const {seed,db}=require('./seed.cjs');
const {seedReviewedVerification}=require('./d1-fixtures.cjs');

test.beforeAll(async()=>{
  await seed();
  for(let i=0;i<26;i++) await db.doc(`vendors/discovery-${i}`).set({name:`Discovery Person ${String(i).padStart(2,'0')}`,location:i===0?'Tansen Town':'Kathmandu',category:i===1?'household':'caregiver',workType:'parttime',shifts:['morning'],servicesOffered:i===1?['catalog_housekeeping']:i===2?[]:['catalog_elderly_care'],isAvailable:true,isApproved:true,verified:i===0,hourlyRate:500,experience:i===0?3:0});
  // Five reviewed records replace the retired legacy verified-boolean shortcut.
  await seedReviewedVerification('discovery-0');
  for(const [id,rating] of [['a',3],['b',5]]) {
    await db.doc('bookings/discovery-'+id).set({caregiverId:'discovery-0',userId:'e2e-customer',status:'completed'});
    await db.doc('reviews/discovery-'+id).set({bookingId:'discovery-'+id,caregiverId:'discovery-0',customerId:'e2e-customer',rating,isVerifiedReview:true,isHidden:false});
  }
});

for(const width of [320,360,375,390,414,430,768,1024,1440]) test(`discovery filters and native service selectors work at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:900}); await page.goto('/browse');
  await page.getByRole('searchbox').fill('Discovery');
  await expect(page.locator('.browse-result-count')).toHaveText('26 matches');
  const mobile=width<=640;
  if(mobile) await page.getByRole('button',{name:/^Filters/}).click();
  const scope=mobile?page.getByRole('dialog',{name:'Caregiver filters'}):page.locator('.browse-filter-panel');
  await scope.getByRole('combobox',{name:'Category',exact:true}).selectOption('caregiver');
  await expect(scope.getByRole('combobox',{name:'Service',exact:true}).locator('option[value="catalog_elderly_care"]')).toHaveCount(1);
  await expect(scope.getByRole('combobox',{name:'Service',exact:true}).locator('option[value="catalog_housekeeping"]')).toHaveCount(0);
  await scope.getByRole('combobox',{name:'Service',exact:true}).selectOption('catalog_elderly_care');
  await scope.getByLabel('Location',{exact:true}).fill('Tansen');
  if(!mobile) await scope.locator('summary').filter({hasText:'More filters'}).click();
  await scope.getByRole('combobox',{name:'Experience',exact:true}).selectOption('2');
  await scope.getByRole('combobox',{name:'Work type',exact:true}).selectOption('parttime');
  await scope.getByRole('combobox',{name:'Verified rating',exact:true}).selectOption('4');
  expect(await scope.getByRole('combobox',{name:'Verified rating',exact:true}).locator('option').allTextContents()).toEqual(['Any verified rating','1.0+ stars','2.0+ stars','3.0+ stars','4.0+ stars','5.0 stars']);
  await scope.getByLabel('Verified by Sewak only',{exact:true}).check();
  await expect(page.locator('.browse-result-count')).toHaveText('1 match');
  if(mobile) await scope.getByRole('button',{name:/^Show /}).click();
  await expect(page.getByRole('heading',{name:'Discovery Person 00',exact:true})).toBeVisible();
  await expect(page.getByText('(2 verified reviews)',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({path:info.outputPath(`discovery-${width}.png`),fullPage:true});
  if(mobile) await page.getByRole('button',{name:/^Filters/}).click();
  await scope.getByRole('combobox',{name:'Verified rating',exact:true}).selectOption('5');
  await expect(page.locator('.browse-result-count')).toHaveText('0 matches');
  await expect(page.getByRole('heading',{name:'No caregivers match this search'})).toBeVisible();
  await scope.getByRole('combobox',{name:'Category',exact:true}).selectOption('household');
  await expect(scope.getByRole('combobox',{name:'Service',exact:true})).toHaveValue('');
  if(mobile) await scope.getByRole('button',{name:'Clear all',exact:true}).click();
  else await page.getByRole('button',{name:'Clear all',exact:true}).click();
  await expect(page.getByRole('searchbox')).toHaveValue('');
  if(!mobile && await scope.locator('details').getAttribute('open')===null) await scope.locator('summary').filter({hasText:'More filters'}).click();
  await expect(scope.getByRole('combobox',{name:'Verified rating',exact:true})).toHaveValue('');
  await expect(scope.getByLabel('Verified by Sewak only',{exact:true})).not.toBeChecked();
});

test('discovery pagination keeps true match count and has no repeated results',async({page})=>{
  await page.goto('/browse'); await page.getByRole('searchbox').fill('Discovery');
  await expect(page.locator('.browse-result-count')).toHaveText('26 matches');
  const names=[];
  for(let pageNumber=0;pageNumber<3;pageNumber++) {
    await expect(page.locator('.browse-caregiver-card')).toHaveCount(pageNumber===2?2:12);
    names.push(...await page.locator('.browse-caregiver-card h3').allTextContents());
    if(pageNumber<2) {const previous=names[names.length-1];await page.getByRole('button',{name:'Next page',exact:true}).click();await expect(page.getByRole('heading',{name:previous,exact:true})).toHaveCount(0);}
  }
  expect(new Set(names).size).toBe(26);
  await expect(page.locator('.browse-result-count')).toHaveText('26 matches');
  await page.getByRole('button',{name:'First page',exact:true}).click();
  await expect(page.locator('.browse-caregiver-card')).toHaveCount(12);
});

async function login(page,role){await page.goto('/auth');await page.getByLabel('Email',{exact:true}).fill(`e2e-${role}@example.test`);await page.getByLabel('Password',{exact:true}).fill('Local-test-only-123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).not.toHaveURL(/\/auth/);}

test('organization owner edits caregiver services and custom city, with save, reload and cancel persistence',async({page})=>{
  await login(page,'org');await page.goto('/organization?tab=caregivers');
  await page.getByRole('button',{name:'View details',exact:true}).first().click();await page.getByRole('button',{name:'Edit worker profile',exact:true}).first().click();
  const editor=page.getByRole('dialog',{name:'Edit caregiver profile'});
  await editor.getByRole('combobox',{name:'City *',exact:true}).selectOption('Other');
  await editor.getByLabel('Enter your city *').fill('Tansen Town');
  await editor.getByLabel('Elderly Care',{exact:true}).check();
  await editor.getByRole('button',{name:'Save profile',exact:true}).click();
  await expect(editor).toHaveCount(0);
  expect((await db.doc('vendors/e2e-caregiver').get()).data()).toMatchObject({location:'Tansen Town',servicesOffered:expect.arrayContaining(['catalog_elderly_care']),organizationId:'e2e-org'});
  await page.reload(); await page.getByRole('button',{name:'View details',exact:true}).first().click();await page.getByRole('button',{name:'Edit worker profile',exact:true}).first().click();
  await expect(editor.getByLabel('Enter your city *')).toHaveValue('Tansen Town');
  await expect(editor.getByLabel('Elderly Care',{exact:true})).toBeChecked();
  await editor.getByRole('combobox',{name:'City *',exact:true}).selectOption('Pokhara');
  await editor.getByRole('button',{name:'Cancel',exact:true}).click();
  expect((await db.doc('vendors/e2e-caregiver').get()).data().location).toBe('Tansen Town');
  await page.goto('/caregivers/e2e-caregiver');await expect(page.getByText('Elderly Care',{exact:true})).toBeVisible();
});

test('pending organization completes onboarding and retains role after logout, login and refresh',async({page})=>{
  await page.goto('/auth?mode=register');
  const email=`onboard-${Date.now()}@example.test`;
  await page.getByLabel('Full name').fill('Onboarding Owner');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill('Local-test-only-123!');
  await page.getByRole('radio',{name:/Organization\/Company/}).check();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByLabel('Organization/Company Name').fill('Onboarding Organization');
  await page.getByRole('combobox',{name:'Organization Type *',exact:true}).selectOption('Other');await page.getByLabel('Specify organization type *').fill('Community Support');await page.getByLabel('Phone Number *').fill('9800000000');await page.getByRole('combobox',{name:'City *',exact:true}).selectOption('Other');
  await page.getByLabel('Enter your city *').fill('Tansen Town');await page.getByLabel('Address *',{exact:true}).fill('Synthetic street 12');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByLabel('Elderly Care',{exact:true}).check();await page.getByRole('button',{name:'Submit application',exact:true}).click();
  await expect(page).toHaveURL(/\/organization\/profile/);await expect(page.getByText('Pending Verification',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Save Profile',exact:true}).click();await expect(page.getByRole('heading',{name:'Approval Pending'})).toBeVisible();
  await page.getByRole('button',{name:/Account menu for/}).click();await page.getByRole('button',{name:/Logout/}).click();
  await page.goto('/auth');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill('Local-test-only-123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Approval Pending'})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'Approval Pending'})).toBeVisible();
  await page.getByRole('button',{name:'Complete or edit organization profile'}).click();await expect(page.getByLabel('Enter your city *')).toHaveValue('Tansen Town');
  await page.getByRole('button',{name:'Change password',exact:true}).click();const passwordDialog=page.getByRole('dialog',{name:'Change Password'});
  await passwordDialog.getByLabel('Current Password',{exact:true}).fill('Local-test-only-123!');await passwordDialog.getByLabel('New Password',{exact:true}).fill('Changed-local-only-456!');await passwordDialog.getByLabel('Confirm New Password',{exact:true}).fill('Changed-local-only-456!');await passwordDialog.getByRole('button',{name:'Change Password',exact:true}).click();
  await expect(page).toHaveURL(/\/auth/);await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill('Changed-local-only-456!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Approval Pending'})).toBeVisible();
});
