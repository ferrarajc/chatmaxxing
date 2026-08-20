/**
 * End-to-end test for the IRA contributions summary — POST /client-data
 * { action: 'get-contributions' }.
 *
 * Read-only, no LLM, no OPENAI_API_KEY. Defaults to PROD like its sibling tests; point
 * it at dev with API_URL when verifying this branch BEFORE merge (prod will 400 on the
 * unknown action until the backend deploys).
 *
 *   node lambda/tests/test-contributions.mjs
 *   API_URL=https://1cppcq9q57.execute-api.us-east-1.amazonaws.com node lambda/tests/test-contributions.mjs
 *
 * Assumes the target environment has been seeded: GET /reset-client-data?key=bobs-reset-2025
 */

const API_URL = process.env.API_URL
  ?? 'https://0y3s5vq2v5.execute-api.us-east-1.amazonaws.com';

const CLIENTS = {
  alex:   { id: 'demo-client-001', name: 'Alex Johnson',    dob: '1966-08-19', sep: false },
  maria:  { id: 'demo-client-002', name: 'Maria Chen',      dob: '1951-02-03', sep: false },
  jordan: { id: 'demo-client-003', name: 'Jordan Williams', dob: '1997-05-27', sep: false },
  robert: { id: 'demo-client-004', name: 'Robert Martinez', dob: '1973-11-30', sep: true  },
};

let passed = 0;
let failed = 0;

function check(label, ok, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}${detail ? `  — ${detail}` : ''}`); }
}

async function getContributions(clientId, asOf) {
  const res = await fetch(`${API_URL}/client-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get-contributions', clientId, data: asOf ? { asOf } : {} }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

const money = n => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const near = (a, b) => Math.abs(a - b) < 0.011;   // cent-level rounding tolerance

// ── 1. Every persona returns a coherent current-year bucket ─────────────────
console.log('\nCurrent tax year — shape and internal consistency');
const summaries = {};
for (const [key, c] of Object.entries(CLIENTS)) {
  const s = await getContributions(c.id);
  summaries[key] = s;
  const y = s.years[0];
  console.log(`\n  ${c.name}: ${y ? `${y.taxYear} ${money(y.contributed)} of ${money(y.limit)}, ${money(y.remaining)} left` : 'no aggregate IRA'}`
    + (s.sep.length ? `  | SEP ${money(s.sep[0].contributed)}` : ''));

  check(`${key}: asOf is a real date`, /^\d{4}-\d{2}-\d{2}$/.test(s.asOf), s.asOf);
  check(`${key}: has an aggregate IRA bucket`, !!y);
  if (!y) continue;
  check(`${key}: tax year matches asOf`, y.taxYear === Number(s.asOf.slice(0, 4)), `${y.taxYear} vs ${s.asOf}`);
  check(`${key}: remaining = limit - contributed (or 0)`,
    near(y.remaining, Math.max(0, y.limit - y.contributed)),
    `${y.remaining} vs ${Math.max(0, y.limit - y.contributed)}`);
  check(`${key}: limit = base + catchUp`, near(y.limit, y.baseLimit + y.catchUp));
  check(`${key}: contributed is never negative`, y.contributed >= 0, String(y.contributed));
  check(`${key}: byAccount sums to contributed`,
    near(y.byAccount.reduce((a, x) => a + x.amount, 0), y.contributed),
    `${y.byAccount.reduce((a, x) => a + x.amount, 0)} vs ${y.contributed}`);
  check(`${key}: overLimit agrees with the numbers`, y.overLimit === (y.contributed > y.limit));
  check(`${key}: carries the three disclosure lines`, s.assumptions.length === 3, String(s.assumptions.length));
}

// ── 2. The aggregate really is cross-account, and excludes taxable ──────────
// This is the whole premise of the feature: one limit across ALL of a person's IRAs.
console.log('\nCross-account aggregation (Alex has TWO IRAs + a taxable account)');
{
  const y = summaries.alex.years[0];
  const kinds = y.byAccount.map(a => a.type);
  check('breaks down by account so the aggregation is visible', y.byAccount.length >= 1, JSON.stringify(kinds));
  check('never counts the taxable account', !kinds.some(t => /taxable/i.test(t)), JSON.stringify(kinds));
  check('never counts a SEP into the aggregate', !kinds.some(t => /sep/i.test(t)), JSON.stringify(kinds));
  check('only IRA account ids appear', y.byAccount.every(a => ['acc-001', 'acc-002'].includes(a.accountId)),
    JSON.stringify(y.byAccount.map(a => a.accountId)));
}

// ── 3. Catch-up is age-driven, per tax year ────────────────────────────────
console.log('\nCatch-up contributions follow age at year end');
{
  const jordan = summaries.jordan.years[0];
  check('Jordan (under 50) gets no catch-up', jordan.catchUp === 0, String(jordan.catchUp));
  check('Jordan limit equals the base limit', near(jordan.limit, jordan.baseLimit));
  for (const key of ['alex', 'maria', 'robert']) {
    const y = summaries[key].years[0];
    check(`${key} (50+) gets the catch-up`, y.catchUp > 0, String(y.catchUp));
    check(`${key} ageAtYearEnd is reported`, typeof y.ageAtYearEnd === 'number' && y.ageAtYearEnd >= 50, String(y.ageAtYearEnd));
  }
  const alex = summaries.alex.years[0];
  const jordanY = summaries.jordan.years[0];
  check('the 50+ limit is strictly larger than the under-50 one', alex.limit > jordanY.limit,
    `${alex.limit} vs ${jordanY.limit}`);
}

// ── 4. SEP is a separate bucket with no invented remaining figure ───────────
console.log('\nSEP-IRA is its own bucket (Robert holds a SEP AND a Roth)');
{
  const s = summaries.robert;
  check('robert has a SEP bucket', s.sep.length > 0);
  const sep = s.sep[0];
  const agg = s.years[0];
  check('SEP contributions are substantial in the seed data', sep.contributed > 0, money(sep.contributed));
  check('SEP total is NOT folded into the aggregate', sep.contributed !== agg.contributed);
  check('the aggregate is not blown past its limit by SEP money', agg.overLimit === false,
    `${money(agg.contributed)} vs limit ${money(agg.limit)}`);
  check('SEP bucket exposes no `remaining` field (it cannot be computed)',
    !('remaining' in sep), JSON.stringify(Object.keys(sep)));
  check('SEP cap is the defined-contribution cap, not the IRA limit', sep.dcCap > agg.limit * 5, String(sep.dcCap));
  check('SEP deadline is later than the IRA deadline (extensions)', sep.deadline > agg.deadline,
    `${sep.deadline} vs ${agg.deadline}`);
  check('only the SEP account appears in the SEP bucket',
    sep.byAccount.every(a => a.accountId === 'acc-401'), JSON.stringify(sep.byAccount.map(a => a.accountId)));

  for (const key of ['alex', 'maria', 'jordan']) {
    check(`${key} has no SEP bucket`, summaries[key].sep.length === 0);
  }
}

// ── 5. Scheduled money is reported, not counted ────────────────────────────
// A future-dated auto-invest row has not been contributed yet; counting it would
// understate remaining room and could talk a client out of a contribution they can make.
console.log('\nScheduled contributions are reported separately, never counted');
{
  const withSchedule = Object.entries(summaries).find(([, s]) => (s.years[0]?.scheduled ?? 0) > 0);
  if (withSchedule) {
    const [key, s] = withSchedule;
    const y = s.years[0];
    console.log(`  (${key} has ${money(y.scheduled)} scheduled)`);
    check('scheduled is excluded from contributed', near(y.remaining, Math.max(0, y.limit - y.contributed)));
    check('scheduled is a positive number', y.scheduled > 0);
  } else {
    console.log('  (no persona currently has a future-dated contribution — skipped)');
  }
}

// ── 6. The prior-tax-year panel ────────────────────────────────────────────
// Between April 16 and December 31 only ONE year is contributable, so the two-year path
// is invisible in the running app. `asOf` is how it gets exercised at all.
console.log('\nPrior tax year opens and closes on the deadline');
{
  const currentYear = Number(summaries.alex.asOf.slice(0, 4));
  const nextYear = currentYear + 1;

  const inWindow = await getContributions(CLIENTS.alex.id, `${nextYear}-02-01`);
  check(`asOf ${nextYear}-02-01 returns TWO tax years`, inWindow.years.length === 2,
    JSON.stringify(inWindow.years.map(y => y.taxYear)));
  if (inWindow.years.length === 2) {
    check('current year first, prior year second',
      inWindow.years[0].taxYear === nextYear && inWindow.years[1].taxYear === currentYear,
      JSON.stringify(inWindow.years.map(y => y.taxYear)));
    check('both years are still contributable', inWindow.years.every(y => y.stillOpen));
    check('the two years can carry different limits',
      typeof inWindow.years[0].limit === 'number' && typeof inWindow.years[1].limit === 'number');
  }

  const afterDeadline = await getContributions(CLIENTS.alex.id, `${nextYear}-06-01`);
  check(`asOf ${nextYear}-06-01 returns ONE tax year`, afterDeadline.years.length === 1,
    JSON.stringify(afterDeadline.years.map(y => y.taxYear)));

  const onDeadline = await getContributions(CLIENTS.alex.id, `${nextYear}-04-15`);
  check(`asOf ${nextYear}-04-15 (the deadline itself) still includes the prior year`,
    onDeadline.years.length === 2, JSON.stringify(onDeadline.years.map(y => y.taxYear)));
}

// ── 7. Degenerate input never throws ───────────────────────────────────────
console.log('\nDegenerate input');
{
  const unknown = await getContributions('no-such-client-id');
  check('unknown client returns an empty, well-formed payload',
    Array.isArray(unknown.years) && Array.isArray(unknown.sep) && unknown.hasAggregateIra === false,
    JSON.stringify(unknown).slice(0, 160));

  const badDate = await getContributions(CLIENTS.alex.id, 'not-a-date');
  check('a malformed asOf falls back to today rather than erroring',
    /^\d{4}-\d{2}-\d{2}$/.test(badDate.asOf), badDate.asOf);
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`${passed} passed, ${failed} failed  (${API_URL})`);
process.exit(failed === 0 ? 0 : 1);
