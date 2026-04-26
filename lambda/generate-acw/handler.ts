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
  'Access Authorization',
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

The transcript below is a conversation between a CLIENT and an AGENT. Both voices are present.
You are evaluating the AGENT's performance — not the client's.

Review the conversation transcript and return ONLY valid JSON with:

1. wrapUpCode: The single most appropriate wrap-up code from this exact list:
   ${WRAP_UP_CODES.join(', ')}
   Pick the BEST match based on the primary topic. Use these definitions to disambiguate:
   - "Access Authorization": granting or modifying another person's access to an account (e.g. spouse, family member, POA)
   - "Beneficiary Change": updating the named beneficiary on an account (who inherits on death)
   - "Account Inquiry": general questions about an account's status, balance, or features
   Return the code exactly as spelled above.

2. coaching: Evaluate the AGENT (not the client). Both sides of the conversation are in the transcript — focus only on what the agent said and did.
   {
     "positive": "One sentence of genuine, specific positive feedback for the AGENT written in second person (e.g. 'You did a great job clearly confirming the client's need before proceeding.'). Encouraging and direct.",
     "bullets": ["At most 1 short, specific, actionable improvement point for the AGENT written in second person (e.g. 'Consider summarizing next steps more explicitly at the close.'). One sentence max. Omit entirely (empty array) if the interaction was excellent."]
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
          ? parsed.coaching.bullets.slice(0, 1)
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
