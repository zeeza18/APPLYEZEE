// Run this ONCE to save your LinkedIn session.
// After it runs, main.js will reuse the session automatically — no login needed again.
// Usage: node 1/login.js

const { chromium } = require('playwright');
const path = require('path');
const cfg  = require('./config');

const AUTH_FILE = path.join(__dirname, '..', 'auth.json');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page    = await context.newPage();

  console.log('[Login] Opening LinkedIn login...');
  await page.goto('https://www.linkedin.com/login');

  await page.getByRole('textbox', { name: 'Email or phone' }).fill(cfg.email);
  await page.getByRole('textbox', { name: 'Password' }).fill(cfg.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  // Wait for feed — if LinkedIn shows a CAPTCHA or verification, solve it manually
  console.log('[Login] Waiting for feed (solve any captcha manually if needed)...');
  await page.waitForURL('**/feed/**', { timeout: 60000 });
  console.log('[Login] Logged in!');

  // Save session to auth.json
  await context.storageState({ path: AUTH_FILE });
  console.log(`[Login] Session saved to auth.json — you won't need to login again.`);

  await browser.close();
})();
