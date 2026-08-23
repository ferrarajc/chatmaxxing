// ── Persona snapshots ────────────────────────────────────────────────────────
//
// A live run reads these from the dev API after a reseed. But derivability can be
// checked, and the goal deriver unit-tested, against the SEED data offline — no
// network, no key, no cost. That is what makes `--list` free.
//
// The seed is the same source `/reset-client-data` writes, so an offline check and a
// live run agree by construction.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from './facts.mjs';

let cached = null;

/** The four seeded personas, shaped like a /client-data get-all snapshot. */
export async function seededPersonas() {
  if (cached) return cached;
  const outDir = mkdtempSync(path.join(tmpdir(), 'task-sim-seed-'));
  const outFile = path.join(outDir, 'client-defaults.mjs');
  execFileSync('npx', ['esbuild', path.join(REPO_ROOT, 'lambda/shared/client-defaults.ts'),
    '--bundle', '--platform=node', '--format=esm', `--outfile=${outFile}`, '--log-level=error'], {
    cwd: REPO_ROOT, shell: process.platform === 'win32', stdio: 'inherit',
  });
  const mod = await import(pathToFileURL(outFile).href);
  rmSync(outDir, { recursive: true, force: true });

  cached = Object.values(mod.DEFAULT_CLIENT_DATA).map(c => ({
    clientId: c.clientId,
    name: c.name,
    pronouns: c.pronouns,
    phone: c.phone,
    accounts: c.accounts,
    holdings: c.holdings,
    beneficiaries: c.beneficiaries,
    autoInvest: c.autoInvest,
    rmd: c.rmd,
    totalBalance: c.totalBalance,
  }));
  return cached;
}

/**
 * The clientProfile shape the AGENT APP sends to /autopilot-turn.
 * Deliberately carries NO holdings — the agent-app mirror doesn't have them, which is
 * exactly why fetchHoldings() exists in the handler. Sending holdings here would make
 * the simulator easier for the expert than production is.
 */
export function toClientProfile(snapshot) {
  return {
    clientId: snapshot.clientId,
    name: snapshot.name,
    pronouns: snapshot.pronouns,
    phone: snapshot.phone,
    accounts: snapshot.accounts.map(a => ({
      type: a.type, balance: a.balance, cash: a.cash, id: a.id,
    })),
    totalBalance: snapshot.totalBalance,
    recentChatHistory: [],
  };
}
