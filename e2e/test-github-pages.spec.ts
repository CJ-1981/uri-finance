import { test, expect } from '@playwright/test';

test('GitHub Pages deployment test', async ({ page, context }) => {
  // Capture console errors
  const consoleErrors: string[] = [];
  context.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error('Console error:', msg.text());
    } else {
      console.log('Console log:', msg.text());
    }
  });

  // Capture uncaught errors
  const pageErrors: string[] = [];
  page.on('pageerror', error => {
    pageErrors.push(error.message);
    console.error('Page error:', error.message);
  });

  // Navigate to the GitHub Pages site
  console.log('Navigating to https://cj-1981.github.io/uri-finance/...');
  await page.goto('https://cj-1981.github.io/uri-finance/', {
    waitUntil: 'networkidle',
    timeout: 30000
  });

  // Wait a bit for the app to load
  await page.waitForTimeout(3000);

  // Check if the page loaded
  const title = await page.title();
  console.log('Page title:', title);
  expect(title).toContain('우리교회 재정부');

  // Check if the root element exists
  const root = await page.locator('#root').count();
  console.log('Root element count:', root);
  expect(root).toBe(1);

  // Check if there's any content in the root
  const rootContent = await page.locator('#root').textContent();
  console.log('Root content:', rootContent);

  // Check for loading indicators
  const loadingElements = await page.locator('.animate-pulse').count();
  console.log('Loading elements count:', loadingElements);

  // Check if the app is still loading after 5 seconds
  await page.waitForTimeout(5000);
  const stillLoading = await page.locator('.animate-pulse').count();
  console.log('Still loading after 5 seconds:', stillLoading > 0);

  // Print summary
  console.log('\n=== Test Summary ===');
  console.log('Console errors:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.log('Error details:', consoleErrors);
  }
  console.log('Page errors:', pageErrors.length);
  if (pageErrors.length > 0) {
    console.log('Error details:', pageErrors);
  }

  // Screenshot
  await page.screenshot({ path: 'test-github-pages.png', fullPage: true });
  console.log('Screenshot saved to test-github-pages.png');
});
