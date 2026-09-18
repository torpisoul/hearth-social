import { test, expect } from '@playwright/test';

// Read-only checks of the configured backend using Playwright's native HTTP
// client. No account creation, credentials, cookies or production writes.
test('configured Auth is reachable and supports email login', async ({request}) => {
  const configResponse=await request.get('public-config.json');
  expect(configResponse.ok()).toBe(true);
  const config=await configResponse.json();
  const response=await request.get(`${config.supabaseUrl}/auth/v1/settings`,{headers:{apikey:config.supabasePublishableKey}});
  expect(response.ok()).toBe(true);
  expect((await response.json()).external.email).toBe(true);
});

test('anonymous API requests cannot read profiles', async ({request}) => {
  const config=await (await request.get('public-config.json')).json();
  const response=await request.get(`${config.supabaseUrl}/rest/v1/hearth_profiles?select=id&limit=1`,{headers:{apikey:config.supabasePublishableKey}});
  expect([200,401,403]).toContain(response.status());
  if(response.ok()) expect(await response.json()).toEqual([]);
});
