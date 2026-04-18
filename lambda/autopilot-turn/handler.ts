import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { invokeNovaMicro, parseJsonFromBedrock } from '../shared/bedrock-client';
import {
  ChatMessage,
  ClientProfile,
  formatTranscriptForBedrock,
  summarizeAccounts,
  jsonResponse,
} from '../shared/types';

const SYSTEM_PROMPT = (profile: ClientProfile, currentIntent: string) =>
  `You are a friendly, professional financial services agent at Bob's Mutual Funds handling a live chat.
The client's name is ${profile.name}. Their accounts: ${summarizeAccounts(profile.accounts)}.
Their current topic/intent: "${currentIntent}".
Your job is to respond as the agent — concisely (1-3 sentences), warm but professional.
Set shouldExitAutopilot=true if:
  - The request is ambiguous or unclear
  - It requires account modifications, trade execution, or sensitive actions
  - The client is frustrated or unhappy
  - Confidence is below 0.7
Return ONLY valid JSON: {"response": "...", "confidence": 0.0, "shouldExitAutopilot": false}`;

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const {
      transcript,
      clientProfile,
      currentIntent,
    }: {
      transcript: ChatMessage[];
      clientProfile: ClientProfile;
      currentIntent?: string;
    } = JSON.parse(event.body ?? '{}');

    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
      return jsonResponse(400, { error: 'transcript is required and must be a non-empty array' });
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

    let response = '';
    let confidence = 0.5;
    let shouldExitAutopilot = false;

    try {
      const raw = await invokeNovaMicro(
        formatTranscriptForBedrock(transcript),
        SYSTEM_PROMPT(profile, currentIntent ?? 'general inquiry'),
        250,
      );
      const parsed = parseJsonFromBedrock<{
        response: string;
        confidence: number;
        shouldExitAutopilot: boolean;
      }>(raw);
      response = parsed.response ?? '';
      confidence = parsed.confidence ?? 0.5;
      shouldExitAutopilot = parsed.shouldExitAutopilot ?? (confidence < 0.7);

      // Business-rule hard override: trade execution and account modifications always
      // require a human agent — do not let AI judgment override this.
      const TRADE_INTENTS = ['PlaceOrder', 'ChangeOwnership', 'Transfer'];
      const tradeKeywords = /\b(buy|sell|purchase|trade|transfer|place.?order|liquidat|redeem)\b/i;
      const lastCustomerMsg = [...transcript].reverse().find(m => m.role === 'CUSTOMER')?.content ?? '';
      if (
        TRADE_INTENTS.some(i => (currentIntent ?? '').includes(i)) ||
        tradeKeywords.test(lastCustomerMsg)
      ) {
        shouldExitAutopilot = true;
      }
    } catch (e) {
      console.warn('Bedrock autopilot failed', e);
      shouldExitAutopilot = true;
      response = "I'd be happy to help with that. Let me look into it for you.";
    }

    // The browser (ChatColumn) sends the autopilot message via chatjs AgentChatSession.
    // This Lambda always returns the response text; sending is handled client-side.
    return jsonResponse(200, { response, confidence, shouldExitAutopilot });
  } catch (err) {
    console.error('autopilot-turn error', err);
    return jsonResponse(500, { error: 'Autopilot turn failed', shouldExitAutopilot: true });
  }
};
