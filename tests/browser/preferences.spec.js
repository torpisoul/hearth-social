import { test, expect, Hearth, friend } from './fixtures.js';

test('topic changes apply explicitly and inner-circle membership toggles', async ({page,backend}) => {
  const app=new Hearth(page); await app.signIn(); await app.tab('settings');
  const topic=page.locator('[data-topic]').first(), name=await topic.getAttribute('data-topic');
  const before=backend.tables.hearth_preferences[0].topics.includes(name);
  await topic.click();
  expect(backend.tables.hearth_preferences[0].topics.includes(name)).toBe(before);
  await page.getByRole('button',{name:'Apply',exact:true}).click();
  await expect.poll(()=>backend.tables.hearth_preferences[0].topics.includes(name)).toBe(!before);
  await expect(page.getByRole('button',{name:'Apply',exact:true})).toBeEnabled();
  await page.getByText('Manage this audience',{exact:true}).click();
  await page.locator(`[data-circle="${friend}"]`).click();
  await expect.poll(()=>backend.tables.hearth_circle.length).toBe(1);
});

test('failed preference saves stay visible and can be retried', async ({page,backend}) => {
  const app=new Hearth(page); await app.signIn(); await app.tab('settings');
  await app.choice('#updates','notification_mode','daily');
  backend.fail=c=>c.method==='POST' && c.path.endsWith('/hearth_preferences');
  await page.getByRole('button',{name:'Save my pace'}).click();
  await expect(page.locator('#notice')).toContainText('Test service unavailable');
  await expect(page.getByRole('button',{name:'Save my pace'})).toBeEnabled();
  backend.fail=null;
  await page.getByRole('button',{name:'Save my pace'}).click();
  await expect.poll(()=>backend.tables.hearth_preferences[0].notification_mode).toBe('daily');
});

test('profile photo upload is processed in the browser and can be removed', async ({page,backend}) => {
  const app=new Hearth(page); await app.signIn(); await app.tab('settings');
  const png=await page.locator('.palette-swatches').first().screenshot();
  await page.locator('#profile-photo').setInputFiles({name:'portrait.png',mimeType:'image/png',buffer:png});
  await expect(page.getByRole('button',{name:'Remove picture'})).toBeVisible();
  expect(backend.tables.hearth_profiles[0].avatar).toMatch(/^data:image\//);
  await page.getByRole('button',{name:'Remove picture'}).click();
  await expect(page.getByRole('button',{name:'Remove picture'})).toHaveCount(0);
  expect(backend.tables.hearth_profiles[0].avatar).toBeNull();
});

test('confirmed account deletion calls the API and returns to auth', async ({page,backend}) => {
  const app=new Hearth(page); await app.signIn(); await app.tab('settings');
  await page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await page.getByRole('button',{name:'Permanently delete my account'}).click();
  await expect(page.locator('#auth')).toBeVisible();
  expect(backend.calls.filter(c=>c.path.endsWith('/hearth_delete_account'))).toHaveLength(1);
});

test('notification opt-in, test, failure feedback and opt-out use the current device', async ({page,backend}) => {
  backend.pushPublicKey='test-public-key'; backend.tables.hearth_preferences[0].notification_mode='daily';
  // Permission UI and external push services cannot run deterministically in CI.
  // Only the browser device boundary is replaced; app code and Supabase SDK run.
  await page.addInitScript(()=>{
    let current=null;
    const subscription={endpoint:'https://push.example.test/device',toJSON:()=>({keys:{p256dh:'public-key',auth:'auth-key'}}),unsubscribe:async()=>{current=null;return true;}};
    const registration={pushManager:{getSubscription:async()=>current,subscribe:async()=>{current=subscription;return current;}},getNotifications:async()=>[]};
    Object.defineProperty(window,'Notification',{configurable:true,value:{permission:'default',requestPermission:async()=> 'granted'}});
    Object.defineProperty(window,'PushManager',{configurable:true,value:function(){}});
    Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{register:async()=>registration,ready:Promise.resolve(registration),getRegistration:async()=>registration}});
  });
  const app=new Hearth(page); await app.signIn(); await app.tab('settings');
  await page.getByRole('button',{name:'Enable notifications on this device'}).click();
  await expect.poll(()=>backend.tables.hearth_push_subscriptions.length).toBe(1);
  await page.getByRole('button',{name:'Send me a test notification'}).click();
  await expect(page.getByRole('status').filter({hasText:'Your test is on its way'})).toBeVisible();
  backend.fail=c=>c.path==='/functions/v1/send-push';
  await page.getByRole('button',{name:'Send me a test notification'}).click();
  await expect(page.locator('#notice')).toContainText('Couldn’t send a test');
  backend.fail=null;
  await page.getByRole('button',{name:'Turn off notifications for this device'}).click();
  await expect.poll(()=>backend.tables.hearth_push_subscriptions.length).toBe(0);
  await expect(page.getByRole('status').filter({hasText:'Notifications for this device are off.'})).toBeVisible();
});
