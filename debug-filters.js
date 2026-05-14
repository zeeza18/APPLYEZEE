/**
 * LinkedIn filter debug script
 * Run: node debug-filters.js
 *
 * Logs every visible button after typeahead navigation so we can find the real selectors.
 * You will be prompted to log in manually before the script continues.
 */

const { chromium } = require('playwright');

const KEYWORD = 'AI engineer';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const page = await browser.newPage();

  // ── 1. Go to LinkedIn feed ──────────────────────────────────────────────
  console.log('\n[1] Opening LinkedIn feed...');
  await page.goto('https://www.linkedin.com/feed/');

  // Wait for manual login if needed
  await page.waitForSelector(
    'input.search-global-typeahead__input, [data-testid="typeahead-input"]',
    { timeout: 60000 }
  );
  console.log('[1] Feed loaded — search bar found');

  // ── 2. Type keyword ─────────────────────────────────────────────────────
  console.log(`\n[2] Typing "${KEYWORD}"...`);
  const searchInput = await page.locator(
    'input.search-global-typeahead__input, [data-testid="typeahead-input"]'
  ).first();
  await searchInput.click();
  await searchInput.fill(KEYWORD);
  await page.waitForTimeout(1500);

  // ── 3. Click Jobs typeahead suggestion ─────────────────────────────────
  console.log('\n[3] Looking for Jobs suggestion in typeahead...');
  let clicked = false;
  for (let i = 0; i < 8; i++) {
    const suggestions = await page.locator(
      '[data-view-name="search-typeahead-suggestion"], ' +
      '.search-global-typeahead__suggestion, ' +
      '[role="option"], ' +
      '[class*="typeahead"] li'
    ).all();

    for (const s of suggestions) {
      const text = (await s.textContent()) || '';
      console.log(`  suggestion: "${text.trim().substring(0, 60)}"`);
      if (text.toLowerCase().includes(KEYWORD.toLowerCase()) && text.toLowerCase().includes('job')) {
        console.log(`  -> Clicking: "${text.trim().substring(0, 60)}"`);
        await s.click();
        clicked = true;
        break;
      }
    }
    if (clicked) break;
    await page.waitForTimeout(500);
  }

  if (!clicked) {
    console.log('  -> No Jobs suggestion found, pressing Enter...');
    await searchInput.press('Enter');
  }

  // ── 4. Wait for navigation ──────────────────────────────────────────────
  console.log('\n[4] Waiting for page to load after navigation...');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const url = page.url();
  console.log(`\n[4] Landed on: ${url}`);

  // ── 5. Log ALL visible buttons ─────────────────────────────────────────
  console.log('\n[5] All visible buttons on page:');
  const buttons = await page.locator('button').all();
  for (const btn of buttons) {
    const visible = await btn.isVisible().catch(() => false);
    if (!visible) continue;
    const text     = ((await btn.textContent().catch(() => '')) || '').trim().substring(0, 50);
    const ariaLabel = (await btn.getAttribute('aria-label').catch(() => '')) || '';
    const cls      = ((await btn.getAttribute('class').catch(() => '')) || '').substring(0, 60);
    if (text || ariaLabel) {
      console.log(`  text="${text}" | aria-label="${ariaLabel}" | class="${cls}"`);
    }
  }

  // ── 6. Specifically look for filter-related buttons ───────────────────
  console.log('\n[6] Filter-related buttons (text or aria contains "filter"):');
  for (const btn of buttons) {
    const visible = await btn.isVisible().catch(() => false);
    if (!visible) continue;
    const text      = ((await btn.textContent().catch(() => '')) || '').trim();
    const ariaLabel = (await btn.getAttribute('aria-label').catch(() => '')) || '';
    if (/filter/i.test(text) || /filter/i.test(ariaLabel)) {
      console.log(`  >> text="${text}" | aria-label="${ariaLabel}"`);
    }
  }

  console.log('\n[DONE] Check output above. Press Ctrl+C to close.');
  await page.waitForTimeout(60000);
  await browser.close();
})();
