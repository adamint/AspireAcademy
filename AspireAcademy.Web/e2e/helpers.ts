import { Page, expect } from '@playwright/test';

/* ---------- identity helpers ---------- */

export function uniqueUser(prefix = 'e2e'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/* ---------- auth helpers ---------- */

export async function registerUser(
  page: Page,
  username: string,
  password = 'TestPassword1!',
): Promise<void> {
  await page.goto('/register');
  await page.locator('#reg-user').fill(username);
  await page.locator('#reg-email').fill(`${username}@test.com`);
  await page.locator('#reg-display').fill(username);
  await page.locator('#reg-pass').fill(password);
  await page.locator('#reg-confirm').fill(password);
  await page.getByRole('button', { name: 'Create Account' }).click();
  await page.waitForURL(/\/(dashboard|$)/, { timeout: 15_000 });
}

export async function loginUser(
  page: Page,
  username: string,
  password = 'TestPassword1!',
): Promise<void> {
  await page.goto('/login');
  await page.locator('#login-user').fill(username);
  await page.locator('#login-pass').fill(password);
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL(/\/(dashboard|$)/, { timeout: 15_000 });
}

export async function logoutUser(page: Page): Promise<void> {
  await page.getByLabel('User menu').click();
  await page.getByText('Log Out').click();
  await page.waitForURL(/\/login/, { timeout: 10_000 });
}

export async function expectDashboard(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/(dashboard|$)/);
  await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 10_000 });
}

export async function clearAuth(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.removeItem('aspire-academy-auth'));
}

/* ---------- fake auth injection ---------- */

export async function injectAuth(page: Page, token: string, user: Record<string, unknown>): Promise<void> {
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem(
        'aspire-academy-auth',
        JSON.stringify({ state: { token, user }, version: 0 }),
      );
    },
    { token, user },
  );
}

export const FAKE_USER = {
  id: 'test-id',
  username: 'testuser',
  displayName: 'Test User',
  email: 'test@test.com',
  avatarUrl: '',
  bio: null,
  currentLevel: 1,
  currentRank: 'aspire-intern',
  totalXp: 0,
  loginStreakDays: 0,
  createdAt: new Date().toISOString(),
};

/* ---------- navigation helpers ---------- */

export async function navigateToWorld(page: Page, worldName = 'Aspire Foundations'): Promise<void> {
  await page.getByRole('main').getByText(worldName).click();
  await page.waitForURL(/\/worlds\//);
  await expect(page.getByText(/back to dashboard/i)).toBeVisible({ timeout: 10_000 });
}

export async function navigateToFirstLearnLesson(page: Page): Promise<void> {
  const learnLesson = page.locator('[role="button"]').filter({ hasText: '📖' });
  await expect(learnLesson.first()).toBeVisible({ timeout: 10_000 });
  await learnLesson.first().click();
  await page.waitForURL(/\/lessons\//);
  await expect(page.getByText(/back to/i)).toBeVisible({ timeout: 10_000 });
}

export async function loginAndGoToDashboard(page: Page, username: string): Promise<void> {
  await loginUser(page, username);
  await expectDashboard(page);
}

export async function loginAndGoToWorld(page: Page, username: string, worldName = 'Aspire Foundations'): Promise<void> {
  await loginUser(page, username);
  await expectDashboard(page);
  await navigateToWorld(page, worldName);
}

export async function loginAndGoToFirstLesson(page: Page, username: string): Promise<void> {
  await loginAndGoToWorld(page, username);
  await navigateToFirstLearnLesson(page);
}

export async function completeLearnLessons(page: Page, worldUrl: string, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    const availableLearn = page.locator('[role="button"]').filter({ hasText: /○/ }).filter({ hasText: /📖/ });
    if ((await availableLearn.count()) === 0) break;

    await availableLearn.first().click();
    await page.waitForURL(/\/lessons\//, { timeout: 10_000 });
    const markBtn = page.getByRole('button', { name: /mark complete/i });
    await expect(markBtn).toBeVisible({ timeout: 10_000 });
    await markBtn.click();
    await page.waitForTimeout(1_500);

    await page.goto(worldUrl);
    await page.reload();
    await expect(page.locator('[role="button"]').filter({ hasText: /XP/ }).first()).toBeVisible({ timeout: 10_000 });
  }
}
