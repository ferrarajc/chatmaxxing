/**
 * Quality Loop — Conversation Runner (LEGACY — kept for reference)
 *
 * @deprecated This file is no longer imported by the active scripts.
 * The generic implementation lives in heqya/core/runner.mjs.
 * The Bob's-specific adapter is in scripts/quality-loop/bobs-adapter.mjs.
 * The active entry point is scripts/quality-loop/run-quality-loop.mjs.
 */

const API_BASE = process.env.API_BASE
  ?? 'https://0y3s5vq2v5.execute-api.us-east-1.amazonaws.com';

const AUTOPILOT_URL = `${API_BASE}/autopilot-turn`;
const RESET_URL     = `${API_BASE}/reset-client-data?key=bobs-reset-2025`;
const OPENAI_URL    = 'https://api.openai.com/v1/chat/completions';
const CUSTOMER_MODEL  = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
const MAX_TURNS       = 18;

// ── DynamoDB reset ─────────────────────────────────────────────────────────────

export async function resetClientData() {
  const res = await fetch(RESET_URL);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Reset failed (HTTP ${res.status}): ${body}`);
  }
  return true;
}

// ── Customer simulator (GPT-4o-mini) ──────────────────────────────────────────

async function simulateCustomerReply(scenario, agentMessage, conversationHistory) {
  const messages = [
    { role: 'system', content: scenario.customerPrompt },
    ...conversationHistory,
    { role: 'user', content: `The agent/bot just said:\n"${agentMessage}"\n\nWhat do you reply? (1-2 sentences, natural customer tone)` },
  ];

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ''}`,
    },
    body: JSON.stringify({
      model: CUSTOMER_MODEL,
      messages,
      max_tokens: 120,
      temperature: 0.6,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Customer LLM error (HTTP ${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.choices[0]?.message?.content?.trim() ?? '';
}

// ── Single scenario runner ─────────────────────────────────────────────────────

export async function runScenario(scenario, { verbose = false } = {}) {
  const startMs = Date.now();

  // Transcript sent to autopilot-turn (accumulates CUSTOMER + AGENT + SYSTEM messages)
  const transcript = [];
  // Parallel history for the customer LLM (OpenAI conversation format)
  const customerHistory = [];
  // All raw autopilot-turn response objects (for evaluator context)
  const responses = [];

  let proposedAction = null;
  let systemMessages = [];  // [TASK: id] injected when taskIdentified fires
  let turnCount = 0;
  let exitReason = 'max-turns';

  // Opening customer message
  const openingTs = Date.now();
  transcript.push({
    role: 'CUSTOMER',
    content: scenario.openingMessage,
    timestamp: openingTs,
  });
  customerHistory.push({
    role: 'assistant',
    content: `Customer said: "${scenario.openingMessage}"`,
  });

  if (verbose) {
    console.log(`  [${scenario.id}] CUSTOMER: ${scenario.openingMessage}`);
  }

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    // Merge transcript + system messages, sorted by timestamp
    const fullTranscript = [...transcript, ...systemMessages]
      .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

    // Call autopilot-turn
    const res = await fetch(AUTOPILOT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: fullTranscript,
        clientProfile: scenario.client,
        scope: scenario.scope,
        ...(scenario.currentIntent ? { currentIntent: scenario.currentIntent } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`autopilot-turn HTTP ${res.status}: ${body}`);
    }

    const result = await res.json();
    responses.push(result);

    // Inject [TASK: id] system message once identified
    if (result.taskIdentified && !systemMessages.find(m => m.content?.startsWith('[TASK:'))) {
      systemMessages.push({
        role: 'SYSTEM',
        content: `[TASK: ${result.taskIdentified}]`,
        timestamp: openingTs + turn * 2000 + 500,
      });
    }

    if (result.proposedAction) {
      proposedAction = result.proposedAction;
    }

    // No response text means the Lambda exited silently
    if (!result.response) {
      exitReason = 'no-response';
      break;
    }

    turnCount++;
    const agentTs = openingTs + turn * 2000 + 1000;
    transcript.push({
      role: 'AGENT',
      content: result.response,
      timestamp: agentTs,
    });

    if (verbose) {
      const preview = result.response.slice(0, 120).replace(/\n/g, ' ');
      console.log(`  [${scenario.id}] AGENT (turn ${turn + 1}): ${preview}…`);
    }

    if (result.shouldExitAutopilot) {
      exitReason = 'exit-autopilot';
      break;
    }

    // Simulate customer reply
    const customerReply = await simulateCustomerReply(scenario, result.response, customerHistory);

    customerHistory.push(
      { role: 'user',      content: `Agent: "${result.response}"` },
      { role: 'assistant', content: customerReply },
    );

    const customerTs = openingTs + turn * 2000 + 1500;
    transcript.push({
      role: 'CUSTOMER',
      content: customerReply,
      timestamp: customerTs,
    });

    if (verbose) {
      console.log(`  [${scenario.id}] CUSTOMER: ${customerReply}`);
    }
  }

  return {
    scenarioId: scenario.id,
    clientName: scenario.client.name,
    scope: scenario.scope,
    heuristics: scenario.heuristics,
    notes: scenario.notes,
    transcript,        // Full CUSTOMER/AGENT/SYSTEM messages
    responses,         // All autopilot-turn response objects
    proposedAction,
    turnCount,
    exitReason,
    durationMs: Date.now() - startMs,
  };
}

// ── Run all scenarios ──────────────────────────────────────────────────────────

export async function runAllScenarios(scenarios, { verbose = false, resetBetween = true } = {}) {
  const results = [];

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    process.stdout.write(`  [${i + 1}/${scenarios.length}] ${scenario.id.padEnd(42)} `);

    try {
      if (resetBetween) {
        await resetClientData();
      }

      const result = await runScenario(scenario, { verbose });
      results.push({ ...result, error: null });
      console.log(`✓  (${result.turnCount} turns, ${(result.durationMs / 1000).toFixed(1)}s)`);
    } catch (err) {
      results.push({
        scenarioId: scenario.id,
        clientName: scenario.client.name,
        scope: scenario.scope,
        heuristics: scenario.heuristics,
        notes: scenario.notes,
        transcript: [],
        responses: [],
        proposedAction: null,
        turnCount: 0,
        exitReason: 'error',
        durationMs: 0,
        error: err.message,
      });
      console.log(`✗  ERROR: ${err.message}`);
    }
  }

  return results;
}
