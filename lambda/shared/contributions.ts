// ── IRA contribution summary ─────────────────────────────────────────────────
//
// Computes, for one client, how much they have contributed to their IRAs in a tax
// year, what their limit is, and how much room remains.
//
// WHY THIS LIVES IN ONE PLACE: the IRS applies the annual limit ACROSS ALL of a
// client's IRAs, not per account, so the number shown on any single account page is a
// portfolio-wide figure. Computing it server-side once means the account page, the
// customer bot (text and voice), all 19 autopilot task experts, the agent's
// next-best-response, and the phone-cockpit call prep all quote the SAME number — the
// failure mode being avoided is a card and a chatbot disagreeing about how much room a
// client has, on a question that carries a 6% excise tax for getting it wrong.
//
// COUNTING RULE
//   counted    type 'contribution' on a Roth or Traditional IRA
//   separate   type 'contribution' on a SEP-IRA — its own limit, never the aggregate
//   excluded   'dividend'   reinvested earnings are not new money (see kb.ts q-tax-004)
//              'purchase' / 'sale' / 'exchange'   internal moves; a Roth conversion is
//                           explicitly NOT a contribution
//              'deposit'    used for rollover funding, which does not count
//              'rmd' / 'withdrawal' / 'fee'       money out
//              anything on a taxable account      no limit applies
//   status     Completed / Pending / Settling count as made; Scheduled is reported
//              separately as upcoming; Canceled is ignored.
//
// See contribution-limits.ts for the annual IRS figures and the disclosure lines.

import { QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from './dynamo-client';
import {
  AccountKind,
  CONTRIBUTION_ASSUMPTIONS,
  ageAtYearEnd,
  classifyAccount,
  dcCapFor,
  iraDeadlineFor,
  limitFor,
  sepDeadlineFor,
} from './contribution-limits';

const CLIENTS_TABLE = (): string => process.env.CLIENTS_TABLE ?? 'bobs-clients';
const TXNS_TABLE = (): string => process.env.TRANSACTIONS_TABLE ?? 'bobs-transactions';

/** Statuses that represent a contribution that has actually been made. */
const MADE_STATUSES = new Set(['Completed', 'Pending', 'Settling']);

export interface AccountContribution {
  accountId: string;
  type: string;
  amount: number;
}

export interface ContributionYear {
  taxYear: number;
  /** Last day a contribution can be made for this tax year (YYYY-MM-DD). */
  deadline: string;
  /** Whether the client can still contribute for this year as of `asOf`. */
  stillOpen: boolean;
  /** Age attained during the tax year — what the catch-up rule keys off. */
  ageAtYearEnd: number | null;
  baseLimit: number;
  catchUp: number;
  limit: number;
  /** Contributed across ALL Roth + Traditional IRAs — the IRS aggregate. */
  contributed: number;
  /** Future-dated automatic contributions already scheduled within this tax year. */
  scheduled: number;
  remaining: number;
  overLimit: boolean;
  byAccount: AccountContribution[];
  /** True when we fell back to another year's published IRS figures. */
  limitEstimated: boolean;
}

export interface SepBucket {
  taxYear: number;
  /** SEP contributions may be made up to the filing deadline INCLUDING extensions. */
  deadline: string;
  stillOpen: boolean;
  contributed: number;
  scheduled: number;
  /** Absolute ceiling. The real limit is 25% of compensation, which we do not hold. */
  dcCap: number;
  byAccount: AccountContribution[];
}

export interface ContributionSummary {
  asOf: string;
  /** Whether this client holds any Roth/Traditional IRA at all. */
  hasAggregateIra: boolean;
  /** Current tax year first; the prior year follows while its deadline is open. */
  years: ContributionYear[];
  sep: SepBucket[];
  assumptions: string[];
}

interface LedgerRow {
  date: string;
  amount: number;
  accountId: string;
  account: string;
  type: string;
  status: string;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * All ledger rows for one calendar year. `txnSort` is `${date}#${seq}` with `seq`
 * zero-padded to 6 digits, so a plain sort-key BETWEEN over `#000000`..`#999999` is an
 * exact year window — no GSI, no filter scan, and no schema change needed.
 */
async function fetchYearRows(clientId: string, year: number): Promise<LedgerRow[]> {
  const rows: LedgerRow[] = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const res = await docClient.send(new QueryCommand({
      TableName: TXNS_TABLE(),
      KeyConditionExpression: 'clientId = :c AND txnSort BETWEEN :from AND :to',
      ExpressionAttributeValues: {
        ':c': clientId,
        ':from': `${year}-01-01#000000`,
        ':to': `${year}-12-31#999999`,
      },
      ProjectionExpression: '#d, amount, accountId, account, #t, #s',
      ExpressionAttributeNames: { '#d': 'date', '#t': 'type', '#s': 'status' },
      ...(cursor ? { ExclusiveStartKey: cursor } : {}),
    }));
    rows.push(...((res.Items ?? []) as LedgerRow[]));
    cursor = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (cursor);
  return rows;
}

/** Roll a year's rows into totals plus a per-account breakdown, for the given kinds. */
function tally(rows: LedgerRow[], kinds: AccountKind[]) {
  const byAccount = new Map<string, AccountContribution>();
  let contributed = 0;
  let scheduled = 0;

  for (const r of rows) {
    if (r.type !== 'contribution') continue;
    if (!kinds.includes(classifyAccount(r.account))) continue;
    // Contributions are money IN and should already be positive; take the magnitude so
    // a sign-convention slip in a writer can never silently subtract from the total.
    const amount = Math.abs(Number(r.amount) || 0);

    if (r.status === 'Scheduled') { scheduled += amount; continue; }
    if (!MADE_STATUSES.has(r.status)) continue;   // Canceled, and anything unexpected

    contributed += amount;
    const entry = byAccount.get(r.accountId);
    if (entry) entry.amount = round2(entry.amount + amount);
    else byAccount.set(r.accountId, { accountId: r.accountId, type: r.account, amount: round2(amount) });
  }

  return {
    contributed: round2(contributed),
    scheduled: round2(scheduled),
    byAccount: [...byAccount.values()].sort((a, b) => b.amount - a.amount),
  };
}

/**
 * Contribution summary for one client.
 *
 * @param asOf  YYYY-MM-DD to evaluate against; defaults to the real current date.
 *              Overridable so the prior-year path stays testable outside the
 *              January–April window when it is the only path that renders
 *              (see lambda/tests/test-contributions.mjs).
 */
export async function computeContributionSummary(
  clientId: string,
  asOf: string = today(),
): Promise<ContributionSummary> {
  const item = await docClient.send(new GetCommand({
    TableName: CLIENTS_TABLE(),
    Key: { clientId },
    ProjectionExpression: 'accounts, personal',
  })).then(r => r.Item ?? {}).catch(() => ({} as Record<string, unknown>));

  const accounts = (item.accounts as { id: string; type: string }[] | undefined) ?? [];
  const dateOfBirth = (item.personal as { dateOfBirth?: string } | undefined)?.dateOfBirth;

  const hasAggregateIra = accounts.some(a => {
    const k = classifyAccount(a.type);
    return k === 'roth' || k === 'traditional';
  });
  const hasSep = accounts.some(a => classifyAccount(a.type) === 'sep');

  const currentYear = Number(asOf.slice(0, 4));
  // The prior tax year is still contributable until its filing deadline passes — that
  // is the whole reason the card can show two years at once in Jan–Apr.
  const priorOpen = asOf <= iraDeadlineFor(currentYear - 1);
  const taxYears = priorOpen ? [currentYear, currentYear - 1] : [currentYear];

  const rowsByYear = new Map<number, LedgerRow[]>();
  await Promise.all(taxYears.map(async y => { rowsByYear.set(y, await fetchYearRows(clientId, y)); }));

  const years: ContributionYear[] = [];
  const sep: SepBucket[] = [];

  for (const taxYear of taxYears) {
    const rows = rowsByYear.get(taxYear) ?? [];

    if (hasAggregateIra) {
      const age = ageAtYearEnd(dateOfBirth, taxYear);
      const lim = limitFor(taxYear, age);
      const t = tally(rows, ['roth', 'traditional']);
      const deadline = iraDeadlineFor(taxYear);
      years.push({
        taxYear,
        deadline,
        stillOpen: asOf <= deadline,
        ageAtYearEnd: Number.isFinite(age) ? age : null,
        baseLimit: lim.base,
        catchUp: lim.catchUp,
        limit: lim.total,
        contributed: t.contributed,
        scheduled: t.scheduled,
        remaining: round2(Math.max(0, lim.total - t.contributed)),
        overLimit: t.contributed > lim.total,
        byAccount: t.byAccount,
        limitEstimated: lim.estimated,
      });
    }

    if (hasSep) {
      const t = tally(rows, ['sep']);
      const deadline = sepDeadlineFor(taxYear);
      sep.push({
        taxYear,
        deadline,
        stillOpen: asOf <= deadline,
        contributed: t.contributed,
        scheduled: t.scheduled,
        dcCap: dcCapFor(taxYear),
        byAccount: t.byAccount,
      });
    }
  }

  return { asOf, hasAggregateIra, years, sep, assumptions: CONTRIBUTION_ASSUMPTIONS };
}

/**
 * Plain-text rendering for LLM consumption — used by the get_contribution_room tool.
 * Deliberately ends with the assumption lines so any model quoting a number from here
 * also carries the caveat that contributions made elsewhere are not included.
 */
export function formatContributionSummary(s: ContributionSummary): string {
  const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (!s.years.length && !s.sep.length) {
    return 'This client holds no IRA accounts, so no IRA contribution limit applies to them.';
  }

  const lines: string[] = [`As of ${s.asOf}:`];

  for (const y of s.years) {
    lines.push('');
    lines.push(`TAX YEAR ${y.taxYear} — all Traditional + Roth IRAs COMBINED (this is how the IRS counts it; the limit is per person, not per account):`);
    lines.push(`  Contributed so far: ${money(y.contributed)}`);
    lines.push(`  Annual limit: ${money(y.limit)}${y.catchUp
      ? ` (${money(y.baseLimit)} base + ${money(y.catchUp)} catch-up, age ${y.ageAtYearEnd} at year end)`
      : ` (no catch-up — age ${y.ageAtYearEnd ?? 'unknown'} at year end)`}`);
    if (y.overLimit) {
      lines.push(`  OVER the limit by ${money(y.contributed - y.limit)}. An excess contribution carries a 6% excise tax for each year it stays in the account; it is fixed by withdrawing the excess plus earnings before the filing deadline.`);
    } else {
      lines.push(`  Remaining room: ${money(y.remaining)}`);
    }
    if (y.scheduled > 0) lines.push(`  Already scheduled but not yet made: ${money(y.scheduled)}`);
    if (y.byAccount.length) {
      lines.push(`  By account: ${y.byAccount.map(a => `${a.type} ${money(a.amount)}`).join(', ')}`);
    }
    lines.push(`  Deadline to contribute for ${y.taxYear}: ${y.deadline}${y.stillOpen ? ' (still open)' : ' (PASSED — no further contributions can be made for this tax year)'}`);
    if (y.limitEstimated) {
      lines.push('  NOTE: the IRS has not published figures for this tax year yet; the most recent published limit was used. Say so if you quote it.');
    }
  }

  for (const b of s.sep) {
    lines.push('');
    lines.push(`TAX YEAR ${b.taxYear} SEP-IRA — a SEPARATE limit. SEP contributions do NOT count against the Traditional/Roth limit above, and vice versa:`);
    lines.push(`  Contributed so far: ${money(b.contributed)}`);
    if (b.scheduled > 0) lines.push(`  Already scheduled but not yet made: ${money(b.scheduled)}`);
    if (b.byAccount.length) {
      lines.push(`  By account: ${b.byAccount.map(a => `${a.type} ${money(a.amount)}`).join(', ')}`);
    }
    lines.push(`  The SEP limit is 25% of compensation, capped at ${money(b.dcCap)}. We do not hold the client's compensation, so their remaining SEP room CANNOT be computed — do not guess or imply a figure. Suggest their accountant computes the exact amount.`);
    lines.push(`  Deadline: ${b.deadline} — the filing deadline INCLUDING extensions${b.stillOpen ? ' (still open)' : ' (PASSED)'}`);
  }

  lines.push('');
  lines.push('CAVEATS — state these whenever you quote a remaining amount:');
  for (const a of s.assumptions) lines.push(`  - ${a}`);
  return lines.join('\n');
}
