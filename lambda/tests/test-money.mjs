/**
 * Unit test for lambda/shared/money.ts.
 *
 * Offline — no network, no AWS. The module under test is TypeScript, so it is bundled
 * to a temp .mjs with esbuild first (same approach as test-contribution-limits.mjs).
 *
 * WHY THIS EXISTS: `parseFloat("$4,800")` is NaN, and `NaN <= 0` is FALSE, so every
 * `amount <= 0` guard in execute-task passed NaN straight through into the holdings and
 * balance math. DynamoDB rejects NaN, the handler returned an opaque 500, and the agent
 * saw "Submission failed — please try again." The task-expert prompts literally instruct
 * the model to write amounts as `"$5,000"`, so this fired constantly.
 *
 * Usage:
 *   node lambda/tests/test-money.mjs
 */

import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'shared', 'money.ts');

const outDir = mkdtempSync(path.join(tmpdir(), 'money-'));
const outFile = path.join(outDir, 'money.mjs');
execFileSync('npx', ['esbuild', SRC, '--bundle', '--platform=node', '--format=esm', `--outfile=${outFile}`, '--log-level=error'], {
  cwd: path.join(__dirname, '..', '..'),
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

const { parseMoney, isValidAmount, isFullAmount, resolveAmount, numberOr, formatMoney } =
  await import(pathToFileURL(outFile).href);

let passed = 0;
let failed = 0;
function check(label, ok, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}${detail ? `  — ${detail}` : ''}`); }
}
function group(name, fn) { console.log(`\n${name}`); fn(); }

// ── The exact strings the LLM writes ────────────────────────────────────────
group('parseMoney — currency strings the task experts actually produce', () => {
  check('"$4,800" -> 4800 (the string that broke Submit)', parseMoney('$4,800') === 4800, String(parseMoney('$4,800')));
  check('"$5,000" -> 5000 (the prompt\'s own example)', parseMoney('$5,000') === 5000, String(parseMoney('$5,000')));
  check('"$800" -> 800', parseMoney('$800') === 800, String(parseMoney('$800')));
  check('"4,800" -> 4800', parseMoney('4,800') === 4800, String(parseMoney('4,800')));
  check('"$4,800.00" -> 4800', parseMoney('$4,800.00') === 4800, String(parseMoney('$4,800.00')));
  check('"$1,234,567.89" -> 1234567.89', parseMoney('$1,234,567.89') === 1234567.89, String(parseMoney('$1,234,567.89')));
  check('"  4800  " -> 4800', parseMoney('  4800  ') === 4800, String(parseMoney('  4800  ')));
  check('"$500 per month" -> 500', parseMoney('$500 per month') === 500, String(parseMoney('$500 per month')));
  check('plain number 4800 -> 4800', parseMoney(4800) === 4800);
  check('"-250.50" -> -250.5', parseMoney('-250.50') === -250.5, String(parseMoney('-250.50')));
});

// ── The NaN contract ────────────────────────────────────────────────────────
// parseMoney returns NaN rather than 0 so a caller can tell "unparseable" from "zero"
// and reject it with a real message instead of silently writing a figure.
group('parseMoney — unparseable input yields NaN, never 0', () => {
  check('"" -> NaN', Number.isNaN(parseMoney('')));
  check('null -> NaN', Number.isNaN(parseMoney(null)));
  check('undefined -> NaN', Number.isNaN(parseMoney(undefined)));
  check('"full balance" -> NaN', Number.isNaN(parseMoney('full balance')));
  check('"$" -> NaN', Number.isNaN(parseMoney('$')));
  check('"." -> NaN', Number.isNaN(parseMoney('.')));
  check('"-" -> NaN', Number.isNaN(parseMoney('-')));
  check('"abc" -> NaN', Number.isNaN(parseMoney('abc')));
  check('NaN number -> NaN', Number.isNaN(parseMoney(NaN)));
  check('Infinity -> NaN', Number.isNaN(parseMoney(Infinity)));
});

// ── The guard that was wrong ────────────────────────────────────────────────
group('isValidAmount — this is what `amount <= 0` should always have been', () => {
  check('NaN is NOT valid (the whole bug: NaN <= 0 is false)', isValidAmount(NaN) === false);
  check('0 is not valid', isValidAmount(0) === false);
  check('negative is not valid', isValidAmount(-5) === false);
  check('Infinity is not valid', isValidAmount(Infinity) === false);
  check('4800 is valid', isValidAmount(4800) === true);
  check('0.01 is valid', isValidAmount(0.01) === true);
  check('parseMoney("$4,800") passes the guard', isValidAmount(parseMoney('$4,800')) === true);
  check('parseMoney("full balance") fails the guard', isValidAmount(parseMoney('full balance')) === false);
});

// ── "All of it" ─────────────────────────────────────────────────────────────
// Four experts explicitly invite these phrasings, and every one of them used to feed
// the phrase to parseFloat, so the DOCUMENTED answer produced a failed submit.
group('isFullAmount — the phrasings the prompts invite', () => {
  check('"full balance"', isFullAmount('full balance') === true);
  check('"Full redemption"', isFullAmount('Full redemption') === true);
  check('"all shares"', isFullAmount('all shares') === true);
  check('"everything in that fund"', isFullAmount('everything in that fund') === true);
  check('"the entire account"', isFullAmount('the entire account') === true);
  check('"$4,800" is NOT a full-amount request', isFullAmount('$4,800') === false);
  check('"" is not', isFullAmount('') === false);
  check('null is not', isFullAmount(null) === false);
  // "smallest" contains no whole-word match; guard against sloppy substring matching.
  check('"$500 installment" is not', isFullAmount('$500 installment') === false);
});

group('resolveAmount — ceiling for "all", parsed figure otherwise', () => {
  check('"full balance" against 4800 -> 4800', resolveAmount('full balance', 4800) === 4800);
  check('"$800" against 4800 -> 800', resolveAmount('$800', 4800) === 800);
  check('"all shares" against 3923 -> 3923', resolveAmount('all shares', 3923) === 3923);
  check('garbage -> NaN (caller rejects)', Number.isNaN(resolveAmount('zzz', 4800)));
  check('"full" with 0 ceiling -> 0, which fails isValidAmount',
    resolveAmount('full balance', 0) === 0 && isValidAmount(resolveAmount('full balance', 0)) === false);
});

group('numberOr — only for fields with a real default', () => {
  check('unparseable withholding falls back to 10', numberOr('not a number', 10) === 10);
  check('"10%" -> 10', numberOr('10%', 10) === 10, String(numberOr('10%', 10)));
  check('"0%" -> 0, NOT the fallback', numberOr('0%', 10) === 0, String(numberOr('0%', 10)));
  check('"20" -> 20', numberOr('20', 10) === 20);
  check('missing -> fallback', numberOr(undefined, 10) === 10);
});

group('formatMoney', () => {
  check('4800 -> "4,800.00"', formatMoney(4800) === '4,800.00', formatMoney(4800));
  check('877 -> "877.00"', formatMoney(877) === '877.00', formatMoney(877));
  check('3923.5 -> "3,923.50"', formatMoney(3923.5) === '3,923.50', formatMoney(3923.5));
});

rmSync(outDir, { recursive: true, force: true });

console.log(`\n${failed === 0 ? '✓ PASS' : '✗ FAIL'} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
