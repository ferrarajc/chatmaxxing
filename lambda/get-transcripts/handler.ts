import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { GetCommand, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { jsonResponse } from '../shared/types';

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const table = process.env.TRANSCRIPTS_TABLE!;
    const params = event.queryStringParameters ?? {};

    // Single transcript by ID
    if (params.transcriptId) {
      const result = await docClient.send(new GetCommand({
        TableName: table,
        Key: { transcriptId: params.transcriptId },
      }));
      if (!result.Item) return jsonResponse(404, { error: 'Not found' });
      return jsonResponse(200, { transcript: result.Item });
    }

    // All transcripts for a client
    if (params.clientId) {
      const result = await docClient.send(new QueryCommand({
        TableName: table,
        IndexName: 'clientId-savedAt-index',
        KeyConditionExpression: 'clientId = :cid',
        ExpressionAttributeValues: { ':cid': params.clientId },
        ScanIndexForward: false,  // newest first
        ProjectionExpression: 'transcriptId, clientId, clientName, intentSummary, summary, acwSummary, agentName, startTime, endTime, durationMs, wrapUpCode, messageCount, savedAt, pinned',
      }));
      return jsonResponse(200, { transcripts: result.Items ?? [] });
    }

    // List all — scan, newest first, metadata only (no messages)
    const result = await docClient.send(new ScanCommand({
      TableName: table,
      ProjectionExpression: 'transcriptId, clientId, clientName, intentSummary, summary, acwSummary, agentName, startTime, endTime, durationMs, wrapUpCode, messageCount, savedAt, pinned',
    }));
    const sorted = (result.Items ?? []).sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
    return jsonResponse(200, { transcripts: sorted });
  } catch (e) {
    console.error('get-transcripts error', e);
    return jsonResponse(500, { error: 'Internal error' });
  }
};
