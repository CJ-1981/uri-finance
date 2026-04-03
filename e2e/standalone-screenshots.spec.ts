import { test, expect } from '@playwright/test';
import { Transaction } from '../src/hooks/useTransactions';
import { Project } from '../src/hooks/useProjects';

test.describe('Standalone Mode Screenshots', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('capture all standalone screenshots', async ({ page, context }) => {
    const projectId = "mock-project-id";
    const mockProject: any = {
      id: projectId,
      name: "우리집 가계부 (독립 실행)",
      description: "로컬 전용 가계부입니다.",
      owner_id: "standalone-user",
      invite_code: "LOCAL",
      currency: "KRW",
      created_at: new Date().toISOString()
    };

    const mockTransactions: any[] = [
      {
        id: "tx-1",
        project_id: projectId,
        amount: 50000,
        type: "income",
        category: "식비",
        description: "마트 장보기",
        transaction_date: new Date().toISOString().split('T')[0],
        currency: "KRW",
        created_at: new Date().toISOString()
      },
      {
        id: "tx-2",
        project_id: projectId,
        amount: 15000,
        type: "expense",
        category: "교통",
        description: "주유비",
        transaction_date: new Date().toISOString().split('T')[0],
        currency: "KRW",
        created_at: new Date().toISOString()
      },
      {
        id: "tx-3",
        project_id: projectId,
        amount: 1200000,
        type: "income",
        category: "월급",
        description: "3월 급여",
        transaction_date: new Date().toISOString().split('T')[0],
        currency: "KRW",
        created_at: new Date().toISOString()
      }
    ];

    // 1. Setup Standalone Mode with Mock Data before page loads
    await context.addInitScript(({ pId, p, txs }) => {
      window.localStorage.clear();
      window.localStorage.setItem("is_standalone", "true");
      window.localStorage.setItem("theme", "light");
      window.localStorage.setItem("app-locale", "ko");
      window.localStorage.setItem("local_projects", JSON.stringify([p]));
      window.localStorage.setItem("active_project_id", pId);
      window.localStorage.setItem("active_project_cache", JSON.stringify(p));
      window.localStorage.setItem(`local_transactions_${pId}`, JSON.stringify(txs));
    }, { pId: projectId, p: mockProject, txs: mockTransactions });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="dashboard"]');

    // 2. Dashboard Screenshot
    await page.screenshot({
      path: 'docs/screenshots/standalone-dashboard.png',
      fullPage: true,
    });

    // 3. Charts Screenshot
    await page.click('[data-testid="view-charts"]');
    await page.waitForSelector('[data-testid="finance-charts"]');
    await page.waitForTimeout(2000); // Wait for animations
    await page.screenshot({
      path: 'docs/screenshots/standalone-charts.png',
      fullPage: true,
    });

    // 4. Cash Calculator Screenshot
    await page.click('[data-testid="view-cash"]');
    await page.waitForSelector('[data-testid="cash-calculator"]');
    await page.screenshot({
      path: 'docs/screenshots/standalone-cash.png',
      fullPage: true,
    });

    // 5. Admin Page Screenshot (Showing restricted items)
    await page.goto('/admin');
    await page.waitForSelector('[data-testid="admin-page"]');
    await page.screenshot({
      path: 'docs/screenshots/standalone-admin.png',
      fullPage: true,
    });

    // 6. Project Switcher Screenshot (Showing rename icon)
    await page.goto('/');
    await page.waitForSelector('[data-testid="dashboard"]');
    // Open project switcher - using the button with FolderOpen icon
    await page.locator('button:has(svg.lucide-folder-open)').first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: 'docs/screenshots/standalone-project-switcher.png',
      fullPage: false,
    });
  });
});
