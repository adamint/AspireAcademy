import { test, expect } from '@playwright/test';
import { uniqueUser, registerUser, loginUser } from './helpers';

test('debug radio selectors', async ({ page }) => {
  const username = uniqueUser();
  await registerUser(page, username);
  await loginUser(page, username);

  // Navigate to world
  const main = page.getByRole('main');
  await main.getByText('Aspire Foundations').click();
  const worldUrl = page.url();

  // Wait for lessons
  const lessons = page.locator('[role="button"]').filter({ hasText: /XP/ });
  await lessons.first().waitFor({ timeout: 10_000 });

  // Complete first 3 learn lessons
  const all = await lessons.all();
  for (const l of all.slice(0, 3)) {
    const txt = await l.textContent();
    if (txt?.includes('🔒') || !txt?.includes('📖')) continue;
    await l.click();
    await page.waitForTimeout(1000);
    const btn = page.getByRole('button', { name: /mark complete/i });
    if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(1000);
    }
    await page.goto(worldUrl);
    await page.reload();
    await page.waitForTimeout(2000);
  }

  // Find and click quiz
  const quizLessons = page.locator('[role="button"]').filter({ hasText: '🧪' });
  let quizFound = false;
  for (let i = 0; i < await quizLessons.count(); i++) {
    const txt = await quizLessons.nth(i).textContent();
    console.log(`Quiz ${i}: ${txt?.substring(0, 60)} locked:${txt?.includes('🔒')}`);
    if (!txt?.includes('🔒')) {
      await quizLessons.nth(i).click();
      quizFound = true;
      break;
    }
  }
  
  expect(quizFound).toBeTruthy();
  await page.waitForTimeout(3000);
  console.log('Page URL:', page.url());

  // Debug selectors
  const sel1 = '[data-scope="radio-group"] [data-part="item-control"]';
  const sel2 = '[data-scope="radio-group"] [data-part="item"]';
  
  console.log('item-control count:', await page.locator(sel1).count());
  console.log('item count:', await page.locator(sel2).count());
  console.log('role=radio count:', await page.getByRole('radio').count());
  console.log('radiogroup count:', await page.getByRole('radiogroup').count());

  // Check radio visibility
  const radios = page.getByRole('radio');
  const rc = await radios.count();
  for (let i = 0; i < Math.min(rc, 4); i++) {
    const vis = await radios.nth(i).isVisible();
    const box = await radios.nth(i).boundingBox();
    console.log(`radio ${i}: visible=${vis} box=${JSON.stringify(box)}`);
  }

  // Try different click strategies
  // Strategy 1: item-control
  if ((await page.locator(sel1).count()) > 0) {
    await page.locator(sel1).first().click();
    await page.waitForTimeout(500);
    console.log('After item-control click → submit enabled:', await page.getByRole('button', { name: /submit answer/i }).isEnabled());
  } else {
    console.log('No item-control elements found');
  }

  // Strategy 2: item
  if ((await page.locator(sel2).count()) > 0) {
    await page.locator(sel2).first().click();
    await page.waitForTimeout(500);
    console.log('After item click → submit enabled:', await page.getByRole('button', { name: /submit answer/i }).isEnabled());
  } else {
    console.log('No item elements found');
  }

  // Strategy 3: force click radio
  if (rc > 0) {
    await radios.first().click({ force: true });
    await page.waitForTimeout(500);
    console.log('After force radio click → submit enabled:', await page.getByRole('button', { name: /submit answer/i }).isEnabled());
  }

  // Strategy 4: click radio label text
  const radioTexts = page.locator('[data-scope="radio-group"] [data-part="item-text"]');
  if ((await radioTexts.count()) > 0) {
    await radioTexts.first().click();
    await page.waitForTimeout(500);
    console.log('After item-text click → submit enabled:', await page.getByRole('button', { name: /submit answer/i }).isEnabled());
  }
});
