/**
 * One-time setup: Log in and save auth state for screenshot tests
 *
 * Run this with: npx playwright test e2e/auth-setup.spec.ts --config=playwright.screenshots.config.ts
 *
 * IMPORTANT: Update TEST_EMAIL and TEST_PASSWORD with valid credentials before running!
 */

import { test } from '@playwright/test';

// Test credentials for screenshot generation
const TEST_EMAIL = '[EMAIL_ADDRESS]';
const TEST_PASSWORD = '[PASSWORD]';

test('save auth state', async ({ page }) => {
  await page.goto('/');

  // Wait for auth page
  await page.waitForSelector('[data-testid="auth-page"]');

  // Fill in login form
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button:has-text("로그인")');

  // Wait for successful login (navigates away from auth page)
  await page.waitForURL('/', { timeout: 15000 });
  await page.waitForSelector('[data-testid="dashboard"]');

  // Save auth state to file
  await page.context().storageState({ path: 'e2e/.auth-storage.json' });

  console.log('Auth state saved to e2e/.auth-storage.json');
});
