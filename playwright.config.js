import { defineConfig, devices } from '@playwright/test';

const suppliedURL = process.env.PLAYWRIGHT_BASE_URL;
const remote = suppliedURL && (suppliedURL.endsWith('/') ? suppliedURL : suppliedURL + '/');
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: remote || 'http://127.0.0.1:4173/hearth-social/',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: remote ? undefined : {
    command: 'node tests/serve.mjs',
    url: 'http://127.0.0.1:4173/hearth-social/live.html',
    reuseExistingServer: false,
  },
});
