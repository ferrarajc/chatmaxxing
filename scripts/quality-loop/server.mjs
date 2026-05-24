/**
 * Quality Loop Dashboard — HTTP Server
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... [ANTHROPIC_API_KEY=sk-ant-...] node scripts/quality-loop/server.mjs
 *
 * Then open http://localhost:3456
 *
 * API endpoints:
 *   GET  /                  → dashboard UI
 *   GET  /api/status        → { running, phase, iteration, loopMode, waitingForFix, hasAnthropicKey }
 *   GET  /api/history       → array of all run records
 *   GET  /api/report/:n     → markdown content of report-NNN.md
 *   GET  /api/next-fix      → content of NEXT_FIX.md
 *   GET  /api/events        → SSE stream
 *   POST /api/run           → start single evaluation
 *   POST /api/loop          → start improvement loop
 *   POST /api/stop          → kill running process
 *   POST /api/continue      → signal improvement loop to continue (after manual fix)
 */

import http from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { resolveSecrets } from './secrets.mjs';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = path.resolve(__dirname, '..', '..');
const RESULTS    = path.join(__dirname, 'results');
const UI_FILE    = path.join(__dirname, 'ui', 'index.html');
const HISTORY    = path.join(RESULTS, 'history.json');
const LATEST     = path.join(RESULTS, 'latest.json');
const NEXT_FIX   = path.join(RESULTS, 'NEXT_FIX.md');
const ITER_FILE  = path.join(RESULTS, 'iteration.txt');

const PORT = parseInt(process.env.PORT ?? '3456', 10);

mkdirSync(RESULTS, { recursive: true });

// ── Server state ───────────────────────────────────────────────────────────────

let state = {
  running:         false,
  phase:           'Idle',
  iteration:       1,
  loopMode:        false,
  waitingForFix:   false,
  hasAnthropicKey: false,   // updated after resolveSecrets() runs
};

let child     = null;          // current child process
let sseClients = [];           // array of SSE response objects
let logBuffer  = [];           // last 500 lines

// ── History file ───────────────────────────────────────────────────────────────

function readHistory() {
  if (!existsSync(HISTORY)) return [];
  try { return JSON.parse(readFileSync(HISTORY, 'utf8')); } catch { return []; }
}

function appendHistory(record) {
  const hist = readHistory();
  // Replace record with same iteration if exists
  const idx = hist.findIndex(r => r.iteration === record.iteration);
  if (idx >= 0) hist[idx] = record;
  else hist.push(record);
  writeFileSync(HISTORY, JSON.stringify(hist, null, 2), 'utf8');
}

function buildHistoryRecord(latest) {
  if (!latest) return null;

  const highHeuristics = ['H3', 'H5', 'H8', 'H13'];
  const highFails = highHeuristics.filter(h => {
    const s = latest.heuristicStats?.[h];
    return s && s.fail > 0;
  });

  const totalScenarios = latest.scenarios?.length ?? 0;
  const failedScenarios = (latest.scenarios ?? []).filter(s =>
    Object.values(s.scores ?? {}).some(g => g === 'Fail'),
  ).length;

  const topFix = latest.criticalFailures?.length > 0
    ? latest.criticalFailures[0].heuristic
    : (highFails[0] ?? null);

  return {
    iteration:       latest.iteration,
    timestamp:       latest.timestamp ?? new Date().toISOString(),
    overallScore:    latest.overallScore,
    thresholdMet:    latest.thresholdMet,
    criticalFailures: latest.criticalFailures ?? [],
    highSeverityFails: highFails,
    heuristicStats:  latest.heuristicStats ?? {},
    scenarioCount:   totalScenarios,
    scenariosFailed: failedScenarios,
    topFix,
    reportFile:      `report-${String(latest.iteration).padStart(3, '0')}.md`,
  };
}

// ── SSE broadcast ──────────────────────────────────────────────────────────────

function broadcast(type, data) {
  const payload = JSON.stringify({ type, ...data });
  const msg = `data: ${payload}\n\n`;
  sseClients = sseClients.filter(res => {
    try { res.write(msg); return true; } catch { return false; }
  });
}

function log(line) {
  logBuffer.push(line);
  if (logBuffer.length > 500) logBuffer.shift();
  broadcast('log', { text: line });
}

// ── Parse child stdout for control markers ─────────────────────────────────────

function parseChildLine(line) {
  if (line.includes('[WAITING_FOR_FIX]')) {
    state.waitingForFix = true;
    state.phase = 'Waiting for fix';
    broadcast('waiting_for_fix', { nextFix: readNextFix() });
    broadcast('status', { ...state });
    return;
  }
  if (line.includes('[FIX_APPLIED]')) {
    state.waitingForFix = false;
    state.phase = 'Fix applied';
    broadcast('status', { ...state });
    return;
  }
  if (line.includes('[DEPLOY_START]')) {
    state.phase = 'Deploying Lambda stack';
    broadcast('status', { ...state });
    return;
  }
  if (line.includes('[DEPLOY_DONE]')) {
    state.phase = 'Deploy complete';
    broadcast('status', { ...state });
    return;
  }
  if (line.includes('[THRESHOLD_MET]')) {
    state.phase = 'Threshold met!';
    broadcast('threshold_met', {});
    broadcast('status', { ...state });
    return;
  }
  if (line.includes('[MAX_ITERATIONS]')) {
    state.phase = 'Max iterations reached';
    broadcast('status', { ...state });
    return;
  }
  const iterMatch = line.match(/\[ITERATION_COMPLETE (\d+) ([\d.]+)\]/);
  if (iterMatch) {
    state.iteration = parseInt(iterMatch[1], 10);
    state.phase = `Iteration ${iterMatch[1]} complete (score: ${(parseFloat(iterMatch[2]) * 100).toFixed(0)}%)`;
    // Read and record results
    try {
      const latest = JSON.parse(readFileSync(LATEST, 'utf8'));
      const record = buildHistoryRecord(latest);
      if (record) {
        appendHistory(record);
        broadcast('run_complete', { record });
      }
    } catch {}
    broadcast('status', { ...state });
    return;
  }
  // Phase detection from output lines
  if (line.includes('Phase 1')) { state.phase = 'Phase 1 — Driving conversations'; broadcast('status', { ...state }); }
  else if (line.includes('Phase 2')) { state.phase = 'Phase 2 — Evaluating quality'; broadcast('status', { ...state }); }
  else if (line.includes('Phase 3')) { state.phase = 'Phase 3 — Writing reports'; broadcast('status', { ...state }); }
}

// ── Spawn child process ────────────────────────────────────────────────────────

function spawnChild(mode) {
  if (child) return false;  // already running

  const script = mode === 'loop'
    ? 'scripts/quality-loop/improvement-loop.mjs'
    : 'scripts/quality-loop/run-quality-loop.mjs';

  logBuffer = [];
  state.running   = true;
  state.loopMode  = mode === 'loop';
  state.phase     = 'Starting…';
  state.waitingForFix = false;
  broadcast('status', { ...state });

  child = spawn(process.execPath, [script], {
    cwd: REPO_ROOT,
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let lineBuffer = '';
  const onData = (data) => {
    const text = data.toString();
    lineBuffer += text;
    const lines = lineBuffer.split('\n');
    lineBuffer = lines.pop(); // keep incomplete last line
    for (const line of lines) {
      log(line);
      parseChildLine(line);
    }
  };

  child.stdout.on('data', onData);
  child.stderr.on('data', onData);

  child.on('close', (code) => {
    if (lineBuffer) { log(lineBuffer); parseChildLine(lineBuffer); lineBuffer = ''; }

    // On single-run completion, capture results
    if (mode === 'run') {
      try {
        const latest = JSON.parse(readFileSync(LATEST, 'utf8'));
        const record = buildHistoryRecord(latest);
        if (record) {
          appendHistory(record);
          broadcast('run_complete', { record });
        }
      } catch {}
    }

    state.running  = false;
    state.loopMode = false;
    state.phase    = code === 0 ? 'Complete ✓' : `Finished (exit ${code})`;
    child = null;
    broadcast('status', { ...state });
    log(`\n[Process exited with code ${code}]`);
  });

  return true;
}

// ── Utility: read files safely ─────────────────────────────────────────────────

function readNextFix() {
  try { return readFileSync(NEXT_FIX, 'utf8'); } catch { return ''; }
}

function readIteration() {
  if (!existsSync(ITER_FILE)) return 1;
  const n = parseInt(readFileSync(ITER_FILE, 'utf8').trim(), 10);
  return isNaN(n) ? 1 : n;
}

// ── HTTP router ────────────────────────────────────────────────────────────────

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => resolve(body));
  });
}

const server = http.createServer(async (req, res) => {
  // CORS for dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const urlObj = new URL(req.url, `http://localhost`);
  const p = urlObj.pathname;

  // ── Serve UI ──────────────────────────────────────────────────────────────
  if (req.method === 'GET' && p === '/') {
    try {
      const html = readFileSync(UI_FILE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch {
      res.writeHead(500); res.end('UI file not found: ' + UI_FILE);
    }
    return;
  }

  // ── Status ────────────────────────────────────────────────────────────────
  if (req.method === 'GET' && p === '/api/status') {
    return json(res, { ...state, iteration: readIteration() });
  }

  // ── History ───────────────────────────────────────────────────────────────
  if (req.method === 'GET' && p === '/api/history') {
    return json(res, readHistory());
  }

  // ── Report file ───────────────────────────────────────────────────────────
  if (req.method === 'GET' && p.startsWith('/api/report/')) {
    const name = path.basename(p.replace('/api/report/', ''));
    const file = path.join(RESULTS, name);
    try {
      const md = readFileSync(file, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(md);
    } catch {
      res.writeHead(404); res.end('Report not found');
    }
    return;
  }

  // ── NEXT_FIX ──────────────────────────────────────────────────────────────
  if (req.method === 'GET' && p === '/api/next-fix') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(readNextFix());
    return;
  }

  // ── Log buffer ────────────────────────────────────────────────────────────
  if (req.method === 'GET' && p === '/api/logs') {
    return json(res, { logs: logBuffer });
  }

  // ── SSE stream ────────────────────────────────────────────────────────────
  if (req.method === 'GET' && p === '/api/events') {
    res.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    });
    res.write(':\n\n'); // comment to establish connection
    sseClients.push(res);

    // Send current state immediately
    res.write(`data: ${JSON.stringify({ type: 'status', ...state, iteration: readIteration() })}\n\n`);

    req.on('close', () => {
      sseClients = sseClients.filter(c => c !== res);
    });
    return;
  }

  // ── Start single evaluation ───────────────────────────────────────────────
  if (req.method === 'POST' && p === '/api/run') {
    if (state.running) return json(res, { error: 'Already running' }, 409);
    spawnChild('run');
    return json(res, { started: true });
  }

  // ── Start improvement loop ────────────────────────────────────────────────
  if (req.method === 'POST' && p === '/api/loop') {
    if (state.running) return json(res, { error: 'Already running' }, 409);
    spawnChild('loop');
    return json(res, { started: true });
  }

  // ── Stop ──────────────────────────────────────────────────────────────────
  if (req.method === 'POST' && p === '/api/stop') {
    if (child) {
      child.kill('SIGTERM');
      setTimeout(() => { if (child) child.kill('SIGKILL'); }, 3000);
    }
    return json(res, { stopped: true });
  }

  // ── Continue (after manual fix) ───────────────────────────────────────────
  if (req.method === 'POST' && p === '/api/continue') {
    if (child && state.waitingForFix) {
      child.stdin.write('\n');
      state.waitingForFix = false;
      state.phase = 'Resuming…';
      broadcast('status', { ...state });
    }
    return json(res, { ok: true });
  }

  res.writeHead(404); res.end('Not found');
});

// ── Start ──────────────────────────────────────────────────────────────────────

await resolveSecrets();

state.iteration      = readIteration();
state.hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

server.listen(PORT, () => {
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  Quality Loop Dashboard`);
  console.log(`  http://localhost:${PORT}`);
  if (!process.env.OPENAI_API_KEY) console.log(`  ⚠  OPENAI_API_KEY not found — evaluations will fail`);
  if (!process.env.ANTHROPIC_API_KEY) console.log(`  ℹ  No ANTHROPIC_API_KEY — loop will require manual fixes`);
  console.log(`${'═'.repeat(50)}\n`);
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') console.error(`Port ${PORT} is in use. Try PORT=3457 node server.mjs`);
  else console.error('Server error:', err);
  process.exit(1);
});
