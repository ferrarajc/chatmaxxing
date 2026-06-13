#!/usr/bin/env node
/**
 * Guarded CDK deploy.
 *
 * Runs `cdk diff` FIRST and refuses to deploy if the deploy would DELETE or REPLACE a
 * live resource (Lambda function, API route/integration, DynamoDB table, GSI, …) — unless
 * the operator explicitly sets ALLOW_DESTROY=1.
 *
 * Why this exists: CloudFormation reconciles a stack to whatever template you deploy. If you
 * deploy a branch that is MISSING a resource that exists in production (e.g. you branched off
 * `main` but prod is ahead of `main`), CloudFormation silently DELETES that resource. The raw
 * `cdk deploy --require-approval never` gives no warning for this — `--require-approval` only
 * covers IAM/security changes, not deletions. This wrapper closes that gap.
 *
 * Usage:
 *   node scripts/safe-deploy.mjs <Stack> [<Stack>...] [--passthrough-flags]
 *   node scripts/safe-deploy.mjs --all [--passthrough-flags]
 * Env:
 *   ALLOW_DESTROY=1   bypass the guard (for a genuinely intended removal)
 *   DRY_RUN=1         run the safety check but do not actually deploy
 */
import { spawnSync } from 'node:child_process';

/**
 * Scan `cdk diff` text for changes that would remove or replace a resource.
 * Resource-level removals render as:  [-] AWS::Lambda::Function LogicalId destroy
 * Replacements render inside a [~] block as:  ... (requires replacement) / (may be replaced)
 * Pure exports for self-testing.
 */
export function findDestructive(diffText) {
  const lines = diffText.split('\n');
  const removals = lines
    .filter(l => /^\s*\[-\]\s+AWS::/.test(l))
    .map(l => l.trim());
  const replacements = lines
    .filter(l => /\(requires replacement\)|\(may be replaced\)|replace$/i.test(l))
    .map(l => l.trim());
  return { removals, replacements };
}

function run(command, opts = {}) {
  return spawnSync(command, { shell: true, encoding: 'utf-8', ...opts });
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--self-test')) return selfTest();

  // Extract stack names, skipping flags AND the value that follows a value-taking flag
  // (e.g. `--require-approval never` must not treat `never` as a stack).
  const VALUE_FLAGS = new Set([
    '--require-approval', '--profile', '-c', '--context', '--role-arn', '--output', '-o',
    '--app', '-a', '--parameters', '--toolkit-stack-name', '--notification-arns', '--change-set-name',
  ]);
  const stacks = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('-')) { if (VALUE_FLAGS.has(a)) i++; continue; }
    stacks.push(a);
  }
  const hasAll = args.includes('--all');
  if (!stacks.length && !hasAll) {
    console.error('Usage: node scripts/safe-deploy.mjs <Stack> [<Stack>...] [--flags]   (or --all)');
    process.exit(2);
  }
  const diffTarget = stacks.length ? stacks.join(' ') : '--all';
  const ALLOW_DESTROY = process.env.ALLOW_DESTROY === '1';

  // Typecheck first — the project rule is "typecheck before every Lambda deploy".
  console.log('\n▶  Typecheck: tsc --noEmit\n');
  const tsc = run('npx tsc --noEmit', { stdio: 'inherit' });
  if (tsc.status !== 0) {
    console.error('🛑 Typecheck failed — not deploying.');
    process.exit(tsc.status || 1);
  }

  console.log(`\n▶  Safety check: cdk diff ${diffTarget}\n`);
  const diff = run(`npx cdk diff ${diffTarget}`);
  const out = (diff.stdout ?? '') + (diff.stderr ?? '');

  if (diff.status !== 0) {
    console.error('🛑 cdk diff failed (synth error) — not deploying.\n');
    console.error(out);
    process.exit(diff.status || 1);
  }

  const { removals, replacements } = findDestructive(out);
  if ((removals.length || replacements.length) && !ALLOW_DESTROY) {
    console.error('\n🛑 DEPLOY BLOCKED — this deploy would remove or replace LIVE resources:\n');
    for (const l of removals) console.error('   REMOVE   ' + l);
    for (const l of replacements) console.error('   REPLACE  ' + l);
    console.error(`
This almost always means the branch you are deploying is MISSING resources that exist in
production — e.g. you branched off main, but main is behind what is actually deployed.
Deploying as-is would DELETE those resources.

What to do:
  • Rebase your branch onto the current production tip, then redeploy; OR
  • If the removal is genuinely intended, re-run with:  ALLOW_DESTROY=1 <your deploy command>
`);
    process.exit(1);
  }

  console.log('✅ No destructive changes detected.\n');

  if (process.env.DRY_RUN === '1') {
    console.log(`[dry-run] would deploy: npx cdk deploy ${args.join(' ')}`);
    return;
  }

  const deploy = run(`npx cdk deploy ${args.join(' ')}`, { stdio: 'inherit' });
  process.exit(deploy.status ?? 0);
}

function selfTest() {
  const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } };

  const destructive = [
    'Stack BobsLambdaStack',
    'Resources',
    '[-] AWS::Lambda::Function PinTranscriptFn PinTranscriptFn5CD0C439 destroy',
    '[~] AWS::DynamoDB::Table ClientsTable ClientsTable123 replace',
    '[+] AWS::DynamoDB::Table TransactionsTable TransactionsTableABC',
  ].join('\n');
  const d = findDestructive(destructive);
  assert(d.removals.length === 1, 'should detect 1 removal, got ' + d.removals.length);
  assert(d.replacements.length === 1, 'should detect 1 replacement, got ' + d.replacements.length);

  const clean = [
    'Stack BobsLambdaStack',
    'There were no differences',
  ].join('\n');
  const c = findDestructive(clean);
  assert(c.removals.length === 0 && c.replacements.length === 0, 'clean diff should be safe');

  // IAM statement removals (nested under a [~] policy) must NOT trip the resource guard
  const iamOnly = [
    '[~] AWS::IAM::Policy ExecuteTaskFnServiceRoleDefaultPolicy',
    ' └─ [~] PolicyDocument',
    '     └─ [-] Removed dynamodb:PutItem on bobs-old-table',
  ].join('\n');
  const i = findDestructive(iamOnly);
  assert(i.removals.length === 0, 'nested IAM statement removal must not count as a resource removal');

  console.log('✅ safe-deploy self-test passed');
}

main();
