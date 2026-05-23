/**
 * Quality Loop — Automated Improvement Orchestrator
 *
 * Runs the full eval → fix → deploy → re-eval cycle.
 *
 * Usage (standalone):
 *   OPENAI_API_KEY=sk-... [ANTHROPIC_API_KEY=sk-ant-...] node scripts/quality-loop/improvement-loop.mjs
 *
 * When spawned by server.mjs, stdout is parsed for markers:
 *   [WAITING_FOR_FIX]     — manual fix needed (no ANTHROPIC_API_KEY)
 *   [FIX_APPLIED]         — Claude API applied a fix
 *   [DEPLOY_START]        — CDK deploy beginning
 *   [DEPLOY_DONE]         — CDK deploy complete
 *   [ITERATION_COMPLETE n score] — iteration n finished with given score
 *   [THRESHOLD_MET]       — all thresholds passed, loop ending
 *   [MAX_ITERATIONS]      — hit the iteration limit
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { resolveSecrets } from './secrets.mjs';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = path.resolve(__dirname, '..', '..');
const RESULTS    = path.join(__dirname, 'results');
const ITER_FILE  = path.join(RESULTS, 'iteration.txt');
const LATEST     = path.join(RESULTS, 'latest.json');
const NEXT_FIX   = path.join(RESULTS, 'NEXT_FIX.md');
const HANDLER    = path.join(REPO_ROOT, 'lambda', 'autopilot-turn', 'handler.ts');
const CDK_DIR    = path.join(REPO_ROOT, 'cdk');

const API_BASE          = process.env.API_BASE ?? 'https://0y3s5vq2v5.execute-api.us-east-1.amazonaws.com';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
const CLAUDE_MODEL      = 'claude-sonnet-4-6';
const MAX_ITERATIONS    = 12;

mkdirSync(RESULTS, { recursive: true });

// ── Iteration counter ──────────────────────────────────────────────────────────

function readIteration() {
  if (!existsSync(ITER_FILE)) return 1;
  const n = parseInt(readFileSync(ITER_FILE, 'utf8').trim(), 10);
  return isNaN(n) ? 1 : n;
}
function writeIteration(n) { writeFileSync(ITER_FILE, String(n), 'utf8'); }

// ── Run a shell command, stream stdout to our stdout ──────────────────────────

function runCommand(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd ?? REPO_ROOT,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });
    child.stdout.on('data', d => process.stdout.write(d));
    child.stderr.on('data', d => process.stdout.write(d));
    child.on('close', code => {
      if (code !== 0 && !opts.allowFailure) reject(new Error(`${cmd} exited with code ${code}`));
      else resolve(code);
    });
    child.on('error', reject);
  });
}

// ── Run one quality-loop evaluation ───────────────────────────────────────────

function runEvaluation() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['scripts/quality-loop/run-quality-loop.mjs'],
      {
        cwd: REPO_ROOT,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    child.stdout.on('data', d => process.stdout.write(d));
    child.stderr.on('data', d => process.stdout.write(d));
    child.on('close', code => {
      // Read results regardless of exit code
      let latest = null;
      try { latest = JSON.parse(readFileSync(LATEST, 'utf8')); } catch {}
      resolve({ code, latest });
    });
    child.on('error', reject);
  });
}

// ── Apply fix via Claude API ───────────────────────────────────────────────────

async function applyFixWithClaude() {
  const nextFix = readFileSync(NEXT_FIX, 'utf8');
  const handler  = readFileSync(HANDLER, 'utf8');

  process.stdout.write('\n  Sending fix request to Claude API...\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: `You are a precise code editor. Your task is to apply a targeted, minimal change to a TypeScript file as described in the fix instructions.

Return ONLY valid JSON — no prose, no markdown, no explanation before or after:
{
  "search": "exact string to find in the file (must be unique)",
  "replace": "exact replacement string",
  "explanation": "one sentence describing the change"
}

Rules:
- The "search" string must appear exactly once in the file
- Make the minimal change needed — do not rewrite whole functions
- Preserve all existing indentation and formatting
- The change should implement ONLY the Primary Fix, not the Secondary Fix`,
      messages: [{
        role: 'user',
        content: `## Fix Instructions (NEXT_FIX.md)\n\n${nextFix}\n\n## TypeScript file to edit (handler.ts — ${handler.length} chars)\n\n${handler}`,
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data   = await res.json();
  const text   = data.content?.[0]?.text ?? '';

  // Strip markdown code fence if present
  const jsonText = text.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();
  const parsed = JSON.parse(jsonText);

  if (!handler.includes(parsed.search)) {
    throw new Error(`Search string not found in handler.ts. First 80 chars: "${parsed.search.slice(0, 80)}"`);
  }

  const modified = handler.replace(parsed.search, parsed.replace);
  writeFileSync(HANDLER, modified, 'utf8');

  process.stdout.write(`  ✓ Fix applied: ${parsed.explanation}\n`);
  return parsed.explanation;
}

// ── Wait for manual continue signal (stdin newline) ───────────────────────────

function waitForContinue() {
  return new Promise(resolve => {
    if (process.stdin.isPaused()) process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const handler = (data) => {
      if (data.trim() === 'continue' || data.trim() === '') {
        process.stdin.removeListener('data', handler);
        process.stdin.pause();
        resolve();
      }
    };
    process.stdin.on('data', handler);
  });
}

// ── Reset client data ──────────────────────────────────────────────────────────

async function resetClientData() {
  const res = await fetch(`${API_BASE}/reset-client-data?key=bobs-reset-2025`);
  if (!res.ok) process.stdout.write(`  ⚠ Reset returned HTTP ${res.status}\n`);
  else process.stdout.write('  ✓ Client data reset\n');
}

// ── Main loop ──────────────────────────────────────────────────────────────────

async function main() {
  await resolveSecrets();

  if (!process.env.OPENAI_API_KEY) {
    process.stdout.write('✗ OPENAI_API_KEY is required (not found in env or SSM: bobs-openai-api-key)\n');
    process.exit(2);
  }

  process.stdout.write(`\n${'═'.repeat(60)}\n`);
  process.stdout.write(`  Improvement Loop — automated eval + fix cycle\n`);
  if (ANTHROPIC_API_KEY) {
    process.stdout.write(`  Mode: FULLY AUTOMATED (Claude API will apply fixes)\n`);
  } else {
    process.stdout.write(`  Mode: SEMI-AUTOMATED (manual fix required each iteration)\n`);
    process.stdout.write(`  Tip: set ANTHROPIC_API_KEY for fully-automated mode\n`);
  }
  process.stdout.write(`${'═'.repeat(60)}\n\n`);

  let iteration = readIteration();

  while (iteration <= MAX_ITERATIONS) {
    process.stdout.write(`${'─'.repeat(60)}\n`);
    process.stdout.write(`  Iteration ${iteration} / ${MAX_ITERATIONS}\n`);
    process.stdout.write(`${'─'.repeat(60)}\n`);

    // ── Evaluate ──────────────────────────────────────────────
    const { code, latest } = await runEvaluation();

    const score = latest?.overallScore ?? 0;
    // Use exit code as the authoritative threshold signal — run-quality-loop.mjs
    // checks all thresholds (score, critical failures, AND high-severity heuristics).
    // latest.thresholdMet only checks score + critical failures, so it can be
    // true even when H3/H5/H8/H13 are below their 75% pass-rate threshold.
    const thresholdMet = code === 0;

    process.stdout.write(`[ITERATION_COMPLETE ${iteration} ${score.toFixed(2)}]\n`);

    if (thresholdMet) {
      process.stdout.write('\n[THRESHOLD_MET]\n');
      process.stdout.write('\n✓ All thresholds met — improvement loop complete.\n');
      process.stdout.write('  Open a PR for the accumulated changes on this branch.\n\n');
      process.exit(0);
    }

    if (iteration >= MAX_ITERATIONS) {
      process.stdout.write('\n[MAX_ITERATIONS]\n');
      process.stdout.write(`\n⚠ Reached max iterations (${MAX_ITERATIONS}). Review manually.\n\n`);
      process.exit(1);
    }

    // ── Apply fix ─────────────────────────────────────────────
    process.stdout.write('\n  Applying fix...\n');

    if (ANTHROPIC_API_KEY) {
      try {
        await applyFixWithClaude();
        process.stdout.write('[FIX_APPLIED]\n');
      } catch (err) {
        process.stdout.write(`  ✗ Claude API fix failed: ${err.message}\n`);
        process.stdout.write('  Falling back to manual fix mode.\n');
        process.stdout.write('[WAITING_FOR_FIX]\n');
        await waitForContinue();
      }
    } else {
      process.stdout.write('\n  Manual fix required. See NEXT_FIX.md.\n');
      process.stdout.write('[WAITING_FOR_FIX]\n');
      await waitForContinue();
    }

    // ── Typecheck ─────────────────────────────────────────────
    process.stdout.write('\n  Typechecking...\n');
    try {
      await runCommand('npx', ['tsc', '--noEmit'], { cwd: CDK_DIR });
      process.stdout.write('  ✓ Typecheck passed\n');
    } catch {
      process.stdout.write('  ✗ Typecheck failed — review handler.ts before continuing\n');
      process.stdout.write('[WAITING_FOR_FIX]\n');
      await waitForContinue();
      // Retry typecheck
      await runCommand('npx', ['tsc', '--noEmit'], { cwd: CDK_DIR });
    }

    // ── Deploy ────────────────────────────────────────────────
    process.stdout.write('\n[DEPLOY_START]\n');
    process.stdout.write('  Deploying Lambda stack...\n');
    await runCommand(
      'npx',
      ['cdk', 'deploy', 'BobsLambdaStack', '--require-approval', 'never'],
      { cwd: CDK_DIR },
    );
    process.stdout.write('\n[DEPLOY_DONE]\n');
    process.stdout.write('  ✓ Deploy complete\n');

    // ── Reset data ────────────────────────────────────────────
    await resetClientData();

    // ── Increment ─────────────────────────────────────────────
    iteration++;
    writeIteration(iteration);
    process.stdout.write(`\n  Starting iteration ${iteration}...\n\n`);
  }
}

main().catch(err => {
  process.stdout.write(`\n✗ Improvement loop error: ${err.message}\n`);
  process.exit(1);
});
