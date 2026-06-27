import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { invokeWithTools, invokeNovaMicro, parseJsonFromBedrock } from '../shared/bedrock-client';
import { ALL_CLIENT_TOOLS, createToolExecutor } from '../shared/client-tools';
import { matchResources, summarizeAccounts, Account } from '../shared/types';

// Agentic call-prep research engine. Invoked async (fire-and-forget) the moment a callback
// is scheduled, so the work is done before the call goes out. It uses the SAME tools the live
// bot uses to fetch the client's real data, researches the client's ask as completely as the
// tools allow, and writes a grounded dossier — including an honest list of what it could not
// resolve and why — onto the callback record. Latency does not matter here, so it iterates
// deeper than real-time turns.

interface PrepEvent { callbackId: string }

interface ScriptStepOut {
  kind: 'say' | 'ask';
  text: string;
  options?: { label: string; then: ScriptStepOut[] }[];
}

interface ResearchOut {
  intent: { headline: string; detail?: string[] };
  research: {
    summary: string;
    findings: { point: string; detail: string; source?: string }[];
    answeredFully: boolean;
    openItems: { question: string; why: string }[];
  };
  coaching: string[];
  guidedScript: { confirmAsk: string; steps: ScriptStepOut[]; points?: string[] };
}

const CALLBACKS_TABLE = () => process.env.CALLBACKS_TABLE!;
const CLIENTS_TABLE = () => process.env.CLIENTS_TABLE!;

// ---- Originating transcript -------------------------------------------------
// A short, believable record of the interaction that led to the callback, so the agent can flip
// back and see exactly what was said. Channel-aware: a chatbot session, a chat escalated to a live
// rep, or a phone-IVR call. Simulation-first like the rest of the cockpit (no real source store yet).

type OriginChannel = 'chatbot' | 'escalated' | 'ivr';
const ORIGIN_CHANNELS: OriginChannel[] = ['chatbot', 'escalated', 'ivr'];

interface TranscriptOut { title: string; messages: { speaker: string; text: string; highlights?: string[] }[] }

const CHANNEL_GUIDE: Record<OriginChannel, string> = {
  chatbot: `The client was chatting with "Bob", Bob's automated web assistant. Speakers: "bob" and "client". Bob greets, the client asks their question in their own words, Bob acknowledges briefly but explains a specialist can go through it properly, then OFFERS to schedule a phone callback. The client agrees and picks a time. End once the callback is booked.`,
  escalated: `The client started with "Bob" (the web assistant) but the question needed a human, so Bob handed off to a licensed representative. Speakers: "bob", "client", "system" (handoff notes like "Connected to Dana R., licensed representative"), and "agent". Bob greets, the client asks, Bob says this needs a licensed specialist and transfers, a "system" line notes the handoff, then the agent picks it up, talks briefly, and — needing research or a better time — OFFERS a scheduled phone callback. The client agrees and picks a time.`,
  ivr: `The client phoned Bob's main line and reached the automated phone system. Speakers: "ivr" (the automated voice) and "client" (their spoken responses). The IVR greets and offers options, the client says what they need, and because of call volume / after hours / needing a specialist, the IVR OFFERS a scheduled callback so they don't wait on hold. The client accepts and confirms a time.`,
};

function transcriptPrompt(channel: OriginChannel, clientName: string, ask: string): string {
  return `Write the ORIGINATING interaction that led ${clientName} to schedule a phone callback with Bob's Mutual Funds.

THE CLIENT'S ASK (what they wanted): "${ask}"
CHANNEL: ${CHANNEL_GUIDE[channel]}

Rules:
- 6 to 12 short, natural messages. Specific, real phrasing — the client speaks in the FIRST person ("my", "I").
- Do NOT resolve the question or quote specific account figures; the whole point is that a specialist calls back with the answer. Keep it to the ask plus the callback being offered and accepted.
- "title": a short label, e.g. "Web chat with Bob - earlier today" / "Call to Bob's 1-800 line" / "Web chat escalated to a representative".
- "highlights" (per message, optional): the 1-2 EXACT substrings in that message's text that a human agent must not miss — the words that carry the client's intent or a material parameter (an account, an amount, a date, a constraint). Copy them verbatim from the text. Omit on messages that carry no such span.

Return ONLY JSON: {"title":"...","messages":[{"speaker":"...","text":"...","highlights":["..."]}]}`;
}

async function generateOriginTranscript(channel: OriginChannel, clientName: string, ask: string, clientId: string) {
  try {
    const raw = await invokeNovaMicro(
      transcriptPrompt(channel, clientName, ask),
      'You write short, realistic customer-service transcripts as strict JSON.',
      900,
      { fn: 'prep-callback', clientId, scope: 'origin-transcript' },
      true,
    );
    const out = parseJsonFromBedrock<TranscriptOut>(raw);
    const messages = (out.messages ?? [])
      .filter(m => m && typeof m.text === 'string' && m.text.trim())
      .map(m => ({
        speaker: String(m.speaker || 'system'),
        text: m.text.trim(),
        ...(Array.isArray(m.highlights) && m.highlights.length
          ? { highlights: m.highlights.filter(h => typeof h === 'string' && h.trim()).map(h => h.trim()) }
          : {}),
      }));
    if (!messages.length) return undefined;
    return { channel, title: out.title?.trim() || 'How this callback started', messages };
  } catch (e) {
    console.error('origin-transcript generation failed', e);
    return undefined;
  }
}

function researchPrompt(clientName: string, accountsSummary: string, ask: string, kb: { title: string; url: string }[]): string {
  const kbList = kb.length ? kb.map(r => `- ${r.title} (${r.url})`).join('\n') : '(none matched)';
  return `You are a senior research analyst at Bob's Mutual Funds preparing a HUMAN phone agent for a scheduled callback. Use the gap before the call to do the homework so the agent walks in ready.

CLIENT: ${clientName}. Accounts: ${accountsSummary}.
THE CLIENT'S ASK (reason for the callback): "${ask}"

You have tools that return THIS CLIENT'S OWN real data (accounts, balance history, holdings, transactions, beneficiaries, auto-invest, RMD, recent chat history, contact info) and the FULL fund lineup. Call whatever tools you need and ground every fact in their output. Never state a figure or fact you did not get from a tool or that is not given above — if you cannot determine something, put it in openItems.

Rules:
- Stay STRICTLY on the client's ask. Do the most COMPLETE job the tools allow; a partial result is fine and expected.
- Be RESOURCEFUL: there may be no single field named after the metric the client wants, but the raw inputs to compute it usually exist. DERIVE it. To answer a return question (year-to-date, trailing 1-year, etc.), call get_balance_history for the month-end values (it gives the start-of-year and current balance per account) and get_transactions for this year's contributions/withdrawals, then COMPUTE it: e.g. YTD return ≈ (current value − start-of-year value − net contributions this year) ÷ start-of-year value, per account and for the whole portfolio. Show your method in one line and label the result as your computed estimate. Combine tools to answer the real question rather than declaring a metric "unavailable."
- Be precise about WHAT each number represents — use the exact label the tool gives it. A balance change shown as "% today" is the DAILY change, NOT a year-to-date or annual return; never pass one off as the other. Only when the underlying inputs genuinely don't exist should you put the metric in openItems, naming exactly what's missing.
- You are PREP, not the advisor. You may NOT make a personalized recommendation or a buy/sell/decision call — that is the licensed human agent's job. Do all the factual groundwork (pull the data, lay out the relevant numbers, options, and considerations, cite reference articles), then put any actual recommendation/decision, anything needing the client's input, or any account action into openItems for the human.
- Be specific and honest in openItems about what you could NOT resolve and exactly why (needs a decision, needs info from the client, requires an action you can't take, out of scope, or data unavailable).

Reference articles you may cite as sources:
${kbList}

THE GUIDED SCRIPT — this is what the human agent reads on the call. The UI already speaks a fixed opening: "This is <agent> at Bob's Mutual Funds, speaking on a recorded line — and I understand that you want <confirmAsk>. Is that correct?" You provide:
- "confirmAsk": the second-person clause that completes "…you want ___". Specific and natural, written TO the client in the SECOND person (you/your) — never he/she/they/their. E.g. ask "wants their 2026 RMD deadline" -> "to know the last day you can take your 2026 RMD without a penalty". No leading "to want"; usually starts with "to".
- "steps": what the agent does AFTER the client confirms. Each step is one of:
    { "kind": "say", "text": "<a first-person line the agent says to the client>" }
    { "kind": "ask", "text": "<a question the agent asks>", "options": [ { "label": "<the client's answer, short, fits a button>", "then": [ <steps for that answer> ] } ] }
  Choose the script's shape by how completely you resolved the ask:
  1. FULLY RESOLVED -> one or two "say" steps that deliver the exact answer using the real figures/dates from your findings, ending with a natural close like "Is there anything else I can help you with?". Example for an RMD-deadline ask: [{"kind":"say","text":"The last day you can take your 2026 RMD without a penalty is December 31, 2026. Is there anything else I can help you with?"}]
  2. NEEDS 1-2 DETERMINABLE FACTS FROM THE CLIENT (each possible answer is computable from the data you have) -> use an "ask" step whose options each carry the matching scripted answer, with the real per-branch figure, in "then". Keep it at most two questions deep. Example for "how much can I still contribute to my 2026 IRA": [{"kind":"ask","text":"Have you made any contributions this year to an IRA you hold outside of Bob's?","options":[{"label":"No, none outside Bob's","then":[{"kind":"say","text":"Got it. Then as of today you can still contribute $2,425.87 to your IRA this year. Would you like me to repeat that?"}]},{"label":"Yes, some elsewhere","then":[{"kind":"say","text":"Understood — I'll need that amount to give you an exact figure. Once you have it, your remaining room is $7,000 minus everything contributed across all your IRAs this year."}]}]}]
  3. OPEN-ENDED / JUDGMENT-BASED / NOT FULLY RESOLVED -> give the "say" lines you can, do NOT invent an answer, and list the remaining discussion points or questions in "points". Anything needing a decision, the client's input, or an action you can't take must ALSO be in research.openItems.
- NEVER put a figure or date in a script line that you did not get from a tool or from the data above. If a branch's answer isn't computable, make that branch a "say" describing what the agent will do / where it routes, and record the gap in openItems.

Return ONLY valid JSON:
{
  "intent": {
    "headline": "ONE self-contained sentence, AT MOST 18 words, whose FIRST word is the client's first name only (no surname). If the agent reads only this, it must be enough to start a meaningful conversation. Third person. E.g. \\"${clientName.split(' ')[0]} wants the last day she can take her 2026 RMD without a penalty.\\"",
    "detail": ["0-3 short extra germane facts about the ask that you actually gathered; OMIT this field or use [] if there is nothing more of substance"]
  },
  "research": {
    "summary": "2-4 sentences: what you worked out for the agent on this ask, grounded in the data you pulled.",
    "findings": [{"point": "short headline", "detail": "the specific, fact-backed detail", "source": "which tool or article it came from, e.g. get_holdings"}],
    "answeredFully": true,
    "openItems": [{"question": "what still needs the agent or the client", "why": "the specific reason"}]
  },
  "coaching": ["at most 3 short, specific tips for handling THIS call"],
  "guidedScript": {
    "confirmAsk": "the second-person clause completing '…you want ___'",
    "steps": [ /* say/ask steps as described above */ ],
    "points": ["only for open-ended asks: the main points or questions to cover; [] otherwise"]
  }
}`;
}

export const handler = async (event: PrepEvent): Promise<{ ok: boolean }> => {
  const { callbackId } = event;
  if (!callbackId) return { ok: false };

  const cbRes = await docClient.send(new GetCommand({ TableName: CALLBACKS_TABLE(), Key: { callbackId } }));
  const cb = cbRes.Item;
  if (!cb) { console.error('prep-callback: callback not found', callbackId); return { ok: false }; }

  const clientId = String(cb.clientId);
  const ask = String(cb.intentSummary || 'The client requested a callback.');

  const clRes = await docClient.send(new GetCommand({ TableName: CLIENTS_TABLE(), Key: { clientId } }));
  const client = (clRes.Item ?? {}) as Record<string, unknown>;
  const accounts = (client.accounts as Account[] | undefined) ?? [];
  const accountsSummary = accounts.length ? summarizeAccounts(accounts) : 'No accounts on file';
  const clientName = String(cb.clientName || client.name || 'the client');
  const resources = matchResources(ask).map(r => ({ id: r.id, title: r.title, url: r.url }));

  let out: ResearchOut | null = null;
  try {
    const executor = createToolExecutor(clientId, {});
    const result = await invokeWithTools(
      researchPrompt(clientName, accountsSummary, ask, resources),
      [{ role: 'user', content: `Research the client's ask thoroughly and prepare the agent. Ask: "${ask}"` }],
      ALL_CLIENT_TOOLS,
      executor,
      2200,        // headroom for the branching script tree on top of findings
      { fn: 'prep-callback', clientId, scope: 'callback-prep' },
      true,        // jsonMode
      undefined,   // model — default
      6,           // maxIterations — deeper research, latency doesn't matter
    );
    out = parseJsonFromBedrock<ResearchOut>(result.text);
  } catch (e) {
    console.error('prep-callback research failed', e);
  }

  const channel: OriginChannel = ORIGIN_CHANNELS.includes(cb.originChannel as OriginChannel)
    ? (cb.originChannel as OriginChannel)
    : 'chatbot';
  const originTranscript = await generateOriginTranscript(channel, clientName, ask, clientId);

  const firstName = clientName.split(' ')[0] || clientName;
  const generatedAt = new Date().toISOString();
  const dossier = {
    topic: ask,
    intent: out?.intent?.headline
      ? { headline: out.intent.headline, detail: (out.intent.detail ?? []).filter(Boolean) }
      : { headline: `${firstName} requested a callback: ${ask}`.split(/\s+/).slice(0, 18).join(' '), detail: [] },
    research: out?.research ?? {
      summary: 'Automated pre-call research was unavailable — please review the client snapshot and the ask below.',
      findings: [],
      answeredFully: false,
      openItems: [{ question: 'The full ask — auto-research did not run.', why: 'The research service was temporarily unavailable.' }],
    },
    coaching: (out?.coaching ?? []).slice(0, 3),
    guidedScript: out?.guidedScript?.confirmAsk
      ? { confirmAsk: out.guidedScript.confirmAsk, steps: out.guidedScript.steps ?? [], points: (out.guidedScript.points ?? []).filter(Boolean) }
      : { confirmAsk: `to talk through ${ask}`, steps: [], points: [] },
    originTranscript,
    resources,
    clientSnapshot: {
      name: clientName,
      totalBalance: Number(client.totalBalance ?? 0),
      accountsSummary,
      riskProfile: (client.investorProfile as { riskProfile?: string } | undefined)?.riskProfile,
      memberSince: (client.personal as { memberSince?: string } | undefined)?.memberSince,
    },
    generatedAt,
  };

  await docClient.send(new UpdateCommand({
    TableName: CALLBACKS_TABLE(),
    Key: { callbackId },
    UpdateExpression: 'SET dossier = :d, dossierStatus = :s, dossierGeneratedAt = :t',
    ExpressionAttributeValues: { ':d': dossier, ':s': 'ready', ':t': generatedAt },
  }));

  console.log(JSON.stringify({
    event: 'callback_prepped', callbackId, clientId,
    answeredFully: dossier.research.answeredFully,
    findings: dossier.research.findings.length,
    openItems: dossier.research.openItems.length,
  }));
  return { ok: true };
};
