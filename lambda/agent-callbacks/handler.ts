import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { ScanCommand, GetCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { docClient } from '../shared/dynamo-client';
import { invokeNovaMicro } from '../shared/bedrock-client';
import { jsonResponse } from '../shared/types';
import { randomUUID } from 'crypto';

// Data API for the phone-agent cockpit. Reads upcoming scheduled callbacks (+ their AI
// dossiers), serves a single dossier, marks a call complete, and can seed a demo call.
// Scan-by-status is fine at demo volumes; a status-scheduledTime GSI is the scale path.

const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });
const CALLBACKS_TABLE = () => process.env.CALLBACKS_TABLE!;
const CLIENTS_TABLE = () => process.env.CLIENTS_TABLE!;

interface DossierRow {
  callbackId: string;
  clientId: string;
  clientName?: string;
  intentSummary?: string;
  scheduledTime?: string;
  phoneNumber?: string;
  dossierStatus?: string;
  dossier?: { research?: { answeredFully?: boolean } };
}

async function triggerPrep(callbackId: string): Promise<void> {
  const fn = process.env.PREP_CALLBACK_FN_ARN;
  if (!fn) return;
  try {
    await lambdaClient.send(new InvokeCommand({
      FunctionName: fn,
      InvocationType: 'Event',
      Payload: Buffer.from(JSON.stringify({ callbackId })),
    }));
  } catch (e) {
    console.error('triggerPrep failed', e);
  }
}

// Realistic demo asks (one per persona) so the board + dossiers are never empty.
const DEMO_ASKS: Record<string, string> = {
  'demo-client-001': "Wants to know their year-to-date return across all accounts and whether they're on track for retirement.",
  'demo-client-002': 'Has questions about her remaining RMD for the year and how the tax withholding works.',
  'demo-client-003': 'Asked which of his funds has the lowest expense ratio and whether he should consolidate positions.',
  'demo-client-004': 'Wants to review his SEP-IRA contributions so far this year and confirm his beneficiary designations.',
};
// Spread the demo personas across all three originating channels so the transcript flipper
// showcases each: a chatbot session, a chat escalated to a live rep, and a phone-IVR call.
const DEMO_CHANNELS: Record<string, string> = {
  'demo-client-001': 'chatbot',
  'demo-client-002': 'escalated',
  'demo-client-003': 'ivr',
  'demo-client-004': 'chatbot',
};
const DEMO_IDS = Object.keys(DEMO_ASKS);

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  try {
    const body = JSON.parse(event.body ?? '{}') as {
      action?: string; callbackId?: string; clientId?: string; minutesOut?: number;
      conversation?: { role: string; content: string }[];
    };
    const action = body.action ?? 'list';

    switch (action) {
      case 'list': {
        const res = await docClient.send(new ScanCommand({
          TableName: CALLBACKS_TABLE(),
          FilterExpression: '#s = :sched',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':sched': 'scheduled' },
        }));
        const items = ((res.Items as DossierRow[] | undefined) ?? [])
          .map(it => ({
            callbackId: it.callbackId,
            clientId: it.clientId,
            clientName: it.clientName ?? '',
            intentSummary: it.intentSummary ?? '',
            scheduledTime: it.scheduledTime ?? '',
            phoneNumber: it.phoneNumber ?? '',
            dossierStatus: it.dossierStatus ?? (it.dossier ? 'ready' : 'researching'),
            answeredFully: it.dossier?.research?.answeredFully ?? null,
          }))
          .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
        return jsonResponse(200, { callbacks: items });
      }

      case 'get': {
        if (!body.callbackId) return jsonResponse(400, { error: 'callbackId required' });
        const res = await docClient.send(new GetCommand({ TableName: CALLBACKS_TABLE(), Key: { callbackId: body.callbackId } }));
        const item = res.Item;
        if (!item) return jsonResponse(404, { error: 'not found' });
        // Lazy prep: if a dossier never got generated (e.g. older record), kick one off.
        if (!item.dossier && item.dossierStatus !== 'researching') {
          await docClient.send(new UpdateCommand({
            TableName: CALLBACKS_TABLE(), Key: { callbackId: body.callbackId },
            UpdateExpression: 'SET dossierStatus = :s', ExpressionAttributeValues: { ':s': 'researching' },
          }));
          await triggerPrep(body.callbackId);
          item.dossierStatus = 'researching';
        }
        return jsonResponse(200, { callback: item });
      }

      case 'complete': {
        if (!body.callbackId) return jsonResponse(400, { error: 'callbackId required' });
        await docClient.send(new UpdateCommand({
          TableName: CALLBACKS_TABLE(), Key: { callbackId: body.callbackId },
          UpdateExpression: 'SET #s = :done', ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':done': 'completed' },
        }));
        return jsonResponse(200, { ok: true });
      }

      case 'seed-demo': {
        // Cockpit-only demo callback: no EventBridge schedule, so the real execute-callback
        // pipeline never touches it — it stays 'scheduled' for the simulated demo.
        const clientId = body.clientId ?? DEMO_IDS[Math.floor(Math.random() * DEMO_IDS.length)];
        const ask = DEMO_ASKS[clientId] ?? 'Has a question about their account.';
        const minutesOut = body.minutesOut ?? 5;
        const cl = await docClient.send(new GetCommand({
          TableName: CLIENTS_TABLE(), Key: { clientId },
          ProjectionExpression: '#n, displayPhone', ExpressionAttributeNames: { '#n': 'name' },
        }));
        const clItem = (cl.Item ?? {}) as Record<string, unknown>;
        const callbackId = randomUUID();
        await docClient.send(new PutCommand({
          TableName: CALLBACKS_TABLE(),
          Item: {
            callbackId, clientId,
            clientName: (clItem.name as string) ?? 'Client',
            phoneNumber: ((clItem.displayPhone as string) ?? '').replace(/\D/g, '') || '4842384838',
            scheduledTime: new Date(Date.now() + minutesOut * 60 * 1000).toISOString(),
            intentSummary: ask,
            originChannel: DEMO_CHANNELS[clientId] ?? 'chatbot',
            status: 'scheduled', dossierStatus: 'researching',
            createdAt: new Date().toISOString(), demo: true,
          },
        }));
        await triggerPrep(callbackId);
        return jsonResponse(200, { callbackId });
      }

      case 'suggest': {
        // The teleprompter's "generate the next line" button: given the prep + the conversation so
        // far, write the single next thing the agent should say. Best-effort (returns '' on failure).
        if (!body.callbackId) return jsonResponse(400, { error: 'callbackId required' });
        const res = await docClient.send(new GetCommand({ TableName: CALLBACKS_TABLE(), Key: { callbackId: body.callbackId } }));
        const cb = res.Item;
        if (!cb) return jsonResponse(404, { error: 'not found' });
        const dossier = (cb.dossier ?? {}) as { research?: { summary?: string; findings?: { point: string; detail: string }[] } };
        const clientName = String(cb.clientName ?? 'the client');
        let pronouns = 'they/them';
        try {
          const cl = await docClient.send(new GetCommand({ TableName: CLIENTS_TABLE(), Key: { clientId: String(cb.clientId) }, ProjectionExpression: 'pronouns' }));
          pronouns = String((cl.Item as { pronouns?: string } | undefined)?.pronouns ?? 'they/them');
        } catch { /* default pronouns */ }
        const findings = (dossier.research?.findings ?? []).map(f => `- ${f.point}: ${f.detail}`).join('\n');
        const convo = (body.conversation ?? []).slice(-14).map(m => `${m.role}: ${m.content}`).join('\n');
        const system = `You are coaching a live phone agent at Bob's Mutual Funds. Write the SINGLE next thing the agent should SAY to the client right now — one short, natural spoken line in the agent's first-person voice, addressed to the client in the second person. Use the client's pronouns (${pronouns}) for any third-person reference; never infer gender from the name. Ground it in what was prepared and do not repeat what was already said. If the ask seems resolved, suggest a brief, warm closing line. Return ONLY the line — no quotation marks, no preamble.`;
        const user = `CLIENT: ${clientName}\nTHE CLIENT'S ASK: ${cb.intentSummary ?? ''}\nWHAT WE WORKED OUT: ${dossier.research?.summary ?? ''}\n${findings}\n\nCONVERSATION SO FAR:\n${convo || '(the call just connected)'}\n\nThe next thing the agent should say:`;
        try {
          const raw = await invokeNovaMicro(user, system, 140, { fn: 'agent-callbacks', scope: 'suggest-next' });
          const text = raw.trim().replace(/^["'“”]+|["'“”]+$/g, '').trim();
          return jsonResponse(200, { text });
        } catch (e) {
          console.error('suggest failed', e);
          return jsonResponse(200, { text: '' });
        }
      }

      default:
        return jsonResponse(400, { error: `unknown action: ${action}` });
    }
  } catch (err) {
    console.error('agent-callbacks error', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }
};
