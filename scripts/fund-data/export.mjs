#!/usr/bin/env node
// ── Fund-data static-cache exporter ─────────────────────────────────────────
// Pulls the page-ready fund market payloads from the fund-market API and writes
// them as static JSON files ({TICKER}.json ×N + summary.json + meta.json). The
// nightly GitHub workflow publishes the output to gh-pages /fund-data so fund
// pages load real data same-origin with zero latency; locally the same script
// fills customer-app/public/fund-data/ (gitignored) for `npm run dev`.
//
//   Usage:  API_URL=https://<api> node scripts/fund-data/export.mjs [--trigger] --out <dir>
//
//   --trigger  First call GET /refresh-fund-data?ifStaleMinutes=120 (a no-op if
//              the nightly EventBridge refresh already ran) and poll the run to
//              completion before exporting.
//
// Failure policy: validate EVERY payload before writing ANY file, and exit
// non-zero on any problem — the workflow then fails and the previously
// published files stay live (the gh-pages publish uses keep_files).

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const API_URL = (process.env.API_URL ?? '').replace(/\/$/, '');
const KEY = 'bobs-reset-2025';
const POLL_INTERVAL_MS = 10_000;
const POLL_TIMEOUT_MS = 10 * 60_000;

const args = process.argv.slice(2);
const TRIGGER = args.includes('--trigger');
const outIdx = args.indexOf('--out');
const OUT_DIR = outIdx >= 0 ? args[outIdx + 1] : null;

if (!API_URL || !OUT_DIR) {
  console.error('Usage: API_URL=https://<api> node scripts/fund-data/export.mjs [--trigger] --out <dir>');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(pathAndQuery) {
  const res = await fetch(`${API_URL}${pathAndQuery}`);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function pollUntilDone() {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const { status, body } = await getJson('/fund-market?status=1');
    if (status !== 200 || !body) continue;
    if (body.state === 'ok' || body.state === 'partial') return body;
    if (body.state === 'error') throw new Error(`Refresh run failed: ${JSON.stringify(body.fundsFailed ?? [])}`);
    console.log(`  refresh ${body.state}... (${Math.round((Date.now() - body.startedAt) / 1000)}s)`);
  }
  throw new Error('Timed out waiting for the refresh run to finish.');
}

async function triggerRefresh() {
  console.log('Triggering refresh (no-op if fresh within 120 min)...');
  const { status, body } = await getJson(`/refresh-fund-data?key=${KEY}&ifStaleMinutes=120`);
  if (status === 200 && body?.skipped) {
    console.log(`  skipped — last successful run ${new Date(body.lastFinishedAt).toISOString()}`);
    return;
  }
  if (status === 202 || status === 409) {
    console.log(status === 202 ? `  started run ${body?.runId}` : '  a run is already in progress');
    const done = await pollUntilDone();
    console.log(`  refresh ${done.state}: ${done.fundsOk} funds ok in ${Math.round((done.durationMs ?? 0) / 1000)}s`);
    return;
  }
  throw new Error(`Unexpected /refresh-fund-data response: HTTP ${status} ${JSON.stringify(body)}`);
}

/** Hard validation — any failure aborts the whole export. */
function validate(ticker, p) {
  const problems = [];
  if (!p || typeof p !== 'object') problems.push('empty payload');
  else {
    if (!(p.price > 0)) problems.push(`price=${p.price}`);
    const months = p.chart?.monthlyMax?.t?.length ?? 0;
    if (months < 12) problems.push(`monthlyMax has ${months} points`);
    if (months > 30 && !(p.annualReturns?.length > 0)) problems.push('no annualReturns despite >2y history');
    if (!p.generatedAt || Date.now() - p.generatedAt > 48 * 3600_000) {
      problems.push(`stale generatedAt=${p.generatedAt}`);
    }
  }
  if (problems.length) throw new Error(`${ticker}: ${problems.join('; ')}`);
}

async function main() {
  if (TRIGGER) await triggerRefresh();

  const { status: sumStatus, body: summary } = await getJson('/fund-market?summary=1');
  if (sumStatus !== 200 || !summary?.funds?.length) {
    throw new Error(`No fund summary available (HTTP ${sumStatus}) — has the refresh ever run?`);
  }
  const tickers = summary.funds.map((f) => f.ticker);
  console.log(`Exporting ${tickers.length} funds from ${API_URL}...`);

  // Fetch + validate everything BEFORE writing anything.
  const payloads = new Map();
  for (const ticker of tickers) {
    const { status, body } = await getJson(`/fund-market?ticker=${encodeURIComponent(ticker)}`);
    if (status !== 200) throw new Error(`${ticker}: HTTP ${status}`);
    validate(ticker, body);
    payloads.set(ticker, body);
  }

  const { body: refreshStatus } = await getJson('/fund-market?status=1');

  await mkdir(OUT_DIR, { recursive: true });
  for (const [ticker, payload] of payloads) {
    await writeFile(path.join(OUT_DIR, `${ticker}.json`), JSON.stringify(payload));
  }
  await writeFile(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary));
  await writeFile(path.join(OUT_DIR, 'meta.json'), JSON.stringify({
    generatedAt: summary.generatedAt,
    exportedAt: Date.now(),
    count: payloads.size,
    fundsFailedLastRun: refreshStatus?.fundsFailed ?? [],
  }, null, 2));

  console.log(`Wrote ${payloads.size} fund files + summary.json + meta.json to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(`Export FAILED: ${err.message ?? err}`);
  process.exit(1);
});
