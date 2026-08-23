/**
 * Unit test for resolveAccount() in lambda/shared/account-math.ts.
 *
 * Offline — no network, no AWS. Bundled with esbuild like test-contribution-limits.mjs.
 *
 * WHY THIS EXISTS — a live POAT purchase silently vanished. The task prompts list the
 * account options as "Taxable Account (acc-302)" and the field schema said "[account id
 * or type]", so the expert wrote `accountId: "Taxable Account (acc-302)"`. execute-task
 * did `accounts.find(a => a.id === raw)`, got undefined, and then CARRIED ON:
 *
 *   - created a holding keyed to the LABEL, belonging to no account at all
 *   - skipped the insufficient-cash guard, which was gated on the account being found
 *   - ignored applyCashDelta's ok:false
 *   - recomputed the real balances from the real holdings, i.e. changed nothing
 *   - returned success with a reference number
 *
 * The agent saw a confirmation, the client was told the $800 purchase had completed,
 * and the money went nowhere. Same class of failure as the 30-fund silent no-op this
 * branch already fixed: reporting success while writing nothing.
 *
 * Usage:
 *   node lambda/tests/test-resolve-account.mjs
 */

import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'shared', 'account-math.ts');

const outDir = mkdtempSync(path.join(tmpdir(), 'resolve-account-'));
const outFile = path.join(outDir, 'account-math.mjs');
execFileSync('npx', ['esbuild', SRC, '--bundle', '--platform=node', '--format=esm', `--outfile=${outFile}`, '--log-level=error'], {
  cwd: path.join(__dirname, '..', '..'),
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

const { resolveAccount } = await import(pathToFileURL(outFile).href);

let passed = 0, failed = 0;
function check(label, ok, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}${detail ? `  — ${detail}` : ''}`); }
}
function group(name, fn) { console.log(`\n${name}`); fn(); }

const JORDAN = [
  { id: 'acc-301', type: 'Roth IRA', balance: 18500, cash: 202 },
  { id: 'acc-302', type: 'Taxable Account', balance: 4800, cash: 877 },
];
const ALEX = [
  { id: 'acc-001', type: 'Roth IRA', balance: 45230, cash: 779 },
  { id: 'acc-002', type: 'Traditional IRA', balance: 128450, cash: 1897 },
  { id: 'acc-003', type: 'Taxable Account', balance: 67890, cash: 6385 },
];

group('The exact string that lost a live $800 purchase', () => {
  check('"Taxable Account (acc-302)" resolves to acc-302',
    resolveAccount(JORDAN, 'Taxable Account (acc-302)')?.id === 'acc-302',
    String(resolveAccount(JORDAN, 'Taxable Account (acc-302)')?.id));
});

group('Every form the prompts invite', () => {
  check('bare id', resolveAccount(JORDAN, 'acc-302')?.id === 'acc-302');
  check('type only', resolveAccount(JORDAN, 'Taxable Account')?.id === 'acc-302');
  check('type, different case', resolveAccount(JORDAN, 'taxable account')?.id === 'acc-302');
  check('label with id, no space', resolveAccount(JORDAN, 'Roth IRA(acc-301)')?.id === 'acc-301');
  check('id embedded in prose', resolveAccount(JORDAN, 'the acc-301 account')?.id === 'acc-301');
  check('surrounding whitespace', resolveAccount(JORDAN, '  acc-302  ')?.id === 'acc-302');
  check('"my Roth IRA"', resolveAccount(JORDAN, 'my Roth IRA')?.id === 'acc-301');
});

group('Refuses rather than guessing', () => {
  check('empty -> null', resolveAccount(JORDAN, '') === null);
  check('undefined -> null', resolveAccount(JORDAN, undefined) === null);
  check('unknown id -> null', resolveAccount(JORDAN, 'acc-999') === null);
  check('nonsense -> null', resolveAccount(JORDAN, 'the blue one') === null);
  check('no accounts -> null', resolveAccount([], 'acc-302') === null);
});

group('Ambiguity is not resolved by guessing', () => {
  const twoRoths = [
    { id: 'acc-a', type: 'Roth IRA', balance: 1, cash: 1 },
    { id: 'acc-b', type: 'Roth IRA', balance: 2, cash: 2 },
  ];
  check('two same-type accounts, type alone -> null', resolveAccount(twoRoths, 'Roth IRA') === null);
  check('...but an explicit id still wins', resolveAccount(twoRoths, 'Roth IRA (acc-b)')?.id === 'acc-b');
});

group('Three-account persona', () => {
  check('"Traditional IRA (acc-002)"', resolveAccount(ALEX, 'Traditional IRA (acc-002)')?.id === 'acc-002');
  check('"Traditional IRA" is unambiguous here', resolveAccount(ALEX, 'Traditional IRA')?.id === 'acc-002');
  check('"Taxable Account"', resolveAccount(ALEX, 'Taxable Account')?.id === 'acc-003');
  check('"Roth IRA" does not get swallowed by Traditional', resolveAccount(ALEX, 'Roth IRA')?.id === 'acc-001');
});

rmSync(outDir, { recursive: true, force: true });
console.log(`\n${failed === 0 ? '✓ PASS' : '✗ FAIL'} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
