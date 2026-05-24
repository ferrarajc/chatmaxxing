/**
 * Bob's Mutual Funds — Heqya Configuration
 *
 * Wires the heqya generic engine to Bob's systems:
 *   - autopilot-turn API (via bobs-adapter.mjs)
 *   - 13 quality heuristics from docs/QUALITY_HEURISTICS.md
 *   - 11 test scenarios from scenarios.mjs
 *   - Bob's-specific thresholds and improvement loop settings
 *
 * To use in a script:
 *   import config from './heqya.config.mjs';
 *   const { adapter, heuristics, scenarios, thresholds, llm } = config;
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { createBobsAdapter } from './bobs-adapter.mjs';
import SCENARIOS from './scenarios.mjs';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));

// ── Load heuristics from heuristics.json ──────────────────────────────────────
// The JSON is the authoritative store — editable via the UI at runtime.
// Format: array of { code, name, severity, weight, criterion, failureSignals, fixGuidance }

export const HEURISTICS_FILE = path.join(__dirname, 'heuristics.json');

export function loadHeuristics() {
  if (!existsSync(HEURISTICS_FILE)) return [];
  try { return JSON.parse(readFileSync(HEURISTICS_FILE, 'utf8')); } catch { return []; }
}

/** Convert heuristics array → codes object for the heqya engine */
export function heuristicsArrayToCodes(arr) {
  const codes = {};
  for (const h of arr) {
    codes[h.code] = {
      name:        h.name,
      severity:    h.severity,
      weight:      h.weight ?? 1,
      fixGuidance: h.fixGuidance ?? '',
    };
  }
  return codes;
}

/** Generate the evaluator rubric document from the heuristics array */
export function generateHeuristicsDocument(arr) {
  const lines = ['# Quality Evaluation Heuristics\n'];
  for (const h of arr) {
    lines.push(`## ${h.code} — ${h.name} (${h.severity})`);
    lines.push(`**Criterion:** ${h.criterion}`);
    if (h.failureSignals) lines.push(`**Failure signals:** ${h.failureSignals}`);
    lines.push('');
  }
  return lines.join('\n');
}

const rawHeuristics = loadHeuristics();
const HEURISTIC_CODES = heuristicsArrayToCodes(rawHeuristics);

// ── Heuristics document for the evaluator (generated from JSON) ───────────────

const heuristicsDocument = generateHeuristicsDocument(rawHeuristics);

// ── Domain knowledge for the evaluator ────────────────────────────────────────

const DOMAIN_KNOWLEDGE = `
BENEFICIARY TIERS (apply when scoring H1/H2 for beneficiary scenarios):
- Accounts have two independent beneficiary tiers: PRIMARY and SECONDARY.
- The 100% allocation rule applies SEPARATELY within each tier.
  • All primary beneficiaries on an account must sum to 100%.
  • All secondary beneficiaries on an account must sum to 100%.
- A secondary beneficiary at 100% alongside a primary beneficiary at 100% is MATHEMATICALLY CORRECT.
  Do NOT flag this as a math error.
- Example of valid state: Sarah Johnson 100% Primary, Emma Johnson 100% Secondary — this is correct
  and should score Pass on H2.
- Adding a secondary beneficiary never affects, reduces, or removes any primary beneficiary.
  They are completely independent.
`.trim();

// ── Thresholds ─────────────────────────────────────────────────────────────────

const THRESHOLDS = {
  minOverallScore:    0.80,
  zeroCriticalCodes:  ['H1', 'H2'],  // must have 0 Fail across all scenarios
  highSeverityPassRate: {
    codes:   ['H3', 'H5', 'H8', 'H13'],
    minRate: 0.75,                   // ≥75% of applicable scenarios must pass
  },
};

// ── Full config export ─────────────────────────────────────────────────────────

export default {
  adapter: createBobsAdapter(),

  heuristics: {
    document:        heuristicsDocument,   // generated from heuristics.json
    codes:           HEURISTIC_CODES,      // derived from heuristics.json
    domainKnowledge: DOMAIN_KNOWLEDGE,
  },

  scenarios: SCENARIOS,

  thresholds: THRESHOLDS,

  llm: {
    apiKey:         process.env.OPENAI_API_KEY ?? '',
    simulatorModel: process.env.OPENAI_MODEL    ?? 'gpt-4o-mini',
    evaluatorModel: process.env.EVALUATOR_MODEL ?? 'gpt-4o',
  },

  resultsDir:    path.join(__dirname, 'results'),
  iterationFile: path.join(__dirname, 'results', 'iteration.txt'),
  maxIterations: 12,
};
