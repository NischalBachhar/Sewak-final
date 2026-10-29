const {test,expect}=require('./test.cjs');
const axe=require('axe-core');
for(const width of [375,1440])test(`Gmail access and recovery are accessible at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.route('**/api/auth/options',r=>r.fulfill({json:{google:true,email:true}}));
 await page.goto('/auth');await expect(page.getByRole('button',{name:'Continue with Google'})).toBeVisible();
 await page.evaluate(axe.source);
 let violations=await page.evaluate(async()=> (await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations);expect(violations).toEqual([]);
 await page.getByRole('button',{name:'Forgot password?'}).click();await page.getByLabel('Account email').fill('synthetic@gmail.com');
 let sent;await page.route('**/api/auth/forgot-password',async r=>{sent=r.request().postDataJSON();await r.fulfill({json:{message:'If this address has an eligible Sewak account, a password reset link will arrive shortly.'}});});
 await page.getByRole('button',{name:'Send reset link'}).click();await expect(page.getByRole('status')).toContainText('If this address has an eligible');expect(sent).toEqual({email:'synthetic@gmail.com'});
 violations=await page.evaluate(async()=> (await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations);expect(violations).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('email link stays out of the URL and verification waits for explicit confirmation',async({page})=>{
 let calls=0;await page.route('**/api/auth/verify-email',async r=>{calls++;expect(r.request().postDataJSON()).toEqual({token:'synthetic-link'});await r.fulfill({json:{verified:true}});});
 await page.goto('/account/email?mode=verify#token=synthetic-link');await expect(page.getByRole('heading',{name:'Verify your email'})).toBeVisible();expect(new URL(page.url()).hash).toBe('');expect(calls).toBe(0);
 await page.getByRole('button',{name:'Verify email'}).click();await expect(page.getByRole('status')).toContainText('Your email is verified');expect(calls).toBe(1);
});
test('password reset validates confirmation and offers sign-in after success',async({page})=>{
 await page.route('**/api/auth/reset-password',r=>r.fulfill({json:{changed:true,signedOut:true}}));await page.goto('/account/email?mode=reset#token=synthetic-link');
 await page.getByLabel('New password',{exact:true}).fill('Synthetic-new-password-123!');await page.getByLabel('Confirm new password').fill('Different-password-123!');await page.getByRole('button',{name:'Save new password'}).click();await expect(page.getByRole('alert')).toContainText('Passwords must match');
 await page.getByLabel('Confirm new password').fill('Synthetic-new-password-123!');await page.getByRole('button',{name:'Save new password'}).click();await expect(page.getByRole('status')).toContainText('previous sessions have been signed out');await expect(page.getByRole('link',{name:'Back to sign in'})).toHaveAttribute('href','/auth');
});
test('unconfigured email service shows an honest retry message',async({page})=>{
 await page.goto('/auth');await page.getByRole('button',{name:'Forgot password?'}).click();await page.getByLabel('Account email').fill('synthetic@gmail.com');await page.getByRole('button',{name:'Send reset link'}).click();await expect(page.getByRole('alert')).toContainText('temporarily unavailable');await expect(page.getByRole('button',{name:'Send reset link'})).toBeEnabled();
});
