import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { jsonResponse } from '../shared/types';
import { invokeNovaMicro } from '../shared/bedrock-client';

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

const RECAP_FALLBACK = 'you connected with our team about your account';

/**
 * Generate the retrospective recap shown on the "Continue this chat" card.
 * A single second-person, past-tense clause completing "In your last chat, ___",
 * summarizing what actually happened (from the transcript) — not just the opening ask.
 */
async function generateRetrospectiveSummary(body: SaveTranscriptRequest): Promise<string> {
  const convo = (body.messages ?? [])
    .filter(m => m.role === 'CUSTOMER' || m.role === 'AGENT' || m.role === 'BOT')
    .map(m => `${m.role}: ${m.content}`)
    .join('\n')
    .slice(0, 6000);
  if (!convo.trim()) return RECAP_FALLBACK;

  try {
    const raw = await invokeNovaMicro(
      convo,
      `You are writing a one-line retrospective recap of ${body.clientName ?? 'a customer'}'s most recent support chat, shown to them when they return.
The transcript is formatted as "ROLE: message" lines (CUSTOMER = the client, AGENT = the human representative, BOT = the assistant).
Write a SINGLE clause in the SECOND PERSON ("you"), PAST TENSE, that completes the sentence: "In your last chat, ___".
- Summarize what actually happened or was accomplished across the chat — not just the opening request.
- Begin the clause with "you" (lowercase). Be specific and natural. One complete thought, max 25 words.
- Do NOT add a trailing period. Do NOT use quotation marks. Return only the clause.
Example: you granted your wife limited access to trade on your account`,
      80,
      { fn: 'save-transcript', contactId: body.transcriptId, scope: 'continuation-recap' },
    );
    let cleaned = raw.trim().replace(/^["']|["']$/g, '').replace(/\.+$/, '').trim();
    if (cleaned) cleaned = cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
    return cleaned || RECAP_FALLBACK;
  } catch (e) {
    console.warn('save-transcript: retrospective summary generation failed', e);
    return RECAP_FALLBACK;
  }
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

    // Generated before the Put so it's stored on the transcript row too — the
    // customer chat-history list shows it on each past-chat card.
    const summary = await generateRetrospectiveSummary(body);

    await docClient.send(new PutCommand({
      TableName: table,
      Item: {
        transcriptId,
        clientId,
        clientName: clientName ?? 'Unknown',
        intentSummary: body.intentSummary ?? '',
        summary,
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
            summary,
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
