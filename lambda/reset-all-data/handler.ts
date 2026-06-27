import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { UpdateCommand, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { DEFAULT_CLIENT_DATA, ALL_CLIENT_IDS } from '../shared/client-defaults';
import { generateClientTransactions, TransactionRow } from '../shared/transaction-history';

const RESET_KEY = 'bobs-reset-2025';
const TXNS_TABLE = (): string => process.env.TRANSACTIONS_TABLE ?? 'bobs-transactions';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** BatchWrite in chunks of 25, retrying UnprocessedItems (which fail silently). */
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

/** Delete all existing transaction rows for a client (so a re-seed can't orphan rows). */
async function clearTransactions(clientId: string): Promise<void> {
  const table = TXNS_TABLE();
  let startKey: Record<string, unknown> | undefined;
  const deletes: Record<string, unknown>[] = [];
  do {
    const res = await docClient.send(new QueryCommand({
      TableName: table,
      KeyConditionExpression: 'clientId = :c',
      ExpressionAttributeValues: { ':c': clientId },
      ProjectionExpression: 'clientId, txnSort',
      ExclusiveStartKey: startKey,
    }));
    for (const it of res.Items ?? []) {
      deletes.push({ DeleteRequest: { Key: { clientId: it.clientId, txnSort: it.txnSort } } });
    }
    startKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (startKey);
  if (deletes.length) await batchWrite(table, deletes);
}

/** Clear + reseed the generated transaction history for a client. Returns row count. */
async function seedTransactions(clientId: string): Promise<number> {
  await clearTransactions(clientId);
  const rows: TransactionRow[] = generateClientTransactions(clientId);
  await batchWrite(TXNS_TABLE(), rows.map(r => ({ PutRequest: { Item: r } })));
  return rows.length;
}

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
        // Transactions now live in the bobs-transactions table (seeded below) — REMOVE the
        // legacy array off the client item.
        UpdateExpression:
          'SET #nm = :name, pronouns = :pronouns, phone = :phone, displayPhone = :dp, ' +
          'email = :email, address = :addr, ' +
          'totalBalance = :tb, accounts = :accs, ' +
          'holdings = :h, ' +
          'beneficiaries = :b, autoInvest = :ai, rmd = :rmd, ' +
          // My Account hub attributes (names aliased — `security` etc. are reserved words)
          '#phones = :phones, #ev = :ev, #personal = :personal, #security = :security, ' +
          '#prefs = :prefs, #bank = :bank, #tc = :tc, #ip = :ip, #wl = :wl, #ag = :ag, #aa = :aa ' +
          'REMOVE lastAgentChat, transactions',
        ExpressionAttributeNames: {
          '#nm': 'name',
          '#phones': 'phones', '#ev': 'emailVerified', '#personal': 'personal',
          '#security': 'security', '#prefs': 'preferences', '#bank': 'bankAccounts',
          '#tc': 'trustedContact', '#ip': 'investorProfile', '#wl': 'watchlist', '#ag': 'agreements',
          '#aa': 'authorizedAgents',
        },
        ExpressionAttributeValues: {
          ':name':  d.name,
          ':pronouns': d.pronouns,
          ':phone': d.phone,
          ':dp':    d.displayPhone,
          ':email': d.email,
          ':addr':  d.address,
          ':tb':    d.totalBalance,
          ':accs':  d.accounts,
          ':h':     d.holdings,
          ':b':     d.beneficiaries,
          ':ai':    d.autoInvest,
          ':rmd':   d.rmd,
          ':phones':   d.phones,
          ':ev':       d.emailVerified,
          ':personal': d.personal,
          ':security': d.security,
          ':prefs':    d.preferences,
          ':bank':     d.bankAccounts,
          ':tc':       d.trustedContact,
          ':ip':       d.investorProfile,
          ':wl':       d.watchlist,
          ':ag':       d.agreements,
          ':aa':       d.authorizedAgents ?? [],
        },
      }));
      const txnCount = await seedTransactions(clientId);
      results.push(`<li class="ok">✓ ${clientId} — ${d.name} reset successfully (${txnCount} transactions seeded)</li>`);
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
