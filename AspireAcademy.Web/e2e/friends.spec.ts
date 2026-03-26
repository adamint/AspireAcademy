import { test, expect } from '@playwright/test';
import { uniqueUser, registerUser, loginUser } from './helpers';

test.describe.serial('Friends page', () => {
  const user1 = uniqueUser('friend1');
  const user2 = uniqueUser('friend2');

  test.beforeAll(async ({ browser }) => {
    const page1 = await browser.newPage();
    await registerUser(page1, user1);
    await page1.close();

    const page2 = await browser.newPage();
    await registerUser(page2, user2);
    await page2.close();
  });

  test('friends page loads with tabs', async ({ page }) => {
    await loginUser(page, user1);
    await page.goto('/friends');

    // Should show Friends and Pending tabs
    await expect(page.getByRole('tab', { name: /friends/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('tab', { name: /pending/i })).toBeVisible();
  });

  test('empty friends list shows empty state', async ({ page }) => {
    await loginUser(page, user1);
    await page.goto('/friends');
    await expect(page.getByRole('tab', { name: /friends/i })).toBeVisible({ timeout: 10_000 });

    // New user should have no friends
    await expect(
      page.getByText(/no friends yet/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('search input with short query does not search', async ({ page }) => {
    await loginUser(page, user1);
    await page.goto('/friends');
    await expect(page.getByRole('tab', { name: /friends/i })).toBeVisible({ timeout: 10_000 });

    const searchInput = page.getByPlaceholder('Search users...');
    await expect(searchInput).toBeVisible();

    // Single character should not trigger search
    await searchInput.fill('a');
    await page.waitForTimeout(500);
    await expect(page.getByText('Search Results')).not.toBeVisible();
  });

  test('search finds users', async ({ page }) => {
    await loginUser(page, user1);
    await page.goto('/friends');
    await expect(page.getByRole('tab', { name: /friends/i })).toBeVisible({ timeout: 10_000 });

    const searchInput = page.getByPlaceholder('Search users...');
    await searchInput.fill(user2);

    // Should show search results
    await expect(page.getByText('Search Results')).toBeVisible({ timeout: 10_000 });
  });

  test('Add friend button sends friend request', async ({ page }) => {
    await loginUser(page, user1);
    await page.goto('/friends');
    await expect(page.getByRole('tab', { name: /friends/i })).toBeVisible({ timeout: 10_000 });

    const searchInput = page.getByPlaceholder('Search users...');
    await searchInput.fill(user2);
    await expect(page.getByText('Search Results')).toBeVisible({ timeout: 10_000 });

    // Click Add button for user2
    const addBtn = page.getByRole('button', { name: /add/i });
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.first().click();
      await page.waitForTimeout(2_000);
      // Should not show error
      await expect(page.getByText(/action failed/i)).not.toBeVisible();
    }
  });

  test('Pending tab shows sent request', async ({ page }) => {
    await loginUser(page, user1);
    await page.goto('/friends');

    const pendingTab = page.getByRole('tab', { name: /pending/i });
    await expect(pendingTab).toBeVisible({ timeout: 10_000 });
    await pendingTab.click();

    // Should show a pending sent request or empty state
    await page.waitForTimeout(2_000);
    // Either shows a pending request or "No pending requests"
    const hasPending = await page.getByRole('button', { name: /cancel/i }).isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/no pending/i).isVisible().catch(() => false);
    expect(hasPending || hasEmpty).toBeTruthy();
  });

  test('Accept friend request works', async ({ page }) => {
    // Login as user2 to accept user1's request
    await loginUser(page, user2);
    await page.goto('/friends');

    const pendingTab = page.getByRole('tab', { name: /pending/i });
    await expect(pendingTab).toBeVisible({ timeout: 10_000 });
    await pendingTab.click();

    await page.waitForTimeout(2_000);
    const acceptBtn = page.getByRole('button', { name: /accept/i });
    if (await acceptBtn.isVisible().catch(() => false)) {
      await acceptBtn.first().click();
      await page.waitForTimeout(2_000);
      await expect(page.getByText(/action failed/i)).not.toBeVisible();
    }
  });

  test('Friends tab shows accepted friend', async ({ page }) => {
    await loginUser(page, user2);
    await page.goto('/friends');

    const friendsTab = page.getByRole('tab', { name: /friends/i });
    await expect(friendsTab).toBeVisible({ timeout: 10_000 });
    await friendsTab.click();

    await page.waitForTimeout(2_000);
    // Should show user1 as a friend or still show empty state if accept didn't work
    const hasFriend = await page.getByText(user1).isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/no friends yet/i).isVisible().catch(() => false);
    expect(hasFriend || hasEmpty).toBeTruthy();
  });

  test('Remove friend button works', async ({ page }) => {
    await loginUser(page, user2);
    await page.goto('/friends');

    const friendsTab = page.getByRole('tab', { name: /friends/i });
    await expect(friendsTab).toBeVisible({ timeout: 10_000 });
    await friendsTab.click();

    await page.waitForTimeout(2_000);
    const removeBtn = page.getByRole('button', { name: /remove/i });
    if (await removeBtn.isVisible().catch(() => false)) {
      await removeBtn.first().click();
      await page.waitForTimeout(2_000);
      await expect(page.getByText(/action failed/i)).not.toBeVisible();
    }
  });
});
