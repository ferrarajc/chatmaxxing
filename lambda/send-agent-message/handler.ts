import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { jsonResponse } from '../shared/types';

// Use raw fetch (Node 18+) instead of @aws-sdk/client-connectparticipant.
// The SDK adds IAM SigV4 signing even for bearer-token endpoints, and the
// Lambda's execution role has no connectparticipant:* IAM allow, causing 403.
// The ConnectParticipant SendMessage API only requires X-Amz-Bearer: connectionToken.

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const { connectionToken, message } = JSON.parse(event.body ?? '{}');

    if (!connectionToken || !message) {
      return jsonResponse(400, { error: 'connectionToken and message are required' });
    }

    const region = process.env.AWS_REGION ?? 'us-east-1';
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
