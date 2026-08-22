/**
 * Routing test for `forceTaskId` — the agent starting a task automation directly
 * from the ✈ menu instead of routing through Get intent's classifier.
 *
 * Unlike the per-task conversation harnesses in this folder, this one asserts
 * ROUTING only: single /autopilot-turn calls, deterministic assertions, no
 * simulated customer and no OPENAI_API_KEY needed locally (the Lambda holds it).
 *
 * Defaults to PROD like its sibling tests (this endpoint is read-only). Point it
 * at dev with LAMBDA_URL when verifying a branch before merge.
 *
 * Usage:
 *   node lambda/tests/test-force-task.mjs
 *   LAMBDA_URL=https://1cppcq9q57.execute-api.us-east-1.amazonaws.com/autopilot-turn node lambda/tests/test-force-task.mjs
 */

const API_URL = process.env.LAMBDA_URL
  ?? 'https://0y3s5vq2v5.execute-api.us-east-1.amazonaws.com/autopilot-turn';

const CLIENT_PROFILE = {
  clientId: 'test-001',
  name: 'Alex Johnson',
  phone: '4842384838',
  accounts: [
    { type: 'Roth IRA', balance: 45000, id: 'acc-001' },
    { type: 'Traditional IRA', balance: 120000, id: 'acc-002' },
  ],
  totalBalance: 165000,
  recentChatHistory: [],
};

let t = 0;
const msg = (role, content) => ({ role, content, timestamp: Date.now() + (t++ * 1000) });

async function turn(body) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientProfile: CLIENT_PROFILE, scope: 'get-intent', ...body }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

let passed = 0;
let failed = 0;

function check(name, ok, detail) {
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}`);
    if (detail) console.log(`     ${detail}`);
  }
}

async function run(name, fn) {
  console.log(`\n▶ ${name}`);
  try {
    await fn();
  } catch (e) {
    failed++;
    console.log(`  ❌ threw: ${e.message}`);
  }
}

const CHITCHAT = [
  msg('CUSTOMER', 'Hi there, thanks for taking my chat.'),
  msg('AGENT', 'Happy to help! What can I do for you today?'),
];

await run('forceTaskId starts the chosen expert with no matching intent', async () => {
  // currentIntent deliberately says nothing a classifier could use.
  const r = await turn({
    transcript: CHITCHAT,
    currentIntent: 'general inquiry',
    forceTaskId: 'update-beneficiaries',
  });
  check('taskIdentified is update-beneficiaries', r.taskIdentified === 'update-beneficiaries',
    `got ${JSON.stringify(r.taskIdentified)}`);
  check('expert produced an opening message', typeof r.response === 'string' && r.response.length > 0);
  check('did not exit autopilot', r.shouldExitAutopilot !== true);
});

await run('forceTaskId beats a stale [TASK:] marker already in the transcript', async () => {
  const r = await turn({
    transcript: [
      ...CHITCHAT,
      msg('SYSTEM', '[TASK: place-sale]'),
      msg('AGENT', 'Which fund would you like to sell?'),
      msg('CUSTOMER', 'Actually never mind that.'),
    ],
    currentIntent: 'sell fund shares',
    forceTaskId: 'request-tax-document',
  });
  check('taskIdentified is request-tax-document', r.taskIdentified === 'request-tax-document',
    `got ${JSON.stringify(r.taskIdentified)}`);
});

await run('without forceTaskId, the LAST [TASK:] marker wins (sequential tasks)', async () => {
  const r = await turn({
    transcript: [
      ...CHITCHAT,
      msg('SYSTEM', '[TASK: place-sale]'),
      msg('AGENT', 'Which fund would you like to sell?'),
      msg('CUSTOMER', 'Let us skip that for now.'),
      msg('SYSTEM', '[TASK: request-tax-document]'),
      msg('AGENT', 'Sure — which tax document do you need?'),
      msg('CUSTOMER', 'What do you need from me?'),
    ],
    currentIntent: 'sell fund shares',
  });
  check('Phase 2 ran (no new task identified)', !r.taskIdentified,
    `got ${JSON.stringify(r.taskIdentified)}`);
  check(
    'the tax-document expert answered, not the sale expert',
    /form|1099|5498|1098|tax year|statement|document/i.test(r.response ?? ''),
    `response: ${r.response}`,
  );
});

await run('forceTaskId overrides the financial-advice redirect', async () => {
  const r = await turn({
    transcript: [
      ...CHITCHAT,
      msg('CUSTOMER', 'What are the best stocks to buy right now?'),
    ],
    currentIntent: 'investment advice',
    forceTaskId: 'update-beneficiaries',
  });
  check('taskIdentified is update-beneficiaries', r.taskIdentified === 'update-beneficiaries',
    `got ${JSON.stringify(r.taskIdentified)}`);
  check('did not fall through to the callback redirect', r.suggestedScope !== 'callback',
    `suggestedScope: ${r.suggestedScope}`);
});

// The two cases below each drive a FULL task-expert turn (~3.5k prompt tokens) rather
// than asserting routing only, so back-to-back they push the suite past OpenAI's 30k
// tokens-per-minute limit and the handler correctly falls back to its holding reply
// ("I'm pulling some information..."). Pace them so the assertions test the guard rather
// than the rate limiter.
const settle = (ms = 20000) => new Promise(r => setTimeout(r, ms));

// THE production path that broke. forceTaskId is sent only on the kickoff turn; every
// later turn is carried by the [TASK:] marker alone. The advice guard used to run before
// that marker was even parsed, so it fired on mid-task client messages and killed the
// expert. A client answering the buy-funds expert's own "which fund?" question with a
// question about their own holdings got the scripted advice decline and a callback.
await settle();
await run('a mid-task holdings question does NOT trigger the advice redirect', async () => {
  const r = await turn({
    transcript: [
      ...CHITCHAT,
      msg('SYSTEM', '[TASK: place-purchase]'),
      msg('AGENT', 'Sure, I can take care of that for you. Which account would you like to purchase into?'),
      msg('CUSTOMER', 'The one that is not the Roth'),
      msg('AGENT', 'Which fund would you like to purchase, and how much would you like to invest?'),
      msg('CUSTOMER', 'Which fund do I hold right now'),
    ],
    currentIntent: 'buy fund shares',
    // deliberately NO forceTaskId — this is turn N of a running task
  });
  check('did not redirect to a callback', r.suggestedScope !== 'callback',
    `suggestedScope: ${r.suggestedScope}`);
  check('did not exit autopilot', r.shouldExitAutopilot !== true,
    `shouldExitAutopilot: ${r.shouldExitAutopilot}`);
  check('did not send the advice decline',
    !/not permitted to provide personalized investment advice/i.test(r.response ?? ''),
    `response: ${r.response}`);
  check('the expert answered about holdings instead',
    /BFESG|ESG|hold|own|currently/i.test(r.response ?? ''),
    `response: ${r.response}`);
});

// The guard must still fire mid-task for a REAL advice request — via the expert's own
// FORBIDDEN_TOPICS rules rather than the pre-task regex.
await settle();
await run('a mid-task genuine advice request is still declined', async () => {
  const r = await turn({
    transcript: [
      ...CHITCHAT,
      msg('SYSTEM', '[TASK: place-purchase]'),
      msg('AGENT', 'Which fund would you like to purchase?'),
      msg('CUSTOMER', 'Which fund is best for me?'),
    ],
    currentIntent: 'buy fund shares',
  });
  check('declined or routed to an advisor',
    r.suggestedScope === 'callback' ||
    /not permitted|licensed|advisor/i.test(r.response ?? ''),
    `scope: ${r.suggestedScope} response: ${r.response}`);
});

await run('an unknown forceTaskId falls back to normal classification', async () => {
  const r = await turn({
    transcript: [...CHITCHAT, msg('CUSTOMER', 'I want to update my beneficiaries.')],
    currentIntent: 'change beneficiaries',
    forceTaskId: 'not-a-real-task',
  });
  check('no error, classifier still ran', r.taskIdentified === 'update-beneficiaries',
    `got ${JSON.stringify(r.taskIdentified)}`);
});

await run('cancel and reschedule both reach the same expert', async () => {
  // The menu shows two rows for one task; both send the same forceTaskId and the
  // expert works out which the client wants from the transcript.
  for (const [what, line] of [
    ['cancel', 'I need to cancel the callback you scheduled for me.'],
    ['reschedule', 'Can we move my scheduled callback to a different day?'],
  ]) {
    const r = await turn({
      transcript: [...CHITCHAT, msg('CUSTOMER', line)],
      currentIntent: 'general inquiry',
      forceTaskId: 'cancel-reschedule-callback',
    });
    check(`${what}: taskIdentified is cancel-reschedule-callback`,
      r.taskIdentified === 'cancel-reschedule-callback',
      `got ${JSON.stringify(r.taskIdentified)}`);
  }
});

console.log(`\n${'─'.repeat(50)}`);
console.log(`${passed} passed, ${failed} failed  (${API_URL})`);
process.exit(failed === 0 ? 0 : 1);
