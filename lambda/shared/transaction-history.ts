// Deterministic transaction-history generator.
//
// Produces a realistic, decades-deep ledger per demo client so the new
// `bobs-transactions` table can demonstrate full history + pagination. Pure and
// deterministic (seeded PRNG) so a re-seed is byte-for-byte identical and idempotent.
//
// Used by the reset-all-data Lambda to BatchWrite seed rows. The row shape + key
// helpers here are also imported by execute-task and client-data so every writer
// agrees on the table schema.

import { DEFAULT_CLIENT_DATA, FullClientData, HoldingEntry, AccountEntry, AutoInvestEntry } from './client-defaults';
import { DEMO_TODAY, TxnStatus, assignStatus, prevBusinessDay } from './transaction-status';

export type TxnType =
  | 'deposit' | 'contribution' | 'dividend' | 'purchase'
  | 'sale' | 'exchange' | 'rmd' | 'fee' | 'withdrawal';

export interface TransactionRow {
  clientId: string;
  txnSort: string;    // `${date}#${seq}` — ISO date sorts chronologically; ScanIndexForward=false = newest-first
  acctKey: string;    // `${clientId}#${accountId}` — GSI partition (account IDs repeat across personas)
  txnId: string;
  date: string;       // YYYY-MM-DD
  description: string;
  descLower: string;  // lowercased copy for case-insensitive server-side search
  amount: number;
  account: string;    // account type label, e.g. 'Roth IRA'
  accountId: string;
  status: TxnStatus;
  type: TxnType;
}

export function makeAcctKey(clientId: string, accountId: string): string {
  return `${clientId}#${accountId}`;
}
export function makeTxnSort(date: string, seq: number): string {
  return `${date}#${String(seq).padStart(6, '0')}`;
}

/** Build a complete table row from its core fields (stamps keys + derived attrs). */
export function buildTransactionRow(input: {
  clientId: string; seq: number; date: string; description: string;
  amount: number; account: string; accountId: string; type: TxnType; status?: TxnStatus;
}): TransactionRow {
  const status = input.status ?? assignStatus(input.date);
  return {
    clientId: input.clientId,
    txnSort: makeTxnSort(input.date, input.seq),
    acctKey: makeAcctKey(input.clientId, input.accountId),
    txnId: `txn-${input.clientId}-${String(input.seq).padStart(6, '0')}`,
    date: input.date,
    description: input.description,
    descLower: input.description.toLowerCase(),
    amount: Math.round(input.amount * 100) / 100,
    account: input.account,
    accountId: input.accountId,
    status,
    type: input.type,
  };
}

// ── Per-account inception (account opening) dates ────────────────────────────
// Older personas reach back decades; Jordan (28) is only a few years in.
const INCEPTION: Record<string, string> = {
  // Alex Johnson
  'acc-001': '2012-03-01', // Roth IRA
  'acc-002': '2009-06-01', // Traditional IRA (rollover — oldest of his)
  'acc-003': '2015-09-01', // Taxable
  // Maria Chen (longest history)
  'acc-201': '1998-05-01', // Traditional IRA
  'acc-202': '2004-02-01', // Taxable
  // Jordan Williams (youngest)
  'acc-301': '2020-01-01', // Roth IRA
  'acc-302': '2021-06-01', // Taxable
  // Robert Martinez
  'acc-401': '2006-04-01', // SEP-IRA
  'acc-402': '2013-01-01', // Roth IRA
  'acc-403': '2010-08-01', // Taxable
};

const MAX_ROWS_PER_ACCOUNT = 800; // hard cap (keeps the oldest trimmed if exceeded)

// ── Deterministic PRNG (mulberry32 seeded from a string hash) ────────────────
function makeRng(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Date helpers (UTC, to avoid TZ drift) ────────────────────────────────────
function iso(y: number, m0: number, day: number): string {
  const lastDay = new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
  const d = Math.min(day, lastDay);
  return `${y}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

interface RawEvent {
  date: string;
  description: string;
  amount: number;
  type: TxnType;
  status?: TxnStatus; // forced (Canceled); otherwise derived from date
}

interface PositionedEvent extends RawEvent {
  accountId: string;
  account: string; // account type label
}

/** Bond/cash funds pay more frequent, larger income than equity funds. */
function incomeRate(ticker: string): number {
  return ticker === 'BFBI' || ticker === 'BFST' ? 0.011 : 0.0035;
}

function generateAccountEvents(
  clientId: string,
  acc: AccountEntry,
  holdings: HoldingEntry[],
  schedule: AutoInvestEntry | undefined,
  client: FullClientData,
  rng: () => number,
): RawEvent[] {
  const events: RawEvent[] = [];
  const start = INCEPTION[acc.id] ?? '2015-01-01';
  const startMs = Date.parse(start + 'T00:00:00Z');
  const endMs = Date.parse(DEMO_TODAY + 'T00:00:00Z');
  const spanMs = Math.max(1, endMs - startMs);
  // Fraction (0.2–1) of the way from inception to "now" — older events are smaller.
  const frac = (dateIso: string) => {
    const f = (Date.parse(dateIso + 'T00:00:00Z') - startMs) / spanMs;
    return 0.2 + 0.8 * Math.max(0, Math.min(1, f));
  };

  // Opening deposit
  events.push({
    date: start,
    description: 'Account opened — initial deposit',
    amount: Math.round(2000 + rng() * 8000),
    type: 'deposit',
  });

  // Walk each month from inception → now
  const cur = new Date(startMs);
  while (cur.getTime() <= endMs) {
    const y = cur.getUTCFullYear();
    const m = cur.getUTCMonth(); // 0-based

    // Contributions
    if (schedule && schedule.active) {
      if (schedule.frequency === 'Monthly') {
        const day = schedule.dayOfMonth ?? 1;
        const d = iso(y, m, day);
        if (Date.parse(d + 'T00:00:00Z') <= endMs) {
          events.push({
            date: d,
            description: 'Monthly contribution',
            amount: Math.round(schedule.amount * (0.9 + rng() * 0.2) * 100) / 100,
            type: 'contribution',
          });
        }
      } else if (schedule.frequency === 'Quarterly' && m % 3 === 0) {
        const d = iso(y, m, 1);
        if (Date.parse(d + 'T00:00:00Z') <= endMs) {
          events.push({
            date: d,
            description: 'Quarterly contribution',
            amount: Math.round(schedule.amount * (0.9 + rng() * 0.2)),
            type: 'contribution',
          });
        }
      }
    } else if (m % 3 === 0 && rng() < 0.5) {
      // No active schedule — occasional discretionary contributions
      const d = iso(y, m, 5 + Math.floor(rng() * 10));
      events.push({
        date: d,
        description: 'Contribution',
        amount: Math.round((300 + rng() * 2200) * frac(d)),
        type: 'contribution',
      });
    }

    // Quarterly dividend reinvestments (Mar/Jun/Sep/Dec), one per holding
    if (m === 2 || m === 5 || m === 8 || m === 11) {
      const d = iso(y, m, 15);
      for (const h of holdings) {
        const amt = Math.round(h.value * incomeRate(h.ticker) * frac(d) * (0.7 + rng() * 0.6) * 100) / 100;
        if (amt >= 1) {
          events.push({
            date: d,
            description: `Dividend reinvestment - ${h.ticker}`,
            amount: amt,
            type: 'dividend',
          });
        }
      }
    }

    // Occasional discretionary purchase or sale (~1–2/yr)
    if (holdings.length && rng() < 0.12) {
      const h = holdings[Math.floor(rng() * holdings.length)];
      const d = iso(y, m, 8 + Math.floor(rng() * 16));
      const isSale = rng() < 0.3;
      const amt = Math.round((500 + rng() * 4500) * frac(d));
      events.push({
        date: d,
        description: `${isSale ? 'Sale' : 'Purchase'} - ${h.name}`,
        amount: isSale ? amt : -amt,
        type: isSale ? 'sale' : 'purchase',
      });
    }

    cur.setUTCMonth(m + 1);
  }

  // Annual account service fee (small, December)
  for (let y = new Date(startMs).getUTCFullYear(); y <= new Date(endMs).getUTCFullYear(); y++) {
    const d = iso(y, 11, 31);
    if (Date.parse(d + 'T00:00:00Z') <= endMs) {
      events.push({ date: d, description: 'Account service fee', amount: -(20 + Math.round(rng() * 15)), type: 'fee' });
    }
  }

  // RMD distributions for the eligible account (annual December)
  if (client.rmd?.eligible && client.rmd.accountId === acc.id) {
    const known = client.rmd.distributions ?? [];
    for (const dist of known) {
      events.push({ date: dist.date, description: 'RMD Distribution', amount: -Math.abs(dist.amount), type: 'rmd' });
    }
    // A couple of earlier synthesized RMDs (eligibility began ~age 73 = ~2022)
    for (const y of [2022, 2021]) {
      events.push({
        date: iso(y, 11, 12 + Math.floor(rng() * 6)),
        description: 'RMD Distribution',
        amount: -Math.round(20000 + rng() * 6000),
        type: 'rmd',
      });
    }
  }

  // ── Recent in-flight head (statuses derived from DEMO_TODAY) ──────────────
  const primary = holdings[0];
  if (primary) {
    // Settling: an order from the prior business day
    events.push({
      date: prevBusinessDay(DEMO_TODAY),
      description: `Purchase - ${primary.name}`,
      amount: -Math.round(500 + rng() * 2500),
      type: 'purchase',
    });
    // Pending: an order placed "today"
    events.push({
      date: DEMO_TODAY,
      description: `Dividend reinvestment - ${primary.ticker}`,
      amount: Math.round((40 + rng() * 200) * 100) / 100,
      type: 'dividend',
    });
  }
  // Scheduled: the next upcoming auto-invest contribution
  if (schedule && schedule.active && schedule.nextDate > DEMO_TODAY) {
    events.push({
      date: schedule.nextDate,
      description: `${schedule.frequency} contribution — ${schedule.fund}`,
      amount: schedule.amount,
      type: 'contribution',
    });
  }

  // Trim to the most recent MAX_ROWS_PER_ACCOUNT if needed
  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (events.length > MAX_ROWS_PER_ACCOUNT) {
    return events.slice(events.length - MAX_ROWS_PER_ACCOUNT);
  }
  return events;
}

/** Generate the full, sorted, keyed transaction ledger for one client. */
export function generateClientTransactions(clientId: string): TransactionRow[] {
  const client = DEFAULT_CLIENT_DATA[clientId];
  if (!client) return [];

  const raw: PositionedEvent[] = [];
  for (const acc of client.accounts) {
    const holdings = client.holdings.filter(h => h.accountId === acc.id);
    const schedule = client.autoInvest.find(s => s.accountId === acc.id && s.active);
    const rng = makeRng(`${clientId}#${acc.id}`);
    for (const ev of generateAccountEvents(clientId, acc, holdings, schedule, client, rng)) {
      raw.push({ ...ev, accountId: acc.id, account: acc.type });
    }
  }

  // One rare historical Canceled order per client (deterministic pick)
  const cancelRng = makeRng(`${clientId}#cancel`);
  const candidates = raw
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.type === 'purchase' && e.date < prevBusinessDay(DEMO_TODAY) && e.date > '2018-01-01');
  if (candidates.length) {
    const pick = candidates[Math.floor(cancelRng() * candidates.length)];
    raw[pick.i].status = 'Canceled';
  }

  // Global chronological sort, then assign sequential seq (keeps SK ordering correct)
  raw.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return raw.map((e, idx) =>
    buildTransactionRow({
      clientId,
      seq: idx,
      date: e.date,
      description: e.description,
      amount: e.amount,
      account: e.account,
      accountId: e.accountId,
      type: e.type,
      status: e.status, // undefined → derived from date
    }),
  );
}
