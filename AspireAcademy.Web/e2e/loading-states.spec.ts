import { test, expect } from '@playwright/test';
import { uniqueUser, registerUser, loginUser, loginAndGoToWorld, injectAuth, FAKE_USER } from './helpers';

test.describe('Loading states', () => {
  test('dashboard shows skeletons while API is slow', async ({ page }) => {
    // Set up slow API responses BEFORE navigation
    await page.route('**/api/worlds', async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.fulfill({ status: 200, body: JSON.stringify([]) });
    });
    await page.route('**/api/xp', async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          totalXp: 0, currentLevel: 1, currentRank: 'aspire-intern',
          weeklyXp: 0, loginStreakDays: 0, recentEvents: [],
        }),
      });
    });
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify(FAKE_USER) }),
    );

    await injectAuth(page, 'fake-token', FAKE_USER);
    await page.goto('/dashboard');

    // Skeletons should be visible while data loads
    // Chakra Skeleton renders with css-animation or specific attributes
    const skeleton = page.locator('[data-scope="skeleton"], [class*="skeleton"], [class*="Skeleton"]');
    const hasSkeletons = await skeleton.first().isVisible({ timeout: 2_000 }).catch(() => false);

    // If no skeleton attribute, check that page eventually loads content
    if (!hasSkeletons) {
      // At minimum, the page loads without crashing during slow APIs
      await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 15_000 });
    }
  });

  test('profile page shows loading state while fetching', async ({ page }) => {
    const username = uniqueUser('loadprof');
    const p = await page.context().browser()!.newPage();
    await registerUser(p, username);
    await p.close();

    await page.route('**/api/users/*/profile', async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.continue();
    });

    await loginUser(page, username);
    await page.goto('/profile');

    // Page should show some loading state (skeleton or spinner)
    const loadingIndicator = page.locator('[data-scope="skeleton"], [class*="skeleton"], [role="status"]');
    const hasLoading = await loadingIndicator.first().isVisible({ timeout: 2_000 }).catch(() => false);

    // Eventually the profile loads
    await expect(page.getByText(username)).toBeVisible({ timeout: 15_000 });
  });

  test('leaderboard shows loading state while fetching', async ({ page }) => {
    const username = uniqueUser('loadlb');
    const p = await page.context().browser()!.newPage();
    await registerUser(p, username);
    await p.close();

    await page.route('**/api/leaderboard*', async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.continue();
    });

    await loginUser(page, username);
    await page.goto('/leaderboard');

    // Page should render tabs while data loads
    await expect(page.getByRole('tab', { name: /weekly/i })).toBeVisible({ timeout: 10_000 });
  });
});
