import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { FUNDS } from '../shared/fund-catalog';

// Seeds the bobs-funds table from the canonical 36-fund catalog (customer-app/src/data/funds.ts,
// re-exported via shared/fund-catalog.ts). Idempotent: PutItem overwrites by ticker, so re-running
// simply refreshes the table to match the bundled catalog. Run per-environment after deploy:
//   GET <api-url>/reset-funds?key=bobs-reset-2025
const RESET_KEY = 'bobs-reset-2025';
const FUNDS_TABLE = (): string => process.env.FUNDS_TABLE ?? 'bobs-funds';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** BatchWrite in chunks of 25, retrying UnprocessedItems. */
async function batchWrite(table: string, requests: Record<string, unknown>[]): Promise<void> {
  for (let i = 0; i < requests.length; i += 25) {
    let batch = requests.slice(i, i + 25);
    for (let attempt = 0; attempt < 6 && batch.length; attempt++) {
      const res = await docClient.send(new BatchWriteCommand({ RequestItems: { [table]: batch } }));
      const un = res.UnprocessedItems?.[table] ?? [];
      batch = un as Record<string, unknown>[];
      if (batch.length) await sleep(100 * (attempt + 1));
    }
  }
}

function htmlResponse(status: number, body: string): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fund Catalog Reset</title>
<style>body{font-family:system-ui,sans-serif;max-width:700px;margin:80px auto;padding:0 20px;color:#1e293b}
h1{color:#0f2d5e}ul{padding-left:20px;line-height:1.8}
.ok{color:#059669}.err{color:#dc2626}</style></head><body>${body}</body></html>`,
  };
}

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  if (event.queryStringParameters?.key !== RESET_KEY) {
    return htmlResponse(403, `<h1>Access denied</h1><p>Supply the correct <code>?key=</code> parameter.</p>`);
  }

  const table = FUNDS_TABLE();
  try {
    await batchWrite(table, FUNDS.map(f => ({ PutRequest: { Item: { ...f } } })));
  } catch (err) {
    return htmlResponse(500, `<h1 class="err">Seed failed</h1><p>${String(err)}</p>`);
  }

  const now = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' });
  const rows = FUNDS
    .map(f => `<li class="ok">✓ ${f.ticker} — ${f.name} (${f.group}, ${f.expenseRatio}% ER)</li>`)
    .join('');
  return htmlResponse(200, `
    <h1>Fund catalog seeded</h1>
    <p><strong>${FUNDS.length}</strong> funds written to <code>${table}</code>.</p>
    <p><strong>Seeded at:</strong> ${now} ET</p>
    <ul>${rows}</ul>
  `);
};
