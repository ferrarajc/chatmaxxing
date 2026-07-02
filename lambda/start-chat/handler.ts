import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { ConnectClient, StartChatContactCommand } from '@aws-sdk/client-connect';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { invokeNovaMicro } from '../shared/bedrock-client';
import { summarizeChatIntent } from '../shared/intent-summary';
import { jsonResponse } from '../shared/types';

const connectClient = new ConnectClient({ region: process.env.AWS_REGION });

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const {
      clientId, clientName, currentPage, escalate, intentSummary,
      continuation, continuedFromTranscriptId, preferredAgentUsername,
    } = JSON.parse(event.body ?? '{}');

    if (!clientId || !clientName) {
      return jsonResponse(400, { error: 'clientId and clientName are required' });
    }

    // Generate a short AI label and a natural agent greeting sentence when escalating.
    let intentLabel = '';
    let intentGreeting = '';
    // The agent app already prepends a greeting + self-introduction
    // ("Hi <first name>, my name is <agent> with Bob's Mutual Funds.") to whatever
    // we return here, so this text must be ONLY the topic-specific close — no
    // greeting, no name, no re-introduction. For a continued chat the close
    // references the prior conversation; otherwise it restates the intent.
    const greetingSystemPrompt = continuation
      ? `You are writing the continuation-specific closing line(s) of a financial services agent's opening greeting to a returning customer who chose to CONTINUE a previous chat. A greeting and self-introduction ("Hi <first name>, my name is <agent> with Bob's Mutual Funds.") is ALREADY prepended for you.
CRITICAL: Do NOT greet the customer again, do NOT introduce yourself, and do NOT use the customer's name — that would create a duplicate greeting.
The text below is a one-sentence summary of what the customer was working on previously.
Briefly reference that earlier topic to show continuity, then invite them to pick up where they left off. Example: "I see we were working on your IRA beneficiary update — let's pick up right where we left off. How would you like to proceed?"
Write in the first person as the agent. Return only the sentence(s) — no quotes, no greeting, no preamble.`
      : `You are writing 1-2 sentences for a financial services agent to close their opening chat greeting.
The transcript below shows what the customer discussed with the chatbot before asking for a live agent.
The customer's name is ${clientName}. Other names that appear in the transcript (beneficiaries, fund names, etc.) are NOT the customer.
The transcript is formatted as "ROLE: message | ROLE: message | ...".

If the customer's need is clearly and fully explained: briefly restate it in your own words to confirm understanding, then ask if you have it right. Example: "It sounds like you're trying to figure out how much you need to withdraw from your IRA this year and whether taxes will be withheld automatically — is that right?"

If the topic is mentioned but the customer hasn't fully explained what they need: acknowledge the topic and ask a focused follow-up to understand their specific situation. Example: "I can see you have some questions about RMDs — could you tell me a bit more about what you're trying to figure out?"

If there is NO clear intent signal in the transcript: return exactly: How can I assist you today?

Write in first person as the agent. Do not include any reference to "connecting with a live agent" or "speaking with a representative" — the agent reading this greeting IS already live with the customer. Return only the sentences — no quotes, no preamble.`;

    if (escalate && intentSummary) {
      try {
        const [labelRaw, greetingRaw] = await Promise.all([
          summarizeChatIntent(intentSummary, clientName),
          invokeNovaMicro(
            intentSummary,
            greetingSystemPrompt,
            120,
          ),
        ]);
        intentLabel = labelRaw.slice(0, 150);
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
          // Continuation metadata — present only when the client clicked "Continue this chat".
          // The agent app reads these to load the prior transcript into the column.
          continuation: continuation ? 'true' : '',
          continuedFromTranscriptId: continuedFromTranscriptId ?? '',
          preferredAgentUsername: preferredAgentUsername ?? '',
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
