import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { invokeWithTools, parseJsonFromBedrock } from '../shared/bedrock-client';
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

    const kbIndex = new Map<string, Resource>(KNOWLEDGE_BASE.map(r => [r.id, r]));

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

    return jsonResponse(200, { suggestedText, resources, suggestedScope, toolsUsed });
  } catch (err) {
    console.error('next-best-response error', err);
    return jsonResponse(500, { error: 'Failed to generate response' });
  }
};
