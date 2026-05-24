/**
 * Quality Loop — Main Entry Point (Bob's)
 *
 * Drives one evaluation pass using the heqya generic engine + Bob's config.
 * See heqya.config.mjs for heuristics, adapter, scenarios, and thresholds.
 * See bobs-adapter.mjs for the autopilot-turn API wiring.
 *
 * Usage:
 *   node scripts/quality-loop/run-quality-loop.mjs
 *
 * Optional env vars:
 *   API_BASE        Override API base URL (default: production)
 *   OPENAI_MODEL    Customer simulator model (default: gpt-4o-mini)
 *   EVALUATOR_MODEL Evaluator model (default: gpt-4o)
 *   VERBOSE         Set to 1 for turn-by-turn transcript logging
 *   ONLY            Comma-separated scenario IDs to run
 *   SKIP            Comma-separated scenario IDs to skip
 *   NO_RESET        Set to 1 to skip DB reset between scenarios
 *
 * Exit codes:
 *   0 — All thresholds met
 *   1 — Below threshold (NEXT_FIX.md written with instructions)
 *   2 — Configuration error
 *   3 — Max iterations reached
 */

import { fileURLToPath } from 'url';
import path from 'path';
import { runAllScenarios }                  from '../../heqya/core/runner.mjs';
import { evaluateAll }                      from '../../heqya/core/evaluator.mjs';
import { writeReports, checkHighSeverityPassRates } from '../../heqya/core/reporter.mjs';
import { resolveSecrets }                   from './secrets.mjs';
import CONFIG                               from './heqya.config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Secrets ────────────────────────────────────────────────────────────────────

await resolveSecrets();

if (!process.env.OPENAI_API_KEY) {
  console.error('\n✗ OPENAI_API_KEY is required (not found in env or SSM: bobs-openai-api-key)\n');
  process.exit(2);
}

// Re-inject resolved key into config (resolveSecrets sets process.env after config imported)
CONFIG.llm.apiKey = process.env.OPENAI_API_KEY;

// ── CLI options ────────────────────────────────────────────────────────────────

const verbose     = process.env.VERBOSE === '1';
const noReset     = process.env.NO_RESET === '1';
const ONLY        = new Set((process.env.ONLY ?? '').split(',').filter(Boolean));
const SKIP        = new Set((process.env.SKIP ?? '').split(',').filter(Boolean));

// ── Iteration tracking ─────────────────────────────────────────────────────────

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

const RESULTS_DIR     = CONFIG.resultsDir;
const ITERATION_FILE  = CONFIG.iterationFile;
const MAX_ITERATIONS  = CONFIG.maxIterations;
const THRESHOLD_SCORE = CONFIG.thresholds.minOverallScore;

mkdirSync(RESULTS_DIR, { recursive: true });

function readIteration() {
  if (!existsSync(ITERATION_FILE)) return 1;
  const n = parseInt(readFileSync(ITERATION_FILE, 'utf8').trim(), 10);
  return isNaN(n) ? 1 : n;
}

// ── Filter scenarios ───────────────────────────────────────────────────────────

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

  if (iteration > MAX_ITERATIONS) {
    console.error(`✗ Max iterations (${MAX_ITERATIONS}) reached. Review NEXT_FIX.md and decide next steps manually.\n`);
    process.exit(3);
  }

  console.log(`\n${'═'.repeat(64)}`);
  console.log(`  Quality Loop — Iteration ${iteration}`);
  console.log(`  Evaluator: ${CONFIG.llm.evaluatorModel}  |  Simulator: ${CONFIG.llm.simulatorModel}`);
  console.log(`${'═'.repeat(64)}\n`);

  const scenarios = filterScenarios(CONFIG.scenarios);

  if (scenarios.length === 0) {
    console.error('✗ No scenarios to run (check ONLY/SKIP env vars).\n');
    process.exit(2);
  }

  console.log(`Running ${scenarios.length} scenarios${ONLY.size > 0 ? ` (filtered: ${[...ONLY].join(', ')})` : ''}…\n`);

  // ── Phase 1: Run conversations ─────────────────────────────────────────────
  console.log('Phase 1 — Driving conversations\n');
  const runResults = await runAllScenarios(scenarios, CONFIG.adapter, {
    llm:          CONFIG.llm,
    verbose,
    resetBetween: !noReset,
  });

  const errorCount = runResults.filter(r => r.error).length;
  if (errorCount > 0) {
    console.log(`\n  ⚠  ${errorCount} scenario(s) errored — they will receive N/A scores.\n`);
  }

  // ── Phase 2: Evaluate conversations ───────────────────────────────────────
  console.log('\nPhase 2 — Evaluating quality\n');
  const evaluations = await evaluateAll(runResults, CONFIG.heuristics, CONFIG.llm);

  // ── Phase 3: Report ────────────────────────────────────────────────────────
  console.log('\nPhase 3 — Writing reports\n');
  const { score, criticalFailures, topFix, reportFile, thresholdMet, stats } =
    writeReports({
      iteration,
      runResults,
      evaluations,
      heuristics:  CONFIG.heuristics,
      thresholds:  CONFIG.thresholds,
      resultsDir:  RESULTS_DIR,
    });

  const highSeverityFailures = checkHighSeverityPassRates(stats, CONFIG.thresholds);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`${'─'.repeat(64)}`);
  console.log(`  Overall Score:    ${(score * 100).toFixed(1)}% / 100%  (threshold: ${(THRESHOLD_SCORE * 100).toFixed(0)}%)`);

  if (criticalFailures.length > 0) {
    console.log(`  Critical Fails:   ${criticalFailures.map(c => `${c.code} in ${c.scenarioId}`).join(', ')}`);
  } else {
    console.log(`  Critical Fails:   none`);
  }

  for (const f of highSeverityFailures) {
    console.log(`  ${f.code} (High):      ${(f.rate * 100).toFixed(0)}% pass rate (threshold: 75%)`);
  }

  console.log(`  Report:           ${reportFile}`);
  console.log(`  NEXT_FIX.md:      ${path.join(RESULTS_DIR, 'NEXT_FIX.md')}`);
  console.log(`${'─'.repeat(64)}\n`);

  // ── Threshold check ────────────────────────────────────────────────────────
  const allThresholdsMet = thresholdMet && highSeverityFailures.length === 0;

  if (allThresholdsMet) {
    console.log('✓  ALL THRESHOLDS MET\n');
    console.log('   Next steps:');
    console.log('   1. Review the final report for any marginal heuristics worth improving');
    console.log('   2. Open a PR for the accumulated changes on this branch\n');
    process.exit(0);
  } else {
    console.log('✗  BELOW THRESHOLD\n');

    if (topFix) {
      console.log(`   Top priority fix: ${topFix.code} — ${topFix.name}`);
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
