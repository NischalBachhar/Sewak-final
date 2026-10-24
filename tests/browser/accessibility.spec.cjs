const {test,expect}=require('./test.cjs');
const {seed}=require('./seed.cjs');
const axe=require('axe-core');
test.beforeAll(seed);
for(const [label,route,role,ready] of [
  ['home','/',null,'.home-service'],
  ['discovery','/browse',null,'.care-listing-card'],
  ['login','/auth',null,'.auth-card'],
  ['signup','/auth?mode=register',null,'.auth-card'],
  ['customer','/user/home','customer','.home-discovery'],
  ['customer profile','/user/profile','customer','.customer-detail-shell form'],
  ['customer discovery','/user','customer','.browse-list'],
  ['booking history','/user/mybookings','customer','.customer-bookings'],
  ['booking','/user/book/e2e-caregiver','customer','.booking-form-panel'],
  ['profile','/user/caregivers/e2e-caregiver','customer','.caregiver-profile-hero'],
  ['caregiver','/caregiver?tab=home','caregiver','.sewak-workspace'],
  ['caregiver jobs','/caregiver/jobs','caregiver','.sewak-workspace'],
  ['caregiver inbox','/caregiver/inbox','caregiver','.care-inbox-page'],
  ['organization','/organization?tab=overview','org','.org-metric-grid'],
  ['organization team','/organization?tab=caregivers','org','.org-dashboard-header'],
  ['organization bookings','/organization?tab=bookings','org','.org-dashboard-header'],
  ['admin','/superadmin/overview','admin','.sewak-workspace'],
  ['admin caregivers','/superadmin/caregivers','admin','.sewak-workspace'],
  ['admin organizations','/superadmin/organizations','admin','.sewak-workspace'],
  ['admin reports','/superadmin/blacklist','admin','.sewak-workspace'],
  ['caregiver verification','/caregiver?tab=verification','caregiver','.verification-card'],
  ['admin verification','/superadmin/verification','admin','.verification-filters'],
]) for(const width of [375,1366]) test(`Accessibility: ${label} at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:1000}); await page.emulateMedia({reducedMotion:'reduce'});
  if(role){
    await page.goto('/auth'); await page.getByLabel('Email',{exact:true}).fill(`e2e-${role}@example.test`);
    await page.getByLabel('Password',{exact:true}).fill('Local-test-only-123!');
    await page.getByRole('button',{name:'Sign in',exact:true}).click(); await expect(page).not.toHaveURL(/\/auth/);
  }
  await page.goto(route); await expect(page.locator(ready).first()).toBeVisible();
  await page.evaluate(axe.source);
  const results=await page.evaluate(async()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));
  await info.attach('axe-results',{body:JSON.stringify(results.violations,null,2),contentType:'application/json'});
  expect(results.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))).toEqual([]);
});
