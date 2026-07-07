// ── fund-market (read API) ───────────────────────────────────────────────────
// Serves the page-ready market payloads that fund-data-refresh writes nightly
// to bobs-fund-market. Three views:
//   GET /fund-market?ticker=BF500  → FundMarketData for one fund
//   GET /fund-market?summary=1     → FundMarketSummary (lineup-wide, list pages)
//   GET /fund-market?status=1      → last refresh-run status (uncached — pollable)
// Read-only by design (separate Lambda from the refresher so the public read
// path never holds write permissions). Primary consumers: the static-file
// exporter (scripts/fund-data/export.mjs) and the frontend's live fallback when
// a /fund-data/*.json file isn't published yet (e.g. a fund added same-day).

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';

const TABLE = (): string => process.env.FUND_MARKET_TABLE ?? 'bobs-fund-market';
const TICKER_RE = /^[A-Z0-9.]{1,12}$/;

function json(statusCode: number, body: unknown, cacheSeconds: number): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': cacheSeconds > 0 ? `public, max-age=${cacheSeconds}` : 'no-store',
    },
    body: JSON.stringify(body),
  };
}

async function getLatest(ticker: string): Promise<Record<string, unknown> | null> {
  const res = await docClient.send(new GetCommand({
    TableName: TABLE(),
    Key: { ticker, section: 'latest' },
  }));
  return (res.Item as Record<string, unknown> | undefined) ?? null;
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const params = event.queryStringParameters ?? {};
  try {
    if (params.status) {
      const item = await getLatest('_status');
      if (!item) return json(404, { error: 'No refresh has run yet.' }, 0);
      const { ticker: _t, section: _s, ...status } = item;
      return json(200, status, 0);
    }

    if (params.summary) {
      const item = await getLatest('_summary');
      if (!item) return json(404, { error: 'No fund summary available yet.' }, 0);
      const { ticker: _t, section: _s, ...summary } = item;
      return json(200, summary, 1200);
    }

    const ticker = (params.ticker ?? '').toUpperCase();
    if (!TICKER_RE.test(ticker) || ticker.startsWith('_')) {
      return json(400, { error: 'Supply ?ticker=<fund>, ?summary=1, or ?status=1.' }, 0);
    }
    const item = await getLatest(ticker);
    if (!item) return json(404, { error: `No market data for ${ticker}.` }, 0);
    // historyHashes/dividendsHash are refresh bookkeeping, not page data.
    // `ticker` stays — it's part of the FundMarketData contract (the frontend
    // validates payload.ticker to reject the vite SPA-fallback index.html).
    const { section: _s, historyHashes: _h, dividendsHash: _d, ...payload } = item;
    return json(200, payload, 1200);
  } catch (err) {
    console.error('fund-market error', err);
    return json(500, { error: 'Failed to read fund market data' }, 0);
  }
};
