// ── Account math: cash, invested value, and the balance identity ─────────────
//
// PURE MODULE — no AWS imports, no I/O, no React. Like contribution-limits.ts it is
// safe to import from any package (Lambdas, customer-app, agent-app) and esbuild
// bundles it wherever it's used.
//
// THE INVARIANT THIS MODULE EXISTS TO ENFORCE:
//
//     account.balance === account.cash + Σ(value of that account's holdings)
//
// WHY: there used to be no cash field at all. An account had exactly one number,
// `balance`, and holdings were a separate, unreconciled array — both hand-authored, so
// the residual between them was meaningless and, in four of ten seeded accounts,
// NEGATIVE. Meanwhile PLACE_PURCHASE_PROMPT offered "Cash in account — from cash
// already sitting in the account" as a funding source, and execute-task ignored the
// field entirely.
//
// A task expert asked to explain the numbers did the only thing it could: it read the
// two unlabelled figures it was given ($4,800 from get_accounts, $3,923 from
// get_holdings) and reported $4,800 of CASH plus $3,923 of holdings. It was not
// hallucinating a number — it was applying the only interpretation the data offered.
//
// So cash is real now, and every balance is computed here rather than by hand.
//
// CASH IS STORED, NOT DERIVED. Cash and shares are the independent variables; price
// moves on its own; balance is the dependent one. Deriving cash as
// `balance - Σholdings` inverts that: clientStore.buyFund re-marks the whole existing
// position at the live quote, so Σholdings jumps by more than the purchase amount and
// the mark-to-market delta would be silently absorbed by cash — a price tick would
// change a client's cash. With cash stored, a price tick moves `balance` (correct) and
// leaves cash alone (correct). Cash only moves on cash events: buys funded from cash,
// sale proceeds, withdrawals, conversions, and deposits.

export interface AccountLike {
  id: string;
  type: string;
  balance: number;
  /** Uninvested cash. Optional so legacy records written before this field still read. */
  cash?: number;
  change?: number;
}

export interface HoldingLike {
  accountId: string;
  shares: number;
  price: number;
  value: number;
}

/** The one rounding rule for a position's market value. */
export function holdingValue(shares: number, price: number): number {
  return Math.round(shares * price);
}

/** Total market value of the holdings in one account. */
export function investedValue(holdings: HoldingLike[], accountId: string): number {
  return holdings
    .filter(h => h.accountId === accountId)
    .reduce((sum, h) => sum + (Number.isFinite(h.value) ? h.value : 0), 0);
}

/**
 * Spendable cash in an account.
 *
 * MIGRATION: records written before `cash` existed have only `balance` + holdings, so
 * fall back to the residual. `Math.max(0, …)` matters — four seeded accounts had
 * holdings worth MORE than their balance, and a negative "cash available" figure
 * leaking into a prompt is exactly the class of nonsense this module removes.
 */
export function cashOf(account: AccountLike, holdings: HoldingLike[]): number {
  if (typeof account.cash === 'number' && Number.isFinite(account.cash)) {
    return Math.max(0, account.cash);
  }
  return Math.max(0, account.balance - investedValue(holdings, account.id));
}

/** The balance identity: cash + invested. Never assign a balance by hand. */
export function accountBalance(account: AccountLike, holdings: HoldingLike[]): number {
  return cashOf(account, holdings) + investedValue(holdings, account.id);
}

/**
 * Rewrite every account's balance from its cash and its holdings.
 *
 * Call this after ANY mutation to holdings or cash instead of adjusting balances
 * inline. Before this existed, each task did its own arithmetic and they disagreed:
 * a purchase ADDED the amount to the balance (right for a bank transfer, wrong for
 * cash), a sale SUBTRACTED it (money simply vanished from the account), and an
 * exchange left it alone (the only internally consistent one).
 */
export function recomputeAccounts<T extends AccountLike>(accounts: T[], holdings: HoldingLike[]): T[] {
  return accounts.map(a => ({
    ...a,
    cash: cashOf(a, holdings),
    balance: accountBalance(a, holdings),
  }));
}

/** Portfolio total. Replaces the ad-hoc `reduce` repeated at every write site. */
export function portfolioTotal(accounts: AccountLike[]): number {
  return Math.round(accounts.reduce((sum, a) => sum + a.balance, 0));
}

export interface TransferrableHolding extends HoldingLike {
  name: string;
  ticker: string;
  price: number;
  change?: number;
  drip?: boolean;
}

/**
 * Move VALUE between two accounts belonging to the same client — cash first, then
 * positions in kind, pro-rata across the source account's holdings.
 *
 * This is what a Roth conversion actually is: an internal transfer at the same
 * custodian. Nothing leaves the firm, and converting IN KIND (moving the shares
 * themselves rather than liquidating) is standard practice — which is why a conversion
 * must NOT be capped by the source account's cash the way a withdrawal is. Capping it
 * by cash broke the flagship "Roth conversion strategy" demo: Alex's Traditional IRA
 * holds $128,450 but only $1,897 of it is cash, so every realistic conversion amount
 * was refused.
 *
 * Returns ok:false only when the source cannot cover the amount from its TOTAL value.
 */
export function transferValue<A extends AccountLike, H extends TransferrableHolding>(
  accounts: A[],
  holdings: H[],
  fromId: string,
  toId: string,
  amount: number,
): { accounts: A[]; holdings: H[]; ok: boolean; available: number } {
  const from = accounts.find(a => a.id === fromId);
  const to = accounts.find(a => a.id === toId);
  if (!from || !to) return { accounts, holdings, ok: false, available: 0 };

  const fromCash = cashOf(from, holdings);
  const fromInvested = investedValue(holdings, fromId);
  const available = fromCash + fromInvested;
  if (amount > available + 0.005) return { accounts, holdings, ok: false, available };

  // 1. Cash moves first — it is the cheapest thing to transfer.
  const cashMoved = Math.min(fromCash, amount);
  let remaining = amount - cashMoved;

  let nextHoldings = holdings;

  // 2. Anything left comes out of the positions, pro-rata, and lands in the destination
  //    account as the SAME funds (an in-kind transfer, not a sale).
  if (remaining > 0.005 && fromInvested > 0) {
    const fraction = Math.min(1, remaining / fromInvested);
    const out: H[] = [];
    const additions: H[] = [];

    for (const h of holdings) {
      if (h.accountId !== fromId) { out.push(h); continue; }

      const sharesMoved = Math.round(h.shares * fraction * 1000) / 1000;
      const sharesLeft = Math.round((h.shares - sharesMoved) * 1000) / 1000;

      if (sharesLeft > 0) {
        out.push({ ...h, shares: sharesLeft, value: holdingValue(sharesLeft, h.price) });
      }
      if (sharesMoved > 0) {
        additions.push({ ...h, accountId: toId, shares: sharesMoved, value: holdingValue(sharesMoved, h.price) });
      }
    }

    // Merge each moved position into an existing one of the same ticker, if any.
    for (const add of additions) {
      const idx = out.findIndex(h => h.accountId === toId && h.ticker === add.ticker);
      if (idx >= 0) {
        const merged = Math.round((out[idx].shares + add.shares) * 1000) / 1000;
        out[idx] = { ...out[idx], shares: merged, value: holdingValue(merged, out[idx].price) };
      } else {
        out.push(add);
      }
    }
    nextHoldings = out;
    remaining = 0;
  }

  // 3. Settle cash on both sides, then let the balances fall out of the identity.
  const withCash = accounts.map(a => {
    if (a.id === fromId) return { ...a, cash: Math.max(0, Math.round((fromCash - cashMoved) * 100) / 100) };
    if (a.id === toId) return { ...a, cash: Math.max(0, Math.round((cashOf(to, holdings) + cashMoved) * 100) / 100) };
    return a;
  });

  return {
    accounts: recomputeAccounts(withCash, nextHoldings),
    holdings: nextHoldings,
    ok: true,
    available,
  };
}

export interface CashDeltaResult<T extends AccountLike> {
  accounts: T[];
  ok: boolean;
  /** Cash available before the delta — for building the "not enough" message. */
  available: number;
}

/**
 * Apply a cash movement to one account, refusing to overdraw.
 *
 * This is the single insufficient-cash gate. The buy-funds expert also checks cash
 * conversationally so the client never reaches a failed submit — but a prompt is a
 * suggestion and this is the rule. The phone agent, the client-approval relay and a
 * hand-crafted POST all arrive here.
 */
export function applyCashDelta<T extends AccountLike>(
  accounts: T[],
  holdings: HoldingLike[],
  accountId: string,
  delta: number,
): CashDeltaResult<T> {
  const account = accounts.find(a => a.id === accountId);
  if (!account) return { accounts, ok: false, available: 0 };

  const available = cashOf(account, holdings);
  if (delta < 0 && available + delta < -0.005) {
    return { accounts, ok: false, available };
  }

  const updated = accounts.map(a =>
    a.id === accountId
      ? { ...a, cash: Math.max(0, Math.round((available + delta) * 100) / 100) }
      : a,
  );
  return { accounts: updated, ok: true, available };
}


/**
 * Resolve whatever the LLM wrote in an `accountId` field to a real account.
 *
 * The task prompts list the options as `Traditional IRA (acc-002)`, and the field
 * schema says `"[account id or type]"` — so the model legitimately writes any of
 * "acc-302", "Taxable Account", or "Taxable Account (acc-302)". A bare
 * `accounts.find(a => a.id === raw)` matches only the first of those.
 *
 * That was not a cosmetic miss. When it returned undefined the purchase still went
 * ahead: it created a holding whose accountId was the LABEL (belonging to no account),
 * skipped the insufficient-cash guard, and left every real balance untouched — while
 * reporting success with a reference number. A live POAT purchase of $800 vanished
 * into exactly such an orphan row. Resolve properly, and refuse when we cannot.
 */
export function resolveAccount<T extends AccountLike>(accounts: T[], raw: string | undefined): T | null {
  const s = (raw ?? '').trim();
  if (!s) return null;

  // 1. Exact id.
  const byId = accounts.find(a => a.id === s);
  if (byId) return byId;

  // 2. An id in parentheses: "Taxable Account (acc-302)".
  const paren = s.match(/\(([^)]+)\)/);
  if (paren) {
    const inner = paren[1].trim();
    const byInner = accounts.find(a => a.id === inner);
    if (byInner) return byInner;
  }

  // 3. Any account id appearing anywhere in the string.
  const embedded = accounts.find(a => s.includes(a.id));
  if (embedded) return embedded;

  // 4. Account type, case-insensitively — but only when it is unambiguous, since a
  //    client can hold two accounts of the same type.
  const lower = s.toLowerCase();
  const byType = accounts.filter(a => a.type.toLowerCase() === lower);
  if (byType.length === 1) return byType[0];

  const contains = accounts.filter(a => lower.includes(a.type.toLowerCase()));
  if (contains.length === 1) return contains[0];

  return null;
}
