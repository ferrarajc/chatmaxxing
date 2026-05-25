/**
 * Heqya — Generic LLM Evaluator
 *
 * Scores a completed conversation against a heuristics document using an LLM.
 * Entirely driven by the heuristics config — no hardwired heuristic codes.
 *
 * HEURISTICS CONFIG:
 *   heuristics.document      — full text of the heuristics document
 *   heuristics.codes         — { [code]: { name, severity, weight } }
 *   heuristics.domainKnowledge  — optional extra context for the evaluator system prompt
 *
 * LLM CONFIG:
 *   llm.apiKey               — OpenAI API key
 *   llm.baseUrl              — optional override (default: OpenAI)
 *   llm.evaluatorModel       — model to use (default: 'gpt-4o')
 */

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

// ── Score math ─────────────────────────────────────────────────────────────────

const SCORE_MAP = { Pass: 2, Marginal: 1, Fail: 0, 'N/A': null };

/**
 * Compute aggregate score from a scores object and heuristics config.
 * aggregateScore = sum(weight × points) / sum(weight × 2)  [non-N/A only]
 *
 * @param {{ [code: string]: 'Pass'|'Marginal'|'Fail'|'N/A' }} scores
 * @param {{ [code: string]: { weight: number } }} codes
 * @returns {number} 0–1
 */
export function computeAggregateScore(scores, codes) {
  let earned   = 0;
  let possible = 0;

  for (const [code, grade] of Object.entries(scores)) {
    const weight = codes[code]?.weight ?? 1;
    const pts    = SCORE_MAP[grade];
    if (pts === null) continue;  // N/A excluded
    earned   += pts * weight;
    possible += 2  * weight;
  }

  return possible > 0 ? Math.round((earned / possible) * 100) / 100 : 0;
}

// ── Format transcript for evaluator ──────────────────────────────────────────

function formatTranscript(transcript) {
  return transcript
    .map(m => {
      const label = m.role === 'customer' ? 'CUSTOMER' : 'BOT/AGENT';
      return `${label}: ${m.content}`;
    })
    .join('\n\n');
}

// ── Build the expected JSON schema for the evaluator response ─────────────────

function buildResponseSchema(codes) {
  const codeEntries = Object.keys(codes)
    .map(c => `    "${c}": "Pass|Marginal|Fail|N/A"`)
    .join(',\n');
  const noteEntries = Object.keys(codes)
    .map(c => `    "${c}": "one-sentence explanation"`)
    .join(',\n');

  return `{
  "scenarioId": "<from scenario information>",
  "scores": {
${codeEntries}
  },
  "notes": {
${noteEntries}
  },
  "aggregateScore": 0.00
}`;
}

// ── Build heuristic weight summary for the evaluator prompt ──────────────────

function buildWeightSummary(codes) {
  const critical = Object.entries(codes)
    .filter(([, c]) => c.weight > 1)
    .map(([code, c]) => `${code} (${c.name}) ×${c.weight}`)
    .join(', ');
  const standard = Object.entries(codes)
    .filter(([, c]) => !c.weight || c.weight === 1)
    .map(([code, c]) => `${code} (${c.name}) ×1`)
    .join(', ');

  const lines = [];
  if (critical) lines.push(`- Weighted ×${Object.values(codes).find(c => c.weight > 1)?.weight ?? 2}: ${critical}`);
  if (standard) lines.push(`- Weighted ×1: ${standard}`);
  return lines.join('\n');
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
    const scores = Object.fromEntries(codeList.map(c => [c, 'N/A']));
    const notes  = Object.fromEntries(codeList.map(c => [c, 'Scenario did not complete due to runner error.']));
    return {
      scenarioId:      runResult.scenarioId,
      scores,
      notes,
      aggregateScore:  0,
      evaluatorError:  runResult.error,
    };
  }

  const transcript = formatTranscript(runResult.transcript);
  const schema     = buildResponseSchema(codes);
  const weights    = buildWeightSummary(codes);

  const systemPrompt = [
    'You are a rigorous quality evaluator for AI chatbot conversations.',
    'You will be given a conversation transcript and a quality rubric.',
    'Your job is to score the conversation against each heuristic.',
    '',
    'SCORING RULES:',
    '- Pass    = 2 pts. The heuristic condition could have applied in this conversation AND was fully satisfied.',
    '- Marginal = 1 pt. The condition could have applied AND was partially satisfied or borderline.',
    '- Fail    = 0 pts. The condition could have applied AND was clearly violated or absent.',
    '- N/A     = excluded from scoring. The heuristic condition COULD NOT have occurred in this conversation',
    '            (e.g. the math-accuracy heuristic when no math was performed; the handoff-clarity heuristic',
    '            when no handoff occurred). Do NOT use N/A when the condition could have applied but the bot',
    '            handled it correctly — that is a Pass.',
    '',
    'WEIGHTING:',
    weights,
    '- aggregateScore = sum(weight × points) / sum(weight × 2)  [non-N/A heuristics only]',
    '',
    'EVALUATION RULES:',
    '- Base your evaluation ONLY on what actually appears in the transcript.',
    '- Do not assume the bot did something correctly if you do not see it in the transcript.',
    '- Be strict on high-weight heuristics — any violation = Fail.',
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
- aggregateScore: compute using the weighting formula above.
- notes: be specific — quote a turn or phrase from the transcript if possible.
- Use N/A ONLY when the heuristic condition literally could not have occurred (e.g. no math was done, no handoff happened). If the condition could have occurred and the bot handled it correctly, that is Pass — not N/A.`;

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
      max_tokens:      1500,
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

  // Recompute locally to ensure formula consistency
  parsed.aggregateScore = computeAggregateScore(parsed.scores ?? {}, codes);

  return {
    scenarioId:     runResult.scenarioId,
    scores:         parsed.scores         ?? {},
    notes:          parsed.notes          ?? {},
    aggregateScore: parsed.aggregateScore ?? 0,
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

      const score    = (ev.aggregateScore * 100).toFixed(0);
      console.log(`score ${score}%`);
    } catch (err) {
      evaluations.push({
        scenarioId:     r.scenarioId,
        scores:         {},
        notes:          {},
        aggregateScore: 0,
        evaluatorError: err.message,
      });
      console.log(`✗ ERROR: ${err.message}`);
    }
  }

  return evaluations;
}
