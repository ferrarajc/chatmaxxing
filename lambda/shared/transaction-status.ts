// Canonical transaction lifecycle statuses for a mutual-fund firm.
// Mutual funds price once per day at NAV and settle the next business day (T+1),
// so an order moves: (future) Scheduled → Pending (placed, awaiting tonight's NAV)
// → Settling (executed, in T+1 settlement) → Completed (settled & posted).
// Canceled is rare. This module is the single source of truth for status VALUES and
// the date→status rule; the customer-app mirrors the same strings (with display copy)
// in customer-app/src/data/transactionStatus.ts.

export const TXN_STATUSES = ['Scheduled', 'Pending', 'Settling', 'Completed', 'Canceled'] as const;
export type TxnStatus = typeof TXN_STATUSES[number];

// ── The demo clock ───────────────────────────────────────────────────────────
// The seeded world is frozen at this "present": generated history ends here and
// statuses are assigned relative to it, so every persona shows a few in-flight rows
// at the top. Live trades placed in the running demo instead use the real current
// date (see execute-task / clientStore.buyFund), so a brand-new order is correctly
// Pending.
//
// This is a HAND-BUMPED constant, deliberately not `new Date()`: the seeded PRNG in
// transaction-history.ts must stay deterministic so a reseed is idempotent (the
// reset writes byte-identical rows every time it runs).
//
// REFRESH RITUAL — run this periodically so the demo data reaches "now", and always
// before a demo that shows year-to-date figures (the IRA contributions card sums
// real calendar years, so a stale clock reads as "$0 contributed this year"):
//   1. bump DEMO_TODAY below to today's date (a weekday reads best — the in-flight
//      head block derives a Settling row from the prior business day)
//   2. deploy the backend   (cd cdk; npm run deploy:dev  →  then prod via merge)
//   3. reseed               GET /reset-client-data?key=bobs-reset-2025
// Step 3 wipes and regenerates every persona's ledger, so confirm demo timing before
// running it against prod.
export const DEMO_TODAY = '2026-08-20'; // a Thursday

/** Previous business day (skips weekends) for an ISO YYYY-MM-DD date. */
export function prevBusinessDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  do {
    d.setUTCDate(d.getUTCDate() - 1);
  } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

/**
 * Lifecycle status implied by a transaction's date relative to `today`:
 *  - in the future            → Scheduled
 *  - today                    → Pending  (placed, awaiting tonight's NAV)
 *  - the prior business day   → Settling (executed, in T+1 settlement)
 *  - older                    → Completed
 * The generator may override this to 'Canceled' for the rare canceled order.
 */
export function assignStatus(date: string, today: string = DEMO_TODAY): TxnStatus {
  if (date > today) return 'Scheduled';
  if (date === today) return 'Pending';
  if (date === prevBusinessDay(today)) return 'Settling';
  return 'Completed';
}
