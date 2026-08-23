/**
 * Guards the proposed-action SUMMARY style, in the prompts themselves.
 *
 * Offline — no network, no AWS, no LLM. Reads the prompt source directly, because the
 * thing being protected IS the template text.
 *
 * WHY THIS EXISTS: the agent app used to run every summary through a hand-rolled
 * toPastTense() so the client's confirmation read "Granted …" instead of "Grant …".
 * Its lookup held 14 verbs and otherwise guessed `endsWith('e') ? +'d' : +'ed'`, so
 * three verbs actually in use produced invented words IN MESSAGES SENT TO CLIENTS:
 *
 *     Sell     → "Selled"       (Sold)
 *     Withdraw → "Withdrawed"   (Withdrew)
 *     Send     → "Sended"       (Sent)
 *
 * Adding those three would not have fixed the class — the next new verb breaks it
 * again. So the conjugation was deleted and the summaries became NOUN PHRASES, which
 * read correctly both on the card (before submission) and in the confirmation (after).
 *
 * This test keeps it that way: a verb-leading template sneaking back in would silently
 * restore imperative confirmations.
 *
 * Usage:
 *   node lambda/tests/test-summary-style.mjs
 */

import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(__dirname, '..', 'autopilot-turn', 'handler.ts'), 'utf8');
const AGENT = readFileSync(
  path.join(__dirname, '..', '..', 'agent-app', 'src', 'utils', 'submitProposedAction.ts'), 'utf8');

let passed = 0, failed = 0;
function check(label, ok, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}${detail ? `\n      ${detail}` : ''}`); }
}
function group(name, fn) { console.log(`\n${name}`); fn(); }

// Imperative verbs that have appeared at the head of these templates. Any of them
// leading a summary means the confirmation will read as a command, and (if the
// conjugation ever returns) risks an invented past tense.
const LEADING_VERBS = /^(Sell|Buy|Purchase|Withdraw|Send|Grant|Update|Remove|Open|Exchange|Invest|Convert|Cancel|Reschedule|Roll|Set|Add|Change|Transfer|Enable|Disable|Replace|Modify|Close|Schedule|Pause|Resume)\b/;

const summaries = [...SRC.matchAll(/"summary":\s*"((?:[^"\\]|\\.)*)"/g)].map(m => m[1]);

group('Every summary template is a noun phrase', () => {
  check(`found the templates (${summaries.length})`, summaries.length >= 20, `got ${summaries.length}`);
  for (const s of summaries) {
    // Strip a leading [Bracketed / Placeholder] so "[Pause / Resumption] of …" is judged
    // on its real first word.
    const head = s.replace(/^\[[^\]]*\]\s*/, '').replace(/^\$\{[^}]*\}\s*/, '');

    // Several words are both verb and noun — "Purchase", "Exchange", "Update". What
    // settles it is what follows: "Purchase of $800" is a noun phrase, "Purchase $800"
    // is a command. So a leading word is fine when it is followed by "of".
    const nounUse = /^\w+\s+of\s/.test(head);

    check(`noun phrase: "${s.slice(0, 58)}${s.length > 58 ? '…' : ''}"`,
      nounUse || !LEADING_VERBS.test(head), `starts with a verb: "${head.split(' ')[0]}"`);
  }
});

group('The conjugation is gone for good', () => {
  check('toPastTense() is not defined any more', !/export function toPastTense/.test(AGENT));
  check('PAST_TENSE lookup is gone', !/const PAST_TENSE/.test(AGENT));
  check('the confirmation uses the summary verbatim', /const description = action\.summary;/.test(AGENT));
});

group('The style rule is in the shared instruction', () => {
  check('prompts tell the model to write a noun phrase', /NOUN PHRASE naming the action/.test(SRC));
  check('...and explicitly not to start with a verb', /NEVER start it with a verb/.test(SRC));
});

console.log(`\n${failed === 0 ? '✓ PASS' : '✗ FAIL'} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
