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

const SYSTEM_PROMPT = (profile: ClientProfile) => {
  const firstName = (profile.name || '').trim().split(/\s+/)[0] || 'the client';
  return `You are an AI assistant supporting a live chat agent at Bob's Mutual Funds.
The client is ${profile.name}. Their accounts: ${summarizeAccounts(profile.accounts)}.

Draft ONE concise, professional message the AGENT should send next to ${firstName} — usually 1-3
sentences; keep it brief, but being genuinely USEFUL matters more than being short. Write it AS THE
AGENT (a Bob's representative) speaking TO ${firstName}. NEVER write in the client's voice or answer
the agent's own question on the client's behalf (e.g. do NOT begin with "Yes, that's correct").
Do not include greetings or sign-offs.

HARD RULE — never send an empty placeholder whose only substance is an offer to help more, e.g.
"let me know if you have any questions", "feel free to ask", "is there anything else I can help
with?". These add nothing and are NOT acceptable as the suggestion. Every suggestion must carry
concrete substance.

If the most recent message is already from the AGENT (they are awaiting ${firstName}'s reply), OR
${firstName} has just been fully answered and the topic seems settled, do NOT stall — MOVE THE
CONVERSATION FORWARD: proactively surface the most useful RELATED point, add helpful context, raise
the natural next decision ${firstName} is likely facing, ask a genuinely useful clarifying question,
or suggest a concrete next step. For example, after fully explaining a topic, offer the natural next
step or a relevant related consideration — never merely ask whether they have more questions. Do not
pretend ${firstName} has answered.

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
};

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
// Purpose-built prompt (NOT the base suggest prompt): the base prompt's "1-2 sentences max" +
// "if the agent spoke last, just add a brief follow-up" rules overpower a tail-appended
// direction, producing bland filler ("feel free to ask") that ignores the chosen move. Here the
// DIRECTION is the whole task, stated first, with those two rules explicitly neutralized. Same
// data access (tools) + return shape as the normal suggest path.
const CHANGE_REPLY_SYSTEM = (profile: ClientProfile, direction: string, rejected: string) => {
  const firstName = (profile.name || '').trim().split(/\s+/)[0] || 'the client';
  return `You are an AI assistant supporting a live chat agent at Bob's Mutual Funds.
The client is ${profile.name}. Their accounts: ${summarizeAccounts(profile.accounts)}.

The agent reviewed the conversation and DECIDED on their next move. Write the message the agent
will send to ${firstName} that carries out THIS instruction, which is the entire point of the reply:

  → ${direction}

Fully deliver on that instruction — do NOT dilute it into a generic "let me know if you have any
questions" or "feel free to ask" closer. If it asks you to explain or clarify something, actually
give that explanation with real substance (2-4 sentences is fine — brevity is secondary to
genuinely doing what the instruction says). If it asks you to ask ${firstName} something, ask it
directly. If it asks you to acknowledge or empathize, do that specifically.

Write AS THE AGENT (a Bob's representative) speaking TO ${firstName}. Even if the most recent
message in the transcript is the AGENT's, still write the message that performs the instruction —
the agent has chosen to send this proactively. NEVER write in the client's voice or answer on
${firstName}'s behalf (do not begin with "Yes, that's correct"). No greetings or sign-offs.
${rejected ? `\nThe agent rejected this earlier draft, so do not simply repeat it: "${rejected}"\n` : ''}
Stay accurate and compliant: only state facts given in this prompt or returned by a tool; never
invent client-specific figures; do not give personalized investment advice or execute trades
(offer a licensed-advisor callback for those).

Also select the 0-3 most relevant knowledge base articles for this reply, ordered by relevance.
Only include genuinely on-topic articles — return an empty array if nothing fits.

Available articles:
${RESOURCE_LIST}

Return ONLY valid JSON: {"suggestedText": "...", "resourceIds": ["kb-xxx", ...]}`;
};

async function changeReply(
  transcript: ChatMessage[], profile: ClientProfile, direction: string, currentSuggestion: string,
  kbIndex: Map<string, Resource>,
): Promise<APIGatewayProxyResultV2> {
  try {
    const executor = createToolExecutor(profile.clientId, {});
    const system = CHANGE_REPLY_SYSTEM(profile, direction, currentSuggestion.trim()) + NBR_HALLUCINATION_RULE;
    const result = await invokeWithTools(
      system,
      [{ role: 'user', content: formatTranscriptForBedrock(transcript) }],
      NBR_CLIENT_TOOLS,
      executor,
      350,
      { fn: 'next-best-response', clientId: profile.clientId, scope: 'change-reply' },
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

// ── "Magic" mode: restyle the current reply WITHOUT changing its meaning ──────────────────
// Same substance, different presentation (per a canned or free-text style). No tools — it only
// rephrases the given text. Falls back to the original reply on any failure.
const MAGIC_REWRITE_SYSTEM =
  `You rewrite a chat reply's STYLE for a live support agent, WITHOUT changing its meaning.
Keep every fact, number, offer, question, and piece of information EXACTLY the same — do not add,
remove, soften, or change any substance. Only change how it is phrased/presented per the requested
style. Return ONLY the rewritten reply text: no quotes, no preamble, no explanation.`;

async function magicRewrite(currentSuggestion: string, style: string): Promise<APIGatewayProxyResultV2> {
  const original = currentSuggestion.trim();
  if (!original || !style.trim()) return jsonResponse(200, { suggestedText: original });
  try {
    const user = `Requested style: ${style}\n\nReply to rewrite (keep the meaning identical):\n"${original}"`;
    const raw = await invokeNovaMicro(
      user, MAGIC_REWRITE_SYSTEM, 400,
      { fn: 'next-best-response', scope: 'magic-rewrite' },
    );
    const text = raw.trim().replace(/^["'“”]+|["'“”]+$/g, '').trim();
    return jsonResponse(200, { suggestedText: text || original });
  } catch (e) {
    console.warn('NBR magic-rewrite failed', e);
    return jsonResponse(200, { suggestedText: original });
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
      style = '',
    }: {
      mode?: string;
      transcript: ChatMessage[];
      clientProfile: ClientProfile;
      currentSuggestion?: string;
      direction?: string;
      style?: string;
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
    if (mode === 'change-reply') return changeReply(transcript, profile, direction, currentSuggestion, kbIndex);
    if (mode === 'magic-rewrite') return magicRewrite(currentSuggestion, style);

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
