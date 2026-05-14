'use strict';

// ─── COUNTRY CODES ──────────────────────────────────────────────────
const COUNTRY_CODES = [
  ['+1',   'United States (+1)'],
  ['+1',   'Canada (+1)'],
  ['+44',  'United Kingdom (+44)'],
  ['+91',  'India (+91)'],
  ['+86',  'China (+86)'],
  ['+49',  'Germany (+49)'],
  ['+33',  'France (+33)'],
  ['+39',  'Italy (+39)'],
  ['+34',  'Spain (+34)'],
  ['+61',  'Australia (+61)'],
  ['+64',  'New Zealand (+64)'],
  ['+81',  'Japan (+81)'],
  ['+82',  'South Korea (+82)'],
  ['+65',  'Singapore (+65)'],
  ['+971', 'UAE (+971)'],
  ['+966', 'Saudi Arabia (+966)'],
  ['+974', 'Qatar (+974)'],
  ['+973', 'Bahrain (+973)'],
  ['+20',  'Egypt (+20)'],
  ['+234', 'Nigeria (+234)'],
  ['+27',  'South Africa (+27)'],
  ['+254', 'Kenya (+254)'],
  ['+55',  'Brazil (+55)'],
  ['+52',  'Mexico (+52)'],
  ['+54',  'Argentina (+54)'],
  ['+57',  'Colombia (+57)'],
  ['+56',  'Chile (+56)'],
  ['+92',  'Pakistan (+92)'],
  ['+880', 'Bangladesh (+880)'],
  ['+94',  'Sri Lanka (+94)'],
  ['+977', 'Nepal (+977)'],
  ['+60',  'Malaysia (+60)'],
  ['+63',  'Philippines (+63)'],
  ['+66',  'Thailand (+66)'],
  ['+84',  'Vietnam (+84)'],
  ['+62',  'Indonesia (+62)'],
  ['+90',  'Turkey (+90)'],
  ['+7',   'Russia (+7)'],
  ['+380', 'Ukraine (+380)'],
  ['+48',  'Poland (+48)'],
  ['+31',  'Netherlands (+31)'],
  ['+32',  'Belgium (+32)'],
  ['+46',  'Sweden (+46)'],
  ['+47',  'Norway (+47)'],
  ['+45',  'Denmark (+45)'],
  ['+358', 'Finland (+358)'],
  ['+41',  'Switzerland (+41)'],
  ['+43',  'Austria (+43)'],
  ['+353', 'Ireland (+353)'],
  ['+351', 'Portugal (+351)'],
  ['+30',  'Greece (+30)'],
];

// ─── STATE ──────────────────────────────────────────────────────────
let isRunning = false;

// ─── HELPERS ────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function getVal(id) {
  const el = $(id);
  return el ? el.value.trim() : '';
}

function setVal(id, value) {
  const el = $(id);
  if (el) el.value = value || '';
}

function getChecked(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
    .map(el => el.value);
}

function setChecked(name, values) {
  document.querySelectorAll(`input[name="${name}"]`).forEach(el => {
    el.checked = Array.isArray(values) && values.includes(el.value);
  });
}

function populateCountrySelect(id, currentValue) {
  const sel = $(id);
  if (!sel) return;
  // Track if we've already selected one option — prevents duplicate +1 entries
  // (US and Canada both use +1) from both getting 'selected', which makes
  // the browser always fall back to whichever appears last.
  let matched = false;
  sel.innerHTML = COUNTRY_CODES.map(([val, label]) => {
    const pick = !matched && val === (currentValue || '+1');
    if (pick) matched = true;
    return `<option value="${val}"${pick ? ' selected' : ''}>${label}</option>`;
  }).join('');
}

// ─── INIT ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  populateCountrySelect('s1-phoneCountryCode', '+1');
  populateCountrySelect('sp-phoneCountryCode', '+1');

  wireStep1();
  wireStep2();
  wireSettingsPanel();
  wireMainButtons();

  await initApp();
});

async function initApp() {
  const local = await chrome.storage.local.get(['onboardingStep']);
  const sync  = await chrome.storage.sync.get(['firstName']);

  // Existing user who had extension before new onboarding flow
  if (!local.onboardingStep && sync.firstName) {
    await chrome.storage.local.set({ onboardingStep: 2 });
    showView('main');
    await initMain();
    return;
  }

  const step = local.onboardingStep || 0;
  if (step >= 2) {
    showView('main');
    await initMain();
  } else if (step === 1) {
    showView('credentials');
    await prefillStep2();
  } else {
    showView('signin');
    await prefillStep1();
  }
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const el = $(`view-${name}`);
  if (el) el.classList.remove('hidden');
  $('settings-panel').classList.add('hidden');
}

// ─── STEP 1: SIGN IN ─────────────────────────────────────────────────
async function prefillStep1() {
  const c = await chrome.storage.sync.get(['firstName','lastName','email','phone','phoneCountryCode','city']);
  setVal('s1-firstName', c.firstName);
  setVal('s1-lastName', c.lastName);
  setVal('s1-email', c.email);
  setVal('s1-phone', c.phone);
  setVal('s1-city', c.city);
  populateCountrySelect('s1-phoneCountryCode', c.phoneCountryCode || '+1');
}

function wireStep1() {
  $('signin-continue-btn').addEventListener('click', async () => {
    const firstName = getVal('s1-firstName');
    const lastName  = getVal('s1-lastName');
    const email     = getVal('s1-email');
    const phone     = getVal('s1-phone');

    if (!firstName || !lastName || !email || !phone) {
      showToast('Please fill all required fields (*)', 'error');
      return;
    }

    await chrome.storage.sync.set({
      firstName,
      lastName,
      email,
      phone,
      phoneCountryCode: getVal('s1-phoneCountryCode'),
      city: getVal('s1-city'),
    });
    await chrome.storage.local.set({ onboardingStep: 1 });

    showView('credentials');
    await prefillStep2();
  });
}

// ─── STEP 2: CREDENTIALS ─────────────────────────────────────────────
async function prefillStep2() {
  const c = await chrome.storage.sync.get([
    'filterKeywords','yearsOfExperience','expectedSalary',
    'visaSponsorship','legallyAuthorized','filterRemote','filterExp','applyLimit'
  ]);
  const local = await chrome.storage.local.get(['resumeFileName']);

  setVal('s2-filterKeywords', c.filterKeywords);
  setVal('s2-yearsOfExperience', c.yearsOfExperience || '2');
  setVal('s2-applyLimit', c.applyLimit || '2');
  setVal('s2-expectedSalary', c.expectedSalary);
  setVal('s2-visaSponsorship', c.visaSponsorship || 'no');
  setVal('s2-legallyAuthorized', c.legallyAuthorized || 'yes');

  if (c.filterRemote && c.filterRemote.length) setChecked('s2-remote', c.filterRemote);
  if (c.filterExp    && c.filterExp.length)    setChecked('s2-exp',    c.filterExp);

  if (local.resumeFileName) {
    const fn = $('s2-resumeFileName');
    const rb = $('s2-removeResumeBtn');
    if (fn) { fn.textContent = local.resumeFileName; fn.classList.add('has-file'); }
    if (rb) rb.style.display = 'inline-flex';
  }
}

function wireStep2() {
  $('creds-back-btn').addEventListener('click', () => {
    showView('signin');
    prefillStep1();
  });

  wireResumeUpload('s2-uploadResumeBtn', 's2-resumeFile', 's2-resumeFileName', 's2-removeResumeBtn');

  $('creds-save-btn').addEventListener('click', async () => {
    const keywords = getVal('s2-filterKeywords');
    const years    = getVal('s2-yearsOfExperience');

    if (!keywords) {
      showToast('Please enter your Job Keywords', 'error');
      return;
    }

    await chrome.storage.sync.set({
      filterKeywords:    keywords,
      yearsOfExperience: years || '2',
      expectedSalary:    getVal('s2-expectedSalary'),
      visaSponsorship:   getVal('s2-visaSponsorship'),
      legallyAuthorized: getVal('s2-legallyAuthorized'),
      filterRemote:      getChecked('s2-remote'),
      filterExp:         getChecked('s2-exp'),
      applyLimit:        getVal('s2-applyLimit') || '2',
    });
    await chrome.storage.local.set({ onboardingStep: 2 });

    showView('main');
    await initMain();
  });
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────
async function initMain() {
  const local = await chrome.storage.local.get(['isRunning', 'appliedCount', 'skippedCount']);
  isRunning = local.isRunning || false;
  updateButtons();
  updateStatusDisplay(isRunning ? 'Running' : 'Stopped', isRunning);

  const ac = $('applied-count');
  const sc = $('skipped-count');
  if (ac) ac.textContent = local.appliedCount || 0;
  if (sc) sc.textContent = local.skippedCount || 0;

  updateDownloadSection();

  // Poll counters every 2s
  setInterval(async () => {
    const l = await chrome.storage.local.get(['appliedCount','skippedCount']);
    if (ac) ac.textContent = l.appliedCount || 0;
    if (sc) sc.textContent = l.skippedCount || 0;
  }, 2000);
}

function updateButtons() {
  const s = $('start-btn');
  const p = $('stop-btn');
  if (s) s.disabled = isRunning;
  if (p) p.disabled = !isRunning;
}

function updateStatusDisplay(text, running) {
  const el = $('status');
  if (!el) return;
  el.textContent = text;
  el.className = running ? 'status-pill running' : 'status-pill stopped';
}

async function updateDownloadSection() {
  const local = await chrome.storage.local.get(['appliedCount']);
  const count = local.appliedCount || 0;
  const sec = $('download-section');
  if (!sec) return;
  if (!isRunning && count > 0) {
    sec.classList.remove('hidden');
  } else {
    sec.classList.add('hidden');
  }
}

function wireMainButtons() {
  // ── START ──
  $('start-btn').addEventListener('click', async () => {
    try {
      const cfg = await chrome.storage.sync.get([
        'firstName','email','filterKeywords',
        'filterExp','filterJtype','filterRemote',
      ]);
      if (!cfg.firstName || !cfg.email) {
        showToast('Complete your profile in Settings first', 'error');
        return;
      }
      if (!cfg.filterKeywords) {
        showToast('Add Job Keywords in Settings first', 'error');
        return;
      }

      const filterConfig = {
        expValues:    cfg.filterExp    || [],
        jtypeValues:  cfg.filterJtype  || [],
        remoteValues: cfg.filterRemote || [],
      };

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tab.id;

      const cap = ms => new Promise(r => setTimeout(r, ms));

      // ── Step 1: Feed → type → Enter → click Jobs tab ─────────────────────
      showToast('Opening LinkedIn feed...', 'info', 2000);
      await chrome.tabs.update(tabId, { url: 'https://www.linkedin.com/feed/' });
      await Promise.race([waitForTabLoad(tabId), cap(8000)]);
      await cap(1000);

      showToast(`Searching "${cfg.filterKeywords}"...`, 'info', 2000);
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (kw) => {
          const input = document.querySelector('[data-testid="typeahead-input"]');
          if (!input) return false;
          input.focus();
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (setter) setter.call(input, kw);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        },
        args: [cfg.filterKeywords],
      });
      await cap(800);

      // Press Enter
      const afterEnter = waitForTabLoad(tabId);
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const input = document.querySelector('[data-testid="typeahead-input"]');
          if (input) input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
        },
      });
      await Promise.race([afterEnter, cap(5000)]);
      await cap(1500);

      // Click Jobs tab if not already on jobs page
      const currentUrl = await chrome.tabs.get(tabId).then(t => t.url);
      if (!currentUrl.includes('/jobs/search/')) {
        showToast('Clicking Jobs tab...', 'info', 1500);
        const afterJobs = waitForTabLoad(tabId);
        await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            const btn = document.querySelector('[aria-label="Filter by Jobs"]');
            if (btn) { btn.click(); return 'clicked'; }
            // fallback: find any Jobs link
            const link = Array.from(document.querySelectorAll('a, button')).find(el => el.textContent.trim() === 'Jobs');
            if (link) { link.click(); return 'fallback'; }
            return 'not-found';
          },
        });
        await Promise.race([afterJobs, cap(8000)]);
        await cap(1000);
      }

      showToast('Step 1 done! Applying filters...', 'info', 2000);

      // ── Step 2: Apply filters via iframe panel ────────────────────────────
      // Retry iframe up to 3 times (reload if not found)
      for (let attempt = 1; attempt <= 3; attempt++) {
        await cap(2000);
        const iframeFound = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => !!document.querySelector('[data-testid="interop-iframe"]'),
        }).then(r => r[0]?.result).catch(() => false);

        if (iframeFound) break;
        if (attempt < 3) {
          showToast(`Page reload (attempt ${attempt}/3)...`, 'info', 2000);
          await chrome.tabs.reload(tabId);
          await Promise.race([waitForTabLoad(tabId), cap(8000)]);
        }
      }
      await cap(500);

      await chrome.scripting.executeScript({
        target: { tabId },
        func: async (fc) => {
          const wait = ms => new Promise(r => setTimeout(r, ms));
          const log  = msg => console.log('[ApplyEzee Filters]', msg);
          const EXP   = {'1':'Internship','2':'Entry level','3':'Associate','4':'Mid-Senior level','5':'Director','6':'Executive'};
          const JTYPE = {'F':'Full-time','P':'Part-time','C':'Contract','T':'Temporary','I':'Internship','O':'Other'};
          const REM   = {'1':'On-site','2':'Remote','3':'Hybrid'};

          const getIDoc = () => document.querySelector('[data-testid="interop-iframe"]')?.contentDocument;

          // Wait for Show filters button (max 6s)
          let allBtn = null;
          for (let i = 0; i < 24; i++) {
            const iDoc = getIDoc();
            if (iDoc) {
              allBtn = iDoc.querySelector('button[aria-label*="Show all filters" i]')
                    || Array.from(iDoc.querySelectorAll('button')).find(b => /show\s+filter|all\s+filter/i.test(b.textContent));
              if (allBtn) break;
            }
            await wait(250);
          }
          if (!allBtn) { log('Show filters button not found'); return; }
          log('Clicking Show filters');
          allBtn.click();

          // Wait for filter labels (panel-specific: contain "Filter by")
          let filterLabels = [];
          for (let i = 0; i < 20; i++) {
            await wait(250);
            const iDoc = getIDoc();
            if (iDoc) {
              filterLabels = Array.from(iDoc.querySelectorAll('label')).filter(l => l.textContent.includes('Filter by'));
              if (filterLabels.length > 0) { log(`Panel open — ${filterLabels.length} labels`); break; }
            }
          }
          if (!filterLabels.length) { log('Filter labels not found'); return; }

          const clickLbl = text => {
            const tl = text.toLowerCase();
            const iDoc = getIDoc();
            const l = Array.from(iDoc.querySelectorAll('label')).find(l =>
              l.textContent.trim().toLowerCase().startsWith(tl) && l.textContent.includes('Filter by')
            );
            if (l) { log(`✓ ${text}`); l.click(); return true; }
            log(`✗ ${text}`); return false;
          };

          // Easy Apply ON
          const eaEl = Array.from(getIDoc().querySelectorAll('*'))
            .filter(el => el.textContent.trim().replace(/\s+/g,' ') === 'Off Toggle Easy Apply filter').pop();
          if (eaEl) { log('Easy Apply ON'); eaEl.click(); await wait(150); }

          for (const v of fc.expValues    || []) { const t = EXP[v];   if (t) { clickLbl(t); await wait(100); } }
          for (const v of fc.jtypeValues  || []) { const t = JTYPE[v]; if (t) { clickLbl(t); await wait(100); } }
          for (const v of fc.remoteValues || []) { const t = REM[v];   if (t) { clickLbl(t); await wait(100); } }

          await wait(300);
          const showBtn = Array.from(getIDoc().querySelectorAll('button')).find(b =>
            /show\s+\d*\s*(result|job)/i.test(b.textContent) ||
            /apply\s+current\s+filter/i.test(b.getAttribute('aria-label') || '')
          );
          if (showBtn) { log(`Clicking Show results`); showBtn.click(); }
          else log('Show results not found');
        },
        args: [filterConfig],
      });

      await cap(2000);
      showToast('Filters applied! Starting bot...', 'success', 2000);

      // ── Step 3: Inject content script and start ───────────────────────────
      await chrome.storage.local.set({ userStopped: false });
      try {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['content-simple.js'] });
        await cap(300);
      } catch (_) {}

      showToast('Bot running!', 'success', 3000);
      const response = await chrome.tabs.sendMessage(tabId, { action: 'start' });
      if (response && response.success) console.log('[ApplyEzee] Bot started');

    } catch (err) {
      console.error('[ApplyEzee] Start error:', err);
      showToast('Error starting — try again', 'error');
    }
  });

  // ── STOP ──
  $('stop-btn').addEventListener('click', async () => {
    // Mark userStopped so the auto-restart watchdog doesn't resume
    await chrome.storage.local.set({ userStopped: true, isRunning: false });
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.url || !tab.url.includes('linkedin.com')) {
        isRunning = false;
        updateButtons();
        updateStatusDisplay('Stopped', false);
        updateDownloadSection();
        return;
      }
      await chrome.tabs.sendMessage(tab.id, { action: 'stop' });
      await new Promise(r => setTimeout(r, 300));
    } catch (_) {
      isRunning = false;
      updateButtons();
      updateStatusDisplay('Stopped', false);
      updateDownloadSection();
    }
  });

  // ── EXPORT CSV ──
  $('export-csv-btn').addEventListener('click', async () => {
    const { appliedJobs = [] } = await chrome.storage.local.get(['appliedJobs']);
    if (!appliedJobs.length) { showToast('No jobs applied yet', 'info'); return; }
    downloadBlob(toCSV(appliedJobs), 'text/csv;charset=utf-8;', `applyezee_${today()}.csv`);
    showToast(`Downloaded ${appliedJobs.length} jobs as CSV`, 'success');
  });

  // ── EXPORT EXCEL ──
  $('export-excel-btn').addEventListener('click', async () => {
    const { appliedJobs = [] } = await chrome.storage.local.get(['appliedJobs']);
    if (!appliedJobs.length) { showToast('No jobs applied yet', 'info'); return; }
    downloadBlob(toExcelXML(appliedJobs), 'application/vnd.ms-excel', `applyezee_${today()}.xls`);
    showToast(`Downloaded ${appliedJobs.length} jobs as Excel`, 'success');
  });

  // ── RUNTIME MESSAGES from content script ──
  chrome.runtime.onMessage.addListener((req) => {
    if (req.type === 'updateCount') {
      const el = $('applied-count');
      if (el) el.textContent = req.count;
    } else if (req.type === 'updateSkippedCount') {
      const el = $('skipped-count');
      if (el) el.textContent = req.count;
    } else if (req.type === 'botStarted') {
      isRunning = true;
      updateButtons();
      updateStatusDisplay('Running', true);
      updateDownloadSection();
    } else if (req.type === 'botStopped') {
      isRunning = false;
      updateButtons();
      updateStatusDisplay('Stopped', false);
      updateDownloadSection();
    }
  });
}

// ─── SETTINGS PANEL ──────────────────────────────────────────────────
function wireSettingsPanel() {
  $('settings-open-btn').addEventListener('click', async () => {
    await loadSettingsPanel();
    $('settings-panel').classList.remove('hidden');
  });

  $('settings-close-btn').addEventListener('click', () => {
    $('settings-panel').classList.add('hidden');
  });

  $('settings-save-btn').addEventListener('click', async () => {
    await saveSettings();
    showToast('Settings saved!', 'success');
    // Panel stays open so user can keep editing
  });

  // Delay risk live update
  const updateRisk = () => {
    const min = parseFloat(getVal('sp-minDelay')) || 3;
    const el  = $('sp-delay-risk');
    if (!el) return;
    if (min < 3) {
      el.className = 'delay-risk risky';
      el.textContent = 'High ban risk — LinkedIn may flag your account';
    } else if (min < 5) {
      el.className = 'delay-risk moderate';
      el.textContent = 'Moderate risk — monitor your account';
    } else {
      el.className = 'delay-risk safe';
      el.textContent = 'Safe — human-like speed';
    }
  };
  $('sp-minDelay').addEventListener('input', updateRisk);
  $('sp-maxDelay').addEventListener('input', updateRisk);

  wireResumeUpload('sp-uploadResumeBtn', 'sp-resumeFile', 'sp-resumeFileName', 'sp-removeResumeBtn');

  $('sp-clear-jobs-btn').addEventListener('click', async () => {
    if (!confirm('Clear all applied jobs? This cannot be undone.')) return;
    await chrome.storage.local.set({ appliedJobs: [] });
    loadJobsInSettings();
    updateDownloadSection();
  });

  $('sp-reset-btn').addEventListener('click', async () => {
    if (!confirm('Reset all counters and clear applied jobs?')) return;
    await chrome.storage.local.set({ appliedCount: 0, skippedCount: 0, appliedJobs: [] });
    const ac = $('applied-count');
    const sc = $('skipped-count');
    if (ac) ac.textContent = '0';
    if (sc) sc.textContent = '0';
    loadJobsInSettings();
    updateDownloadSection();
    showToast('Counters reset', 'success');
  });
}

async function loadSettingsPanel() {
  const c = await chrome.storage.sync.get([
    'firstName','lastName','email','phone','phoneCountryCode','city',
    'filterKeywords','yearsOfExperience','expectedSalary',
    'filterSort','filterDate','filterSalary',
    'filterExp','filterJtype','filterRemote',
    'titleKeywords','blacklistKeywords','maxYearsRequired',
    'minDelay','maxDelay',
    'visaSponsorship','legallyAuthorized','willingToRelocate','driversLicense','autoNextPage',
    'llmProvider','llmApiKey','llmModel','llmEndpoint'
  ]);
  const local = await chrome.storage.local.get(['resumeFileName']);

  // Personal
  setVal('sp-firstName', c.firstName);
  setVal('sp-lastName', c.lastName);
  setVal('sp-email', c.email);
  setVal('sp-phone', c.phone);
  setVal('sp-city', c.city);
  populateCountrySelect('sp-phoneCountryCode', c.phoneCountryCode || '+1');

  // AI
  setVal('sp-llmProvider', c.llmProvider || 'anthropic');
  setVal('sp-llmApiKey',   c.llmApiKey   || '');
  setVal('sp-llmModel',    c.llmModel    || '');
  setVal('sp-llmEndpoint', c.llmEndpoint || '');
  const endpointGroup = $('sp-llmEndpointGroup');
  if (endpointGroup) endpointGroup.style.display = (c.llmProvider === 'custom') ? '' : 'none';
  const providerSel = $('sp-llmProvider');
  if (providerSel) providerSel.addEventListener('change', () => {
    if (endpointGroup) endpointGroup.style.display = (providerSel.value === 'custom') ? '' : 'none';
  });

  // Job profile
  setVal('sp-filterKeywords', c.filterKeywords);
  setVal('sp-yearsOfExperience', c.yearsOfExperience || '2');

  // Resume
  const fn = $('sp-resumeFileName');
  const rb = $('sp-removeResumeBtn');
  if (local.resumeFileName) {
    if (fn) { fn.textContent = local.resumeFileName; fn.classList.add('has-file'); }
    if (rb) rb.style.display = 'inline-flex';
  } else {
    if (fn) { fn.textContent = 'No file chosen'; fn.classList.remove('has-file'); }
    if (rb) rb.style.display = 'none';
  }

  // Filters
  setVal('sp-filterSort',   c.filterSort   || 'R');
  setVal('sp-filterDate',   c.filterDate   || '');
  setVal('sp-filterSalary', c.filterSalary || '');
  setChecked('sp-exp',    c.filterExp    || ['2','4']);
  setChecked('sp-jtype',  c.filterJtype  || ['F']);
  setChecked('sp-remote', c.filterRemote || ['2','3']);

  // Preferences
  setVal('sp-titleKeywords',     c.titleKeywords);
  setVal('sp-blacklistKeywords', c.blacklistKeywords);
  setVal('sp-maxYearsRequired',  c.maxYearsRequired || '3');
  setVal('sp-expectedSalary',    c.expectedSalary);
  setVal('sp-minDelay',          c.minDelay || '3');
  setVal('sp-maxDelay',          c.maxDelay || '8');
  setVal('sp-visaSponsorship',   c.visaSponsorship   || 'no');
  setVal('sp-legallyAuthorized', c.legallyAuthorized || 'yes');
  setVal('sp-willingToRelocate', c.willingToRelocate || 'yes');
  setVal('sp-driversLicense',    c.driversLicense    || 'yes');

  const anp = $('sp-autoNextPage');
  if (anp) anp.checked = c.autoNextPage !== false;

  // Delay risk
  const min = parseFloat(c.minDelay || 3);
  const dr  = $('sp-delay-risk');
  if (dr) {
    if (min < 3)      { dr.className = 'delay-risk risky';    dr.textContent = 'High ban risk'; }
    else if (min < 5) { dr.className = 'delay-risk moderate'; dr.textContent = 'Moderate risk'; }
    else              { dr.className = 'delay-risk safe';      dr.textContent = 'Safe — human-like speed'; }
  }

  await loadJobsInSettings();
}

async function saveSettings() {
  await chrome.storage.sync.set({
    firstName:         getVal('sp-firstName'),
    lastName:          getVal('sp-lastName'),
    email:             getVal('sp-email'),
    phone:             getVal('sp-phone'),
    phoneCountryCode:  getVal('sp-phoneCountryCode'),
    city:              getVal('sp-city'),
    filterKeywords:    getVal('sp-filterKeywords'),
    yearsOfExperience: getVal('sp-yearsOfExperience'),
    expectedSalary:    getVal('sp-expectedSalary'),
    filterSort:        getVal('sp-filterSort'),
    filterDate:        getVal('sp-filterDate'),
    filterSalary:      getVal('sp-filterSalary'),
    filterExp:         getChecked('sp-exp'),
    filterJtype:       getChecked('sp-jtype'),
    filterRemote:      getChecked('sp-remote'),
    titleKeywords:     getVal('sp-titleKeywords'),
    blacklistKeywords: getVal('sp-blacklistKeywords'),
    maxYearsRequired:  getVal('sp-maxYearsRequired'),
    minDelay:          getVal('sp-minDelay'),
    maxDelay:          getVal('sp-maxDelay'),
    visaSponsorship:   getVal('sp-visaSponsorship'),
    legallyAuthorized: getVal('sp-legallyAuthorized'),
    willingToRelocate: getVal('sp-willingToRelocate'),
    driversLicense:    getVal('sp-driversLicense'),
    autoNextPage:      $('sp-autoNextPage') ? $('sp-autoNextPage').checked : true,
    llmProvider: getVal('sp-llmProvider'),
    llmApiKey:   getVal('sp-llmApiKey'),
    llmModel:    getVal('sp-llmModel'),
    llmEndpoint: getVal('sp-llmEndpoint'),
  });
}

async function loadJobsInSettings() {
  const { appliedJobs = [] } = await chrome.storage.local.get(['appliedJobs']);
  const list  = $('sp-jobs-list');
  const count = $('sp-jobs-count');
  if (count) count.textContent = appliedJobs.length;
  if (!list) return;

  if (!appliedJobs.length) {
    list.innerHTML = '<div class="empty-state"><p>No applications yet</p></div>';
    return;
  }

  const sorted = [...appliedJobs].sort((a, b) => new Date(b.date) - new Date(a.date));
  list.innerHTML = sorted.map(job => `
    <div class="job-card">
      <h4 class="job-title">${escHtml(job.title)}</h4>
      <p class="job-company">${escHtml(job.company)}</p>
      <p class="job-time">${timeAgo(job.date)}</p>
      <a href="${job.link}" target="_blank" class="job-link">
        View on LinkedIn
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </a>
    </div>
  `).join('');
}

// ─── LINKEDIN URL BUILDER ─────────────────────────────────────────────
async function buildLinkedInURL() {
  const c = await chrome.storage.sync.get([
    'filterKeywords','filterSort','filterDate','filterSalary',
    'filterExp','filterJtype','filterRemote'
  ]);

  const kw     = encodeURIComponent(c.filterKeywords || '');
  // LinkedIn: sortBy=R = Most Recent, sortBy=DD = Most Relevant
  const sort   = c.filterSort   || 'R';
  const date   = c.filterDate   || '';
  const salary = c.filterSalary || '';
  const exp    = c.filterExp    || [];
  const jtype  = c.filterJtype  || [];
  const remote = c.filterRemote || [];

  // f_AL=true is the current LinkedIn Easy Apply parameter (f_LF=f_AL is old/broken)
  let url = `https://www.linkedin.com/jobs/search/?keywords=${kw}&f_AL=true&origin=JOB_SEARCH_PAGE_JOB_FILTER`;
  if (sort)          url += `&sortBy=${sort}`;
  if (date)          url += `&f_TPR=${date}`;
  if (exp.length)    url += `&f_E=${encodeURIComponent(exp.join(','))}`;
  if (jtype.length)  url += `&f_JT=${encodeURIComponent(jtype.join(','))}`;
  if (remote.length) url += `&f_WT=${encodeURIComponent(remote.join(','))}`;
  if (salary)        url += `&f_SB2=${salary}`;

  return url;
}

// ─── RESUME UPLOAD ────────────────────────────────────────────────────
function wireResumeUpload(uploadBtnId, fileInputId, fileNameId, removeBtnId) {
  const uploadBtn = $(uploadBtnId);
  const fileInput = $(fileInputId);
  const fileName  = $(fileNameId);
  const removeBtn = $(removeBtnId);
  if (!uploadBtn || !fileInput) return;

  uploadBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { showToast('File too large — max 5 MB', 'error'); return; }

    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (!allowed.includes(file.type)) { showToast('Use PDF, DOC, or DOCX only', 'error'); return; }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      await chrome.storage.local.set({
        resumeFile: ev.target.result,
        resumeFileName: file.name,
        resumeFileType: file.type
      });
      if (fileName) { fileName.textContent = file.name; fileName.classList.add('has-file'); }
      if (removeBtn) removeBtn.style.display = 'inline-flex';
      showToast('Resume saved!', 'success');
    };
    reader.readAsDataURL(file);
  });

  if (removeBtn) {
    removeBtn.addEventListener('click', async () => {
      if (!confirm('Remove uploaded resume?')) return;
      await chrome.storage.local.remove(['resumeFile','resumeFileName','resumeFileType']);
      if (fileName) { fileName.textContent = 'No file chosen'; fileName.classList.remove('has-file'); }
      removeBtn.style.display = 'none';
      fileInput.value = '';
    });
  }
}

// ─── EXPORT ───────────────────────────────────────────────────────────
function toCSV(jobs) {
  const hdr  = ['Date','Job Title','Company','Link'].join(',');
  const rows = jobs.map(j => [
    `"${new Date(j.date).toLocaleString()}"`,
    `"${String(j.title   || '').replace(/"/g,'""')}"`,
    `"${String(j.company || '').replace(/"/g,'""')}"`,
    j.link || ''
  ].join(','));
  return [hdr, ...rows].join('\n');
}

function toExcelXML(jobs) {
  const x = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const cell = (v) => `<Cell><Data ss:Type="String">${x(v)}</Data></Cell>`;
  const hdr  = `<Row>${cell('Date')}${cell('Job Title')}${cell('Company')}${cell('Link')}</Row>`;
  const rows = jobs.map(j =>
    `<Row>${cell(new Date(j.date).toLocaleString())}${cell(j.title)}${cell(j.company)}${cell(j.link)}</Row>`
  ).join('');
  return `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Applied Jobs"><Table>${hdr}${rows}</Table></Worksheet></Workbook>`;
}

function downloadBlob(content, mimeType, filename) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function today() {
  return new Date().toISOString().split('T')[0];
}

// ─── TAB LOAD HELPER ──────────────────────────────────────────────────
function waitForTabLoad(tabId) {
  return new Promise(resolve => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 10000);
    function listener(id, changeInfo) {
      if (id === tabId && changeInfo.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// ─── UTILITY ──────────────────────────────────────────────────────────
function escHtml(text) {
  const d = document.createElement('div');
  d.textContent = text || '';
  return d.innerHTML;
}

function timeAgo(dateString) {
  const s = Math.floor((Date.now() - new Date(dateString)) / 1000);
  if (s < 60)     return 'Just now';
  if (s < 3600)   return `${Math.floor(s/60)}m ago`;
  if (s < 86400)  return `${Math.floor(s/3600)}h ago`;
  if (s < 604800) return `${Math.floor(s/86400)}d ago`;
  return new Date(dateString).toLocaleDateString();
}
