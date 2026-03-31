import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;

test.describe('Offline Mode Robustness', () => {
  test.beforeAll(() => {
    if (!TEST_EMAIL || !TEST_PASSWORD) {
      throw new Error('TEST_EMAIL and TEST_PASSWORD environment variables are required for this test.');
    }
  });

  test.beforeEach(async ({ page }) => {
    // Capture console logs
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning' || msg.text().includes('[useTransactions]')) {
        console.log(`BROWSER LOG [${msg.type()}]: ${msg.text()}`);
      }
    });

    await page.goto('/');
    
    const isAuthPage = await page.isVisible('[data-testid="auth-page"]');
    if (isAuthPage) {
      await page.fill('input[type="email"]', TEST_EMAIL!);
      await page.fill('input[type="password"]', TEST_PASSWORD!);
      await page.click('button:has-text("로그인")');
      await page.waitForSelector('[data-testid="dashboard"]', { timeout: 15000 });
    }
  });

  test('should keep added transactions after connection recovery', async ({ page, context }) => {
    await page.waitForSelector('[data-testid="view-list"]');
    
    // 1. Go Offline
    await context.setOffline(true);
    await page.waitForTimeout(1000);
    
    // 2. Add multiple transactions while offline
    const tx1 = `Offline Tx ${Date.now()}-1`;
    const tx2 = `Offline Tx ${Date.now()}-2`;

    // Add first
    await page.click('[data-testid="add-transaction-button"]');
    await page.fill('[data-testid="transaction-amount"]', '10.00');
    await page.fill('[data-testid="transaction-description"]', tx1);
    await page.click('[data-testid="transaction-submit-button"]');
    await expect(page.getByText(tx1)).toBeVisible();

    // Add second
    await page.click('[data-testid="add-transaction-button"]');
    await page.fill('[data-testid="transaction-amount"]', '20.00');
    await page.fill('[data-testid="transaction-description"]', tx2);
    await page.click('[data-testid="transaction-submit-button"]');
    await expect(page.getByText(tx2)).toBeVisible();
    
    // 3. (SKIPPED) Reload while offline - verify persistence
    // We skip this because dev server doesn't support SW reloads well without production build
    
    // 4. Recover connection
    await context.setOffline(false);
    console.log("Connection recovered, waiting for sync...");

    // 5. Verify they STAY visible during and after sync
    // The pulsing indicator disappearing is our trigger
    const offlineIndicator = page.getByTestId('offline-indicator');
    await expect(offlineIndicator).not.toBeVisible({ timeout: 25000 });
    
    console.log("Offline indicator gone, verifying data stays...");
    
    // Check multiple times over a few seconds to catch "disappearing" flicker
    for (let i = 0; i < 5; i++) {
      await expect(page.getByText(tx1)).toBeVisible();
      await expect(page.getByText(tx2)).toBeVisible();
      await page.waitForTimeout(1000);
    }
    
    console.log("Confirmed persistence after recovery and re-fetch window");
  });
});
