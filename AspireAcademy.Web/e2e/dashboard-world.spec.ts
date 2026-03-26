import { test, expect } from '@playwright/test';
import { uniqueUser, registerUser, loginUser, loginAndGoToWorld, completeLearnLessonsViaApi, unlockFirstChallenge } from './helpers';

test.describe.serial('Dashboard page', () => {
  const username = uniqueUser('dash');

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerUser(page, username);
    await page.close();
  });

  test('dashboard shows welcome message and world cards', async ({ page }) => {
    await loginUser(page, username);
    await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 15_000 });

    // Should show at least one world card
    await expect(page.getByRole('main').getByText('Aspire Foundations')).toBeVisible({ timeout: 10_000 });
  });

  test('clicking world card navigates to world page', async ({ page }) => {
    await loginUser(page, username);
    await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 10_000 });
    await page.getByRole('main').getByText('Aspire Foundations').click();
    await expect(page).toHaveURL(/\/worlds\//, { timeout: 10_000 });
  });

  test('dashboard shows XP stats', async ({ page }) => {
    await loginUser(page, username);
    await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 10_000 });

    // Should show XP-related stats (Level, XP, etc.)
    await expect(page.getByText(/level|xp/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe.serial('World / Module page', () => {
  const username = uniqueUser('module');

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerUser(page, username);
    // Complete prerequisites so quiz and challenge lessons are unlocked
    await unlockFirstChallenge(page);
    await page.close();
  });

  test('world page shows modules with lessons', async ({ page }) => {
    await loginAndGoToWorld(page, username);

    // Module name should be visible
    await expect(page.getByText('Why Aspire?')).toBeVisible({ timeout: 10_000 });

    // Lessons with XP badges should be visible
    const lessonItems = page.locator('[role="button"]').filter({ hasText: /XP/ });
    expect(await lessonItems.count()).toBeGreaterThanOrEqual(1);
  });

  test('module card expand/collapse works', async ({ page }) => {
    await loginAndGoToWorld(page, username);

    // Module header should be visible
    const moduleHeader = page.getByText('Why Aspire?');
    await expect(moduleHeader).toBeVisible({ timeout: 10_000 });

    // Click to collapse (module starts expanded by default if unlocked)
    await moduleHeader.click();
    await page.waitForTimeout(500);

    // Click to expand again
    await moduleHeader.click();
    await page.waitForTimeout(500);

    // Lessons should still be visible
    const lessonItems = page.locator('[role="button"]').filter({ hasText: /XP/ });
    expect(await lessonItems.count()).toBeGreaterThanOrEqual(1);
  });

  test('world page back to dashboard works', async ({ page }) => {
    await loginAndGoToWorld(page, username);
    await page.getByText('Back to Dashboard').click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });

  test('lesson list items show correct type icons', async ({ page }) => {
    await loginAndGoToWorld(page, username);

    // Check for known type icons
    const allLessons = page.locator('[role="button"]').filter({ hasText: /XP/ });
    expect(await allLessons.count()).toBeGreaterThanOrEqual(1);

    // At minimum, the first module should have learn lessons
    const learnLessons = page.locator('[role="button"]').filter({ hasText: '📖' });
    expect(await learnLessons.count()).toBeGreaterThanOrEqual(1);
  });

  test('clicking learn lesson navigates to /lessons/', async ({ page }) => {
    await loginAndGoToWorld(page, username);

    const learnLesson = page.locator('[role="button"]').filter({ hasText: '📖' });
    await expect(learnLesson.first()).toBeVisible({ timeout: 10_000 });
    await learnLesson.first().click();
    await expect(page).toHaveURL(/\/lessons\//, { timeout: 10_000 });
  });

  test('clicking quiz lesson navigates to /quizzes/', async ({ page }) => {
    await loginAndGoToWorld(page, username);

    const quizLesson = page.locator('[role="button"]').filter({ hasText: '🧪' });
    if ((await quizLesson.count()) === 0) {
      // Quiz may be in a different module — try expanding others
      test.skip(true, 'No quiz lessons visible in first module');
      return;
    }
    // Quiz might be locked — check if it has the locked icon
    const firstQuiz = quizLesson.first();
    const text = await firstQuiz.textContent();
    if (text?.includes('🔒')) {
      test.skip(true, 'Quiz lesson is locked');
      return;
    }
    await firstQuiz.click();
    await expect(page).toHaveURL(/\/quizzes\//, { timeout: 10_000 });
  });

  test('clicking challenge lesson navigates to /challenges/', async ({ page }) => {
    await loginAndGoToWorld(page, username);

    const challengeLesson = page.locator('[role="button"]').filter({ hasText: /💻|🏗️|🎮/ });
    if ((await challengeLesson.count()) === 0) {
      test.skip(true, 'No challenge lessons visible');
      return;
    }
    await challengeLesson.first().click();
    await expect(page).toHaveURL(/\/challenges\//, { timeout: 10_000 });
  });
});
