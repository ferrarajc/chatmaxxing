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
import {
  HEURISTICS_FILE,
  APP_PROFILE_FILE,
  SCENARIOS_FILE,
  CLIENT_PROFILES_FILE,
} from './heqya.config.mjs';

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

// ── Heuristics CRUD ────────────────────────────────────────────────────────────

function readHeuristics() {
  if (!existsSync(HEURISTICS_FILE)) return [];
  try { return JSON.parse(readFileSync(HEURISTICS_FILE, 'utf8')); } catch { return []; }
}

function writeHeuristics(arr) {
  writeFileSync(HEURISTICS_FILE, JSON.stringify(arr, null, 2), 'utf8');
}

// ── App Profile CRUD ───────────────────────────────────────────────────────────

function readAppProfile() {
  if (!existsSync(APP_PROFILE_FILE)) return {};
  try { return JSON.parse(readFileSync(APP_PROFILE_FILE, 'utf8')); } catch { return {}; }
}

function writeAppProfile(data) {
  writeFileSync(APP_PROFILE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ── Scenarios CRUD (raw JSON, clientKey not hydrated) ──────────────────────────

function readScenariosFile() {
  if (!existsSync(SCENARIOS_FILE)) return [];
  try { return JSON.parse(readFileSync(SCENARIOS_FILE, 'utf8')); } catch { return []; }
}

function writeScenariosFile(arr) {
  writeFileSync(SCENARIOS_FILE, JSON.stringify(arr, null, 2), 'utf8');
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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

  // ── Heuristics: list all ──────────────────────────────────────────────────
  if (req.method === 'GET' && p === '/api/heuristics') {
    return json(res, readHeuristics());
  }

  // ── Heuristics: create new ────────────────────────────────────────────────
  if (req.method === 'POST' && p === '/api/heuristics') {
    const body = await readBody(req);
    let h;
    try { h = JSON.parse(body); } catch { return json(res, { error: 'Invalid JSON' }, 400); }
    if (!h.code || !h.name) return json(res, { error: 'code and name are required' }, 400);
    const arr = readHeuristics();
    if (arr.find(x => x.code === h.code)) return json(res, { error: `Code ${h.code} already exists` }, 409);
    const newH = {
      code:          h.code.trim().toUpperCase(),
      name:          h.name.trim(),
      severity:      h.severity ?? 'Medium',
      weight:        Number(h.weight ?? 1),
      criterion:     h.criterion ?? '',
      failureSignals: h.failureSignals ?? '',
      fixGuidance:   h.fixGuidance ?? '',
    };
    arr.push(newH);
    writeHeuristics(arr);
    broadcast('heuristics_updated', { heuristics: arr });
    return json(res, newH, 201);
  }

  // ── Heuristics: update one ────────────────────────────────────────────────
  if (req.method === 'PUT' && p.startsWith('/api/heuristics/')) {
    const code = p.replace('/api/heuristics/', '').toUpperCase();
    const body = await readBody(req);
    let patch;
    try { patch = JSON.parse(body); } catch { return json(res, { error: 'Invalid JSON' }, 400); }
    const arr = readHeuristics();
    const idx = arr.findIndex(x => x.code === code);
    if (idx < 0) return json(res, { error: `Heuristic ${code} not found` }, 404);
    arr[idx] = {
      ...arr[idx],
      name:          patch.name          ?? arr[idx].name,
      severity:      patch.severity      ?? arr[idx].severity,
      weight:        Number(patch.weight ?? arr[idx].weight),
      criterion:     patch.criterion     ?? arr[idx].criterion,
      failureSignals: patch.failureSignals ?? arr[idx].failureSignals,
      fixGuidance:   patch.fixGuidance   ?? arr[idx].fixGuidance,
    };
    writeHeuristics(arr);
    broadcast('heuristics_updated', { heuristics: arr });
    return json(res, arr[idx]);
  }

  // ── Heuristics: delete one ────────────────────────────────────────────────
  if (req.method === 'DELETE' && p.startsWith('/api/heuristics/')) {
    const code = p.replace('/api/heuristics/', '').toUpperCase();
    const arr  = readHeuristics();
    const idx  = arr.findIndex(x => x.code === code);
    if (idx < 0) return json(res, { error: `Heuristic ${code} not found` }, 404);
    arr.splice(idx, 1);
    writeHeuristics(arr);
    broadcast('heuristics_updated', { heuristics: arr });
    return json(res, { deleted: code });
  }

  // ── App profile: get ──────────────────────────────────────────────────────
  if (req.method === 'GET' && p === '/api/app-profile') {
    return json(res, readAppProfile());
  }

  // ── App profile: update ───────────────────────────────────────────────────
  if (req.method === 'PUT' && p === '/api/app-profile') {
    const body = await readBody(req);
    let data;
    try { data = JSON.parse(body); } catch { return json(res, { error: 'Invalid JSON' }, 400); }
    const existing = readAppProfile();
    const updated  = { ...existing, ...data };
    writeAppProfile(updated);
    broadcast('app_profile_updated', { profile: updated });
    return json(res, updated);
  }

  // ── Scenarios: list all ───────────────────────────────────────────────────
  if (req.method === 'GET' && p === '/api/scenarios') {
    return json(res, readScenariosFile());
  }

  // ── Scenarios: AI generate (must be before POST /api/scenarios) ───────────
  if (req.method === 'POST' && p === '/api/scenarios/generate') {
    const body = await readBody(req);
    let params;
    try { params = JSON.parse(body); } catch { return json(res, { error: 'Invalid JSON' }, 400); }

    const count      = Math.min(Math.max(parseInt(params.count ?? 3, 10), 1), 10);
    const userPrompt = params.prompt ?? '';
    const apiKey     = process.env.OPENAI_API_KEY;
    if (!apiKey) return json(res, { error: 'OPENAI_API_KEY not set' }, 503);

    const appProfile  = readAppProfile();
    const heuristics  = readHeuristics();
    const existing    = readScenariosFile();

    // Strip heavy customerPrompt from examples to save tokens
    const examples = existing.map(s => ({
      id: s.id, scope: s.scope, clientKey: s.clientKey,
      openingMessage: s.openingMessage, maxTurns: s.maxTurns, notes: s.notes,
    }));

    const responsibilities = Array.isArray(appProfile.responsibilities)
      ? appProfile.responsibilities.join('; ')
      : (appProfile.responsibilities ?? '');

    const systemPrompt = [
      `You are a QA engineer designing multiturn chatbot test scenarios for a conversation quality evaluator.`,
      ``,
      `CHATBOT BEING TESTED: ${appProfile.name ?? 'AI Chatbot'}`,
      `DESCRIPTION: ${appProfile.description ?? ''}`,
      `RESPONSIBILITIES: ${responsibilities}`,
      `USERS: ${appProfile.userDescription ?? ''}`,
      ``,
      `HEURISTICS BEING EVALUATED:`,
      ...heuristics.map(h => `- ${h.code}: ${h.name} (${h.severity}) — ${(h.criterion ?? '').slice(0, 120)}`),
      ``,
      `AVAILABLE CLIENT PROFILES (use as clientKey): alex, maria, jordan, robert. Set to null for generic.`,
      ``,
      `Return ONLY a JSON object with key "scenarios" containing an array of scenario objects.`,
      `Each scenario object MUST have:`,
      `  id           — unique kebab-case slug (no spaces, no special chars)`,
      `  clientKey    — "alex" | "maria" | "jordan" | "robert" | null`,
      `  scope        — "get-intent" | "full-auto"`,
      `  currentIntent — short intent string for get-intent scope, null for full-auto`,
      `  openingMessage — the first message the customer sends (1-2 sentences)`,
      `  customerPrompt — detailed system prompt for the LLM playing the customer. Include: personality, age/role, specific goal, what to say in different situations (if asked X, say Y). End with "Do NOT end the conversation yourself."`,
      `  maxTurns     — integer max turns before giving up (default 10; use higher for complex multi-step scenarios)`,
      `  notes        — 1-2 sentence description of what this scenario tests and why`,
    ].join('\n');

    const userMessage = [
      `Existing scenarios (do NOT repeat IDs or opening messages):`,
      JSON.stringify(examples, null, 2),
      ``,
      `Generate exactly ${count} new, distinct scenarios that: ${userPrompt || 'cover different aspects and failure modes not already tested'}`,
      ``,
      `Requirements:`,
      `- Each scenario must target a different situation from the existing ones`,
      `- customerPrompt must be realistic and specific, giving the LLM clear rules for what to say`,
      `- Vary the scope (include at least one full-auto if count > 2)`,
      `- Set maxTurns appropriately: 6-8 for simple lookups, 10 for standard changes, 12-14 for complex multi-step requests`,
    ].join('\n');

    try {
      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model:           process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
          messages:        [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
          response_format: { type: 'json_object' },
          temperature:     0.85,
          max_tokens:      4000,
        }),
      });
      if (!openaiRes.ok) {
        const errText = await openaiRes.text();
        return json(res, { error: `OpenAI error: ${errText.slice(0, 300)}` }, 502);
      }
      const data    = await openaiRes.json();
      const content = data.choices[0]?.message?.content ?? '{}';
      const parsed  = JSON.parse(content);
      return json(res, { scenarios: parsed.scenarios ?? [] });
    } catch (err) {
      return json(res, { error: err.message }, 500);
    }
  }

  // ── Scenarios: create ─────────────────────────────────────────────────────
  if (req.method === 'POST' && p === '/api/scenarios') {
    const body = await readBody(req);
    let s;
    try { s = JSON.parse(body); } catch { return json(res, { error: 'Invalid JSON' }, 400); }
    if (!s.id || !s.openingMessage) return json(res, { error: 'id and openingMessage are required' }, 400);
    const arr = readScenariosFile();
    if (arr.find(x => x.id === s.id)) return json(res, { error: `Scenario id "${s.id}" already exists` }, 409);
    const newS = {
      id:            s.id.trim().toLowerCase().replace(/\s+/g, '-'),
      clientKey:     s.clientKey     ?? null,
      scope:         s.scope         ?? 'get-intent',
      currentIntent: s.currentIntent ?? null,
      openingMessage: s.openingMessage.trim(),
      customerPrompt: s.customerPrompt ?? '',
      maxTurns:      s.maxTurns      != null ? parseInt(s.maxTurns, 10) : null,
      notes:         s.notes         ?? '',
    };
    arr.push(newS);
    writeScenariosFile(arr);
    broadcast('scenarios_updated', { scenarios: arr });
    return json(res, newS, 201);
  }

  // ── Scenarios: update one ─────────────────────────────────────────────────
  if (req.method === 'PUT' && p.startsWith('/api/scenarios/')) {
    const id   = decodeURIComponent(p.replace('/api/scenarios/', ''));
    const body = await readBody(req);
    let patch;
    try { patch = JSON.parse(body); } catch { return json(res, { error: 'Invalid JSON' }, 400); }
    const arr = readScenariosFile();
    const idx = arr.findIndex(x => x.id === id);
    if (idx < 0) return json(res, { error: `Scenario "${id}" not found` }, 404);
    arr[idx] = {
      ...arr[idx],
      clientKey:     patch.clientKey     !== undefined ? patch.clientKey     : arr[idx].clientKey,
      scope:         patch.scope         ?? arr[idx].scope,
      currentIntent: patch.currentIntent !== undefined ? patch.currentIntent : arr[idx].currentIntent,
      openingMessage: patch.openingMessage ?? arr[idx].openingMessage,
      customerPrompt: patch.customerPrompt ?? arr[idx].customerPrompt,
      maxTurns:      patch.maxTurns      != null ? parseInt(patch.maxTurns, 10) : arr[idx].maxTurns ?? null,
      notes:         patch.notes         ?? arr[idx].notes,
    };
    writeScenariosFile(arr);
    broadcast('scenarios_updated', { scenarios: arr });
    return json(res, arr[idx]);
  }

  // ── Scenarios: delete one ─────────────────────────────────────────────────
  if (req.method === 'DELETE' && p.startsWith('/api/scenarios/')) {
    const id  = decodeURIComponent(p.replace('/api/scenarios/', ''));
    const arr = readScenariosFile();
    const idx = arr.findIndex(x => x.id === id);
    if (idx < 0) return json(res, { error: `Scenario "${id}" not found` }, 404);
    arr.splice(idx, 1);
    writeScenariosFile(arr);
    broadcast('scenarios_updated', { scenarios: arr });
    return json(res, { deleted: id });
  }

  // ── Transcripts: get by iteration ────────────────────────────────────────
  if (req.method === 'GET' && p.startsWith('/api/transcripts/')) {
    const n   = p.replace('/api/transcripts/', '');
    const num = parseInt(n, 10);
    if (isNaN(num)) return json(res, { error: 'Invalid iteration' }, 400);
    const file = path.join(RESULTS, `transcripts-${String(num).padStart(3, '0')}.json`);
    try {
      const data = JSON.parse(readFileSync(file, 'utf8'));
      return json(res, data);
    } catch {
      return json(res, null);  // null = no transcript file for this iteration
    }
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
