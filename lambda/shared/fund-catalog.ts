// ── Fund catalog bridge ──────────────────────────────────────────────────────
// The 36-fund lineup has ONE canonical source: customer-app/src/data/funds.ts.
// This is the ONLY place the backend reaches across into the frontend package, and it
// works because funds.ts is pure data + types (no React/DOM/vite imports) — esbuild
// bundles it into any consuming Lambda. Keep funds.ts pure so this bridge stays valid.
//
// Used by:
//   - lambda/reset-funds        → seeds the bobs-funds DynamoDB table from FUNDS
//   - lambda/autopilot-turn      → FUND_PICKLIST in task-expert prompts (module constant,
//                                  no DynamoDB call on the hot path)
// The runtime read path (get-funds Lambda + the get_funds tool) reads DynamoDB, not this
// file, so the table stays the live source of truth for pages and the AI.
export { FUNDS, FUND_BY_TICKER } from '../../customer-app/src/data/funds';
export type { FundDef, FundGroup, AllocationSlice, Distribution } from '../../customer-app/src/data/funds';

import { FUNDS } from '../../customer-app/src/data/funds';

/** Compact picklist for task-expert prompts: "BF500 (BobsFunds 500 Index), BFGR (...), ..." */
export const FUND_PICKLIST: string = FUNDS.map(f => `${f.ticker} (${f.name})`).join(', ');

/**
 * Ticker → { name, price } for order execution, DERIVED from the catalog.
 *
 * This used to be a hand-maintained object in client-defaults.ts holding only the
 * ORIGINAL SIX tickers, while the task experts were offered all 36 from FUND_PICKLIST.
 * The 30-fund gap failed silently and expensively: execute-task's matchFund() returned
 * null, the handler took a fallback that reported "order placed" and wrote NOTHING —
 * no holding, no balance change, no transaction row — so an IRA contribution in one of
 * those funds never reached the contributions card.
 *
 * Deriving it here is the same treatment market-data's FUND_MAP already got, and it
 * means adding a fund to funds.ts is now the only step required to make it tradeable.
 */
export const FUND_PRICES: Record<string, { name: string; price: number }> =
  Object.fromEntries(FUNDS.map(f => [f.ticker, { name: f.name, price: f.seedNav }]));

/**
 * Every tradeable ticker, DERIVED from the catalog.
 *
 * `tasks.ts` used to hard-code the ORIGINAL SIX on four separate fields
 * (place-purchase.fund, place-sale.fund, exchange-funds.fromFund/.toFund) while
 * FUND_PICKLIST offered all 36 in the bespoke prompts — the registry and the
 * conversation disagreed about what the client could even ask for. Same root cause
 * as the FUND_PRICES gap above, in a different field.
 */
export const FUND_TICKERS: string[] = FUNDS.map(f => f.ticker);
