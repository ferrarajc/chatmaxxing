// ── Per-task hints, DATA ONLY ────────────────────────────────────────────────
//
// The escape hatch for the handful of fields the generic deriver in goal.mjs cannot
// infer — free-text whose meaning depends on a sibling field, or a value that must
// reference something already in the client's record.
//
// Keep this small and keep it dumb. If an entry starts wanting logic, that is a signal
// the generic rule in goal.mjs should be widened instead, so every future task inherits
// it. A task built from enum / amount / datetime / phone / boolean / account / fund
// fields needs NO entry here at all.
//
//   satisfiedBy(ctx) → boolean   an extra precondition the generic checks can't see
//   fields[key](ctx, rng) → val  derive one field

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];

export const OVERRIDES = {
  // `newValue` is a bare text field whose meaning is decided by the sibling `infoType`
  // enum, so it can only be derived once that choice is known.
  'update-contact-info': {
    fields: {
      newValue: (ctx, rng) => {
        const type = (ctx.collected?.infoType ?? '').toLowerCase();
        if (/phone/.test(type)) return '(503) 555-0177';
        if (/address/.test(type)) return '88 Larkspur Lane, Portland, OR 97209';
        return 'jordan.williams.new@example.com';
      },
    },
  },

  // Beneficiary percentages must keep each tier at 100, and Update/Remove need a name
  // that actually exists on the chosen account — otherwise the expert is being asked to
  // change someone who isn't there.
  'update-beneficiaries': {
    fields: {
      beneficiaryName: (ctx, rng) => {
        const action = (ctx.collected?.action ?? '').toLowerCase();
        const existing = (ctx.snapshot.beneficiaries ?? [])
          .filter(b => b.accountId === ctx.account?.id);
        if (/remove|update/.test(action) && existing.length) return pick(rng, existing).name;
        return pick(rng, ['Sarah Whitfield', 'Daniel Okoye', 'Priya Raman']);
      },
      percentage: () => '100',
    },
  },

  // Both of these describe an EXISTING schedule, so the persona must have one.
  'update-auto-invest': {
    satisfiedBy: ctx => (ctx.snapshot.autoInvest ?? []).length > 0,
    fields: {
      scheduleDescription: (ctx, rng) => {
        const s = pick(rng, ctx.snapshot.autoInvest ?? []);
        return s ? `the ${s.frequency.toLowerCase()} $${s.amount} into ${s.fund}` : undefined;
      },
    },
  },
  'pause-auto-invest': {
    satisfiedBy: ctx => (ctx.snapshot.autoInvest ?? []).length > 0,
    fields: {
      scheduleDescription: (ctx, rng) => {
        const s = pick(rng, ctx.snapshot.autoInvest ?? []);
        return s ? `the ${s.frequency.toLowerCase()} $${s.amount} into ${s.fund}` : undefined;
      },
    },
  },

  // A conversion needs somewhere to land: execute-task refuses with "There is no Roth
  // IRA on this account to convert into". The source must not itself be the Roth.
  'roth-conversion': {
    satisfiedBy: ctx =>
      ctx.accounts.some(a => a.type === 'Roth IRA') &&
      ctx.accounts.some(a => /Traditional|SEP/i.test(a.type)),
    fields: {
      fromAccountId: ctx => ctx.accounts.find(a => /Traditional|SEP/i.test(a.type))?.id,
    },
  },
};
