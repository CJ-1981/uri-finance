import { test } from '@playwright/test';

test('Network request analysis', async ({ page, context }) => {
  // Capture all network requests
  const requests: { url: string; status: number; method: string }[] = [];
  page.on('request', request => {
    requests.push({
      url: request.url(),
      status: -1,
      method: request.method()
    });
  });

  page.on('response', response => {
    const url = response.url();
    const request = requests.find(r => r.url === url);
    if (request) {
      request.status = response.status();
    }
  });

  // Capture console messages
  context.on('console', msg => {
    console.log(`[${msg.type()}]`, msg.text());
  });

  // Navigate to the site
  console.log('Navigating to https://cj-1981.github.io/uri-finance/...');
  await page.goto('https://cj-1981.github.io/uri-finance/', {
    waitUntil: 'networkidle',
    timeout: 30000
  });

  // Wait for the app to load
  await page.waitForTimeout(5000);

  // Print all network requests
  console.log('\n=== Network Requests ===');
  requests.forEach(req => {
    const status = req.status === -1 ? 'PENDING' : req.status;
    const statusIcon = req.status >= 400 ? '❌' : '✅';
    console.log(`${statusIcon} ${req.method} ${status} ${req.url}`);
  });

  // Print failed requests
  console.log('\n=== Failed Requests (404, 500, etc) ===');
  const failedRequests = requests.filter(r => r.status >= 400);
  failedRequests.forEach(req => {
    console.log(`❌ ${req.method} ${req.status} ${req.url}`);
  });

  // Print summary
  console.log('\n=== Summary ===');
  console.log(`Total requests: ${requests.length}`);
  console.log(`Failed requests: ${failedRequests.length}`);
  console.log(`Success rate: ${((requests.length - failedRequests.length) / requests.length * 100).toFixed(1)}%`);

  // Check root content
  const root = page.locator('#root');
  const rootHtml = await root.innerHTML();
  console.log(`\nRoot HTML content: ${rootHtml || '(empty)'}`);

  // Check if JavaScript is executing
  const isJsExecuting = await page.evaluate(() => {
    return window.React !== undefined || (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined;
  });
  console.log(`JavaScript executing: ${isJsExecuting}`);

  // Check React version if available
  const reactVersion = await page.evaluate(() => {
    return window.React?.version || 'N/A';
  });
  console.log(`React version: ${reactVersion}`);
});
