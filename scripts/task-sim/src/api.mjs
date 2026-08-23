// ── Dev API access, with a prod guard that has no override ───────────────────
//
// This tool SUBMITS. It writes real holdings, real balances, real transaction rows, and
// it reseeds the whole client table between simulations. Pointed at prod it would wipe
// live demo data ten times in a run.
//
// Every existing harness in lambda/tests defaults to PROD and lets `LAMBDA_URL` redirect
// it. That was survivable when they only ever called /autopilot-turn, which is read-only.
// It is not survivable here, so:
//
//   1. The default is DEV, hardcoded.
//   2. `LAMBDA_URL` is deliberately NOT read — that env var is exactly how the old
//      harnesses ended up aimed at production.
//   3. The prod host is on a blocklist that no flag can lift.
//
// Disabling the guard requires editing this file, which is the point.

const DEV_BASE  = 'https://1cppcq9q57.execute-api.us-east-1.amazonaws.com';
const PROD_HOST = '0y3s5vq2v5.execute-api.us-east-1.amazonaws.com';
const RESET_KEY = 'bobs-reset-2025';

/** The seed value of Alex's portfolio — a fingerprint for "this really is dev, freshly reseeded". */
export const SEED_TOTAL_ALEX = 241570;

export function resolveBase(explicit) {
  const base = (explicit ?? DEV_BASE).replace(/\/+$/, '');
  let host;
  try { host = new URL(base).host; } catch { throw new Error(`--api is not a URL: ${base}`); }

  if (host === PROD_HOST) {
    throw new Error(
      'REFUSING TO RUN AGAINST PRODUCTION.\n' +
      '  This tool submits real actions and reseeds all client data between simulations.\n' +
      `  ${base} is the prod API. There is no flag to override this.`,
    );
  }
  if (!/\.execute-api\.[a-z0-9-]+\.amazonaws\.com$/.test(host)) {
    throw new Error(`REFUSING: ${host} is not a Bob's API Gateway host.`);
  }
  return base;
}

async function postJson(base, path, body, { timeoutMs = 120_000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${path} HTTP ${res.status}: ${text.slice(0, 300)}`);
    try { return JSON.parse(text); } catch { throw new Error(`${path} returned non-JSON: ${text.slice(0, 200)}`); }
  } finally {
    clearTimeout(timer);
  }
}

export function makeApi(base) {
  return {
    base,

    /** One task-expert turn. Mirrors exactly what ChatColumn.tsx POSTs. */
    autopilotTurn: ({ transcript, clientProfile, currentIntent, forceTaskId }) =>
      postJson(base, '/autopilot-turn', {
        transcript, clientProfile,
        scope: 'get-intent',
        currentIntent,
        ...(forceTaskId ? { forceTaskId } : {}),
      }),

    /** Submit the proposed action. This WRITES. */
    executeTask: ({ taskId, clientId, fields }) =>
      postJson(base, '/execute-task', { taskId, clientId, fields }),

    /** Full client record — the before/after ledger snapshot. */
    snapshot: clientId => postJson(base, '/client-data', { action: 'get-all', clientId }),

    /** Reseed. Resets ALL FOUR personas — there is no per-client mode. */
    async reseed() {
      const res = await fetch(`${base}/reset-client-data?key=${RESET_KEY}`, { method: 'GET' });
      const text = await res.text();
      if (!res.ok || !/reset successfully/i.test(text)) {
        throw new Error(`reseed failed (HTTP ${res.status}): ${text.slice(0, 200)}`);
      }
      return true;
    },
  };
}

/**
 * Prove we are talking to a freshly-reseeded dev environment before spending a token.
 * Catches "pointed at a stack I don't understand" far more cheaply than a failed run.
 */
export async function assertDevEnvironment(api) {
  await api.reseed();
  const alex = await api.snapshot('demo-client-001');
  if (alex?.totalBalance !== SEED_TOTAL_ALEX) {
    throw new Error(
      `Environment check failed: expected Alex's totalBalance to be ${SEED_TOTAL_ALEX} ` +
      `immediately after a reseed, got ${alex?.totalBalance}. ` +
      `This does not look like the dev environment.`,
    );
  }
  return true;
}
