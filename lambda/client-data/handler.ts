import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { GetCommand, UpdateCommand, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { jsonResponse } from '../shared/types';
import { buildTransactionRow, makeAcctKey, TxnType } from '../shared/transaction-history';

type Action =
  | 'get-all'
  | 'get-continuation'
  | 'get-beneficiaries' | 'put-beneficiaries'
  | 'get-auto-invest'   | 'put-auto-invest'
  | 'get-rmd'           | 'put-rmd'
  | 'put-profile'
  | 'put-holdings'
  | 'put-transactions'              // deprecated (no-op) — kept for one release
  | 'get-recent-transactions'       // newest-first, optional accountId
  | 'get-transactions-page'         // paginated history w/ filters
  | 'append-transaction';           // single live row (replaces put-transactions)

const TXNS_TABLE = (): string => process.env.TRANSACTIONS_TABLE ?? 'bobs-transactions';

// ── Transaction table helpers ────────────────────────────────────────────────
interface TxnKey { clientId: string; txnSort: string; acctKey?: string }

function encodeCursor(key: TxnKey | undefined): string | null {
  return key ? Buffer.from(JSON.stringify(key)).toString('base64') : null;
}
function decodeCursor(cursor: string | undefined): Record<string, unknown> | undefined {
  if (!cursor) return undefined;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

interface RowItem {
  clientId: string; txnSort: string; acctKey: string;
  date: string; description: string; amount: number; account: string;
  accountId: string; status: string; type: string;
}

/** Query newest-first (or oldest-first), with optional accountId / status / search. */
async function queryTransactions(opts: {
  clientId: string; accountId?: string; status?: string; search?: string;
  sort?: 'newest' | 'oldest'; pageSize: number; startKey?: Record<string, unknown>;
}): Promise<{ items: RowItem[]; cursor: string | null }> {
  const { clientId, accountId, status, search, sort, pageSize, startKey } = opts;
  const useIndex = !!accountId;
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = useIndex
    ? { ':k': makeAcctKey(clientId, accountId!) }
    : { ':k': clientId };
  const keyCond = useIndex ? 'acctKey = :k' : 'clientId = :k';

  const filters: string[] = [];
  if (status && status !== 'all') { names['#s'] = 'status'; values[':st'] = status; filters.push('#s = :st'); }
  if (search && search.trim()) { values[':q'] = search.trim().toLowerCase(); filters.push('contains(descLower, :q)'); }

  const collected: RowItem[] = [];
  let scanKey: Record<string, unknown> | undefined = startKey;
  // Read in windows until we have a full page or run out — FilterExpression is applied
  // after the key read, so a window can come back short while more rows still match.
  do {
    const res = await docClient.send(new QueryCommand({
      TableName: TXNS_TABLE(),
      ...(useIndex ? { IndexName: 'account-index' } : {}),
      KeyConditionExpression: keyCond,
      ...(filters.length ? { FilterExpression: filters.join(' AND ') } : {}),
      ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
      ExpressionAttributeValues: values,
      ScanIndexForward: sort === 'oldest',
      Limit: 120,
      ExclusiveStartKey: scanKey,
    }));
    collected.push(...((res.Items ?? []) as RowItem[]));
    scanKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (scanKey && collected.length < pageSize);

  const items = collected.slice(0, pageSize);
  const hasMore = collected.length > pageSize || !!scanKey;
  const last = items[items.length - 1];
  const nextCursor = hasMore && last
    ? encodeCursor({ clientId: last.clientId, txnSort: last.txnSort, ...(useIndex ? { acctKey: last.acctKey } : {}) })
    : null;
  return { items, cursor: nextCursor };
}

function liveSeq(): number {
  const now = new Date();
  return now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
}

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const body = JSON.parse(event.body ?? '{}') as {
      action: Action;
      clientId: string;
      data?: unknown;
    };

    const { action, clientId, data } = body;

    if (!clientId || !action) {
      return jsonResponse(400, { error: 'clientId and action are required' });
    }

    const table = process.env.CLIENTS_TABLE!;

    switch (action) {
      // ── Full profile read (used by frontend on persona switch) ────────────
      case 'get-all': {
        const result = await docClient.send(new GetCommand({
          TableName: table,
          Key: { clientId },
        }));
        const item = result.Item ?? {};
        return jsonResponse(200, {
          clientId:          item.clientId          ?? clientId,
          name:              item.name              ?? null,
          phone:             item.phone             ?? null,
          displayPhone:      item.displayPhone      ?? null,
          email:             item.email             ?? null,
          address:           item.address           ?? null,
          totalBalance:      item.totalBalance      ?? null,
          accounts:          item.accounts          ?? [],
          holdings:          item.holdings          ?? [],
          // transactions now live in bobs-transactions — fetched separately via
          // get-recent-transactions / get-transactions-page (omitted here so the
          // frontend keeps its static fallback when offline).
          beneficiaries:     item.beneficiaries     ?? [],
          autoInvest:        item.autoInvest        ?? [],
          rmd:               item.rmd               ?? { eligible: false },
          recentChatHistory: item.recentChatHistory ?? [],
        });
      }

      // ── Continuation memory (most recent agent chat) ──────────────────────
      // Powers the "Continue this chat" card in the customer chat widget. Returns
      // null when there is no recent agent chat (or after a "Reset all").
      case 'get-continuation': {
        const result = await docClient.send(new GetCommand({
          TableName: table,
          Key: { clientId },
          ProjectionExpression: 'lastAgentChat',
        }));
        return jsonResponse(200, { lastAgentChat: result.Item?.lastAgentChat ?? null });
      }

      // ── Profile fields (name, phone, email, address) ──────────────────────
      case 'put-profile': {
        const p = data as {
          name?: string; phone?: string; displayPhone?: string;
          email?: string; address?: string;
          totalBalance?: number; accounts?: unknown[];
        };
        await docClient.send(new UpdateCommand({
          TableName: table,
          Key: { clientId },
          UpdateExpression:
            'SET #nm = :name, phone = :phone, displayPhone = :dp, ' +
            'email = :email, address = :addr, ' +
            'totalBalance = :tb, accounts = :accs',
          ExpressionAttributeNames: { '#nm': 'name' },
          ExpressionAttributeValues: {
            ':name': p.name,
            ':phone': p.phone,
            ':dp':   p.displayPhone,
            ':email': p.email,
            ':addr': p.address,
            ':tb':   p.totalBalance,
            ':accs': p.accounts,
          },
        }));
        return jsonResponse(200, { ok: true });
      }

      // ── Holdings ──────────────────────────────────────────────────────────
      case 'put-holdings': {
        await docClient.send(new UpdateCommand({
          TableName: table,
          Key: { clientId },
          UpdateExpression: 'SET holdings = :v',
          ExpressionAttributeValues: { ':v': data },
        }));
        return jsonResponse(200, { ok: true });
      }

      // ── Transactions: deprecated whole-array write (now a no-op) ───────────
      // Transactions moved to the bobs-transactions table. The old frontend wrote
      // the entire array here; new code calls append-transaction instead. Kept as a
      // no-op so an un-deployed client can't error.
      case 'put-transactions': {
        return jsonResponse(200, { ok: true, deprecated: true });
      }

      // ── Transactions: recent (newest-first), optional accountId ────────────
      case 'get-recent-transactions': {
        const p = (data ?? {}) as { accountId?: string; limit?: number };
        const { items } = await queryTransactions({
          clientId,
          accountId: p.accountId,
          pageSize: Math.min(p.limit ?? 8, 50),
          sort: 'newest',
        });
        return jsonResponse(200, { transactions: items });
      }

      // ── Transactions: paginated full history with filters ──────────────────
      case 'get-transactions-page': {
        const p = (data ?? {}) as {
          accountId?: string; status?: string; search?: string;
          sort?: 'newest' | 'oldest'; limit?: number; cursor?: string;
        };
        const { items, cursor } = await queryTransactions({
          clientId,
          accountId: p.accountId,
          status: p.status,
          search: p.search,
          sort: p.sort === 'oldest' ? 'oldest' : 'newest',
          pageSize: Math.min(p.limit ?? 25, 100),
          startKey: decodeCursor(p.cursor),
        });
        return jsonResponse(200, { transactions: items, cursor });
      }

      // ── Transactions: append a single live row (Pending) ───────────────────
      case 'append-transaction': {
        const r = (data ?? {}) as {
          date?: string; description: string; amount: number;
          account: string; accountId: string; type?: TxnType; status?: string;
        };
        const row = buildTransactionRow({
          clientId,
          seq: liveSeq(),
          date: r.date ?? new Date().toISOString().slice(0, 10),
          description: r.description,
          amount: r.amount,
          account: r.account,
          accountId: r.accountId,
          type: r.type ?? 'purchase',
          status: (r.status as never) ?? 'Pending',
        });
        await docClient.send(new PutCommand({ TableName: TXNS_TABLE(), Item: row }));
        return jsonResponse(200, { ok: true, transaction: row });
      }

      // ── Beneficiaries ─────────────────────────────────────────────────────
      case 'get-beneficiaries': {
        const result = await docClient.send(new GetCommand({
          TableName: table,
          Key: { clientId },
          ProjectionExpression: 'beneficiaries',
        }));
        return jsonResponse(200, { beneficiaries: result.Item?.beneficiaries ?? [] });
      }

      case 'put-beneficiaries': {
        await docClient.send(new UpdateCommand({
          TableName: table,
          Key: { clientId },
          UpdateExpression: 'SET beneficiaries = :v',
          ExpressionAttributeValues: { ':v': data },
        }));
        return jsonResponse(200, { ok: true });
      }

      // ── Auto-invest ───────────────────────────────────────────────────────
      case 'get-auto-invest': {
        const result = await docClient.send(new GetCommand({
          TableName: table,
          Key: { clientId },
          ProjectionExpression: 'autoInvest',
        }));
        return jsonResponse(200, { autoInvest: result.Item?.autoInvest ?? [] });
      }

      case 'put-auto-invest': {
        await docClient.send(new UpdateCommand({
          TableName: table,
          Key: { clientId },
          UpdateExpression: 'SET autoInvest = :v',
          ExpressionAttributeValues: { ':v': data },
        }));
        return jsonResponse(200, { ok: true });
      }

      // ── RMD ───────────────────────────────────────────────────────────────
      case 'get-rmd': {
        const result = await docClient.send(new GetCommand({
          TableName: table,
          Key: { clientId },
          ProjectionExpression: 'rmd',
        }));
        return jsonResponse(200, { rmd: result.Item?.rmd ?? { eligible: false } });
      }

      case 'put-rmd': {
        await docClient.send(new UpdateCommand({
          TableName: table,
          Key: { clientId },
          UpdateExpression: 'SET rmd = :v',
          ExpressionAttributeValues: { ':v': data },
        }));
        return jsonResponse(200, { ok: true });
      }

      default:
        return jsonResponse(400, { error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error('client-data error', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }
};
