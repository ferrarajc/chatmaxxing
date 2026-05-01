import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { invokeNovaMicro, parseJsonFromBedrock } from '../shared/bedrock-client';
import {
  ClientProfile,
  jsonResponse,
} from '../shared/types';
import { getEligibleTopics } from '../shared/kb';

// ─── Lex V2 response builder helpers ──────────────────────────────────────────

function lexClose(sessionState: Record<string, unknown>, messages: Array<{ content: string }>) {
  return {
    sessionState: {
      ...sessionState,
      dialogAction: { type: 'Close' },
      intent: {
        ...(sessionState.intent as Record<string, unknown>),
        state: 'Fulfilled',
      },
    },
    messages: messages.map(m => ({ contentType: 'PlainText', content: m.content })),
  };
}

function lexElicit(sessionState: Record<string, unknown>, message: string) {
  return {
    sessionState: {
      ...sessionState,
      dialogAction: { type: 'ElicitSlot', slotToElicit: 'FundName' },
    },
    messages: [{ contentType: 'PlainText', content: message }],
  };
}

function lexDelegate(sessionState: Record<string, unknown>) {
  return {
    sessionState: {
      ...sessionState,
      dialogAction: { type: 'Delegate' },
    },
    messages: [],
  };
}

// ─── Intent handlers ──────────────────────────────────────────────────────────

function handleGreeting(event: LexEvent): LexResponse {
  const name = event.sessionState?.sessionAttributes?.clientName ?? 'there';
  return lexClose(event.sessionState, [
    { content: `Hi ${name}! I'm the Bob's Mutual Funds virtual assistant. How can I help you today?` },
  ]);
}

function handleAccountBalance(event: LexEvent): LexResponse {
  const accounts: string = event.sessionState?.sessionAttributes?.accountSummary ?? '';
  const msg = accounts
    ? `Here's a summary of your accounts:\n${accounts}\n\nIs there anything specific you'd like to do with one of these?`
    : "I can see your account information. Let me pull that up for you — or I can connect you with an agent for a detailed review. Which would you prefer?";
  return lexClose(event.sessionState, [{ content: msg }]);
}

function handleFundPerformance(event: LexEvent): LexResponse {
  const fundName = event.sessionState?.intent?.slots?.FundName?.value?.interpretedValue;
  if (!fundName) {
    return lexElicit(event.sessionState, 'Which fund are you asking about? For example, BobsFunds 500 Index or BobsFunds Growth.');
  }
  // Hardcoded demo performance data
  const perf: Record<string, string> = {
    'BobsFunds 500 Index': '1-year: +24.1% | 3-year: +9.8% | 5-year: +13.2% | Expense ratio: 0.03%',
    'BobsFunds Growth': '1-year: +31.4% | 3-year: +12.1% | 5-year: +18.7% | Expense ratio: 0.25%',
    'BobsFunds Bond Income': '1-year: +4.2% | 3-year: +2.1% | 5-year: +3.8% | Expense ratio: 0.10%',
    'BobsFunds International': '1-year: +15.3% | 3-year: +6.4% | 5-year: +9.1% | Expense ratio: 0.20%',
    'BobsFunds ESG Leaders': '1-year: +22.7% | 3-year: +9.3% | 5-year: +12.8% | Expense ratio: 0.18%',
    'BobsFunds Short-Term Treasury': '1-year: +5.1% | 3-year: +3.2% | 5-year: +2.9% | Expense ratio: 0.08%',
  };
  const data = perf[fundName] ?? 'performance data not available for that fund';
  return lexClose(event.sessionState, [{
    content: `Here are the performance figures for **${fundName}**:\n\n${data}\n\nWould you like to do anything else?`,
  }]);
}

function handleChangeOwnership(event: LexEvent): LexResponse {
  return lexClose(event.sessionState, [{
    content: "Account ownership changes — such as inherited accounts — require our dedicated Change of Ownership team. I'll transfer you to a specialist now. Please hold.",
  }]);
}

function handleTechnicalHelp(event: LexEvent): LexResponse {
  return lexClose(event.sessionState, [{
    content: "I'm sorry you're having trouble. For account access issues, you can reset your password at the login page. If you're still stuck, I can connect you to a live agent right away. Would you like that?",
  }]);
}

function handleEscalateAgent(event: LexEvent): LexResponse {
  return lexClose(event.sessionState, [{
    content: "Of course! I'd be happy to connect you with a live agent. Would you prefer to chat now, or would a callback at a time of your choosing work better?",
  }]);
}

function handleScheduleCallback(event: LexEvent): LexResponse {
  return lexClose(event.sessionState, [{
    content: "I can arrange a callback for you. Would you like us to call you right away, or at a specific date and time? Our agents are available Monday through Friday, 8 AM to 8 PM Eastern.",
  }]);
}

function handleFallback(event: LexEvent): LexResponse {
  return lexClose(event.sessionState, [{
    content: "I'm not sure I understood that. Could you rephrase, or would you like me to connect you with a live agent who can help?",
  }]);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface LexSlot {
  value?: { interpretedValue?: string; originalValue?: string };
}

interface LexEvent {
  sessionState: {
    sessionAttributes?: Record<string, string>;
    intent?: {
      name?: string;
      state?: string;
      slots?: Record<string, LexSlot>;
    };
    dialogAction?: { type: string };
  };
  inputTranscript?: string;
  invocationSource?: 'DialogCodeHook' | 'FulfillmentCodeHook';
  requestAttributes?: Record<string, string>;
}

type LexResponse = ReturnType<typeof lexClose>;

// ─── Main handler ─────────────────────────────────────────────────────────────

export const handler = async (
  event: APIGatewayProxyEventV2 | LexEvent,
): Promise<APIGatewayProxyResultV2 | LexResponse> => {
  // Mode A: HTTP API call (from customer app on chat open)
  if ('body' in event || 'headers' in event) {
    return handleApiMode(event as APIGatewayProxyEventV2);
  }

  // Mode B: Lex fulfillment hook
  return handleLexMode(event as LexEvent);
};

const PAGE_DESCRIPTIONS: Record<string, string> = {
  home:      'Home dashboard showing portfolio summary, market data, and featured funds',
  portfolio: 'Portfolio page showing account balances, holdings, allocation chart, and recent transactions',
  research:  'Fund research page with fund cards, performance data, and comparison tools',
  account:   'Account settings page with personal info, security settings, beneficiary, and tax documents',
};

async function handleApiMode(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const { currentPage, clientId } = JSON.parse(event.body ?? '{}');

    let recentTopics: string[] = [];
    let accountTypes: string[] = [];
    if (clientId) {
      try {
        const result = await docClient.send(
          new GetCommand({ TableName: process.env.CLIENTS_TABLE!, Key: { clientId } }),
        );
        if (result.Item) {
          const profile = result.Item as ClientProfile;
          recentTopics = profile.recentChatHistory?.map(h => h.topic) ?? [];
          accountTypes = profile.accounts?.map(a => a.type) ?? [];
        }
      } catch (e) {
        console.warn('Could not fetch client profile', e);
      }
    }

    const page = currentPage ?? 'home';
    const pageDesc = PAGE_DESCRIPTIONS[page] ?? PAGE_DESCRIPTIONS.home;

    // Filter KB to topics eligible for this page + client's account types
    const eligible = getEligibleTopics(page, accountTypes).map(t => t.label);
    const fallback = eligible.slice(0, 4);

    if (eligible.length === 0) {
      return jsonResponse(200, { topics: fallback, somethingElse: true });
    }

    let topics: string[] = fallback;
    try {
      const systemPrompt = `You are a virtual assistant for Bob's Mutual Funds.
Page: ${pageDesc}.
Client account types: ${accountTypes.join(', ') || 'unknown'}.
Recent topics: ${recentTopics.join(', ') || 'none'}.

Select exactly 4 topics from the list below that are most relevant to this client right now.

PAGE-SPECIFIC GUIDANCE:
- portfolio page: Prioritize balance/transaction topics AND topics distinctive to this client's account types (e.g. SEP-IRA topics for SEP-IRA holders, RMD topics for Traditional IRA holders). Include "Fund performance" if eligible.
- research page: Prioritize fund comparison and investment education topics. Do NOT repeat topics already covered on the portfolio page.
- account page: Always include at least one of these account management topics if eligible: "Update contact info", "Security settings", "Change beneficiary". Also include account-type-specific topics.
- home page: Always include at least one action/contact topic if eligible: "Schedule a callback", "Open a new account", "Auto-invest setup". Blend with relevant account-specific topics.

RULES:
- Select ONLY from the provided list — do NOT invent or rephrase any topic.
- Return labels VERBATIM, character-for-character as they appear in the list.
- Return ONLY valid JSON: {"topics": ["...", "...", "...", "..."]}

Topic list: ${eligible.join(' | ')}`;

      const raw = await invokeNovaMicro('Select 4 topics for this client.', systemPrompt, 150);
      const parsed = parseJsonFromBedrock<{ topics: string[] }>(raw);
      const selected = (parsed.topics ?? []).filter(t => eligible.includes(t));
      // Fill any missing slots with fallback labels not already selected
      const filled = [...selected];
      for (const label of fallback) {
        if (filled.length >= 4) break;
        if (!filled.includes(label)) filled.push(label);
      }
      topics = filled.slice(0, 4);
    } catch (e) {
      console.warn('Topic selection failed, using fallback', e);
    }

    return jsonResponse(200, { topics, somethingElse: true });
  } catch (err) {
    console.error('predict-intent API error', err);
    return jsonResponse(500, { error: 'Failed to predict intent' });
  }
}

function handleLexMode(event: LexEvent): LexResponse {
  const intentName = event.sessionState?.intent?.name ?? 'FallbackIntent';

  switch (intentName) {
    case 'Greeting':          return handleGreeting(event);
    case 'AccountBalance':    return handleAccountBalance(event);
    case 'FundPerformance':   return handleFundPerformance(event);
    case 'ChangeOwnership':   return handleChangeOwnership(event);
    case 'TechnicalHelp':     return handleTechnicalHelp(event);
    case 'EscalateAgent':     return handleEscalateAgent(event);
    case 'ScheduleCallback':  return handleScheduleCallback(event);
    case 'PlaceOrder':
      return lexClose(event.sessionState, [{
        content: "I can help with placing a trade. To protect your account, our agents handle all trade confirmations. Let me connect you — would you prefer chat or a callback?",
      }]);
    default:                  return handleFallback(event);
  }
}
