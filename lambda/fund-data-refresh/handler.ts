// ── fund-data-refresh ────────────────────────────────────────────────────────
// Nightly job that mirrors REAL market data from each fund's Vanguard proxy
// (FundDef.realSymbol, Yahoo Finance) into the bobs-fund-market table: current
// quote, trailing + calendar-year total returns, chart series, real distribution
// events, top holdings, sector weightings and portfolio characteristics, plus
// raw daily price history back to inception (chunked by year, hash-guarded so
// unchanged years are never rewritten).
//
// Two entry modes:
//   • Direct invoke {mode:'refresh'} — EventBridge Scheduler (nightly cron) or
//     the async self-invoke below. Does the actual work (~1-2 min).
//   • GET /refresh-fund-data?key=bobs-reset-2025[&ifStaleMinutes=N] — validates,
//     async-invokes itself, returns 202 immediately (API Gateway caps sync
//     responses at 29s). Progress: GET /fund-market?status=1.
//
// Failure policy: a fund that errors writes NOTHING (last good data stays; the
// failure is reported in _status.fundsFailed). A failed crumb handshake only
// degrades quoteSummary-derived profile fields — they carry over from the
// previous run — while everything chart-derived still refreshes.

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { GetCommand, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { FUNDS } from '../shared/fund-catalog';
import type { FundMarketData, FundMarketSummary, FundRefreshStatus } from '../shared/fund-market-types';
import { getYahooCrumb, fetchChart, fetchQuoteSummary, mapWithConcurrency, YahooAuth, ChartData } from './yahoo';
import {
  toEpochDay, dayToISO, computeTrailingReturns, computeAnnualReturns, downsample,
  chunkByYear, hashOf, computeDayChange, computeYieldTtm, monthlyReturns,
  computeStdDev, computeBeta, mapSectorWeightings, mapDistributions,
} from './compute';

const RESET_KEY = 'bobs-reset-2025';
const TABLE = (): string => process.env.FUND_MARKET_TABLE ?? 'bobs-fund-market';
const CONCURRENCY = 6;

const INDEXES = [
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: '^DJI',  name: 'Dow Jones' },
  { symbol: '^IXIC', name: 'NASDAQ' },
] as const;

type RefreshEvent = { mode: 'refresh'; trigger?: 'scheduled' | 'manual'; runId?: string };

// The previous run's `latest` item (payload + bookkeeping hashes).
type LatestItem = FundMarketData & {
  ticker: string; section: 'latest';
  historyHashes?: Record<string, string>;
  dividendsHash?: string;
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** BatchWrite in chunks of 25, retrying UnprocessedItems (reset-funds pattern). */
async function batchWrite(requests: Record<string, unknown>[]): Promise<void> {
  for (let i = 0; i < requests.length; i += 25) {
    let batch = requests.slice(i, i + 25);
    for (let attempt = 0; attempt < 6 && batch.length; attempt++) {
      const res = await docClient.send(new BatchWriteCommand({ RequestItems: { [TABLE()]: batch } }));
      const un = res.UnprocessedItems?.[TABLE()] ?? [];
      batch = un as Record<string, unknown>[];
      if (batch.length) await sleep(100 * (attempt + 1));
    }
  }
}

async function getItem<T>(ticker: string, section: string): Promise<T | null> {
  const res = await docClient.send(new GetCommand({ TableName: TABLE(), Key: { ticker, section } }));
  return (res.Item as T | undefined) ?? null;
}

async function putStatus(status: FundRefreshStatus): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: TABLE(),
    Item: { ticker: '_status', section: 'latest', ...status },
  }));
}

const json = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(body),
});

// ── Per-fund refresh ─────────────────────────────────────────────────────────

interface FundResult {
  ticker: string;
  ok: boolean;
  error?: string;
  /** Fresh payload on success; the previous run's payload as a stand-in on failure. */
  summaryRow: FundMarketData | null;
}

async function refreshFund(
  fund: { ticker: string; realSymbol: string },
  auth: YahooAuth | null,
  spxMonthly: number[],
  generatedAt: number,
): Promise<FundResult> {
  const old = await getItem<LatestItem>(fund.ticker, 'latest').catch(() => null);
  try {
    const chart = await fetchChart(fund.realSymbol);
    if (chart.timestamps.length < 30) throw new Error(`only ${chart.timestamps.length} data points`);
    const qs = auth ? await fetchQuoteSummary(fund.realSymbol, auth) : null;

    const days = chart.timestamps.map(toEpochDay);
    const { close, adjclose } = chart;
    const last = days.length - 1;
    const price = close[last];
    const endDay = days[last];

    const monthly = monthlyReturns(days, adjclose, 36);
    const meta = chart.meta as Record<string, number | undefined>;
    const firstTrade = meta.firstTradeDate ? dayToISO(toEpochDay(meta.firstTradeDate)) : null;
    // Both Yahoo inception sources have quirks: fundInceptionDate can be LATER
    // than the fund's own first trading day (VWO: 2006-06-23 vs data since
    // 2005-03), and meta.firstTradeDate can be YEARS too early via share-class
    // lineage (VOO: 2000-11-13 for a 2010 fund). The candidate closest to the
    // first actual data point is the real inception — and it keeps the
    // displayed date consistent with how far back the chart goes.
    const firstDataDay = days[0];
    const dateToDay = (iso: string): number => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
    // A real inception precedes the first bar by only days (fund incepts, then
    // lists) — so take the EARLIEST source date within 45 days of the first
    // data point, and fall back to the first data day itself when both sources
    // are off in fairy-land. The previous run's value stays a candidate so a
    // night when Yahoo throttles quoteSummary can't degrade a good date.
    const inceptionDate = [qs?.inceptionDate, firstTrade, old?.inceptionDate]
      .filter((x): x is string => !!x)
      .filter(x => Math.abs(dateToDay(x) - firstDataDay) <= 45)
      .sort()[0] ?? dayToISO(firstDataDay);

    const payload: FundMarketData = {
      schemaVersion: 1,
      ticker: fund.ticker,
      realSymbol: fund.realSymbol,
      asOf: dayToISO(endDay),
      generatedAt,
      price,
      dayChange: computeDayChange(close),
      weekHigh52: meta.fiftyTwoWeekHigh ?? Math.max(...close.slice(-260)),
      weekLow52: meta.fiftyTwoWeekLow ?? Math.min(...close.slice(-260)),
      ...computeTrailingReturns(days, adjclose),
      totalAssets: qs?.totalAssets ?? old?.totalAssets ?? null,
      inceptionDate,
      yieldTtm: computeYieldTtm(chart.dividends, price, endDay),
      beta3Y: computeBeta(monthly, spxMonthly) ?? qs?.beta3Y ?? old?.beta3Y ?? null,
      stdDev3Y: computeStdDev(monthly),
      peRatio: qs?.peRatio ?? old?.peRatio ?? null,
      pbRatio: qs?.pbRatio ?? old?.pbRatio ?? null,
      avgDuration: qs?.avgDuration ?? old?.avgDuration ?? null,
      topHoldings: (qs?.topHoldings?.length ? qs.topHoldings : old?.topHoldings) ?? [],
      sectorAllocation: qs ? mapSectorWeightings(qs.sectorWeights) : old?.sectorAllocation ?? null,
      annualReturns: computeAnnualReturns(days, adjclose),
      distributions: mapDistributions(chart.dividends, chart.capitalGains),
      chart: downsample(days, close),
    };

    // Writes: only year-chunks whose content changed (a split restates history —
    // the hashes catch that too), the dividends item on change, then `latest`.
    const chunks = chunkByYear(days, close);
    const oldHashes = old?.historyHashes ?? {};
    const historyHashes: Record<string, string> = {};
    const writes: Record<string, unknown>[] = [];
    for (const [year, chunk] of chunks) {
      historyHashes[String(year)] = chunk.hash;
      if (oldHashes[String(year)] !== chunk.hash) {
        writes.push({ PutRequest: { Item: { ticker: fund.ticker, section: `history#${year}`, ...chunk } } });
      }
    }

    const allEvents = mapDistributions(chart.dividends, chart.capitalGains, Number.MAX_SAFE_INTEGER);
    const dividendsHash = hashOf(allEvents);
    if (old?.dividendsHash !== dividendsHash) {
      writes.push({ PutRequest: { Item: { ticker: fund.ticker, section: 'dividends', events: allEvents, hash: dividendsHash } } });
    }

    writes.push({ PutRequest: { Item: { ...payload, ticker: fund.ticker, section: 'latest', historyHashes, dividendsHash } } });
    await batchWrite(writes);

    return { ticker: fund.ticker, ok: true, summaryRow: payload };
  } catch (err) {
    console.warn(`fund-data-refresh: ${fund.ticker} (${fund.realSymbol}) failed:`, err);
    return { ticker: fund.ticker, ok: false, error: String(err), summaryRow: old ?? null };
  }
}

// ── The refresh run ──────────────────────────────────────────────────────────

async function runRefresh(trigger: 'scheduled' | 'manual', runId: string): Promise<FundRefreshStatus> {
  const startedAt = Date.now();
  await putStatus({ state: 'running', runId, trigger, startedAt });

  try {
    const auth = await getYahooCrumb();
    if (!auth) console.warn('fund-data-refresh: crumb handshake failed — quoteSummary fields will carry over');

    // ^GSPC daily 10y serves double duty: beta baseline + index quote.
    const [spx, ...otherIdx] = await Promise.all([
      fetchChart('^GSPC', '1d', '10y'),
      ...INDEXES.slice(1).map(i => fetchChart(i.symbol, '1d', '5d').catch(() => null)),
    ]);
    const spxMonthly = monthlyReturns(spx.timestamps.map(toEpochDay), spx.adjclose, 36);

    const generatedAt = Date.now();
    const results = await mapWithConcurrency(FUNDS, CONCURRENCY, f =>
      refreshFund({ ticker: f.ticker, realSymbol: f.realSymbol }, auth, spxMonthly, generatedAt));

    const indexQuote = (chart: ChartData | null, symbol: string, name: string) => ({
      symbol, name,
      value: chart ? chart.close[chart.close.length - 1] : 0,
      change: chart ? computeDayChange(chart.close) : 0,
    });
    const summary: FundMarketSummary = {
      schemaVersion: 1,
      generatedAt,
      indices: [
        indexQuote(spx, '^GSPC', 'S&P 500'),
        ...INDEXES.slice(1).map((ix, i) => indexQuote(otherIdx[i], ix.symbol, ix.name)),
      ],
      funds: results
        .filter(r => r.summaryRow)
        .map(r => {
          const p = r.summaryRow as FundMarketData;
          const er = FUNDS.find(f => f.ticker === p.ticker)?.expenseRatio ?? 0;
          return {
            ticker: p.ticker, realSymbol: p.realSymbol, price: p.price, dayChange: p.dayChange,
            ytd: p.ytd, oneYear: p.oneYear, threeYear: p.threeYear, fiveYear: p.fiveYear,
            expenseRatio: er,
          };
        }),
    };
    await docClient.send(new PutCommand({
      TableName: TABLE(),
      Item: { ticker: '_summary', section: 'latest', ...summary },
    }));

    const failed = results.filter(r => !r.ok);
    const status: FundRefreshStatus = {
      state: failed.length === 0 ? 'ok' : failed.length < results.length ? 'partial' : 'error',
      runId, trigger, startedAt,
      finishedAt: Date.now(),
      durationMs: Date.now() - startedAt,
      fundsOk: results.length - failed.length,
      fundsFailed: failed.map(f => ({ ticker: f.ticker, error: (f.error ?? 'unknown').slice(0, 300) })),
      quoteSummaryDegraded: !auth,
      generatedAt,
    };
    await putStatus(status);
    console.log(`fund-data-refresh: ${status.state} — ${status.fundsOk}/${results.length} funds in ${status.durationMs}ms (trigger=${trigger})`);
    return status;
  } catch (err) {
    console.error('fund-data-refresh: run failed', err);
    const status: FundRefreshStatus = {
      state: 'error', runId, trigger, startedAt,
      finishedAt: Date.now(), durationMs: Date.now() - startedAt,
      fundsOk: 0, fundsFailed: [{ ticker: '*', error: String(err).slice(0, 300) }],
    };
    await putStatus(status).catch(() => undefined);
    return status;
  }
}

// ── Handler (dual-mode) ──────────────────────────────────────────────────────

export const handler = async (
  event: APIGatewayProxyEventV2 | RefreshEvent,
): Promise<APIGatewayProxyResultV2 | FundRefreshStatus> => {
  // Direct invoke (EventBridge nightly cron, or our own async self-invoke).
  if ((event as RefreshEvent).mode === 'refresh') {
    const e = event as RefreshEvent;
    return runRefresh(e.trigger ?? 'scheduled', e.runId ?? `run-${Date.now().toString(36)}`);
  }

  // API path: validate, async-invoke self, 202.
  const apiEvent = event as APIGatewayProxyEventV2;
  const params = apiEvent.queryStringParameters ?? {};
  if (params.key !== RESET_KEY) {
    return json(403, { error: 'Supply the correct ?key= parameter.' });
  }

  const status = await getItem<FundRefreshStatus>('_status', 'latest').catch(() => null);
  const now = Date.now();

  const ifStaleMinutes = Number(params.ifStaleMinutes);
  if (ifStaleMinutes > 0 && status?.state === 'ok' && status.finishedAt
      && now - status.finishedAt < ifStaleMinutes * 60_000) {
    return json(200, { skipped: true, lastFinishedAt: status.finishedAt, fundsOk: status.fundsOk });
  }
  if (status?.state === 'running' && now - status.startedAt < 10 * 60_000) {
    return json(409, { running: true, startedAt: status.startedAt, runId: status.runId });
  }

  const runId = `run-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const lambdaClient = new LambdaClient({});
  await lambdaClient.send(new InvokeCommand({
    FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
    InvocationType: 'Event',
    Payload: JSON.stringify({ mode: 'refresh', trigger: 'manual', runId } satisfies RefreshEvent),
  }));

  return json(202, { started: true, runId, checkStatus: 'GET /fund-market?status=1' });
};
