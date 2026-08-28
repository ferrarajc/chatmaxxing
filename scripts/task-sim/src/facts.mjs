// ── The single import boundary into production code ──────────────────────────
//
// Every rule the simulator checks is IMPORTED FROM THE REAL MODULE, never
// re-implemented here. That is the whole point: an assertion cannot drift from the
// shipped behaviour, because it *is* the shipped behaviour.
//
// The counter-example is the suite this tool replaces. `test-place-sale.mjs` asserted a
// `reason` field by hand; when the field was deleted from tasks.ts the test kept
// asserting it and simply went red for a correct change. A hand-copied rule is a rule
// that will rot.
//
// Most of lambda/shared is dependency-free, so Node 24 strips the types and imports it
// directly. Two modules are the exception and go through esbuild instead, the same way
// lambda/tests/test-account-math.mjs already bundles TypeScript for a test:
// fund-catalog.ts reaches across into customer-app, and tasks.ts now imports
// fund-catalog for FUND_TICKERS (its fund fields used to hard-code the original six).

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const SHARED = path.join(REPO_ROOT, 'lambda', 'shared');

/** Bundle a TS module that has cross-package imports, then load it. */
function bundleAndImport(srcRel, name) {
  const outDir = mkdtempSync(path.join(tmpdir(), `task-sim-${name}-`));
  const outFile = path.join(outDir, `${name}.mjs`);
  execFileSync('npx', ['esbuild', path.join(REPO_ROOT, srcRel), '--bundle',
    '--platform=node', '--format=esm', `--outfile=${outFile}`, '--log-level=error'], {
    cwd: REPO_ROOT, shell: process.platform === 'win32', stdio: 'inherit',
  });
  return { url: pathToFileURL(outFile).href, cleanup: () => rmSync(outDir, { recursive: true, force: true }) };
}

let cached = null;

/**
 * Load every production rule the simulator needs. Cached — call it as often as you like.
 */
export async function getFacts() {
  if (cached) return cached;

  // Dependency-free: Node strips the types and imports these as-is.
  const [accountMath, money, hygiene, adviceGuard, contribution] = await Promise.all([
    import(pathToFileURL(path.join(SHARED, 'account-math.ts')).href),
    import(pathToFileURL(path.join(SHARED, 'money.ts')).href),
    import(pathToFileURL(path.join(SHARED, 'reply-hygiene.ts')).href),
    import(pathToFileURL(path.join(SHARED, 'advice-guard.ts')).href),
    import(pathToFileURL(path.join(SHARED, 'contribution-limits.ts')).href),
  ]);

  // Both reach into customer-app/src/data/funds.ts — need bundling.
  const cat = bundleAndImport('lambda/shared/fund-catalog.ts', 'fund-catalog');
  const fundCatalog = await import(cat.url);
  cat.cleanup();

  const tsk = bundleAndImport('lambda/shared/tasks.ts', 'tasks');
  const tasks = await import(tsk.url);
  tsk.cleanup();

  cached = {
    // The task registry — the source of truth for what a simulator must collect.
    TASKS: tasks.TASKS,
    filterFields: tasks.filterFields,
    matchTaskByIntent: tasks.matchTaskByIntent,

    // Account maths. resolveAccount is why "Taxable Account (acc-302)" must count as a
    // correct answer rather than a failure — production accepts it, so we do too.
    resolveAccount: accountMath.resolveAccount,
    cashOf: accountMath.cashOf,
    accountBalance: accountMath.accountBalance,
    investedValue: accountMath.investedValue,
    holdingValue: accountMath.holdingValue,

    // Money parsing — so "$1,500", "1500" and "fifteen hundred" are judged the way the
    // handler judges them.
    parseMoney: money.parseMoney,
    resolveAmount: money.resolveAmount,
    isFullAmount: money.isFullAmount,
    formatMoney: money.formatMoney,

    // Detector D1 uses the SHIPPED strip. If it fires, the shipped regex missed a new
    // phrasing — which is exactly the signal worth having.
    stripInternalStatus: hygiene.stripInternalStatus,

    // Detector D10: was a mid-task callback redirect actually justified?
    isAdviceRequest: adviceGuard.isAdviceRequest,

    isIraAccount: contribution.isIraAccount,
    FUND_PRICES: fundCatalog.FUND_PRICES,
    FUNDS: fundCatalog.FUNDS,
  };
  return cached;
}
