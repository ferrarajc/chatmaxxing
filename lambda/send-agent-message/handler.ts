import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  ConnectParticipantClient,
  CreateParticipantConnectionCommand,
  SendMessageCommand,
  ConnectionType,
} from '@aws-sdk/client-connectparticipant';
import { jsonResponse } from '../shared/types';

const client = new ConnectParticipantClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
});

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const { participantToken, message } = JSON.parse(event.body ?? '{}');

    if (!participantToken || !message) {
      return jsonResponse(400, { error: 'participantToken and message are required' });
    }

    // Get a fresh connection token for this participant token
    const connResult = await client.send(
      new CreateParticipantConnectionCommand({
        ParticipantToken: participantToken,
        Type: [ConnectionType.CONNECTION_CREDENTIALS],
      }),
    );

    const connectionToken = connResult.ConnectionCredentials?.ConnectionToken;
    if (!connectionToken) {
      return jsonResponse(500, { error: 'Failed to obtain connection token' });
    }

    // Send the message using the connection token
    await client.send(
      new SendMessageCommand({
        ConnectionToken: connectionToken,
        Content: message,
        ContentType: 'text/plain',
      }),
    );

    return jsonResponse(200, { ok: true });
  } catch (err) {
    console.error('send-agent-message error', err);
    return jsonResponse(500, { error: String(err) });
  }
};
