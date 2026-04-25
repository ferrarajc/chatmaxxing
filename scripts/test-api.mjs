/**
 * End-to-end API test script — tests all key Lambda endpoints against the live API.
 * Run from repo root:
 *   node scripts/test-api.mjs
 *
 * Requires VITE_API_URL to be set (or reads agent-app/.env.local automatically).
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Config ────────────────────────────────────────────────────────────────────
let API_URL = process.env.VITE_API_URL;
if (!API_URL) {
  try {
    const env = readFileSync(resolve(process.cwd(), 'agent-app/.env.local'), 'utf8');
    const match = env.match(/VITE_API_URL=(.+)/);
    if (match) API_URL = match[1].trim();
  } catch { /* ignore */ }
}
if (!API_URL) {
  console.error('VITE_API_URL not set. Export it or ensure agent-app/.env.local exists.');
  process.exit(1);
}

const BASE = API_URL.replace(/\/$/, '');

// ── Test helpers ──────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const RESULTS = [];

async function test(name, fn) {
  const startMs = Date.now();
  try {
    const result = await fn();
    const durationMs = Date.now() - startMs;
    console.log(`  ✅  ${name} (${durationMs}ms)`);
    if (result?.note) console.log(`       → ${result.note}`);
    RESULTS.push({ name, ok: true, durationMs });
    passed++;
  } catch (err) {
    const durationMs = Date.now() - startMs;
    console.log(`  ❌  ${name} (${durationMs}ms): ${err.message}`);
    RESULTS.push({ name, ok: false, durationMs, error: err.message });
    failed++;
  }
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

// ── Sample data ───────────────────────────────────────────────────────────────
const DEMO_PROFILE = {
  clientId: 'demo-client-001',
  name: 'Alex Johnson',
  phone: '4842384838',
  accounts: [
    { type: 'Roth IRA', balance: 45230, id: 'acc-001' },
    { type: 'Traditional IRA', balance: 128450, id: 'acc-002' },
    { type: 'Taxable Account', balance: 67890, id: 'acc-003' },
  ],
  totalBalance: 241570,
  recentChatHistory: [],
};

const SHORT_TRANSCRIPT = [
  { role: 'CUSTOMER', content: 'Hi, I want to ask about my Roth IRA contribution limits for this year.', timestamp: Date.now() - 60000 },
  { role: 'AGENT',    content: 'Hi Alex, I can help with that. What specifically would you like to know?', timestamp: Date.now() - 50000 },
  { role: 'CUSTOMER', content: 'Can I still contribute for 2025 and what is the max amount?', timestamp: Date.now() - 40000 },
];

const CALLBACK_TRANSCRIPT = [
  { role: 'CUSTOMER', content: 'I want to do a Roth conversion — can you help with that?', timestamp: Date.now() - 90000 },
  { role: 'AGENT',    content: "I'd be happy to help with a Roth conversion. This requires a phone call — I can schedule a callback for you.", timestamp: Date.now() - 80000 },
  { role: 'CUSTOMER', content: 'Yes please.', timestamp: Date.now() - 70000 },
  { role: 'AGENT',    content: 'The number I have on file for you is (484) 223-8483. Is that the best number?', timestamp: Date.now() - 60000 },
  { role: 'CUSTOMER', content: 'Yes that works.', timestamp: Date.now() - 50000 },
  { role: 'AGENT',    content: 'What time works for you? Agents are available until 7:30 PM Eastern.', timestamp: Date.now() - 40000 },
  { role: 'CUSTOMER', content: 'Tomorrow at 2pm would be great.', timestamp: Date.now() - 30000 },
];

const ENDED_TRANSCRIPT = [
  ...SHORT_TRANSCRIPT,
  { role: 'AGENT',    content: 'The 2025 Roth IRA contribution limit is $7,000 ($8,000 if you are 50 or older). You have until the tax deadline in April 2026.', timestamp: Date.now() - 30000 },
  { role: 'CUSTOMER', content: 'Perfect, thank you so much!', timestamp: Date.now() - 20000 },
  { role: 'AGENT',    content: 'Happy to help! Is there anything else I can assist you with today?', timestamp: Date.now() - 10000 },
  { role: 'CUSTOMER', content: 'No that was everything, have a great day!', timestamp: Date.now() - 5000 },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log(`\nBob's Mutual Funds — API Test Suite`);
console.log(`API: ${BASE}\n`);

console.log('── /next-best-response ──────────────────────────────────────────');

await test('Returns suggestedText and resources', async () => {
  const r = await post('/next-best-response', { transcript: SHORT_TRANSCRIPT, clientProfile: DEMO_PROFILE });
  if (!r.suggestedText) throw new Error('No suggestedText in response');
  if (!Array.isArray(r.resources)) throw new Error('resources not an array');
  return { note: `"${r.suggestedText.slice(0, 60)}..."` };
});

await test('suggestedScope is valid or null', async () => {
  const r = await post('/next-best-response', { transcript: SHORT_TRANSCRIPT, clientProfile: DEMO_PROFILE });
  const VALID = [null, 'get-intent', 'full-auto', 'callback', 'researching', 'idle-check'];
  if (!VALID.includes(r.suggestedScope)) throw new Error(`Invalid scope: ${r.suggestedScope}`);
  return { note: `scope=${r.suggestedScope}` };
});

console.log('\n── /autopilot-turn ──────────────────────────────────────────────');

await test('get-intent scope — returns greeting + shouldExitAutopilot=false', async () => {
  const greeting = [{ role: 'CUSTOMER', content: 'Hello, I have a question.', timestamp: Date.now() - 5000 }];
  const r = await post('/autopilot-turn', {
    transcript: greeting,
    clientProfile: DEMO_PROFILE,
    scope: 'get-intent',
    currentIntent: 'General inquiry',
  });
  if (!r.response) throw new Error('No response text');
  if (r.shouldExitAutopilot !== false) throw new Error(`Expected shouldExitAutopilot=false on greeting, got ${r.shouldExitAutopilot}`);
  return { note: `"${r.response.slice(0, 60)}..."` };
});

await test('full-auto scope — answers IRA question', async () => {
  const r = await post('/autopilot-turn', {
    transcript: SHORT_TRANSCRIPT,
    clientProfile: DEMO_PROFILE,
    scope: 'full-auto',
    currentIntent: 'IRA contribution question',
  });
  if (!r.response) throw new Error('No response text');
  return { note: `shouldExit=${r.shouldExitAutopilot}, "${r.response.slice(0, 60)}..."` };
});

await test('callback scope — step 4 returns scheduleCallback with phone+time', async () => {
  const r = await post('/autopilot-turn', {
    transcript: CALLBACK_TRANSCRIPT,
    clientProfile: DEMO_PROFILE,
    scope: 'callback',
    currentIntent: 'Roth conversion discussion',
  });
  if (!r.scheduleCallback) throw new Error('Expected scheduleCallback to be populated');
  if (!r.scheduleCallback.phoneNumber) throw new Error('Missing phoneNumber in scheduleCallback');
  if (!r.scheduleCallback.scheduledTimeISO) throw new Error('Missing scheduledTimeISO');
  return { note: `phone=${r.scheduleCallback.phoneNumber}, time=${r.scheduleCallback.scheduledTimeISO}` };
});

await test('callback scope step 6 — asks "anything else?" after CALLBACK_SCHEDULED', async () => {
  const transcriptWithScheduled = [
    ...CALLBACK_TRANSCRIPT,
    { role: 'AGENT', content: "Great — I've scheduled your callback for tomorrow at 2 PM. You'll receive a call at (484) 223-8483.", timestamp: Date.now() - 20000 },
    { role: 'SYSTEM', content: '[CALLBACK_SCHEDULED] Tomorrow at 2:00 PM ET → 4842238483', timestamp: Date.now() - 19000 },
    { role: 'CUSTOMER', content: 'Thanks so much!', timestamp: Date.now() - 10000 },
  ];
  const r = await post('/autopilot-turn', {
    transcript: transcriptWithScheduled,
    clientProfile: DEMO_PROFILE,
    scope: 'callback',
    currentIntent: 'Roth conversion',
  });
  if (!r.response) throw new Error('No response after CALLBACK_SCHEDULED + customer reply');
  if (r.scheduleCallback) throw new Error('Should NOT return scheduleCallback again (already done)');
  return { note: `"${r.response.slice(0, 60)}..."` };
});

await test('escalation hard-override fires on "speak to a live agent"', async () => {
  const escalationTranscript = [
    { role: 'CUSTOMER', content: 'I want to speak to a live agent please.', timestamp: Date.now() - 5000 },
  ];
  const r = await post('/autopilot-turn', {
    transcript: escalationTranscript,
    clientProfile: DEMO_PROFILE,
    scope: 'full-auto',
    currentIntent: 'Escalation',
  });
  if (!r.shouldExitAutopilot) throw new Error('Expected shouldExitAutopilot=true on escalation keyword');
  return { note: 'escalation correctly detected' };
});

console.log('\n── /generate-acw ────────────────────────────────────────────────');

await test('Returns wrapUpCode, coaching, summary', async () => {
  const r = await post('/generate-acw', { transcript: ENDED_TRANSCRIPT, clientProfile: DEMO_PROFILE });
  if (!r.wrapUpCode) throw new Error('Missing wrapUpCode');
  if (!r.coaching?.positive) throw new Error('Missing coaching.positive');
  if (!Array.isArray(r.coaching.bullets)) throw new Error('coaching.bullets must be array');
  if (r.coaching.bullets.length > 2) throw new Error(`Too many bullets: ${r.coaching.bullets.length} (max 2)`);
  if (!r.summary) throw new Error('Missing summary');
  return { note: `code="${r.wrapUpCode}", bullets=${r.coaching.bullets.length}, summary_len=${r.summary.length}` };
});

await test('wrapUpCode is a valid code (not Callback Scheduled)', async () => {
  const r = await post('/generate-acw', { transcript: ENDED_TRANSCRIPT, clientProfile: DEMO_PROFILE });
  const INVALID = ['Callback Scheduled'];
  if (INVALID.includes(r.wrapUpCode)) throw new Error(`Invalid code returned: ${r.wrapUpCode}`);
  return { note: `code="${r.wrapUpCode}"` };
});

console.log('\n── /predict-intent ──────────────────────────────────────────────');

// predict-intent is the customer widget's topic-picker: takes currentPage + clientId
// and returns 4 suggested chat topics.
await test('Returns 4 topics array for a given page', async () => {
  const r = await post('/predict-intent', { currentPage: 'home', clientId: 'demo-client-001' });
  if (!Array.isArray(r.topics)) throw new Error('topics must be an array: ' + JSON.stringify(r));
  if (r.topics.length !== 4) throw new Error(`Expected 4 topics, got ${r.topics.length}`);
  return { note: r.topics.join(' | ') };
});

await test('Returns somethingElse=true flag', async () => {
  const r = await post('/predict-intent', { currentPage: 'portfolio', clientId: 'demo-client-001' });
  if (r.somethingElse !== true) throw new Error(`Expected somethingElse=true, got ${r.somethingElse}`);
  return { note: 'flag present' };
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailed tests:');
  RESULTS.filter(r => !r.ok).forEach(r => console.log(`  • ${r.name}: ${r.error}`));
  process.exit(1);
} else {
  console.log('\nAll tests passed ✅');
}
