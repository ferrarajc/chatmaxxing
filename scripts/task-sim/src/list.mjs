// ── `--list`: derivability report, offline and free ──────────────────────────
//
// For every task in the registry, work out whether the goal deriver can produce a
// satisfiable ask, and against which personas. Costs nothing — no network, no LLM —
// so it is the first thing to run after adding a task, and the honest answer to
// "does this tool really work for FUTURE experts?".

import { getFacts } from './facts.mjs';
import { seededPersonas } from './personas.mjs';
import { deriveGoal, hashSeed } from './goal.mjs';

const GREEN = s => `\x1b[32m${s}\x1b[0m`;
const RED   = s => `\x1b[31m${s}\x1b[0m`;
const DIM   = s => `\x1b[2m${s}\x1b[0m`;

export async function listTasks(only) {
  const facts = await getFacts();
  const personas = await seededPersonas();
  const tasks = only ? facts.TASKS.filter(t => t.id === only) : facts.TASKS;

  console.log('\nTask-expert derivability — offline, no API calls, no cost\n');
  console.log(`  ${'task'.padEnd(30)} ${'personas'.padEnd(10)} fields`);
  console.log(`  ${'-'.repeat(30)} ${'-'.repeat(10)} ${'-'.repeat(40)}`);

  let blocked = 0;
  for (const task of tasks) {
    const ok = [];
    const reasons = new Set();

    for (const p of personas) {
      // Try a few seeds — a persona can fail on one random draw but succeed on another.
      let good = false;
      for (let k = 0; k < 6 && !good; k++) {
        const r = await deriveGoal(task, p, hashSeed(task.id + p.clientId + k));
        if (r.ok) good = true;
        else reasons.add(r.missing?.length ? `needs override: ${r.missing.join(', ')}` : r.reason);
      }
      if (good) ok.push(p.name.split(' ')[0]);
    }

    const status = ok.length ? GREEN(`${ok.length}/4`) : RED('none');
    const who = ok.length ? DIM(ok.join(', ')) : RED([...reasons][0] ?? 'underivable');
    console.log(`  ${task.id.padEnd(30)} ${status.padEnd(19)} ${who}`);
    if (!ok.length) blocked++;
  }

  console.log('');
  if (blocked) {
    console.log(RED(`  ${blocked} task(s) cannot be simulated yet — add an entry to src/goal-overrides.mjs.`));
  } else {
    console.log(GREEN('  Every task in the registry can be simulated.'));
  }
  console.log('');
  return blocked;
}
