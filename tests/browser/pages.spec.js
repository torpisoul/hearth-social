import { test, expect, Hearth, me, friend } from './fixtures.js';

test('new account completes all onboarding steps through real controls', async ({page,backend}) => {
  backend.tables.hearth_profiles=[]; backend.user.user_metadata={};
  const app=new Hearth(page); await app.open(); await app.credentials();
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.getByLabel('What should we call you?')).toHaveAccessibleDescription(/name your people know/);
  await page.getByLabel('What should we call you?').fill('Robin');
  await page.getByRole('button',{name:'Settle in'}).click();
  await expect(page.getByRole('heading',{name:'A familiar face'})).toBeVisible();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:/Shore/}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.locator('[data-topic]').first().click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByLabel('Daily check-in time')).toBeHidden();
  await app.choice('#updates','notification_mode','daily');
  await page.getByLabel('Daily check-in time').fill('19:30');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Make yourself at home'}).click();
  await expect(page.locator('.onboarding')).toHaveCount(0);
  expect(backend.user.user_metadata.hearth_onboarding.complete).toBe(true);
  expect(backend.tables.hearth_preferences[0]).toMatchObject({notification_mode:'daily',notification_time:'19:30'});
});

test('every main page is reachable through desktop or mobile navigation', async ({page,backend}) => {
  const app=new Hearth(page); await app.signIn();
  for (const [id,heading] of [['pulse','A quieter kind of connected.'],['parlor','Who shall we catch up with?'],['kin','Invite your people.'],['gatherings','Make a little plan'],['settings','What colours feel like home?']]) {
    await app.tab(id);
    if(id==='gatherings') await expect(page.locator('[data-action="toggle-event"]')).toBeVisible();
    else await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();
  }
});

test('living room publishes and deletes a moment with the selected audience', async ({page,backend}) => {
  const app=new Hearth(page); await app.signIn(); await app.tab('pulse');
  await page.locator('[data-action="toggle-moment"]').click();
  await page.getByLabel('A little moment from your day',{exact:true}).fill('A browser-tested moment');
  await app.choice('#status','audience','All kin');
  await page.getByRole('button',{name:'Share moment',exact:true}).click();
  await expect(page.locator('.post')).toContainText('A browser-tested moment');
  expect(backend.tables.hearth_statuses[0].audience).toBe('All kin');
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('[data-delete]').click();
  await expect(page.locator('.post')).toHaveCount(0);
  expect(backend.tables.hearth_statuses).toEqual([]);
});

test('hide and restore affects only this browser, with private reply navigation', async ({page,backend}) => {
  backend.tables.hearth_statuses=[{id:'moment',author:friend,content:'Alex made bread',created_at:new Date().toISOString(),topic:'Everyday life',audience:'All kin'}];
  const app=new Hearth(page); await app.signIn(); await app.tab('pulse');
  await page.getByRole('button',{name:'Hide',exact:true}).click();
  await expect(page.locator('.post')).toHaveCount(0);
  await app.tab('settings'); await page.getByRole('button',{name:'Restore',exact:true}).click();
  await app.tab('pulse'); await expect(page.locator('.post')).toContainText('Alex made bread');
  await page.getByRole('button',{name:'Reply privately'}).click();
  await expect(page.getByRole('heading',{name:'A conversation with Alex.'})).toBeVisible();
});

test('preferences save, survive reload, send feedback and sign out', async ({page,backend}) => {
  const app=new Hearth(page); await app.signIn(); await app.tab('settings');
  await page.getByRole('button',{name:/Shore/}).click();
  await page.locator('#rename input').fill('Robin renamed');
  await page.getByRole('button',{name:'Save name',exact:true}).click();
  await expect.poll(()=>backend.tables.hearth_profiles[0].name).toBe('Robin renamed');
  await expect(page.getByLabel('Daily check-in time')).toBeHidden();
  await app.choice('#updates','notification_mode','daily');
  await page.getByLabel('Daily check-in time').fill('18:45');
  await page.getByRole('button',{name:'Save my pace',exact:true}).click();
  await expect.poll(()=>backend.tables.hearth_preferences[0].notification_time).toBe('18:45');
  await page.reload(); await app.tab('settings');
  await expect(page.locator('html')).toHaveAttribute('data-palette','shore');
  await expect(page.getByLabel('Daily check-in time')).toHaveValue('18:45');
  await page.getByLabel('Leave a little note').fill('Feedback from a real browser');
  await page.locator('#feedback button').click();
  await expect(page.locator('#feedback-result')).toContainText('Your note’s been sent');
  expect(backend.tables.hearth_feedback[0].content).toBe('Feedback from a real browser');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
});

test('kin search, friend-code validation, request and private group creation', async ({page,backend}) => {
  const app=new Hearth(page); await app.signIn(); await app.tab('kin');
  await page.locator('#kin-card-search').fill('Nobody');
  await expect(page.locator('#kin-card-list')).toContainText('No kin found');
  await page.locator('#kin-card-search').fill('Alex');
  await expect(page.locator('#kin-card-list')).toContainText('Alex');
  await page.getByLabel('Their friend code').fill('bad-code');
  await page.getByRole('button',{name:'Send connection request'}).click();
  await expect(page.locator('#notice')).toContainText('Paste the full friend code');
  const person='33333333-3333-4333-8333-333333333333';
  await page.getByLabel('Their friend code').fill(person);
  await page.getByRole('button',{name:'Send connection request'}).click();
  await expect.poll(()=>backend.calls.some(c=>c.path.endsWith('/hearth_request_friend')&&c.body.person===person)).toBe(true);
  await page.locator('[data-growth="new-group"]').click();
  await page.getByLabel('New group name').fill('Garden friends');
  await page.getByRole('button',{name:'Create group',exact:true}).click();
  await expect(page.locator('#kin-group-list')).toContainText('Garden friends');
});

test('gatherings composer validates date selection before sending', async ({page,backend}) => {
  const app=new Hearth(page); await app.signIn(); await app.tab('gatherings');
  await page.locator('[data-action="toggle-event"]').click();
  await page.locator('#event [name="title"]').fill('Tea together');
  await page.locator('#event [name="place"]').fill('The garden');
  await page.getByRole('button',{name:'Share the plan'}).click();
  await expect(page.locator('#notice')).toContainText('Choose and confirm');
  expect(backend.calls.some(c=>c.path.endsWith('/hearth_save_event'))).toBe(false);
});

test('data export downloads JSON and account deletion requires explicit confirmation', async ({page,backend}) => {
  const app=new Hearth(page); await app.signIn(); await app.tab('settings');
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download my data'}).click();
  const artifact=await download;
  expect(artifact.suggestedFilename()).toBe('hearth-data.json');
  const stream=await artifact.createReadStream(); let json=''; for await(const chunk of stream)json+=chunk;
  expect(JSON.parse(json).profile.id).toBe(me);
  await page.getByRole('button',{name:'Permanently delete my account'}).click();
  expect(backend.calls.some(c=>c.path.endsWith('/hearth_delete_account'))).toBe(false);
});
