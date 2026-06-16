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
