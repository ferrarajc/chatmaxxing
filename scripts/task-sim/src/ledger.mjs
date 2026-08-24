// ── Ledger snapshot, diff, and expectation ───────────────────────────────────
//
// The half of the product no test has ever reached. Every harness in lambda/tests stops
// at `proposedAction`; not one calls /execute-task. That is how an $800 purchase came to
// report success with a reference number while writing nothing at all — the money went
// into a holding attached to no account, and the conversation looked perfect.
//
// So: snapshot the whole client record immediately before and immediately after the
// submit, diff it structurally, and check that what changed is what was promised.
//
// DO NOT key expectations off `Task.executionType`. It claims 'mock' for place-purchase,
// place-sale, exchange-funds, request-withdrawal, roth-conversion and open-account —
// every one of which performs a real DynamoDB write. A tool that trusted that field
// would assert "nothing should change" on the seven tasks that change the most.

import { getFacts } from './facts.mjs';

const round = n => Math.round((n + Number.EPSILON) * 100) / 100;

/** Structural diff of two client snapshots. */
export function diffSnapshots(before, after) {
  const accById = s => Object.fromEntries((s.accounts ?? []).map(a => [a.id, a]));
  const holdKey = h => `${h.accountId}|${h.ticker}`;
  const holdBy = s => Object.fromEntries((s.holdings ?? []).map(h => [holdKey(h), h]));

  const a0 = accById(before), a1 = accById(after);
  const h0 = holdBy(before), h1 = holdBy(after);

  const accounts = [];
  for (const id of new Set([...Object.keys(a0), ...Object.keys(a1)])) {
    const x = a0[id], y = a1[id];
    if (!x) { accounts.push({ id, added: true, balance: y.balance, cash: y.cash }); continue; }
    if (!y) { accounts.push({ id, removed: true }); continue; }
    const dBal = round((y.balance ?? 0) - (x.balance ?? 0));
    const dCash = round((y.cash ?? 0) - (x.cash ?? 0));
    if (dBal || dCash) accounts.push({ id, type: x.type, dBalance: dBal, dCash, balance: y.balance, cash: y.cash });
  }

  const holdings = [];
  for (const k of new Set([...Object.keys(h0), ...Object.keys(h1)])) {
    const x = h0[k], y = h1[k];
    if (!x) { holdings.push({ key: k, added: true, shares: y.shares, value: y.value, accountId: y.accountId, ticker: y.ticker }); continue; }
    if (!y) { holdings.push({ key: k, removed: true, shares: x.shares, value: x.value, accountId: x.accountId, ticker: x.ticker }); continue; }
    const dShares = round((y.shares ?? 0) - (x.shares ?? 0));
    const dValue = round((y.value ?? 0) - (x.value ?? 0));
    const dDrip = (x.drip ?? false) !== (y.drip ?? false);
    if (dShares || dValue || dDrip) {
      holdings.push({ key: k, accountId: y.accountId, ticker: y.ticker, dShares, dValue, ...(dDrip ? { drip: y.drip } : {}) });
    }
  }

  const count = o => (o ?? []).length;
  return {
    accounts, holdings,
    dTotalBalance: round((after.totalBalance ?? 0) - (before.totalBalance ?? 0)),
    dBeneficiaries: count(after.beneficiaries) - count(before.beneficiaries),
    dAutoInvest: count(after.autoInvest) - count(before.autoInvest),
    autoInvestChanged: JSON.stringify(before.autoInvest ?? []) !== JSON.stringify(after.autoInvest ?? []),
    rmdChanged: JSON.stringify(before.rmd ?? {}) !== JSON.stringify(after.rmd ?? {}),
    changedAnything() {
      return this.accounts.length > 0 || this.holdings.length > 0 || this.dTotalBalance !== 0
        || this.dBeneficiaries !== 0 || this.autoInvestChanged || this.rmdChanged;
    },
  };
}

/**
 * The balance identity, checked on EVERY account after every submit.
 * Universal, free, and the single highest-value assertion available — a violation means
 * some write path did its own arithmetic instead of going through account-math.
 */
export async function checkBalanceIdentity(snapshot) {
  const facts = await getFacts();
  const problems = [];
  let sum = 0;
  for (const a of snapshot.accounts ?? []) {
    const invested = facts.investedValue(snapshot.holdings ?? [], a.id);
    const cash = facts.cashOf(a, snapshot.holdings ?? []);
    if (round(cash + invested) !== round(a.balance)) {
      problems.push(`${a.id} (${a.type}): balance ${a.balance} != cash ${cash} + invested ${invested}`);
    }
    sum += a.balance;
  }
  if (round(sum) !== round(snapshot.totalBalance ?? 0)) {
    problems.push(`totalBalance ${snapshot.totalBalance} != sum of account balances ${round(sum)}`);
  }
  return problems;
}

/**
 * What SHOULD the ledger do for this task? Returns a list of expectation checks.
 *
 * An unknown task id (a future expert) is not a failure — we run the universal identity
 * checks, record the diff as an observation, and say so in the report. Graceful
 * degradation beats a wall.
 */
export function expectationFor(goal, diff, before) {
  const acctId = goal.account?.id;
  const acct = d => diff.accounts.find(a => a.id === acctId) ?? { dBalance: 0, dCash: 0 };
  const amount = Number(String(goal.byKey.amount ?? '').replace(/[^0-9.]/g, '')) || null;
  const fromCash = /cash/i.test(goal.byKey.fundingSource ?? '');
  const near = (a, b, tol = 2) => Math.abs(a - b) <= tol;
  const checks = [];
  const expect = (label, ok, detail) => checks.push({ label, ok: !!ok, detail });

  switch (goal.taskId) {
    case 'place-purchase': {
      const a = acct();
      const pos = diff.holdings.find(h => h.accountId === acctId && h.ticker === goal.byKey.fund);
      expect('the fund position grew', pos && pos.dShares > 0,
        pos ? `${pos.ticker} ${pos.dShares > 0 ? '+' : ''}${pos.dShares} shares` : 'no holding changed');
      if (fromCash) {
        expect('cash fell by the purchase amount', amount && near(a.dCash, -amount), `cash ${a.dCash}`);
        expect('account total unchanged (cash → shares)', near(a.dBalance, 0), `balance ${a.dBalance}`);
      } else {
        expect('cash unchanged (funded from the bank)', near(a.dCash, 0), `cash ${a.dCash}`);
        expect('account total rose by the purchase amount', amount && near(a.dBalance, amount), `balance ${a.dBalance}`);
      }
      break;
    }
    case 'place-sale': {
      const a = acct();
      const pos = diff.holdings.find(h => h.accountId === acctId && h.ticker === goal.byKey.fund);
      expect('the fund position shrank', pos && (pos.removed || pos.dShares < 0),
        pos ? `${pos.ticker} ${pos.dShares ?? 'removed'}` : 'no holding changed');
      expect('proceeds landed in cash', amount && near(a.dCash, amount), `cash ${a.dCash}`);
      expect('account total unchanged (shares → cash)', near(a.dBalance, 0), `balance ${a.dBalance}`);
      break;
    }
    case 'exchange-funds': {
      const a = acct();
      expect('one position shrank and another grew',
        diff.holdings.some(h => (h.dShares ?? 0) < 0 || h.removed) &&
        diff.holdings.some(h => (h.dShares ?? 0) > 0 || h.added),
        `${diff.holdings.length} holdings changed`);
      expect('cash untouched', near(a.dCash, 0), `cash ${a.dCash}`);
      expect('account total ~unchanged', near(a.dBalance, 0, 3), `balance ${a.dBalance}`);
      break;
    }
    case 'request-withdrawal': {
      const a = acct();
      expect('cash fell by the amount', amount && near(a.dCash, -amount), `cash ${a.dCash}`);
      expect('account total fell by the amount', amount && near(a.dBalance, -amount), `balance ${a.dBalance}`);
      expect('holdings untouched', !diff.holdings.length, `${diff.holdings.length} holdings changed`);
      break;
    }
    case 'roth-conversion': {
      expect('two accounts moved in opposite directions',
        diff.accounts.some(a => a.dBalance < 0) && diff.accounts.some(a => a.dBalance > 0),
        diff.accounts.map(a => `${a.id} ${a.dBalance}`).join(', '));
      expect('portfolio total unchanged', near(diff.dTotalBalance, 0, 3), `total ${diff.dTotalBalance}`);
      break;
    }
    case 'open-account': {
      expect('a new account appeared', diff.accounts.some(a => a.added),
        diff.accounts.map(a => a.id).join(', '));
      break;
    }
    case 'toggle-drip': {
      expect('a holding\'s DRIP flag flipped', diff.holdings.some(h => 'drip' in h),
        `${diff.holdings.length} holdings changed`);
      expect('no money moved', !diff.accounts.length && near(diff.dTotalBalance, 0),
        `${diff.accounts.length} accounts changed`);
      break;
    }
    case 'update-beneficiaries':
      expect('beneficiaries changed', diff.dBeneficiaries !== 0 ||
        JSON.stringify(before.beneficiaries) !== JSON.stringify(before.beneficiaries), `${diff.dBeneficiaries}`);
      expect('no money moved', !diff.accounts.length, `${diff.accounts.length} accounts changed`);
      break;
    case 'setup-auto-invest':
      expect('a schedule was added', diff.dAutoInvest > 0, `${diff.dAutoInvest}`);
      break;
    case 'update-auto-invest':
    case 'pause-auto-invest':
      expect('a schedule changed', diff.autoInvestChanged, 'no autoInvest change');
      break;
    case 'update-rmd-settings':
      expect('RMD settings changed', diff.rmdChanged, 'no rmd change');
      break;
    default:
      // Unknown / mock-only task: assert only that it did not silently move money.
      expect('no unexpected money movement', !diff.accounts.length && !diff.holdings.length,
        `${diff.accounts.length} accounts, ${diff.holdings.length} holdings changed`);
      checks.unknownTask = true;
      break;
  }
  return checks;
}

/**
 * Does the SUMMARY the client was shown agree with what the ledger actually did?
 *
 * This exists because of an asymmetry in submitProposedAction.ts: the client is sent
 * `Confirmation\nRef: …\n\n${action.summary}` — the LLM's summary — while the Lambda's
 * own res.message, the ledger truth, is only ever seen by the agent. If the model writes
 * $5,000 and the handler moved $500, nothing in production catches it.
 */
export function summaryAgreesWithLedger(summary, diff) {
  const stated = [...String(summary ?? '').matchAll(/\$\s?([\d,]+(?:\.\d{1,2})?)/g)]
    .map(m => Number(m[1].replace(/,/g, '')));
  if (!stated.length) return { ok: true, note: 'summary states no figure' };

  const moved = new Set();
  for (const a of diff.accounts) { moved.add(Math.abs(a.dBalance)); moved.add(Math.abs(a.dCash)); }
  for (const h of diff.holdings) moved.add(Math.abs(h.dValue ?? 0));
  if (!moved.size) return { ok: true, note: 'nothing moved to compare against' };

  for (const n of stated) {
    if (![...moved].some(m => Math.abs(m - n) <= 2)) {
      return {
        ok: false,
        note: `the client was told $${n.toLocaleString()}, but the ledger moved ` +
              `${[...moved].filter(Boolean).map(m => '$' + m.toLocaleString()).join(' / ') || 'nothing'}`,
      };
    }
  }
  return { ok: true };
}
