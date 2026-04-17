import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { invokeNovaMicro, parseJsonFromBedrock } from '../shared/bedrock-client';
import {
  ChatMessage,
  ClientProfile,
  matchResources,
  summarizeAccounts,
  formatTranscriptForBedrock,
  jsonResponse,
} from '../shared/types';

const SYSTEM_PROMPT = (profile: ClientProfile) =>
  `You are an AI assistant supporting a live chat agent at Bob's Mutual Funds.
The client is ${profile.name}. Their accounts: ${summarizeAccounts(profile.accounts)}.
Suggest ONE concise, professional reply the agent should send next (1-2 sentences max).
Do not include greetings or sign-offs.
Return ONLY valid JSON in this format: {"suggestedText": "..."}`;

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const {
      transcript,
      clientProfile,
    }: { transcript: ChatMessage[]; clientProfile: ClientProfile } = JSON.parse(event.body ?? '{}');

    if (!transcript?.length) {
      return jsonResponse(400, { error: 'transcript is required' });
    }

    const profile: ClientProfile = clientProfile ?? {
      clientId: 'demo-client-001',
      name: 'Alex Johnson',
      phone: '4842384838',
      accounts: [
        { type: 'Roth IRA', balance: 45230, id: 'acc-001' },
        { type: 'Traditional IRA', balance: 128450, id: 'acc-002' },
        { type: 'Taxable Account', balance: 67890, id: 'acc-003' },
      ],
      totalBalance: 241570,
      recentChatHistory: [],
    };

    const lastCustomerMessage = [...transcript]
      .reverse()
      .find(m => m.role === 'CUSTOMER')?.content ?? '';

    let suggestedText = '';
    try {
      const raw = await invokeNovaMicro(
        formatTranscriptForBedrock(transcript),
        SYSTEM_PROMPT(profile),
        200,
      );
      const parsed = parseJsonFromBedrock<{ suggestedText: string }>(raw);
      suggestedText = parsed.suggestedText ?? '';
    } catch (e) {
      console.warn('Bedrock NBR failed', e);
      suggestedText = "I'd be happy to help with that. Could you give me a moment to look into it?";
    }

    const resources = matchResources(lastCustomerMessage);

    return jsonResponse(200, { suggestedText, resources });
  } catch (err) {
    console.error('next-best-response error', err);
    return jsonResponse(500, { error: 'Failed to generate response' });
  }
};
