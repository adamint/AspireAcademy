import { test, expect } from '@playwright/test';
import { uniqueUser, registerUser } from './helpers';

test('debug: complete lessons and check unlock', async ({ page }) => {
  const username = uniqueUser('dbg');
  await registerUser(page, username);

  // Navigate to world
  await page.getByRole('main').getByText('Aspire Foundations').click();
  await page.waitForURL(/\/worlds\//);
  await expect(page.locator('[role="button"]').filter({ hasText: /XP/ }).first()).toBeVisible({ timeout: 10_000 });

  // Complete multiple lessons
  for (let round = 0; round < 4; round++) {
    const available = page.locator('[role="button"]').filter({ hasText: /○/ }).filter({ hasText: /📖/ });
    const cnt = await available.count();
    console.log(`Round ${round}: ${cnt} available learn lessons`);
    if (cnt === 0) break;
    
    await available.first().click();
    await page.waitForURL(/\/lessons\//, { timeout: 10_000 });
    
    const markBtn = page.getByRole('button', { name: /mark complete/i });
    await expect(markBtn).toBeVisible({ timeout: 10_000 });
    await markBtn.click();
    await page.waitForTimeout(1000);
    
    // Go back to world page via browser back or "Back to" button
    await page.goBack();
    await page.waitForURL(/\/worlds\//, { timeout: 10_000 });
    // Force refresh to get updated lesson statuses
    await page.reload();
    await expect(page.locator('[role="button"]').filter({ hasText: /XP/ }).first()).toBeVisible({ timeout: 10_000 });
  }
  
  // Check quiz status
  const quizLesson = page.locator('[role="button"]').filter({ hasText: '🧪' });
  const quizText = await quizLesson.first().textContent();
  console.log(`Quiz lesson: ${quizText}`);
  
  const unlockedQuiz = page.locator('[role="button"]').filter({ hasText: '🧪' }).filter({ hasNotText: '🔒' });
  const unlocked = await unlockedQuiz.count();
  console.log(`Unlocked quiz count: ${unlocked}`);
  
  // List all lessons
  const allLessons = page.locator('[role="button"]').filter({ hasText: /XP/ });
  const allCount = await allLessons.count();
  for (let i = 0; i < allCount; i++) {
    const text = await allLessons.nth(i).textContent();
    console.log(`Lesson ${i}: ${text}`);
  }
});
