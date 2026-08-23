/**
 * Unit test for the goal deriver — offline, no network, no LLM, no cost.
 *
 * The deriver is the load-bearing piece: if it produces an ask the persona cannot
 * satisfy, every downstream assertion is measuring the wrong thing. These checks assert
 * SATISFIABILITY against the real seed data, which is what the old harnesses got wrong —
 * they used fabricated client ids (`test-005`) that exist in no table, so the
 * holdings-gated sell prompt had nothing to offer.
 *
 * Usage:
 *   node scripts/task-sim/test-goal.mjs
 */

import { getFacts } from './src/facts.mjs';
import { seededPersonas } from './src/personas.mjs';
import { deriveGoal, hashSeed } from './src/goal.mjs';

let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {
  if (ok) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}${detail ? `  — ${detail}` : ''}`); }
};
const group = (n, fn) => { console.log(`\n${n}`); return fn(); };

const facts = await getFacts();
const personas = await seededPersonas();
const byId = Object.fromEntries(personas.map(p => [p.clientId, p]));
const task = id => facts.TASKS.find(t => t.id === id);

async function firstGoal(taskId, clientId, tries = 8) {
  for (let k = 0; k < tries; k++) {
    const r = await deriveGoal(task(taskId), byId[clientId], hashSeed(taskId + clientId + k));
    if (r.ok) return r.goal;
  }
  return null;
}

await group('Every task is derivable for at least one persona', async () => {
  for (const t of facts.TASKS) {
    let any = false;
    for (const p of personas) if (await firstGoal(t.id, p.clientId, 6)) { any = true; break; }
    check(t.id, any, 'no persona could satisfy it');
  }
});

await group('A sale only ever asks for a fund the persona actually HOLDS', async () => {
  for (const p of personas) {
    const g = await firstGoal('place-sale', p.clientId);
    if (!g) continue;
    const held = p.holdings.filter(h => h.accountId === g.account.id).map(h => h.ticker);
    check(`${p.name}: ${g.byKey.fund} in ${g.account.id}`,
      held.includes(g.byKey.fund), `holds [${held.join(', ')}]`);
  }
});

await group('A sale never asks for more than the position is worth', async () => {
  for (const p of personas) {
    const g = await firstGoal('place-sale', p.clientId);
    if (!g) continue;
    const asked = facts.resolveAmount(g.byKey.amount, g.position.value);
    check(`${p.name}: ${g.byKey.amount} of a $${g.position.value} position`,
      asked <= g.position.value + 0.5, `asked ${asked} > ${g.position.value}`);
  }
});

await group('A cash-funded purchase never exceeds available cash', async () => {
  let seen = 0;
  for (const p of personas) {
    for (let k = 0; k < 12; k++) {
      const r = await deriveGoal(task('place-purchase'), p, hashSeed('pp' + p.clientId + k));
      if (!r.ok || !/cash/i.test(r.goal.byKey.fundingSource ?? '')) continue;
      seen++;
      const cash = facts.cashOf(r.goal.account, p.holdings);
      const asked = facts.parseMoney(r.goal.byKey.amount);
      check(`${p.name}: ${r.goal.byKey.amount} from $${cash} cash`,
        asked <= cash + 0.5, `asked ${asked} > cash ${cash}`);
      break;
    }
  }
  check('at least one cash-funded goal was generated', seen > 0, `saw ${seen}`);
});

await group('The account is always a real, resolvable account', async () => {
  for (const t of facts.TASKS) {
    for (const p of personas) {
      const g = await firstGoal(t.id, p.clientId, 4);
      if (!g?.byKey.accountId) continue;
      const resolved = facts.resolveAccount(p.accounts, g.byKey.accountId);
      check(`${t.id} / ${p.name}: ${g.byKey.accountId}`, resolved?.id === g.byKey.accountId,
        `resolved to ${resolved?.id ?? 'null'}`);
      break;
    }
  }
});

await group('Preconditions are respected, not guessed', async () => {
  check('Maria (no auto-invest schedule) cannot drive update-auto-invest',
    (await firstGoal('update-auto-invest', 'demo-client-002')) === null);
  check('Robert (two schedules) can', (await firstGoal('update-auto-invest', 'demo-client-004')) !== null);
  check('Jordan (no Traditional/SEP) cannot drive roth-conversion',
    (await firstGoal('roth-conversion', 'demo-client-003')) === null);
  check('Maria (no Roth to convert INTO) cannot either',
    (await firstGoal('roth-conversion', 'demo-client-002')) === null);
  // Regression: a field's requiresAccountTypes must not constrain ACCOUNT choice.
  // taxWithholding requires Traditional/SEP, but a taxable-account withdrawal is valid.
  check('Jordan (Roth + Taxable) CAN take a distribution',
    (await firstGoal('request-withdrawal', 'demo-client-003')) !== null,
    'a field-level requiresAccountTypes is leaking into account selection');
});

await group('Derivation is deterministic for a given seed', async () => {
  const a = await deriveGoal(task('place-sale'), byId['demo-client-003'], 12345);
  const b = await deriveGoal(task('place-sale'), byId['demo-client-003'], 12345);
  check('same seed → same goal', JSON.stringify(a) === JSON.stringify(b));
  const c = await deriveGoal(task('place-sale'), byId['demo-client-003'], 999);
  check('different seed → different goal (usually)',
    JSON.stringify(a) !== JSON.stringify(c) || a.ok === false);
});

console.log(`\n${failed === 0 ? '✓ PASS' : '✗ FAIL'} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
