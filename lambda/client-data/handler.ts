import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { jsonResponse } from '../shared/types';

type Action = 'get-beneficiaries' | 'put-beneficiaries' | 'get-auto-invest' | 'put-auto-invest' | 'get-rmd' | 'put-rmd';

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
