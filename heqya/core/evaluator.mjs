/**
 * Heqya — Generic LLM Evaluator
 *
 * Scores a completed conversation against a heuristics document using an LLM.
 * Entirely driven by the heuristics config — no hardwired heuristic codes.
 *
 * HEURISTICS CONFIG:
 *   heuristics.document      — full text of the heuristics document
 *   heuristics.codes         — { [code]: { name } }
 *   heuristics.domainKnowledge  — optional extra context for the evaluator system prompt
 *
 * LLM CONFIG:
 *   llm.apiKey               — OpenAI API key
 *   llm.baseUrl              — optional override (default: OpenAI)
 *   llm.evaluatorModel       — model to use (default: 'gpt-4o')
 */

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

// ── Format transcript for evaluator ──────────────────────────────────────────

function formatTranscript(transcript) {
  return transcript
    .map((m, i) => {
      const label = m.role === 'customer' ? 'CUSTOMER' : 'BOT/AGENT';
      return `[Turn ${i}] ${label}: ${m.content}`;
    })
    .join('\n\n');
}

// ── Build the expected JSON schema for the evaluator response ─────────────────

function buildResponseSchema(codes) {
  const codeList = Object.keys(codes);

  const scoreEntries = codeList
    .map(c => `    "${c}": "Pass|Marginal|Fail|N/A"`)
    .join(',\n');
  const noteEntries = codeList
    .map(c => `    "${c}": "one-sentence explanation"`)
    .join(',\n');
  const turnEntries = codeList
    .map(c => `    "${c}": []`)
    .join(',\n');

  return `{
  "scenarioId": "<from scenario information>",
  "scores": {
${scoreEntries}
  },
  "notes": {
${noteEntries}
  },
  "violatedTurns": {
${turnEntries}
  }
}`;
}

// ── Single scenario evaluation ─────────────────────────────────────────────────

/**
 * Evaluate one completed conversation against the heuristics.
 *
 * @param {object} runResult      - from runner.runScenario()
 * @param {object} heuristics     - { document, codes, domainKnowledge? }
 * @param {object} llm            - { apiKey, baseUrl?, evaluatorModel? }
 * @returns {Promise<EvalResult>}
 */
export async function evaluateConversation(runResult, heuristics, llm) {
  const { codes, document: heuristicsDoc, domainKnowledge = '' } = heuristics;
  const codeList = Object.keys(codes);

  if (runResult.error) {
    // Scenario errored — mark all heuristics N/A
    const scores       = Object.fromEntries(codeList.map(c => [c, 'N/A']));
    const notes        = Object.fromEntries(codeList.map(c => [c, 'Scenario did not complete due to runner error.']));
    const violatedTurns = Object.fromEntries(codeList.map(c => [c, []]));
    return {
      scenarioId:      runResult.scenarioId,
      scores,
      notes,
      violatedTurns,
      aggregateScore:  0,
      evaluatorError:  runResult.error,
    };
  }

  const transcript = formatTranscript(runResult.transcript);
  const schema     = buildResponseSchema(codes);

  const systemPrompt = [
    'You are a rigorous quality evaluator for AI chatbot conversations.',
    'You will be given a conversation transcript and a quality rubric.',
    'Your job is to score the conversation against each heuristic.',
    '',
    'SCORING RULES:',
    '- Pass    = The heuristic condition could have applied in this conversation AND was fully satisfied.',
    '- Marginal = The condition could have applied AND was partially satisfied or borderline.',
    '- Fail    = The condition could have applied AND was clearly violated or absent.',
    '- N/A     = The heuristic condition COULD NOT have occurred in this conversation',
    '            (e.g. the math-accuracy heuristic when no math was performed; the handoff-clarity heuristic',
    '            when no handoff occurred). Do NOT use N/A when the condition could have applied but the bot',
    '            handled it correctly — that is a Pass.',
    '',
    'EVALUATION RULES:',
    '- Base your evaluation ONLY on what actually appears in the transcript.',
    '- Do not assume the bot did something correctly if you do not see it in the transcript.',
    '',
    'VIOLATED TURNS RULES:',
    '- For each heuristic that received Fail or Marginal, list the 0-based turn index (indices) in',
    '  "violatedTurns" where the violation is most clearly visible.',
    '- Turn 0 is the first message in the transcript (customer or agent).',
    '- If the heuristic got Pass or N/A, set its violatedTurns to an empty array [].',
    '- It is OK to list multiple turns if the violation spans several exchanges.',
    '',
    domainKnowledge ? `DOMAIN KNOWLEDGE:\n${domainKnowledge}` : '',
  ].filter(Boolean).join('\n');

  const userMessage = `## Quality Heuristics Rubric

${heuristicsDoc}

---

## Scenario Information

Scenario ID: ${runResult.scenarioId}
Turn count: ${runResult.turnCount}
Exit reason: ${runResult.exitReason}
Scenario notes: ${runResult.notes}

---

## Conversation Transcript

${transcript}

---

## Your Task

Score this conversation against each heuristic: ${codeList.join(', ')}.
Return a JSON object with this exact structure — no extra text, just the JSON:

${schema}

Rules:
- notes: be specific — quote a turn or phrase from the transcript if possible. One sentence only.
- violatedTurns: list 0-based turn indices for Fail/Marginal heuristics; empty array [] for Pass/N/A.
- Use N/A ONLY when the heuristic condition literally could not have occurred. If it could have occurred and the bot handled it correctly, that is Pass — not N/A.`;

  const res = await fetch(llm.baseUrl ?? OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${llm.apiKey}`,
    },
    body: JSON.stringify({
      model:           llm.evaluatorModel ?? 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage  },
      ],
      max_tokens:      1800,
      temperature:     0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Evaluator LLM error (HTTP ${res.status}): ${err}`);
  }

  const data = await res.json();
  const raw  = data.choices[0]?.message?.content ?? '{}';

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Evaluator returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  // Compute aggregate score as fraction of scenarios with no Fail
  const scores = parsed.scores ?? {};
  const hasFail = Object.values(scores).some(g => g === 'Fail');
  const aggregateScore = hasFail ? 0 : 1;

  // Normalise violatedTurns — ensure every code is present as an array
  const violatedTurns = {};
  for (const code of codeList) {
    const raw = parsed.violatedTurns?.[code];
    violatedTurns[code] = Array.isArray(raw) ? raw : [];
  }

  return {
    scenarioId:     runResult.scenarioId,
    scores,
    notes:          parsed.notes          ?? {},
    violatedTurns,
    aggregateScore,
  };
}

// ── Evaluate all scenarios ─────────────────────────────────────────────────────

/**
 * @param {object[]} runResults
 * @param {object}   heuristics
 * @param {object}   llm
 * @returns {Promise<EvalResult[]>}
 */
export async function evaluateAll(runResults, heuristics, llm) {
  const evaluations = [];

  for (let i = 0; i < runResults.length; i++) {
    const r = runResults[i];
    process.stdout.write(`  [${i + 1}/${runResults.length}] evaluating ${r.scenarioId.padEnd(42)} `);

    try {
      const ev = await evaluateConversation(r, heuristics, llm);
      evaluations.push(ev);

      const failCount = Object.values(ev.scores ?? {}).filter(g => g === 'Fail').length;
      const status    = failCount === 0 ? '✓' : `✗ ${failCount} fail`;
      console.log(status);
    } catch (err) {
      evaluations.push({
        scenarioId:     r.scenarioId,
        scores:         {},
        notes:          {},
        violatedTurns:  {},
        aggregateScore: 0,
        evaluatorError: err.message,
      });
      console.log(`✗ ERROR: ${err.message}`);
    }
  }

  return evaluations;
}
