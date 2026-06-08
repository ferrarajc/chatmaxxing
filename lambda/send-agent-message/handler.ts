import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { jsonResponse } from '../shared/types';

// Use raw fetch (Node 18+) instead of @aws-sdk/client-connectparticipant.
// The SDK adds IAM SigV4 signing even for bearer-token endpoints, and the
// Lambda's execution role has no connectparticipant:* IAM allow, causing 403.
// The ConnectParticipant SendMessage/SendEvent APIs only require X-Amz-Bearer: connectionToken.

// Maps a short event name from the client to a Connect participant event content type.
// Currently only "typing" is used (drives the customer-side typing indicator while the
// agent is composing a reply or autopilot is delaying a send).
const EVENT_CONTENT_TYPES: Record<string, string> = {
  typing: 'application/vnd.amazonaws.connect.event.typing',
};

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const { connectionToken, message, event: eventType } = JSON.parse(event.body ?? '{}');

    if (!connectionToken) {
      return jsonResponse(400, { error: 'connectionToken is required' });
    }

    const region = process.env.AWS_REGION ?? 'us-east-1';

    // ── Participant event (e.g. typing indicator) ──────────────────────────
    if (eventType) {
      const contentType = EVENT_CONTENT_TYPES[eventType as string];
      if (!contentType) {
        return jsonResponse(400, { error: `unsupported event: ${eventType}` });
      }
      const url = `https://participant.connect.${region}.amazonaws.com/participant/event`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Amz-Bearer': connectionToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ContentType: contentType }),
      });
      if (!response.ok) {
        const body = await response.text();
        console.error('SendEvent failed:', response.status, body);
        return jsonResponse(response.status < 500 ? response.status : 502, {
          error: `SendEvent ${response.status}: ${body}`,
        });
      }
      return jsonResponse(200, { ok: true });
    }

    // ── Participant message ────────────────────────────────────────────────
    if (!message) {
      return jsonResponse(400, { error: 'message or event is required' });
    }

    const url = `https://participant.connect.${region}.amazonaws.com/participant/message`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Amz-Bearer': connectionToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Content: message,
        ContentType: 'text/plain',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('SendMessage failed:', response.status, body);
      return jsonResponse(response.status < 500 ? response.status : 502, {
        error: `SendMessage ${response.status}: ${body}`,
      });
    }

    return jsonResponse(200, { ok: true });
  } catch (err) {
    console.error('send-agent-message error', err);
    return jsonResponse(500, { error: String(err) });
  }
};
