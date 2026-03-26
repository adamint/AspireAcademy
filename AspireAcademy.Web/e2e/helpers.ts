import { Page, expect } from '@playwright/test';

/**
 * ⚠️ DEPRECATED: These TypeScript Playwright tests are being migrated to C# using Microsoft.Playwright
 * in the unified .NET test project at AspireAcademy.Api.Tests/E2E/.
 * See: AspireAcademy.Api.Tests/E2E/E2EHelpers.cs and the *Tests.cs files.
 * Run `dotnet test AspireAcademy.Api.Tests/` to execute the migrated tests.
 */

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

/* ---------- API helpers ---------- */

export async function getAuthToken(page: Page): Promise<string> {
  const authJson = await page.evaluate(() => localStorage.getItem('aspire-academy-auth'));
  const parsed = JSON.parse(authJson!);
  return parsed.state.token;
}

export async function completeLearnLessonsViaApi(page: Page, lessonIds: string[]): Promise<void> {
  const token = await getAuthToken(page);
  for (const lessonId of lessonIds) {
    const resp = await page.request.post('/api/progress/complete', {
      headers: { Authorization: `Bearer ${token}` },
      data: { lessonId },
    });
    if (!resp.ok()) {
      console.warn(`Failed to complete lesson ${lessonId}: ${resp.status()}`);
    }
  }
}

export async function submitQuizViaApi(
  page: Page,
  lessonId: string,
  correctOptionMap: Record<string, string[]>,
): Promise<void> {
  const token = await getAuthToken(page);
  // Fetch lesson detail to get quiz question GUIDs
  const lessonResp = await page.request.get(`/api/lessons/${lessonId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!lessonResp.ok()) {
    console.warn(`Failed to fetch lesson ${lessonId}: ${lessonResp.status()}`);
    return;
  }
  const lesson = await lessonResp.json();
  const questions = lesson.quiz?.questions;
  if (!questions?.length) return;

  // Build answers by matching question text to correct options
  const answers = questions.map((q: { id: string; questionText: string }) => {
    // Find the correct answer for this question by checking each mapping
    for (const [, optionIds] of Object.entries(correctOptionMap)) {
      // Use the question index + 1 to match against ordered answers
      const idx = questions.indexOf(q);
      const orderedKeys = Object.keys(correctOptionMap);
      if (idx < orderedKeys.length) {
        return {
          questionId: q.id,
          selectedOptionIds: correctOptionMap[orderedKeys[idx]],
        };
      }
    }
    return { questionId: q.id, selectedOptionIds: ['a'] };
  });

  await page.request.post(`/api/quizzes/${lessonId}/submit`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { answers },
  });
}

/**
 * Unlocks module 1.2 by completing all of module 1.1 (learn + quiz + boss)
 * and then completes learn lessons in module 1.2 up to the challenge.
 */
export async function unlockFirstChallenge(page: Page): Promise<void> {
  // Complete learn lessons in module 1.1
  await completeLearnLessonsViaApi(page, ['1.1.1', '1.1.2']);

  // Submit quiz 1.1.3 with correct answers (all correct: b, c, b, b)
  await submitQuizViaApi(page, '1.1.3', {
    q1: ['b'], q2: ['c'], q3: ['b'], q4: ['b'],
  });

  // Submit boss 1.1-boss with correct answers (all correct: b, b, b, b, c)
  await submitQuizViaApi(page, '1.1-boss', {
    q1: ['b'], q2: ['b'], q3: ['b'], q4: ['b'], q5: ['c'],
  });

  // Complete learn lessons in module 1.2
  await completeLearnLessonsViaApi(page, ['1.2.1', '1.2.2', '1.2.3', '1.2.4']);
}

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
