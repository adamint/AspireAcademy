import { test, expect } from '@playwright/test';
import { uniqueUser, registerUser, loginUser } from './helpers';

test.describe.serial('Profile and social features', () => {
  const username = uniqueUser('prof');

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerUser(page, username);
    await page.close();
  });

  test('view own profile', async ({ page }) => {
    await loginUser(page, username);
    await page.goto('/profile');

    // Profile should show the user's display name
    const main = page.getByRole('main');
    await expect(main.getByText(username)).toBeVisible({ timeout: 10_000 });

    // Stats grid should be present — "Total XP", "Lessons", "Achievements", "Day Streak"
    await expect(main.getByText(/total xp/i)).toBeVisible();
    await expect(main.getByText(/lessons/i)).toBeVisible();
    await expect(main.getByText(/achievements/i)).toBeVisible();
    await expect(main.getByText(/streak/i)).toBeVisible();

    // Level badge
    await expect(main.getByText(/level \d+/i)).toBeVisible();
  });

  test('view leaderboard', async ({ page }) => {
    await loginUser(page, username);
    await page.goto('/leaderboard');

    const main = page.getByRole('main');

    // Title
    await expect(main.getByText(/leaderboard/i)).toBeVisible({ timeout: 10_000 });

    // Tabs for Weekly, All-Time, Friends
    await expect(main.getByText(/weekly/i)).toBeVisible();
    await expect(main.getByText(/all-time/i)).toBeVisible();
    await expect(main.getByText(/friends/i)).toBeVisible();

    // Either leaderboard entries or empty state should be visible
    await expect(
      main.getByText(/your rank/i)
        .or(main.getByText(/no data/i))
        .or(main.getByText(/no entries/i))
        .or(main.getByText(/xp/i)),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('view achievements', async ({ page }) => {
    await loginUser(page, username);
    await page.goto('/achievements');

    const main = page.getByRole('main');

    // Title
    await expect(main.getByText(/achievements/i).first()).toBeVisible({ timeout: 10_000 });

    // Category tabs or "All" tab
    await expect(main.getByText(/all/i).first()).toBeVisible();

    // Achievement count or grid
    await expect(
      main.getByText(/unlocked/i)
        .or(main.getByText(/\d+ of \d+/))
        .or(main.getByText(/no achievements/i)),
    ).toBeVisible({ timeout: 10_000 });
  });
});
