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

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { createBobsAdapter } from './bobs-adapter.mjs';
import SCENARIOS from './scenarios.mjs';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = path.resolve(__dirname, '..', '..');

// ── Heuristics document ────────────────────────────────────────────────────────

const heuristicsDocument = readFileSync(
  path.join(REPO_ROOT, 'docs', 'QUALITY_HEURISTICS.md'),
  'utf8',
);

// ── Heuristics config ──────────────────────────────────────────────────────────
// Each code includes: name, severity, weight, and fixGuidance (used in NEXT_FIX.md).

const HEURISTIC_CODES = {
  H1: {
    name:     'Factual Accuracy',
    severity: 'Critical',
    weight:   2,
    fixGuidance: `In lambda/autopilot-turn/handler.ts, find the shared hallucination protection rule
(search for "hallucination" or "do not invent"). Strengthen the rule to explicitly cover financial figures:
---
"FACTUAL ACCURACY — CRITICAL: Never state any dollar amount, share count, percentage, account balance,
fund name, or beneficiary name unless it was explicitly provided in the client profile or returned by a
tool call. If you are unsure of a value, use a tool to retrieve it or say you will verify.
Guessing a financial figure is a serious error."
---`,
  },

  H2: {
    name:     'Mathematical Integrity',
    severity: 'Critical',
    weight:   2,
    fixGuidance: `In lambda/autopilot-turn/handler.ts, find UPDATE_BENEFICIARIES_PROMPT (around line 348).
In the ALLOCATION RULE section, add:
---
"PERCENTAGE IMPACT DISCLOSURE — REQUIRED: Before collecting confirmation of any ADD operation, you must
state the resulting percentage for EVERY beneficiary in the final list — including existing ones whose
shares change. Do not make the client figure out the math. Example (client adds Marco 25% and Sofia 25%,
Elena is currently 100%): 'That would bring Elena from 100% down to 50%, with Marco at 25% and Sofia at 25%.
Does that sound right?' Always state: [existing name] goes from [old %] to [new %]. Never proceed to
proposedAction without this explicit acknowledgment."
---`,
  },

  H3: {
    name:     'Change Transparency',
    severity: 'High',
    weight:   1,
    fixGuidance: `In lambda/autopilot-turn/handler.ts, find FORBIDDEN_TOPICS (around line 40).
Add a new rule at the end (before the closing backtick):
---
"CHANGE TRANSPARENCY — REQUIRED FOR ALL CONFIRMATIONS: When confirming a change in the exit response,
you MUST state both the prior state and the new state. Never state only the final result. Examples:
- Frequency: 'changing from Annual (December) to Quarterly'
- Percentage: 'Elena goes from 100% to 50%'
- Amount: 'increasing from $200 to $300/month'
- Email: 'updating from alex.johnson@email.com to alexj2025@gmail.com'
If the prior state was none/zero, say 'previously none'. A confirmation that states only the new value
fails this requirement."
---`,
  },

  H4: {
    name:     'Info Gathering Efficiency',
    severity: 'Medium',
    weight:   1,
    fixGuidance: `This usually manifests as asking for information already in the transcript or available
via tool. Check the evaluator's notes for what specific information was re-requested. Add a rule to the
relevant task expert prompt: "Do not ask the customer for information they already provided earlier in
this conversation. Review the full transcript before asking any clarifying question."`,
  },

  H5: {
    name:     'Intent Capture Fidelity',
    severity: 'High',
    weight:   1,
    fixGuidance: `In lambda/autopilot-turn/handler.ts, in the update-beneficiaries task expert prompt, add:
---
"INTENT FIDELITY: When the customer says 'make it match X' or 'same as Y,' interpret this as: replicate
the exact beneficiary set and percentages from account Y to this account. Do not ask for clarification
if the meaning is clear. When the customer says 'she stays on,' interpret this as: include that person
in the updated list at the proportion that results from the new additions, not at 100%."
---`,
  },

  H6: {
    name:     'Handoff Clarity',
    severity: 'Medium',
    weight:   1,
    fixGuidance: `In lambda/autopilot-turn/handler.ts, in FULL_AUTO_PROMPT or the escalation logic
(search for "live agent" or "escalate"), add:
---
"HANDOFF DISCIPLINE: Never announce that you are transferring to a live agent and then ask additional
questions in the same message or subsequent messages. The sequence must be: (1) gather all necessary
information, (2) summarize what you have, (3) THEN announce the handoff. The handoff announcement is
the final thing you say."
---`,
  },

  H7: {
    name:     'Escalation Timing',
    severity: 'Medium',
    weight:   1,
    fixGuidance: `In lambda/autopilot-turn/handler.ts, in FULL_AUTO_PROMPT, strengthen the escalation
timing guidance:
---
"ESCALATION TIMING: When a customer requests an account change, do NOT escalate immediately. First:
(1) confirm which account, (2) confirm the basic nature of the change. Only after gathering this context
should you escalate. The minimum escalation package is: what account, what action, and any amounts or
names already stated."
---`,
  },

  H8: {
    name:     'Role Honesty',
    severity: 'High',
    weight:   1,
    fixGuidance: `In lambda/autopilot-turn/handler.ts, find FULL_AUTO_PROMPT (around line 1830).
Add after the FORBIDDEN_TOPICS injection:
---
"ROLE BOUNDARY: You can answer questions, give information, and collect details — but you cannot execute
account changes. Never say 'I'll process that', 'I can update that for you', 'Shall I proceed with that
change?', or anything that implies you are the one making the change. If a client wants a change made,
frame it as: 'I'll gather those details and connect you with an agent who will take care of it.'"
---`,
  },

  H9: {
    name:     'Routing Consistency',
    severity: 'Medium',
    weight:   1,
    fixGuidance: `In lambda/autopilot-turn/handler.ts, find FULL_AUTO_PROMPT. After the self-service
link logic, add:
---
"ROUTING CONSISTENCY: If you have already provided a self-service link for a specific task earlier in
this conversation, do NOT then escalate to a live agent for that same task without explaining why. If
the client declined self-service or has a reason they need agent help, acknowledge that explicitly:
'Since self-service doesn't cover your situation, I'll connect you with an agent.'"
---`,
  },

  H10: {
    name:     'Confirmation Completeness',
    severity: 'Medium',
    weight:   1,
    fixGuidance: `In lambda/autopilot-turn/handler.ts, add a confirmation template requirement to the
relevant task expert prompt:
---
"CONFIRMATION COMPLETENESS — REQUIRED: Your confirmation message MUST include ALL of the following:
1. What was changed (the action taken)
2. The final resulting state — all parties, all percentages/amounts/values — complete enough that the
   customer can verify correctness
3. The account name
If any of these is missing, the confirmation is incomplete."
---`,
  },

  H11: {
    name:     'Language Quality',
    severity: 'Low-Med',
    weight:   1,
    fixGuidance: `This is typically a model-level issue. If recurring, add to the shared system prompt:
---
"LANGUAGE QUALITY: Every message must be grammatically correct and free of typos. Common errors to avoid:
missing subjects, split verb phrases ('Please ask provide' → 'Please provide'), run-on sentences."
---`,
  },

  H12: {
    name:     'Turn Economy',
    severity: 'Medium',
    weight:   1,
    fixGuidance: `Usually a symptom of H4 (unnecessary questions). Address H4 first. If H4 is passing,
add to the task expert prompts:
---
"TURN ECONOMY: Be decisive. If you have enough information to proceed, proceed — do not ask for
confirmation of information the customer already gave. If the customer has provided all required fields,
move directly to the exit confirmation."
---`,
  },

  H13: {
    name:     'Internal Consistency',
    severity: 'High',
    weight:   1,
    fixGuidance: `In lambda/autopilot-turn/handler.ts, add to the task expert prompts:
---
"INTERNAL CONSISTENCY: Review what you have said in prior turns before each new message. Never state a
percentage, amount, or interpretation that contradicts what you said earlier without explicitly correcting
the prior statement: 'I need to correct what I said earlier — the correct figure is X, not Y.'"
---`,
  },
};

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
    document:        heuristicsDocument,
    codes:           HEURISTIC_CODES,
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
