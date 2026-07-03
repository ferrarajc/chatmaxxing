import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { AGENT_ROSTER, isLicensed } from '../shared/agent-roster';
import { generateAgentHistory } from '../shared/agent-history';

// Seeds the bobs-agents table from the canonical roster (shared/agent-roster.ts) plus a
// deterministic per-agent performance history (shared/agent-history.ts). Idempotent:
// PutItem overwrites by agentUsername. History buckets are anchored to the CURRENT week,
// so re-run this periodically (or before a demo) to keep "today"/"7d" windows populated:
//   GET <api-url>/reset-agents?key=bobs-reset-2025
const RESET_KEY = 'bobs-reset-2025';
const AGENTS_TABLE = (): string => process.env.AGENTS_TABLE ?? 'bobs-agents';

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
    body: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Agent Roster Reset</title>
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

  const table = AGENTS_TABLE();
  const nowMs = Date.now();
  try {
    const items = AGENT_ROSTER.map(agent => ({
      PutRequest: {
        Item: {
          ...agent,
          licensed: isLicensed(agent),
          history: generateAgentHistory(agent, nowMs),
          seededAt: nowMs,
        },
      },
    }));
    await batchWrite(table, items);
  } catch (err) {
    return htmlResponse(500, `<h1 class="err">Seed failed</h1><p>${String(err)}</p>`);
  }

  const now = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' });
  const byDivision = new Map<string, number>();
  for (const ag of AGENT_ROSTER) byDivision.set(ag.division, (byDivision.get(ag.division) ?? 0) + 1);
  const rows = [...byDivision.entries()]
    .map(([division, n]) => `<li class="ok">✓ ${division} — ${n} agents</li>`)
    .join('');
  return htmlResponse(200, `
    <h1>Agent roster seeded</h1>
    <p><strong>${AGENT_ROSTER.length}</strong> agents (with performance history) written to <code>${table}</code>.</p>
    <p><strong>Seeded at:</strong> ${now} ET</p>
    <ul>${rows}</ul>
  `);
};
