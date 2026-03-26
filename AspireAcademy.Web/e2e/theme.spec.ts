import { test, expect } from '@playwright/test';
import { uniqueUser, registerUser, loginUser } from './helpers';

test.describe.serial('Theme toggle', () => {
  const username = uniqueUser('theme');

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerUser(page, username);
    await page.close();
  });

  test('theme toggle button is visible', async ({ page }) => {
    await loginUser(page, username);
    const themeBtn = page.getByLabel('Toggle color mode');
    await expect(themeBtn).toBeVisible({ timeout: 10_000 });
  });

  test('clicking theme toggle switches theme', async ({ page }) => {
    await loginUser(page, username);
    const themeBtn = page.getByLabel('Toggle color mode');
    await expect(themeBtn).toBeVisible({ timeout: 10_000 });

    // Get initial background color
    const initialBg = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor,
    );

    // Click to toggle
    await themeBtn.click();
    await page.waitForTimeout(500);

    // Background should change
    const newBg = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor,
    );
    expect(newBg).not.toBe(initialBg);
  });

  test('theme persists after page refresh', async ({ page }) => {
    await loginUser(page, username);
    const themeBtn = page.getByLabel('Toggle color mode');
    await expect(themeBtn).toBeVisible({ timeout: 10_000 });

    // Record background before toggle
    const beforeBg = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor,
    );

    // Toggle theme
    await themeBtn.click();
    await page.waitForTimeout(500);
    const afterBg = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor,
    );
    expect(afterBg).not.toBe(beforeBg);

    // Refresh page
    await page.reload();
    await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 10_000 });

    // Background should still be the toggled value
    const refreshBg = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor,
    );
    expect(refreshBg).toBe(afterBg);
  });
});
