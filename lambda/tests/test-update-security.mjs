/**
 * Automated test for the update-security task.
 * Pass threshold: 9/10 runs
 * Usage: OPENAI_API_KEY=sk-... node lambda/tests/test-update-security.mjs
 */

const API_URL = process.env.LAMBDA_URL
  ?? 'https://0y3s5vq2v5.execute-api.us-east-1.amazonaws.com/autopilot-turn';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

if (!OPENAI_API_KEY) { console.error('OPENAI_API_KEY is required'); process.exit(1); }

const CLIENT_PROFILE = {
  clientId: 'test-019', name: 'Alex Johnson', phone: '4842384838',
  accounts: [{ type: 'Roth IRA', balance: 45000, id: 'acc-001' }],
  totalBalance: 45000, recentChatHistory: [],
};

const CUSTOMER_SYSTEM_PROMPT = `You are Alex Johnson, a customer chatting with a financial services agent.
You want to enable two-factor authentication on your account.

Rules:
- Answer questions naturally. Give one piece of info per reply.
- When asked what you need help with: say "I want to turn on two-factor authentication" or "enable 2FA".
- Keep replies short (1-2 sentences). Sound like a real person.
- Do NOT end the conversation yourself.`;

async function simulateCustomerReply(agentMessage, conversationHistory) {
  const messages = [
    { role: 'system', content: CUSTOMER_SYSTEM_PROMPT },
    ...conversationHistory,
    { role: 'user', content: `The agent just said: "${agentMessage}"\nWhat do you reply?` },
  ];
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: OPENAI_MODEL, messages, max_tokens: 100, temperature: 0.7 }),
  });
  if (!res.ok) throw new Error(`Customer LLM error ${res.status}`);
  const data = await res.json();
  return data.choices[0]?.message?.content?.trim() ?? '';
}

async function runSingleTest(runIndex, intentOverride) {
  const transcript = [];
  let systemMessages = [];
  const initialMessage = 'I want to enable two-factor authentication on my account';
  transcript.push({ role: 'CUSTOMER', content: initialMessage, timestamp: Date.now() });
  const conversationHistory = [{ role: 'assistant', content: `Customer said: "${initialMessage}"` }];
  let proposedAction = null;
  const MAX_TURNS = 8;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const fullTranscript = [...transcript, ...systemMessages]
      .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: fullTranscript, clientProfile: CLIENT_PROFILE,
        scope: 'get-intent', currentIntent: intentOverride ?? 'two-factor 2fa security account security login',
      }),
    });
    if (!res.ok) throw new Error(`autopilot-turn HTTP ${res.status}: ${await res.text()}`);
    const result = await res.json();

    if (result.taskIdentified && !systemMessages.find(m => m.content?.startsWith('[TASK:'))) {
      systemMessages.push({ role: 'SYSTEM', content: `[TASK: ${result.taskIdentified}]`, timestamp: Date.now() + turn * 1000 + 1 });
    }
    if (!result.response) { if (result.proposedAction) proposedAction = result.proposedAction; break; }
    transcript.push({ role: 'AGENT', content: result.response, timestamp: Date.now() + turn * 1000 + 2 });
    if (result.proposedAction) proposedAction = result.proposedAction;
    if (result.shouldExitAutopilot) break;

    const customerReply = await simulateCustomerReply(result.response, conversationHistory);
    conversationHistory.push({ role: 'user', content: `Agent: "${result.response}"` }, { role: 'assistant', content: customerReply });
    transcript.push({ role: 'CUSTOMER', content: customerReply, timestamp: Date.now() + turn * 1000 + 3 });
  }

  const issues = [];
  if (!proposedAction) { issues.push('no proposedAction returned'); }
  else {
    const byKey = Object.fromEntries((proposedAction.fields ?? []).map(f => [f.key, f.value]));
    if (!byKey.securityAction || !/2FA|two.factor/i.test(byKey.securityAction)) issues.push(`securityAction wrong: "${byKey.securityAction}"`);
    if (!byKey.securityAction || !/enable/i.test(byKey.securityAction)) issues.push(`securityAction should be Enable 2FA: "${byKey.securityAction}"`);
  }
  // Deduplicate issues
  const uniqueIssues = [...new Set(issues)];
  return { passed: uniqueIssues.length === 0, issues: uniqueIssues, proposedAction, turnCount: transcript.filter(m => m.role === 'AGENT').length };
}

const LLM_FALLBACK_INTENTS = [
  'The customer wants to make their account more secure with a second verification step',
  'Client wants to add extra protection to their login',
  'The client would like to set up additional security on their account',
];

async function main() {
  const RUNS = 10; const PASS_THRESHOLD = 9;
  console.log(`\nRunning ${RUNS} simulated update-security conversations...\n`);
  let passCount = 0; const results = [];

  for (let i = 0; i < RUNS; i++) {
    process.stdout.write(`  Run ${i + 1}/${RUNS}: `);
    try {
      const r = await runSingleTest(i);
      results.push(r);
      if (r.passed) { passCount++; console.log(`PASS (${r.turnCount} turns)`); }
      else console.log(`FAIL — ${r.issues.join(', ')}`);
    } catch (err) { results.push({ passed: false, issues: [`exception: ${err.message}`] }); console.log(`ERROR — ${err.message}`); }
  }

  console.log(`\nResult: ${passCount}/${RUNS} passed`);
  if (passCount < PASS_THRESHOLD) { console.log(`✗ FAIL\n`); process.exit(1); }
  console.log(`✓ PASS`);

  console.log(`\nRunning LLM-fallback routing test...\n`);
  let fallbackPass = 0;
  for (const intent of LLM_FALLBACK_INTENTS) {
    process.stdout.write(`  "${intent.slice(0, 60)}": `);
    try {
      const r = await runSingleTest(0, intent);
      if (r.passed) { fallbackPass++; console.log(`PASS`); } else console.log(`FAIL — ${r.issues.join(', ')}`);
    } catch (err) { console.log(`ERROR — ${err.message}`); }
  }
  const fallbackThreshold = Math.ceil(LLM_FALLBACK_INTENTS.length * 0.9);
  if (fallbackPass < fallbackThreshold) { console.log(`✗ FAIL — LLM fallback routing below threshold\n`); process.exit(1); }
  console.log(`✓ PASS — LLM fallback routing works\n`);
  process.exit(0);
}

main().catch(err => { console.error('Unexpected error:', err); process.exit(1); });
