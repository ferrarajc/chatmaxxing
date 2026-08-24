/**
 * Unit test for the deterministic detectors — offline, no network, no LLM, no cost.
 *
 * The fixtures are REAL transcript excerpts from this week's chats, so each detector is
 * proven against the bug it was written for. A detector nobody has watched fire is not a
 * detector; it is a comment.
 *
 * Equally important is the second half: the things that must NOT fire. The cross-sell
 * and the multi-task chat are features John explicitly values, and a naive off-list or
 * turn-count rule flags both.
 *
 * Usage:
 *   node scripts/task-sim/test-detect.mjs
 */

import { detect } from './src/detect.mjs';

let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {
  if (ok) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}${detail ? `  — ${detail}` : ''}`); }
};
const group = (n, fn) => { console.log(`\n${n}`); return fn(); };

// Jordan Williams, as seeded.
const SNAPSHOT = {
  clientId: 'demo-client-003', name: 'Jordan Williams', totalBalance: 23300,
  accounts: [
    { id: 'acc-301', type: 'Roth IRA', balance: 18500, cash: 202 },
    { id: 'acc-302', type: 'Taxable Account', balance: 4800, cash: 877 },
  ],
  holdings: [
    { accountId: 'acc-301', ticker: 'BF500', shares: 61.6, price: 218.40, value: 13453 },
    { accountId: 'acc-301', ticker: 'BFGR', shares: 14.2, price: 341.20, value: 4845 },
    { accountId: 'acc-302', ticker: 'BFESG', shares: 25, price: 156.90, value: 3923 },
  ],
};

const GOAL = {
  taskId: 'place-sale', clientId: 'demo-client-003',
  account: SNAPSHOT.accounts[1], position: SNAPSHOT.holdings[2],
  fields: [
    { key: 'accountId', label: 'Account', value: 'acc-302' },
    { key: 'fund', label: 'Fund to sell', value: 'BFESG' },
    { key: 'amount', label: 'Amount or shares', value: '$1,000' },
  ],
};
const TASK_FIELDS = [
  { key: 'accountId', label: 'Account', question: 'Which account would you like to sell from?' },
  { key: 'fund', label: 'Fund to sell', question: 'Which fund would you like to sell?' },
  { key: 'amount', label: 'Amount or shares', question: 'How much would you like to sell in dollars?' },
];

const view = (...turns) => turns.map((t, i) => ({ i, ...t }));
const run = async (clientView, extra = {}) =>
  detect({ clientView, goal: GOAL, snapshot: SNAPSHOT, taskFields: TASK_FIELDS, ...extra });
const codes = f => f.map(x => x.code);

await group('D1 — internal status reaching the client (real leak, 2026-08-22)', async () => {
  const f = await run(view(
    { role: 'you', text: "Let's use the available cash in the account" },
    { role: 'agent', text: "Great, I'll proceed with that. All fields collected — proposed action is ready for review." },
  ));
  check('flags the leak', codes(f).includes('INTERNAL_STATUS_LEAK'));
  check('as a failure', f.find(x => x.code === 'INTERNAL_STATUS_LEAK')?.severity === 'fail');
});

await group('D6 — invented past tense (shipped to a client)', async () => {
  for (const bad of ['Selled $1,000 of BFESG', 'Withdrawed $500 from your account', 'Sended your 1099']) {
    const f = await run(view({ role: 'agent', text: bad }));
    check(`flags "${bad.split(' ')[0]}"`, codes(f).includes('INVENTED_PAST_TENSE'));
  }
  const ok = await run(view({ role: 'agent', text: 'Sale of $1,000 of BFESG from your Taxable Account' }));
  check('noun phrase is clean', !codes(ok).includes('INVENTED_PAST_TENSE'));
});

await group('D3 — the 36-fund list (real, 2026-08-23)', async () => {
  const dump = 'Which fund would you like to sell? Here are your options: BF500, BFGR, BFBI, BFIN, ' +
               'BFESG, BFST, BFTM, BFLCV, BFMC, BFTEC, BFHLT, BFENE';
  const f = await run(view({ role: 'agent', text: dump }));
  const hit = f.find(x => x.code === 'OFFERED_UNHELD_FUND');
  check('flags the catalogue dump', !!hit);
  check('as a failure (>=4 unheld)', hit?.severity === 'fail', hit?.severity);
  const good = await run(view({ role: 'agent',
    text: 'The only fund you hold in your Taxable Account is BobsFunds ESG Leaders (BFESG).' }));
  check('naming only the held fund is clean', !codes(good).includes('OFFERED_UNHELD_FUND'));
});

await group('D16 — the $4,800 "held in cash" (the original bug, 2026-08-21)', async () => {
  // NOTE this is NOT an invented number — $4,800 is the account's real total. It was
  // described as cash when the cash was $877. A mislabel, not a fabrication, which is
  // why the ungrounded-figure detector structurally cannot see it.
  const f = await run(view({ role: 'agent', text: 'You have $4,800 available in cash in your Taxable Account.' }));
  check('flags the mislabelled figure', codes(f).includes('CASH_MISSTATED'));
  check('as a failure', f.find(x => x.code === 'CASH_MISSTATED')?.severity === 'fail');
  check('and NOT as ungrounded — 4,800 is a real number', !codes(f).includes('UNGROUNDED_FIGURE'));

  const ok = await run(view({ role: 'agent', text: 'You have $877 available in cash in your Taxable Account.' }));
  check('the true cash figure is clean', !codes(ok).includes('CASH_MISSTATED'));

  // A refusal message legitimately names both the cash and the (larger) requested sum.
  const refusal = await run(view({ role: 'agent',
    text: 'That account has $877.00 in cash — not enough for a $4,800.00 purchase. You can fund it from the linked bank account instead, sell holdings to raise cash, or purchase up to $877.00 from cash.' }));
  check('the insufficient-cash refusal is clean', !codes(refusal).includes('CASH_MISSTATED'),
    'the window between amount and "cash" is too wide');
});

await group('D12 — genuinely invented figures', async () => {
  const f = await run(view({ role: 'agent', text: 'Your account has grown to $61,432 this year.' }));
  check('flags a figure matching nothing in the record', codes(f).includes('UNGROUNDED_FIGURE'));
  const ok = await run(view({ role: 'agent', text: 'That position is worth $3,923.' }));
  check('a real holding value is grounded', !codes(ok).includes('UNGROUNDED_FIGURE'));
  const ok2 = await run(view({ role: 'agent', text: 'Your Taxable Account totals $4,800.' }));
  check('a real balance is grounded', !codes(ok2).includes('UNGROUNDED_FIGURE'));
});

await group('D2 / D5 / D14', async () => {
  check('empty message', codes(await run(view({ role: 'agent', text: '' }))).includes('EMPTY_CLIENT_TURN'));
  check('banned detail', codes(await run(view({ role: 'agent',
    text: 'Could you confirm your Social Security number?' }))).includes('ASKED_BANNED_DETAIL'));
  const dup = await run(view(
    { role: 'agent', text: 'Which fund would you like to sell?' },
    { role: 'you', text: 'the ESG one' },
    { role: 'agent', text: 'Which fund would you like to sell?' },
  ));
  check('duplicate agent message', codes(dup).includes('DUPLICATE_AGENT_MESSAGE'));
});

await group('D11 — a rate-limited turn is INCONCLUSIVE, never a product failure', async () => {
  const f = await run(view({ role: 'agent', text: "I'm pulling some information, give me just a few moments please." }));
  const hit = f.find(x => x.code === 'HOLDING_REPLY');
  check('flags the holding reply', !!hit);
  check('severity is inconclusive, not fail', hit?.severity === 'inconclusive', hit?.severity);
});

await group('D4 — re-asking, but a recap is legitimate', async () => {
  // An UNAMBIGUOUS re-ask: both earlier fields are answered, and the only field still
  // outstanding (amount) matches this sentence far worse than the one being repeated.
  // The earlier version of this fixture said "…sell from that account?", which honestly
  // reads as asking about the still-unanswered account — the detector was right to stay
  // quiet on it, and the fixture was the thing at fault.
  const reask = await run(view(
    { role: 'agent', text: 'Which account would you like to sell from?' },
    { role: 'you', text: 'the taxable one, acc-302' },
    { role: 'agent', text: 'Which fund would you like to sell?' },
    { role: 'you', text: 'BFESG' },
    { role: 'agent', text: 'Sorry, which fund did you want to sell?' },
  ));
  check('flags a genuine re-ask', codes(reask).includes('REASKED_ANSWERED_FIELD'),
    codes(reask).join(', ') || 'nothing flagged');

  const recap = await run(view(
    { role: 'agent', text: 'Which fund would you like to sell?' },
    { role: 'you', text: 'BFESG' },
    { role: 'agent', text: 'Before I proceed, just to confirm: sell $1,000 of BFESG. Is that correct?' },
  ));
  check('a recap is NOT a re-ask', !codes(recap).includes('REASKED_ANSWERED_FIELD'));

  // Verbatim from the FIRST LIVE RUN, which flagged both of these. A task's field
  // questions are nearly the same sentence, so raw token overlap fires everywhere:
  // asking about the FUND scored 0.83 against the ACCOUNT question on filler words alone.
  const live = await run(view(
    { role: 'you', text: "I'd like to sell some shares I hold" },
    { role: 'agent', text: 'Sure, I can help with that. Which account would you like to sell from: your Roth IRA, Traditional IRA, or Taxable Account?' },
    { role: 'you', text: "I'd like to sell from my Traditional IRA, account acc-302." },
    { role: 'agent', text: 'Which fund would you like to sell from in your Traditional IRA? You have the following options: BFESG' },
    { role: 'you', text: 'I would like to sell the BFESG.' },
    { role: 'agent', text: 'How much would you like to sell from the BobsFunds ESG Leaders (BFESG) fund?' },
    { role: 'you', text: 'I would like to sell $1,000 of BFESG.' },
  ));
  check('asking about the FUND is not "re-asking the account"',
    !codes(live).includes('REASKED_ANSWERED_FIELD'), codes(live).join(', '));
});

// ── The half that matters most: what must NOT fire ──────────────────────────
await group('The prod cross-sell (transcript b5bfaaf4) is a FEATURE, not a finding', async () => {
  const crossSell = await run(view(
    { role: 'you', text: 'Great thank you!' },
    { role: 'agent', text: 'If you\'re considering future investments, you might want to explore setting up a systematic investment plan for regular contributions. Would you like more information on that?' },
    { role: 'you', text: 'Sure' },
    { role: 'agent', text: 'A systematic investment plan allows you to invest a fixed amount regularly. Would you like to set up a plan now?' },
    { role: 'you', text: "Sure let's set one up" },
  ));
  const bad = crossSell.filter(x => x.severity === 'fail');
  check('nothing fails on a cross-sell', bad.length === 0, codes(bad).join(','));
  check('not flagged as a re-ask', !codes(crossSell).includes('REASKED_ANSWERED_FIELD'));

  // A chat that runs two tasks is valid and must not trip the turn budget, which only
  // counts turns up to the proposed action.
  const long = view(
    ...Array.from({ length: 14 }, (_, k) => ({ role: k % 2 ? 'you' : 'agent', text: `turn ${k}` })),
  );
  const f = await run(long, { actionTurnIndex: 4 });
  check('turn budget measured to the action, not to end of chat',
    !codes(f).includes('TURN_BLOWOUT'), 'a multi-task chat was penalised');
});

await group('A clean transcript produces no findings at all', async () => {
  const f = await run(view(
    { role: 'you', text: "I'd like to sell some shares I hold into cash" },
    { role: 'agent', text: 'Sure, I can take care of that. Which account would you like to sell from?' },
    { role: 'you', text: 'The taxable account' },
    { role: 'agent', text: 'The only fund you hold there is BobsFunds ESG Leaders (BFESG). How much would you like to sell?' },
    { role: 'you', text: '$1,000 please' },
    { role: 'agent', text: 'Before I proceed, just to confirm: sell $1,000 of BFESG from your Taxable Account. Is that correct?' },
    { role: 'you', text: 'Yes' },
    { role: 'agent', text: 'Confirmation\nRef: REF-ABC123\n\nSale of $1,000 of BFESG from Jordan Williams\'s Taxable Account' },
  ), { actionTurnIndex: 7 });
  check('no findings', f.length === 0, codes(f).join(', '));
});

console.log(`\n${failed === 0 ? '✓ PASS' : '✗ FAIL'} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
