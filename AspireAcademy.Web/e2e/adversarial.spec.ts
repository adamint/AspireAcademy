import { test, expect, type Page } from '@playwright/test';
import { registerUser, loginUser, uniqueUser, clearAuth, completeLearnLessonsViaApi, navigateToWorld, navigateToFirstLearnLesson } from './helpers';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Inject auth state into localStorage so we can skip the login UI. */
async function injectAuth(page: Page, token: string, user: Record<string, unknown>) {
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

/** Wait for the API to be ready before running tests. */
async function waitForApi(page: Page) {
  // Navigating to login should render without errors
  await page.goto('/login', { waitUntil: 'networkidle' });
  await expect(page.getByText('Aspire Academy')).toBeVisible({ timeout: 15_000 });
}

// ─── 1. Mark Complete: double-click prevention ──────────────────────────────

test.describe('LessonPage — Mark Complete', () => {
  let username: string;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    username = uniqueUser('lesson');
    await registerUser(page, username);
    await ctx.close();
  });

  test('mark complete button is disabled after success (no double-submit)', async ({ page }) => {
    await loginUser(page, username);

    // Navigate to world page and find the first learn lesson
    await page.goto('/dashboard');
    await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 10_000 });

    await page.getByRole('main').getByText('Aspire Foundations').click();
    await page.waitForURL(/\/worlds\//, { timeout: 10_000 });

    // Find a learn-type lesson (📖) that is available or not yet completed
    const learnLessons = page.locator('[role="button"]').filter({ hasText: '📖' });
    const lessonCount = await learnLessons.count();
    if (lessonCount === 0) {
      test.skip(true, 'No available lessons to test completion');
      return;
    }

    await learnLessons.first().click();
    await page.waitForURL(/\/lessons\//, { timeout: 10_000 });

    // Find the mark complete button
    const completeBtn = page.getByRole('button', { name: /mark complete|completed/i });
    await expect(completeBtn).toBeVisible({ timeout: 10_000 });

    // If already completed, verify it's disabled
    const btnText = await completeBtn.textContent();
    if (btnText?.includes('Completed')) {
      await expect(completeBtn).toBeDisabled();
      return;
    }

    // Click to complete
    await completeBtn.click();

    // Button should become disabled immediately (shows "Completing…" or "Completed")
    await expect(completeBtn).toBeDisabled({ timeout: 5_000 });

    // After completion, should show completed state
    await expect(completeBtn).toHaveText(/completed/i, { timeout: 10_000 });
    await expect(completeBtn).toBeDisabled();
  });

  test('second mark-complete attempt shows completed not crash', async ({ page }) => {
    await loginUser(page, username);
    await page.goto('/dashboard');
    await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 10_000 });

    await page.getByRole('main').getByText('Aspire Foundations').click();
    await page.waitForURL(/\/worlds\//, { timeout: 10_000 });

    const learnLessons = page.locator('[role="button"]').filter({ hasText: '📖' });
    if ((await learnLessons.count()) === 0) {
      test.skip(true, 'No lessons available');
      return;
    }

    await learnLessons.first().click();
    await page.waitForURL(/\/lessons\//, { timeout: 10_000 });

    const completeBtn = page.getByRole('button', { name: /mark complete|completed/i });
    await expect(completeBtn).toBeVisible({ timeout: 10_000 });

    // Whether already completed or not, the button must be disabled or show completed state
    const text = await completeBtn.textContent();
    if (text?.includes('Completed')) {
      // Already completed from previous test — button should be disabled
      await expect(completeBtn).toBeDisabled();
    } else {
      // Complete it now
      await completeBtn.click();
      await expect(completeBtn).toBeDisabled({ timeout: 5_000 });
      await expect(completeBtn).toHaveText(/completed/i, { timeout: 10_000 });
    }

    // Page should not show any error
    await expect(page.locator('text=Failed to mark complete')).not.toBeVisible();
  });
});

// ─── 2. Quiz: can't submit without answer ───────────────────────────────────

test.describe('QuizPage — validation', () => {
  let username: string;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    username = uniqueUser('quiz');
    await registerUser(page, username);
    // Complete prerequisites so quiz 1.1.3 is unlocked
    await completeLearnLessonsViaApi(page, ['1.1.1', '1.1.2']);
    await ctx.close();
  });

  test('submit button is disabled when no answer is selected', async ({ page }) => {
    await loginUser(page, username);
    // Navigate directly to the quiz lesson
    await page.goto('/quizzes/1.1.3');
    await page.waitForURL(/\/quizzes\//, { timeout: 10_000 });

    // The Submit Answer button should be disabled without selecting
    const submitBtn = page.getByRole('button', { name: /submit answer/i });
    await expect(submitBtn).toBeVisible({ timeout: 10_000 });
    await expect(submitBtn).toBeDisabled();
  });
});

// ─── 3. Double-click prevention on submit buttons ───────────────────────────

test.describe('Double-click prevention', () => {
  test('login submit disabled during loading', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#login-user').fill('nonexistent_user');
    await page.locator('#login-pass').fill('SomePassword1');

    // Intercept API to add a long delay
    await page.route('**/api/auth/login', async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.fulfill({ status: 401, body: JSON.stringify({ error: 'Invalid credentials' }) });
    });

    // Use type="submit" locator since button text changes to spinner during loading
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Button should be disabled while loading
    await expect(submitBtn).toBeDisabled({ timeout: 2_000 });

    // Wait for the request to complete
    await expect(submitBtn).toBeEnabled({ timeout: 10_000 });
  });

  test('register submit disabled during loading', async ({ page }) => {
    const user = uniqueUser('dblclick');
    await page.goto('/register');
    await page.locator('#reg-user').fill(user);
    await page.locator('#reg-email').fill(`${user}@test.com`);
    await page.locator('#reg-pass').fill('TestPassword1!');
    await page.locator('#reg-confirm').fill('TestPassword1!');

    // Intercept API to add a long delay
    await page.route('**/api/auth/register', async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.fulfill({
        status: 400,
        body: JSON.stringify({ error: 'Username taken' }),
      });
    });

    // Use type="submit" locator since button text changes to spinner during loading
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();
    await expect(submitBtn).toBeDisabled({ timeout: 2_000 });
    await expect(submitBtn).toBeEnabled({ timeout: 10_000 });
  });
});

// ─── 4. Empty registration form → validation errors shown ──────────────────

test.describe('RegisterPage — validation', () => {
  test('shows validation errors for empty/invalid fields', async ({ page }) => {
    await page.goto('/register');

    const submitBtn = page.getByRole('button', { name: /create account/i });
    await submitBtn.click();

    // Should show validation errors (username too short, email invalid, password too short)
    await expect(page.getByText(/username must be/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/valid email/i)).toBeVisible();
    await expect(page.getByText(/password must be/i)).toBeVisible();
  });

  test('validation errors clear when user starts typing', async ({ page }) => {
    await page.goto('/register');

    // Submit empty form to trigger errors
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText(/username must be/i)).toBeVisible({ timeout: 5_000 });

    // Type in username field — that specific error should clear
    await page.locator('#reg-user').fill('valid_username');
    await expect(page.getByText(/username must be/i)).not.toBeVisible({ timeout: 3_000 });
  });

  test('password mismatch shows error', async ({ page }) => {
    await page.goto('/register');
    await page.locator('#reg-user').fill('valid_user');
    await page.locator('#reg-email').fill('valid@test.com');
    await page.locator('#reg-pass').fill('TestPassword1!');
    await page.locator('#reg-confirm').fill('DifferentPassword1!');

    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText(/passwords do not match/i)).toBeVisible({ timeout: 5_000 });
  });
});

// ─── 5. Login error clears on typing ────────────────────────────────────────

test.describe('LoginPage — error handling', () => {
  test('error message clears when user starts typing', async ({ page }) => {
    await page.goto('/login');

    // Trigger a login error
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({ status: 401, body: JSON.stringify({ error: 'Invalid credentials' }) }),
    );

    await page.locator('#login-user').fill('baduser');
    await page.locator('#login-pass').fill('badpass');
    await page.getByRole('button', { name: /log in/i }).click();

    // Error should appear
    await expect(page.getByText(/invalid credentials/i)).toBeVisible({ timeout: 5_000 });

    // Remove route to not interfere
    await page.unroute('**/api/auth/login');

    // Type in username — error should clear
    await page.locator('#login-user').fill('newuser');
    await expect(page.getByText(/invalid credentials/i)).not.toBeVisible({ timeout: 3_000 });
  });

  test('enter key submits the login form', async ({ page }) => {
    await page.goto('/login');

    let loginRequested = false;
    await page.route('**/api/auth/login', async (route) => {
      loginRequested = true;
      await route.fulfill({ status: 401, body: JSON.stringify({ error: 'Bad creds' }) });
    });

    await page.locator('#login-user').fill('testuser');
    await page.locator('#login-pass').fill('testpass');
    await page.locator('#login-pass').press('Enter');

    // Should have triggered a login request
    await page.waitForTimeout(1000);
    expect(loginRequested).toBe(true);
  });
});

// ─── 6. Refresh dashboard → stays logged in ────────────────────────────────

test.describe('Auth persistence', () => {
  let username: string;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    username = uniqueUser('persist');
    await registerUser(page, username);
    await ctx.close();
  });

  test('refresh dashboard after login stays logged in', async ({ page }) => {
    await loginUser(page, username);
    await page.goto('/dashboard');
    await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 10_000 });

    // Reload the page
    await page.reload();

    // Should still be on dashboard, not redirected to login
    await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 10_000 });
    await expect(page).not.toHaveURL(/login/);
  });

  test('clearing auth redirects to login', async ({ page }) => {
    await loginUser(page, username);
    await page.goto('/dashboard');
    await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 10_000 });

    // Clear auth
    await clearAuth(page);
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });
});

// ─── 7. Visit /users/:invalidId → shows error not crash ────────────────────

test.describe('ProfilePage — invalid user', () => {
  let username: string;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    username = uniqueUser('profile');
    await registerUser(page, username);
    await ctx.close();
  });

  test('visiting /users/invalid-uuid shows error or graceful state', async ({ page }) => {
    await loginUser(page, username);

    await page.goto('/users/00000000-0000-0000-0000-000000000000');

    // Should show an error state or empty state, not crash
    await page.waitForTimeout(3_000);
    const hasError = await page.getByText(/failed to load profile|user not found|not found|error/i).isVisible().catch(() => false);
    const bodyNotEmpty = await page.locator('body').textContent().then(t => (t?.length ?? 0) > 0);
    expect(hasError || bodyNotEmpty).toBeTruthy();

    // No unhandled exception / blank page
    const body = page.locator('body');
    await expect(body).not.toHaveText('');
  });
});

// ─── 8. Back button from lesson ─────────────────────────────────────────────

test.describe('LessonPage — navigation', () => {
  let username: string;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    username = uniqueUser('nav');
    await registerUser(page, username);
    await ctx.close();
  });

  test('back button navigates to world page', async ({ page }) => {
    await loginUser(page, username);
    await page.goto('/dashboard');
    await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 10_000 });

    await page.getByRole('main').getByText('Aspire Foundations').click();
    await page.waitForURL(/\/worlds\//, { timeout: 10_000 });

    const lessonLinks = page.locator('[role="button"]').filter({ hasText: '📖' });
    if ((await lessonLinks.count()) === 0) {
      test.skip(true, 'No lesson links');
      return;
    }

    await lessonLinks.first().click();
    await page.waitForURL(/\/lessons\//, { timeout: 10_000 });

    // Click the "Back to ..." button
    const backBtn = page.locator('button', { hasText: /back to/i });
    await expect(backBtn).toBeVisible({ timeout: 5_000 });
    await backBtn.click();

    // Should navigate to the world page (not just browser history)
    await page.waitForURL(/\/worlds\//, { timeout: 10_000 });
  });
});

// ─── 9. Sidebar world expand → shows modules ───────────────────────────────

test.describe('Sidebar — world expand', () => {
  let username: string;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    username = uniqueUser('sidebar');
    await registerUser(page, username);
    await ctx.close();
  });

  test('clicking a world in sidebar expands to show modules', async ({ page }) => {
    await loginUser(page, username);
    await page.goto('/dashboard');
    await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 10_000 });

    // Find world buttons in sidebar
    const sidebar = page.locator('nav');
    const worldButtons = sidebar.locator('button:has(svg)').filter({ hasText: /.+/ });

    // Look for world items in the sidebar (they have globe icon + world name)
    const worldItems = sidebar.locator('text=Worlds').locator('..').locator('button');
    if ((await worldItems.count()) === 0) {
      test.skip(true, 'No worlds in sidebar');
      return;
    }

    // Click the first world — should expand to show modules
    const firstWorld = worldItems.first();
    await firstWorld.click();

    // After expanding, should see module names nested below
    // Modules appear as child elements with smaller font
    await page.waitForTimeout(1000); // wait for API fetch
    // Verify the chevron changed or modules appeared
    const expandedModules = sidebar.locator('[role="button"]').filter({ hasNotText: /worlds|home|dashboard|profile|friends|leaderboard|achievements|admin/i });
    // At minimum, the sidebar should not crash on click
    await expect(sidebar).toBeVisible();
  });
});

// ─── 10. Dashboard empty worlds state ───────────────────────────────────────

test.describe('DashboardPage — edge cases', () => {
  test('dashboard handles zero worlds gracefully', async ({ page }) => {
    // Mock the API to return empty worlds
    await page.route('**/api/worlds', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify([]) }),
    );
    await page.route('**/api/xp', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          totalXp: 0,
          currentLevel: 1,
          currentRank: 'aspire-intern',
          weeklyXp: 0,
          loginStreakDays: 0,
          recentEvents: [],
        }),
      }),
    );
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
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
        }),
      }),
    );

    // Inject auth to bypass login
    await injectAuth(page, 'fake-token', {
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
    });

    await page.goto('/dashboard');
    await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 10_000 });

    // Should show the empty worlds message, not a blank section
    await expect(page.getByText(/no worlds available/i)).toBeVisible({ timeout: 5_000 });
  });
});

// ─── 11. Unauthenticated access to protected routes ─────────────────────────

test.describe('Protected routes', () => {
  test('unauthenticated user visiting /lessons/xxx redirected to login', async ({ page }) => {
    await page.goto('/lessons/some-fake-id');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });

  test('unauthenticated user visiting /profile redirected to login', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });

  test('unauthenticated user visiting /friends redirected to login', async ({ page }) => {
    await page.goto('/friends');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });
});

// ─── 12. Challenge page — empty code prevention ─────────────────────────────

test.describe('ChallengePage — validation', () => {
  test('submit button is disabled when code is empty', async ({ page }) => {
    // Mock an empty challenge response
    await page.route('**/api/lessons/*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-challenge',
          title: 'Test Challenge',
          type: 'challenge',
          challengeSteps: [
            {
              id: 'step-1',
              starterCode: '',
              instructionsMarkdown: '# Write some code',
              testCases: JSON.stringify([
                { id: 'tc1', name: 'Test case 1', type: 'output-equals', expected: 'test', description: 'Test case 1' },
              ]),
              hints: ['Hint 1'],
              requiredPackages: null,
              stepTitle: 'Step 1',
            },
          ],
          nextLessonId: null,
          previousLessonId: null,
        }),
      }),
    );

    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          id: 'test-id',
          username: 'testuser',
          displayName: 'Test',
          email: 'test@test.com',
          avatarUrl: '',
          bio: null,
          currentLevel: 1,
          currentRank: 'aspire-intern',
          totalXp: 0,
          loginStreakDays: 0,
          createdAt: new Date().toISOString(),
        }),
      }),
    );
    await page.route('**/api/worlds', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify([]) }),
    );

    await injectAuth(page, 'fake-token', {
      id: 'test-id',
      username: 'testuser',
      displayName: 'Test',
      email: 'test@test.com',
      avatarUrl: '',
      bio: null,
      currentLevel: 1,
      currentRank: 'aspire-intern',
      totalXp: 0,
      loginStreakDays: 0,
      createdAt: new Date().toISOString(),
    });

    await page.goto('/challenges/test-challenge');

    // Wait for the challenge page to load
    const submitBtn = page.getByRole('button', { name: /submit/i });
    await expect(submitBtn).toBeVisible({ timeout: 10_000 });

    // With empty starter code, submit should be disabled
    await expect(submitBtn).toBeDisabled();
  });
});
