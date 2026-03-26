import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage();

// Register
await page.goto('http://localhost:52096/register');
const u = 'qdbg_' + Date.now();
await page.fill('#reg-user', u);
await page.fill('#reg-email', u+'@test.com');
await page.fill('#reg-pass', 'Password1!');
await page.fill('#reg-confirm', 'Password1!');
await page.fill('#reg-display', u);
await page.getByRole('button', { name: /register/i }).click();
await page.waitForURL('**/dashboard', {timeout: 10000});

// Go to world
await page.getByRole('main').getByText('Aspire Foundations').click();
await page.waitForTimeout(2000);

// Complete first 3 learn lessons
const worldUrl = page.url();
const lessons = page.locator('[role="button"]').filter({ hasText: /XP/ });
await lessons.first().waitFor({ timeout: 10000 });
const all = await lessons.all();
for (const l of all.slice(0, 3)) {
  const txt = await l.textContent();
  if (txt?.includes('🔒') || !txt?.includes('📖')) continue;
  await l.click();
  await page.waitForTimeout(1000);
  const btn = page.getByRole('button', { name: /mark complete/i });
  if (await btn.isVisible({timeout:5000}).catch(()=>false)) {
    await btn.click();
    await page.waitForTimeout(1000);
  }
  await page.goto(worldUrl);
  await page.reload();
  await page.waitForTimeout(2000);
}

// Find quiz
const quizLessons = page.locator('[role="button"]').filter({ hasText: '🧪' });
const qcount = await quizLessons.count();
console.log('Quiz count:', qcount);
for (let i = 0; i < qcount; i++) {
  const txt = await quizLessons.nth(i).textContent();
  console.log(`Quiz ${i}: ${txt?.substring(0,60)} locked:${txt?.includes('🔒')}`);
  if (!txt?.includes('🔒')) {
    await quizLessons.nth(i).click();
    await page.waitForTimeout(3000);
    break;
  }
}

console.log('URL:', page.url());

// Check selectors
const sel1 = '[data-scope="radio-group"] [data-part="item-control"]';
const sel2 = '[data-scope="radio-group"] [data-part="item"]';
console.log('item-control count:', await page.locator(sel1).count());
console.log('item count:', await page.locator(sel2).count());
console.log('role=radio count:', await page.getByRole('radio').count());

// Check if radios are visible
const radios = page.getByRole('radio');
const rc = await radios.count();
for (let i = 0; i < Math.min(rc, 4); i++) {
  const vis = await radios.nth(i).isVisible();
  const box = await radios.nth(i).boundingBox();
  console.log(`radio ${i}: visible=${vis} box=${JSON.stringify(box)}`);
}

// Try clicking item-control
const ic = page.locator(sel1);
if ((await ic.count()) > 0) {
  await ic.first().click();
  await page.waitForTimeout(500);
  console.log('After item-control click, submit enabled:', await page.getByRole('button', { name: /submit answer/i }).isEnabled());
}

// Try clicking item
const it = page.locator(sel2);
if ((await it.count()) > 0) {
  await it.first().click();
  await page.waitForTimeout(500);
  console.log('After item click, submit enabled:', await page.getByRole('button', { name: /submit answer/i }).isEnabled());
}

// Try force-clicking radio
if (rc > 0) {
  await radios.first().click({ force: true });
  await page.waitForTimeout(500);
  console.log('After force radio click, submit enabled:', await page.getByRole('button', { name: /submit answer/i }).isEnabled());
}

await browser.close();
