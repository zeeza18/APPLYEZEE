const cfg = require('./config');

module.exports = async function step1(page) {
  // Already logged in via saved session — go straight to feed
  console.log('[Step 1] Opening LinkedIn feed...');
  await page.goto('https://www.linkedin.com/feed/');
  await page.waitForURL('**/feed/**', { timeout: 10000 });

  // ── Type keyword + Enter ──────────────────────────────────────────────────
  console.log(`[Step 1] Searching "${cfg.keyword}"...`);
  await page.getByTestId('typeahead-input').click();
  await page.getByTestId('typeahead-input').fill(cfg.keyword);
  await page.getByTestId('typeahead-input').press('Enter');

  // ── Click Jobs tab only if not already on jobs page ─────────────────────
  if (page.url().includes('/jobs/search/')) {
    console.log('[Step 1] Already on jobs page, skipping Jobs tab click');
  } else {
    console.log('[Step 1] Clicking Jobs tab...');
    await page.getByLabel('Filter by Jobs').getByText('Jobs').click();
    await page.waitForURL('**/jobs/search/**', { timeout: 10000 });
  }
  console.log('[Step 1] Done —', page.url());
};
