import {expect} from '@playwright/test';

// Caller supplies only its own synthetic organization names and authenticated page.
export async function verifyOrganizationModeration(page, {origin, names}) {
  await page.goto(origin + '/superadmin/organizations');
  const search = page.getByPlaceholder('Search organizations...');
  await expect(search).toBeVisible();
  const status = page.locator('select').filter({has: page.locator('option[value="deleted"]')});
  const card = name => page.getByRole('heading', {name, exact:true}).locator('..');
  const count = async key => Number((await status.locator(`option[value="${key}"]`).textContent()).match(/\((\d+)\)/)[1]);
  await search.fill(names.approve);
  await expect(card(names.approve)).toBeVisible();
  const baseline = {};
  for (const key of ['all','pending','approved','rejected','restricted','deleted']) baseline[key] = await count(key);
  const counts = async changes => {
    for (const [key, delta] of Object.entries(changes)) {
      await expect(status.locator(`option[value="${key}"]`)).toHaveText(new RegExp(`\\(${baseline[key] + delta}\\)$`));
    }
  };
  const reviewed = async (name, label) => {
    await expect(card(name).locator('.org-review-badge')).toHaveText(label);
    await expect(card(name).getByRole('button', {name:'Approve',exact:true})).toHaveCount(0);
    await expect(card(name).getByRole('button', {name:'Reject',exact:true})).toHaveCount(0);
  };
  await card(names.approve).getByRole('button',{name:'Approve',exact:true}).click();
  await reviewed(names.approve,'Approved');
  await counts({pending:-1,approved:1,all:0});
  await page.reload();
  await search.fill(names.approve);
  await reviewed(names.approve,'Approved');
  await search.fill(names.reject);
  page.once('dialog', dialog => dialog.accept('Synthetic QA rejection'));
  await card(names.reject).getByRole('button',{name:'Reject',exact:true}).click();
  await reviewed(names.reject,'Rejected');
  await counts({pending:-2,approved:1,rejected:1,all:0});
  await page.reload();
  await search.fill(names.reject);
  await reviewed(names.reject,'Rejected');
  for (const [index, name] of [names.reject,names.blacklisted].entries()) {
    await search.fill(name);
    await card(name).getByRole('button',{name:'Delete organization',exact:true}).click();
    const dialog = page.getByRole('dialog');
    const confirm = dialog.getByRole('button',{name:'Confirm deletion',exact:true});
    await expect(confirm).toBeDisabled();
    await dialog.getByRole('textbox').fill('Wrong name');
    await expect(confirm).toBeDisabled();
    await dialog.getByRole('textbox').fill(name);
    await confirm.click();
    await expect(dialog).toHaveCount(0);
    await expect(card(name)).toHaveCount(0);
    await counts({all:-(index+1),deleted:index+1,rejected:0,restricted:-index});
    await page.reload();
    await search.fill(name);
    await expect(card(name)).toHaveCount(0);
    await status.selectOption('deleted');
    await reviewed(name,'Deleted');
    await expect(card(name).getByRole('button',{name:'Delete organization',exact:true})).toHaveCount(0);
    await status.selectOption('all');
  }
  await page.goto(origin + '/superadmin/analytics');
  await expect(page.getByText('Total Organizations',{exact:true}).locator('..').getByRole('heading')).toHaveText(String(baseline.all-2));
  await expect(page.getByText('Approved Organizations',{exact:true}).locator('..').getByRole('heading')).toHaveText(String(baseline.approved+1));
  return {approvalAndRejectionPersist:true,reviewButtonsRemoved:true,nameConfirmedDeletion:true,rejectedAndBlacklistedDeletion:true,countsCorrect:true,analyticsCountsCorrect:true,reloadVerified:true};
}
