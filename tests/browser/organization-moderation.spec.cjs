/* eslint-disable testing-library/prefer-screen-queries -- These are Playwright browser locators. */
const {test} = require('./test.cjs');
const {seed,db} = require('./seed.cjs');

test('organization moderation actions persist, name-confirmed deletion and counts work', async ({page}) => {
  await seed();
  const names = {approve:'Synthetic Approve Care',reject:'Synthetic Reject Care',blacklisted:'Synthetic Blacklisted Care'};
  for (const [key,name] of Object.entries(names)) {
    const uid = 'e2e-moderation-' + key;
    await db.doc('users/'+uid).set({uid,role:'orgadmin',name:'Synthetic owner',isApproved:false,isSuspended:key==='blacklisted',isBlacklisted:key==='blacklisted'});
    await db.doc('organizations/'+uid).set({adminUid:uid,organizationId:uid,organizationName:name,isApproved:false,isSuspended:key==='blacklisted',isBlacklisted:key==='blacklisted'});
  }
  await page.goto('/auth');
  await page.getByLabel('Email',{exact:true}).fill('e2e-admin@example.test');
  await page.getByLabel('Password',{exact:true}).fill('Local-test-only-123!');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.waitForURL(/\/superadmin/);
  const {verifyOrganizationModeration} = await import('../../scripts/organization-moderation-browser-qa.mjs');
  await verifyOrganizationModeration(page,{origin:'http://127.0.0.1:4173',names});
});
