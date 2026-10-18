const {test,expect}=require('./test.cjs');
const {seed,db}=require('./seed.cjs');
test.beforeAll(seed);
async function signIn(page,role){await page.goto('/auth');await page.getByLabel('Email',{exact:true}).fill(`e2e-${role}@example.test`);await page.getByLabel('Password',{exact:true}).fill('Local-test-only-123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).not.toHaveURL(/\/auth/);}
async function overflow(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);}
for(const width of [320,390,768,1440])test(`verification caregiver and admin layouts at ${width}px`,async({browser})=>{
  for(const role of ['caregiver','admin']){
    const context=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await signIn(page,role);await page.goto(role==='caregiver'?'/caregiver?tab=verification':'/superadmin/verification');
    await expect(page.getByRole('heading',{name:role==='caregiver'?'My Verification':'Verification Management',exact:true})).toBeVisible();await overflow(page);
    if(role==='caregiver'){
      await expect(page.locator('.verification-card')).toHaveCount(5);await page.locator('.verification-card').filter({hasText:'References verification'}).getByRole('button').click();
      await expect(page.getByRole('group',{name:'Professional reference 1'})).toBeVisible();await page.getByRole('button',{name:'Add reference',exact:true}).click();await expect(page.getByRole('group',{name:'Professional reference 3'})).toBeVisible();await overflow(page);
    }else{await expect(page.getByLabel('Status',{exact:true})).toBeVisible();await page.getByLabel('Status',{exact:true}).selectOption('expiring');await overflow(page);}
    await page.screenshot({path:`.local-tools/verification-${role}-${width}.png`,fullPage:true});expect(errors).toEqual([]);await context.close();
  }
});
test('verification real browser compression, encrypted upload, review, rejection and resubmission',async({browser})=>{
  const caregiverContext=await browser.newContext(),caregiver=await caregiverContext.newPage();await signIn(caregiver,'caregiver');await caregiver.goto('/caregiver?tab=verification');
  const identity=caregiver.locator('.verification-card').filter({hasText:'Identity verification'});await identity.getByRole('button',{name:'Start verification'}).click();
  const form=caregiver.getByRole('form',{name:'Identity verification submission'});await form.getByLabel('Legal name').fill('Synthetic Private Name');await form.getByLabel('Document number').fill('SYNTHETIC-PRIVATE-ID');
  // Generate an original document locally in Chromium; compression uses real
  // createImageBitmap/canvas encoders and the production metadata stripper.
  const bytes=await caregiver.evaluate(async()=>{const canvas=document.createElement('canvas');canvas.width=2400;canvas.height=1600;const c=canvas.getContext('2d');c.fillStyle='#faf7ed';c.fillRect(0,0,2400,1600);c.fillStyle='#182a24';c.font='70px serif';for(let y=150;y<1500;y+=130)c.fillText('SYNTHETIC TEST DOCUMENT - NOT A REAL ID',100,y);return Array.from(new Uint8Array(await (await new Promise(r=>canvas.toBlob(r,'image/png'))).arrayBuffer()));});
  await form.locator('input[type=file]').setInputFiles({name:'synthetic-document.png',mimeType:'image/png',buffer:Buffer.from(bytes)});await expect(form.getByAltText('Compressed document preview 1')).toBeVisible();await expect(form.getByText(/Original .* KB → upload/)).toBeVisible();
  await form.getByLabel(/I opened the final previews/).check();await form.getByLabel(/I consent to manual review/).check();
  const upload=caregiver.waitForResponse(r=>r.url().includes('/api/verification/evidence?kind=identity')&&r.request().method()==='PUT');await form.getByRole('button',{name:'Submit for review',exact:true}).click();const uploaded=await upload;expect(uploaded.status()).toBe(200);const saved=await uploaded.json();expect(saved.size).toBeLessThanOrEqual(500000);
  await expect(identity.getByText('Pending',{exact:true})).toBeVisible();await expect(caregiver.getByText('1 / 5')).toHaveCount(0);
  const adminContext=await browser.newContext({viewport:{width:390,height:900}}),admin=await adminContext.newPage();await signIn(admin,'admin');await admin.goto('/superadmin/verification');await admin.locator('.verification-queue article').filter({hasText:'Identity verification'}).getByRole('button',{name:'Review details'}).click();
  const panel=admin.getByRole('region',{name:'Review verification'});await expect(panel.getByText('SYNTHETIC-PRIVATE-ID',{exact:true})).toBeVisible();await panel.getByRole('button',{name:'Preview private document'}).click();await expect(panel.getByAltText(/Private verification evidence/)).toBeVisible();await overflow(admin);await admin.screenshot({path:'.local-tools/verification-review-390.png',fullPage:true});
  await panel.getByLabel('Review decision',{exact:true}).selectOption('under_review');await panel.getByLabel(/I confirm this decision/).check();await panel.getByRole('button',{name:'Record decision'}).click();await expect(panel).toHaveCount(0);
  await admin.getByLabel('Status',{exact:true}).selectOption('under_review');await admin.getByRole('button',{name:'Review details'}).click();await panel.getByLabel('Review decision',{exact:true}).selectOption('rejected');await panel.getByLabel(/Response to caregiver/).fill('Please provide a complete back-side photo.');await panel.getByLabel(/I confirm this decision/).check();await panel.getByRole('button',{name:'Record decision'}).click();await expect(panel).toHaveCount(0);
  await caregiver.reload();await expect(identity.getByText('Rejected',{exact:true})).toBeVisible();await expect(identity.getByText('Please provide a complete back-side photo.')).toBeVisible();await identity.getByRole('button',{name:'Resubmit for review'}).click();await form.locator('input[type=file]').setInputFiles({name:'replacement.png',mimeType:'image/png',buffer:Buffer.from(bytes)});await expect(form.getByAltText('Compressed document preview 1')).toBeVisible();await form.getByLabel(/I opened the final previews/).check();await form.getByLabel(/I consent to manual review/).check();await form.getByRole('button',{name:'Submit for review'}).click();await expect(identity.getByText('Pending',{exact:true})).toBeVisible();
  await admin.getByLabel('Status',{exact:true}).selectOption('pending');await admin.getByRole('button',{name:'Review details'}).click();await panel.getByLabel('Review decision',{exact:true}).selectOption('under_review');await panel.getByLabel(/I confirm this decision/).check();await panel.getByRole('button',{name:'Record decision'}).click();await expect(panel).toHaveCount(0);
  await admin.getByLabel('Status',{exact:true}).selectOption('under_review');await admin.getByRole('button',{name:'Review details'}).click();await panel.getByLabel('Review decision',{exact:true}).selectOption('verified');await panel.getByLabel(/Review outcome/).fill('Synthetic document reviewed in local browser test.');await panel.getByLabel(/I confirm this decision/).check();await panel.getByRole('button',{name:'Record decision'}).click();await expect(panel).toHaveCount(0);
  await caregiver.reload();await expect(identity.getByText('Verified',{exact:true}).first()).toBeVisible();
  const publicResponse=await caregiver.request.get('/api/records/publicCaregivers/e2e-caregiver');const publicData=await publicResponse.json();expect(publicData.items[0].data.identityVerificationStatus).toBe('verified');expect(JSON.stringify(publicData)).not.toContain('SYNTHETIC-PRIVATE-ID');
  await caregiverContext.close();await adminContext.close();
});
test('verification phone form and police portal instructions preserve manual checks',async({page})=>{
  await signIn(page,'caregiver');await page.goto('/caregiver?tab=verification');await page.locator('.verification-card').filter({hasText:'Phone verification'}).getByRole('button').click();const phone=page.getByRole('form',{name:'Phone verification submission'});await expect(phone.getByLabel('Nepal mobile number')).toHaveValue('+9779800000000');await phone.getByLabel(/I consent/).check();await phone.getByRole('button',{name:'Submit for review'}).click();await expect(page.locator('.verification-card').filter({hasText:'Phone verification'}).getByText('Pending',{exact:true})).toBeVisible();
  await page.locator('.verification-card').filter({hasText:'Background check'}).getByRole('button').click();await expect(page.getByRole('link',{name:'Apply for Police Clearance'})).toHaveAttribute('href','https://opcr.nepalpolice.gov.np/');await expect(page.locator('[lang=ne]')).toBeVisible();
  // No off-site request or call is made by this test.
  expect((await db.doc('vendors/e2e-caregiver').get()).data().isApproved).toBe(true);
});
