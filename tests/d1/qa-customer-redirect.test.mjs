import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('production Auth QA waits for the real completed-customer home route',()=>{
  const qa=readFileSync(new URL('../../scripts/verify-cloudflare-auth.mjs',import.meta.url),'utf8');
  const app=readFileSync(new URL('../../src/App.js',import.meta.url),'utf8');
  assert.match(app,/path="\/user\/home"/,'customer home route must exist');
  assert.match(app,/<Navigate to="\/user\/home" replace \/>/,'signed-in customer redirect must point to home');
  assert.ok(qa.includes("await page.waitForURL(url=>url.pathname==='/user/home')"),'QA must wait for the actual customer redirect');
  assert.ok(!qa.includes("await page.waitForURL(url=>url.pathname==='/user')"),'QA must never require the old discovery route');
  assert.ok(qa.includes("await page.goto(origin+'/user/profile')"),'QA must still verify private profile');
  assert.ok(qa.includes("report.browser={realCookieLogin:true"),'QA must still require the full authenticated browser journey');
});
