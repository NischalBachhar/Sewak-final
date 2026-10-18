const {test,expect}=require('./test.cjs');
const {seed}=require('./seed.cjs');
test.beforeAll(seed);

for(const [role,route,heading] of [
 ['customer','/user/home',/Find & Book Care/],
 ['caregiver','/caregiver',/Test caregiver|Caregiver|Jobs/i],
 ['org','/organization/dashboard',/Your workspace overview/],
 ['admin','/superadmin',/Overview|Dashboard/i],
]) test(`auth reliability: ${role} login, refresh, logout and protected denial`,async({page,context})=>{
 await page.goto('/auth');
 await page.getByLabel('Email',{exact:true}).fill(`e2e-${role}@example.test`);
 await page.getByLabel('Password',{exact:true}).fill('Local-test-only-123!');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page).toHaveURL(new RegExp(route.replaceAll('/','\\/')+'$'));
 await expect(page.getByRole('heading',{name:heading}).first()).toBeVisible();
 await page.reload();await expect(page.getByRole('button',{name:/Account menu for/})).toBeVisible();
 const cookies=await context.cookies();const session=cookies.find(c=>c.name==='__Host-sewak_session');
 expect(session.httpOnly).toBe(true);expect(session.secure).toBe(true);expect(session.sameSite).toBe('Lax');
 const me=await page.evaluate(async()=> (await fetch('/api/auth/me')).json());expect(me.user.uid).toBe(`e2e-${role}`);
 // Hold logout to reproduce the old premature navigation/error flash.
 let release;const waiting=new Promise(resolve=>{release=resolve;});
 await page.route('**/api/auth/logout',async r=>{await waiting;await r.continue();});
 await page.getByRole('button',{name:/Account menu for/}).click();
 const sent=page.waitForRequest('**/api/auth/logout');
 await page.getByRole('button',{name:/Sign out|Log out|Logout/i}).click();await sent;
 expect(new URL(page.url()).pathname).toBe(route);
 await expect(page.getByRole('heading',{name:'Page not found'})).toHaveCount(0);
 release();await expect(page).toHaveURL(/\/browse$/);
 await expect(page.getByRole('heading',{name:/Care that feels/})).toBeVisible();
 const revoked=await context.request.get('/api/auth/me',{headers:{Cookie:`${session.name}=${session.value}`}});expect(revoked.status()).toBe(401);
 await page.goto(route);await expect(page).toHaveURL(/\/auth$/);await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
});

test('auth reliability: public queries accept stale cookies without exposing private profiles',async({context,page})=>{
 const stale='swk_'+'x'.repeat(43);
 await context.addCookies([{name:'__Host-sewak_session',value:stale,url:'https://127.0.0.1:4173/',secure:true,httpOnly:true,sameSite:'Lax'}]);
 const publicResult=await context.request.post('/api/query',{headers:{Cookie:'__Host-sewak_session='+stale},data:{path:'publicCaregivers'}});
 expect(publicResult.status()).toBe(200);const data=await publicResult.json();expect(data.items.length).toBeGreaterThan(0);expect(JSON.stringify(data)).not.toContain('e2e-caregiver@example.test');
 await page.goto('/browse');await expect(page.getByRole('heading',{name:/Care that feels/})).toBeVisible();
 await page.goto('/user/home');await expect(page).toHaveURL(/\/auth$/);
});

test('auth reliability: failed logout keeps the authenticated account and offers retry',async({page})=>{
 await page.goto('/auth');await page.getByLabel('Email',{exact:true}).fill('e2e-customer@example.test');await page.getByLabel('Password',{exact:true}).fill('Local-test-only-123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page).toHaveURL(/\/user\/home$/);
 await page.route('**/api/auth/logout',r=>r.abort('internetdisconnected'));
 await page.getByRole('button',{name:/Account menu for/}).click();await page.getByRole('button',{name:/Logout/}).click();
 await expect(page.getByRole('alert')).toHaveText("We couldn't sign you out. Please try again.");
 await expect(page).toHaveURL(/\/user\/home$/);expect((await page.evaluate(async()=> (await fetch('/api/auth/me')).json())).user.uid).toBe('e2e-customer');
});
