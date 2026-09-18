import { test, expect, Hearth, friend } from './fixtures.js';

test('recovery setup encrypts a waiting note and forgetting this device locks messages', async ({page,backend}) => {
  const app=new Hearth(page); await app.signIn(); await app.tab('parlor');
  const recovery=await page.getByLabel('Your recovery code',{exact:true}).inputValue();
  await page.getByLabel('I’ve saved my recovery code somewhere safe.').check();
  await page.getByRole('button',{name:'Open my conversations'}).click();
  await expect(page.locator('#unlock')).toHaveCount(0);
  await page.locator(`#parlor-kin-list [data-chat="${friend}"]`).click();
  await page.getByLabel('A little note',{exact:true}).fill('Private browser message');
  await page.getByRole('button',{name:'Send encrypted note'}).click();
  await expect(page.locator('.messages')).toContainText('Private browser message');
  expect(backend.tables.hearth_waiting_notes).toHaveLength(1);
  expect(JSON.stringify(backend.tables.hearth_waiting_notes)).not.toContain('Private browser message');
  await app.tab('settings'); await page.locator('[data-action="lock"]').click();
  await app.tab('parlor'); await expect(page.locator('#unlock')).toBeVisible();
  await page.getByLabel('Recovery code',{exact:true}).fill(recovery);
  await page.getByRole('button',{name:'Open my conversations'}).click();
  await expect(page.locator('#unlock')).toHaveCount(0);
});
