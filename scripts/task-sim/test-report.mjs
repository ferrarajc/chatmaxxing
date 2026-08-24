/**
 * Renders the report from a synthetic run — offline, no network, no LLM, no cost.
 *
 * The fixture is built from REAL transcripts and REAL bugs from this week, and it
 * deliberately contains one of every severity so the visual separation between a
 * deterministic failure and an advisory note can actually be looked at.
 *
 * This also guards the two contractual promises: the report says nothing was changed,
 * and no recommendation is machine-written.
 *
 * Usage:
 *   node scripts/task-sim/test-report.mjs        # writes runs/_fixture/report.html
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderReport } from './src/report.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

let passed = 0, failed = 0;
const check = (l, ok, d = '') => {
  if (ok) { passed++; console.log(`  ✓ ${l}`); } else { failed++; console.log(`  ✗ ${l}${d ? `  — ${d}` : ''}`); }
};

const goal = {
  taskId: 'place-sale', taskName: 'Sell Fund Shares',
  clientId: 'demo-client-003', clientName: 'Jordan Williams',
  account: { id: 'acc-302', type: 'Taxable Account', balance: 4800, cash: 877 },
  position: { accountId: 'acc-302', ticker: 'BFESG', shares: 25, value: 3923 },
  fields: [
    { key: 'accountId', label: 'Account', value: 'acc-302' },
    { key: 'fund', label: 'Fund to sell', value: 'BFESG' },
    { key: 'amount', label: 'Amount or shares', value: '$1,000' },
  ],
  byKey: { accountId: 'acc-302', fund: 'BFESG', amount: '$1,000' },
};

// Sim 1 — a clean run, exactly as prod behaved after this week's fixes.
const clean = {
  simIndex: 0, goal, verdict: 'pass', failedCount: 0,
  clientView: [
    { i: 0, role: 'you', text: "I'd like to sell some shares I hold" },
    { i: 1, role: 'agent', text: 'Sure, I can take care of that for you. Which account would you like to sell from?' },
    { i: 2, role: 'you', text: 'The taxable account' },
    { i: 3, role: 'agent', text: 'The only fund you hold in your Taxable Account is BobsFunds ESG Leaders (BFESG). How much would you like to sell?' },
    { i: 4, role: 'you', text: '$1,000 please' },
    { i: 5, role: 'agent', text: 'Confirmation\nRef: REF-ABC123\n\nSale of $1,000 of BFESG from Jordan Williams\'s Taxable Account' },
  ],
  agentView: [{ turnIndex: 1, raw: { exitMessage: null, suggestedScope: null, taskIdentified: 'place-sale' } }],
  proposedAction: { taskId: 'place-sale', summary: "Sale of $1,000 of BFESG from Jordan Williams's Taxable Account",
    fields: [{ key: 'accountId', value: 'acc-302' }, { key: 'fund', value: 'BFESG' }, { key: 'amount', value: '$1,000' }] },
  execResult: { success: true, message: 'Sale order placed', referenceNumber: 'REF-ABC123' },
  assertions: [
    { id: 'VALUE_MATCHES:accountId', ok: true }, { id: 'VALUE_MATCHES:fund', ok: true },
    { id: 'VALUE_MATCHES:amount', ok: true },
  ],
  ledgerChecks: [{ label: 'proceeds landed in cash', ok: true, detail: 'cash +1000' }],
  findings: [], judgeAnnotations: [], actionTurnIndex: 5,
  diff: { accounts: [{ id: 'acc-302', type: 'Taxable Account', dBalance: 0, dCash: 1000 }],
          holdings: [{ ticker: 'BFESG', accountId: 'acc-302', dShares: -6.4, dValue: -1000 }], dTotalBalance: 0 },
};

// Sim 2 — every failure mode this week produced, in one transcript.
const broken = {
  simIndex: 1, goal, verdict: 'fail', failedCount: 4,
  clientView: [
    { i: 0, role: 'you', text: "I'd like to sell some shares I hold into cash" },
    { i: 1, role: 'agent', text: 'Which fund would you like to sell? Here are your options: BF500, BFGR, BFBI, BFIN, BFESG, BFST, BFTM, BFLCV, BFTEC' },
    { i: 2, role: 'you', text: "Wait, what? You're saying that I hold all of those funds?" },
    { i: 3, role: 'agent', text: 'You have $4,800 available in cash in your Taxable Account.' },
    { i: 4, role: 'you', text: 'Sell $1,000 of the ESG one' },
    { i: 5, role: 'agent', text: "Great, I'll proceed with that. All fields collected — proposed action is ready for review." },
    { i: 6, role: 'agent', text: 'Confirmation\nRef: REF-XYZ999\n\nSelled $1,000 of BFESG' },
  ],
  agentView: [{ turnIndex: 1, raw: { exitMessage: 'All fields collected', taskIdentified: 'place-sale' } }],
  proposedAction: { taskId: 'place-sale', summary: 'Selled $1,000 of BFESG',
    fields: [{ key: 'accountId', value: 'Taxable Account (acc-302)' }, { key: 'fund', value: 'BFESG' }, { key: 'amount', value: '$1,000' }] },
  execResult: { success: true, message: 'Sale order placed', referenceNumber: 'REF-XYZ999' },
  assertions: [
    { id: 'VALUE_MATCHES:accountId', ok: true },
    { id: 'SUMMARY_IS_NOUN_PHRASE', ok: false, message: 'The summary must be a noun phrase.', detail: 'starts with "Selled"' },
  ],
  ledgerChecks: [{ label: 'proceeds landed in cash', ok: false, detail: 'cash 0' }],
  findings: [
    { code: 'OFFERED_UNHELD_FUND', severity: 'fail', turnIndex: 1, message: 'Offered 8 funds the client does not hold in acc-302.', source: 'deterministic' },
    { code: 'CASH_MISSTATED', severity: 'fail', turnIndex: 3, message: 'Told the client $4,800 is cash. Their actual cash is $877.', source: 'deterministic' },
    { code: 'INTERNAL_STATUS_LEAK', severity: 'fail', turnIndex: 5, message: 'Agent-facing status reached the client.', source: 'deterministic' },
    { code: 'INVENTED_PAST_TENSE', severity: 'fail', turnIndex: 6, message: '"Selled" is not a word.', source: 'deterministic' },
    { code: 'SUCCESS_BUT_NOTHING_WROTE', severity: 'fail', turnIndex: 6, message: 'execute-task reported success but the client record did not change.', source: 'deterministic' },
    { code: 'TURN_BLOWOUT', severity: 'warn', turnIndex: 5, message: 'Took 4 agent turns to collect 3 fields.', source: 'deterministic' },
  ],
  judgeAnnotations: [
    { code: 'IGNORED_WHAT_CLIENT_SAID', severity: 'advisory', turnIndex: 3, noteId: 'J1', confidence: 'high',
      message: 'The client asked whether she held all those funds and the agent answered about cash instead.', source: 'advisory' },
  ],
  actionTurnIndex: 6,
  diff: { accounts: [], holdings: [], dTotalBalance: 0 },
};

// Sim 3 — rate-limited: infrastructure, not a product defect.
const throttled = {
  simIndex: 2, goal, verdict: 'inconclusive', failedCount: 0,
  clientView: [
    { i: 0, role: 'you', text: "I'd like to sell some shares" },
    { i: 1, role: 'agent', text: "I'm pulling some information, give me just a few moments please." },
  ],
  agentView: [], proposedAction: null, execResult: null,
  assertions: [{ id: 'PROPOSED_ACTION_PRESENT', ok: false, message: 'The expert never produced a proposed action.' }],
  ledgerChecks: [],
  findings: [{ code: 'HOLDING_REPLY', severity: 'inconclusive', turnIndex: 1,
    message: 'The expert returned a catch-path holding reply — the LLM call failed (usually a 429).', source: 'deterministic' }],
  judgeAnnotations: [], actionTurnIndex: null,
};

const run = {
  taskId: 'place-sale', taskName: 'Sell Fund Shares',
  apiBase: 'https://1cppcq9q57.execute-api.us-east-1.amazonaws.com',
  seed: 12345, startedAt: new Date().toISOString(),
  sims: [clean, broken, throttled],
};

const html = renderReport(run);
const dir = path.join(HERE, 'runs', '_fixture');
mkdirSync(dir, { recursive: true });
const out = path.join(dir, 'report.html');
writeFileSync(out, html);

console.log('\nReport renderer\n');
check('produces a self-contained document', html.startsWith('<!doctype html>'));
check('no external requests (no src=/href= to a CDN)', !/https?:\/\/(?!localhost)[^"']*\.(js|css)/.test(html));
check('states plainly that nothing was changed', /never edits code, prompts, or data/i.test(html));
check('every recommendation is marked as such', /Recommendation only — nothing has been applied/.test(html));
check('renders the full transcript, not a snippet',
  html.includes('You&#039;re saying that I hold all of those funds?') || html.includes("You're saying that I hold all of those funds?"));
check('shows the clean run too', html.includes('The only fund you hold in your Taxable Account'));
check('deterministic failures are labelled FAIL', /FAIL · INTERNAL_STATUS_LEAK/.test(html));
check('advisory notes are labelled ADVISORY', /ADVISORY · IGNORED_WHAT_CLIENT_SAID/.test(html));
check('rate limiting reads as INFRA, not a failure', /INFRA · HOLDING_REPLY/.test(html));
check('the ledger diff is rendered', /Δ balance/.test(html));
check('agent-only material is separated and labelled',
  /Agent-only view — the client never saw this/.test(html));
check('the run summary groups by code', /Problems found/.test(html));
check('static fix guidance appears', /Where it lives/.test(html));
check('verdict counts are right', /1 passed/.test(html) && /1 failed/.test(html) && /1 inconclusive/.test(html));

console.log(`\n  wrote ${out}`);
console.log(`\n${failed === 0 ? '✓ PASS' : '✗ FAIL'} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
