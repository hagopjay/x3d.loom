// The browser suite: the production build (vite preview) in Chromium, Firefox and WebKit with real WebGL (headless).
// `npm run smoke` builds first. One worker: the scenes are heavy and some checks are timed.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/browser',
  timeout: 240_000,
  expect: { timeout: 60_000 },
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'evidence/p5-smoke.json' }]],
  use: { baseURL: 'http://127.0.0.1:5182/', locale: 'en-US', viewport: { width: 1500, height: 950 } },
  webServer: { command: 'npx vite preview', url: 'http://127.0.0.1:5182/', reuseExistingServer: true, timeout: 60_000 },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chromium', viewport: { width: 1500, height: 950 } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1500, height: 950 } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1500, height: 950 } } },
  ],
});
