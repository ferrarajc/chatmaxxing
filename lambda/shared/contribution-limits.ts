// ── IRA contribution limits, deadlines, and account classification ───────────
//
// PURE MODULE — no AWS imports, no I/O, no React. Like tasks.ts and funds.ts it is
// safe to import from any package (Lambdas, customer-app, agent-app) and esbuild
// bundles it wherever it's used.
//
// This is the SINGLE EDIT POINT for the annual IRS figures. When the IRS publishes
// the next year's numbers (usually early November, in a "Notice 20XX-YY"), add one
// row to CONTRIBUTION_LIMITS and one to IRA_DEADLINES — nothing else in the codebase
// hardcodes them.
//
// Consumed by: contributions.ts (the computation), client-data (the API action),
// client-tools.ts (the get_contribution_room AI tool), transaction-history.ts (to
// decide which seeded rows are contributions), and the customer-app account pages.

export type AccountKind = 'roth' | 'traditional' | 'sep' | 'taxable' | 'other';

/** The account kinds that SHARE the single annual IRA limit, per IRS rules. */
export const AGGREGATE_KINDS: AccountKind[] = ['roth', 'traditional'];

export interface YearLimits {
  /** Base annual contribution limit for traditional + Roth IRAs combined. */
  base: number;
  /** Additional "catch-up" amount available from the catch-up age. */
  catchUp: number;
  /** Age (attained during the tax year) at which the catch-up unlocks. */
  catchUpAge: number;
  /** Absolute defined-contribution cap — the ceiling on a SEP-IRA contribution. */
  dcCap: number;
  /**
   * Roth IRA modified-AGI phase-out ranges, as [full contribution below, none above].
   * Used ONLY by the explainer pages — we hold no income data, so the contributions
   * card never applies these (that limitation is stated in CONTRIBUTION_ASSUMPTIONS).
   * Married-filing-separately is $0–$10,000 and is not inflation-indexed.
   */
  rothPhaseOut: { single: [number, number]; joint: [number, number] };
}

/**
 * Annual figures by TAX YEAR.
 *
 * ⚠ These drive dollar amounts shown to customers — both the remaining-room figure on
 * the account card and the numbers on the explainer pages. Verify every field of any new
 * row against irs.gov (Retirement Topics — IRA Contribution Limits, and the Amount of
 * Roth IRA Contributions You Can Make table) before shipping it. The phase-out ranges in
 * particular are easy to leave a year stale.
 *   2023 — Notice 2022-55   2024 — Notice 2023-75
 *   2025 — Notice 2024-80   2026 — Notice 2025-67
 */
export const CONTRIBUTION_LIMITS: Record<number, YearLimits> = {
  2023: { base: 6500, catchUp: 1000, catchUpAge: 50, dcCap: 66000, rothPhaseOut: { single: [138000, 153000], joint: [218000, 228000] } },
  2024: { base: 7000, catchUp: 1000, catchUpAge: 50, dcCap: 69000, rothPhaseOut: { single: [146000, 161000], joint: [230000, 240000] } },
  2025: { base: 7000, catchUp: 1000, catchUpAge: 50, dcCap: 70000, rothPhaseOut: { single: [150000, 165000], joint: [236000, 246000] } },
  2026: { base: 7500, catchUp: 1100, catchUpAge: 50, dcCap: 72000, rothPhaseOut: { single: [153000, 168000], joint: [242000, 252000] } },
};

/** Married filing separately: $0–$10,000, and never inflation-indexed. */
export const ROTH_PHASE_OUT_MFS: [number, number] = [0, 10000];

/** Figures for a tax year, falling back to the latest published year. */
export function limitsForYear(taxYear: number): YearLimits {
  return CONTRIBUTION_LIMITS[taxYear] ?? CONTRIBUTION_LIMITS[LATEST_LIMIT_YEAR];
}

/**
 * The tax year a date falls in, plus the prior year when its contribution deadline has
 * not yet passed (roughly January 1 – April 15, when a client can contribute for two
 * years at once). Shared by the explainer pages and the account card so they agree on
 * which years are worth showing.
 */
export function openTaxYears(asOf: string = new Date().toISOString().slice(0, 10)): number[] {
  const year = Number(asOf.slice(0, 4));
  return asOf <= iraDeadlineFor(year - 1) ? [year, year - 1] : [year];
}

/** The most recent tax year we hold published figures for. */
export const LATEST_LIMIT_YEAR = Math.max(...Object.keys(CONTRIBUTION_LIMITS).map(Number));

/**
 * IRA contribution deadlines by TAX YEAR — the tax filing deadline, WITHOUT
 * extensions. (A filing extension does NOT extend the IRA contribution deadline.
 * A SEP-IRA contribution is different: it may be made up to the filing deadline
 * INCLUDING extensions — see sepDeadlineFor.)
 *
 * Held explicitly rather than computed because the date shifts for weekends and for
 * the DC Emancipation Day holiday; a computed April 15 would be silently wrong in
 * those years.
 */
export const IRA_DEADLINES: Record<number, string> = {
  2023: '2024-04-15',
  2024: '2025-04-15',
  2025: '2026-04-15',
  2026: '2027-04-15',
};

/** April 15 of the following year, nudged off a weekend — the fallback deadline. */
function computedDeadline(taxYear: number): string {
  const d = new Date(Date.UTC(taxYear + 1, 3, 15));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** IRA contribution deadline (YYYY-MM-DD) for a tax year. */
export function iraDeadlineFor(taxYear: number): string {
  return IRA_DEADLINES[taxYear] ?? computedDeadline(taxYear);
}

/**
 * SEP-IRA contribution deadline: the filing deadline INCLUDING extensions, which
 * for a sole proprietor filing Schedule C runs to October 15 of the following year.
 */
export function sepDeadlineFor(taxYear: number): string {
  const d = new Date(Date.UTC(taxYear + 1, 9, 15));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Classify an account from its free-text `type` label — the only discriminator the
 * data model has. Order matters: "Roth IRA" and "SEP-IRA" both contain "ira", so
 * the specific kinds are tested before the generic one.
 */
export function classifyAccount(type: string | undefined): AccountKind {
  const t = (type ?? '').toLowerCase();
  if (!t) return 'other';
  if (t.includes('sep') || t.includes('simple')) return 'sep';
  if (t.includes('roth')) return 'roth';
  if (t.includes('ira')) return 'traditional';
  if (t.includes('taxable') || t.includes('individual') || t.includes('joint') || t.includes('brokerage')) {
    return 'taxable';
  }
  return 'other';
}

/** True for any retirement account this module tracks contributions for. */
export function isIraAccount(type: string | undefined): boolean {
  const kind = classifyAccount(type);
  return kind === 'roth' || kind === 'traditional' || kind === 'sep';
}

/**
 * Age ATTAINED DURING the tax year — i.e. age on December 31 — which is the rule the
 * IRS uses for the catch-up contribution. Someone who turns 50 on December 31 gets
 * the catch-up for that whole year. Returns NaN for an unparseable date of birth.
 */
export function ageAtYearEnd(dateOfBirth: string | undefined, taxYear: number): number {
  const birthYear = Number((dateOfBirth ?? '').slice(0, 4));
  if (!Number.isFinite(birthYear) || birthYear < 1900) return NaN;
  return taxYear - birthYear;
}

export interface ResolvedLimit {
  base: number;
  catchUp: number;
  total: number;
  /** True when we fell back to another year's published figures. */
  estimated: boolean;
}

/**
 * The client's own limit for a tax year, given their age at year end. An unknown age
 * (missing date of birth) yields the base limit with no catch-up — never guess it up.
 */
export function limitFor(taxYear: number, ageAtEndOfYear: number): ResolvedLimit {
  const known = CONTRIBUTION_LIMITS[taxYear];
  const y = known ?? CONTRIBUTION_LIMITS[LATEST_LIMIT_YEAR];
  const catchUp = Number.isFinite(ageAtEndOfYear) && ageAtEndOfYear >= y.catchUpAge ? y.catchUp : 0;
  return { base: y.base, catchUp, total: y.base + catchUp, estimated: !known };
}

/** The defined-contribution cap (the SEP ceiling) for a tax year. */
export function dcCapFor(taxYear: number): number {
  return (CONTRIBUTION_LIMITS[taxYear] ?? CONTRIBUTION_LIMITS[LATEST_LIMIT_YEAR]).dcCap;
}

/**
 * What our contribution figures do NOT account for. Authored once here and rendered
 * verbatim by BOTH the account-page card and the AI tool, so the two can never drift
 * apart — whoever quotes the number also carries the caveat.
 */
export const CONTRIBUTION_ASSUMPTIONS: string[] = [
  "Includes only contributions made at Bob's Mutual Funds. IRA contributions you made anywhere else also count toward the same annual limit and are not reflected here.",
  'Does not check the earned-income rule — your contribution cannot exceed your earned income for the year.',
  'Does not apply Roth IRA income (MAGI) phase-outs, which can reduce or eliminate what you are eligible to contribute.',
];
