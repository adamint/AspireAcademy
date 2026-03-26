import { test, expect } from '@playwright/test';
import {
  uniqueUser,
  registerUser,
  loginUser,
  logoutUser,
  expectDashboard,
  clearAuth,
} from './helpers';

test.describe.serial('Authentication — complete coverage', () => {
  const username = uniqueUser('auth');
  const password = 'TestPassword1!';

  /* ─── Registration ─── */

  test('register with valid data → redirect to dashboard', async ({ page }) => {
    await registerUser(page, username, password);
    await expectDashboard(page);
  });

  test('register with empty username → validation error', async ({ page }) => {
    await page.goto('/register');
    // leave username blank, fill everything else
    await page.locator('#reg-email').fill('empty@test.com');
    await page.locator('#reg-pass').fill(password);
    await page.locator('#reg-confirm').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(
      page.getByText(/username must be 3/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('register with empty email → validation error', async ({ page }) => {
    await page.goto('/register');
    await page.locator('#reg-user').fill('validuser');
    // leave email blank
    await page.locator('#reg-pass').fill(password);
    await page.locator('#reg-confirm').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(
      page.getByText(/valid email/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('register with short password → validation error', async ({ page }) => {
    const user = uniqueUser('short');
    await page.goto('/register');
    await page.locator('#reg-user').fill(user);
    await page.locator('#reg-email').fill(`${user}@test.com`);
    await page.locator('#reg-pass').fill('123');
    await page.locator('#reg-confirm').fill('123');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(
      page.getByText(/password must be 8\+/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('register with mismatched passwords → validation error', async ({ page }) => {
    const user = uniqueUser('mismatch');
    await page.goto('/register');
    await page.locator('#reg-user').fill(user);
    await page.locator('#reg-email').fill(`${user}@test.com`);
    await page.locator('#reg-pass').fill(password);
    await page.locator('#reg-confirm').fill('DifferentPassword1!');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(
      page.getByText(/passwords do not match/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('register with duplicate username → server error', async ({ page }) => {
    await page.goto('/register');
    await page.locator('#reg-user').fill(username); // already registered
    await page.locator('#reg-email').fill(`dup_${Date.now()}@test.com`);
    await page.locator('#reg-display').fill('DupUser');
    await page.locator('#reg-pass').fill(password);
    await page.locator('#reg-confirm').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(
      page.getByText(/already taken|already exists|duplicate/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('register with duplicate email → server error', async ({ page }) => {
    const otherUser = uniqueUser('dupemail');
    await page.goto('/register');
    await page.locator('#reg-user').fill(otherUser);
    await page.locator('#reg-email').fill(`${username}@test.com`); // already used
    await page.locator('#reg-display').fill(otherUser);
    await page.locator('#reg-pass').fill(password);
    await page.locator('#reg-confirm').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(
      page.getByText(/already taken|already exists|already in use|duplicate/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  /* ─── Login ─── */

  test('login with valid credentials → redirect to dashboard', async ({ page }) => {
    await loginUser(page, username, password);
    await expectDashboard(page);
  });

  test('login with wrong password → error message', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#login-user').fill(username);
    await page.locator('#login-pass').fill('WrongPassword1!');
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(
      page.getByText(/invalid|incorrect|failed|wrong/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('login with non-existent user → error message', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#login-user').fill('no_such_user_xyz_999');
    await page.locator('#login-pass').fill(password);
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(
      page.getByText(/invalid|not found|failed|credentials/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('login with empty fields → HTML validation prevents submit', async ({ page }) => {
    await page.goto('/login');
    // Both fields have HTML required — clicking submit should not navigate
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  /* ─── Session management ─── */

  test('logout → redirected to login', async ({ page }) => {
    await loginUser(page, username, password);
    await logoutUser(page);
    await expect(page).toHaveURL(/\/login/);
  });

  test('refresh page while logged in → stays on dashboard', async ({ page }) => {
    await loginUser(page, username, password);
    await expectDashboard(page);
    await page.reload();
    await expectDashboard(page);
  });

  test('visit protected page while logged out → redirect to login', async ({ page }) => {
    await page.goto('/login');
    await clearAuth(page);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('visit /register while logged in → shows register page', async ({ page }) => {
    await loginUser(page, username, password);
    await page.goto('/register');
    // Register is a public route — it always shows
    await expect(
      page.getByText(/create your hero account/i)
        .or(page.getByRole('button', { name: 'Create Account' })),
    ).toBeVisible({ timeout: 5_000 });
  });
});
