/**
 * Quality Loop — Automated Improvement Orchestrator (Bob's)
 *
 * Runs the full eval → fix → deploy → re-eval cycle using the heqya generic
 * engine + Bob's config. Claude API applies fixes automatically when
 * ANTHROPIC_API_KEY is set; otherwise waits for manual intervention.
 *
 * Usage (standalone):
 *   node scripts/quality-loop/improvement-loop.mjs
 *
 * When spawned by server.mjs, stdout is parsed for markers:
 *   [WAITING_FOR_FIX]
 *   [FIX_APPLIED]
 *   [DEPLOY_START]
 *   [DEPLOY_DONE]
 *   [ITERATION_COMPLETE n score]
 *   [THRESHOLD_MET]
 *   [MAX_ITERATIONS]
 */

import { readFileSync, writeFileSync } from 'fs';
import { spawn }                        from 'child_process';
import { fileURLToPath }               from 'url';
import path                            from 'path';
import { runLoop }                     from '../../heqya/core/loop.mjs';
import { resolveSecrets }              from './secrets.mjs';
import CONFIG                          from './heqya.config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CDK_DIR   = path.join(REPO_ROOT, 'cdk');
const HANDLER   = path.join(REPO_ROOT, 'lambda', 'autopilot-turn', 'handler.ts');

const CLAUDE_MODEL = 'claude-sonnet-4-6';

// ── Resolve secrets ────────────────────────────────────────────────────────────
// Must run BEFORE reading ANTHROPIC_API_KEY — resolveSecrets() may load it from SSM.

await resolveSecrets();

if (!process.env.OPENAI_API_KEY) {
  process.stdout.write('✗ OPENAI_API_KEY is required (not found in env or SSM: bobs-openai-api-key)\n');
  process.exit(2);
}

// Re-inject resolved key into config
CONFIG.llm.apiKey = process.env.OPENAI_API_KEY;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';

// ── Shell command runner ────────────────────────────────────────────────────────

function runCommand(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd:   opts.cwd ?? REPO_ROOT,
      env:   { ...process.env },
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

// ── Apply fix via Claude API ───────────────────────────────────────────────────

async function applyFixWithClaude(nextFixContent) {
  const handler = readFileSync(HANDLER, 'utf8');

  process.stdout.write('\n  Sending fix request to Claude API...\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      CLAUDE_MODEL,
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
        role:    'user',
        content: `## Fix Instructions (NEXT_FIX.md)\n\n${nextFixContent}\n\n## TypeScript file to edit (handler.ts — ${handler.length} chars)\n\n${handler}`,
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data     = await res.json();
  const text     = data.content?.[0]?.text ?? '';
  const jsonText = text.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();
  const parsed   = JSON.parse(jsonText);

  if (!handler.includes(parsed.search)) {
    throw new Error(`Search string not found in handler.ts. First 80 chars: "${parsed.search.slice(0, 80)}"`);
  }

  const modified = handler.replace(parsed.search, parsed.replace);
  writeFileSync(HANDLER, modified, 'utf8');

  return { applied: true, explanation: parsed.explanation };
}

// ── afterFix: typecheck + deploy ───────────────────────────────────────────────

async function afterFix() {
  process.stdout.write('\n  Typechecking...\n');
  try {
    await runCommand('npx', ['tsc', '--noEmit'], { cwd: CDK_DIR });
    process.stdout.write('  ✓ Typecheck passed\n');
  } catch {
    process.stdout.write('  ✗ Typecheck failed — review handler.ts before continuing\n');
    process.stdout.write('[WAITING_FOR_FIX]\n');
    await waitForContinue();
    await runCommand('npx', ['tsc', '--noEmit'], { cwd: CDK_DIR });
  }

  process.stdout.write('\n[DEPLOY_START]\n');
  process.stdout.write('  Deploying Lambda stack...\n');
  await runCommand(
    'npx',
    ['cdk', 'deploy', 'BobsLambdaStack', '--require-approval', 'never'],
    { cwd: CDK_DIR },
  );
  process.stdout.write('\n[DEPLOY_DONE]\n');
  process.stdout.write('  ✓ Deploy complete\n');
}

// ── Wait for manual continue ───────────────────────────────────────────────────

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

// ── Main ───────────────────────────────────────────────────────────────────────

await runLoop({
  ...CONFIG,

  applyFix: ANTHROPIC_API_KEY
    ? async (nextFixContent) => {
        try {
          return await applyFixWithClaude(nextFixContent);
        } catch (err) {
          process.stdout.write(`  ✗ Claude API fix failed: ${err.message}\n`);
          process.stdout.write('  Falling back to manual fix mode.\n');
          return { applied: false };
        }
      }
    : null,  // null = manual mode (loop will call waitForContinue internally)

  afterFix: async () => {
    await afterFix();
  },
});
