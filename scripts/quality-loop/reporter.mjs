/**
 * Quality Loop — Reporter
 *
 * Takes run results + evaluations, produces:
 *   1. results/report-NNN.md  — human-readable quality report
 *   2. results/latest.json    — machine-readable scores
 *   3. results/NEXT_FIX.md   — specific instructions for Claude to implement
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(__dirname, 'results');

// Thresholds (mirrors run-quality-loop.mjs)
const THRESHOLD_SCORE         = 0.80;
const THRESHOLD_HIGH_PASS_PCT = 0.75;  // H3, H5, H8, H13 must pass ≥75% of applicable scenarios

const HEURISTIC_NAMES = {
  H1:  'Factual Accuracy',
  H2:  'Mathematical Integrity',
  H3:  'Change Transparency',
  H4:  'Info Gathering Efficiency',
  H5:  'Intent Capture Fidelity',
  H6:  'Handoff Clarity',
  H7:  'Escalation Timing',
  H8:  'Role Honesty',
  H9:  'Routing Consistency',
  H10: 'Confirmation Completeness',
  H11: 'Language Quality',
  H12: 'Turn Economy',
  H13: 'Internal Consistency',
};

const HEURISTIC_SEVERITY = {
  H1: 'Critical', H2: 'Critical',
  H3: 'High',     H5: 'High',  H8: 'High',  H13: 'High',
  H4: 'Medium',   H6: 'Medium', H7: 'Medium', H9: 'Medium',
  H10: 'Medium',  H12: 'Medium',
  H11: 'Low-Med',
};

// ── Aggregate heuristic statistics ────────────────────────────────────────────

function aggregateByHeuristic(evaluations) {
  const stats = {};
  for (const h of Object.keys(HEURISTIC_NAMES)) {
    stats[h] = { pass: 0, marginal: 0, fail: 0, na: 0, total: 0 };
  }

  for (const ev of evaluations) {
    for (const [h, grade] of Object.entries(ev.scores ?? {})) {
      if (!stats[h]) continue;
      stats[h].total++;
      if (grade === 'Pass')     stats[h].pass++;
      else if (grade === 'Marginal') stats[h].marginal++;
      else if (grade === 'Fail')     stats[h].fail++;
      else                           stats[h].na++;
    }
  }
  return stats;
}

function overallScore(evaluations) {
  if (!evaluations.length) return 0;
  const valid = evaluations.filter(e => e.aggregateScore > 0 || !e.evaluatorError);
  if (!valid.length) return 0;
  const sum = valid.reduce((acc, e) => acc + (e.aggregateScore ?? 0), 0);
  return Math.round((sum / valid.length) * 100) / 100;
}

function allCriticalFailures(evaluations) {
  const out = [];
  for (const ev of evaluations) {
    for (const h of (ev.criticalFailures ?? [])) {
      out.push({ scenarioId: ev.scenarioId, heuristic: h });
    }
  }
  return out;
}

// ── Find worst-scoring scenarios for a given heuristic ───────────────────────

function worstScenariosFor(h, evaluations, runResults, limit = 2) {
  return evaluations
    .filter(ev => ev.scores?.[h] === 'Fail')
    .map(ev => {
      const run = runResults.find(r => r.scenarioId === ev.scenarioId);
      const note = ev.notes?.[h] ?? '';
      // Find the worst turn (first AGENT turn after which the issue likely occurred)
      const agentTurns = (run?.transcript ?? [])
        .filter(m => m.role === 'AGENT')
        .map(m => m.content);
      return { scenarioId: ev.scenarioId, note, agentTurns };
    })
    .slice(0, limit);
}

// ── Identify top priority fix ─────────────────────────────────────────────────

function identifyTopFix(stats, evaluations, runResults) {
  // Priority order: Critical fails first, then High severity fails, then Medium
  const PRIORITY_ORDER = ['H2', 'H1', 'H3', 'H5', 'H8', 'H13', 'H4', 'H6', 'H7', 'H9', 'H10', 'H12', 'H11'];

  for (const h of PRIORITY_ORDER) {
    const s = stats[h];
    const applicable = s.pass + s.marginal + s.fail;
    if (applicable === 0) continue;
    if (s.fail === 0) continue;

    const worstScenarios = worstScenariosFor(h, evaluations, runResults);
    return {
      heuristic: h,
      name: HEURISTIC_NAMES[h],
      severity: HEURISTIC_SEVERITY[h],
      failCount: s.fail,
      applicableCount: applicable,
      worstScenarios,
    };
  }
  return null;
}

function identifySecondaryFix(topH, stats, evaluations, runResults) {
  const PRIORITY_ORDER = ['H2', 'H1', 'H3', 'H5', 'H8', 'H13', 'H4', 'H6', 'H7', 'H9', 'H10', 'H12', 'H11'];
  for (const h of PRIORITY_ORDER) {
    if (h === topH) continue;
    const s = stats[h];
    const applicable = s.pass + s.marginal + s.fail;
    if (applicable === 0) continue;
    if (s.fail === 0) continue;

    const worstScenarios = worstScenariosFor(h, evaluations, runResults, 1);
    return {
      heuristic: h,
      name: HEURISTIC_NAMES[h],
      severity: HEURISTIC_SEVERITY[h],
      failCount: s.fail,
      applicableCount: applicable,
      worstScenarios,
    };
  }
  return null;
}

// ── Next-fix instructions per heuristic ──────────────────────────────────────

const FIX_GUIDANCE = {
  H2: {
    rootCause: 'When adding or modifying beneficiaries, the agent does not compute and explicitly state how existing beneficiaries\' allocation percentages change as a result. The customer states a new allocation but the bot confirms without noting the impact on others.',
    fix: `In lambda/autopilot-turn/handler.ts, find the function \`UPDATE_BENEFICIARIES_PROMPT\` (starts around line 348).

Locate the ALLOCATION RULE section. The existing rule says "you MUST flag this" when new beneficiaries alone sum to 100%, but it doesn't cover the case where new additions don't sum to 100% on their own but still reduce existing percentages. Add after the existing ALLOCATION RULE:

---
"PERCENTAGE IMPACT DISCLOSURE — REQUIRED: Before collecting confirmation of any ADD operation, you must state the resulting percentage for EVERY beneficiary in the final list — including existing ones whose shares change. Do not make the client figure out the math. Example (client adds Marco 25% and Sofia 25%, Elena is currently 100%): 'That would bring Elena from 100% down to 50%, with Marco at 25% and Sofia at 25%. Does that sound right?' Always state: [existing name] goes from [old %] to [new %]. Never proceed to proposedAction without this explicit acknowledgment."
---`,
  },

  H1: {
    rootCause: 'The agent stated a data point (balance, percentage, share count, or beneficiary name) that does not match the actual client data retrieved via tool call or provided in context.',
    fix: `In lambda/autopilot-turn/handler.ts, in the FORBIDDEN_TOPICS or the shared hallucination protection rule injected into all prompts (search for "hallucination" or "do not invent"):

Strengthen the rule to explicitly cover financial figures:
---
"FACTUAL ACCURACY — CRITICAL: Never state any dollar amount, share count, percentage, account balance, fund name, or beneficiary name unless it was explicitly provided in the client profile or returned by a tool call. If you are unsure of a value, use a tool to retrieve it or say you will verify. Guessing a financial figure is a serious error."
---`,
  },

  H3: {
    rootCause: 'When confirming a completed change, the agent states only the new/final state without explicitly naming what it was before. The customer cannot verify the correct change was made.',
    fix: `In lambda/autopilot-turn/handler.ts, find the \`FORBIDDEN_TOPICS\` constant (starts around line 40). This is injected into all 19 task expert prompts, making it the right place for cross-cutting rules.

Add a new rule at the end of FORBIDDEN_TOPICS (before the closing backtick):
---
"CHANGE TRANSPARENCY — REQUIRED FOR ALL CONFIRMATIONS: When confirming that a change will be made (in the exit response), you must state both the prior state and the new state. Never state only the final result. Examples:
- Frequency: 'changing from Annual (December) to Quarterly'
- Percentage: 'Elena goes from 100% to 50%'
- Amount: 'increasing from $200 to $300/month'
- Email: 'updating from alex.johnson@email.com to alexj2025@gmail.com'
If the prior state was none/zero, say 'previously none'. A confirmation that states only the new value fails this requirement."
---`,
  },

  H5: {
    rootCause: 'The agent misinterpreted the customer\'s stated intent. Specifically: when a customer says "make it the same as X" or "she stays on," the agent chose an interpretation inconsistent with the plain meaning.',
    fix: `In lambda/autopilot-turn/handler.ts, in the update-beneficiaries task expert prompt, add:
---
"INTENT FIDELITY: When the customer says 'make it match X' or 'same as Y,' interpret this as: replicate the exact beneficiary set and percentages from account Y to this account. Do not ask for clarification if the meaning is clear. When the customer says 'she stays on,' interpret this as: include that person in the updated list at the proportion that results from the new additions, not at 100%."
---`,
  },

  H10: {
    rootCause: 'The confirmation message omits one or more required elements: the change made, the final state with all relevant values for all parties, and a reference number.',
    fix: `In lambda/autopilot-turn/handler.ts, find where the agent formats the final confirmation before setting proposedAction. Add a confirmation template requirement:
---
"CONFIRMATION COMPLETENESS — REQUIRED: Your confirmation message MUST include ALL of the following:
1. What was changed (the action taken)
2. The final resulting state — all parties, all percentages/amounts/values — complete enough that the customer can verify correctness
3. The account name and ID
4. A reference number (you may use REF-XXXXXX format)
If any of these is missing, the confirmation is incomplete."
---`,
  },

  H6: {
    rootCause: 'The bot announced a handoff to a live agent and then continued gathering information as if still the primary handler. The handoff announcement and information collection were mixed in the same message flow.',
    fix: `In lambda/autopilot-turn/handler.ts, in FULL_AUTO_PROMPT or the escalation logic (search for "live agent" or "escalate" or "shouldExitAutopilot"):
---
"HANDOFF DISCIPLINE: Never announce that you are transferring to a live agent and then ask additional questions in the same message or subsequent messages. The sequence must be: (1) gather all necessary information, (2) summarize what you have, (3) THEN announce the handoff. The handoff announcement is the final thing you say."
---`,
  },

  H7: {
    rootCause: 'The bot escalated to a human agent immediately upon hearing an account-change request, without first confirming the customer\'s intent and key parameters. The agent received a cold handoff with no useful context.',
    fix: `In lambda/autopilot-turn/handler.ts, in FULL_AUTO_PROMPT, strengthen the escalation timing guidance:
---
"ESCALATION TIMING: When a customer requests an account change (beneficiary update, contribution, trade, etc.), do NOT escalate immediately. First: (1) confirm which account, (2) confirm the basic nature of the change (e.g., adding vs. removing a beneficiary). Only after gathering this context should you escalate. The minimum escalation package is: what account, what action, and any amounts or names already stated."
---`,
  },

  H8: {
    rootCause: 'The bot implied it could execute or process an account change itself, rather than framing execution as something the human agent would do.',
    fix: `In lambda/autopilot-turn/handler.ts, find \`FULL_AUTO_PROMPT\` (starts around line 1830). Its escalation line says "I'll connect you with a live agent right now" which is correct, but the body of the prompt does not prevent the bot from describing account actions in first-person executing terms.

Add to the FULL_AUTO_PROMPT body, after the FORBIDDEN_TOPICS injection:
---
"ROLE BOUNDARY: You can answer questions, give information, and collect details — but you cannot execute account changes. Never say 'I'll process that', 'I can update that for you', 'Shall I proceed with that change?', or anything that implies you are the one making the change. If a client wants a change made, frame it as: 'I'll gather those details and connect you with an agent who will take care of it.'"
---`,
  },

  H9: {
    rootCause: 'The bot offered a self-service link for a task, then escalated to a live agent for the same task without explaining why self-service was insufficient.',
    fix: `In lambda/autopilot-turn/handler.ts, find \`FULL_AUTO_PROMPT\` (starts around line 1830). After the line about not setting shouldExitAutopilot for account actions (give the self-service link instead), add:
---
"ROUTING CONSISTENCY: If you have already provided a self-service link for a specific task earlier in this conversation, do NOT then escalate to a live agent for that same task without explaining why. If the client declined self-service or has a reason they need agent help, acknowledge that explicitly: 'Since self-service doesn't cover your situation, I'll connect you with an agent.'"
---`,
  },

  H11: {
    rootCause: 'One or more agent messages contained grammatical errors, typos, or broken syntax.',
    fix: `This is typically a model-level issue. In lambda/autopilot-turn/handler.ts, add to the shared system prompt (FORBIDDEN_TOPICS or the global instructions):
---
"LANGUAGE QUALITY: Every message must be grammatically correct and free of typos. Review your message before sending. Common errors to avoid: missing subjects, split verb phrases ('Please ask provide' should be 'Please provide'), run-on sentences."
---`,
  },

  H12: {
    rootCause: 'The conversation took significantly more turns than warranted by the complexity of the request. Extra turns typically come from unnecessary information requests (H4), repeated clarifications, or the agent failing to act on information already provided.',
    fix: `This is usually a symptom of H4 (unnecessary questions). Address H4 first. If H4 is passing, add to the task expert prompts:
---
"TURN ECONOMY: Be decisive. If you have enough information to proceed, proceed — do not ask for confirmation of information the customer already gave. If the customer has provided all required fields, move directly to the exit confirmation. Do not add optional questions that delay resolution."
---`,
  },

  H13: {
    rootCause: 'Within the conversation, the agent made contradictory statements — different figures, interpretations, or plans across turns — without acknowledging and correcting the inconsistency.',
    fix: `In lambda/autopilot-turn/handler.ts, add to the task expert prompts:
---
"INTERNAL CONSISTENCY: Review what you have said in prior turns before each new message. Never state a percentage, amount, or interpretation that contradicts what you said earlier without explicitly correcting the prior statement. If you made an error in a previous turn, correct it explicitly: 'I need to correct what I said earlier — the correct figure is X, not Y.'"
---`,
  },
};

// ── Generate NEXT_FIX.md ───────────────────────────────────────────────────────

function generateNextFix(iteration, score, stats, topFix, secondaryFix, evaluations, runResults) {
  const below = score < THRESHOLD_SCORE;
  const critFails = allCriticalFailures(evaluations);

  let md = `# NEXT_FIX — Iteration ${iteration}\n\n`;
  md += `## Status\n`;
  md += `- **Overall score:** ${(score * 100).toFixed(1)}% (threshold: ${(THRESHOLD_SCORE * 100).toFixed(0)}%)\n`;
  md += `- **Result:** ${below ? '✗ BELOW THRESHOLD' : '✓ THRESHOLD MET'}\n`;

  if (critFails.length > 0) {
    md += `- **Critical failures:** ${critFails.map(c => `${c.heuristic} in ${c.scenarioId}`).join('; ')}\n`;
  }

  md += `\n---\n\n`;

  if (!topFix) {
    md += `## No fixes required — all heuristics passing.\n`;
    return md;
  }

  // ── Primary Fix ──────────────────────────────────────────────────────────────
  md += `## Primary Fix: ${topFix.heuristic} — ${topFix.name}\n\n`;
  md += `**Severity:** ${topFix.severity}  \n`;
  md += `**Failing in:** ${topFix.failCount} of ${topFix.applicableCount} applicable scenarios\n\n`;

  const guidance = FIX_GUIDANCE[topFix.heuristic];
  if (guidance) {
    md += `### Root Cause\n${guidance.rootCause}\n\n`;

    // Evidence from worst scenarios
    if (topFix.worstScenarios.length > 0) {
      md += `### Evidence\n`;
      for (const ws of topFix.worstScenarios) {
        md += `**Scenario:** \`${ws.scenarioId}\`\n`;
        md += `**Evaluator note:** ${ws.note}\n`;
        if (ws.agentTurns.length > 0) {
          const sample = ws.agentTurns[ws.agentTurns.length - 1]?.slice(0, 300) ?? '';
          md += `**Last agent turn:**\n> ${sample.replace(/\n/g, '\n> ')}\n\n`;
        }
      }
    }

    md += `### Implementation Instructions\n${guidance.fix}\n\n`;
  }

  md += `### Steps After Editing\n`;
  md += `1. Edit \`lambda/autopilot-turn/handler.ts\` as described above\n`;
  md += `2. Typecheck: \`cd cdk && npx tsc --noEmit\`\n`;
  md += `3. Deploy: \`cd cdk && npx cdk deploy BobsLambdaStack --require-approval never\`\n`;
  md += `4. Increment \`scripts/quality-loop/results/iteration.txt\`\n`;
  md += `5. Run: \`node scripts/quality-loop/run-quality-loop.mjs\`\n\n`;

  // ── Secondary Fix ────────────────────────────────────────────────────────────
  if (secondaryFix) {
    md += `---\n\n`;
    md += `## Secondary Fix (address AFTER re-test confirms primary fix resolved)\n\n`;
    md += `**${secondaryFix.heuristic} — ${secondaryFix.name}** (${secondaryFix.severity})\n`;
    md += `Failing in ${secondaryFix.failCount} of ${secondaryFix.applicableCount} applicable scenarios.\n\n`;
    const sg = FIX_GUIDANCE[secondaryFix.heuristic];
    if (sg) {
      md += `Root cause: ${sg.rootCause}\n\n`;
      if (secondaryFix.worstScenarios.length > 0) {
        md += `Evidence: ${secondaryFix.worstScenarios[0]?.note}\n\n`;
      }
    }
  }

  return md;
}

// ── Generate human report ─────────────────────────────────────────────────────

function generateReport(iteration, runResults, evaluations, stats, score) {
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const critFails = allCriticalFailures(evaluations);
  const scoreStr  = `${(score * 100).toFixed(1)}%`;
  const threshold = `${(THRESHOLD_SCORE * 100).toFixed(0)}%`;
  const status    = score >= THRESHOLD_SCORE && critFails.length === 0 ? '✓ THRESHOLD MET' : '✗ BELOW THRESHOLD';

  let md = `# Quality Loop Report — Iteration ${iteration} — ${timestamp}\n\n`;
  md += `## Overall Score: ${scoreStr} / 100%  —  ${status} (threshold: ${threshold})\n\n`;

  if (critFails.length > 0) {
    md += `⚠️  **Critical failures detected:** ${critFails.map(c => `${c.heuristic} in \`${c.scenarioId}\``).join(', ')}\n\n`;
  }

  // ── Heuristic Summary Table ────────────────────────────────────────────────
  md += `## Heuristic Summary\n\n`;
  md += `| # | Heuristic | Severity | Pass | Marginal | Fail | N/A |\n`;
  md += `|---|-----------|----------|------|----------|------|-----|\n`;

  for (const [h, name] of Object.entries(HEURISTIC_NAMES)) {
    const s   = stats[h] ?? { pass: 0, marginal: 0, fail: 0, na: 0 };
    const sev = HEURISTIC_SEVERITY[h] ?? '';
    const failMark = s.fail > 0 ? `**${s.fail}**` : s.fail;
    md += `| ${h} | ${name} | ${sev} | ${s.pass} | ${s.marginal} | ${failMark} | ${s.na} |\n`;
  }

  // ── Per-Scenario Results ──────────────────────────────────────────────────
  md += `\n## Scenario Results\n\n`;

  for (const ev of evaluations) {
    const run   = runResults.find(r => r.scenarioId === ev.scenarioId);
    const score = (ev.aggregateScore * 100).toFixed(0);
    const fails = Object.entries(ev.scores ?? {}).filter(([, g]) => g === 'Fail').map(([h]) => h);

    md += `### \`${ev.scenarioId}\`\n`;
    md += `**Score:** ${score}%  |  **Turns:** ${run?.turnCount ?? '?'}  |  **Exit:** ${run?.exitReason ?? '?'}\n\n`;

    if (fails.length > 0) {
      md += `**Failed heuristics:** ${fails.map(h => `${h} (${HEURISTIC_NAMES[h]})`).join(', ')}\n\n`;
    } else {
      md += `**All applicable heuristics passed.**\n\n`;
    }

    // Show notes for failed heuristics only
    for (const h of fails) {
      const note = ev.notes?.[h];
      if (note) md += `- **${h}:** ${note}\n`;
    }

    // Show last few agent turns for context
    const agentTurns = (run?.transcript ?? []).filter(m => m.role === 'AGENT');
    if (agentTurns.length > 0) {
      const lastTurn = agentTurns[agentTurns.length - 1]?.content?.slice(0, 200) ?? '';
      md += `\n*Last agent message excerpt:* "${lastTurn}…"\n`;
    }

    md += `\n`;
  }

  return md;
}

// ── Write all outputs ─────────────────────────────────────────────────────────

export function writeReports(iteration, runResults, evaluations) {
  mkdirSync(RESULTS_DIR, { recursive: true });

  const stats   = aggregateByHeuristic(evaluations);
  const score   = overallScore(evaluations);
  const topFix  = identifyTopFix(stats, evaluations, runResults);
  const secFix  = topFix ? identifySecondaryFix(topFix.heuristic, stats, evaluations, runResults) : null;
  const critFails = allCriticalFailures(evaluations);

  // 1. Human report
  const reportMd = generateReport(iteration, runResults, evaluations, stats, score);
  const reportFile = path.join(RESULTS_DIR, `report-${String(iteration).padStart(3, '0')}.md`);
  writeFileSync(reportFile, reportMd, 'utf8');

  // 2. Machine-readable JSON
  const highSevFailures = checkHighSeverityThresholds(stats);
  const latestJson = {
    iteration,
    timestamp: new Date().toISOString(),
    overallScore: score,
    // All three conditions must hold: score, no critical failures, high-severity heuristics ≥75%
    thresholdMet: score >= THRESHOLD_SCORE && critFails.length === 0 && highSevFailures.length === 0,
    criticalFailures: critFails,
    highSeverityFailures: highSevFailures,
    heuristicStats: stats,
    scenarios: evaluations,
  };
  writeFileSync(path.join(RESULTS_DIR, 'latest.json'), JSON.stringify(latestJson, null, 2), 'utf8');

  // 3. NEXT_FIX.md
  const nextFixMd = generateNextFix(iteration, score, stats, topFix, secFix, evaluations, runResults);
  writeFileSync(path.join(RESULTS_DIR, 'NEXT_FIX.md'), nextFixMd, 'utf8');

  return {
    score,
    criticalFailures: critFails,
    topFix,
    reportFile,
    thresholdMet: score >= THRESHOLD_SCORE && critFails.length === 0,
    stats,
  };
}

// ── Check high-severity heuristic threshold ───────────────────────────────────

export function checkHighSeverityThresholds(stats) {
  const HIGH_HEURISTICS = ['H3', 'H5', 'H8', 'H13'];
  const failures = [];

  for (const h of HIGH_HEURISTICS) {
    const s = stats[h] ?? { pass: 0, marginal: 0, fail: 0 };
    const applicable = s.pass + s.marginal + s.fail;
    if (applicable === 0) continue;
    const passPct = s.pass / applicable;
    if (passPct < THRESHOLD_HIGH_PASS_PCT) {
      failures.push({ heuristic: h, name: HEURISTIC_NAMES[h], passPct });
    }
  }

  return failures;
}
