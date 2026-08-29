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

// The whole resolver, not just the matcher — the ORDER (advice, then latest message,
// then the whole customer side, then the trade fallback) is the part that was wrong.
const ssDir = mkdtempSync(path.join(tmpdir(), 'suggest-scope-'));
const ssFile = path.join(ssDir, 'suggest-scope.mjs');
execFileSync('npx', ['esbuild', path.join(__dirname, '..', 'shared', 'suggest-scope.ts'), '--bundle', '--platform=node', '--format=esm', `--outfile=${ssFile}`, '--log-level=error'], {
  cwd: path.join(__dirname, '..', '..'), shell: process.platform === 'win32', stdio: 'inherit',
});
const { resolveSuggestion } = await import(pathToFileURL(ssFile).href);
const C = (content) => ({ role: 'CUSTOMER', content });
const A = (content) => ({ role: 'AGENT', content });
const B = (content) => ({ role: 'BOT', content });

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

// ── resolveSuggestion: the ✈ label the agent actually sees ──────────────────────
//
// THE BUG THIS LOCKS DOWN: the agent app hardcoded a bare 'get-intent' with no task when
// a contact was accepted, and the code that would attach the task only ran on a LIVE
// customer message. "I'd like to buy a fund" is said BEFORE escalation, so it never
// triggered — the agent was shown "Get intent" on the least ambiguous intent there is.
// This transcript is that exact conversation.
group('The buy intent survives the greeting exchange', () => {
  const screenshot = [
    C("I'd like to buy a fund"),
    B("Trades can't be processed through chat..."),
    C('connect me'),
    B("I'd be happy to connect you with a live agent."),
    A("Hi Alex, my name is John Ferrara with Bob's Mutual Funds..."),
    C("That's right"),
  ];
  for (const [label, tr] of [
    ['at accept, before any live message', screenshot.slice(0, 4)],
    ['after the greeting is answered', screenshot],
    ['the opening line alone', [screenshot[0]]],
  ]) {
    const got = resolveSuggestion(tr, ACCOUNTS, null);
    const ok = got.suggestedScope === 'get-intent' && got.suggestedTaskId === 'place-purchase';
    if (ok) { passed++; console.log(`  ✓ ${label} → place-purchase`); }
    else { failed++; console.log(`  ✗ ${label} → ${JSON.stringify(got)}`); }
  }

  // The last message is "That's right", which matches nothing on its own. Proving the
  // whole-conversation fallback is what carries it.
  const alone = matchTaskByIntent("That's right", ACCOUNTS)?.id ?? null;
  if (alone === null) { passed++; console.log('  ✓ "That’s right" alone matches nothing (so the fallback is load-bearing)'); }
  else { failed++; console.log(`  ✗ "That's right" matched ${alone}`); }
});

group('Advice outranks a task match, and a scope never carries a stale task', () => {
  const advice = resolveSuggestion([C("I'd like to buy a fund"), C('which fund is best for me?')], ACCOUNTS, null);
  const ok = advice.suggestedScope === 'callback' && advice.suggestedTaskId === null;
  if (ok) { passed++; console.log('  ✓ advice → callback with NO task attached'); }
  else { failed++; console.log(`  ✗ advice → ${JSON.stringify(advice)}`); }

  // Nothing deterministic: keep the LLM's scope, attach no task.
  const vague = resolveSuggestion([C('hello there')], ACCOUNTS, 'get-intent');
  const ok2 = vague.suggestedScope === 'get-intent' && vague.suggestedTaskId === null;
  if (ok2) { passed++; console.log('  ✓ unmatchable → LLM scope kept, task null'); }
  else { failed++; console.log(`  ✗ unmatchable → ${JSON.stringify(vague)}`); }
});

rmSync(ssDir, { recursive: true, force: true });
rmSync(outDir, { recursive: true, force: true });
console.log(`\n${failed === 0 ? '✓ PASS' : '✗ FAIL'} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
