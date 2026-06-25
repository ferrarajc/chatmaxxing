import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { ScanCommand, GetCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { docClient } from '../shared/dynamo-client';
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
const DEMO_IDS = Object.keys(DEMO_ASKS);

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  try {
    const body = JSON.parse(event.body ?? '{}') as {
      action?: string; callbackId?: string; clientId?: string; minutesOut?: number;
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
            status: 'scheduled', dossierStatus: 'researching',
            createdAt: new Date().toISOString(), demo: true,
          },
        }));
        await triggerPrep(callbackId);
        return jsonResponse(200, { callbackId });
      }

      default:
        return jsonResponse(400, { error: `unknown action: ${action}` });
    }
  } catch (err) {
    console.error('agent-callbacks error', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }
};
