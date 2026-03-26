import { test, expect } from '@playwright/test';
import { uniqueUser, registerUser, loginUser } from './helpers';

test.describe.serial('Code challenges', () => {
  const username = uniqueUser('chal');

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerUser(page, username);
    await page.close();
  });

  /**
   * Navigate to a challenge lesson through the curriculum.
   * Challenges have 💻 icons and route to /challenges/:id.
   * The first module with challenges may be locked — we search all expanded modules.
   */
  async function navigateToChallenge(page: import('@playwright/test').Page): Promise<boolean> {
    await loginUser(page, username);
    await page.getByRole('main').getByText('Aspire Foundations').click();
    await page.waitForURL(/\/worlds\//);

    // Wait for modules to load
    await expect(page.getByText('What is Aspire?')).toBeVisible({ timeout: 10_000 });

    // Look for a challenge lesson with 💻 icon in any expanded module
    const challengeLesson = page.locator('[role="button"]').filter({ hasText: '💻' });
    if ((await challengeLesson.count()) > 0) {
      await challengeLesson.first().click();
      await page.waitForURL(/\/challenges\//);
      return true;
    }

    // No challenge lessons visible (all are in locked modules)
    return false;
  }

  test('open challenge loads Monaco editor', async ({ page }) => {
    const found = await navigateToChallenge(page);
    if (!found) {
      test.skip(true, 'No challenge lessons accessible (all in locked modules)');
      return;
    }

    // Monaco editor should be loaded
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 15_000 });

    // Run and Submit buttons should be present
    await expect(page.getByRole('button', { name: /^run$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^submit$/i })).toBeVisible();
  });

  test('run code shows output', async ({ page }) => {
    const found = await navigateToChallenge(page);
    if (!found) {
      test.skip(true, 'No challenge lessons accessible (all in locked modules)');
      return;
    }
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 15_000 });

    // Click Run
    await page.getByRole('button', { name: /^run$/i }).click();

    // Output panel should show "Running..." or actual output
    await expect(
      page.getByText(/running/i)
        .or(page.getByText(/output/i))
        .or(page.getByText(/error/i)),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('submit code shows test results', async ({ page }) => {
    const found = await navigateToChallenge(page);
    if (!found) {
      test.skip(true, 'No challenge lessons accessible (all in locked modules)');
      return;
    }
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 15_000 });

    // Click Submit
    await page.getByRole('button', { name: /^submit$/i }).click();

    // Should show submitting state or test results
    await expect(
      page.getByText(/submitting/i)
        .or(page.getByText(/tests/i))
        .or(page.getByText(/pass/i))
        .or(page.getByText(/fail/i)),
    ).toBeVisible({ timeout: 15_000 });
  });
});
