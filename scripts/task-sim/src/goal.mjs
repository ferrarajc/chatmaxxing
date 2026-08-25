// ── Goal derivation ──────────────────────────────────────────────────────────
//
// Build a concrete, SATISFIABLE customer goal for any task, from the task registry
// plus the client's REAL seeded data. Because we choose every value, we know ground
// truth — which is what lifts the assertions above the "field is non-empty" bar that
// let `"TBD"` pass ~40 of the old suite's ~55 checks.
//
// Satisfiability is not a nicety. PLACE_SALE_PROMPT and EXCHANGE_FUNDS_PROMPT now gate
// the funds they offer on the client's actual holdings, so a goal that asks to sell a
// fund the persona doesn't own tests nothing but our own carelessness. The old harnesses
// used fabricated ids (`test-005`) that exist in no table at all.
//
// Ordering matters: `skipWhenFieldIs` trigger fields are derived FIRST so that
// filterFields() can drop what the Lambda would drop, and the (account, holding) pair is
// chosen together before either is assigned to a field.

import { getFacts } from './facts.mjs';
import { OVERRIDES } from './goal-overrides.mjs';

/** Deterministic PRNG so a run can be reproduced from its seed. */
export function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];
const snap50 = n => Math.max(50, Math.round(n / 50) * 50);

export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ── Field-meaning rules, keyed on the field itself rather than the task ──────
// A future task inherits all of this for free.
const IS = {
  account:      f => /accountid$/i.test(f.key) || /^account$/i.test(f.label),
  // ANCHORED, not a substring. `/fund/` also matches `fundingSource`, which made the
  // deriver treat a purchase as operating on a held position — so the amount ceiling
  // came from the client's existing holding instead of their cash, and a cash-funded
  // buy asked for $2,300 against $202. Keys are camelCase: fund, fromFund, toFund.
  fund:         f => /fund$/i.test(f.key) || /ticker/i.test(f.key),
  destFund:     f => /^tofund$/i.test(f.key) || /into|purchase|buy|invest/i.test(f.question || ''),
  amount:       f => f.type === 'amount' || /amount|initial|estimated/i.test(f.key),
  percent:      f => /percent|withholding/i.test(f.key),
  email:        f => /email/i.test(f.key),
  phone:        f => f.type === 'phone' || /phone/i.test(f.key),
  personName:   f => /name$/i.test(f.key) && !/fund/i.test(f.key),
  relationship: f => /relationship/i.test(f.key),
  institution:  f => /institution/i.test(f.key),
  dayOfMonth:   f => /dayofmonth/i.test(f.key),
  taxYear:      f => /taxyear/i.test(f.key),
  dateTime:     f => f.type === 'datetime' || /date|time/i.test(f.key),
};

const NAMES = ['Sarah Whitfield', 'Daniel Okoye', 'Priya Raman', 'Marcus Bell', 'Lena Fischer'];
const RELATIONSHIPS = ['Spouse', 'Child', 'Sibling', 'Parent'];
const INSTITUTIONS = ['Fidelity', 'Charles Schwab', 'Vanguard', 'a 401(k) from my last employer'];

/** A weekday 3–10 business days out, inside the 08:00–19:30 ET callback window. */
function futureSlot(rng) {
  const d = new Date();
  d.setDate(d.getDate() + 3 + Math.floor(rng() * 8));
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  const hour = 9 + Math.floor(rng() * 8);
  return { iso: d.toISOString().slice(0, 10), hour, text: `${d.toLocaleDateString('en-US', { weekday: 'long' })} at ${hour > 12 ? hour - 12 : hour}${hour >= 12 ? 'pm' : 'am'}` };
}

/**
 * The amount ceiling — what makes the ask affordable.
 * Returns null when the figure is new money (a schedule, a rollover) with no ceiling.
 */
function amountCeiling(facts, task, ctx) {
  const kw = (task.keywords || []).join(' ') + ' ' + task.id;
  if (ctx.position) return ctx.position.value;
  if (/withdraw|distribution/i.test(kw)) return ctx.account ? facts.cashOf(ctx.account, ctx.holdings) : null;
  if (ctx.fundingSourceIsCash && ctx.account) return facts.cashOf(ctx.account, ctx.holdings);
  if (/convert/i.test(kw)) return ctx.account ? ctx.account.balance : null;
  return null;
}

/** Derive one field's value. Returns undefined when it cannot — the caller then refuses. */
function deriveField(facts, task, field, ctx, rng) {
  const ov = OVERRIDES[task.id]?.fields?.[field.key];
  if (ov) return ov(ctx, rng);

  if (IS.account(field)) return ctx.account?.id;

  if (IS.fund(field)) {
    if (IS.destFund(field) && !/^fromfund$/i.test(field.key)) {
      const opts = field.options?.length ? field.options : Object.keys(facts.FUND_PRICES);
      const choices = opts.filter(t => t !== ctx.position?.ticker);
      return pick(rng, choices);
    }
    return ctx.position?.ticker;                       // you can only sell what you hold
  }

  // PERCENT IS TESTED BEFORE AMOUNT, and must stay that way. `update-beneficiaries`
  // declares `percentage` as `type: 'amount'`, and IS.amount fires on the type alone — so
  // with the checks the other way round the deriver handed a beneficiary split through the
  // money branch and the simulated client asked for "$2,850 percent of the account".
  // A percentage is not money, whatever the registry calls it.
  if (IS.percent(field)) {
    // 0% is a legitimate tax withholding election and a nonsense inheritance share, so the
    // two cannot draw from one list. A 0% beneficiary would make the expert push back —
    // correctly — and the run would score the refusal as the expert's failure.
    const shares = /withholding/i.test(field.key) ? [0, 10, 15, 20] : [25, 50, 75, 100];
    return `${pick(rng, shares)}%`;
  }

  if (IS.amount(field)) {
    const ceiling = amountCeiling(facts, task, ctx);
    if (ceiling != null) {
      if (ceiling < 200) return 'full balance';        // too small to slice — take it all
      return `$${snap50(Math.max(100, ceiling * (0.3 + rng() * 0.3))).toLocaleString()}`;
    }
    return `$${snap50(250 + rng() * 4750).toLocaleString()}`;
  }

  if (field.type === 'enum' && field.options?.length) return pick(rng, field.options);
  if (field.type === 'boolean') return pick(rng, ['Yes', 'No']);
  if (IS.dayOfMonth(field)) return String(1 + Math.floor(rng() * 28));
  if (IS.taxYear(field)) return String(new Date().getFullYear());
  if (IS.dateTime(field)) return ctx.slot.text;
  if (IS.phone(field)) return '(503) 555-0148';
  if (IS.email(field)) return 'sarah.whitfield@example.com';
  if (IS.personName(field)) return pick(rng, NAMES);
  if (IS.relationship(field)) return pick(rng, RELATIONSHIPS);
  if (IS.institution(field)) return pick(rng, INSTITUTIONS);

  return undefined;                                    // UNDERIVABLE — needs an override
}

/**
 * Can this persona satisfy this task at all? Returns a context or null.
 * Preconditions fall out of derivation rather than living in a hardcoded table:
 * no auto-invest schedule → update/pause-auto-invest is simply not derivable.
 */
export function buildContext(facts, task, snapshot, rng) {
  const accounts = snapshot.accounts ?? [];
  const holdings = snapshot.holdings ?? [];
  if (!accounts.length) return null;

  // ONLY the task's own eligibleAccountTypes constrains which account we pick.
  //
  // A field's `requiresAccountTypes` must NOT: it is a filter the Lambda applies AFTER
  // the account is known, dropping the field when it doesn't apply. Treating it as an
  // account constraint quietly shrinks coverage — `taxWithholding` requires
  // Traditional/SEP, so a withdrawal would only ever have been simulated from an IRA,
  // never from a taxable account, and Jordan (Roth + Taxable) would never be tested at
  // all despite being perfectly able to take a distribution.
  let eligible = accounts;
  if (task.eligibleAccountTypes?.length) {
    eligible = accounts.filter(a => task.eligibleAccountTypes.includes(a.type));
  }
  if (!eligible.length) return null;

  // If the task operates on a held position, choose the (account, holding) pair together.
  const needsHeldFund = task.fields.some(f => IS.fund(f) && !IS.destFund(f))
    || /sell|exchange|drip|redeem/i.test(task.id);
  let account = null, position = null;

  if (needsHeldFund) {
    const withHoldings = eligible.filter(a => holdings.some(h => h.accountId === a.id));
    if (!withHoldings.length) return null;
    account = pick(rng, withHoldings);
    position = pick(rng, holdings.filter(h => h.accountId === account.id));
  } else {
    account = pick(rng, eligible);
  }

  const ctx = {
    snapshot, accounts, holdings, account, position,
    slot: futureSlot(rng),
    fundingSourceIsCash: false,
  };

  const gate = OVERRIDES[task.id]?.satisfiedBy;
  if (gate && !gate(ctx)) return null;
  return ctx;
}

/**
 * Derive the full goal. Returns { ok: true, goal } or { ok: false, missing: [keys] }
 * so `--list` can report derivability per task for $0.
 */
export async function deriveGoal(task, snapshot, seed) {
  const facts = await getFacts();
  const rng = makeRng(seed);
  const ctx = buildContext(facts, task, snapshot, rng);
  if (!ctx) return { ok: false, reason: 'persona cannot satisfy this task', missing: [] };

  const accountTypes = ctx.accounts.map(a => a.type);
  const collected = {};
  const fields = [];
  const missing = [];

  // Overrides read sibling values (newValue depends on infoType, beneficiaryName on
  // action), so the in-progress map has to be visible to them. Same object, live.
  ctx.collected = collected;

  // Derivation order is NOT declaration order — a field can only be derived once
  // everything it depends on is known:
  //
  //   1. `skipWhenFieldIs` triggers, so filterFields() can prune what the Lambda prunes.
  //   2. Funding-source-style enums, because they set the CEILING for an amount.
  //      `place-purchase` declares amount BEFORE fundingSource, so deriving in
  //      declaration order picked a free-money figure and only then discovered the
  //      client meant "from cash" — producing asks like $2,600 out of $202 of cash,
  //      which tests the insufficient-cash guard by accident and the happy path never.
  //   3. Everything else.
  const isTrigger = f => task.fields.some(o => o.skipWhenFieldIs?.field === f.key);
  const gatesAmount = f => f.type === 'enum' && /funding|source|method/i.test(f.key + ' ' + f.label)
    && task.fields.some(o => o.type === 'amount' || /amount/i.test(o.key));

  const first = task.fields.filter(isTrigger);
  const second = task.fields.filter(f => !isTrigger(f) && gatesAmount(f));
  const rest = task.fields.filter(f => !isTrigger(f) && !gatesAmount(f));
  const order = [...first, ...second, ...rest];

  for (const field of order) {
    // Mirror the Lambda's own pruning.
    const live = facts.filterFields(task, accountTypes, ctx.accounts.length, collected);
    if (!live.some(f => f.key === field.key)) continue;

    if (/fundingsource/i.test(field.key)) {
      const v = pick(rng, field.options ?? ['Linked bank account', 'Cash in account']);
      ctx.fundingSourceIsCash = /cash/i.test(v);
      collected[field.key] = v;
      fields.push({ key: field.key, label: field.label, type: field.type, value: v });
      continue;
    }

    const value = deriveField(facts, task, field, ctx, rng);
    if (value === undefined || value === null || value === '') {
      if (field.required) missing.push(field.key);
      continue;
    }
    collected[field.key] = String(value);
    fields.push({ key: field.key, label: field.label, type: field.type, value: String(value) });
  }

  if (missing.length) return { ok: false, reason: 'underivable required field(s)', missing };

  return {
    ok: true,
    goal: {
      taskId: task.id,
      taskName: task.name,
      clientId: snapshot.clientId,
      clientName: snapshot.name,
      account: ctx.account,
      position: ctx.position,
      fields,
      byKey: collected,
    },
  };
}
