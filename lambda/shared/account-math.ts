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
