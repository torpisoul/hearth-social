import { test, expect, Hearth, friend } from './fixtures.js';

for (const [label,endpoint] of [['Sign in','token'],['Create account','signup']]) {
  test(`${label} clicks submit the entered credentials once`, async ({page,backend}) => {
    const app = new Hearth(page); await app.open(); await app.credentials();
    await expect(page.getByRole('heading',{name:'Welcome home.'})).toBeVisible();
    await expect(page.locator('#auth button[type="submit"]')).toHaveCount(2);
    const request = page.waitForRequest(r=>r.url().includes('/auth/v1/'+endpoint) && r.method()==='POST');
    await page.getByRole('button',{name:label,exact:true}).click();
    expect((await request).postDataJSON()).toMatchObject({email:'friend@example.test',password:'a-test-password-123'});
    await expect(page.locator('#auth')).toHaveCount(0);
    expect(backend.calls.filter(c=>c.path==='/auth/v1/'+endpoint)).toHaveLength(1);
  });
}
test('both auth buttons use the default light surface', async ({page,backend}) => {
  await new Hearth(page).open();
  const buttons=page.locator('#auth button[type="submit"]');
  await expect(buttons).toHaveCount(2);
  const paper=await page.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--paper').trim());
  for(const button of await buttons.all()) {
    expect(await button.evaluate((el,colour)=>{
      const sample=document.createElement('span'); sample.style.backgroundColor=colour; document.body.append(sample);
      const match=getComputedStyle(el).backgroundColor===getComputedStyle(sample).backgroundColor; sample.remove();return match;
    },paper)).toBe(true);
  }
});
test('Enter signs in through native form submission', async ({page,backend}) => {
  const app=new Hearth(page); await app.open(); await app.credentials();
  await page.getByLabel('Password',{exact:true}).press('Enter');
  await expect(page.locator('#auth')).toHaveCount(0);
  expect(backend.calls.filter(c=>c.path==='/auth/v1/token')).toHaveLength(1);
});
test('invite signup default never overrides a deliberate Sign in click', async ({page,backend}) => {
  const app=new Hearth(page); await page.goto('live.html?ref='+friend); await app.credentials();
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.locator('#auth')).toHaveCount(0);
  expect(backend.calls.filter(c=>c.path==='/auth/v1/token')).toHaveLength(1);
  expect(backend.calls.filter(c=>c.path==='/auth/v1/signup')).toHaveLength(0);
});
test('failed signup retains inputs and can retry as sign in', async ({page,backend}) => {
  backend.fail=c=>c.path==='/auth/v1/signup';
  const app=new Hearth(page); await app.open(); await app.credentials();
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.locator('#notice')).toContainText('Test service unavailable');
  await expect(page.getByLabel('Password',{exact:true})).toHaveValue('a-test-password-123');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.locator('#auth')).toHaveCount(0);
});
test('invalid input cannot submit either auth action', async ({page,backend}) => {
  await new Hearth(page).open();
  for (const name of ['Sign in','Create account']) {
    await page.getByRole('button',{name,exact:true}).click();
    await expect(page.locator('#auth input:invalid').first()).toBeVisible();
  }
  expect(backend.calls).toEqual([]);
});
test('failed sign in retains credentials and allows a create-account retry', async ({page,backend}) => {
  backend.fail=c=>c.path==='/auth/v1/token';
  const app=new Hearth(page); await app.open(); await app.credentials();
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.locator('#notice')).toContainText('Test service unavailable');
  await expect(page.getByLabel('Email',{exact:true})).toHaveValue('friend@example.test');
  await expect(page.getByLabel('Password',{exact:true})).toHaveValue('a-test-password-123');
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.locator('#auth')).toHaveCount(0);
});
test('signup requiring email confirmation stays signed out and explains the next step', async ({page,backend}) => {
  backend.confirmEmail=true;
  const app=new Hearth(page); await app.open(); await app.credentials();
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.locator('#notice')).toContainText('Check your email');
  await expect(page.locator('#auth')).toBeVisible();
});
test('password reset sends the email and repository-path redirect', async ({page,backend}) => {
  await new Hearth(page).open();
  await page.getByRole('button',{name:'Forgot password?'}).click();
  await page.getByLabel('Email',{exact:true}).fill('friend@example.test');
  await page.getByRole('button',{name:'Send reset link'}).click();
  await expect(page.locator('#notice')).toContainText('check your email');
  const call=backend.calls.find(c=>c.path==='/auth/v1/recover');
  expect(call.body.email).toBe('friend@example.test');
  expect(call.query.get('redirect_to')).toBe(new URL('live.html',page.url()).href);
});
