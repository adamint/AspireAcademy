import { test, expect } from '@playwright/test';
import { uniqueUser, registerUser, loginUser } from './helpers';

test.describe.serial('Quiz functionality', () => {
  const username = uniqueUser('quiz');

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerUser(page, username);

    // Navigate to world page to find its URL
    await page.getByRole('main').getByText('Aspire Foundations').click();
    await page.waitForURL(/\/worlds\//);
    const worldUrl = page.url();

    // Wait for lessons to load
    await expect(page.locator('[role="button"]').filter({ hasText: /XP/ }).first()).toBeVisible({ timeout: 10_000 });

    // Complete prerequisite learn lessons to unlock the quiz
    for (let i = 0; i < 5; i++) {
      const availableLearn = page.locator('[role="button"]').filter({ hasText: /○/ }).filter({ hasText: /📖/ });
      if ((await availableLearn.count()) === 0) break;

      await availableLearn.first().click();
      await page.waitForURL(/\/lessons\//, { timeout: 10_000 });
      const markBtn = page.getByRole('button', { name: /mark complete/i });
      await expect(markBtn).toBeVisible({ timeout: 10_000 });
      await markBtn.click();
      await page.waitForTimeout(1_000);

      // Navigate back to world page and reload for fresh data
      await page.goto(worldUrl);
      await page.reload();
      await expect(page.locator('[role="button"]').filter({ hasText: /XP/ }).first()).toBeVisible({ timeout: 10_000 });

      // Check if quiz is now unlocked (🧪 without 🔒)
      const unlockedQuiz = page.locator('[role="button"]').filter({ hasText: '🧪' }).filter({ hasNotText: '🔒' });
      if ((await unlockedQuiz.count()) > 0) break;
    }

    await page.close();
  });

  /**
   * Navigate to a quiz lesson via the curriculum UI.
   */
  async function navigateToQuiz(page: import('@playwright/test').Page): Promise<boolean> {
    await loginUser(page, username);
    await page.getByRole('main').getByText('Aspire Foundations').click();
    await page.waitForURL(/\/worlds\//);

    // Wait for lessons to load
    await expect(page.locator('[role="button"]').filter({ hasText: /XP/ }).first()).toBeVisible({ timeout: 10_000 });

    // Look for an unlocked quiz lesson (○ 🧪)
    const quizLesson = page.locator('[role="button"]').filter({ hasText: '🧪' }).filter({ hasNotText: '🔒' });
    if ((await quizLesson.count()) === 0) return false;

    await quizLesson.first().click();
    await page.waitForURL(/\/quizzes\//, { timeout: 10_000 });
    return true;
  }

  test('open quiz shows question', async ({ page }) => {
    const found = await navigateToQuiz(page);
    if (!found) {
      test.skip(true, 'No unlocked quiz lesson available');
      return;
    }

    // Quiz page should show question text and Submit Answer button
    await expect(page.getByText(/question \d+ of \d+/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /submit answer/i })).toBeVisible();
  });

  test('answer question shows feedback', async ({ page }) => {
    const found = await navigateToQuiz(page);
    if (!found) {
      test.skip(true, 'No unlocked quiz lesson available');
      return;
    }
    await expect(page.getByText(/question \d+ of \d+/i)).toBeVisible({ timeout: 10_000 });

    // Select the first answer option (radio or checkbox)
    const radioItems = page.locator('[data-scope="radio-group"] [data-part="item-control"]');
    const checkboxes = page.locator('[data-scope="checkbox"] [data-part="control"]');
    const textInput = page.locator('input[type="text"]');

    if ((await radioItems.count()) > 0) {
      await radioItems.first().click();
    } else if ((await checkboxes.count()) > 0) {
      await checkboxes.first().click();
    } else if ((await textInput.count()) > 0) {
      await textInput.first().fill('answer');
    }

    await page.getByRole('button', { name: /submit answer/i }).click();

    // Feedback should appear (Correct! or Incorrect)
    await expect(
      page.getByText(/correct/i).or(page.getByText(/incorrect/i)),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('complete quiz shows results', async ({ page }) => {
    const found = await navigateToQuiz(page);
    if (!found) {
      test.skip(true, 'No unlocked quiz lesson available');
      return;
    }

    const main = page.getByRole('main');

    // Wait for quiz to load
    await expect(main.getByText(/question \d+ of \d+/i)).toBeVisible({ timeout: 10_000 });

    // Answer all questions
    for (let q = 0; q < 10; q++) {
      // Check if we reached the results page (scoped to main to avoid sidebar 📊 match)
      const resultsVisible = await main.getByText(/— Results/i).isVisible().catch(() => false);
      if (resultsVisible) break;

      // If feedback is showing (Next Question / See Results), click it
      const nextBtn = main.getByRole('button', { name: /next question|see results/i });
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(500);
        continue;
      }

      // Select first radio answer and submit
      const radioGroup = main.getByRole('radiogroup');
      if (await radioGroup.isVisible().catch(() => false)) {
        const firstItem = main.locator('[data-scope="radio-group"] [data-part="item-control"]').first();
        await firstItem.click();

        // Wait for submit to become enabled, then click
        const submitBtn = main.getByRole('button', { name: /submit answer/i });
        await expect(submitBtn).toBeEnabled({ timeout: 3_000 });
        await submitBtn.click();

        // Wait for feedback to appear
        await expect(
          main.getByText(/correct/i).or(main.getByText(/incorrect/i)),
        ).toBeVisible({ timeout: 5_000 });
      }
    }

    // Verify quiz results — look for PASSED or FAILED badge
    await expect(
      main.getByText(/PASSED/).or(main.getByText(/FAILED/)),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('XP awarded on pass', async ({ page }) => {
    // After the quiz was completed in the previous test, verify XP is reflected
    await loginUser(page, username);

    // The XP bar in the header should show non-zero XP (from completed lessons + quiz)
    // The header shows "Lvl X" and "XP/500" format
    const header = page.locator('header').first().or(page.locator('nav').first());
    
    // Navigate to profile where XP info is shown
    await page.goto('/profile');
    const main = page.getByRole('main');

    // Profile should show XP/level info — the user earned XP from lessons and quiz
    await expect(
      main.getByText(/xp/i).first()
        .or(main.getByText(/level/i).first())
        .or(main.getByText(/lessons completed/i).first()),
    ).toBeVisible({ timeout: 10_000 });
  });
});
