/**
 * Heqya — Generic Conversation Runner
 *
 * Drives multi-turn conversations between a customer simulator (LLM) and the
 * system under test (via adapter). Completely decoupled from any specific API.
 *
 * ADAPTER INTERFACE — the adapter must implement:
 *   adapter.send({ messages, scenario, turnIndex, previousResponses })
 *     → Promise<{ reply: string, isDone: boolean, metadata?: any }>
 *
 *   adapter.reset({ scenario })       [optional]
 *     → Promise<void>
 *
 * MESSAGES FORMAT (passed to adapter.send):
 *   [{ role: 'customer'|'agent', content: string }, ...]
 *
 * SCENARIO (minimum required fields):
 *   { id, openingMessage, customerPrompt, heuristics, notes, ...appSpecificFields }
 */

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

// ── Customer simulator ─────────────────────────────────────────────────────────

async function simulateCustomerReply(scenario, agentMessage, history, llmConfig) {
  const messages = [
    { role: 'system', content: scenario.customerPrompt },
    ...history,
    {
      role: 'user',
      content: `The agent/bot just said:\n"${agentMessage}"\n\nWhat do you reply? (1-2 sentences, natural customer tone)`,
    },
  ];

  const res = await fetch(llmConfig.baseUrl ?? OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${llmConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: llmConfig.simulatorModel ?? 'gpt-4o-mini',
      messages,
      max_tokens: llmConfig.maxSimulatorTokens ?? 120,
      temperature: 0.6,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Customer simulator error (HTTP ${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.choices[0]?.message?.content?.trim() ?? '';
}

// ── Single scenario runner ─────────────────────────────────────────────────────

/**
 * Run a single scenario against the adapter.
 *
 * @param {object} scenario
 * @param {object} adapter
 * @param {object} options
 * @param {object} options.llm         - { apiKey, baseUrl?, simulatorModel?, maxSimulatorTokens? }
 * @param {number} [options.maxTurns]  - max conversation turns (default 18)
 * @param {boolean} [options.verbose]  - log each turn to stdout
 * @returns {Promise<RunResult>}
 */
export async function runScenario(scenario, adapter, options = {}) {
  const { llm, maxTurns = 18, verbose = false } = options;

  const startMs = Date.now();

  // Generic conversation history: [{ role: 'customer'|'agent', content }]
  const messages = [];
  // Internal OpenAI-format history for the customer simulator
  const simulatorHistory = [];
  // Metadata returned by adapter.send() on each turn
  const previousResponses = [];

  let turnCount = 0;
  let exitReason = 'max-turns';

  // Opening message
  messages.push({ role: 'customer', content: scenario.openingMessage });
  simulatorHistory.push({ role: 'assistant', content: `Customer said: "${scenario.openingMessage}"` });

  if (verbose) {
    console.log(`  [${scenario.id}] CUSTOMER: ${scenario.openingMessage}`);
  }

  for (let turnIndex = 0; turnIndex < maxTurns; turnIndex++) {
    // Call the system under test
    let sendResult;
    try {
      sendResult = await adapter.send({ messages, scenario, turnIndex, previousResponses });
    } catch (err) {
      throw new Error(`adapter.send() failed on turn ${turnIndex}: ${err.message}`);
    }

    const { reply, isDone, metadata } = sendResult;
    previousResponses.push(metadata ?? null);

    // No reply means the system exited silently
    if (!reply) {
      exitReason = 'no-reply';
      break;
    }

    turnCount++;
    messages.push({ role: 'agent', content: reply });

    if (verbose) {
      const preview = reply.slice(0, 120).replace(/\n/g, ' ');
      console.log(`  [${scenario.id}] AGENT (turn ${turnIndex + 1}): ${preview}…`);
    }

    if (isDone) {
      exitReason = 'done';
      break;
    }

    // Simulate customer reply
    const customerReply = await simulateCustomerReply(scenario, reply, simulatorHistory, llm);

    simulatorHistory.push(
      { role: 'user',      content: `Agent: "${reply}"` },
      { role: 'assistant', content: customerReply },
    );

    messages.push({ role: 'customer', content: customerReply });

    if (verbose) {
      console.log(`  [${scenario.id}] CUSTOMER: ${customerReply}`);
    }
  }

  return {
    scenarioId:  scenario.id,
    heuristics:  scenario.heuristics ?? [],
    notes:       scenario.notes ?? '',
    transcript:  messages,
    metadata:    previousResponses,
    turnCount,
    exitReason,
    durationMs:  Date.now() - startMs,
    error:       null,
  };
}

// ── Run all scenarios ──────────────────────────────────────────────────────────

/**
 * Run all scenarios sequentially, optionally resetting state between each.
 *
 * @param {object[]} scenarios
 * @param {object}   adapter
 * @param {object}   options
 * @param {object}   options.llm
 * @param {number}   [options.maxTurns]
 * @param {boolean}  [options.verbose]
 * @param {boolean}  [options.resetBetween]  - call adapter.reset() before each scenario (default true)
 * @returns {Promise<RunResult[]>}
 */
export async function runAllScenarios(scenarios, adapter, options = {}) {
  const { resetBetween = true, verbose = false } = options;
  const results = [];

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    process.stdout.write(`  [${i + 1}/${scenarios.length}] ${scenario.id.padEnd(42)} `);

    try {
      if (resetBetween && adapter.reset) {
        await adapter.reset({ scenario });
      }

      const result = await runScenario(scenario, adapter, options);
      results.push({ ...result, error: null });
      console.log(`✓  (${result.turnCount} turns, ${(result.durationMs / 1000).toFixed(1)}s)`);
    } catch (err) {
      results.push({
        scenarioId:  scenario.id,
        heuristics:  scenario.heuristics ?? [],
        notes:       scenario.notes ?? '',
        transcript:  [],
        metadata:    [],
        turnCount:   0,
        exitReason:  'error',
        durationMs:  0,
        error:       err.message,
      });
      console.log(`✗  ERROR: ${err.message}`);
    }
  }

  return results;
}
