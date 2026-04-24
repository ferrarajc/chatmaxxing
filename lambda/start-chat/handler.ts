import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { ConnectClient, StartChatContactCommand } from '@aws-sdk/client-connect';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { invokeNovaMicro } from '../shared/bedrock-client';
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

    // Generate a short AI label and a natural agent greeting sentence when escalating.
    let intentLabel = '';
    let intentGreeting = '';
    if (escalate && intentSummary) {
      try {
        const [labelRaw, greetingRaw] = await Promise.all([
          invokeNovaMicro(
            intentSummary,
            `You are summarizing a full customer support chat transcript for a financial services agent.
The transcript is formatted as "ROLE: message | ROLE: message | ...".
Write a single concise sentence (max 20 words) capturing what the customer's core need or question is.
Start with the client's first name if you can detect it, e.g. "Alex asked about RMD rules and wants withdrawal guidance".
Focus on the customer's underlying goal — not just the last message.
Return only the plain text — no quotes, no JSON, no punctuation at the end.`,
            80,
          ),
          invokeNovaMicro(
            intentSummary,
            `You are writing one sentence for a financial services agent to close their opening chat greeting.
The transcript below shows what the customer discussed with the chatbot before asking for a live agent.
The transcript is formatted as "ROLE: message | ROLE: message | ...".
If the customer's intent or topic is clear, write a single warm sentence acknowledging it — as the agent would say it in first person, e.g. "I can see you have some questions about your RMDs — I'm happy to help with that." or "It looks like you're looking to update your beneficiary — let's take care of that."
If there is NO clear intent signal in the transcript, return exactly the 6 words: How can I assist you today?
Return only the single sentence — no quotes, no preamble, no punctuation beyond a period or question mark.`,
            60,
          ),
        ]);
        intentLabel = labelRaw.trim().replace(/^["']|["']$/g, '').replace(/\.$/, '').slice(0, 150);
        intentGreeting = greetingRaw.trim().replace(/^["']|["']$/g, '');
      } catch (e) {
        console.warn('Intent label/greeting generation failed', e);
      }
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
          intentLabel,
          intentGreeting,
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
