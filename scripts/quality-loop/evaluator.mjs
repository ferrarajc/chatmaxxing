/**
 * Quality Loop — LLM Evaluator
 *
 * Scores each completed conversation against QUALITY_HEURISTICS.md using GPT-4o.
 * Returns structured JSON with per-heuristic grades and an aggregate score.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const OPENAI_URL      = 'https://api.openai.com/v1/chat/completions';
const EVALUATOR_MODEL = process.env.EVALUATOR_MODEL ?? 'gpt-4o';

// ── Load heuristics document once ─────────────────────────────────────────────

let _heuristicsText = null;
function getHeuristicsText() {
  if (_heuristicsText) return _heuristicsText;
  const p = path.join(REPO_ROOT, 'docs', 'QUALITY_HEURISTICS.md');
  _heuristicsText = readFileSync(p, 'utf8');
  return _heuristicsText;
}

// ── Format transcript for the evaluator ──────────────────────────────────────

function formatTranscript(transcript) {
  return transcript
    .filter(m => m.role !== 'SYSTEM')
    .map(m => {
      const label = m.role === 'CUSTOMER' ? 'CUSTOMER' : 'BOT/AGENT';
      return `${label}: ${m.content}`;
    })
    .join('\n\n');
}

// ── Scoring formula (also described in evaluator prompt) ─────────────────────
//   Pass = 2 pts, Marginal = 1 pt, Fail = 0 pts, N/A = excluded
//   H1 and H2 (Critical severity) are weighted ×2
//   aggregateScore = weightedEarned / weightedPossible

const WEIGHTS = {
  H1: 2, H2: 2,   // Critical × 2
  H3: 1, H4: 1, H5: 1, H6: 1, H7: 1, H8: 1,
  H9: 1, H10: 1, H11: 1, H12: 1, H13: 1,
};

const SCORE_MAP = { Pass: 2, Marginal: 1, Fail: 0, 'N/A': null };

export function computeAggregateScore(scores) {
  let earned = 0;
  let possible = 0;

  for (const [h, grade] of Object.entries(scores)) {
    const weight = WEIGHTS[h] ?? 1;
    const pts    = SCORE_MAP[grade];
    if (pts === null) continue;  // N/A
    earned   += pts * weight;
    possible += 2  * weight;   // max is Pass (2) × weight
  }

  return possible > 0 ? Math.round((earned / possible) * 100) / 100 : 0;
}

// ── Single-scenario evaluation ────────────────────────────────────────────────

export async function evaluateConversation(runResult) {
  if (runResult.error) {
    // Scenario errored out — mark all heuristics as N/A
    const scores = {};
    const notes  = {};
    for (const h of ['H1','H2','H3','H4','H5','H6','H7','H8','H9','H10','H11','H12','H13']) {
      scores[h] = 'N/A';
      notes[h]  = 'Scenario did not complete due to runner error.';
    }
    return {
      scenarioId: runResult.scenarioId,
      scores,
      notes,
      criticalFailures: [],
      aggregateScore: 0,
      evaluatorError: runResult.error,
    };
  }

  const heuristics = getHeuristicsText();
  const transcript = formatTranscript(runResult.transcript);

  // Summarise client profile fields most relevant to factual accuracy
  const { name, accounts, beneficiaries, rmd, autoInvest, totalBalance } = runResult.responses[0]
    ? {} // We use the scenario's client from runResult directly
    : {};
  // (We'll pass relevant data as text in the prompt directly)

  const systemPrompt = `You are a rigorous quality evaluator for financial services AI chatbot conversations.
You will be given a conversation transcript and a quality rubric (QUALITY_HEURISTICS.md).
Your job is to score the conversation against each heuristic.

SCORING RULES:
- Pass = 2 points. The heuristic was fully satisfied.
- Marginal = 1 point. Partially satisfied or borderline.
- Fail = 0 points. Clearly violated or absent.
- N/A = excluded from scoring. The heuristic simply does not apply to this conversation type.

WEIGHTING (for your reference when computing aggregateScore):
- H1, H2 (Critical) are weighted ×2.
- All other heuristics weighted ×1.
- aggregateScore = sum(weight × points) / sum(weight × 2)  [only non-N/A heuristics]

IMPORTANT: Base your evaluation ONLY on what actually appears in the transcript.
Do not assume the bot did something correctly if you do not see it in the transcript.
Be strict on Critical heuristics (H1, H2) — any factual error or math error = Fail.

DOMAIN KNOWLEDGE — BENEFICIARY TIERS (apply when scoring H1/H2 for beneficiary scenarios):
- Accounts have two independent beneficiary tiers: PRIMARY and SECONDARY.
- The 100% allocation rule applies SEPARATELY within each tier.
  • All primary beneficiaries on an account must sum to 100%.
  • All secondary beneficiaries on an account must sum to 100%.
- A secondary beneficiary at 100% alongside a primary beneficiary at 100% is MATHEMATICALLY CORRECT. Do NOT flag this as a math error.
- Example of valid state: Sarah Johnson 100% Primary, Emma Johnson 100% Secondary — this is correct and should score Pass on H2.
- Adding a secondary beneficiary never affects, reduces, or removes any primary beneficiary. They are completely independent.`;

  const userMessage = `## Quality Heuristics Rubric

${heuristics}

---

## Scenario Information

Scenario ID: ${runResult.scenarioId}
Client: ${runResult.clientName}
Scope: ${runResult.scope}
Turn count: ${runResult.turnCount}
Exit reason: ${runResult.exitReason}
Primary heuristics this scenario probes: ${runResult.heuristics.join(', ')}
Scenario notes: ${runResult.notes}

---

## Conversation Transcript

${transcript}

---

## Proposed Action (if any)

${runResult.proposedAction ? JSON.stringify(runResult.proposedAction, null, 2) : 'None — conversation did not complete to proposedAction stage.'}

---

## Your Task

Score this conversation against each heuristic H1 through H13.
Return a JSON object with this exact structure — no extra text, just the JSON:

{
  "scenarioId": "${runResult.scenarioId}",
  "scores": {
    "H1": "Pass|Marginal|Fail|N/A",
    "H2": "Pass|Marginal|Fail|N/A",
    "H3": "Pass|Marginal|Fail|N/A",
    "H4": "Pass|Marginal|Fail|N/A",
    "H5": "Pass|Marginal|Fail|N/A",
    "H6": "Pass|Marginal|Fail|N/A",
    "H7": "Pass|Marginal|Fail|N/A",
    "H8": "Pass|Marginal|Fail|N/A",
    "H9": "Pass|Marginal|Fail|N/A",
    "H10": "Pass|Marginal|Fail|N/A",
    "H11": "Pass|Marginal|Fail|N/A",
    "H12": "Pass|Marginal|Fail|N/A",
    "H13": "Pass|Marginal|Fail|N/A"
  },
  "notes": {
    "H1": "one-sentence explanation",
    "H2": "one-sentence explanation",
    ...
  },
  "criticalFailures": ["H1", "H2"],
  "aggregateScore": 0.00
}

Rules:
- criticalFailures: list only H1 or H2 if they are "Fail".
- aggregateScore: compute using the weighting formula above.
- notes: be specific — quote a turn or phrase from the transcript if possible.
- If a heuristic is N/A, put "N/A" in scores and "Not applicable to this scenario type." in notes.`;

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ''}`,
    },
    body: JSON.stringify({
      model: EVALUATOR_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage  },
      ],
      max_tokens: 1200,
      temperature: 0.1,
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

  // Recompute aggregateScore locally to ensure formula consistency
  parsed.aggregateScore = computeAggregateScore(parsed.scores ?? {});

  return parsed;
}

// ── Evaluate all scenario results ─────────────────────────────────────────────

export async function evaluateAll(runResults) {
  const evaluations = [];

  for (let i = 0; i < runResults.length; i++) {
    const r = runResults[i];
    process.stdout.write(`  [${i + 1}/${runResults.length}] evaluating ${r.scenarioId.padEnd(42)} `);

    try {
      const ev = await evaluateConversation(r);
      evaluations.push(ev);

      const score = (ev.aggregateScore * 100).toFixed(0);
      const critFlag = ev.criticalFailures?.length > 0 ? ` ⚠ CRITICAL: ${ev.criticalFailures.join(',')}` : '';
      console.log(`score ${score}%${critFlag}`);
    } catch (err) {
      evaluations.push({
        scenarioId: r.scenarioId,
        scores: {},
        notes: {},
        criticalFailures: [],
        aggregateScore: 0,
        evaluatorError: err.message,
      });
      console.log(`✗ ERROR: ${err.message}`);
    }
  }

  return evaluations;
}
