import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { jsonResponse } from '../shared/types';

type Action =
  | 'get-all'
  | 'get-beneficiaries' | 'put-beneficiaries'
  | 'get-auto-invest'   | 'put-auto-invest'
  | 'get-rmd'           | 'put-rmd'
  | 'put-profile'
  | 'put-holdings'
  | 'put-transactions';

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
          transactions:      item.transactions      ?? [],
          beneficiaries:     item.beneficiaries     ?? [],
          autoInvest:        item.autoInvest        ?? [],
          rmd:               item.rmd               ?? { eligible: false },
          recentChatHistory: item.recentChatHistory ?? [],
        });
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

      // ── Transactions ──────────────────────────────────────────────────────
      case 'put-transactions': {
        await docClient.send(new UpdateCommand({
          TableName: table,
          Key: { clientId },
          UpdateExpression: 'SET transactions = :v',
          ExpressionAttributeValues: { ':v': data },
        }));
        return jsonResponse(200, { ok: true });
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
