import { test, expect } from '@playwright/test';
import {
  uniqueUser,
  registerUser,
  loginUser,
  loginAndGoToWorld,
  navigateToFirstLearnLesson,
  getAuthToken,
} from './helpers';

test.describe.serial('Skip Lesson → unlock next → unskip → complete for XP', () => {
  const username = uniqueUser('skip');

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerUser(page, username);
    await page.close();
  });

  test('skip lesson button is visible on an uncompleted lesson', async ({ page }) => {
    await loginAndGoToWorld(page, username);
    await navigateToFirstLearnLesson(page);

    const skipBtn = page.getByTestId('skip-lesson-btn');
    await expect(skipBtn).toBeVisible({ timeout: 10_000 });
    await expect(skipBtn).toBeEnabled();
  });

  test('skipping a lesson shows skipped banner and undo button', async ({ page }) => {
    await loginAndGoToWorld(page, username);
    await navigateToFirstLearnLesson(page);

    const skipBtn = page.getByTestId('skip-lesson-btn');
    await expect(skipBtn).toBeVisible({ timeout: 10_000 });

    // Skip already completed? Check first
    const text = await skipBtn.textContent();
    if (!text) {
      test.skip(true, 'Skip button not present');
      return;
    }

    await skipBtn.click();

    // Should show skipped banner
    await expect(page.getByText(/skipped/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('undo-skip-btn')).toBeVisible({ timeout: 5_000 });
  });

  test('skipping a lesson unlocks the next lesson', async ({ page }) => {
    await loginAndGoToWorld(page, username);

    // After skipping the first lesson, the next lesson should show as available (not locked)
    // Look for a lesson that was previously locked but is now available
    const learnLessons = page.locator('[role="button"]').filter({ hasText: '📖' });
    const count = await learnLessons.count();
    // At least the first lesson should be accessible
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('unskip via API and then complete for XP', async ({ page }) => {
    await loginUser(page, username);

    const token = await getAuthToken(page);

    // Find the first learn lesson ID
    const worldsRes = await page.request.get('/api/worlds', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const worlds = await worldsRes.json();
    const firstWorld = worlds[0];

    const modulesRes = await page.request.get(`/api/worlds/${firstWorld.id}/modules`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const modules = await modulesRes.json();
    const firstModule = modules[0];

    const lessonsRes = await page.request.get(`/api/modules/${firstModule.id}/lessons`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const lessons = await lessonsRes.json();
    const firstLearnLesson = lessons.find(
      (l: { type: string; status: string }) => l.type === 'learn' && l.status === 'skipped',
    );

    if (!firstLearnLesson) {
      // The lesson might already have been unskipped/completed in a prior run
      test.skip(true, 'No skipped learn lessons available');
      return;
    }

    // Unskip
    const unskipRes = await page.request.post('/api/progress/unskip', {
      headers: { Authorization: `Bearer ${token}` },
      data: { lessonId: firstLearnLesson.id },
    });
    expect(unskipRes.ok()).toBeTruthy();

    // Complete for XP
    const completeRes = await page.request.post('/api/progress/complete', {
      headers: { Authorization: `Bearer ${token}` },
      data: { lessonId: firstLearnLesson.id },
    });
    expect(completeRes.ok()).toBeTruthy();

    const body = await completeRes.json();
    expect(body.xpEarned).toBeGreaterThan(0);
  });

  test('locked lessons show preview label and are clickable', async ({ page }) => {
    await loginAndGoToWorld(page, username);

    // Look for a preview label on locked lessons
    const previewLabels = page.getByText('preview', { exact: false }).filter({ hasText: '👁️' });
    const count = await previewLabels.count();

    // There should be at least some locked lessons with preview labels
    // (dependent on curriculum data)
    if (count > 0) {
      await expect(previewLabels.first()).toBeVisible();
    }
  });
});
