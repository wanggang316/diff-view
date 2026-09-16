import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './browser-tests',
  use: { baseURL: 'http://127.0.0.1:4173', headless: true },
  projects: [{ name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: { command: 'node scripts/serve.mjs', url: 'http://127.0.0.1:4173/demo.html', reuseExistingServer: false },
});
