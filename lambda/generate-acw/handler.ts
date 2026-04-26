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

1. wrapUpCode: Choose the MOST SPECIFIC code that fits the primary topic. Work through this ordered list and use the first one that clearly applies:

   Specific codes — prefer these:
   - "Access Authorization" — granting or modifying another person's access to an account (spouse, family member, POA, joint access)
   - "Beneficiary Change" — updating who inherits the account on the holder's death (NOT the same as access)
   - "Contribution Question" — questions about contributions, limits, or automatic investments
   - "Distribution Request" — withdrawals, redemptions, or one-time distributions
   - "Systematic Withdrawal" — recurring withdrawal plan setup or changes
   - "RMD Calculation" — required minimum distribution questions or calculations
   - "Fund Switch" — moving money between funds within an account
   - "Rebalancing Discussion" — portfolio rebalancing strategy
   - "Portfolio Review" — reviewing overall portfolio allocation or performance
   - "Investment Advice" — investment recommendations or strategy (even if deferred to callback)
   - "Transfer Request" — moving accounts between institutions (ACAT, rollover)
   - "IRA Inquiry" — IRA-specific rules, eligibility, or type comparisons
   - "SEP-IRA Question" — SEP-IRA specific questions
   - "Tax Information" — tax documents, cost basis, 1099s, tax-loss harvesting
   - "Estate Planning" — estate, trust, or inheritance planning
   - "Fund Comparison" — comparing fund options
   - "Performance Question" — fund or portfolio performance questions
   - "Market Question" — market conditions, economic outlook
   - "Retirement Planning" — retirement timeline or savings strategy
   - "New Account" — opening a new account
   - "Address Update" — updating contact or personal information
   - "Password Reset" — login or password issues
   - "Technical Issue" — website, app, or platform problems
   - "Fee Dispute" — questions or disputes about fees or expense ratios
   - "Complaint Filed" — formal complaint or grievance about service
   - "Grievance" — escalated dissatisfaction not yet a formal complaint
   - "Referral" — client referred to an advisor or specialist

   Last resort — use ONLY if nothing above clearly fits:
   - "Account Inquiry" — truly general account status question with no more specific category
   - "General Information" — purely educational, no account action or specific topic

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
