import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { ConnectClient, StartChatContactCommand } from '@aws-sdk/client-connect';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { jsonResponse } from '../shared/types';

const connectClient = new ConnectClient({ region: process.env.AWS_REGION });

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const { clientId, clientName, currentPage, escalate, intentSummary } = JSON.parse(event.body ?? '{}');

    if (!clientId || !clientName) {
      return jsonResponse(400, { error: 'clientId and clientName are required' });
    }

    // Use agent-routing flow when escalating; bot-disconnect flow otherwise
    const flowId = escalate
      ? (process.env.CONNECT_AGENT_FLOW_ID ?? process.env.CONNECT_CHAT_FLOW_ID!)
      : process.env.CONNECT_CHAT_FLOW_ID!;

    const response = await connectClient.send(
      new StartChatContactCommand({
        InstanceId: process.env.CONNECT_INSTANCE_ID!,
        ContactFlowId: flowId,
        ParticipantDetails: { DisplayName: clientName },
        Attributes: {
          clientId,
          clientName,
          currentPage: currentPage ?? 'home',
          intentSummary: intentSummary ?? '',
        },
        ChatDurationInMinutes: 60,
        SupportedMessagingContentTypes: ['text/plain', 'text/markdown'],
      }),
    );

    // Persist session stub — full history appended later
    await docClient.send(
      new PutCommand({
        TableName: process.env.SESSIONS_TABLE!,
        Item: {
          contactId: response.ContactId,
          clientId,
          timestamp: Date.now(),
          status: 'active',
          messages: [],
          expiresAt: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days TTL
        },
      }),
    );

    return jsonResponse(200, {
      participantToken: response.ParticipantToken,
      contactId: response.ContactId,
      participantId: response.ParticipantId,
    });
  } catch (err) {
    console.error('start-chat error', err);
    return jsonResponse(500, { error: 'Failed to start chat' });
  }
};
