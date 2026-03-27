import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for screenshot generation
 * Optimized for consistent, high-quality documentation screenshots
 *
 * IMPORTANT: Start dev server first with 'npm run dev' on port 8082
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/screenshots.spec.ts',
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8082',
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        contextOptions: {
          // Enable localStorage access
          storageState: undefined,
        },
      },
    },
  ],
  // No webServer - assume dev server is already running on port 8082
});
