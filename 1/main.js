const { chromium } = require('playwright');
const step1 = require('./search');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const page    = await browser.newPage();

  try {
    await step1(page);
    // step2(page) goes here next
    // step3(page) goes here next
    console.log('\n[Pipeline] All steps done. Browser staying open...');
    await page.pause(); // inspect result
  } catch (err) {
    console.error('[Pipeline] Error:', err.message);
  } finally {
    await browser.close();
  }
})();
