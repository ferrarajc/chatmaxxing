/**
 * Unit test for matchTaskByIntent() as used by next-best-response's scope/task
 * suggestion — the ✈ hint the agent sees when a client signals what they want.
 *
 * Offline — no network, no AWS, no LLM.
 *
 * WHY THIS EXISTS: NBR had a deterministic rule that forced suggestedScope='callback'
 * for any message matching TRADE_RE (buy|sell|purchase|trade|liquidat|redeem). That
 * dated from when trades could not be handled in chat. They can now — place-purchase
 * and place-sale are two of the 19 task experts — so a client saying "I'd like to sell
 * some shares" got a suggestion to schedule a CALLBACK, while the right expert sat
 * unoffered in the ✈ menu. NBR now runs this matcher and suggests the expert by id.
 *
 * The phrases below are taken verbatim from real POAT chats.
 *
 * Usage:
 *   node lambda/tests/test-task-suggestion.mjs
 */

import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'shared', 'tasks.ts');

const outDir = mkdtempSync(path.join(tmpdir(), 'task-suggestion-'));
const outFile = path.join(outDir, 'tasks.mjs');
execFileSync('npx', ['esbuild', SRC, '--bundle', '--platform=node', '--format=esm', `--outfile=${outFile}`, '--log-level=error'], {
  cwd: path.join(__dirname, '..', '..'), shell: process.platform === 'win32', stdio: 'inherit',
});

const { matchTaskByIntent } = await import(pathToFileURL(outFile).href);

let passed = 0, failed = 0;
const ACCOUNTS = ['Roth IRA', 'Taxable Account'];

function wants(msg, taskId) {
  const got = matchTaskByIntent(msg, ACCOUNTS)?.id ?? null;
  if (got === taskId) { passed++; console.log(`  ✓ "${msg}"  →  ${taskId}`); }
  else { failed++; console.log(`  ✗ "${msg}"\n      got:  ${got}\n      want: ${taskId}`); }
}
function group(name, fn) { console.log(`\n${name}`); fn(); }

group('The two POAT openers that were suggested "Callback"', () => {
  wants("I'd like to sell some shares I hold into cash", 'place-sale');
  wants("Hi I'd like to buy some shares of a fund", 'place-purchase');
});

group('Other natural phrasings for the same two', () => {
  wants('I want to sell my ESG fund', 'place-sale');
  wants('I need to liquidate some holdings', 'place-sale');
  wants('can I redeem some shares', 'place-sale');
  wants('I want to buy more of the growth fund', 'place-purchase');
  wants('I would like to make a contribution to my Roth', 'place-purchase');
  wants('I want to put money in my account', 'place-purchase');
});

group('Buy and sell are not confused with each other', () => {
  const sell = matchTaskByIntent('I want to sell shares', ACCOUNTS)?.id;
  const buy = matchTaskByIntent('I want to buy shares', ACCOUNTS)?.id;
  const ok = sell === 'place-sale' && buy === 'place-purchase';
  if (ok) { passed++; console.log('  ✓ sell → place-sale, buy → place-purchase'); }
  else { failed++; console.log(`  ✗ sell=${sell} buy=${buy}`); }
});

group('Nothing to suggest stays null', () => {
  for (const msg of ['connect me', 'thanks!', 'How are you today?', 'ok']) {
    const got = matchTaskByIntent(msg, ACCOUNTS)?.id ?? null;
    if (got === null) { passed++; console.log(`  ✓ "${msg}" → no task`); }
    else { failed++; console.log(`  ✗ "${msg}" → ${got} (expected none)`); }
  }
});

rmSync(outDir, { recursive: true, force: true });
console.log(`\n${failed === 0 ? '✓ PASS' : '✗ FAIL'} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
