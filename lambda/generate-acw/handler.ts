import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { invokeNovaMicro, parseJsonFromBedrock } from '../shared/bedrock-client';
import {
  ChatMessage,
  ClientProfile,
  formatTranscriptForBedrock,
  summarizeAccounts,
  jsonResponse,
} from '../shared/types';

const WRAP_UP_CODES = [
  'Account Inquiry',
  'Address Update',
  'Beneficiary Change',
  'Complaint Filed',
  'Contribution Question',
  'Distribution Request',
  'Estate Planning',
  'Fee Dispute',
  'Fund Comparison',
  'Fund Switch',
  'General Information',
  'Grievance',
  'Investment Advice',
  'IRA Inquiry',
  'Market Question',
  'New Account',
  'Password Reset',
  'Performance Question',
  'Portfolio Review',
  'RMD Calculation',
  'Rebalancing Discussion',
  'Referral',
  'Retirement Planning',
  'SEP-IRA Question',
  'Systematic Withdrawal',
  'Tax Information',
  'Technical Issue',
  'Transfer Request',
  'Withdrawal Processing',
];

const ACW_PROMPT = (profile: ClientProfile) =>
  `You are a quality assurance AI for Bob's Mutual Funds call center.
Client: ${profile.name}. Accounts: ${summarizeAccounts(profile.accounts)}.

Review the conversation transcript and return ONLY valid JSON with:

1. wrapUpCode: The single most appropriate wrap-up code from this exact list:
   ${WRAP_UP_CODES.join(', ')}
   Pick the BEST match based on the primary topic of the chat. Return the code exactly as spelled above.

2. coaching: {
     "positive": "One sentence of genuine, specific positive feedback about something the agent actually did well.",
     "bullets": ["Up to 2 short, specific, actionable improvement points. Each is one sentence. Omit bullets if the interaction was excellent — max 2 bullets."]
   }

3. summary: A factual 3-5 sentence summary of what was discussed, what actions were taken or promised, and the outcome.

Return ONLY valid JSON:
{
  "wrapUpCode": "...",
  "coaching": { "positive": "...", "bullets": [] },
  "summary": "..."
}`;

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const {
      transcript,
      clientProfile,
    }: {
      transcript: ChatMessage[];
      clientProfile: ClientProfile;
    } = JSON.parse(event.body ?? '{}');

    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
      return jsonResponse(400, { error: 'transcript is required' });
    }

    const profile: ClientProfile = clientProfile ?? {
      clientId: 'demo-client-001',
      name: 'Alex Johnson',
      phone: '4842384838',
      accounts: [{ type: 'Roth IRA', balance: 45230, id: 'acc-001' }],
      totalBalance: 45230,
      recentChatHistory: [],
    };

    const raw = await invokeNovaMicro(
      formatTranscriptForBedrock(transcript),
      ACW_PROMPT(profile),
      700,
      { fn: 'generate-acw', contactId: profile.clientId },
    );

    const parsed = parseJsonFromBedrock<{
      wrapUpCode: string;
      coaching: { positive: string; bullets: string[] };
      summary: string;
    }>(raw);

    const wrapUpCode = WRAP_UP_CODES.includes(parsed.wrapUpCode)
      ? parsed.wrapUpCode
      : 'General Information';

    return jsonResponse(200, {
      wrapUpCode,
      coaching: {
        positive: parsed.coaching?.positive ?? 'Good interaction with the client.',
        bullets: Array.isArray(parsed.coaching?.bullets)
          ? parsed.coaching.bullets.slice(0, 2)
          : [],
      },
      summary: parsed.summary ?? 'Chat session completed.',
      wrapUpCodes: WRAP_UP_CODES,
    });
  } catch (err) {
    console.error('generate-acw error', err);
    return jsonResponse(500, { error: 'ACW generation failed' });
  }
};
