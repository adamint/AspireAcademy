import { test, expect } from '@playwright/test';
import {
  uniqueUser,
  registerUser,
  loginUser,
  logoutUser,
  expectDashboard,
  clearAuth,
} from './helpers';

test.describe.serial('Authentication flows', () => {
  const username = uniqueUser('auth');
  const password = 'TestPassword1!';

  test('register new user', async ({ page }) => {
    await registerUser(page, username, password);
    await expectDashboard(page);
  });

  test('register with duplicate username', async ({ page }) => {
    await page.goto('/register');
    await page.locator('#reg-user').fill(username);
    await page.locator('#reg-email').fill(`dup_${username}@test.com`);
    await page.locator('#reg-display').fill('DupUser');
    await page.locator('#reg-pass').fill(password);
    await page.locator('#reg-confirm').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page.getByText(/username is already taken/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test('register with weak password', async ({ page }) => {
    const weak = uniqueUser('weak');
    await page.goto('/register');
    await page.locator('#reg-user').fill(weak);
    await page.locator('#reg-email').fill(`${weak}@test.com`);
    await page.locator('#reg-pass').fill('123');
    await page.locator('#reg-confirm').fill('123');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(
      page.getByText(/password must be 8\+ characters/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('login with valid credentials', async ({ page }) => {
    await loginUser(page, username, password);
    await expectDashboard(page);
  });

  test('login with wrong password', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#login-user').fill(username);
    await page.locator('#login-pass').fill('WrongPassword1!');
    await page.getByRole('button', { name: /log in/i }).click();

    await expect(page.getByText(/invalid credentials/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test('logout redirects to login', async ({ page }) => {
    await loginUser(page, username, password);
    await logoutUser(page);
    await expect(page).toHaveURL(/\/login/);
  });

  test('protected route redirect', async ({ page }) => {
    await page.goto('/login');
    await clearAuth(page);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('session persistence across reload', async ({ page }) => {
    await loginUser(page, username, password);
    await expectDashboard(page);

    await page.reload();
    await expectDashboard(page);
  });
});
