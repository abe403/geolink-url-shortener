import { defineConfig, devices } from '@playwright/test';

/**
 * GEO.LINK Test Automation Framework
 * Multi-layer configuration: UI, API, and cross-browser testing
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  timeout: 30_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['allure-playwright', { outputFolder: 'allure-results' }],
    ['junit', { outputFile: 'results/junit-report.xml' }],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    trace: 'on-first-retry',
    actionTimeout: 15_000,
  },

  projects: [
    // ── UI Tests ───────────────────────────────────────────────────
    {
      name: 'chromium-ui',
      testDir: './ui',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox-ui',
      testDir: './ui',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit-ui',
      testDir: './ui',
      use: { ...devices['Desktop Safari'] },
    },

    // ── Mobile UI Tests ────────────────────────────────────────────
    {
      name: 'mobile-chrome',
      testDir: './ui',
      use: { ...devices['Pixel 7'] },
    },

    // ── API Tests ─────────────────────────────────────────────────
    {
      name: 'api',
      testDir: './api',
      use: {
        baseURL: process.env.API_BASE_URL || 'http://localhost:8080',
        extraHTTPHeaders: { 'Content-Type': 'application/json' },
      },
    },
  ],
});
