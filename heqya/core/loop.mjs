/**
 * Heqya — Generic Improvement Loop
 *
 * Orchestrates the run → evaluate → report → fix → redeploy cycle.
 * Entirely driven by config — no hardwired file paths or deploy commands.
 *
 * LOOP CONFIG:
 *   config.adapter          — Heqya adapter (send + reset)
 *   config.scenarios        — array of scenario objects
 *   config.heuristics       — { document, codes, domainKnowledge? }
 *   config.thresholds       — { minOverallScore, zeroCriticalCodes, highSeverityPassRate? }
 *   config.llm              — { apiKey, simulatorModel?, evaluatorModel? }
 *   config.resultsDir       — directory for output files
 *   config.iterationFile    — path to iteration.txt
 *   config.maxIterations    — number (default 12)
 *   config.verbose          — boolean
 *   config.resetBetween     — boolean (default true)
 *
 *   config.applyFix(nextFixContent, iteration)
 *     — async function called after each failed evaluation
 *     — receives the NEXT_FIX.md content as a string
 *     — should apply the fix to the system under test
 *     — returns { applied: boolean, explanation?: string }
 *
 *   config.afterFix(iteration)
 *     — async function called after applyFix succeeds
 *     — should typecheck, deploy, or otherwise make the fix live
 *     — throw to abort the loop on deploy failure
 *
 * STDOUT MARKERS (parsed by server.mjs and CI scripts):
 *   [ITERATION_COMPLETE n score]
 *   [THRESHOLD_MET]
 *   [MAX_ITERATIONS]
 *   [FIX_APPLIED]
 *   [WAITING_FOR_FIX]
 *   [DEPLOY_START]
 *   [DEPLOY_DONE]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { runAllScenarios } from './runner.mjs';
import { evaluateAll } from './evaluator.mjs';
import { writeReports } from './reporter.mjs';

// ── Iteration counter ──────────────────────────────────────────────────────────

function readIteration(iterationFile) {
  if (!existsSync(iterationFile)) return 1;
  const n = parseInt(readFileSync(iterationFile, 'utf8').trim(), 10);
  return isNaN(n) ? 1 : n;
}

function writeIteration(iterationFile, n) {
  writeFileSync(iterationFile, String(n), 'utf8');
}

// ── Main loop ──────────────────────────────────────────────────────────────────

/**
 * Run the full improvement loop.
 *
 * @param {object} config  — see module jsdoc above
 */
export async function runLoop(config) {
  const {
    adapter,
    scenarios,
    heuristics,
    thresholds,
    llm,
    resultsDir,
    iterationFile,
    maxIterations = 12,
    verbose       = false,
    resetBetween  = true,
    applyFix,
    afterFix,
  } = config;

  mkdirSync(resultsDir, { recursive: true });

  process.stdout.write(`\n${'═'.repeat(60)}\n`);
  process.stdout.write(`  Heqya Improvement Loop\n`);
  process.stdout.write(`  Mode: ${applyFix ? 'AUTOMATED (applyFix provided)' : 'MANUAL (no applyFix)'}\n`);
  process.stdout.write(`${'═'.repeat(60)}\n\n`);

  let iteration = readIteration(iterationFile);

  while (iteration <= maxIterations) {
    process.stdout.write(`${'─'.repeat(60)}\n`);
    process.stdout.write(`  Iteration ${iteration} / ${maxIterations}\n`);
    process.stdout.write(`${'─'.repeat(60)}\n`);

    // ── Phase 1: Run ────────────────────────────────────────────
    process.stdout.write('\nPhase 1 — Driving conversations\n\n');
    const runResults = await runAllScenarios(scenarios, adapter, {
      llm,
      verbose,
      resetBetween,
    });

    // ── Phase 2: Evaluate ────────────────────────────────────────
    process.stdout.write('\nPhase 2 — Evaluating quality\n\n');
    const evaluations = await evaluateAll(runResults, heuristics, llm);

    // ── Phase 3: Report ──────────────────────────────────────────
    process.stdout.write('\nPhase 3 — Writing reports\n\n');
    const { score, thresholdMet } = await writeReports({
      iteration,
      runResults,
      evaluations,
      heuristics,
      thresholds,
      resultsDir,
      llm,
    });

    process.stdout.write(`[ITERATION_COMPLETE ${iteration} ${score.toFixed(2)}]\n`);
    process.stdout.write(`\n  Score: ${(score * 100).toFixed(1)}% — ${thresholdMet ? '✓ threshold met' : '✗ below threshold'}\n`);

    if (thresholdMet) {
      process.stdout.write('\n[THRESHOLD_MET]\n');
      process.stdout.write('\n✓ All thresholds met — improvement loop complete.\n\n');
      return { success: true, iteration };
    }

    if (iteration >= maxIterations) {
      process.stdout.write('\n[MAX_ITERATIONS]\n');
      process.stdout.write(`\n⚠ Reached max iterations (${maxIterations}). Review manually.\n\n`);
      return { success: false, reason: 'max-iterations', iteration };
    }

    // ── Phase 4: Apply fix ────────────────────────────────────────
    process.stdout.write('\n  Applying fix...\n');

    const nextFixContent = readFileSync(path.join(resultsDir, 'NEXT_FIX.md'), 'utf8');

    if (applyFix) {
      try {
        const result = await applyFix(nextFixContent, iteration);
        if (result?.applied) {
          process.stdout.write(`  ✓ Fix applied${result.explanation ? `: ${result.explanation}` : ''}\n`);
          process.stdout.write('[FIX_APPLIED]\n');
        } else {
          process.stdout.write('  ⚠ applyFix returned { applied: false } — waiting for manual fix\n');
          process.stdout.write('[WAITING_FOR_FIX]\n');
          await waitForContinue();
        }
      } catch (err) {
        process.stdout.write(`  ✗ applyFix failed: ${err.message}\n`);
        process.stdout.write('[WAITING_FOR_FIX]\n');
        await waitForContinue();
      }
    } else {
      process.stdout.write('\n  Manual fix required. See NEXT_FIX.md.\n');
      process.stdout.write('[WAITING_FOR_FIX]\n');
      await waitForContinue();
    }

    // ── Phase 5: Redeploy ─────────────────────────────────────────
    if (afterFix) {
      process.stdout.write('\n[DEPLOY_START]\n');
      process.stdout.write('  Running afterFix (deploy/restart)...\n');
      await afterFix(iteration);
      process.stdout.write('[DEPLOY_DONE]\n');
      process.stdout.write('  ✓ afterFix complete\n');
    }

    // ── Increment ─────────────────────────────────────────────────
    iteration++;
    writeIteration(iterationFile, iteration);
    process.stdout.write(`\n  Starting iteration ${iteration}...\n\n`);
  }
}

// ── Wait for manual continue (stdin "continue" or empty line) ─────────────────

function waitForContinue() {
  return new Promise(resolve => {
    if (process.stdin.isPaused()) process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const handler = (data) => {
      if (data.trim() === 'continue' || data.trim() === '') {
        process.stdin.removeListener('data', handler);
        process.stdin.pause();
        resolve();
      }
    };
    process.stdin.on('data', handler);
  });
}
