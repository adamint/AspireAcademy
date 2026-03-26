import { test, expect } from '@playwright/test';
import { uniqueUser, registerUser, loginUser, loginAndGoToWorld, navigateToFirstLearnLesson, completeLearnLessonsViaApi } from './helpers';

test.describe.serial('Lesson — Previous / Next navigation', () => {
  const username = uniqueUser('prevnext');

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerUser(page, username);
    // Complete first lesson so 1.1.2 is unlocked and has a working Previous button
    await completeLearnLessonsViaApi(page, ['1.1.1']);
    await page.close();
  });

  test('lesson page shows Previous and Next navigation buttons', async ({ page }) => {
    await loginAndGoToWorld(page, username);
    await navigateToFirstLearnLesson(page);

    // The Previous/Next buttons show lesson titles (not "Previous"/"Next") via:
    //   {lesson.previousLessonTitle ?? 'Previous'}
    //   {lesson.nextLessonTitle ?? 'Next'}
    // They're always rendered (disabled if no prev/next).
    // The layout is: Flex justify="space-between" with two Button children.
    // Identify them by the mark-complete button being above them.
    const markComplete = page.getByTestId('mark-complete-btn');
    await expect(markComplete).toBeVisible({ timeout: 10_000 });

    // The navigation buttons are inside main content, not the sidebar
    const mainButtons = page.getByRole('main').getByRole('button');
    const count = await mainButtons.count();
    // Main should have at least 3 buttons: mark-complete + prev + next
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('Next button navigates to a different page when enabled', async ({ page }) => {
    await loginAndGoToWorld(page, username);
    await navigateToFirstLearnLesson(page);

    const markComplete = page.getByTestId('mark-complete-btn');
    await expect(markComplete).toBeVisible({ timeout: 10_000 });

    // The Next button is the last button in main content
    const mainButtons = page.getByRole('main').getByRole('button');
    const count = await mainButtons.count();
    const nextBtn = mainButtons.nth(count - 1);

    const isDisabled = await nextBtn.isDisabled();
    if (isDisabled) {
      // This lesson has no next lesson — valid state
      return;
    }

    const firstUrl = page.url();
    await nextBtn.click();
    await expect(page).toHaveURL(/\/(lessons|quizzes|challenges)\//, { timeout: 10_000 });
    expect(page.url()).not.toBe(firstUrl);
  });

  test('Previous button navigates back when enabled', async ({ page }) => {
    await loginAndGoToWorld(page, username);
    await navigateToFirstLearnLesson(page);

    const markComplete = page.getByTestId('mark-complete-btn');
    await expect(markComplete).toBeVisible({ timeout: 10_000 });

    // Scope to main content to exclude sidebar buttons
    const mainButtons = page.getByRole('main').getByRole('button');
    const count = await mainButtons.count();
    const nextBtn = mainButtons.nth(count - 1);
    const prevBtn = mainButtons.nth(count - 2);

    // For the first lesson, Previous is disabled — navigate forward first
    if (await nextBtn.isDisabled()) {
      test.skip(true, 'Next button disabled, cannot navigate forward to test Previous');
      return;
    }

    await nextBtn.click();
    await expect(page).toHaveURL(/\/(lessons|quizzes|challenges)\//, { timeout: 10_000 });

    // Now find the Previous button on the new page
    const newMainButtons = page.getByRole('main').getByRole('button');
    const newCount = await newMainButtons.count();
    const newPrevBtn = newMainButtons.nth(newCount - 2);

    if (await newPrevBtn.isDisabled()) {
      test.skip(true, 'Previous button disabled on this page');
      return;
    }

    const secondUrl = page.url();
    await newPrevBtn.click();
    await expect(page).toHaveURL(/\/(lessons|quizzes|challenges)\//, { timeout: 10_000 });
    expect(page.url()).not.toBe(secondUrl);
  });
});

test.describe.serial('Lesson — Back button', () => {
  const username = uniqueUser('back');

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerUser(page, username);
    await page.close();
  });

  test('back button navigates away from lesson page', async ({ page }) => {
    await loginAndGoToWorld(page, username);
    await navigateToFirstLearnLesson(page);

    // Click "Back to ..." button — it's a Flex as="button"
    const backBtn = page.locator('button').filter({ hasText: /back to/i });
    await expect(backBtn).toBeVisible({ timeout: 5_000 });
    await backBtn.click();

    // Should navigate to the world page (if worldId exists) or browser back (to worlds or dashboard)
    await expect(page).toHaveURL(/\/(worlds|dashboard)/, { timeout: 10_000 });
  });

  test('back button text contains Back to', async ({ page }) => {
    await loginAndGoToWorld(page, username);
    await navigateToFirstLearnLesson(page);

    const backBtn = page.locator('button').filter({ hasText: /back to/i });
    await expect(backBtn).toBeVisible({ timeout: 5_000 });
    const text = await backBtn.textContent();
    expect(text).toMatch(/back to/i);
  });
});
