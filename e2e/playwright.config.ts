import { defineConfig, devices } from '@playwright/test';
import { SERVER_URL, WEB_PORT, WEB_URL } from './fixture/env.ts';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 4,
  retries: 0,
  forbidOnly: !!process.env.CI,

  // The first visit to each route waits on Vite compiling it.
  timeout: 60_000,

  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'seed', testMatch: /seed\.setup\.ts/ },
    {
      name: 'chromium',
      dependencies: ['seed'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      name: 'server',
      command: 'tsx fixture/startServer.ts',
      url: `${SERVER_URL}/api/version`,
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      name: 'web',

      // Dev mode on purpose. React only reports its warnings in dev builds,
      // and those warnings are what flag upcoming React 19 breakage.
      command: `pnpm --filter @tunarr/web exec vite --port ${WEB_PORT} --strictPort`,
      url: `${WEB_URL}/web/`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: { VITE_TUNARR_BACKEND_URI: SERVER_URL },
    },
  ],
});
