/**
 * Unit test for the pure contribution-limit math in lambda/shared/contribution-limits.ts.
 *
 * No network and no AWS — unlike the conversation harnesses in this folder, this one
 * runs entirely offline. The module under test is TypeScript, so it is bundled to a
 * temp .mjs with esbuild first (esbuild is already a repo dependency, used by the CI
 * bundle check). That keeps ONE source of truth for the IRS figures rather than
 * re-declaring them in the test.
 *
 * Usage:
 *   node lambda/tests/test-contribution-limits.mjs
 */

import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'shared', 'contribution-limits.ts');

const outDir = mkdtempSync(path.join(tmpdir(), 'contrib-limits-'));
const outFile = path.join(outDir, 'contribution-limits.mjs');
execFileSync('npx', ['esbuild', SRC, '--bundle', '--platform=node', '--format=esm', `--outfile=${outFile}`, '--log-level=error'], {
  cwd: path.join(__dirname, '..', '..'),
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

const {
  CONTRIBUTION_LIMITS, CONTRIBUTION_ASSUMPTIONS, LATEST_LIMIT_YEAR,
  ageAtYearEnd, classifyAccount, dcCapFor, iraDeadlineFor, isIraAccount, limitFor, sepDeadlineFor,
} = await import(pathToFileURL(outFile).href);

let passed = 0;
let failed = 0;

function check(label, ok, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}${detail ? `  — ${detail}` : ''}`); }
}
function group(name, fn) { console.log(`\n${name}`); fn(); }

// ── Account classification ──────────────────────────────────────────────────
// The only discriminator the data model has is the free-text `type` label, and the
// specific kinds must win over the generic "ira" substring they all contain.
group('classifyAccount — the four real account-type strings', () => {
  check("'Roth IRA' -> roth", classifyAccount('Roth IRA') === 'roth', classifyAccount('Roth IRA'));
  check("'Traditional IRA' -> traditional", classifyAccount('Traditional IRA') === 'traditional', classifyAccount('Traditional IRA'));
  check("'SEP-IRA' -> sep (not traditional)", classifyAccount('SEP-IRA') === 'sep', classifyAccount('SEP-IRA'));
  check("'Taxable Account' -> taxable", classifyAccount('Taxable Account') === 'taxable', classifyAccount('Taxable Account'));
  check('undefined -> other', classifyAccount(undefined) === 'other');
  check("'Rollover IRA' -> traditional", classifyAccount('Rollover IRA') === 'traditional', classifyAccount('Rollover IRA'));
  check('isIraAccount excludes taxable', isIraAccount('Taxable Account') === false);
  check('isIraAccount includes SEP', isIraAccount('SEP-IRA') === true);
});

// ── Age attained during the tax year ────────────────────────────────────────
// The IRS keys the catch-up off age on DECEMBER 31, not age today — so a December
// birthday still gets the catch-up for the whole year they turn 50.
group('ageAtYearEnd — age on December 31 of the tax year', () => {
  check('Alex 1966-08-19 in 2026 -> 60', ageAtYearEnd('1966-08-19', 2026) === 60, String(ageAtYearEnd('1966-08-19', 2026)));
  check('Maria 1951-02-03 in 2026 -> 75', ageAtYearEnd('1951-02-03', 2026) === 75, String(ageAtYearEnd('1951-02-03', 2026)));
  check('Jordan 1997-05-27 in 2026 -> 29', ageAtYearEnd('1997-05-27', 2026) === 29, String(ageAtYearEnd('1997-05-27', 2026)));
  check('Robert 1973-11-30 in 2026 -> 53', ageAtYearEnd('1973-11-30', 2026) === 53, String(ageAtYearEnd('1973-11-30', 2026)));
  check('Dec-31 birthday counts for that year', ageAtYearEnd('1976-12-31', 2026) === 50, String(ageAtYearEnd('1976-12-31', 2026)));
  check('same DOB, prior tax year is one less', ageAtYearEnd('1966-08-19', 2025) === 59);
  check('missing DOB -> NaN, never a guess', Number.isNaN(ageAtYearEnd(undefined, 2026)));
  check('garbage DOB -> NaN', Number.isNaN(ageAtYearEnd('not-a-date', 2026)));
});

// ── The limit itself ────────────────────────────────────────────────────────
group('limitFor — base, catch-up boundary, and the unknown-age rule', () => {
  const y2026 = CONTRIBUTION_LIMITS[2026];
  check('2026 base is published, not derived', typeof y2026.base === 'number' && y2026.base > 0);

  check('age 49 gets no catch-up', limitFor(2026, 49).catchUp === 0);
  check('age 50 gets the catch-up (boundary)', limitFor(2026, 50).catchUp === y2026.catchUp, String(limitFor(2026, 50).catchUp));
  check('age 51 still gets it', limitFor(2026, 51).catchUp === y2026.catchUp);
  check('total = base + catchUp', limitFor(2026, 50).total === y2026.base + y2026.catchUp);
  check('under 50 total = base', limitFor(2026, 30).total === y2026.base);

  check('unknown age falls back to base, never inflated', limitFor(2026, NaN).total === y2026.base && limitFor(2026, NaN).catchUp === 0);

  check('2024 and 2025 differ from 2026', CONTRIBUTION_LIMITS[2024].base !== y2026.base || CONTRIBUTION_LIMITS[2025].base !== y2026.base);
  for (const y of [2024, 2025, 2026]) {
    check(`${y} has published figures (estimated=false)`, limitFor(y, 40).estimated === false);
  }
  const future = LATEST_LIMIT_YEAR + 5;
  check(`unpublished year ${future} is flagged estimated`, limitFor(future, 40).estimated === true);
  check('unpublished year still returns a usable number', limitFor(future, 40).total > 0);
});

// ── Deadlines ───────────────────────────────────────────────────────────────
// An IRA contribution deadline does NOT extend with a filing extension; a SEP one does.
group('deadlines', () => {
  check('TY2024 IRA deadline is 2025-04-15', iraDeadlineFor(2024) === '2025-04-15', iraDeadlineFor(2024));
  check('TY2025 IRA deadline is 2026-04-15', iraDeadlineFor(2025) === '2026-04-15', iraDeadlineFor(2025));
  check('TY2026 IRA deadline is 2027-04-15', iraDeadlineFor(2026) === '2027-04-15', iraDeadlineFor(2026));
  check('an unlisted year still computes a weekday deadline', /^\d{4}-04-1[5-9]$/.test(iraDeadlineFor(2035)), iraDeadlineFor(2035));
  const d = new Date(`${iraDeadlineFor(2035)}T00:00:00Z`).getUTCDay();
  check('computed fallback is never a weekend', d !== 0 && d !== 6, `day=${d}`);
  check('SEP deadline runs to October (extensions)', sepDeadlineFor(2026).startsWith('2027-10'), sepDeadlineFor(2026));
  check('SEP deadline is later than the IRA one', sepDeadlineFor(2026) > iraDeadlineFor(2026));
  check('dcCap is far above the IRA limit', dcCapFor(2026) > limitFor(2026, 60).total * 5);
});

// ── The disclosure lines ────────────────────────────────────────────────────
// These are rendered verbatim by BOTH the account card and the AI tool. If the
// "contributions elsewhere" caveat ever disappears, the product starts quoting a
// remaining amount it cannot actually stand behind.
group('CONTRIBUTION_ASSUMPTIONS', () => {
  check('three assumptions are published', CONTRIBUTION_ASSUMPTIONS.length === 3, String(CONTRIBUTION_ASSUMPTIONS.length));
  check("names Bob's-only as the key limitation", /Bob's Mutual Funds/.test(CONTRIBUTION_ASSUMPTIONS[0]));
  check('says contributions elsewhere also count', /anywhere else|other firms?/i.test(CONTRIBUTION_ASSUMPTIONS[0]), CONTRIBUTION_ASSUMPTIONS[0]);
  check('flags the earned-income rule', CONTRIBUTION_ASSUMPTIONS.some(a => /earned income/i.test(a)));
  check('flags Roth income phase-outs', CONTRIBUTION_ASSUMPTIONS.some(a => /MAGI|phase-out/i.test(a)));
});

rmSync(outDir, { recursive: true, force: true });

console.log(`\n${'─'.repeat(50)}`);
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
