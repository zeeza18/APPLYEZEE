const cfg = require('../1/config');

module.exports = async function step3(page) {
  let applied = 0, skipped = 0;
  console.log('[Step 3] Starting...');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  // Detect if cards are in iframe or main page
  const debug = await page.evaluate(() => {
    const mainCount   = document.querySelectorAll('.display-flex.job-card-container').length;
    const iframe      = document.querySelector('[data-testid="interop-iframe"]');
    const iframeCount = iframe?.contentDocument?.querySelectorAll('.display-flex.job-card-container').length ?? 0;
    return { mainCount, iframeCount };
  });
  const useIframe = debug.mainCount === 0 && debug.iframeCount > 0;
  console.log(`[Step 3] Cards in ${useIframe ? 'iframe' : 'main page'}`);

  const cardSel  = '.display-flex.job-card-container';
  const frameLoc = useIframe ? page.frameLocator('[data-testid="interop-iframe"]') : null;

  let pageNum = 1;
  const processedIds = new Set();

  while (true) {
    console.log(`\n[Step 3] ── Page ${pageNum} ──`);

    // Scroll to load all cards on this page
    await scrollJobList(page, useIframe);
    await page.waitForTimeout(500);

    // Keep processing until no new unprocessed cards visible
    let madeProgress = true;
    while (madeProgress) {
      madeProgress = false;

      // Re-query cards (virtualization may have changed the list)
      const cards = frameLoc
        ? await frameLoc.locator(cardSel).all()
        : await page.locator(cardSel).all();

      for (const card of cards) {
        // Get unique job ID to avoid reprocessing
        const jobId = await card.evaluate(el =>
          el.getAttribute('data-job-id') ||
          el.getAttribute('data-occludable-job-id') ||
          el.querySelector('a[href*="/jobs/view/"]')?.href || ''
        ).catch(() => '');

        if (!jobId || processedIds.has(jobId)) continue;
        processedIds.add(jobId);
        madeProgress = true;

        // Skip already applied
        const alreadyApplied = await card.locator('text=/Applied/i').count()
          .then(c => c > 0).catch(() => false);
        if (alreadyApplied) { console.log(`  [skip] Already applied`); skipped++; continue; }

        // Force close any leftover modal before clicking next card
        await closeDismiss(page);
        await page.waitForTimeout(300);

        // Click the job title link inside the card to open job detail
        await card.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
        const titleLink = card.locator('a[href*="/jobs/view/"], .job-card-list__title').first();
        const clickTarget = await titleLink.isVisible({ timeout: 1000 }).catch(() => false)
          ? titleLink : card;
        await clickTarget.click({ force: true }).catch(() => {});
        await page.waitForTimeout(2500);


        // Get title
        const titleLoc = frameLoc
          ? frameLoc.locator('.job-details-jobs-unified-top-card__job-title, .t-24').first()
          : page.locator('.job-details-jobs-unified-top-card__job-title, .t-24').first();
        const title = await titleLoc.textContent({ timeout: 3000 }).catch(() => 'Unknown');
        console.log(`  [${processedIds.size}] ${title.trim()}`);

        // Find Easy Apply button — must match "Easy Apply to [title]", NOT "Easy Apply filter."
        let eaBtn = null;
        const eaSelectors = [
          () => frameLoc?.getByRole('button', { name: /^Easy Apply to /i }).first(),
          () => frameLoc?.locator('button[aria-label^="Easy Apply to"]').first(),
          () => page.getByRole('button', { name: /^Easy Apply to /i }).first(),
          () => page.locator('button[aria-label^="Easy Apply to"]').first(),
        ];
        for (const getSel of eaSelectors) {
          const btn = getSel();
          if (!btn) continue;
          if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
            eaBtn = btn;
            const lbl = await btn.getAttribute('aria-label').catch(() => '');
            console.log(`  Found Easy Apply: "${lbl}"`);
            break;
          }
        }

        if (!eaBtn) {
          // Log all buttons to debug
          if (frameLoc) {
            const allBtns = await frameLoc.locator('button').evaluateAll(
              btns => btns.filter(b => b.offsetParent).map(b => b.getAttribute('aria-label') || b.textContent.trim()).filter(Boolean).slice(0, 10)
            ).catch(() => []);
            console.log(`  [skip] No Easy Apply. Visible buttons: ${allBtns.join(' | ')}`);
          } else {
            console.log('  [skip] No Easy Apply button');
          }
          skipped++; continue;
        }

        await eaBtn.click({ force: true });
        await page.waitForTimeout(2000);

        // Find modal — main page or iframe
        let modal = page.locator('.jobs-easy-apply-modal').first();
        if (!await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
          modal = frameLoc?.locator('.jobs-easy-apply-modal').first();
        }
        if (!modal || !await modal?.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('  [skip] Modal did not open');
          skipped++; continue;
        }

        const ok = await fillAndSubmit(page, frameLoc);
        if (ok) { applied++; console.log(`  ✓ Applied (total: ${applied})`); }
        else     { skipped++; console.log(`  ✗ Discarded (total skipped: ${skipped})`); }

        await page.waitForTimeout(800);
        break; // Re-query cards after each application (modal may have shifted DOM)
      }
    }

    // Next page
    pageNum++;
    const nextPage = page.getByRole('button', { name: `Page ${pageNum}` });
    const nextInFrame = frameLoc?.getByRole('button', { name: `Page ${pageNum}` });
    const hasNext = await nextPage.isVisible({ timeout: 2000 }).catch(() => false)
                 || await nextInFrame?.isVisible({ timeout: 1000 }).catch(() => false);

    if (hasNext) {
      console.log(`\n[Step 3] → Page ${pageNum}`);
      if (await nextPage.isVisible().catch(() => false)) await nextPage.click();
      else await nextInFrame.click();
      await page.waitForTimeout(3000);
    } else {
      console.log(`\n[Step 3] Done — Applied: ${applied} | Skipped: ${skipped}`);
      break;
    }
  }
};

// ── Fill form steps and submit ────────────────────────────────────────────────
async function fillAndSubmit(page, frameLoc) {
  const startTime = Date.now();

  for (let step = 0; step < 15; step++) {
    if (Date.now() - startTime > 180000) {
      await closeDismiss(page); return false;
    }

    // Find modal
    let modal = page.locator('.jobs-easy-apply-modal').first();
    if (!await modal.isVisible().catch(() => false) && frameLoc) {
      modal = frameLoc.locator('.jobs-easy-apply-modal').first();
    }
    if (!await modal.isVisible().catch(() => false)) return step > 0;

    await page.waitForTimeout(600);
    await fillFields(page, modal);
    await page.waitForTimeout(500);

    // Buttons
    const submitBtn   = modal.getByRole('button', { name: 'Submit application' });
    const reviewBtn   = modal.getByRole('button', { name: 'Review your application' });
    const continueBtn = modal.getByRole('button', { name: 'Continue to next step' });

    if (await submitBtn.isVisible().catch(() => false)) {
      // Uncheck follow company
      const followLbl = modal.locator('label[for="follow-company-checkbox"]');
      if (await followLbl.isVisible().catch(() => false)) {
        const cb = modal.locator('#follow-company-checkbox');
        if (await cb.isChecked().catch(() => false)) await followLbl.click().catch(() => {});
      }
      await submitBtn.click();
      console.log('  → Submit application');
      await page.waitForTimeout(2000);

      // Close the "Application sent" modal — try all known close buttons
      const closeSelectors = [
        () => page.getByRole('button', { name: 'Done' }),
        () => page.locator('button[aria-label="Dismiss"]'),
        () => page.getByRole('button', { name: 'Not now' }),
        () => page.locator('.artdeco-modal__dismiss'),
        () => page.locator('button[aria-label*="Dismiss"]'),
        () => page.locator('button[aria-label*="Close"]'),
      ];
      for (const getSel of closeSelectors) {
        const btn = getSel();
        if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await btn.click({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(500);
          console.log('  → Closed post-submit modal');
          break;
        }
      }
      return true;
    }

    if (await reviewBtn.isVisible().catch(() => false)) {
      await reviewBtn.click(); console.log('  → Review'); await page.waitForTimeout(800); continue;
    }
    if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.click(); console.log('  → Continue'); await page.waitForTimeout(800); continue;
    }

    console.log('  No action button — discarding');
    await closeDismiss(page); return false;
  }
  await closeDismiss(page); return false;
}

// ── Fill all visible fields ───────────────────────────────────────────────────
async function fillFields(page, modal) {
  const phone = modal.getByRole('textbox', { name: /phone|mobile/i }).first();
  if (await phone.isVisible().catch(() => false)) {
    if (!await phone.inputValue().catch(() => '')) await phone.fill(cfg.phone);
  }

  await page.evaluate((c) => {
    const modal = document.querySelector('.jobs-easy-apply-modal');
    if (!modal) return;

    function fill(el, val) {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (s) s.call(el, val);
      el.dispatchEvent(new Event('input',  { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    modal.querySelectorAll('input[type="text"],input[type="email"],input[type="tel"],input[type="number"]').forEach(inp => {
      if (inp.value) return;
      const l = [inp.getAttribute('aria-label'), inp.getAttribute('name'),
        modal.querySelector(`label[for="${inp.id}"]`)?.textContent].join(' ').toLowerCase();
      if      (l.match(/first.*name/))         fill(inp, c.firstName);
      else if (l.match(/last.*name/))          fill(inp, c.lastName);
      else if (l.match(/email/))               fill(inp, c.email);
      else if (l.match(/experience|years/))    fill(inp, c.yearsOfExperience);
      else if (l.match(/salary|compensation/)) fill(inp, c.expectedSalary);
      else if (l.match(/city|location/))       fill(inp, c.city);
    });

    modal.querySelectorAll('fieldset[data-test-form-builder-radio-button-form-component]').forEach(fs => {
      const q = (fs.querySelector('legend, [class*="title"]')?.textContent || '').toLowerCase();
      let ans = 'yes';
      if (q.match(/visa|sponsor/))      ans = c.visaSponsorship;
      if (q.match(/legal|authorized/))  ans = c.legallyAuthorized;
      if (q.match(/relocat/))           ans = c.willingToRelocate;
      if (q.match(/clearance/))         ans = 'no';
      if (q.match(/driver/))            ans = c.driversLicense;

      for (const r of fs.querySelectorAll('input[type="radio"]')) {
        const lbl = fs.querySelector(`label[for="${r.id}"]`);
        const t   = (lbl?.textContent || '').trim().toLowerCase();
        if ((ans === 'yes' && /^(yes|oui)$/.test(t)) || (ans === 'no' && /^(no|non)$/.test(t))) {
          if (!r.checked) { lbl ? lbl.click() : r.click(); } break;
        }
      }
    });

    modal.querySelectorAll('select').forEach(sel => {
      if (sel.selectedIndex > 0) return;
      const first = Array.from(sel.options).find(o => o.value && o.index > 0);
      if (first) { sel.value = first.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    });

    modal.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      if (cb.id === 'follow-company-checkbox') return;
      const lbl = modal.querySelector(`label[for="${cb.id}"]`);
      if (lbl && /consent|agree|terms|accept/i.test(lbl.textContent) && !cb.checked) lbl.click();
    });
  }, { ...cfg }).catch(() => {});
}

// ── Scroll job list with mouse wheel ─────────────────────────────────────────
async function scrollJobList(page, useIframe) {
  try {
    const listLoc = useIframe
      ? page.frameLocator('[data-testid="interop-iframe"]').locator('.jobs-search-results-list, .scaffold-layout__list').first()
      : page.locator('.jobs-search-results-list, .scaffold-layout__list').first();

    const box = await listLoc.boundingBox({ timeout: 5000 }).catch(() => null);
    if (!box) return;

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 12; i++) { await page.mouse.wheel(0,  500); await page.waitForTimeout(200); }
    for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, -500); await page.waitForTimeout(100); }
    await page.waitForTimeout(500);
  } catch (e) {
    console.log('[Step 3] Scroll skip:', e.message);
  }
}

// ── Discard modal — force close regardless of modal class ────────────────────
async function closeDismiss(page) {
  // Click Dismiss (opens confirmation)
  await page.getByRole('button', { name: 'Dismiss' }).click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(400);
  // Click Discard on confirmation dialog
  await page.getByRole('button', { name: 'Discard' }).click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(400);
  // If still open, try X button
  await page.locator('button[aria-label*="Dismiss"], button[aria-label*="Close"], .artdeco-modal__dismiss')
    .first().click({ timeout: 1000 }).catch(() => {});
  await page.waitForTimeout(300);
}
