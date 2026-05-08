import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { DEFAULT_BENEFICIARIES, CLIENT_IRA_ACCOUNTS } from '../shared/beneficiary-defaults';

const RESET_KEY = 'bobs-reset-2025';

function htmlResponse(status: number, body: string): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Beneficiary Reset</title>
<style>body{font-family:system-ui,sans-serif;max-width:600px;margin:80px auto;padding:0 20px;color:#1e293b}
h1{color:#0f2d5e}pre{background:#f8fafc;border:1px solid #e2e8f0;padding:16px;border-radius:8px;font-size:13px;overflow:auto}
.ok{color:#059669}.err{color:#dc2626}</style></head><body>${body}</body></html>`,
  };
}

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const key = event.queryStringParameters?.key;

  if (key !== RESET_KEY) {
    return htmlResponse(403, `<h1>Access denied</h1><p>Supply the correct <code>?key=</code> parameter to reset beneficiaries.</p>`);
  }

  const table = process.env.CLIENTS_TABLE!;
  const results: string[] = [];
  let errorOccurred = false;

  for (const clientId of Object.keys(DEFAULT_BENEFICIARIES)) {
    const defaults = DEFAULT_BENEFICIARIES[clientId];
    try {
      await docClient.send(new UpdateCommand({
        TableName: table,
        Key: { clientId },
        UpdateExpression: 'SET beneficiaries = :v',
        ExpressionAttributeValues: { ':v': defaults },
      }));
      const accountIds = CLIENT_IRA_ACCOUNTS[clientId] ?? [];
      const summary = defaults.length === 0
        ? 'no beneficiaries (cleared)'
        : defaults.map(b => `${b.name} (${b.type}, ${b.percentage}% of ${b.accountId})`).join(', ');
      results.push(`<li class="ok">✓ ${clientId} — IRA accounts: ${accountIds.join(', ')} → ${summary}</li>`);
    } catch (err) {
      errorOccurred = true;
      results.push(`<li class="err">✗ ${clientId} — ${String(err)}</li>`);
    }
  }

  const now = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' });
  const status = errorOccurred ? 500 : 200;
  const heading = errorOccurred ? 'Reset completed with errors' : 'Beneficiaries reset successfully';

  return htmlResponse(status, `
    <h1>${heading}</h1>
    <p>All IRA account beneficiaries have been restored to their default demo values.</p>
    <p><strong>Reset at:</strong> ${now} ET</p>
    <ul>${results.join('')}</ul>
  `);
};
