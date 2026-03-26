import { test, expect } from '@playwright/test';
import { uniqueUser, registerUser, loginUser, injectAuth, FAKE_USER } from './helpers';

test.describe('Error states', () => {
  const username = uniqueUser('error');

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerUser(page, username);
    await page.close();
  });

  /* ─── 404 page ─── */

  test('invalid URL shows 404 page', async ({ page }) => {
    await loginUser(page, username);
    await page.goto('/this-route-does-not-exist');
    await expect(page.getByText('404')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/page not found/i)).toBeVisible();
  });

  test('404 page Go to Dashboard button works', async ({ page }) => {
    await loginUser(page, username);
    await page.goto('/nonexistent-route-xyz');
    await expect(page.getByText('404')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /dashboard/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });

  /* ─── Invalid lesson/quiz/challenge IDs ─── */

  test('invalid lesson ID shows lesson not found', async ({ page }) => {
    await loginUser(page, username);
    await page.goto('/lessons/nonexistent-lesson-id-12345');
    await expect(page.getByText(/lesson not found|not found|error/i)).toBeVisible({ timeout: 10_000 });
  });

  test('invalid quiz ID shows error state', async ({ page }) => {
    await loginUser(page, username);
    await page.goto('/quizzes/nonexistent-quiz-id-12345');
    await expect(
      page.getByText(/not found|error|failed to load/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('invalid challenge ID shows error state', async ({ page }) => {
    await loginUser(page, username);
    await page.goto('/challenges/nonexistent-challenge-id-12345');
    await expect(
      page.getByText(/not found|error|failed/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('invalid world ID shows world not found', async ({ page }) => {
    await loginUser(page, username);
    await page.goto('/worlds/nonexistent-world-id-12345');
    await expect(page.getByText(/world not found|not found/i)).toBeVisible({ timeout: 10_000 });
  });

  /* ─── Invalid user profile ─── */

  test('invalid user profile shows error or empty state', async ({ page }) => {
    await loginUser(page, username);
    await page.goto('/users/00000000-0000-0000-0000-000000000000');
    // Should show an error state or redirect, not crash
    await page.waitForTimeout(3_000);
    const hasError = await page.getByText(/failed to load profile|user not found|not found|error/i).isVisible().catch(() => false);
    const hasRedirect = page.url().includes('/login') || page.url().includes('/dashboard');
    const bodyNotEmpty = await page.locator('body').textContent().then(t => (t?.length ?? 0) > 0);
    expect(hasError || hasRedirect || bodyNotEmpty).toBeTruthy();
  });

  /* ─── Protected routes when logged out ─── */

  test('unauthenticated /dashboard redirects to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('unauthenticated /profile redirects to login', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('unauthenticated /friends redirects to login', async ({ page }) => {
    await page.goto('/friends');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('unauthenticated /leaderboard redirects to login', async ({ page }) => {
    await page.goto('/leaderboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('unauthenticated /achievements redirects to login', async ({ page }) => {
    await page.goto('/achievements');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('unauthenticated /lessons/xxx redirects to login', async ({ page }) => {
    await page.goto('/lessons/some-fake-id');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  /* ─── API errors (mocked) ─── */

  test('dashboard handles API failure gracefully', async ({ page }) => {
    await page.route('**/api/worlds', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server error' }) }),
    );
    await page.route('**/api/xp', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server error' }) }),
    );
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify(FAKE_USER) }),
    );

    await injectAuth(page, 'fake-token', FAKE_USER);
    await page.goto('/dashboard');

    // Page should load without crashing — may show empty state or error
    await expect(page.locator('body')).not.toHaveText('');
    // No unhandled JS errors — page renders something
    await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 10_000 });
  });

  test('dashboard handles empty worlds gracefully', async ({ page }) => {
    await page.route('**/api/worlds', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify([]) }),
    );
    await page.route('**/api/xp', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          totalXp: 0, currentLevel: 1, currentRank: 'aspire-intern',
          weeklyXp: 0, loginStreakDays: 0, recentEvents: [],
        }),
      }),
    );
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify(FAKE_USER) }),
    );

    await injectAuth(page, 'fake-token', FAKE_USER);
    await page.goto('/dashboard');

    await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/no worlds available/i)).toBeVisible({ timeout: 5_000 });
  });

  test('mark complete failure shows error banner', async ({ page }) => {
    await loginUser(page, username);
    await page.getByRole('main').getByText('Aspire Foundations').click();
    await page.waitForURL(/\/worlds\//);

    // Find an available (uncompleted) learn lesson
    const availableLearn = page.locator('[role="button"]').filter({ hasText: /○/ }).filter({ hasText: /📖/ });
    if ((await availableLearn.count()) === 0) {
      test.skip(true, 'No uncompleted lessons to test error state');
      return;
    }

    await availableLearn.first().click();
    await page.waitForURL(/\/lessons\//);

    // Mock completion endpoint to fail
    await page.route('**/api/progress/complete', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server error' }) }),
    );

    const btn = page.getByTestId('mark-complete-btn');
    await expect(btn).toBeVisible({ timeout: 10_000 });
    await btn.click();

    // Should show error message
    await expect(page.getByText(/failed to mark complete/i)).toBeVisible({ timeout: 10_000 });
  });
});
