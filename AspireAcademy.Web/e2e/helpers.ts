import { Page, expect } from '@playwright/test';

/**
 * Generate a unique username based on a prefix and timestamp to avoid collisions.
 */
export function uniqueUser(prefix = 'e2e'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Register a new user via the UI and wait for redirect to the dashboard.
 */
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

/**
 * Log in an existing user via the UI and wait for redirect to the dashboard.
 */
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

/**
 * Log out via the avatar menu in the TopBar.
 */
export async function logoutUser(page: Page): Promise<void> {
  await page.getByLabel('User menu').click();
  await page.getByText('Log Out').click();
  await page.waitForURL(/\/login/, { timeout: 10_000 });
}

/**
 * Ensure we're on the dashboard (logged-in state).
 */
export async function expectDashboard(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/(dashboard|$)/);
  await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 10_000 });
}

/**
 * Clear auth state from localStorage so the next navigation starts unauthenticated.
 */
export async function clearAuth(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.removeItem('aspire-academy-auth'));
}
