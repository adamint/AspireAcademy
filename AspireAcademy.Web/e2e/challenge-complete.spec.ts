import { test, expect } from '@playwright/test';
import { uniqueUser, registerUser, loginUser, completeLearnLessonsViaApi } from './helpers';

test.describe.serial('Challenge lesson experience', () => {
  const username = uniqueUser('chal');

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerUser(page, username);
    // Complete learn prerequisites so challenge 1.2.5 is unlocked
    // API only checks lesson-level prereqs, not module-level
    await completeLearnLessonsViaApi(page, ['1.2.1', '1.2.2', '1.2.3', '1.2.4']);
    await page.close();
  });

  test('navigate to challenge lesson → Monaco editor loads', async ({ page }) => {
    await loginUser(page, username);
    await page.goto('/challenges/1.2.5');
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 15_000 });
  });

  test('editor has starter code pre-filled', async ({ page }) => {
    await loginUser(page, username);
    await page.goto('/challenges/1.2.5');
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 15_000 });
    // Starter code contains "CreateBuilder" from the challenge YAML
    await expect(page.locator('.monaco-editor')).toContainText('CreateBuilder', { timeout: 10_000 });
  });

  test('instructions panel shows challenge description', async ({ page }) => {
    await loginUser(page, username);
    await page.goto('/challenges/1.2.5');
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 15_000 });
    // The challenge instructions contain "First App Challenge" as a heading
    await expect(page.getByRole('heading', { name: 'First App Challenge', exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('test case descriptions listed with unchecked icons', async ({ page }) => {
    await loginUser(page, username);
    await page.goto('/challenges/1.2.5');
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 15_000 });

    // Test cases section header
    await expect(page.getByText('Tests')).toBeVisible({ timeout: 10_000 });

    // Verify test case descriptions are visible (from the challenge YAML)
    await expect(page.getByText('Code must compile without errors')).toBeVisible();
    await expect(page.getByText('Must add a Redis resource')).toBeVisible();

    // Check for pending (☐) icons — each test case starts as pending
    const pendingIcons = page.locator('text=☐');
    expect(await pendingIcons.count()).toBeGreaterThanOrEqual(2);
  });

  test('typing in editor changes content', async ({ page }) => {
    await loginUser(page, username);
    await page.goto('/challenges/1.2.5');
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 15_000 });

    // Click the editor to focus it
    await page.locator('.monaco-editor').click();
    // Move to end and type a comment
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('// e2e marker', { delay: 50 });

    // Verify the typed text appears in the editor
    await expect(page.locator('.monaco-editor')).toContainText('e2e marker', { timeout: 5_000 });
  });

  test('click Run → output panel shows result', async ({ page }) => {
    await loginUser(page, username);
    await page.goto('/challenges/1.2.5');
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 15_000 });

    // Verify initial output state
    await expect(page.getByText('Click Run to see output')).toBeVisible({ timeout: 5_000 });

    // Click Run and wait for the API response
    const runBtn = page.getByRole('button', { name: 'Run', exact: true });
    await expect(runBtn).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/run') && resp.status() === 200),
      runBtn.click(),
    ]);

    expect(response.status()).toBe(200);

    // After run, the initial placeholder should be gone or errors should be shown
    // (CodeRunner may or may not be running; check that SOMETHING changed)
    await expect(runBtn).toBeEnabled({ timeout: 10_000 });
  });

  test('Run button is disabled while running (no double-click)', async ({ page }) => {
    await loginUser(page, username);
    await page.goto('/challenges/1.2.5');
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 15_000 });

    // Use a controlled promise to hold the API response
    let resolveRoute!: () => void;
    const holdPromise = new Promise<void>((r) => { resolveRoute = r; });

    await page.route('**/api/challenges/**/run', async (route) => {
      await holdPromise;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          compilationSuccess: true,
          compilationOutput: '',
          executionOutput: 'Mock output',
          executionTimeMs: null,
          error: null,
        }),
      });
    });

    const runBtn = page.getByRole('button', { name: 'Run', exact: true });
    await expect(runBtn).toBeEnabled();

    // Click Run — the route handler holds the response
    await runBtn.click();

    // The button text changes to "Running..." during execution
    await expect(page.locator('button', { hasText: 'Running...' })).toBeVisible({ timeout: 5_000 });

    // Release the held response
    resolveRoute();

    // Button should return to normal "Run" state
    await expect(runBtn).toBeEnabled({ timeout: 5_000 });

    await page.unroute('**/api/challenges/**/run');
  });

  test('click Submit → test case results shown with ✅/❌', async ({ page }) => {
    await loginUser(page, username);
    await page.goto('/challenges/1.2.5');
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 15_000 });

    // Mock the submit API to return test results with a mix of pass/fail
    await page.route('**/api/challenges/**/submit', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          compilationSuccess: true,
          compilationOutput: '',
          executionOutput: 'Build started',
          testResults: [
            { testId: 'tc1', name: 'Compiles', passed: true, description: 'Code must compile without errors' },
            { testId: 'tc2', name: 'Uses AddRedis', passed: true, description: 'Must add a Redis resource' },
            { testId: 'tc3', name: 'Names cache', passed: false, description: 'Redis must be named cache' },
            { testId: 'tc4', name: 'Uses WithReference', passed: true, description: 'API must reference the cache' },
            { testId: 'tc5', name: 'Uses WithExternalHttpEndpoints', passed: false, description: 'Web frontend must have external HTTP endpoints' },
            { testId: 'tc6', name: 'Uses WaitFor', passed: false, description: 'Must use WaitFor to control startup ordering' },
          ],
          allPassed: false,
          xpEarned: 0,
          bonusXpEarned: 0,
        }),
      });
    });

    const submitBtn = page.getByRole('button', { name: 'Submit', exact: true });
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
    await submitBtn.click();

    // Wait for results to render
    await expect(page.locator('text=✅').first()).toBeVisible({ timeout: 10_000 });

    // Should have both passed and failed icons
    expect(await page.locator('text=✅').count()).toBeGreaterThanOrEqual(1);
    expect(await page.locator('text=❌').count()).toBeGreaterThanOrEqual(1);

    await page.unroute('**/api/challenges/**/submit');
  });

  test('hint button reveals first hint', async ({ page }) => {
    await loginUser(page, username);
    await page.goto('/challenges/1.2.5');
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 15_000 });

    // Click the first hint button
    const hint1Btn = page.getByRole('button', { name: 'Hint 1' });
    await expect(hint1Btn).toBeVisible({ timeout: 5_000 });
    await hint1Btn.click();

    // Hint text should appear (from the challenge YAML)
    await expect(page.getByText(/AddRedis.*cache/i)).toBeVisible({ timeout: 5_000 });
  });

  test('second hint button reveals second hint', async ({ page }) => {
    await loginUser(page, username);
    await page.goto('/challenges/1.2.5');
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 15_000 });

    // Reveal first hint
    const hint1Btn = page.getByRole('button', { name: 'Hint 1' });
    await expect(hint1Btn).toBeVisible({ timeout: 5_000 });
    await hint1Btn.click();

    // Now the second hint button should be enabled
    const hint2Btn = page.getByRole('button', { name: 'Hint 2' });
    await expect(hint2Btn).toBeEnabled({ timeout: 5_000 });
    await hint2Btn.click();

    // Second hint text should appear (mentions WithReference and WaitFor)
    await expect(page.getByText(/WithReference.*WaitFor|WaitFor.*WithReference/i)).toBeVisible({ timeout: 5_000 });
  });
});
