import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { invokeNovaMicro, parseJsonFromBedrock } from '../shared/bedrock-client';
import {
  ChatMessage,
  ClientProfile,
  formatTranscriptForBedrock,
  summarizeAccounts,
  summarizeIntents,
  jsonResponse,
} from '../shared/types';
import { toZonedTime } from 'date-fns-tz';

type AutopilotScope = 'get-intent' | 'researching' | 'callback' | 'idle-check' | 'full-auto';

const ET_ZONE = 'America/New_York';

function nowET(): string {
  const et = toZonedTime(new Date(), ET_ZONE);
  return et.toLocaleString('en-US', {
    timeZone: ET_ZONE,
    weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return raw;
}

// ── Scope-specific system prompts ──────────────────────────────────────────

const FORBIDDEN_TOPICS = `
FORBIDDEN TOPICS — respond with the scripted text below and set shouldExitAutopilot=true:

1. Financial advice / investment recommendations (e.g. "what should I invest in", "which fund is best", "should I put money in X"):
   response: "I'm not able to provide personalized investment advice via chat. I'd be happy to schedule a call with one of our financial advisors who can walk you through your options. Would you like me to arrange a callback?"
   suggestedScope: "callback"

2. Trade execution (e.g. "buy", "sell", "place an order", "redeem", "liquidate"):
   response: "Trades can't be processed through chat. You can place orders directly at bobrsmutualfunds.com/trade, or I can schedule a callback with a licensed broker. Which would you prefer?"
   suggestedScope: "callback"

3. Fraud / identity theft / unauthorized account activity:
   response: "This sounds serious and I want to make sure we handle it with the urgency it deserves. I'm connecting you with a security specialist right away — they can place a hold on your account and investigate. Please hold."
   shouldExitAutopilot: true

4. Inheriting an account / deceased account holder:
   response: "I'm so sorry for your loss. Our inheritance team can guide you through the process. You can find helpful information at bobrsmutualfunds.com/inheritance, or I can schedule a callback with a specialist. Would you like me to set that up?"
   suggestedScope: "callback"

For any of the above: set shouldExitAutopilot=true. Use the scripted response verbatim (you may adjust minor phrasing to fit context). Do NOT attempt to answer these topics yourself.`;

const GET_INTENT_PROMPT = (profile: ClientProfile, intent: string) =>
  `You are a live human financial services agent at Bob's Mutual Funds. You have already been connected to the client via chat — this is an ongoing live conversation.
Client: ${profile.name}. Accounts: ${summarizeAccounts(profile.accounts)}.
Current intent label: "${intent}".${summarizeIntents(profile.intents)}

CRITICAL CONTEXT: You are the agent the client is already speaking with. Do NOT offer to "connect them to a live agent" or "transfer" them — you ARE the live agent. Do NOT say you will arrange anything externally. You are here, ready to help.

Your goal is GET INTENT: ask focused questions to fully understand what the client needs today.
${FORBIDDEN_TOPICS}

Rules:
- Read the full transcript carefully. If you (the agent) have NOT yet sent any message, send a warm greeting introducing yourself by first name, briefly acknowledge what you can see about their inquiry, and immediately ask your FIRST detail question. Do NOT ask "is that right?" or similar topic confirmations — the client already confirmed their intent by escalating to a live agent. Jump straight to collecting the specific details you need.
- Otherwise, ask ONE focused clarifying question to fill the most important remaining blank.
- Do NOT ask multiple questions at once.
- Before deciding to exit, reason through: write out every piece of information you would need in order to take immediate action on this request with zero follow-up questions. Then check whether each of those pieces has been answered with a SPECIFIC answer (not just a topic confirmation). A client saying "yes", "correct", "you got it", or similar without giving a specific detail does NOT fill any blank — only concrete answers to specific questions count. If any blanks remain, ask ONE focused question to fill the most important gap. Only set shouldExitAutopilot=true once every piece is accounted for with a specific answer.
- NEVER set shouldExitAutopilot=true on the same turn you are sending your opening greeting. You must wait for the client to reply to at least one of your detail questions first.
- Set shouldExitAutopilot=true if the client asks to speak with a different person or escalate to a supervisor.
- CRITICAL EXIT RULE: When setting shouldExitAutopilot=true, send ONLY a brief acknowledgment that you (the agent) are personally about to take action — never imply someone else is coming. Examples: "Got it — let me look into that for you right now." / "Perfect, I have everything I need. Give me just a moment." / "Understood, I'll take care of that." For forbidden topics, use the scripted response verbatim. Do NOT answer the question or provide information in the same turn you exit. The acknowledgment is the entire response.

Return ONLY valid JSON: {"response": "...", "shouldExitAutopilot": false, "suggestedScope": null}`;

const RESEARCHING_PROMPT = (profile: ClientProfile) =>
  `You are a professional financial services agent at Bob's Mutual Funds handling a live chat.
Client: ${profile.name}.

Your goal is RESEARCHING: you are working on something and the client is waiting.
If the client sends a message, respond warmly and let them know you're still working on it.
If the client asks to escalate or seems frustrated, set shouldExitAutopilot=true.

Return ONLY valid JSON: {"response": "...", "shouldExitAutopilot": false, "suggestedScope": null}`;

const CALLBACK_PROMPT = (profile: ClientProfile, nowETStr: string) =>
  `You are a professional financial services agent at Bob's Mutual Funds handling a live chat.
Client: ${profile.name} (ID: ${profile.clientId}).
Client phone on file: ${profile.phone ? formatPhone(profile.phone) : 'not on file'}.
Current time in ET: ${nowETStr}.

Your goal is CALLBACK: schedule a phone callback for this client.

Read the transcript carefully to determine what has already been established:
A) Has the callback need been acknowledged/offered?
B) Has the phone number been confirmed? (client said yes to the number on file, or provided a different number)
C) Has the callback time been confirmed? (client specified a time and you haven't yet returned scheduleCallback)
D) Has scheduleCallback already been returned? (look for a [CALLBACK_SCHEDULED] system message in the transcript)

Based on what's been collected, respond appropriately — one step at a time:

1. If A is not done: Acknowledge the callback need (say you're happy to set one up, or that this topic requires a call).
2. If A done, B not done: Ask about the phone: "The number I have on file for you is [formatted phone]. Is that the best number to reach you for a callback?"
   - If the client confirms yes → B is done.
   - If the client says no or provides a different number → use the number they provide.
3. If A and B done, C not done: Ask about time.
   - If current ET time is before 7:00 PM: "Agents are available until 7:30 PM Eastern time. What time would work for you?"
   - If current ET time is 7:00 PM or later: "Our agents are wrapping up for today. I can schedule this for tomorrow or another weekday — what day and time works best?"
   - Client responses like "3 PM", "3:30", "tomorrow at 2" → parse to ISO8601 UTC. Today's date in context of "${nowETStr}".
4. If A, B, C are done and D is not done: Return scheduleCallback JSON with the extracted phone and time.
   RULES FOR THIS STEP: set shouldExitAutopilot=false, closeChat=false, scheduleCallback=<filled in>.
   Your response should confirm the scheduled time to the client (e.g. "Great — I've scheduled your callback for [time]. You'll receive a call at [number].").
   IMPORTANT: Always display phone numbers in (XXX) XXX-XXXX format in your response text. The phoneNumber field in scheduleCallback should still be 10 digits only.
   Do NOT ask "Is there anything else?" in this same turn. Stop here and wait.
5. If D is done AND you have already asked "Is there anything else?":
   - If the client says no, thanks, or goodbye → send a warm closing message, set shouldExitAutopilot=true and closeChat=true.
   - If the client says yes or raises a new topic → set shouldExitAutopilot=true, closeChat=false, response="".
6. If D is done AND you have NOT yet asked "Is there anything else?" → ask it now.
   RULES FOR THIS STEP: set shouldExitAutopilot=false, closeChat=false, scheduleCallback=null.
   Do NOT close the chat here — wait for the client's reply.

Return ONLY valid JSON:
{
  "response": "...",
  "shouldExitAutopilot": false,
  "closeChat": false,
  "suggestedScope": null,
  "scheduleCallback": {
    "clientId": "${profile.clientId}",
    "clientName": "${profile.name}",
    "phoneNumber": "10 digits only e.g. 6102345678",
    "scheduledTimeISO": "ISO8601 UTC datetime e.g. 2026-04-25T19:00:00.000Z",
    "intentSummary": "one sentence describing why the client needs a callback"
  } | null
}
scheduleCallback must be null unless you have a confirmed phone AND time and D is not yet done.
closeChat must be true ONLY when the conversation is fully complete and should be ended.`;

const IDLE_CHECK_PROMPT = (profile: ClientProfile) =>
  `You are a professional financial services agent at Bob's Mutual Funds handling a live chat.
Client: ${profile.name}.

Your goal is IDLE CHECK: the client appears to have gone quiet. Respond warmly to their message.
If they've come back and are responsive, set shouldExitAutopilot=true so normal handling resumes.

Return ONLY valid JSON: {"response": "...", "shouldExitAutopilot": true, "suggestedScope": null}`;

const FULL_AUTO_PROMPT = (profile: ClientProfile, intent: string) =>
  `You are a friendly, professional financial services agent at Bob's Mutual Funds handling a live chat.
Client: ${profile.name}. Accounts: ${summarizeAccounts(profile.accounts)}.
Current topic: "${intent}".

Your goal is FULL AUTO: handle this conversation end-to-end. Respond concisely (1-3 sentences), warmly, professionally.
${FORBIDDEN_TOPICS}

Set shouldExitAutopilot=true if:
- The client is asking to speak to a human or escalate
- The request requires account modifications, trade execution, or financial advice (see FORBIDDEN TOPICS above)
- You are not confident in the answer (confidence < 0.7)
- The client seems frustrated

Set shouldExitAutopilot=false and continue if you can handle the request within scope.

Suggest a scope if the situation calls for it (e.g. "callback" if a trade is requested, "idle-check" if client seems to have gone quiet).

Return ONLY valid JSON: {"response": "...", "shouldExitAutopilot": false, "suggestedScope": "callback" | "idle-check" | null}`;

// ── Escalation hard-override ───────────────────────────────────────────────
const ESCALATION_RE = /\b(speak to|talk to|connect me|transfer me|live agent|real person|human agent|representative|escalate|supervisor|speak with|talk with)\b/i;
const TRADE_RE = /\b(buy|sell|purchase|trade|place.?order|liquidat|redeem)\b/i;

// ── Handler ────────────────────────────────────────────────────────────────

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const {
      transcript,
      clientProfile,
      scope = 'full-auto',
      currentIntent,
    }: {
      transcript: ChatMessage[];
      clientProfile: ClientProfile;
      scope?: AutopilotScope;
      currentIntent?: string;
    } = JSON.parse(event.body ?? '{}');

    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
      return jsonResponse(400, { error: 'transcript is required and must be a non-empty array' });
    }

    const profile: ClientProfile = clientProfile ?? {
      clientId: 'demo-client-001',
      name: 'Alex Johnson',
      phone: '4842384838',
      accounts: [{ type: 'Roth IRA', balance: 45230, id: 'acc-001' }],
      totalBalance: 45230,
      recentChatHistory: [],
    };

    const lastCustomerMsg = [...transcript].reverse().find(m => m.role === 'CUSTOMER')?.content ?? '';

    // Pick scope-specific prompt
    let systemPrompt: string;
    switch (scope) {
      case 'get-intent':
        systemPrompt = GET_INTENT_PROMPT(profile, currentIntent ?? 'general inquiry');
        break;
      case 'researching':
        systemPrompt = RESEARCHING_PROMPT(profile);
        break;
      case 'callback':
        systemPrompt = CALLBACK_PROMPT(profile, nowET());
        break;
      case 'idle-check':
        systemPrompt = IDLE_CHECK_PROMPT(profile);
        break;
      default:
        systemPrompt = FULL_AUTO_PROMPT(profile, currentIntent ?? 'general inquiry');
    }

    let response = '';
    let shouldExitAutopilot = false;
    let suggestedScope: string | null = null;
    let closeChat = false;
    let scheduleCallback: Record<string, string> | null = null;

    try {
      const raw = await invokeNovaMicro(
        formatTranscriptForBedrock(transcript),
        systemPrompt,
        400,
        { fn: 'autopilot-turn', contactId: transcript[0]?.content?.slice(0, 8), scope },
      );
      const parsed = parseJsonFromBedrock<{
        response: string;
        shouldExitAutopilot: boolean;
        suggestedScope?: string | null;
        closeChat?: boolean;
        scheduleCallback?: Record<string, string> | null;
      }>(raw);

      response = parsed.response ?? '';
      shouldExitAutopilot = parsed.shouldExitAutopilot ?? false;
      suggestedScope = parsed.suggestedScope ?? null;
      closeChat = parsed.closeChat ?? false;
      scheduleCallback = parsed.scheduleCallback ?? null;
    } catch (e) {
      console.warn('Autopilot LLM call failed', e);
      shouldExitAutopilot = true;
      response = "I'd be happy to help with that — let me look into it for you.";
    }

    // Business-rule hard overrides
    if (ESCALATION_RE.test(lastCustomerMsg)) {
      shouldExitAutopilot = true;
    }
    if (scope !== 'callback' && TRADE_RE.test(lastCustomerMsg)) {
      shouldExitAutopilot = true;
      suggestedScope = 'callback';
    }

    console.log(JSON.stringify({
      event: 'autopilot_decision',
      fn: 'autopilot-turn',
      scope,
      contactId: transcript[0]?.content?.slice(0, 8),
      agentTurnCount: transcript.filter(m => m.role === 'AGENT').length,
      shouldExitAutopilot,
      suggestedScope,
      responseChars: response.length,
    }));

    return jsonResponse(200, {
      response,
      shouldExitAutopilot,
      suggestedScope,
      closeChat,
      scheduleCallback,
    });
  } catch (err) {
    console.error('autopilot-turn error', err);
    return jsonResponse(500, { error: 'Autopilot turn failed', shouldExitAutopilot: true });
  }
};
