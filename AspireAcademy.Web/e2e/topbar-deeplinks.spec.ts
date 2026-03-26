import { test, expect } from '@playwright/test';
import { uniqueUser, registerUser, loginUser } from './helpers';

test.describe('TopBar — user menu', () => {
  const username = uniqueUser('topbar');

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerUser(page, username);
    await page.close();
  });

  test('user menu shows profile and logout options', async ({ page }) => {
    await loginUser(page, username);
    const menuBtn = page.getByLabel('User menu');
    await expect(menuBtn).toBeVisible({ timeout: 10_000 });
    await menuBtn.click();
    await page.waitForTimeout(500);

    // The dropdown menu renders with Profile and Log Out as Flex buttons
    // Use locator scoped to the area near the menu to avoid sidebar conflicts
    const logOutBtn = page.locator('button').filter({ hasText: 'Log Out' });
    await expect(logOutBtn).toBeVisible({ timeout: 5_000 });
  });

  test('user menu Profile navigates to /profile', async ({ page }) => {
    await loginUser(page, username);
    await page.getByLabel('User menu').click();
    await page.waitForTimeout(500);

    // Find the Profile button in the dropdown (not the sidebar link)
    // The dropdown Profile is a button, the sidebar Profile is a link
    const profileBtn = page.locator('button').filter({ hasText: 'Profile' });
    await expect(profileBtn).toBeVisible({ timeout: 5_000 });
    await profileBtn.click();
    await expect(page).toHaveURL(/\/profile/, { timeout: 10_000 });
  });

  test('user menu Log Out navigates to /login', async ({ page }) => {
    await loginUser(page, username);
    await page.getByLabel('User menu').click();
    await page.waitForTimeout(500);
    await page.locator('button').filter({ hasText: 'Log Out' }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('XP progress bar is visible in top bar', async ({ page }) => {
    await loginUser(page, username);
    const xpBar = page.locator('.xp-bar-track');
    await expect(xpBar).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Deep link navigation', () => {
  const username = uniqueUser('deep');

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerUser(page, username);
    await page.close();
  });

  test('direct /worlds/:id URL works when authenticated', async ({ page }) => {
    await loginUser(page, username);
    await page.getByRole('main').getByText('Aspire Foundations').click();
    await page.waitForURL(/\/worlds\//);
    const worldUrl = page.url();

    await page.goto('/dashboard');
    await page.goto(worldUrl);
    await expect(page.getByText(/back to dashboard/i)).toBeVisible({ timeout: 10_000 });
  });

  test('direct lesson URL works when authenticated', async ({ page }) => {
    await loginUser(page, username);
    await page.getByRole('main').getByText('Aspire Foundations').click();
    await page.waitForURL(/\/worlds\//);

    const learnLesson = page.locator('[role="button"]').filter({ hasText: '📖' });
    await expect(learnLesson.first()).toBeVisible({ timeout: 10_000 });
    await learnLesson.first().click();
    await page.waitForURL(/\/lessons\//);
    const lessonUrl = page.url();

    await page.goto('/dashboard');
    await page.goto(lessonUrl);
    await expect(page.getByText(/back to/i)).toBeVisible({ timeout: 10_000 });
  });

  test('browser back button works after navigation', async ({ page }) => {
    await loginUser(page, username);
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/profile/);
    await page.goto('/leaderboard');
    await expect(page).toHaveURL(/\/leaderboard/);
    await page.goBack();
    await expect(page).toHaveURL(/\/profile/);
  });
});
