import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  ConnectParticipantClient,
  CreateParticipantConnectionCommand,
  ConnectionType,
} from '@aws-sdk/client-connectparticipant';
import { jsonResponse } from '../shared/types';

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const { participantToken } = JSON.parse(event.body ?? '{}');

    if (!participantToken) {
      return jsonResponse(400, { error: 'participantToken is required' });
    }

    const client = new ConnectParticipantClient({
      region: process.env.AWS_REGION ?? 'us-east-1',
    });

    const response = await client.send(
      new CreateParticipantConnectionCommand({
        ParticipantToken: participantToken,
        Type: [ConnectionType.WEBSOCKET, ConnectionType.CONNECTION_CREDENTIALS],
        ConnectParticipant: true,
      }),
    );

    return jsonResponse(200, {
      connectionToken: response.ConnectionCredentials?.ConnectionToken,
      websocketUrl: response.Websocket?.Url,
      expiresAt: response.ConnectionCredentials?.Expiry,
    });
  } catch (err) {
    console.error('agent-connection error', err);
    return jsonResponse(500, { error: 'Failed to create participant connection' });
  }
};
