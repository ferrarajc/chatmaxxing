import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { invokeNovaMicro, parseJsonFromBedrock } from '../shared/bedrock-client';
import {
  ChatMessage,
  ClientProfile,
  formatTranscriptForBedrock,
  summarizeAccounts,
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

const GET_INTENT_PROMPT = (profile: ClientProfile, intent: string) =>
  `You are a professional financial services agent at Bob's Mutual Funds handling a live chat.
Client: ${profile.name}. Accounts: ${summarizeAccounts(profile.accounts)}.
Current intent label: "${intent}".

Your goal is GET INTENT: clarify and fully define the client's need so the agent has enough information to act.

Rules:
- Read the transcript. If the agent has NOT yet sent a greeting, generate a warm greeting introducing yourself.
- Otherwise, ask ONE focused clarifying question to better understand the client's need.
- Do NOT ask questions the agent doesn't need to fulfill the request.
- Do NOT ask multiple questions at once.
- Once you have a sufficiently granular understanding of the client's need, set shouldExitAutopilot=true.
- Set shouldExitAutopilot=true if the client asks to speak with a human or escalate.

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

Set shouldExitAutopilot=true if:
- The client is asking to speak to a human or escalate
- The request requires account modifications, trade execution, or financial advice
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
