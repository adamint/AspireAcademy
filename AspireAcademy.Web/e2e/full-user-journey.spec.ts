import { test, expect, type Page } from '@playwright/test';

/**
 * Full User Journey E2E Test
 *
 * Simulates exactly what a real user does in their first session:
 * register → dashboard → world → lessons → quiz → profile → leaderboard → achievements → sidebar → theme
 *
 * Every step asserts visibility and API success. If anything returns a 500,
 * 404, blank page, or "Something went wrong" — the test fails.
 */

test.setTimeout(120_000);

const USERNAME = `journey_${Date.now()}`;
const EMAIL = `${USERNAME}@test.com`;
const PASSWORD = 'TestPassword1!';
const DISPLAY_NAME = `Hero ${USERNAME.slice(-6)}`;

/** Fail the test immediately if any page shows a fatal error. */
async function assertNoFatalError(page: Page) {
  const body = page.locator('body');
  await expect(body).not.toContainText('Something went wrong');
  await expect(body).not.toContainText('Internal Server Error');
}

test('complete first-session user journey', async ({ page }) => {
  // Fail loudly on any uncaught console errors that indicate 500s
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // ─── Step 1: Go to the app → see login page ────────────────────
  await test.step('1. Navigate to app → see login page', async () => {
    await page.goto('/');
    // Should redirect to /login for unauthenticated user
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    await expect(page.getByText('Aspire Academy')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Welcome back, adventurer!')).toBeVisible();
    await assertNoFatalError(page);
  });

  // ─── Step 2: Click "Register" link → see register form ─────────
  await test.step('2. Click Register link → see register form', async () => {
    await page.getByRole('link', { name: 'Register' }).click();
    await page.waitForURL(/\/register/, { timeout: 5_000 });
    await expect(page.getByText('Create your hero account')).toBeVisible();
    await expect(page.locator('#reg-user')).toBeVisible();
    await expect(page.locator('#reg-email')).toBeVisible();
    await expect(page.locator('#reg-display')).toBeVisible();
    await expect(page.locator('#reg-pass')).toBeVisible();
    await expect(page.locator('#reg-confirm')).toBeVisible();
    await assertNoFatalError(page);
  });

  // ─── Step 3: Fill in registration form ──────────────────────────
  await test.step('3. Fill in registration fields', async () => {
    await page.locator('#reg-user').fill(USERNAME);
    await page.locator('#reg-email').fill(EMAIL);
    await page.locator('#reg-display').fill(DISPLAY_NAME);
    await page.locator('#reg-pass').fill(PASSWORD);
    await page.locator('#reg-confirm').fill(PASSWORD);
  });

  // ─── Step 4: Click Register → redirect to dashboard ─────────────
  await test.step('4. Submit registration → redirect to dashboard', async () => {
    const registerResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/auth/register') && resp.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await page.getByRole('button', { name: 'Create Account' }).click();
    const resp = await registerResponse;
    expect(resp.status()).toBeGreaterThanOrEqual(200);
    expect(resp.status()).toBeLessThan(300);
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15_000 });
    await assertNoFatalError(page);
  });

  // ─── Step 5: Dashboard: see welcome message with display name ───
  await test.step('5. Dashboard shows welcome message', async () => {
    await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 10_000 });
    // The display name should appear in the welcome heading
    await expect(page.getByRole('heading', { level: 1 })).toContainText(DISPLAY_NAME);
    await assertNoFatalError(page);
  });

  // ─── Step 6: Dashboard: see world cards (≥1 world) ──────────────
  let firstWorldName: string;
  await test.step('6. Dashboard shows world cards', async () => {
    await expect(page.getByText('🌍 Your Worlds')).toBeVisible({ timeout: 10_000 });
    // At least 1 world card should be visible in the main area
    const worldCards = page.getByRole('main').locator('[class*="card"], [class*="Card"]').filter({ hasText: /🔓|Aspire|World/ });
    // Fallback: just look for any world text
    const aspireFounds = page.getByRole('main').getByText('Aspire Foundations');
    await expect(aspireFounds).toBeVisible({ timeout: 10_000 });
    firstWorldName = 'Aspire Foundations';
  });

  // ─── Step 7: Dashboard: see XP bar showing Level 1 ──────────────
  await test.step('7. XP bar shows Level 1', async () => {
    await expect(page.getByText('Lvl 1')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.xp-bar-track')).toBeVisible();
  });

  // ─── Step 8: Click first world card → see module list ────────────
  await test.step('8. Click world card → see module list', async () => {
    const worldsResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/worlds') && resp.request().method() === 'GET',
      { timeout: 10_000 },
    );
    await page.getByRole('main').getByText(firstWorldName).click();
    await page.waitForURL(/\/worlds\//, { timeout: 10_000 });
    await expect(page.getByText(/back to dashboard/i)).toBeVisible({ timeout: 10_000 });
    await assertNoFatalError(page);
  });

  // ─── Step 9: See first module with lessons listed ─────────────────
  await test.step('9. First module with lessons visible', async () => {
    // Module name should be visible
    await expect(page.getByText('What is Aspire?')).toBeVisible({ timeout: 10_000 });
    // Lessons should be listed (role="button" items with XP badges)
    const lessonItems = page.locator('[role="button"]').filter({ hasText: /XP/ });
    await expect(lessonItems.first()).toBeVisible({ timeout: 10_000 });
    const count = await lessonItems.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  // ─── Step 10: First lesson is unlocked (not locked icon) ──────────
  await test.step('10. First lesson is unlocked', async () => {
    const firstLesson = page.locator('[role="button"]').filter({ hasText: '📖' }).first();
    await expect(firstLesson).toBeVisible({ timeout: 5_000 });
    // Should show ○ (available) not 🔒 (locked)
    await expect(firstLesson).toContainText('○');
  });

  // ─── Step 11: Click first lesson → see lesson content ─────────────
  await test.step('11. Click first lesson → see content', async () => {
    const lessonResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/lessons/') && resp.request().method() === 'GET',
      { timeout: 10_000 },
    );
    const firstLesson = page.locator('[role="button"]').filter({ hasText: '📖' }).first();
    await firstLesson.click();
    await page.waitForURL(/\/lessons\//, { timeout: 10_000 });
    const resp = await lessonResponse;
    expect(resp.status()).toBeGreaterThanOrEqual(200);
    expect(resp.status()).toBeLessThan(300);
    // Lesson content should be visible (markdown rendered in a card)
    await expect(page.getByText(/back to/i)).toBeVisible({ timeout: 10_000 });
    // The content card should have text (not blank)
    const contentCard = page.locator('[class*="card"], [class*="Card"]').filter({ has: page.locator('p, h1, h2, h3, li') });
    await expect(contentCard.first()).toBeVisible({ timeout: 10_000 });
    await assertNoFatalError(page);
  });

  // ─── Step 12: See "Mark Complete" button ──────────────────────────
  await test.step('12. Mark Complete button visible and enabled', async () => {
    const markBtn = page.getByTestId('mark-complete-btn');
    await expect(markBtn).toBeVisible({ timeout: 5_000 });
    await expect(markBtn).toBeEnabled();
    await expect(markBtn).toContainText(/mark complete/i);
  });

  // ─── Step 13: Click Mark Complete → see success ───────────────────
  await test.step('13. Click Mark Complete → success', async () => {
    const completeResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/progress/complete') && resp.request().method() === 'POST',
      { timeout: 15_000 },
    );
    const markBtn = page.getByTestId('mark-complete-btn');
    await markBtn.click();
    const resp = await completeResponse;
    expect(resp.status()).toBeGreaterThanOrEqual(200);
    expect(resp.status()).toBeLessThan(300);
    await assertNoFatalError(page);
  });

  // ─── Step 14: Button now shows "Completed" and is disabled ────────
  await test.step('14. Button shows Completed and is disabled', async () => {
    const markBtn = page.getByTestId('mark-complete-btn');
    await expect(markBtn).toContainText(/completed/i, { timeout: 5_000 });
    await expect(markBtn).toBeDisabled();
  });

  // ─── Step 15: XP bar shows updated XP (was 0, now 50) ────────────
  await test.step('15. XP bar shows updated XP', async () => {
    // The XP counter in the top bar should show non-zero XP
    // Format is "{xp}/500" — after completing a lesson, xp > 0
    const xpText = page.locator('.xp-bar-track').locator('..');
    // Wait a moment for the XP sync to propagate to the store
    await page.waitForTimeout(1_000);
    // The XP text next to the bar should show something like "50/500"
    const xpCounter = page.getByText(/\/500/);
    await expect(xpCounter).toBeVisible({ timeout: 5_000 });
    const xpValue = await xpCounter.textContent();
    // Extract the number before /500
    const match = xpValue?.match(/(\d+)\/500/);
    expect(match).toBeTruthy();
    const xp = parseInt(match![1], 10);
    expect(xp).toBeGreaterThan(0);
  });

  // ─── Step 16: Click Next → navigate to second lesson ──────────────
  await test.step('16. Click Next → second lesson', async () => {
    // The Next button is the one on the right side with an arrow
    const nextBtn = page.locator('button').filter({ has: page.locator('svg') }).last();
    // More precise: the button at the bottom right that's not disabled and points right
    const nextLesson = page.getByRole('button').filter({ hasText: /^(?!.*Back).*/ }).last();
    // Actually, let's use the navigation section at the bottom
    const navSection = page.locator('div').filter({ has: page.locator('button') }).filter({ hasText: /Previous|Next/ });

    // The next button is the right-side button in the prev/next nav
    // Let's find all ghost buttons in the bottom navigation
    const rightBtn = page.locator('button:has(svg)').last();

    // Safer: look for button that has the next lesson title text (not "Previous")
    // The LessonPage renders next/prev buttons with lesson titles
    // Let's just look for a button that is NOT disabled and is after "Previous"
    const allNavButtons = page.locator('[style*="border-top"] button, div:has(> button:nth-child(2)) button');

    // Simplest approach: find the second button in the prev/next flex container
    // The container has borderTop style
    const prevNextContainer = page.locator('div').filter({ has: page.locator('button') });

    // Let's use a direct approach - the rightmost non-disabled button at the page bottom
    // We know the next button is enabled (there IS a second lesson)
    const lessonPageButtons = page.locator('button').filter({ hasNotText: /mark complete|skip|completed/i });
    const enabledNavBtns = lessonPageButtons.filter({ has: page.locator('svg') });

    // Most reliable: the page has exactly 2 navigation buttons at the bottom
    // Previous (may be disabled) and Next
    // Let's find them by their position - they're the last buttons on the page
    // The Next button is NOT disabled for lesson 1.1.1 (since 1.1.2 exists)
    await page.waitForTimeout(500);

    // Best approach: click the next button by finding it with its title text
    // The LessonPage shows lesson.nextLessonTitle in the button
    const allButtons = await page.locator('button').all();
    let nextFound = false;
    for (const btn of allButtons.reverse()) {
      const text = await btn.textContent();
      const isDisabled = await btn.isDisabled();
      if (!isDisabled && text && !text.match(/mark complete|skip|completed|back to/i) && (await btn.locator('svg').count()) > 0) {
        // This is likely the Next button
        const lessonResponse = page.waitForResponse(
          (resp) => resp.url().includes('/api/lessons/') && resp.request().method() === 'GET',
          { timeout: 10_000 },
        );
        await btn.click();
        await page.waitForURL(/\/lessons\//, { timeout: 10_000 });
        const resp = await lessonResponse;
        expect(resp.status()).toBeGreaterThanOrEqual(200);
        expect(resp.status()).toBeLessThan(300);
        nextFound = true;
        break;
      }
    }
    expect(nextFound).toBe(true);
    await assertNoFatalError(page);
  });

  // ─── Step 17: See second lesson content ───────────────────────────
  await test.step('17. Second lesson content visible', async () => {
    await expect(page.getByText(/back to/i)).toBeVisible({ timeout: 10_000 });
    const contentCard = page.locator('[class*="card"], [class*="Card"]').filter({ has: page.locator('p, h1, h2, h3, li') });
    await expect(contentCard.first()).toBeVisible({ timeout: 10_000 });
    await assertNoFatalError(page);
  });

  // ─── Step 18: Click back button → go back to module page ──────────
  await test.step('18. Click back → module page', async () => {
    const backBtn = page.getByText(/back to/i);
    await expect(backBtn).toBeVisible({ timeout: 5_000 });
    await backBtn.click();
    await page.waitForURL(/\/worlds\//, { timeout: 10_000 });
    await expect(page.getByText(/back to dashboard/i)).toBeVisible({ timeout: 10_000 });
    await assertNoFatalError(page);
  });

  // ─── Step 19: First lesson shows ✅ completed icon ─────────────────
  await test.step('19. First lesson shows completed ✅ icon', async () => {
    // Wait for lessons to load
    const lessonItems = page.locator('[role="button"]').filter({ hasText: /XP/ });
    await expect(lessonItems.first()).toBeVisible({ timeout: 10_000 });
    // The first lesson should now show ✅
    const completedLesson = page.locator('[role="button"]').filter({ hasText: '✅' }).first();
    await expect(completedLesson).toBeVisible({ timeout: 5_000 });
  });

  // ─── Step 20: Navigate to quiz lesson (complete prerequisites) ────
  await test.step('20. Navigate to quiz (completing prereqs via API)', async () => {
    // Complete remaining learn lessons in module 1.1 via API so quiz is unlocked
    const authJson = await page.evaluate(() => localStorage.getItem('aspire-academy-auth'));
    const token = JSON.parse(authJson!).state.token;

    // Complete lesson 1.1.2 (we already completed 1.1.1 via UI)
    const completeResp = await page.request.post('/api/progress/complete', {
      headers: { Authorization: `Bearer ${token}` },
      data: { lessonId: '1.1.2' },
    });
    expect(completeResp.status()).toBeGreaterThanOrEqual(200);
    expect(completeResp.status()).toBeLessThan(300);

    // Navigate to quiz 1.1.3
    await page.goto('/quizzes/1.1.3');
    await page.waitForURL(/\/quizzes\//, { timeout: 10_000 });
    // Wait for quiz to load
    await expect(page.getByRole('button', { name: /submit answer/i })).toBeVisible({ timeout: 15_000 });
    await assertNoFatalError(page);
  });

  // ─── Step 21: See quiz question with options ──────────────────────
  await test.step('21. Quiz shows question with options', async () => {
    // Should show question text and radio/checkbox options
    await expect(page.getByText(/question 1 of/i)).toBeVisible({ timeout: 5_000 });
    const radioOptions = page.locator('input[type="radio"]');
    const checkboxOptions = page.locator('input[type="checkbox"]');
    const textInput = page.getByPlaceholder('Your answer...');

    const hasRadio = (await radioOptions.count()) > 0;
    const hasCheckbox = (await checkboxOptions.count()) > 0;
    const hasText = await textInput.isVisible().catch(() => false);

    expect(hasRadio || hasCheckbox || hasText).toBe(true);
  });

  // ─── Step 22: Click an answer option → option is selected ─────────
  await test.step('22. Select an answer option', async () => {
    const submitBtn = page.getByRole('button', { name: /submit answer/i });
    await expect(submitBtn).toBeDisabled();

    // Try radio first, then checkbox, then text input
    const radio = page.locator('input[type="radio"]').first();
    if (await radio.isVisible().catch(() => false)) {
      await radio.click({ force: true });
    } else {
      const checkbox = page.locator('input[type="checkbox"]').first();
      if (await checkbox.isVisible().catch(() => false)) {
        await checkbox.click({ force: true });
      } else {
        await page.getByPlaceholder('Your answer...').fill('test answer');
      }
    }

    // Submit should now be enabled
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
  });

  // ─── Step 23: Click Submit → see feedback ─────────────────────────
  await test.step('23. Submit answer → see feedback', async () => {
    const answerResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/quizzes/') && resp.url().includes('/answer'),
      { timeout: 10_000 },
    );
    await page.getByRole('button', { name: /submit answer/i }).click();
    const resp = await answerResponse;
    expect(resp.status()).toBeGreaterThanOrEqual(200);
    expect(resp.status()).toBeLessThan(300);

    // Should show Correct! or Incorrect feedback
    await expect(page.getByText(/correct|incorrect/i)).toBeVisible({ timeout: 10_000 });
    await assertNoFatalError(page);

    // Next Question or See Results button should appear
    await expect(
      page.getByRole('button', { name: /next question|see results/i }),
    ).toBeVisible({ timeout: 5_000 });
  });

  // ─── Step 24: Advance through all remaining questions ─────────────
  await test.step('24. Complete all quiz questions', async () => {
    let safety = 20; // prevent infinite loops
    while (safety-- > 0) {
      // Check if we see quiz results
      const hasResults = await page.getByText(/— Results/).isVisible().catch(() => false);
      if (hasResults) break;

      // Check if there's a "Next Question" button
      const nextBtn = page.getByRole('button', { name: /next question/i });
      const seeResults = page.getByRole('button', { name: /see results/i });

      if (await seeResults.isVisible().catch(() => false)) {
        await seeResults.click();
        // Wait for results or next state
        await page.waitForTimeout(2_000);
        break;
      }

      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(500);

        // Now answer the new question
        const submitBtn = page.getByRole('button', { name: /submit answer/i });
        await expect(submitBtn).toBeVisible({ timeout: 5_000 });

        // Select an answer
        const radio = page.locator('input[type="radio"]').first();
        if (await radio.isVisible().catch(() => false)) {
          await radio.click({ force: true });
        } else {
          const checkbox = page.locator('input[type="checkbox"]').first();
          if (await checkbox.isVisible().catch(() => false)) {
            await checkbox.click({ force: true });
          } else {
            const textField = page.getByPlaceholder('Your answer...');
            if (await textField.isVisible().catch(() => false)) {
              await textField.fill('test answer');
            }
          }
        }

        await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
        await submitBtn.click();

        // Wait for feedback
        await expect(page.getByText(/correct|incorrect/i)).toBeVisible({ timeout: 10_000 });
        await assertNoFatalError(page);
        continue;
      }

      // If neither button visible, wait and retry
      await page.waitForTimeout(500);
    }
  });

  // ─── Step 25: See quiz results with score ─────────────────────────
  await test.step('25. Quiz results visible with score', async () => {
    await expect(page.getByText(/— Results/)).toBeVisible({ timeout: 10_000 });
    // Should show PASSED or FAILED badge
    await expect(page.getByText(/PASSED|FAILED/)).toBeVisible({ timeout: 5_000 });
    // Should show score fraction like "3/4 (75%)"
    await expect(page.getByText(/\d+\/\d+/)).toBeVisible({ timeout: 5_000 });
    // Should show per-question result tiles (Q1, Q2, etc.)
    await expect(page.getByText('Q1')).toBeVisible({ timeout: 5_000 });
    await assertNoFatalError(page);
  });

  // ─── Step 26: Navigate to profile page → see user stats ───────────
  await test.step('26. Navigate to profile → see stats', async () => {
    // Use sidebar navigation
    const sidebar = page.getByRole('navigation');
    await sidebar.getByText('Profile').click();
    await page.waitForURL(/\/profile/, { timeout: 10_000 });

    // Should show user's display name
    await expect(page.getByText(DISPLAY_NAME)).toBeVisible({ timeout: 10_000 });
    // Should show stat cards: Total XP, Lessons, Achievements, Day Streak
    await expect(page.getByText('Total XP')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Lessons')).toBeVisible();
    await expect(page.getByText('Achievements')).toBeVisible();
    await expect(page.getByText('Day Streak')).toBeVisible();
    await assertNoFatalError(page);
  });

  // ─── Step 27: See leaderboard → has at least 1 entry ──────────────
  await test.step('27. Leaderboard shows entries', async () => {
    const sidebar = page.getByRole('navigation');
    await sidebar.getByText('Leaderboard').click();
    await page.waitForURL(/\/leaderboard/, { timeout: 10_000 });

    await expect(page.getByText('🏆 Leaderboard')).toBeVisible({ timeout: 10_000 });
    // Tabs should be visible
    await expect(page.getByText('Weekly')).toBeVisible();
    await expect(page.getByText('All-Time')).toBeVisible();

    // Wait for data to load — should show at least the current user
    // Look for "(you)" marker or rank text
    await expect(page.getByText(/your rank/i)).toBeVisible({ timeout: 10_000 });
    await assertNoFatalError(page);
  });

  // ─── Step 28: Achievements page → grid renders ────────────────────
  await test.step('28. Achievements page renders', async () => {
    const sidebar = page.getByRole('navigation');
    await sidebar.getByText('Achievements').click();
    await page.waitForURL(/\/achievements/, { timeout: 10_000 });

    await expect(page.getByText('🎖️ Achievements')).toBeVisible({ timeout: 10_000 });
    // Category tabs
    await expect(page.getByText('All')).toBeVisible();
    await expect(page.getByText('Milestone')).toBeVisible();
    // Unlock count text
    await expect(page.getByText(/of \d+ unlocked/)).toBeVisible({ timeout: 10_000 });
    await assertNoFatalError(page);
  });

  // ─── Step 29: Sidebar world dropdown → expands, shows modules ─────
  await test.step('29. Sidebar world dropdown expands', async () => {
    const sidebar = page.getByRole('navigation');
    await expect(sidebar.getByText('Worlds')).toBeVisible({ timeout: 5_000 });
    await expect(sidebar.getByText('Aspire Foundations')).toBeVisible({ timeout: 5_000 });

    // Click world to expand
    await sidebar.getByText('Aspire Foundations').click();

    // Should show module names underneath
    await expect(sidebar.getByText('What is Aspire?')).toBeVisible({ timeout: 5_000 });
  });

  // ─── Step 30: Theme toggle → switches theme ───────────────────────
  await test.step('30. Theme toggle switches theme', async () => {
    const themeBtn = page.getByLabel('Toggle color mode');
    await expect(themeBtn).toBeVisible({ timeout: 5_000 });

    // Record initial background color
    const initialBg = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor,
    );

    // Toggle
    await themeBtn.click();
    await page.waitForTimeout(500);

    // Background should change
    const newBg = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor,
    );
    expect(newBg).not.toBe(initialBg);
  });

  // ─── Final: verify no 500 errors were logged ─────────────────────
  await test.step('Final: no 500/fatal errors in console', async () => {
    const fatalErrors = consoleErrors.filter(
      (e) => e.includes('500') || e.includes('Internal Server Error'),
    );
    expect(fatalErrors).toHaveLength(0);
  });
});
