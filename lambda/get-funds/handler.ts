import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';

// The bobs-funds table holds ~36 small items that change < once/day, so we read the whole
// catalog with a single Scan and cache it in module memory across warm invocations. Mirrors
// the market-data Lambda's caching approach.
const FUNDS_TABLE = (): string => process.env.FUNDS_TABLE ?? 'bobs-funds';
const CACHE_TTL_MS = 60 * 60 * 1000; // 60 min

interface FundsPayload {
  funds: Record<string, unknown>[];
  fetchedAt: number;
}

let cache: FundsPayload | null = null;

async function scanAllFunds(): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const res = await docClient.send(new ScanCommand({
      TableName: FUNDS_TABLE(),
      ExclusiveStartKey: startKey,
    }));
    for (const it of res.Items ?? []) items.push(it as Record<string, unknown>);
    startKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (startKey);
  return items;
}

function jsonResponse(status: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      // Browser/CDN cache hint — fund data changes < once/day.
      'Cache-Control': 'public, max-age=3600',
    },
    body: JSON.stringify(body),
  };
}

export const handler = async (
  _event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  // Serve from module cache when fresh.
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return jsonResponse(200, cache);
  }
  try {
    const funds = await scanAllFunds();
    cache = { funds, fetchedAt: Date.now() };
    return jsonResponse(200, cache);
  } catch (err) {
    console.error('get-funds scan failed', err);
    // Serve stale cache if we have one; otherwise an empty list (frontend falls back to its
    // bundled funds.ts copy, so pages still render).
    if (cache) return jsonResponse(200, cache);
    return jsonResponse(200, { funds: [], fetchedAt: Date.now() });
  }
};
