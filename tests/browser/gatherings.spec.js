import { test, expect, Hearth } from './fixtures.js';

test('create a solo plan, edit, RSVP, share a guest note and cancel', async ({page,backend}) => {
  const app=new Hearth(page); await app.signIn(); await app.tab('gatherings');
  await page.locator('[data-action="toggle-event"]').click();
  await page.locator('#event [name="title"]').fill('Garden tea');
  await page.locator('#event [name="place"]').fill('My garden');
  await page.locator('[data-action="choose-event-time"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Confirm dates'}).click();
  await page.getByRole('button',{name:'Share the plan'}).click();
  await page.locator('[data-action="confirm-solo"]').click();
  await expect(page.getByRole('heading',{name:'Garden tea',exact:true})).toBeVisible();
  expect(backend.tables.hearth_events).toHaveLength(1);
  await page.getByRole('button',{name:'Edit this plan'}).click();
  await page.locator('#event [name="title"]').fill('Evening tea');
  await page.getByRole('button',{name:'Save this plan'}).click();
  await expect(page.getByRole('heading',{name:'Evening tea',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'I’d like to come'}).click();
  await expect(page.getByRole('button',{name:'I can’t make it now'})).toBeVisible();
  await page.getByRole('button',{name:'I can’t make it now'}).click();
  await expect(page.getByRole('button',{name:'I’d like to come'})).toBeVisible();
  await page.getByRole('button',{name:'Message all',exact:true}).click();
  await page.getByLabel('Your note',{exact:true}).fill('Bring a mug');
  await page.getByRole('button',{name:'Share with guests'}).click();
  await expect.poll(()=>backend.tables.hearth_statuses.length).toBe(1);
  expect(backend.tables.hearth_statuses[0]).toMatchObject({audience:'Gathering',content:'Evening tea\n\nBring a mug'});
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Cancel this plan'}).click();
  await expect(page.getByRole('heading',{name:'Evening tea',exact:true})).toHaveCount(0);
});

for(const hour of [10,22]) test(`calendar validates explicit dates with a ${hour}:30 starting clock`, async ({page,backend}) => {
  await page.clock.setFixedTime(new Date(2026,8,24,hour,30));
  const app=new Hearth(page); await app.signIn(); await app.tab('gatherings');
  await page.locator('[data-action="toggle-event"]').click();
  await page.locator('[data-action="choose-event-time"]').click();
  // Choose both dates explicitly: late-night defaults can span midnight.
  await page.getByRole('button',{name:'Next month',exact:true}).click();
  const day=page.locator('[data-day]').first();
  const date=await day.getAttribute('data-day');
  await day.click();
  await page.locator('[data-target="end"]').click();
  await page.locator(`[data-day="${date}"]`).click();
  await page.getByLabel('Start time').fill('14:00');
  await page.getByLabel('End time').fill('13:00');
  await page.getByRole('button',{name:'Confirm dates'}).click();
  await expect(page.locator('#event-time-error')).toContainText('Choose an end after the start');
  await page.getByLabel('All day',{exact:true}).check();
  await expect(page.getByLabel('Start time')).toBeHidden();
  await page.getByRole('button',{name:'Next month',exact:true}).click();
  await page.locator('[data-day]').first().click();
  await page.getByRole('button',{name:'Confirm dates'}).click();
  await expect(page.locator('#event-when-summary')).toContainText('All day');
  await page.locator('[data-action="choose-event-time"]').click();
  await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
