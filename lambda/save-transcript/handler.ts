import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
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
  /** Connect username of the agent who handled this chat (used for the "continue this chat" availability check). */
  agentUsername?: string;
  /** Display name of the agent who handled this chat. */
  agentName?: string;
  messages: TranscriptMessage[];
}

/** Build the one-sentence intent summary shown on the "Continue this chat" card. */
function buildContinuationSummary(body: SaveTranscriptRequest): string {
  const fromIntent = (body.intentSummary ?? '').replace(/\*\*/g, '').trim();
  if (fromIntent) return fromIntent.slice(0, 200);
  const fromAcw = (body.acwSummary ?? '').trim();
  if (fromAcw) return fromAcw.slice(0, 200);
  return 'your recent inquiry';
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
    const endTime = body.endTime ?? (messages[messages.length - 1]?.ts ?? now);

    await docClient.send(new PutCommand({
      TableName: table,
      Item: {
        transcriptId,
        clientId,
        clientName: clientName ?? 'Unknown',
        intentSummary: body.intentSummary ?? '',
        startTime: body.startTime ?? (messages[0]?.ts ?? now),
        endTime,
        durationMs: endTime - (body.startTime ?? now),
        wrapUpCode: body.wrapUpCode ?? null,
        acwSummary: body.acwSummary ?? null,
        agentUsername: body.agentUsername ?? null,
        agentName: body.agentName ?? null,
        messageCount: messages.length,
        messages,
        savedAt: now,
      },
    }));

    // Record this as the client's most-recent agent chat so the customer app can
    // offer "Continue this chat" on their next visit. This lives on the Clients
    // table (NOT the transcripts table) so the demo "Reset all" can clear the
    // continuation memory while leaving the permanent transcript log untouched.
    try {
      await docClient.send(new UpdateCommand({
        TableName: process.env.CLIENTS_TABLE!,
        Key: { clientId },
        UpdateExpression: 'SET lastAgentChat = :lac',
        ExpressionAttributeValues: {
          ':lac': {
            transcriptId,
            endedAt: endTime,
            summary: buildContinuationSummary(body),
            agentUsername: body.agentUsername ?? '',
            agentName: body.agentName ?? '',
          },
        },
      }));
    } catch (e) {
      console.warn('save-transcript: could not write lastAgentChat', e);
    }

    try {
      await docClient.send(new UpdateCommand({
        TableName: process.env.SESSIONS_TABLE!,
        Key: { contactId: transcriptId },
        UpdateExpression: 'SET #s = :completed',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':completed': 'completed' },
        ConditionExpression: 'attribute_exists(contactId)',
      }));
    } catch (e) {
      if (!(e instanceof ConditionalCheckFailedException)) {
        console.warn('save-transcript: could not mark session completed', e);
      }
    }

    return jsonResponse(200, { ok: true, transcriptId });
  } catch (e) {
    console.error('save-transcript error', e);
    return jsonResponse(500, { error: 'Internal error' });
  }
};
