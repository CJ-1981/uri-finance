import { test, expect } from "@playwright/test";

test.describe("Standalone Mode", () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear all storage to start fresh
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(async () => {
      localStorage.clear();
      sessionStorage.clear();
      const databases = await window.indexedDB.databases();
      await Promise.all(databases.map(db => {
        if (db.name) {
          return new Promise((resolve, reject) => {
            const req = window.indexedDB.deleteDatabase(db.name!);
            req.onsuccess = resolve;
            req.onerror = reject;
            req.onblocked = () => reject(new Error('deleteDatabase blocked'));
          });
        }
        return Promise.resolve();
      }));
    });
    await page.reload();
    // Ensure English
    const langBtn = page.getByRole("button", { name: /한국어|EN/i });
    const langText = await langBtn.textContent();
    if (langText?.includes("한국어")) {
      await langBtn.click();
    }
  });

  test("should enable standalone mode and create a project", async ({ page }) => {
    await page.goto("/auth");
    
    // Click standalone mode button
    const standaloneBtn = page.getByText(/Continue in Standalone Mode/i);
    await expect(standaloneBtn).toBeVisible({ timeout: 10000 });
    await standaloneBtn.click();

    // Should be redirected to dashboard
    await expect(page).toHaveURL(/\/$/);

    // Should show get started section
    await expect(page.getByText(/Create a project or join one/i)).toBeVisible();

    // Verify Join Project button is hidden
    await expect(page.getByRole("button", { name: /Join Project/i })).not.toBeVisible();

    // Create a new project
    await page.getByRole("button", { name: /Create New/i }).click();
    await page.getByPlaceholder(/e\.g\. Household Budget/i).fill("Standalone Project");
    await page.getByRole("button", { name: /Create Project/i }).click();

    // Verify project created
    await expect(page.getByText(/Project created locally!/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Standalone Project" })).toBeVisible();

    // Ensure switcher is closed (it should be, but let's be sure)
    await expect(page.locator("role=dialog")).not.toBeVisible();

    // Add a transaction
    const addBtn = page.getByTestId("add-transaction-button");
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Wait for form
    await expect(page.getByTestId("add-transaction-form")).toBeVisible();
    
    await page.getByPlaceholder("0.00").fill("100");
    
    // Select category
    const categoryTrigger = page.locator('button').filter({ has: page.locator('svg[data-lucide="tag"]') });
    await expect(categoryTrigger).toBeVisible();
    await categoryTrigger.click();
    
    // Wait for popover and select a category
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    
    await page.getByRole("button", { name: /Add Transaction/i }).click();

    // Verify transaction added
    await expect(page.getByText(/Transaction added!/i)).toBeVisible();
    await expect(page.getByText("100.00").first()).toBeVisible();

    // Reload and check persistence
    await page.reload();
    await expect(page.getByRole("button", { name: "Standalone Project" })).toBeVisible();
    await expect(page.getByText("100.00").first()).toBeVisible();
  });

  test("should clear standalone mode on sign out", async ({ page }) => {
    // Setup standalone mode
    await page.goto("/auth");
    await page.getByText(/Continue in Standalone Mode/i).click();
    await expect(page).toHaveURL(/\/$/);

    // Wait for dashboard
    await expect(page.getByTestId("dashboard")).toBeVisible();

    // Sign out
    const userMenu = page.getByTestId("user-menu-trigger");
    await expect(userMenu).toBeVisible();
    await userMenu.click();
    await page.getByRole("menuitem", { name: /Sign Out/i }).click();

    // Should be back to auth page
    await expect(page).toHaveURL(/\/auth/);
    
    // Verify standalone mode flag is gone
    const isStandalone = await page.evaluate(() => localStorage.getItem("is_standalone"));
    expect(isStandalone).toBeNull();
  });
});
