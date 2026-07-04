import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { invokeWithTools, invokeNovaMicro, parseJsonFromBedrock } from '../shared/bedrock-client';
import { NBR_CLIENT_TOOLS, createToolExecutor } from '../shared/client-tools';
import {
  ChatMessage,
  ClientProfile,
  Resource,
  KNOWLEDGE_BASE,
  matchResources,
  summarizeAccounts,
  formatTranscriptForBedrock,
  jsonResponse,
} from '../shared/types';

const RESOURCE_LIST = KNOWLEDGE_BASE.map(r => `${r.id}: ${r.title}`).join('\n');

// Deterministic detectors: advice/trade requests should always suggest a callback.
const ADVICE_RE = /\b(what|which|any|recommend|suggest|your)\b[^?.!]{0,50}\b(stock|stocks|fund|funds|invest|investment|investments|portfolio|allocation)\b|\b(should i (buy|sell|invest|put|move)|what should i do with|where should i (invest|put)|investment advice|financial advice|best (stock|stocks|fund|funds|investment|investments)|hot (stock|stocks|tip|tips))\b/i;
const TRADE_RE = /\b(buy|sell|purchase|trade|place.?order|liquidat|redeem)\b/i;

const NBR_HALLUCINATION_RULE = `

CRITICAL DATA RULE: You only know what is in this system prompt or what a tool returned. Never state specific financial figures (balances, holdings, transaction amounts, phone numbers, email addresses, or any client-specific numbers) that were not provided. Call the appropriate tool if you need that data.`;

const SYSTEM_PROMPT = (profile: ClientProfile) =>
  `You are an AI assistant supporting a live chat agent at Bob's Mutual Funds.
The client is ${profile.name}. Their accounts: ${summarizeAccounts(profile.accounts)}.

Suggest ONE concise, professional reply the agent should send next (1-2 sentences max).
Do not include greetings or sign-offs.

Also suggest an autopilot scope if the conversation calls for one:
- "get-intent": the customer's need is not yet clearly defined
- "researching": the agent has indicated they need time to look into something
- "callback": topic requires phone escalation (trades, financial advice, complex account changes)
- "idle-check": the customer has not responded in a while
- "full-auto": the conversation is simple and AI could handle it end-to-end
- null: no autopilot scope is needed right now

Also select the 0–3 most relevant knowledge base articles for this conversation, ordered by relevance (most relevant first). Only include articles that are genuinely on-topic — return an empty array if nothing fits well.

Available articles:
${RESOURCE_LIST}

Return ONLY valid JSON: {"suggestedText": "...", "suggestedScope": "get-intent" | "researching" | "callback" | "idle-check" | "full-auto" | null, "resourceIds": ["kb-xxx", ...]}`;

// ── "Change to" mode: propose a few fundamentally-different alternative directions ────────
// Assumes the drafted reply was the WRONG thing to send. Cheap, no tools (directions are
// about stance/angle, not client data). Best-effort → [] on any failure.
const CHANGE_OPTIONS_SYSTEM = (profile: ClientProfile) => {
  const firstName = (profile.name || '').trim().split(/\s+/)[0] || 'the client';
  return `You help a live chat agent at Bob's Mutual Funds pick a better next move with ${profile.name}.
We drafted a reply for the agent to send, but assume it may be the wrong move for THIS moment.
Propose 3-4 alternative moves the agent could make instead — each a short imperative label, max 10
words (aim for ~5).

STAY TIGHTLY ON THE CURRENT TOPIC AND MOMENT of this exact conversation. Do NOT change the subject or
drift to tangential topics, products, or goals. Each option must be a genuinely different WAY TO HANDLE
THIS SAME POINT — for example:
- a pointed clarifying question about what ${firstName} just said (e.g. "Ask ${firstName} where the fee shows up")
- acknowledge or empathize with ${firstName}'s concern
- tell ${firstName} you need a moment to research it
- give a materially different answer to ${firstName}'s actual question
Name the client "${firstName}" rather than a pronoun like "they". Keep the options distinct from our
draft and from one another. Plain text, no numbering, no quotes.
Return ONLY valid JSON: {"options": ["...", "..."]}`;
};

async function changeOptions(
  transcript: ChatMessage[], profile: ClientProfile, currentSuggestion: string,
): Promise<APIGatewayProxyResultV2> {
  try {
    const user = `Conversation so far:\n${formatTranscriptForBedrock(transcript)}\n\nThe (wrong) reply we drafted for the agent:\n"${currentSuggestion}"`;
    const raw = await invokeNovaMicro(
      user,
      CHANGE_OPTIONS_SYSTEM(profile),
      160,
      { fn: 'next-best-response', scope: 'change-options' },
      true,
    );
    const parsed = parseJsonFromBedrock<{ options?: string[] }>(raw);
    const options = (parsed.options ?? [])
      .filter((o): o is string => typeof o === 'string' && o.trim().length > 0)
      .map(o => o.trim().replace(/^[-"'\s]+|["'\s]+$/g, '').slice(0, 80))
      .filter(o => o.length > 0)
      .slice(0, 4);
    return jsonResponse(200, { options });
  } catch (e) {
    console.warn('NBR change-options failed', e);
    return jsonResponse(200, { options: [] });
  }
}

// ── "Change to" mode: author a fresh reply along the agent's chosen direction ─────────────
// Same data access (tools) + shape as the normal suggest path, plus the direction.
async function changeReply(
  transcript: ChatMessage[], profile: ClientProfile, direction: string, kbIndex: Map<string, Resource>,
): Promise<APIGatewayProxyResultV2> {
  try {
    const executor = createToolExecutor(profile.clientId, {});
    const system = SYSTEM_PROMPT(profile) + NBR_HALLUCINATION_RULE +
      `\n\nThe agent REJECTED the previous draft and chose this direction for the reply: "${direction}".
Write the reply along that direction — honor the agent's choice while staying accurate, compliant, and professional.`;
    const result = await invokeWithTools(
      system,
      [{ role: 'user', content: formatTranscriptForBedrock(transcript) }],
      NBR_CLIENT_TOOLS,
      executor,
      350,
      { fn: 'next-best-response', clientId: profile.clientId },
      true,
    );
    const parsed = parseJsonFromBedrock<{ suggestedText?: string; resourceIds?: string[] }>(result.text);
    const suggestedText = parsed.suggestedText ?? '';
    const resources = (parsed.resourceIds ?? [])
      .map(id => kbIndex.get(id))
      .filter((r): r is Resource => r !== undefined)
      .slice(0, 3);
    return jsonResponse(200, { suggestedText, resources });
  } catch (e) {
    console.warn('NBR change-reply failed', e);
    return jsonResponse(200, { suggestedText: '', resources: [] });
  }
}

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const {
      mode = 'suggest',
      transcript,
      clientProfile,
      currentSuggestion = '',
      direction = '',
    }: {
      mode?: string;
      transcript: ChatMessage[];
      clientProfile: ClientProfile;
      currentSuggestion?: string;
      direction?: string;
    } = JSON.parse(event.body ?? '{}');

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

    const kbIndex = new Map<string, Resource>(KNOWLEDGE_BASE.map(r => [r.id, r]));

    // "Change to" modes — fire strictly after the normal suggestion is already shown client-side.
    if (mode === 'change-options') return changeOptions(transcript, profile, currentSuggestion);
    if (mode === 'change-reply') return changeReply(transcript, profile, direction, kbIndex);

    let suggestedText = '';
    let suggestedScope: string | null = null;
    let resources: Resource[] = [];
    let toolsUsed: string[] = [];
    try {
      const executor = createToolExecutor(profile.clientId, {});
      const result = await invokeWithTools(
        SYSTEM_PROMPT(profile) + NBR_HALLUCINATION_RULE,
        [{ role: 'user', content: formatTranscriptForBedrock(transcript) }],
        NBR_CLIENT_TOOLS,
        executor,
        350,
        { fn: 'next-best-response', clientId: profile.clientId },
        true,
      );
      toolsUsed = result.toolsUsed;
      const parsed = parseJsonFromBedrock<{
        suggestedText: string;
        suggestedScope?: string | null;
        resourceIds?: string[];
      }>(result.text);
      suggestedText = parsed.suggestedText ?? '';
      suggestedScope = parsed.suggestedScope ?? null;
      resources = (parsed.resourceIds ?? [])
        .map(id => kbIndex.get(id))
        .filter((r): r is Resource => r !== undefined)
        .slice(0, 3);
    } catch (e) {
      console.warn('NBR LLM call failed', e);
      suggestedText = "I'd be happy to help with that. Could you give me a moment to look into it?";
      const conversationText = transcript
        .filter(m => m.role === 'CUSTOMER')
        .map(m => m.content)
        .join(' ');
      resources = matchResources(conversationText);
    }

    // Deterministic guardrail: financial-advice or trade requests must suggest a
    // callback with a licensed advisor, regardless of the LLM's judgment.
    const lastCustomerMsg = [...transcript].reverse().find(m => m.role === 'CUSTOMER')?.content ?? '';
    if (ADVICE_RE.test(lastCustomerMsg) || TRADE_RE.test(lastCustomerMsg)) {
      suggestedScope = 'callback';
    }

    return jsonResponse(200, { suggestedText, resources, suggestedScope, toolsUsed });
  } catch (err) {
    console.error('next-best-response error', err);
    return jsonResponse(500, { error: 'Failed to generate response' });
  }
};
