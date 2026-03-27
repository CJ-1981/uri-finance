/**
 * Screenshot generation test for documentation
 *
 * Prerequisites:
 * 1. Run e2e/auth-setup.spec.ts first to save auth state
 * 2. Or manually log in and run tests (they'll use session from browser)
 *
 * Run with: npm run screenshots
 */

import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_STORAGE = path.join(process.cwd(), 'e2e/.auth-storage.json');
const hasAuthState = fs.existsSync(AUTH_STORAGE);

test.describe.configure({ mode: 'serial' });

test.describe('App Screenshots', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // Use saved auth state if available
  test.use(hasAuthState ? {
    storageState: AUTH_STORAGE,
  } : {});

  test('auth page light mode', async ({ page, context }) => {
    // For auth screenshot, don't use saved state - clear it
    await context.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="auth-page"]');

    await page.screenshot({
      path: 'docs/screenshots/auth-light.png',
      fullPage: true,
    });
  });

  (hasAuthState ? test.describe : test.describe.skip)('Authenticated Screenshots', () => {
    test.use({ storageState: AUTH_STORAGE });

    test('dashboard light mode', async ({ page }) => {
      await page.goto('/');
      await page.addInitScript('localStorage.setItem("theme", "light")');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="dashboard"]', { timeout: 15000 });

      await page.screenshot({
        path: 'docs/screenshots/dashboard-light.png',
        fullPage: true,
      });
    });

    test('dashboard dark mode', async ({ page }) => {
      await page.goto('/');
      await page.evaluate('localStorage.setItem("theme", "dark")');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="dashboard"]', { timeout: 15000 });

      await page.screenshot({
        path: 'docs/screenshots/dashboard-dark.png',
        fullPage: true,
      });
    });

    test('charts view light mode', async ({ page }) => {
      await page.goto('/');
      await page.addInitScript('localStorage.setItem("theme", "light")');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="dashboard"]');

      // Try to change period to "All" to show any existing transactions
      const periodButton = page.locator('button:has-text("전체"), button:has-text("All")').first();
      if (await periodButton.isVisible().catch(() => false)) {
        await periodButton.click();
        await page.waitForTimeout(1000);
      }

      // Switch to charts view
      await page.click('[data-testid="view-charts"]');
      await page.waitForSelector('[data-testid="finance-charts"]');
      await page.waitForLoadState('networkidle');

      // Wait for chart elements to render
      await page.waitForSelector('svg', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(2000);

      await page.screenshot({
        path: 'docs/screenshots/charts-light.png',
        fullPage: true,
      });
    });

    test('cash calculator light mode', async ({ page }) => {
      await page.goto('/');
      await page.addInitScript('localStorage.setItem("theme", "light")');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="dashboard"]');

      // Switch to cash calculator view
      await page.click('[data-testid="view-cash"]');
      await page.waitForSelector('[data-testid="cash-calculator"]');
      await page.waitForLoadState('networkidle');

      await page.screenshot({
        path: 'docs/screenshots/cash-calculator-light.png',
        fullPage: true,
      });
    });

    test('add transaction modal light mode', async ({ page }) => {
      await page.goto('/');
      await page.addInitScript('localStorage.setItem("theme", "light")');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="dashboard"]');

      // Try multiple selectors for the FAB button
      const fabButton = page.locator('button[aria-label*="Add"], button:has(svg[data-lucide="plus"]), button.fixed').first();
      if (await fabButton.isVisible().catch(() => false)) {
        await fabButton.click();
      } else {
        await page.click('body', { position: { x: 1250, y: 750 } });
      }
      await page.waitForTimeout(500);
      await page.waitForSelector('[data-testid="add-transaction-form"]', { timeout: 5000 }).catch(() => {});
      await page.waitForLoadState('networkidle');

      await page.screenshot({
        path: 'docs/screenshots/add-transaction-light.png',
        fullPage: true,
      });
    });

    test('admin categories light mode', async ({ page }) => {
      await page.goto('/admin');
      await page.addInitScript('localStorage.setItem("theme", "light")');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="admin-page"]', { timeout: 15000 });

      await page.screenshot({
        path: 'docs/screenshots/admin-categories-light.png',
        fullPage: true,
      });
    });

    test('admin custom columns light mode', async ({ page }) => {
      await page.goto('/admin');
      await page.addInitScript('localStorage.setItem("theme", "light")');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="admin-page"]');

      // Custom columns section is at the top, just scroll to ensure it's visible
      await page.evaluate('window.scrollTo(0, 0)');
      await page.waitForLoadState('networkidle');

      await page.screenshot({
        path: 'docs/screenshots/admin-columns-light.png',
        fullPage: true,
      });
    });

    test('files list light mode', async ({ page }) => {
      await page.goto('/');
      await page.addInitScript('localStorage.setItem("theme", "light")');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="dashboard"]');

      // Switch to files view
      await page.click('[data-testid="view-files"]');
      await page.waitForTimeout(1000);
      await page.waitForLoadState('networkidle');

      await page.screenshot({
        path: 'docs/screenshots/files-list-light.png',
        fullPage: true,
      });
    });

    test('period selector modal light mode', async ({ page }) => {
      await page.goto('/');
      await page.addInitScript('localStorage.setItem("theme", "light")');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="dashboard"]');

      // Click period selector button
      const periodButton = page.locator('button').filter({ hasText: /전체|All|기간|Period/ }).first();
      await periodButton.click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: 'docs/screenshots/period-selector-light.png',
        fullPage: false,
      });
    });

    test('category selector modal light mode', async ({ page }) => {
      await page.goto('/');
      await page.addInitScript('localStorage.setItem("theme", "light")');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="dashboard"]');

      // Click category selector button
      const categoryButton = page.locator('button').filter({ hasText: /카테고리|Category/ }).first();
      await categoryButton.click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: 'docs/screenshots/category-selector-light.png',
        fullPage: false,
      });
    });

    test('export modal light mode', async ({ page }) => {
      await page.goto('/');
      await page.addInitScript('localStorage.setItem("theme", "light")');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="dashboard"]');

      // Switch to charts view first (export button is in charts view)
      await page.click('[data-testid="view-charts"]');
      await page.waitForSelector('[data-testid="finance-charts"]');
      await page.waitForLoadState('networkidle');

      // Click export button - text is "보고서 내보내기" in Korean or "Export" in English
      const exportButton = page.locator('button:has-text("보고서 내보내기"), button:has-text("Export")').first();
      await exportButton.click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: 'docs/screenshots/export-modal-light.png',
        fullPage: false,
      });
    });

    test('keyboard shortcut settings light mode', async ({ page }) => {
      await page.goto('/');
      await page.addInitScript('localStorage.setItem("theme", "light")');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="dashboard"]');

      // Click keyboard shortcut button
      await page.click('[data-testid="keyboard-shortcuts-button"]');

      // Wait for the popover to appear
      await page.waitForSelector('[data-testid="keyboard-shortcuts-popover"]', { timeout: 5000 });
      await page.waitForTimeout(500);

      await page.screenshot({
        path: 'docs/screenshots/keyboard-shortcuts-light.png',
        fullPage: false,
      });
    });

    test('pin setup settings light mode', async ({ page }) => {
      await page.goto('/');
      await page.addInitScript('localStorage.setItem("theme", "light")');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="dashboard"]');

      // Click PIN setup button
      await page.click('[data-testid="pin-setup-button"]');

      // Wait for the dialog to appear
      await page.waitForSelector('[data-testid="pin-setup-dialog"]', { timeout: 5000 });
      await page.waitForTimeout(500);

      await page.screenshot({
        path: 'docs/screenshots/pin-setup-light.png',
        fullPage: false,
      });
    });
  });
});
