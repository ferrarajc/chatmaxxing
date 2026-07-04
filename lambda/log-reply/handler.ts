import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { jsonResponse } from '../shared/types';

const nanoid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/**
 * Records how an agent arrived at each customer message they send — did they send our AI
 * suggestion as-is, edit it, replace it via "Change to", freehand their own, or edit an
 * autopilot reply. Captures the original vs. what was actually sent so we can later study
 * how well our suggestions land and improve them.
 *
 * Fire-and-forget: the agent app never blocks on this and never surfaces a failure.
 *
 * POST /log-reply  { contactId, clientId, agentUsername?, agentName?, path, ...fields }
 */
export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const body = JSON.parse(event.body ?? '{}');
    const contactId: string = body.contactId || 'unknown';
    const nowIso = new Date().toISOString();

    const item = {
      contactId,
      eventSort: `${nowIso}#${nanoid()}`,          // sortable, unique per event
      createdAt: Date.now(),
      createdAtIso: nowIso,
      clientId: body.clientId ?? null,
      agentUsername: body.agentUsername ?? null,
      agentName: body.agentName ?? null,
      // How the message was produced: 'suggested-send' | 'composer-send' | 'autopilot-send'
      path: body.path ?? 'unknown',
      // Suggestion provenance (when applicable)
      source: body.source ?? null,                 // 'greeting' | 'nbr' | 'change-to'
      changeDirection: body.changeDirection ?? null,
      originalText: body.originalText ?? null,      // the AI-authored text
      suggestionShownText: body.suggestionShownText ?? null, // freehand: the suggestion that was ignored
      sentText: body.sentText ?? null,              // what actually went to the client
      wasEdited: body.wasEdited ?? null,
    };

    await docClient.send(new PutCommand({
      TableName: process.env.REPLY_EVENTS_TABLE,
      Item: item,
    }));

    return jsonResponse(200, { ok: true });
  } catch (err) {
    console.error('log-reply handler error', err);
    return jsonResponse(500, { error: 'log failed' });
  }
};
