const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');
const step1 = require('./1/search');
const step2 = require('./2/filters');
const step3 = require('./3/apply');

const AUTH_FILE = path.join(__dirname, 'auth.json');

(async () => {
  if (!fs.existsSync(AUTH_FILE)) {
    console.error('[Pipeline] No auth.json found. Run this first:\n  node 1/login.js');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const context = await browser.newContext({ storageState: AUTH_FILE });
  const page    = await context.newPage();

  try {
    await step1(page);
    await step2(page);
    await step3(page);
    console.log('\n[Pipeline] Done.');
  } catch (err) {
    console.error('[Pipeline] Error:', err.message);
  } finally {
    await browser.close();
  }
})();
