/**
 * Quality Loop — Main Orchestrator
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node scripts/quality-loop/run-quality-loop.mjs
 *
 * Optional env vars:
 *   API_BASE        Override API base URL (default: production)
 *   OPENAI_MODEL    Customer simulator model (default: gpt-4o-mini)
 *   EVALUATOR_MODEL Evaluator model (default: gpt-4o)
 *   VERBOSE         Set to 1 for turn-by-turn transcript logging
 *   ONLY            Comma-separated scenario IDs to run (e.g., ONLY=alex-place-purchase)
 *   SKIP            Comma-separated scenario IDs to skip
 *   NO_RESET        Set to 1 to skip DynamoDB reset between scenarios (faster, less isolated)
 *
 * Exit codes:
 *   0 — All thresholds met
 *   1 — Below threshold (NEXT_FIX.md written with instructions)
 *   2 — Configuration error (missing API key, etc.)
 *   3 — Max iterations reached
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

import SCENARIOS from './scenarios.mjs';
import { runAllScenarios } from './runner.mjs';
import { evaluateAll } from './evaluator.mjs';
import { writeReports, checkHighSeverityThresholds } from './reporter.mjs';
import { resolveSecrets } from './secrets.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(__dirname, 'results');
const ITERATION_FILE = path.join(RESULTS_DIR, 'iteration.txt');

const MAX_ITERATIONS  = 12;
const THRESHOLD_SCORE = 0.80;

// ── Configuration ──────────────────────────────────────────────────────────────

await resolveSecrets();

if (!process.env.OPENAI_API_KEY) {
  console.error('\n✗ OPENAI_API_KEY is required (not found in env or SSM).\n');
  console.error('Checked SSM parameter: bobs-openai-api-key\n');
  process.exit(2);
}

const verbose    = process.env.VERBOSE === '1';
const noReset    = process.env.NO_RESET === '1';
const ONLY       = new Set((process.env.ONLY ?? '').split(',').filter(Boolean));
const SKIP       = new Set((process.env.SKIP ?? '').split(',').filter(Boolean));

// ── Iteration tracking ─────────────────────────────────────────────────────────

mkdirSync(RESULTS_DIR, { recursive: true });

function readIteration() {
  if (!existsSync(ITERATION_FILE)) return 1;
  const n = parseInt(readFileSync(ITERATION_FILE, 'utf8').trim(), 10);
  return isNaN(n) ? 1 : n;
}

function writeIteration(n) {
  writeFileSync(ITERATION_FILE, String(n), 'utf8');
}

// ── Scenario filter ────────────────────────────────────────────────────────────

function filterScenarios(scenarios) {
  return scenarios.filter(s => {
    if (ONLY.size > 0 && !ONLY.has(s.id)) return false;
    if (SKIP.has(s.id)) return false;
    return true;
  });
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const iteration = readIteration();

  console.log(`\n${'═'.repeat(64)}`);
  console.log(`  Quality Loop — Iteration ${iteration}`);
  console.log(`  Model: ${process.env.EVALUATOR_MODEL ?? 'gpt-4o'} (evaluator) / ${process.env.OPENAI_MODEL ?? 'gpt-4o-mini'} (customer)`);
  console.log(`${'═'.repeat(64)}\n`);

  // Max iterations guard
  if (iteration > MAX_ITERATIONS) {
    console.error(`✗ Max iterations (${MAX_ITERATIONS}) reached. Review NEXT_FIX.md and decide next steps manually.\n`);
    process.exit(3);
  }

  const scenarios = filterScenarios(SCENARIOS);

  if (scenarios.length === 0) {
    console.error('✗ No scenarios to run (check ONLY/SKIP env vars).\n');
    process.exit(2);
  }

  console.log(`Running ${scenarios.length} scenarios${ONLY.size > 0 ? ` (filtered to: ${[...ONLY].join(', ')})` : ''}…\n`);

  // ── Phase 1: Run conversations ─────────────────────────────────────────────
  console.log('Phase 1 — Driving conversations\n');
  const runResults = await runAllScenarios(scenarios, {
    verbose,
    resetBetween: !noReset,
  });

  const errorCount = runResults.filter(r => r.error).length;
  if (errorCount > 0) {
    console.log(`\n  ⚠  ${errorCount} scenario(s) errored — they will receive N/A scores in evaluation.\n`);
  }

  // ── Phase 2: Evaluate conversations ───────────────────────────────────────
  console.log('\nPhase 2 — Evaluating quality\n');
  const evaluations = await evaluateAll(runResults);

  // ── Phase 3: Report ────────────────────────────────────────────────────────
  console.log('\nPhase 3 — Writing reports\n');
  const { score, criticalFailures, topFix, reportFile, thresholdMet, stats } =
    writeReports(iteration, runResults, evaluations);

  const highSeverityFailures = checkHighSeverityThresholds(stats);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`${'─'.repeat(64)}`);
  console.log(`  Overall Score:    ${(score * 100).toFixed(1)}% / 100%  (threshold: ${(THRESHOLD_SCORE * 100).toFixed(0)}%)`);

  if (criticalFailures.length > 0) {
    console.log(`  Critical Fails:   ${criticalFailures.map(c => `${c.heuristic} in ${c.scenarioId}`).join(', ')}`);
  } else {
    console.log(`  Critical Fails:   none`);
  }

  if (highSeverityFailures.length > 0) {
    for (const f of highSeverityFailures) {
      console.log(`  ${f.heuristic} (High):      ${(f.passPct * 100).toFixed(0)}% pass rate (threshold: 75%)`);
    }
  }

  console.log(`  Report:           ${reportFile}`);
  console.log(`  NEXT_FIX.md:      ${path.join(RESULTS_DIR, 'NEXT_FIX.md')}`);
  console.log(`${'─'.repeat(64)}\n`);

  // ── Threshold check ────────────────────────────────────────────────────────
  const allThresholdsMet =
    thresholdMet &&
    criticalFailures.length === 0 &&
    highSeverityFailures.length === 0;

  if (allThresholdsMet) {
    console.log('✓  ALL THRESHOLDS MET\n');
    console.log('   The quality loop is complete. Next steps:');
    console.log('   1. Review the final report for any marginal heuristics worth improving');
    console.log('   2. Open a PR for the accumulated changes on this branch\n');
    process.exit(0);
  } else {
    console.log('✗  BELOW THRESHOLD\n');

    if (topFix) {
      console.log(`   Top priority fix: ${topFix.heuristic} — ${topFix.name}`);
      console.log(`   Failing in ${topFix.failCount}/${topFix.applicableCount} scenarios\n`);
    }

    console.log('   Read  scripts/quality-loop/results/NEXT_FIX.md  for implementation instructions.');
    console.log('   After implementing and deploying, increment iteration.txt and rerun.\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n✗ Unexpected error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
