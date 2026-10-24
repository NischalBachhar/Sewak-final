async function chooseRegistrationRole(page, name) {
  const change = page.getByRole('button', {name:'Change account type'});
  if (await change.isVisible()) await change.click();
  await page.getByRole('radio', {name}).check();
  await page.getByRole('button', {name:'Continue',exact:true}).click();
}
module.exports={chooseRegistrationRole};
