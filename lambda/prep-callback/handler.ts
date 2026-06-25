import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { invokeWithTools, parseJsonFromBedrock } from '../shared/bedrock-client';
import { ALL_CLIENT_TOOLS, createToolExecutor } from '../shared/client-tools';
import { matchResources, summarizeAccounts, Account } from '../shared/types';

// Agentic call-prep research engine. Invoked async (fire-and-forget) the moment a callback
// is scheduled, so the work is done before the call goes out. It uses the SAME tools the live
// bot uses to fetch the client's real data, researches the client's ask as completely as the
// tools allow, and writes a grounded dossier — including an honest list of what it could not
// resolve and why — onto the callback record. Latency does not matter here, so it iterates
// deeper than real-time turns.

interface PrepEvent { callbackId: string }

interface ResearchOut {
  research: {
    summary: string;
    findings: { point: string; detail: string; source?: string }[];
    answeredFully: boolean;
    openItems: { question: string; why: string }[];
  };
  coaching: string[];
  script: { opening: string; talkingPoints: string[] };
}

const CALLBACKS_TABLE = () => process.env.CALLBACKS_TABLE!;
const CLIENTS_TABLE = () => process.env.CLIENTS_TABLE!;

function researchPrompt(clientName: string, accountsSummary: string, ask: string, kb: { title: string; url: string }[]): string {
  const kbList = kb.length ? kb.map(r => `- ${r.title} (${r.url})`).join('\n') : '(none matched)';
  return `You are a senior research analyst at Bob's Mutual Funds preparing a HUMAN phone agent for a scheduled callback. Use the gap before the call to do the homework so the agent walks in ready.

CLIENT: ${clientName}. Accounts: ${accountsSummary}.
THE CLIENT'S ASK (reason for the callback): "${ask}"

You have tools that return THIS CLIENT'S OWN real data (accounts, holdings, transactions, beneficiaries, auto-invest, RMD, recent chat history, contact info) and the FULL fund lineup. Call whatever tools you need and ground every fact in their output. Never state a figure or fact you did not get from a tool or that is not given above — if you cannot determine something, put it in openItems.

Rules:
- Stay STRICTLY on the client's ask. Do the most COMPLETE job the tools allow; a partial result is fine and expected.
- You are PREP, not the advisor. You may NOT make a personalized recommendation or a buy/sell/decision call — that is the licensed human agent's job. Do all the factual groundwork (pull the data, lay out the relevant numbers, options, and considerations, cite reference articles), then put any actual recommendation/decision, anything needing the client's input, or any account action into openItems for the human.
- Be specific and honest in openItems about what you could NOT resolve and exactly why (needs a decision, needs info from the client, requires an action you can't take, out of scope, or data unavailable).

Reference articles you may cite as sources:
${kbList}

Return ONLY valid JSON:
{
  "research": {
    "summary": "2-4 sentences: what you worked out for the agent on this ask, grounded in the data you pulled.",
    "findings": [{"point": "short headline", "detail": "the specific, fact-backed detail", "source": "which tool or article it came from, e.g. get_holdings"}],
    "answeredFully": true,
    "openItems": [{"question": "what still needs the agent or the client", "why": "the specific reason"}]
  },
  "coaching": ["at most 3 short, specific tips for handling THIS call"],
  "script": {
    "opening": "a warm, specific opening line the agent can say once identity is confirmed",
    "talkingPoints": ["ordered points to cover, each short"]
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
      1500,
      { fn: 'prep-callback', clientId, scope: 'callback-prep' },
      true,        // jsonMode
      undefined,   // model — default
      6,           // maxIterations — deeper research, latency doesn't matter
    );
    out = parseJsonFromBedrock<ResearchOut>(result.text);
  } catch (e) {
    console.error('prep-callback research failed', e);
  }

  const generatedAt = new Date().toISOString();
  const dossier = {
    topic: ask,
    research: out?.research ?? {
      summary: 'Automated pre-call research was unavailable — please review the client snapshot and the ask below.',
      findings: [],
      answeredFully: false,
      openItems: [{ question: 'The full ask — auto-research did not run.', why: 'The research service was temporarily unavailable.' }],
    },
    coaching: (out?.coaching ?? []).slice(0, 3),
    script: out?.script ?? { opening: `Hi ${clientName}, thanks for scheduling time with us.`, talkingPoints: [] },
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
