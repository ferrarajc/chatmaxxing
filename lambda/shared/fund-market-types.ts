// ── Fund market-data types bridge ────────────────────────────────────────────
// Same pattern as fund-catalog.ts: the contract has ONE canonical source
// (customer-app/src/data/fundMarket.ts, pure types) shared by the frontend and
// the fund-data-refresh / fund-market Lambdas. Types only — erased at build.
export type {
  FundMarketData,
  FundMarketSummary,
  FundRefreshStatus,
  ChartSeries,
} from '../../customer-app/src/data/fundMarket';
