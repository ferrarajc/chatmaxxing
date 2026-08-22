/**
 * Unit test for lambda/shared/advice-guard.ts.
 *
 * Offline — no network, no AWS, no LLM. Bundled with esbuild like
 * test-contribution-limits.mjs.
 *
 * WHY THIS EXISTS: the guard had no test at all, and a false positive here is severe.
 * In autopilot-turn it does not merely nudge a suggestion — it returns a canned decline,
 * sets shouldExitAutopilot and hands the conversation to the callback scope. A client
 * asking the buy-funds expert "Which fund do I hold right now" — a factual question
 * about their own account, in direct answer to the expert's own question — was told we
 * are not permitted to give investment advice, and the task died.
 *
 * The two halves of this file matter equally. Narrowing a guard is only safe if the
 * true positives still fire, so "must still route to a callback" is as load-bearing as
 * "must not".
 *
 * Usage:
 *   node lambda/tests/test-advice-guard.mjs
 */

import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'shared', 'advice-guard.ts');

const outDir = mkdtempSync(path.join(tmpdir(), 'advice-guard-'));
const outFile = path.join(outDir, 'advice-guard.mjs');
execFileSync('npx', ['esbuild', SRC, '--bundle', '--platform=node', '--format=esm', `--outfile=${outFile}`, '--log-level=error'], {
  cwd: path.join(__dirname, '..', '..'),
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

const { isAdviceRequest } = await import(pathToFileURL(outFile).href);

let passed = 0;
let failed = 0;
function advice(msg) {
  const got = isAdviceRequest(msg);
  if (got === true) { passed++; console.log(`  ✓ routes to advisor: "${msg}"`); }
  else { failed++; console.log(`  ✗ SHOULD route to advisor but did not: "${msg}"`); }
}
function notAdvice(msg) {
  const got = isAdviceRequest(msg);
  if (got === false) { passed++; console.log(`  ✓ answerable: "${msg}"`); }
  else { failed++; console.log(`  ✗ FALSE POSITIVE — treated as advice: "${msg}"`); }
}
function group(name, fn) { console.log(`\n${name}`); fn(); }

// ── The regression ──────────────────────────────────────────────────────────
group('The reported bug — factual holdings questions are NOT advice', () => {
  notAdvice('Which fund do I hold right now');
  notAdvice('which fund do I hold right now?');
  notAdvice('What funds do I own?');
  notAdvice('What funds do I currently hold in my Roth?');
  notAdvice('Am I invested in the ESG fund?');
  notAdvice('Do I have any international funds?');
  notAdvice("What's in my taxable account?");
  notAdvice('What are my current holdings?');
  notAdvice('How much do I have invested in the ESG fund?');
  notAdvice('Did I buy any bond funds last year?');
});

// ── The other question from the same chat ───────────────────────────────────
group('Account-fact questions asked mid-purchase', () => {
  notAdvice('Do I have cash in my taxable account?');
  notAdvice('Is that held in cash or is it invested in a fund?');
  notAdvice('How much is currently invested in the ESG fund?');
});

// ── True positives must still fire ──────────────────────────────────────────
group('Genuine advice — must still route to a licensed advisor', () => {
  advice('What should I invest in?');
  advice('Which fund is best for me?');
  advice('What are the best stocks to buy right now?');
  advice('Can you recommend a fund?');
  advice('What fund do you suggest?');
  advice('Should I buy more of the growth fund?');
  advice('Should I sell my bond fund?');
  advice('Where should I invest my money?');
  advice('What should I do with my portfolio?');
  advice('Any hot stock tips?');
  advice('I need investment advice');
  advice('What is your recommended allocation?');
});

// ── The hard cases: holdings phrasing PLUS selection intent ─────────────────
// These match the holdings carve-out on the surface but are really asking what to DO.
// If any of these regress to "answerable", the carve-out is too wide.
group('Holdings phrasing + selection intent — advice wins', () => {
  advice('Which of my funds should I sell?');
  advice('Of the funds I hold, which is best?');
  advice('I hold the growth fund — should I buy more?');
  advice('Should I get rid of the bond fund I own?');
  advice('Which fund that I own do you recommend I add to?');
});

// ── The pre-existing contribution-room carve-out must survive ───────────────
group('Contribution-room carve-out — still exempt (regression guard for #125)', () => {
  notAdvice('What can I still invest in my IRA this year?');
  notAdvice('How much can I still contribute to my Roth?');
  notAdvice('Am I maxed out on my IRA?');
  notAdvice('What is the Roth contribution deadline?');
  notAdvice('How much catch-up can I make?');
});

group('...unless it is really fund selection', () => {
  advice("What's the best fund for my contribution?");
  advice('Which fund should I put my contribution in?');
});

// ── Non-questions ───────────────────────────────────────────────────────────
group('Ordinary task chatter is never advice', () => {
  notAdvice('');
  notAdvice('Yes');
  notAdvice('The one that\'s not the Roth');
  notAdvice('I want to move in $800 please');
  notAdvice('Different plan. I want to move that $4,800 held in cash into the ESG Leaders fund.');
  notAdvice('Hi I\'d like to buy some shares of a fund');
  notAdvice('Can you change my address?');
});

rmSync(outDir, { recursive: true, force: true });

console.log(`\n${failed === 0 ? '✓ PASS' : '✗ FAIL'} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
