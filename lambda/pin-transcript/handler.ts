import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { jsonResponse } from '../shared/types';

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const { transcriptId, pinned } = JSON.parse(event.body ?? '{}');
    if (!transcriptId || typeof pinned !== 'boolean') {
      return jsonResponse(400, { error: 'transcriptId and pinned (boolean) are required' });
    }
    await docClient.send(new UpdateCommand({
      TableName: process.env.TRANSCRIPTS_TABLE!,
      Key: { transcriptId },
      UpdateExpression: 'SET pinned = :v',
      ExpressionAttributeValues: { ':v': pinned },
    }));
    return jsonResponse(200, { ok: true });
  } catch (e) {
    console.error('pin-transcript error', e);
    return jsonResponse(500, { error: 'Internal error' });
  }
};
