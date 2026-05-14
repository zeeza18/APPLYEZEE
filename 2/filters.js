module.exports = async function step2(page) {
  const cf = () => page.locator('[data-testid="interop-iframe"]').contentFrame();

  // ── Wait for page to settle, then iframe ─────────────────────────────────
  console.log('[Step 2] Waiting for jobs page to load...');
  await page.waitForLoadState('domcontentloaded');

  // Retry up to 3 times if iframe doesn't appear
  let iframeReady = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.waitForTimeout(2000);
    iframeReady = await page.locator('[data-testid="interop-iframe"]').isVisible({ timeout: 6000 }).catch(() => false);
    if (iframeReady) break;
    console.log(`[Step 2] iframe not found (attempt ${attempt}/3) — reloading...`);
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  if (!iframeReady) throw new Error('[Step 2] iframe never appeared after 3 reloads');
  await page.waitForTimeout(500);
  await cf().getByRole('button', { name: /show all filters/i }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(500);
  await cf().getByRole('button', { name: /show all filters/i }).waitFor({ timeout: 15000 });
  console.log('[Step 2] Opening filters panel...');
  await cf().getByRole('button', { name: /show all filters/i }).click();
  await page.waitForTimeout(1000);

  // ── Easy Apply ON ─────────────────────────────────────────────────────────
  const eaToggle = cf().getByText('Off Toggle Easy Apply filter');
  if (await eaToggle.count() > 0) {
    console.log('[Step 2] Easy Apply ON');
    await eaToggle.click();
    await page.waitForTimeout(300);
  } else {
    console.log('[Step 2] Easy Apply already ON');
  }

  const panel = cf().getByLabel('All filters', { exact: true });

  // ── Experience ────────────────────────────────────────────────────────────
  await panel.locator('label').filter({ hasText: 'Entry level Filter by Entry' }).click();
  await panel.locator('label').filter({ hasText: 'Associate Filter by Associate' }).click();
  await panel.locator('label').filter({ hasText: 'Mid-Senior level Filter by' }).click();
  console.log('[Step 2] Experience filters set');

  // ── Job type ──────────────────────────────────────────────────────────────
  await panel.getByText('Full-time', { exact: true }).click();
  await panel.getByText('Contract',  { exact: true }).click();
  console.log('[Step 2] Job type filters set');

  // ── Remote ────────────────────────────────────────────────────────────────
  await panel.locator('label').filter({ hasText: 'Remote Filter by Remote' }).click();
  await panel.locator('label').filter({ hasText: 'Hybrid Filter by Hybrid' }).click();
  console.log('[Step 2] Remote filters set');

  // ── Show results ──────────────────────────────────────────────────────────
  console.log('[Step 2] Clicking Show results...');
  await cf().getByRole('button', { name: /apply current filters/i }).click();
  await page.waitForTimeout(1500);
  console.log('[Step 2] Done —', page.url());
};
