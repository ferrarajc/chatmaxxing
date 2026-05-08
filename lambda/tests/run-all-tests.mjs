/**
 * Runs all 20 autopilot task tests sequentially and prints a summary.
 * Usage: OPENAI_API_KEY=sk-... node lambda/tests/run-all-tests.mjs
 *
 * Each test file is run as a child process. A test passes if it exits 0.
 * Results are printed as they complete, with a final summary table.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TESTS = [
  'test-add-account-access',
  'test-update-contact-info',
  'test-update-beneficiaries',
  'test-open-account',
  'test-place-purchase',
  'test-place-sale',
  'test-exchange-funds',
  'test-toggle-drip',
  'test-setup-auto-invest',
  'test-update-auto-invest',
  'test-pause-auto-invest',
  'test-request-withdrawal',
  'test-setup-systematic-withdrawal',
  'test-update-rmd-settings',
  'test-initiate-rollover',
  'test-roth-conversion',
  'test-request-tax-document',
  'test-cancel-reschedule-callback',
  'test-update-security',
];

// Allow skipping specific tests via SKIP env var (comma-separated)
const SKIP = new Set((process.env.SKIP ?? '').split(',').filter(Boolean));
// Allow running only specific tests via ONLY env var (comma-separated)
const ONLY = new Set((process.env.ONLY ?? '').split(',').filter(Boolean));

const toRun = TESTS.filter(t => {
  const id = t.replace('test-', '');
  if (ONLY.size > 0 && !ONLY.has(id) && !ONLY.has(t)) return false;
  if (SKIP.has(id) || SKIP.has(t)) return false;
  return true;
});

function runTest(testName) {
  return new Promise((resolve) => {
    const testFile = path.join(__dirname, `${testName}.mjs`);
    const start = Date.now();

    const child = spawn(process.execPath, [testFile], {
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });

    child.on('close', (code) => {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      resolve({ testName, passed: code === 0, code, stdout, stderr, elapsed });
    });
  });
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is required');
    process.exit(1);
  }

  const totalStart = Date.now();
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Autopilot Task Test Suite — ${toRun.length} tests`);
  console.log(`${'═'.repeat(60)}\n`);

  const results = [];

  for (let i = 0; i < toRun.length; i++) {
    const testName = toRun[i];
    const taskId = testName.replace('test-', '');
    process.stdout.write(`[${i + 1}/${toRun.length}] ${taskId.padEnd(32)} ... `);

    const result = await runTest(testName);
    results.push(result);

    if (result.passed) {
      console.log(`✓ PASS  (${result.elapsed}s)`);
    } else {
      console.log(`✗ FAIL  (${result.elapsed}s)`);
      // Print failure summary from stdout (last few lines)
      const failLines = result.stdout.split('\n')
        .filter(l => l.includes('FAIL') || l.includes('ERROR') || l.includes('x:') || l.includes('wrong'))
        .slice(0, 6);
      for (const line of failLines) {
        console.log(`          ${line.trim()}`);
      }
    }
  }

  const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1);
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Results: ${passed}/${toRun.length} passed  (${totalElapsed}s total)`);
  console.log(`${'═'.repeat(60)}`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    for (const r of results.filter(r => !r.passed)) {
      console.log(`  ✗ ${r.testName.replace('test-', '')}`);
    }
    console.log('\nTo re-run only failed tests:');
    const failedIds = results.filter(r => !r.passed).map(r => r.testName.replace('test-', '')).join(',');
    console.log(`  OPENAI_API_KEY=sk-... ONLY=${failedIds} node lambda/tests/run-all-tests.mjs`);
    console.log('');
    process.exit(1);
  }

  console.log('\n  All tests passed.\n');
  process.exit(0);
}

main().catch(err => { console.error('Runner error:', err); process.exit(1); });
