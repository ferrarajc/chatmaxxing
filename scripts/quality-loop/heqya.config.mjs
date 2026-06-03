/**
 * Bob's Mutual Funds — Heqya Configuration
 *
 * Wires the heqya generic engine to Bob's systems:
 *   - autopilot-turn API (via bobs-adapter.mjs)
 *   - Heuristics from heuristics.json (editable at runtime via the dashboard)
 *   - Scenarios from scenarios.json + client profiles from client-profiles.json
 *   - App profile from app-profile.json
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── File paths (exported so server.mjs can import them) ───────────────────────

export const HEURISTICS_FILE      = path.join(__dirname, 'heuristics.json');
export const APP_PROFILE_FILE     = path.join(__dirname, 'app-profile.json');
export const SCENARIOS_FILE       = path.join(__dirname, 'scenarios.json');
export const CLIENT_PROFILES_FILE = path.join(__dirname, 'client-profiles.json');

// ── Heuristics ─────────────────────────────────────────────────────────────────
// The JSON is the authoritative store — editable via the UI at runtime.
// Format: array of { code, name, severity, weight, threshold, criterion, failureSignals, fixGuidance }

export function loadHeuristics() {
  if (!existsSync(HEURISTICS_FILE)) return [];
  try { return JSON.parse(readFileSync(HEURISTICS_FILE, 'utf8')); } catch { return []; }
}

/** Convert heuristics array → codes object for the heqya engine */
export function heuristicsArrayToCodes(arr) {
  const codes = {};
  for (const h of arr) {
    codes[h.code] = {
      name:         h.name,
      criterion:    h.criterion    ?? '',
      failureSignals: h.failureSignals ?? '',
    };
  }
  return codes;
}

/** Generate the evaluator rubric document from the heuristics array */
export function generateHeuristicsDocument(arr) {
  const lines = ['# Quality Evaluation Heuristics\n'];
  for (const h of arr) {
    lines.push(`## ${h.code} — ${h.name}`);
    lines.push(`**Criterion:** ${h.criterion}`);
    if (h.failureSignals) lines.push(`**Failure signals:** ${h.failureSignals}`);
    lines.push('');
  }
  return lines.join('\n');
}

// ── App profile ────────────────────────────────────────────────────────────────
// { name, description, responsibilities, userDescription }

export function loadAppProfile() {
  if (!existsSync(APP_PROFILE_FILE)) return {};
  try { return JSON.parse(readFileSync(APP_PROFILE_FILE, 'utf8')); } catch { return {}; }
}

// ── Client profiles ────────────────────────────────────────────────────────────
// { alex: {...}, maria: {...}, jordan: {...}, robert: {...} }

export function loadClientProfiles() {
  if (!existsSync(CLIENT_PROFILES_FILE)) return {};
  try { return JSON.parse(readFileSync(CLIENT_PROFILES_FILE, 'utf8')); } catch { return {}; }
}

// ── Scenarios ──────────────────────────────────────────────────────────────────
// scenarios.json stores { clientKey } instead of the full client profile blob.
// loadScenarios() hydrates the full client object from client-profiles.json.

export function loadScenarios() {
  if (!existsSync(SCENARIOS_FILE)) return [];
  try {
    const raw      = JSON.parse(readFileSync(SCENARIOS_FILE, 'utf8'));
    const profiles = loadClientProfiles();
    return raw.map(s => ({
      ...s,
      client: s.clientKey ? (profiles[s.clientKey] ?? null) : null,
    }));
  } catch { return []; }
}

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
// Note: per-heuristic thresholds are stored in heuristics.json (the "threshold" field).
// These global thresholds are additional checks on top of per-heuristic ones.

const THRESHOLDS = {
  minOverallScore: 0.80,   // % conversations with zero Fail grades
};

// ── Initialise at load time ────────────────────────────────────────────────────

const rawHeuristics      = loadHeuristics();
const HEURISTIC_CODES    = heuristicsArrayToCodes(rawHeuristics);
const heuristicsDocument = generateHeuristicsDocument(rawHeuristics);

// ── Full config export ─────────────────────────────────────────────────────────

export default {
  adapter: createBobsAdapter(),

  heuristics: {
    document:        heuristicsDocument,
    codes:           HEURISTIC_CODES,
    domainKnowledge: DOMAIN_KNOWLEDGE,
  },

  scenarios: loadScenarios(),

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
