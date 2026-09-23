import { test, expect } from '@playwright/test';

// Native Playwright APIRequestContext checks the actual served build, including
// post-deployment runs. These requests are not intercepted by browser fixtures.
test('published entrypoints and their local assets are available', async ({request}) => {
  for (const entry of ['index.html','live.html','login.html','onboarding.html','parlor.html','profile.html','reset-password.html','notice-board.html']) {
    const response=await request.get(entry); expect(response.ok(),entry).toBe(true);
    const html=await response.text(); expect(html).toContain('<html');
    expect(html).not.toMatch(/demo\.html|fictional demo/i);
    for (const [,url] of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)) {
      const asset=await request.get(url); expect(asset.ok(),`${entry}: ${url}`).toBe(true);
    }
  }
});
test('public configuration and PWA assets are well formed', async ({request}) => {
  const build=await request.get('build-info.json'); expect(build.ok()).toBe(true);
  if(process.env.GITHUB_SHA) expect((await build.json()).commit).toBe(process.env.GITHUB_SHA);
  const config=await request.get('public-config.json'); expect(config.ok()).toBe(true);
  const settings=await config.json(); expect(settings.supabasePublishableKey).toMatch(/^sb_publishable_/);
  expect(settings.supabaseUrl).toMatch(/^https:\/\/[a-z0-9]+\.supabase\.co$/);
  const manifest=await request.get('manifest.webmanifest'); expect(manifest.ok()).toBe(true);
  for(const icon of (await manifest.json()).icons) expect((await request.get(icon.src)).ok()).toBe(true);
  expect((await request.get('sw.js')).ok()).toBe(true);
});
