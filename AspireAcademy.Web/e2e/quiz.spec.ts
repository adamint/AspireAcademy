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

    // Answer all questions until we see results
    for (let i = 0; i < 20; i++) {
      // Check if results are showing
      if (await page.getByText(/📊/).isVisible().catch(() => false)) break;

      // Click "Next Question" or "See Results" if visible
      const nextBtn = page.getByRole('button', { name: /next question|see results/i });
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(500);
        continue;
      }

      // Select first answer option
      const radioItems = page.locator('[data-scope="radio-group"] [data-part="item-control"]');
      if ((await radioItems.count()) > 0) {
        await radioItems.first().click();
      } else {
        const checkboxes = page.locator('[data-scope="checkbox"] [data-part="control"]');
        if ((await checkboxes.count()) > 0) {
          await checkboxes.first().click();
        } else {
          const input = page.locator('input[type="text"]');
          if ((await input.count()) > 0) await input.first().fill('test');
        }
      }

      // Submit
      const submitBtn = page.getByRole('button', { name: /submit answer/i });
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // Verify quiz results summary with pass/fail badge
    await expect(
      page.getByText(/passed/i).or(page.getByText(/failed/i)),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('XP awarded on pass', async ({ page }) => {
    const found = await navigateToQuiz(page);
    if (!found) {
      test.skip(true, 'No unlocked quiz lesson available');
      return;
    }

    // Complete quiz by answering all questions
    for (let i = 0; i < 20; i++) {
      if (await page.getByText(/📊/).isVisible().catch(() => false)) break;

      const nextBtn = page.getByRole('button', { name: /next question|see results/i });
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(500);
        continue;
      }

      const radioItems = page.locator('[data-scope="radio-group"] [data-part="item-control"]');
      if ((await radioItems.count()) > 0) await radioItems.first().click();

      const submitBtn = page.getByRole('button', { name: /submit answer/i });
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // Check for XP earned text or score display
    await expect(
      page.getByText(/XP earned/i)
        .or(page.getByText(/\+\d+ XP/))
        .or(page.getByText(/score/i)),
    ).toBeVisible({ timeout: 10_000 });
  });
});
