import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { jsonResponse } from '../shared/types';

export interface TranscriptMessage {
  id: string;
  ts: number;
  role: 'CUSTOMER' | 'AGENT' | 'BOT' | 'SYSTEM';
  content: string;
}

export interface SaveTranscriptRequest {
  transcriptId: string;
  clientId: string;
  clientName: string;
  intentSummary: string;
  startTime: number;
  endTime: number;
  wrapUpCode?: string;
  acwSummary?: string;
  messages: TranscriptMessage[];
}

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const body = JSON.parse(event.body ?? '{}') as SaveTranscriptRequest;
    const { transcriptId, clientId, clientName, messages } = body;

    if (!transcriptId || !clientId) {
      return jsonResponse(400, { error: 'transcriptId and clientId are required' });
    }

    const table = process.env.TRANSCRIPTS_TABLE!;
    const now = Date.now();

    await docClient.send(new PutCommand({
      TableName: table,
      Item: {
        transcriptId,
        clientId,
        clientName: clientName ?? 'Unknown',
        intentSummary: body.intentSummary ?? '',
        startTime: body.startTime ?? (messages[0]?.ts ?? now),
        endTime: body.endTime ?? (messages[messages.length - 1]?.ts ?? now),
        durationMs: (body.endTime ?? now) - (body.startTime ?? now),
        wrapUpCode: body.wrapUpCode ?? null,
        acwSummary: body.acwSummary ?? null,
        messageCount: messages.length,
        messages,
        savedAt: now,
      },
    }));

    return jsonResponse(200, { ok: true, transcriptId });
  } catch (e) {
    console.error('save-transcript error', e);
    return jsonResponse(500, { error: 'Internal error' });
  }
};
