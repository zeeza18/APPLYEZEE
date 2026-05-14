// Tell Chrome: clicking the toolbar icon opens the side panel
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);

// Service worker de l'extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('ApplyEzee v1.5.3 - Extension installed');

  chrome.storage.local.set({
    isRunning: false,
    userStopped: false,
    appliedCount: 0,
    skippedCount: 0,
    appliedJobs: [],
    onboardingCompleted: false
  });
});

// ── AUTO-RESTART WATCHDOG ─────────────────────────────────────────────────────
// If the jobs page reloads mid-run (stuck recovery, error, etc.) and the user
// did NOT explicitly stop, re-inject the content script and resume automatically.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url || !tab.url.includes('linkedin.com/jobs')) return;

  const state = await chrome.storage.local.get(['isRunning', 'userStopped']);
  if (!state.isRunning || state.userStopped) return;

  console.log('[AutoRestart] Jobs page reloaded while running — re-injecting bot...');
  try {
    await new Promise(r => setTimeout(r, 2000)); // let page settle
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content-simple.js'] });
    await new Promise(r => setTimeout(r, 800));
    await chrome.tabs.sendMessage(tabId, { action: 'start' });
    console.log('[AutoRestart] Bot restarted on tab', tabId);
  } catch (e) {
    console.warn('[AutoRestart] Failed to restart:', e.message);
  }
});

// ── MESSAGE HANDLER ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'incrementCount') {
    chrome.storage.local.get(['appliedCount'], (result) => {
      const newCount = (result.appliedCount || 0) + 1;
      chrome.storage.local.set({ appliedCount: newCount });
    });
  } else if (message.type === 'incrementSkippedCount') {
    chrome.storage.local.get(['skippedCount'], (result) => {
      const newCount = (result.skippedCount || 0) + 1;
      chrome.storage.local.set({ skippedCount: newCount });
    });
  } else if (message.type === 'setRunning') {
    chrome.storage.local.set({ isRunning: message.value });
  } else if (message.type === 'askLLM') {
    // Handle async and return true to keep channel open
    handleAskLLM(message).then(sendResponse).catch(err => {
      console.error('[LLM] Error:', err);
      sendResponse({ answer: null, error: err.message });
    });
    return true; // Keep message channel open for async response
  }
});

// ── LLM QUESTION ANSWERING ────────────────────────────────────────────────────
async function handleAskLLM({ question, fieldType, jobTitle, company, userProfile }) {
  const cfg = await chrome.storage.sync.get(['llmProvider','llmApiKey','llmModel']);
  const provider = cfg.llmProvider || 'anthropic';
  const apiKey   = cfg.llmApiKey;
  if (!apiKey) return { answer: null, error: 'No LLM API key set in Settings' };

  const systemPrompt =
    `You are filling out a job application form on behalf of a candidate. ` +
    `Answer ONLY the question asked. Be concise (1-3 sentences for textareas, one short phrase for inputs). ` +
    `Never fabricate credentials. ` +
    `Candidate: ${userProfile.firstName} ${userProfile.lastName}, ` +
    `${userProfile.yearsOfExperience || 2} years experience, based in ${userProfile.city || 'United States'}.`;

  const userMessage =
    `Job: ${jobTitle} at ${company}\nQuestion: "${question}"\nField type: ${fieldType}\nAnswer only:`;

  let answer = null;

  if (provider === 'anthropic') {
    const model = cfg.llmModel || 'claude-haiku-4-5-20251001';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key': apiKey, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 200, system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }] }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).substring(0,100)}`);
    answer = (await res.json()).content?.[0]?.text?.trim();

  } else if (provider === 'openai') {
    const model = cfg.llmModel || 'gpt-4o-mini';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, max_tokens: 200,
        messages: [{ role:'system', content: systemPrompt }, { role:'user', content: userMessage }] }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).substring(0,100)}`);
    answer = (await res.json()).choices?.[0]?.message?.content?.trim();

  } else if (provider === 'gemini') {
    const model = cfg.llmModel || 'gemini-1.5-flash';
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt + '\n\n' + userMessage }] }],
        generationConfig: { maxOutputTokens: 200 } }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).substring(0,100)}`);
    answer = (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  } else {
    // Generic OpenAI-compatible endpoint (e.g. Ollama, Groq, Together, etc.)
    const model = cfg.llmModel || 'llama3';
    const endpoint = cfg.llmEndpoint || 'http://localhost:11434/v1/chat/completions';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, max_tokens: 200,
        messages: [{ role:'system', content: systemPrompt }, { role:'user', content: userMessage }] }),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).substring(0,100)}`);
    answer = (await res.json()).choices?.[0]?.message?.content?.trim();
  }

  console.log(`[LLM/${provider}] Q: "${question}" → A: "${answer}"`);
  return { answer: answer || null };
}
