/**
 * Unit test for lambda/shared/account-math.ts AND the seed data's balance invariant.
 *
 * Offline — no network, no AWS. Bundled with esbuild like test-contribution-limits.mjs.
 *
 * WHY THIS EXISTS: there was no cash field at all. `account.balance` and the holdings
 * array were authored independently, so the residual between them was meaningless —
 * positive in six accounts and NEGATIVE in four. A task expert handed $4,800 by
 * get_accounts and $3,923 by get_holdings, with nothing anywhere relating the two,
 * reported $4,800 of CASH plus $3,923 of holdings. A client was told she had money that
 * did not exist.
 *
 * The invariant block at the bottom is the important half. Nothing in lambda/tests
 * previously asserted that an execute-task balance mutation was correct, which is how
 * "a sale destroys money" survived in the codebase.
 *
 * Usage:
 *   node lambda/tests/test-account-math.mjs
 */

import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

function bundle(srcRel, name) {
  const outDir = mkdtempSync(path.join(tmpdir(), `${name}-`));
  const outFile = path.join(outDir, `${name}.mjs`);
  execFileSync('npx', ['esbuild', path.join(ROOT, srcRel), '--bundle', '--platform=node', '--format=esm', `--outfile=${outFile}`, '--log-level=error'], {
    cwd: ROOT, shell: process.platform === 'win32', stdio: 'inherit',
  });
  return { outFile, outDir };
}

const am = bundle('lambda/shared/account-math.ts', 'account-math');
const cd = bundle('lambda/shared/client-defaults.ts', 'client-defaults');

const {
  holdingValue, investedValue, cashOf, accountBalance,
  recomputeAccounts, portfolioTotal, applyCashDelta, transferValue,
} = await import(pathToFileURL(am.outFile).href);

// Importing this at all exercises the load-time invariant in client-defaults.ts, which
// THROWS on drifting seed data. If the seed is wrong this test fails at import.
const { DEFAULT_CLIENT_DATA } = await import(pathToFileURL(cd.outFile).href);

let passed = 0, failed = 0;
function check(label, ok, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}${detail ? `  — ${detail}` : ''}`); }
}
function group(name, fn) { console.log(`\n${name}`); fn(); }

// Jordan's taxable account — the one from the reported conversation.
const HOLDINGS = [
  { accountId: 'acc-302', shares: 25.0, price: 156.90, value: 3923 },
  { accountId: 'acc-301', shares: 61.6, price: 218.40, value: 13453 },
];
const TAXABLE = { id: 'acc-302', type: 'Taxable Account', balance: 4800, cash: 877 };

group('The reported account: $4,800 total = $3,923 invested + $877 cash', () => {
  check('investedValue is 3923', investedValue(HOLDINGS, 'acc-302') === 3923, String(investedValue(HOLDINGS, 'acc-302')));
  check('cashOf is 877 — NOT 4800', cashOf(TAXABLE, HOLDINGS) === 877, String(cashOf(TAXABLE, HOLDINGS)));
  check('accountBalance reconstructs 4800', accountBalance(TAXABLE, HOLDINGS) === 4800, String(accountBalance(TAXABLE, HOLDINGS)));
  check('cash + invested === balance', cashOf(TAXABLE, HOLDINGS) + investedValue(HOLDINGS, 'acc-302') === TAXABLE.balance);
});

group('holdingValue — one rounding rule', () => {
  check('25 x 156.90 = 3923 (rounds .5 up)', holdingValue(25, 156.90) === 3923, String(holdingValue(25, 156.90)));
  check('142.3 x 218.40 = 31078, not the 31072 that was seeded', holdingValue(142.3, 218.40) === 31078, String(holdingValue(142.3, 218.40)));
});

group('cashOf — migration fallback for records written before `cash` existed', () => {
  const legacy = { id: 'acc-302', type: 'Taxable Account', balance: 4800 };  // no cash key
  check('falls back to balance - invested', cashOf(legacy, HOLDINGS) === 877, String(cashOf(legacy, HOLDINGS)));
  // Four seeded accounts used to have holdings worth MORE than their balance; a negative
  // "cash available" leaking into a prompt is the exact class of nonsense being removed.
  const underwater = { id: 'acc-301', type: 'Roth IRA', balance: 10000 };
  check('never returns negative', cashOf(underwater, HOLDINGS) === 0, String(cashOf(underwater, HOLDINGS)));
  const nanCash = { id: 'acc-302', type: 'Taxable Account', balance: 4800, cash: NaN };
  check('NaN cash falls back rather than propagating', cashOf(nanCash, HOLDINGS) === 877, String(cashOf(nanCash, HOLDINGS)));
});

group('recomputeAccounts / portfolioTotal', () => {
  const accts = [TAXABLE, { id: 'acc-301', type: 'Roth IRA', balance: 13655, cash: 202 }];
  const out = recomputeAccounts(accts, HOLDINGS);
  check('taxable balance stays 4800', out[0].balance === 4800, String(out[0].balance));
  check('roth balance = 202 + 13453 = 13655', out[1].balance === 13655, String(out[1].balance));
  check('portfolioTotal sums balances', portfolioTotal(out) === 18455, String(portfolioTotal(out)));
  check('idempotent', JSON.stringify(recomputeAccounts(out, HOLDINGS)) === JSON.stringify(out));
});

// ── The mutation semantics each task must obey ──────────────────────────────
group('Buy funded from CASH: cash down, total UNCHANGED', () => {
  const r = applyCashDelta([TAXABLE], HOLDINGS, 'acc-302', -500);
  check('allowed ($500 <= $877)', r.ok === true);
  check('cash 877 -> 377', r.accounts[0].cash === 377, String(r.accounts[0].cash));
  // Shares bought with that cash raise invested by the same $500, so the total holds.
  const after = [...HOLDINGS, { accountId: 'acc-302', shares: 3.187, price: 156.90, value: 500 }];
  check('total still 4800', accountBalance(r.accounts[0], after) === 4800, String(accountBalance(r.accounts[0], after)));
});

group('Insufficient cash is refused — the $4,800-from-$877 case', () => {
  const r = applyCashDelta([TAXABLE], HOLDINGS, 'acc-302', -4800);
  check('refused', r.ok === false);
  check('reports $877 available for the message', r.available === 877, String(r.available));
  check('accounts untouched', r.accounts[0].cash === 877);
});

group('Sale: proceeds become cash, total UNCHANGED (money stops vanishing)', () => {
  // Selling the whole $3,923 position: shares go, cash arrives.
  const r = applyCashDelta([TAXABLE], HOLDINGS, 'acc-302', +3923);
  check('cash 877 -> 4800', r.accounts[0].cash === 4800, String(r.accounts[0].cash));
  const noHoldings = HOLDINGS.filter(h => h.accountId !== 'acc-302');
  check('total STILL 4800 (it used to drop to 877)',
    accountBalance(r.accounts[0], noHoldings) === 4800, String(accountBalance(r.accounts[0], noHoldings)));
});

group('Withdrawal: cash down AND total down', () => {
  const r = applyCashDelta([TAXABLE], HOLDINGS, 'acc-302', -877);
  check('allowed for exactly the cash on hand', r.ok === true);
  check('cash -> 0', r.accounts[0].cash === 0, String(r.accounts[0].cash));
  check('total drops to the invested value', accountBalance(r.accounts[0], HOLDINGS) === 3923,
    String(accountBalance(r.accounts[0], HOLDINGS)));
  check('one cent more is refused', applyCashDelta([TAXABLE], HOLDINGS, 'acc-302', -877.01).ok === false);
});

group('applyCashDelta edge cases', () => {
  check('unknown account is refused', applyCashDelta([TAXABLE], HOLDINGS, 'acc-999', -1).ok === false);
  check('zero delta is allowed', applyCashDelta([TAXABLE], HOLDINGS, 'acc-302', 0).ok === true);
  check('other accounts are untouched',
    applyCashDelta([TAXABLE, { id: 'acc-301', type: 'Roth IRA', balance: 13655, cash: 202 }], HOLDINGS, 'acc-302', -100)
      .accounts[1].cash === 202);
});

// ── In-kind transfer (Roth conversion) ──────────────────────────────────────
// A conversion is an INTERNAL move at the same custodian, and converting in kind is
// standard — so it is capped by the source account's TOTAL value, not its cash.
// Capping it by cash broke the flagship "Roth conversion strategy" demo: Alex's
// Traditional IRA holds $128,450 but only $1,897 of it is cash.
group('transferValue — Roth conversion moves value, not just cash', () => {
  const accts = [
    { id: 'trad', type: 'Traditional IRA', balance: 128450, cash: 1897 },
    { id: 'roth', type: 'Roth IRA', balance: 45230, cash: 779 },
  ];
  const hold = [
    { accountId: 'trad', ticker: 'BFBI', name: 'Bond Income', shares: 1042.8, price: 98.30, value: 102507 },
    { accountId: 'trad', ticker: 'BFIN', name: 'International', shares: 274.5, price: 87.60, value: 24046 },
    { accountId: 'roth', ticker: 'BF500', name: '500 Index', shares: 103.7, price: 218.40, value: 22648 },
    { accountId: 'roth', ticker: 'BFGR', name: 'Growth', shares: 63.9, price: 341.20, value: 21803 },
  ];

  const r = transferValue(accts, hold, 'trad', 'roth', 50000);
  check('$50,000 conversion is ALLOWED (was refused when capped by cash)', r.ok === true);

  const tradAfter = r.accounts.find(a => a.id === 'trad');
  const rothAfter = r.accounts.find(a => a.id === 'roth');
  check('source drops by ~50,000', Math.abs(tradAfter.balance - 78450) <= 5, String(tradAfter.balance));
  check('destination rises by ~50,000', Math.abs(rothAfter.balance - 95230) <= 5, String(rothAfter.balance));
  check('portfolio total is preserved', Math.abs(portfolioTotal(r.accounts) - 173680) <= 5,
    String(portfolioTotal(r.accounts)));

  check('source cash fully used first (1897 -> 0)', tradAfter.cash === 0, String(tradAfter.cash));
  check('destination cash gained it (779 -> 2676)', rothAfter.cash === 2676, String(rothAfter.cash));

  // The remainder moved IN KIND — the Roth now holds the bond fund it did not before.
  const rothBFBI = r.holdings.find(h => h.accountId === 'roth' && h.ticker === 'BFBI');
  check('positions moved in kind (Roth now holds BFBI)', !!rothBFBI && rothBFBI.shares > 0,
    rothBFBI ? String(rothBFBI.shares) : 'absent');
  check('both accounts still satisfy balance = cash + invested',
    cashOf(tradAfter, r.holdings) + investedValue(r.holdings, 'trad') === tradAfter.balance &&
    cashOf(rothAfter, r.holdings) + investedValue(r.holdings, 'roth') === rothAfter.balance);

  // Merging into an existing position rather than duplicating it.
  const rothBF500 = r.holdings.filter(h => h.accountId === 'roth' && h.ticker === 'BF500');
  check('no duplicate positions created', rothBF500.length === 1, `${rothBF500.length} BF500 rows`);

  check('more than the account is worth is refused',
    transferValue(accts, hold, 'trad', 'roth', 200000).ok === false);
  const full = transferValue(accts, hold, 'trad', 'roth', 128450);
  check('full-balance conversion empties the source',
    full.ok === true && full.accounts.find(a => a.id === 'trad').balance === 0,
    String(full.accounts.find(a => a.id === 'trad').balance));
});

// ── The seed invariant, across every persona ────────────────────────────────
group('SEED DATA — balance === cash + Σ holdings, for all 4 personas', () => {
  const clients = Object.entries(DEFAULT_CLIENT_DATA);
  check('four personas loaded', clients.length === 4, `got ${clients.length}`);

  for (const [key, c] of clients) {
    let sumBalances = 0;
    for (const a of c.accounts) {
      const invested = c.holdings.filter(h => h.accountId === a.id).reduce((s, h) => s + h.value, 0);
      check(`${key} ${a.id}: ${a.balance} = ${a.cash} cash + ${invested} invested`,
        a.cash + invested === a.balance, `off by ${a.balance - a.cash - invested}`);
      check(`${key} ${a.id}: cash >= 0`, a.cash >= 0, String(a.cash));
      sumBalances += a.balance;
    }
    check(`${key}: totalBalance ${c.totalBalance} === Σ balances`, sumBalances === c.totalBalance, String(sumBalances));
  }

  // Every holding's value must equal shares x price — a $5.72 discrepancy was hiding
  // in the seed data and only became load-bearing once cash was the residual.
  let holdingsChecked = 0, holdingsBad = 0;
  for (const [, c] of clients) {
    for (const h of c.holdings) {
      holdingsChecked++;
      if (h.value !== holdingValue(h.shares, h.price)) holdingsBad++;
    }
  }
  check(`all ${holdingsChecked} holdings satisfy value === round(shares x price)`, holdingsBad === 0, `${holdingsBad} bad`);
});

// Jordan's taxable account is the demo the fix is judged on.
group('Jordan acc-302 renders exactly $4,800 / $3,923 / $877', () => {
  const jordan = Object.values(DEFAULT_CLIENT_DATA).find(c => c.name === 'Jordan Williams');
  const acct = jordan?.accounts.find(a => a.id === 'acc-302');
  check('balance 4800', acct?.balance === 4800, String(acct?.balance));
  check('cash 877', acct?.cash === 877, String(acct?.cash));
  check('invested 3923', investedValue(jordan.holdings, 'acc-302') === 3923, String(investedValue(jordan.holdings, 'acc-302')));
  check('Jordan is they/them', jordan?.pronouns === 'they/them', String(jordan?.pronouns));
});

rmSync(am.outDir, { recursive: true, force: true });
rmSync(cd.outDir, { recursive: true, force: true });

console.log(`\n${failed === 0 ? '✓ PASS' : '✗ FAIL'} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
