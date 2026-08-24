/**
 * Runs the fast test suite and prints a summary.
 *
 *   node lambda/tests/run-all-tests.mjs              everything (2 tests need network)
 *   node lambda/tests/run-all-tests.mjs --offline    just the pure unit tests, a few seconds
 *
 * Each test file runs as a child process; it passes if it exits 0.
 *
 * WHAT IS NOT HERE ANY MORE: the 19 per-task conversation harnesses that used to live in
 * this folder. They were ~88% copy-paste, they built a full transcript and then DISCARDED
 * it (so a failure could not be diagnosed without a re-run), not one of them ever called
 * /execute-task — leaving the entire write path untested end to end — and they all
 * defaulted to PROD. They are replaced by:
 *
 *     node scripts/task-sim/run.mjs <taskId>
 *
 * which drives ONE expert end to end ten times, submits, verifies the ledger actually
 * moved, and produces a readable transcript with the problems marked inline. It is
 * deliberately NOT wired in here: it takes tens of minutes, spends money, and mutates dev
 * data, so it must be invoked knowingly.
 *
 * This suite no longer requires OPENAI_API_KEY. Nothing left in it plays a customer; the
 * two networked tests call Lambdas that hold their own key.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Pure unit tests — no network, no LLM, no key. Ordered so a failure here explains
// failures further down.
const OFFLINE = [
  'test-contribution-limits',   // the IRA contribution-limit math
  'test-money',                 // currency parsing — "$4,800" must not become NaN
  'test-advice-guard',          // holdings questions are facts, not advice
  'test-account-math',          // balance === cash + Σ holdings, incl. the seed invariant
  'test-resolve-account',       // "Taxable Account (acc-302)" must not silently no-op
  'test-strip-internal-status', // agent-facing status must never reach the client
  'test-summary-style',         // summaries stay noun phrases — no "Selled"
  'test-task-suggestion',       // "I'd like to sell" suggests Sell fund shares, not Callback
];

// Hit a deployed API, but read-only and needing no local key.
const ONLINE = [
  'test-contributions',         // contribution summary across all four personas
  'test-force-task',            // routing: forceTaskId + last-[TASK:]-marker-wins
];

const offlineOnly = process.argv.includes('--offline');
const SKIP = new Set((process.env.SKIP ?? '').split(',').filter(Boolean));
const ONLY = new Set((process.env.ONLY ?? '').split(',').filter(Boolean));

const toRun = [...OFFLINE, ...(offlineOnly ? [] : ONLINE)].filter(t => {
  const id = t.replace('test-', '');
  if (ONLY.size > 0 && !ONLY.has(id) && !ONLY.has(t)) return false;
  return !(SKIP.has(id) || SKIP.has(t));
});

function runTest(testName) {
  return new Promise(resolve => {
    const start = Date.now();
    const child = spawn(process.execPath, [path.join(__dirname, `${testName}.mjs`)], {
      env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('close', code => resolve({
      testName, passed: code === 0, code, stdout, stderr,
      elapsed: ((Date.now() - start) / 1000).toFixed(1),
    }));
  });
}

async function main() {
  const totalStart = Date.now();
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Test suite — ${toRun.length} tests${offlineOnly ? ' (offline only)' : ''}`);
  console.log(`${'═'.repeat(60)}\n`);

  const results = [];
  for (let i = 0; i < toRun.length; i++) {
    process.stdout.write(`[${i + 1}/${toRun.length}] ${toRun[i].replace('test-', '').padEnd(28)} ... `);
    const r = await runTest(toRun[i]);
    results.push(r);
    if (r.passed) {
      console.log(`✓ PASS  (${r.elapsed}s)`);
    } else {
      console.log(`✗ FAIL  (${r.elapsed}s)`);
      for (const line of r.stdout.split('\n').filter(l => l.includes('✗')).slice(0, 8)) {
        console.log(`          ${line.trim()}`);
      }
      if (!r.stdout.trim() && r.stderr.trim()) {
        console.log(`          ${r.stderr.split('\n').slice(0, 3).join('\n          ')}`);
      }
    }
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${passed}/${toRun.length} passed  (${((Date.now() - totalStart) / 1000).toFixed(1)}s)`);
  console.log(`${'═'.repeat(60)}`);

  if (failed) {
    const ids = results.filter(r => !r.passed).map(r => r.testName.replace('test-', '')).join(',');
    console.log(`\nRe-run just those:\n  ONLY=${ids} node lambda/tests/run-all-tests.mjs\n`);
    process.exit(1);
  }
  console.log('\n  Conversation-level behaviour is covered separately, per task, on demand:');
  console.log('    node scripts/task-sim/run.mjs <taskId>\n');
  process.exit(0);
}

main().catch(err => { console.error('Runner error:', err); process.exit(1); });
