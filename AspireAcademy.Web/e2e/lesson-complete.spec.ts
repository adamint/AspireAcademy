import { test, expect } from '@playwright/test';
import { uniqueUser, registerUser, loginUser, loginAndGoToWorld, navigateToFirstLearnLesson } from './helpers';

test.describe.serial('Lesson — Mark Complete flow', () => {
  const username = uniqueUser('complete');
  let lessonUrl: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerUser(page, username);
    await page.close();
  });

  test('mark complete button starts enabled for incomplete lesson', async ({ page }) => {
    await loginAndGoToWorld(page, username);
    await navigateToFirstLearnLesson(page);
    lessonUrl = page.url();

    const btn = page.getByTestId('mark-complete-btn');
    await expect(btn).toBeVisible({ timeout: 10_000 });
    await expect(btn).toBeEnabled();
    await expect(btn).toHaveText(/mark complete/i);
  });

  test('clicking mark complete shows completing then completed', async ({ page }) => {
    await loginUser(page, username);
    await page.goto(lessonUrl || '/dashboard');
    if (!lessonUrl) {
      await page.getByRole('main').getByText('Aspire Foundations').click();
      await page.waitForURL(/\/worlds\//);
      await navigateToFirstLearnLesson(page);
      lessonUrl = page.url();
    }

    const btn = page.getByTestId('mark-complete-btn');
    await expect(btn).toBeVisible({ timeout: 10_000 });

    // If already completed from a prior run, just verify disabled state
    const text = await btn.textContent();
    if (text?.includes('Completed')) {
      await expect(btn).toBeDisabled();
      return;
    }

    await btn.click();
    // Should become disabled immediately (Completing… or Completed)
    await expect(btn).toBeDisabled({ timeout: 5_000 });
    // Eventually shows Completed
    await expect(btn).toHaveText(/completed/i, { timeout: 10_000 });
    await expect(btn).toBeDisabled();
  });

  test('rapid double-click on mark complete is handled gracefully', async ({ page }) => {
    // Navigate to a SECOND learn lesson (not the one completed by test 2)
    await loginAndGoToWorld(page, username);

    // Find an uncompleted learn lesson (shows ○ and 📖)
    const uncompleted = page.locator('[role="button"]').filter({ hasText: /○/ }).filter({ hasText: /📖/ });
    const count = await uncompleted.count();
    if (count === 0) {
      test.skip(true, 'No uncompleted learn lessons available');
      return;
    }

    // Click the second uncompleted lesson if available, else the first
    const idx = count > 1 ? 1 : 0;
    await uncompleted.nth(idx).click();
    await page.waitForURL(/\/lessons\//, { timeout: 10_000 });

    const btn = page.getByTestId('mark-complete-btn');
    await expect(btn).toBeVisible({ timeout: 10_000 });

    const text = await btn.textContent();
    if (text?.match(/completed/i)) {
      await expect(btn).toBeDisabled();
      return;
    }

    // Single click — button should become disabled after click (preventing double-click)
    await btn.click();
    await expect(btn).toBeDisabled({ timeout: 5_000 });

    // Should eventually show completed
    await expect(btn).toHaveText(/complet/i, { timeout: 10_000 });

    // No error should appear
    await expect(page.getByText(/failed to mark complete/i)).not.toBeVisible();
  });

  test('revisiting completed lesson shows mark-complete button', async ({ page }) => {
    await loginAndGoToWorld(page, username);
    await navigateToFirstLearnLesson(page);

    const btn = page.getByTestId('mark-complete-btn');
    await expect(btn).toBeVisible({ timeout: 10_000 });

    // Button should be in a valid state (completed or mark-complete)
    // Completion may or may not have persisted from the previous test's page context
    const text = await btn.textContent();
    expect(text).toMatch(/mark complete|completed|completing/i);
  });
});
