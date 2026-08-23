/**
 * Unit test for stripInternalStatus() in lambda/shared/reply-hygiene.ts.
 *
 * Offline — no network, no AWS, no LLM.
 *
 * WHY THIS EXISTS: `response` goes verbatim to the CLIENT; `exitMessage` is written for
 * the human agent ("All fields collected — proposed action is ready for review."). A
 * task expert appended its exitMessage to the response, so mid-purchase a client was
 * told:
 *
 *   "Great, I'll proceed with that. All fields collected — proposed action is ready
 *    for review."
 *
 * The first sentence is fine. The second exposes internal machinery the client has no
 * idea exists. The prompt now separates the two audiences explicitly, but a prompt is a
 * suggestion — this is the rule.
 *
 * Note the shape of the fix: it is SENTENCE-granular, because the surrounding reply is
 * almost always good and only the bookkeeping clause has to go.
 *
 * Usage:
 *   node lambda/tests/test-strip-internal-status.mjs
 */

import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'shared', 'reply-hygiene.ts');

const outDir = mkdtempSync(path.join(tmpdir(), 'strip-status-'));
const outFile = path.join(outDir, 'reply-hygiene.mjs');
execFileSync('npx', ['esbuild', SRC, '--bundle', '--platform=node', '--format=esm',
  `--outfile=${outFile}`, '--log-level=error'], {
  cwd: path.join(__dirname, '..', '..'),
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

const { stripInternalStatus } = await import(pathToFileURL(outFile).href);

let passed = 0, failed = 0;
function eq(label, got, want) {
  if (got === want) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`); }
}
function group(name, fn) { console.log(`\n${name}`); fn(); }

const EXIT = 'All fields collected — proposed action is ready for review.';

group('The exact leak a client saw', () => {
  eq('drops the bookkeeping sentence, keeps the human one',
    stripInternalStatus("Great, I'll proceed with that. " + EXIT, EXIT),
    "Great, I'll proceed with that.");
  eq('also works when exitMessage was not passed',
    stripInternalStatus("Great, I'll proceed with that. " + EXIT, null),
    "Great, I'll proceed with that.");
});

group('Other internal phrasings', () => {
  eq('proposed action',
    stripInternalStatus("I'm setting that up now. The proposed action is ready for review.", null),
    "I'm setting that up now.");
  eq('autopilot',
    stripInternalStatus('One moment. Autopilot is handing back control to the agent.', null),
    'One moment.');
  eq('all required fields gathered',
    stripInternalStatus('Thanks! All required fields are gathered.', null),
    'Thanks!');
  eq('trailing em-dash left by a removal is tidied',
    stripInternalStatus('Setting that up for you now —', null),
    'Setting that up for you now');
});

group('Normal replies are untouched', () => {
  const keep = [
    "You have $877 available in cash in your Taxable Account. Would you like to use that, or fund it from your linked bank account?",
    'In your Taxable Account, you currently hold shares of BobsFunds ESG Leaders (BFESG).',
    "Sure, I can take care of that for you. Which account would you like to purchase into?",
    'I hope you have a great day, Jordan!',
    // "review" only trips on the internal phrase, not the ordinary word.
    'I can send you a statement to review at your convenience.',
    // A client legitimately talking about fields/action must survive too.
    'That fund is in the Fixed Income group.',
  ];
  for (const k of keep) eq(`unchanged: "${k.slice(0, 46)}..."`, stripInternalStatus(k, EXIT), k);
});

group('Edge cases', () => {
  eq('empty in, empty out', stripInternalStatus('', EXIT), '');
  eq('whitespace only', stripInternalStatus('   ', EXIT), '');
  eq('response that is ONLY the internal sentence collapses to empty',
    stripInternalStatus(EXIT, EXIT), '');
  eq('undefined response', stripInternalStatus(undefined, EXIT), '');
});

rmSync(outDir, { recursive: true, force: true });
console.log(`\n${failed === 0 ? '✓ PASS' : '✗ FAIL'} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
