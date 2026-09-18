import { test, expect, Hearth, me, friend } from './fixtures.js';

test('incoming connection can be accepted, blocked and unblocked', async ({page,backend}) => {
  backend.tables.hearth_connections=[{requester:friend,recipient:me,accepted:false}];
  const app=new Hearth(page); await app.signIn(); await app.tab('kin');
  await page.locator(`[data-kin-expand="${friend}"]`).click();
  await page.locator(`[data-accept="${friend}"]`).click();
  await expect.poll(()=>backend.tables.hearth_connections[0].accepted).toBe(true);
  await page.locator(`[data-block="${friend}"]`).click();
  await expect.poll(()=>backend.tables.hearth_blocks.length).toBe(1);
  await expect.poll(()=>backend.tables.hearth_connections.length).toBe(0);
  await app.tab('settings'); await page.getByRole('button',{name:'Unblock',exact:true}).click();
  await expect(page.getByText('No blocked accounts.',{exact:true})).toBeVisible();
});

test('groups add and remove members and can be deleted without disconnecting kin', async ({page,backend}) => {
  backend.tables.hearth_kin_groups=[{id:'group',owner:me,name:'Garden friends'}];
  const app=new Hearth(page); await app.signIn(); await app.tab('kin');
  await page.locator('[data-growth="group"]').click();
  await page.getByText('Edit people',{exact:true}).click();
  await page.locator(`[data-growth="member"][data-id="${friend}"]`).click();
  await expect.poll(()=>backend.tables.hearth_kin_group_members.length).toBe(1);
  await page.locator(`[data-growth="member"][data-id="${friend}"]`).click();
  await expect.poll(()=>backend.tables.hearth_kin_group_members.length).toBe(0);
  page.once('dialog',d=>d.accept());
  await page.getByRole('button',{name:'Remove group Garden friends'}).click();
  await expect(page.locator('#kin-group-list')).toContainText('No groups here yet');
  expect(backend.tables.hearth_connections).toHaveLength(1);
});

for(const agree of [true,false]) test(`introduction can be ${agree?'accepted':'declined'} explicitly`, async ({page,backend}) => {
  backend.introductions=[{id:'intro',introducer:friend,introducer_name:'Alex',person:'33333333-3333-4333-8333-333333333333',person_name:'Sam',agreed:false}];
  const app=new Hearth(page); await app.signIn(); await app.tab('parlor');
  await page.locator(`[data-growth="${agree?'agree':'decline'}"]`).click();
  await expect.poll(()=>backend.calls.some(c=>c.path.endsWith('/hearth_answer_introduction')&&c.body.agree===agree)).toBe(true);
  await expect(page.locator('[data-growth="agree"]')).toHaveCount(0);
});

test('outgoing connection reminder and cancellation', async ({page,backend}) => {
  backend.tables.hearth_connections[0].accepted=false;
  const app=new Hearth(page); await app.signIn(); await app.tab('kin');
  await page.locator(`[data-kin-expand="${friend}"]`).click();
  await page.getByRole('button',{name:'Send a gentle reminder'}).click();
  await expect(page.locator('#notice')).toContainText('gentle reminder is waiting');
  await page.getByRole('button',{name:'Cancel request'}).click();
  await expect.poll(()=>backend.tables.hearth_connections.length).toBe(0);
});
