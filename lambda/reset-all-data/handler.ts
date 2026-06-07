import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { DEFAULT_CLIENT_DATA, ALL_CLIENT_IDS } from '../shared/client-defaults';

const RESET_KEY = 'bobs-reset-2025';

function htmlResponse(status: number, body: string): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Client Data Reset</title>
<style>body{font-family:system-ui,sans-serif;max-width:700px;margin:80px auto;padding:0 20px;color:#1e293b}
h1{color:#0f2d5e}ul{padding-left:20px;line-height:2}
.ok{color:#059669}.err{color:#dc2626}</style></head><body>${body}</body></html>`,
  };
}

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const key = event.queryStringParameters?.key;

  if (key !== RESET_KEY) {
    return htmlResponse(403, `<h1>Access denied</h1><p>Supply the correct <code>?key=</code> parameter.</p>`);
  }

  const table = process.env.CLIENTS_TABLE!;
  const results: string[] = [];
  let errorOccurred = false;

  for (const clientId of ALL_CLIENT_IDS) {
    const d = DEFAULT_CLIENT_DATA[clientId];
    try {
      await docClient.send(new UpdateCommand({
        TableName: table,
        Key: { clientId },
        // Clear the "Continue this chat" continuation memory (lastAgentChat) as part of the
        // reset. The permanent transcript log (bobs-transcripts table) is intentionally NOT
        // touched here, so chats remain browsable in the Transcript Review tool.
        UpdateExpression:
          'SET #nm = :name, phone = :phone, displayPhone = :dp, ' +
          'email = :email, address = :addr, ' +
          'totalBalance = :tb, accounts = :accs, ' +
          'holdings = :h, transactions = :tx, ' +
          'beneficiaries = :b, autoInvest = :ai, rmd = :rmd ' +
          'REMOVE lastAgentChat',
        ExpressionAttributeNames: { '#nm': 'name' },
        ExpressionAttributeValues: {
          ':name':  d.name,
          ':phone': d.phone,
          ':dp':    d.displayPhone,
          ':email': d.email,
          ':addr':  d.address,
          ':tb':    d.totalBalance,
          ':accs':  d.accounts,
          ':h':     d.holdings,
          ':tx':    d.transactions,
          ':b':     d.beneficiaries,
          ':ai':    d.autoInvest,
          ':rmd':   d.rmd,
        },
      }));
      results.push(`<li class="ok">✓ ${clientId} — ${d.name} reset successfully</li>`);
    } catch (err) {
      errorOccurred = true;
      results.push(`<li class="err">✗ ${clientId} — ${String(err)}</li>`);
    }
  }

  const now = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' });
  const status = errorOccurred ? 500 : 200;
  const heading = errorOccurred ? 'Reset completed with errors' : 'All client data reset successfully';

  return htmlResponse(status, `
    <h1>${heading}</h1>
    <p>All 4 demo clients have been restored to their default values (profile, holdings, transactions, beneficiaries, auto-invest, RMD). Recent agent-chat memory was also cleared; saved transcripts remain available in the Transcript Review log.</p>
    <p><strong>Reset at:</strong> ${now} ET</p>
    <ul>${results.join('')}</ul>
  `);
};
