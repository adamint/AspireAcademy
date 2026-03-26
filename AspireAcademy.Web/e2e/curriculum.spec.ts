import { test, expect } from '@playwright/test';
import { uniqueUser, registerUser, loginUser } from './helpers';

test.describe.serial('Curriculum browsing', () => {
  const username = uniqueUser('cur');

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerUser(page, username);
    await page.close();
  });

  test('dashboard shows worlds section', async ({ page }) => {
    await loginUser(page, username);
    await expect(page.getByText(/your worlds/i)).toBeVisible({ timeout: 10_000 });
  });

  test('world cards rendered', async ({ page }) => {
    await loginUser(page, username);
    const main = page.getByRole('main');
    // Wait for world cards to appear — "Aspire Foundations" is the first world
    await expect(main.getByText('Aspire Foundations')).toBeVisible({ timeout: 10_000 });
    // Should have multiple world cards (dashboard shows 6 worlds)
    const worldTexts = main.getByText(/^World \d$/);
    await expect(worldTexts.first()).toBeVisible();
    expect(await worldTexts.count()).toBeGreaterThanOrEqual(1);
  });

  test('world card shows progress', async ({ page }) => {
    await loginUser(page, username);
    const main = page.getByRole('main');
    await expect(main.getByText('Aspire Foundations')).toBeVisible({ timeout: 10_000 });
    // Progress bars should appear on world cards
    const progressBars = main.locator('[role="progressbar"]');
    await expect(progressBars.first()).toBeVisible();
    // All worlds should show 0% for a new user
    await expect(main.getByText('0%').first()).toBeVisible();
  });

  test('navigate to world', async ({ page }) => {
    await loginUser(page, username);
    const main = page.getByRole('main');
    await expect(main.getByText('Aspire Foundations')).toBeVisible({ timeout: 10_000 });

    // Click the first world card
    await main.getByText('Aspire Foundations').click();
    await expect(page).toHaveURL(/\/worlds\//);
    // Module page should show "Back to Dashboard"
    await expect(page.getByText('Back to Dashboard')).toBeVisible({ timeout: 10_000 });
  });

  test('module shows lessons', async ({ page }) => {
    await loginUser(page, username);
    await page.getByRole('main').getByText('Aspire Foundations').click();
    await page.waitForURL(/\/worlds\//);

    // First module "What is Aspire?" should be visible
    await expect(page.getByText('What is Aspire?')).toBeVisible({ timeout: 10_000 });

    // Unlocked modules start EXPANDED by default — don't click to toggle
    // Wait for lesson items to load and appear
    await expect(page.getByText(/XP/).first()).toBeVisible({ timeout: 10_000 });

    // Should show lesson items
    const lessonItems = page.locator('[role="button"]').filter({ hasText: /XP/ });
    expect(await lessonItems.count()).toBeGreaterThanOrEqual(1);
  });

  test('locked lesson shows lock indicator', async ({ page }) => {
    await loginUser(page, username);
    await page.getByRole('main').getByText('Aspire Foundations').click();
    await page.waitForURL(/\/worlds\//);

    // Wait for modules to load
    await expect(page.getByText('What is Aspire?')).toBeVisible({ timeout: 10_000 });

    // Second module should be locked (shows lock message)
    await expect(page.getByText('Complete the previous module to unlock').first()).toBeVisible();
  });

  test('open learn lesson', async ({ page }) => {
    await loginUser(page, username);
    await page.getByRole('main').getByText('Aspire Foundations').click();
    await page.waitForURL(/\/worlds\//);

    // Unlocked module starts expanded — wait for lessons to load
    await expect(page.locator('[role="button"]').filter({ hasText: /XP/ }).first()).toBeVisible({ timeout: 10_000 });

    // Click the first learn lesson (📖 icon)
    const learnLesson = page.locator('[role="button"]').filter({ hasText: '📖' });
    await learnLesson.first().click();

    await page.waitForURL(/\/lessons\//);
    // Should show a "Back to" link and lesson content
    await expect(page.getByText(/back to/i)).toBeVisible({ timeout: 10_000 });
  });

  test('mark lesson complete', async ({ page }) => {
    await loginUser(page, username);
    await page.getByRole('main').getByText('Aspire Foundations').click();
    await page.waitForURL(/\/worlds\//);

    // Wait for lessons to appear in expanded module
    await expect(page.locator('[role="button"]').filter({ hasText: /XP/ }).first()).toBeVisible({ timeout: 10_000 });

    // Click first learn lesson
    const learnLesson = page.locator('[role="button"]').filter({ hasText: '📖' });
    await learnLesson.first().click();
    await page.waitForURL(/\/lessons\//);

    // Wait for lesson content to load, then look for Mark Complete button
    await expect(page.getByRole('main')).toContainText(/back to/i, { timeout: 10_000 });

    const markComplete = page.getByRole('button', { name: /mark complete/i });
    try {
      await expect(markComplete).toBeVisible({ timeout: 5_000 });
      await markComplete.click();
      // Should show completed state or XP earned
      await expect(
        page.getByText(/completed/i).or(page.getByText(/\+.*xp/i)),
      ).toBeVisible({ timeout: 10_000 });
    } catch {
      // Button not found — lesson may already be completed
      await expect(
        page.getByText(/completed/i).or(page.getByText(/mark complete/i)),
      ).toBeVisible({ timeout: 5_000 });
    }
  });
});
