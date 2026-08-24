#!/usr/bin/env node
// ── task-sim ─────────────────────────────────────────────────────────────────
//
// Simulate one task expert end to end, ten times, against dev — then show the whole
// transcript with the problems marked inline.
//
// IT REPORTS. IT NEVER FIXES. Nothing in this tool writes to source, and no LLM is ever
// asked for a code change.
//
//   node scripts/task-sim/run.mjs --list            derivability for every task, free
//   node scripts/task-sim/run.mjs place-sale        10 sims, submit, full report
//   node scripts/task-sim/run.mjs place-sale --dry  1 sim, no submit, no reseed
//   node scripts/task-sim/run.mjs --report-only=<run.json>

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getFacts } from './src/facts.mjs';
import { listTasks } from './src/list.mjs';
import { resolveBase, makeApi, assertDevEnvironment } from './src/api.mjs';
import { deriveGoal, hashSeed } from './src/goal.mjs';
import { runSimulation } from './src/sim.mjs';
import { makePacer } from './src/pace.mjs';
import { judgeTranscript, judgeAnnotations } from './src/judge.mjs';
import { renderReport } from './src/report.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'runs');

function parseArgs(argv) {
  const a = { runs: 10, flags: new Set() };
  for (const raw of argv) {
    if (raw.startsWith('--')) {
      const [k, v] = raw.slice(2).split('=');
      if (v === undefined) a.flags.add(k); else a[k] = v;
    } else if (!a.taskId) a.taskId = raw;
  }
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.flags.has('list')) { process.exit(await listTasks(args.taskId) ? 1 : 0); }

  if (args['report-only']) {
    const run = JSON.parse(readFileSync(args['report-only'], 'utf8'));
    const out = args['report-only'].replace(/\.json$/, '.html');
    writeFileSync(out, renderReport(run));
    console.log(`re-rendered → ${out}`);
    return;
  }

  const facts = await getFacts();
  if (!args.taskId) {
    console.error('Usage: node scripts/task-sim/run.mjs <taskId> [--dry] [--runs=N]\n' +
                  '       node scripts/task-sim/run.mjs --list');
    process.exit(2);
  }
  const task = facts.TASKS.find(t => t.id === args.taskId);
  if (!task) { console.error(`Unknown task "${args.taskId}". Try --list.`); process.exit(2); }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY is required — it pays for the simulated customer and the advisory judge.\n' +
                  'The expert turns themselves bill through the Lambda\'s own key.');
    process.exit(2);
  }

  const dry = args.flags.has('dry');
  const runs = dry ? 1 : Number(args.runs ?? 10);
  const submit = !dry && !args.flags.has('no-submit');
  const reseed = !dry && !args.flags.has('no-reseed');
  const useJudge = !args.flags.has('no-judge');
  const seed = Number(args.seed ?? hashSeed(task.id));
  const base = resolveBase(args.api);          // throws on prod
  const api = makeApi(base);

  console.log(`\ntask-sim · ${task.name} (${task.id})`);
  console.log(`  ${base}`);
  console.log(`  ${runs} simulation${runs === 1 ? '' : 's'}${submit ? ', submitting' : ', NOT submitting'}${useJudge ? '' : ', no judge'}`);
  if (reseed) console.log('  ⚠ this resets ALL FOUR demo personas before each simulation');
  console.log('');

  if (reseed) {
    process.stdout.write('  verifying the dev environment … ');
    await assertDevEnvironment(api);
    console.log('ok');
  }

  const pace = makePacer({ tpm: Number(args.tpm ?? 24_000), log: s => console.log(s) });
  const sims = [];

  for (let i = 0; i < runs; i++) {
    process.stdout.write(`  sim ${i + 1}/${runs} … `);
    if (reseed) await api.reseed();

    // Derive against the LIVE post-reseed snapshot, rotating personas.
    const personaIds = ['demo-client-001', 'demo-client-002', 'demo-client-003', 'demo-client-004'];
    let goal = null, snapshot = null;
    for (let p = 0; p < personaIds.length && !goal; p++) {
      const id = personaIds[(i + p) % personaIds.length];
      const snap = await api.snapshot(id);
      for (let k = 0; k < 6 && !goal; k++) {
        const r = await deriveGoal(task, snap, seed + i * 977 + k);
        if (r.ok) { goal = r.goal; snapshot = snap; }
      }
    }
    if (!goal) { console.log('SKIPPED — no persona can satisfy this task'); continue; }
    goal.intentText = `${goal.clientName} wants to ${task.name.toLowerCase()}`;
    goal.taskName = task.name;

    const sim = await runSimulation({
      api, task, goal, snapshot, simIndex: i, apiKey, pace,
      submit, forceTask: i >= runs - 2 && runs > 2,   // last two forced, the rest natural
      maxTurns: Number(args['max-turns'] ?? 14),
    });
    sims.push(sim);
    console.log(sim.verdict.toUpperCase() + (sim.failedCount ? ` (${sim.failedCount})` : ''));
    if (sim.verdict === 'inconclusive') await pace.throttleHit();
  }

  if (useJudge) {
    console.log('\n  advisory pass …');
    for (const s of sims) {
      const { notes } = await judgeTranscript({
        apiKey, clientView: s.clientView, goal: s.goal, snapshot: s.after ?? s.before ?? {},
        alreadyFound: s.findings,
      });
      s.judgeNotes = notes;
      s.judgeAnnotations = judgeAnnotations(notes);
      await new Promise(r => setTimeout(r, 20_000));
    }
  }

  const run = {
    taskId: task.id, taskName: task.name, apiBase: base, seed,
    startedAt: new Date().toISOString(), sims,
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = path.join(OUT, `${task.id}-${stamp}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'run.json'), JSON.stringify(run, null, 2));
  writeFileSync(path.join(dir, 'report.html'), renderReport(run));

  const fail = sims.filter(s => s.verdict === 'fail').length;
  console.log(`\n  ${sims.filter(s => s.verdict === 'pass').length} passed · ${fail} failed · ` +
              `${sims.filter(s => s.verdict === 'inconclusive').length} inconclusive`);
  console.log(`\n  report → ${path.join(dir, 'report.html')}\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('\n' + (e.message ?? e) + '\n'); process.exit(2); });
