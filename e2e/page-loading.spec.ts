import { test, expect, Page } from '@playwright/test';

test.describe('Page Loading Diagnosis', () => {
  let page: Page;

  test.beforeEach(async ({ context }) => {
    // Enable detailed console logs and network monitoring
    page = await context.newPage();

    // Monitor console errors
    page.on('console', msg => {
      console.log(`[Browser Console ${msg.type()}]: ${msg.text()}`);
      if (msg.type() === 'error') {
        console.error('Console Error:', msg.text());
      }
    });

    // Monitor page errors
    page.on('pageerror', error => {
      console.error('Page Error:', error);
    });

    // Monitor network requests
    page.on('request', request => {
      console.log(`[Request] ${request.method()} ${request.url()}`);
    });

    page.on('response', response => {
      const status = response.status();
      const url = response.url();
      if (status >= 400) {
        console.error(`[Response Error] ${status} ${url}`);
      } else {
        console.log(`[Response] ${status} ${url}`);
      }
    });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should load the home page without errors', async () => {
    console.log('Navigating to http://localhost:8082/');

    // Navigate to the page and wait for initial load
    const response = await page.goto('http://localhost:8082/', {
      waitUntil: 'networkidle',
      timeout: 10000
    });

    console.log('Page loaded, status:', response?.status());

    // Take screenshot for visual inspection
    await page.screenshot({ path: 'page-load-initial.png', fullPage: true });
    console.log('Screenshot saved to page-load-initial.png');

    // Wait a bit to see what happens
    await page.waitForTimeout(3000);

    // Take another screenshot to see state after delay
    await page.screenshot({ path: 'page-load-after-3s.png', fullPage: true });
    console.log('Screenshot saved to page-load-after-3s.png');

    // Check page title
    const title = await page.title();
    console.log('Page title:', title);
    expect(title).toBeTruthy();

    // Check if body has content
    const bodyText = await page.textContent('body');
    console.log('Body text length:', bodyText?.length);

    // Check for loading indicators
    const loadingElements = await page.$$('[class*="loading"], [class*="spinner"], [class*="pulse"]');
    console.log('Number of loading elements:', loadingElements.length);

    // Check for error messages
    const errorElements = await page.$$('[class*="error"]');
    console.log('Number of error elements:', errorElements.length);

    if (errorElements.length > 0) {
      for (const el of errorElements) {
        const text = await el.textContent();
        console.log('Error element text:', text);
      }
    }

    // Check for authentication redirect
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);

    // Check React root
    const rootElement = await page.$('#root');
    console.log('Root element exists:', !!rootElement);

    if (rootElement) {
      const rootContent = await rootElement.innerHTML();
      console.log('Root content length:', rootContent.length);
    }

    // Check for any specific error messages or loading states
    const authLoading = await page.getByText('Loading').isVisible().catch(() => false);
    console.log('Auth loading visible:', authLoading);

    // Wait for potential authentication to complete
    await page.waitForTimeout(5000);

    // Final screenshot
    await page.screenshot({ path: 'page-load-final.png', fullPage: true });
    console.log('Screenshot saved to page-load-final.png');

    // Get final state
    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);
  });

  test('should check for authentication state', async () => {
    console.log('Checking authentication state...');

    await page.goto('http://localhost:8082/', {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });

    // Wait for potential authentication check
    await page.waitForTimeout(3000);

    // Check localStorage for auth data
    const localStorage = await page.evaluate(() => {
      const authKeys = Object.keys(localStorage).filter(key =>
        key.includes('supabase') || key.includes('auth') || key.includes('session')
      );
      const authData: Record<string, string> = {};
      authKeys.forEach(key => {
        authData[key] = localStorage.getItem(key) || 'null';
      });
      return authData;
    });

    console.log('Auth-related localStorage:', Object.keys(localStorage));

    // Check sessionStorage for routing data
    const sessionStorage = await page.evaluate(() => {
      const keys = Object.keys(sessionStorage);
      const data: Record<string, string> = {};
      keys.forEach(key => {
        data[key] = sessionStorage.getItem(key) || 'null';
      });
      return data;
    });

    console.log('SessionStorage:', Object.keys(sessionStorage));
  });

  test('should diagnose infinite loading loop', async () => {
    console.log('Diagnosing potential infinite loading loop...');

    await page.goto('http://localhost:8082/', {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });

    // Monitor for loading state changes
    let loadingStateCount = 0;
    let lastLoadingState = false;

    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(1000);

      const isLoading = await page.locator('text=Loading, text=loading, [class*="loading"], [class*="spinner"]').isVisible().catch(() => false);

      if (isLoading !== lastLoadingState) {
        loadingStateCount++;
        lastLoadingState = isLoading;
        console.log(`Second ${i}: Loading state changed to:`, isLoading);
      } else {
        console.log(`Second ${i}: Loading state remains:`, isLoading);
      }
    }

    console.log('Total loading state changes:', loadingStateCount);
    console.log('Final loading state:', lastLoadingState);

    if (loadingStateCount > 3) {
      console.error('WARNING: Possible infinite loading loop detected!');
    }
  });
});
