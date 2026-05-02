/**
 * Automated test for the add-account-access task-driven conversation.
 *
 * Simulates a real multi-turn chat: calls /autopilot-turn like the agent-app would,
 * feeds each agent response back as a CUSTOMER reply (via a simulated customer LLM),
 * and asserts that all 3 required fields end up in proposedAction.
 *
 * Pass threshold: 9/10 runs (90%)
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node lambda/tests/test-add-account-access.mjs
 *   OPENAI_API_KEY=sk-... LOCAL=1 node lambda/tests/test-add-account-access.mjs  (hits local Lambda URL)
 */

import { createRequire } from 'module';

const API_URL = process.env.LAMBDA_URL
  ?? 'https://0y3s5vq2v5.execute-api.us-east-1.amazonaws.com/autopilot-turn';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

if (!OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is required');
  process.exit(1);
}

const CLIENT_PROFILE = {
  clientId: 'test-001',
  name: 'Alex Johnson',
  phone: '4842384838',
  accounts: [{ type: 'Roth IRA', balance: 45000, id: 'acc-001' }],
  totalBalance: 45000,
  recentChatHistory: [],
};

// Simulated customer persona — natural, cooperative, slightly informal
const CUSTOMER_SYSTEM_PROMPT = `You are Alex Johnson, a real customer chatting with a financial services agent.
You want to add your wife Sarah Johnson (sarah.johnson@gmail.com) to your Roth IRA account with full access.

Rules:
- Answer the agent's questions naturally. Do not volunteer all information at once.
- Give ONE piece of information per reply unless the question asks for multiple.
- When asked for a name, say "Sarah Johnson".
- When asked for an email, say "sarah.johnson@gmail.com".
- When asked for access level, say "full access" (or equivalent natural phrasing).
- Keep replies short (1-2 sentences). Sound like a real person, not a form.
- Do NOT end the conversation yourself — let the agent lead.`;

async function simulateCustomerReply(agentMessage, conversationHistory) {
  const messages = [
    { role: 'system', content: CUSTOMER_SYSTEM_PROMPT },
    ...conversationHistory,
    { role: 'user', content: `The agent just said: "${agentMessage}"\nWhat do you reply?` },
  ];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      max_tokens: 100,
      temperature: 0.7,
    }),
  });

  if (!res.ok) throw new Error(`Customer LLM error ${res.status}`);
  const data = await res.json();
  return data.choices[0]?.message?.content?.trim() ?? '';
}

async function runSingleTest(runIndex) {
  const transcript = [];
  let systemMessages = [];

  // Seed with the initial customer message
  const initialMessage = "I want to give my wife access to my account";
  transcript.push({ role: 'CUSTOMER', content: initialMessage, timestamp: Date.now() });

  const conversationHistory = [
    { role: 'assistant', content: `Customer said: "${initialMessage}"` },
  ];

  let proposedAction = null;
  const MAX_TURNS = 12;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    // Build the full transcript including system messages
    const fullTranscript = [
      ...transcript,
      ...systemMessages,
    ].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

    // Call autopilot-turn
    const payload = {
      transcript: fullTranscript,
      clientProfile: CLIENT_PROFILE,
      scope: 'get-intent',
      currentIntent: 'add authorized account user give access',
    };

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`autopilot-turn HTTP ${res.status}: ${body}`);
    }

    const result = await res.json();

    // Inject [TASK: id] system message on first response that identifies the task
    if (result.taskIdentified && !systemMessages.find(m => m.content?.startsWith('[TASK:'))) {
      systemMessages.push({
        role: 'SYSTEM',
        content: `[TASK: ${result.taskIdentified}]`,
        timestamp: Date.now() + turn * 1000 + 1,
      });
    }

    if (!result.response) {
      // Empty response means autopilot exited without a message
      if (result.proposedAction) {
        proposedAction = result.proposedAction;
      }
      break;
    }

    // Add agent response to transcript
    transcript.push({
      role: 'AGENT',
      content: result.response,
      timestamp: Date.now() + turn * 1000 + 2,
    });

    if (result.proposedAction) {
      proposedAction = result.proposedAction;
    }

    if (result.shouldExitAutopilot) {
      break;
    }

    // Simulate customer reply
    const customerReply = await simulateCustomerReply(result.response, conversationHistory);
    conversationHistory.push(
      { role: 'user', content: `Agent: "${result.response}"` },
      { role: 'assistant', content: customerReply },
    );

    transcript.push({
      role: 'CUSTOMER',
      content: customerReply,
      timestamp: Date.now() + turn * 1000 + 3,
    });
  }

  // Validate
  const issues = [];
  if (!proposedAction) {
    issues.push('no proposedAction returned');
  } else {
    const fields = proposedAction.fields ?? [];
    const byKey = Object.fromEntries(fields.map(f => [f.key, f.value]));

    if (!byKey.personName || byKey.personName.trim() === '') {
      issues.push('personName missing from proposedAction');
    } else if (!/sarah johnson/i.test(byKey.personName)) {
      issues.push(`personName unexpected value: "${byKey.personName}"`);
    }

    if (!byKey.personEmail || byKey.personEmail.trim() === '') {
      issues.push('personEmail missing from proposedAction');
    } else if (!/sarah\.johnson@gmail\.com/i.test(byKey.personEmail)) {
      issues.push(`personEmail unexpected value: "${byKey.personEmail}"`);
    }

    if (!byKey.accessLevel || byKey.accessLevel.trim() === '') {
      issues.push('accessLevel missing from proposedAction');
    }
  }

  const passed = issues.length === 0;
  return { passed, issues, proposedAction, turnCount: transcript.filter(m => m.role === 'AGENT').length };
}

async function main() {
  const RUNS = 10;
  const PASS_THRESHOLD = 9;

  console.log(`\nRunning ${RUNS} simulated add-account-access conversations...\n`);

  let passCount = 0;
  const results = [];

  for (let i = 0; i < RUNS; i++) {
    process.stdout.write(`  Run ${i + 1}/${RUNS}: `);
    try {
      const result = await runSingleTest(i);
      results.push(result);
      if (result.passed) {
        passCount++;
        console.log(`PASS (${result.turnCount} agent turns)`);
      } else {
        console.log(`FAIL — ${result.issues.join(', ')}`);
        if (result.proposedAction) {
          console.log(`    proposedAction fields: ${JSON.stringify(result.proposedAction.fields)}`);
        }
      }
    } catch (err) {
      results.push({ passed: false, issues: [`exception: ${err.message}`] });
      console.log(`ERROR — ${err.message}`);
    }
  }

  console.log(`\nResult: ${passCount}/${RUNS} passed`);

  if (passCount >= PASS_THRESHOLD) {
    console.log(`✓ PASS — meets the 90% threshold (${PASS_THRESHOLD}/${RUNS} required)\n`);
    process.exit(0);
  } else {
    console.log(`✗ FAIL — below the 90% threshold (needed ${PASS_THRESHOLD}/${RUNS}, got ${passCount}/${RUNS})\n`);

    // Print failure summary
    const failures = results.filter(r => !r.passed);
    if (failures.length > 0) {
      console.log('Failure summary:');
      const issueCounts = {};
      for (const f of failures) {
        for (const issue of f.issues) {
          issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
        }
      }
      for (const [issue, count] of Object.entries(issueCounts)) {
        console.log(`  ${count}x: ${issue}`);
      }
      console.log('');
    }

    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
