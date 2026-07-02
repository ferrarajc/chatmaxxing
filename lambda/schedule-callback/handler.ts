import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  SchedulerClient,
  CreateScheduleCommand,
  FlexibleTimeWindowMode,
  ActionAfterCompletion,
} from '@aws-sdk/client-scheduler';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { docClient } from '../shared/dynamo-client';
import { jsonResponse } from '../shared/types';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { isWeekend, getHours, getMinutes } from 'date-fns';
import { randomUUID } from 'crypto';

const schedulerClient = new SchedulerClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
});
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION ?? 'us-east-1' });

const ET_ZONE = 'America/New_York';
const BUSINESS_START_HOUR = 8;    // 8:00 AM ET
const BUSINESS_END_HOUR = 19;     // 7:30 PM ET cutoff hour
const BUSINESS_END_MINUTE = 30;   // 7:30 PM ET

function validateBusinessHours(utcDate: Date): void {
  const etDate = toZonedTime(utcDate, ET_ZONE);
  if (isWeekend(etDate)) {
    throw new Error('Callbacks are only available Monday through Friday');
  }
  const hour = getHours(etDate);
  const minute = getMinutes(etDate);
  const afterClose = hour > BUSINESS_END_HOUR || (hour === BUSINESS_END_HOUR && minute >= BUSINESS_END_MINUTE);
  if (hour < BUSINESS_START_HOUR || afterClose) {
    throw new Error('Callbacks are only available 8:00 AM to 7:30 PM Eastern, Monday through Friday');
  }
}

function formatDisplayTime(utcDate: Date): string {
  // Convert the true UTC instant to ET exactly once. (Do NOT also pass the date
  // through toZonedTime first — that double-shifts and reports the wrong hour.)
  return utcDate.toLocaleString('en-US', {
    timeZone: ET_ZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const {
      clientId,
      clientName,
      phoneNumber,
      scheduledTime,
      scheduledTimeET,
      intentSummary,
      originTranscriptId,
      originMessages,
    }: {
      clientId: string;
      clientName?: string;
      phoneNumber: string;
      scheduledTime: string | 'ASAP';
      // An Eastern-Time wall-clock ('YYYY-MM-DDTHH:mm') the server resolves to the true UTC
      // instant (DST-safe). Preferred over `scheduledTime` for time-slot pickers so the client
      // never has to do timezone math. Ignored when scheduledTime === 'ASAP'.
      scheduledTimeET?: string;
      intentSummary?: string;
      // Link back to the originating conversation so the cockpit shows the REAL transcript,
      // not a fabricated one. originMessages is the conversation captured at scheduling time
      // (present go-forward); originTranscriptId lets prep-callback fetch a saved transcript.
      originTranscriptId?: string;
      originMessages?: { role: string; content: string }[];
    } = JSON.parse(event.body ?? '{}');

    if (!clientId || !phoneNumber) {
      return jsonResponse(400, { error: 'clientId and phoneNumber are required' });
    }

    // Determine fire time
    let fireTime: Date;
    if (scheduledTime === 'ASAP') {
      fireTime = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes from now
    } else if (scheduledTimeET) {
      // Interpret the wall-clock as Eastern Time and resolve to the true UTC instant (DST-safe).
      fireTime = fromZonedTime(scheduledTimeET, ET_ZONE);
      if (isNaN(fireTime.getTime())) {
        return jsonResponse(400, { error: 'Invalid scheduledTimeET format' });
      }
      validateBusinessHours(fireTime);
    } else {
      fireTime = new Date(scheduledTime);
      if (isNaN(fireTime.getTime())) {
        return jsonResponse(400, { error: 'Invalid scheduledTime format' });
      }
      validateBusinessHours(fireTime);
    }

    const callbackId = randomUUID();

    // Persist to DynamoDB
    await docClient.send(
      new PutCommand({
        TableName: process.env.CALLBACKS_TABLE!,
        Item: {
          callbackId,
          clientId,
          clientName: clientName ?? '',
          phoneNumber,
          scheduledTime: fireTime.toISOString(),
          intentSummary: intentSummary ?? '',
          status: 'scheduled',
          dossierStatus: 'researching',
          createdAt: new Date().toISOString(),
          ...(originTranscriptId ? { originTranscriptId } : {}),
          ...(Array.isArray(originMessages) && originMessages.length
            ? { originMessages: originMessages.map(m => ({ role: String(m.role), content: String(m.content) })) }
            : {}),
        },
      }),
    );

    // EventBridge Scheduler expression format: at(yyyy-MM-ddTHH:mm:ss)
    const scheduleExpr = `at(${fireTime.toISOString().slice(0, 19)})`;

    await schedulerClient.send(
      new CreateScheduleCommand({
        Name: `bobs-callback-${callbackId}`,
        ScheduleExpression: scheduleExpr,
        ScheduleExpressionTimezone: 'UTC',
        FlexibleTimeWindow: { Mode: FlexibleTimeWindowMode.OFF },
        Target: {
          Arn: process.env.EXECUTE_CALLBACK_FN_ARN!,
          RoleArn: process.env.SCHEDULER_ROLE_ARN!,
          Input: JSON.stringify({ callbackId }),
        },
        ActionAfterCompletion: ActionAfterCompletion.DELETE,
      }),
    );

    // Kick off AI call-prep research now (fire-and-forget, 'Event' invocation) so the dossier
    // is ready well before the call. The chat's confirmation latency is unaffected.
    const prepFn = process.env.PREP_CALLBACK_FN_ARN;
    if (prepFn) {
      try {
        await lambdaClient.send(new InvokeCommand({
          FunctionName: prepFn,
          InvocationType: 'Event',
          Payload: Buffer.from(JSON.stringify({ callbackId })),
        }));
      } catch (e) {
        console.error('prep-callback invoke failed', e);
      }
    }

    return jsonResponse(200, {
      callbackId,
      scheduledTime: fireTime.toISOString(),
      displayTime: formatDisplayTime(fireTime),
      message: `We'll call you at ${phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')} ${scheduledTime === 'ASAP' ? 'in about 2 minutes' : `around ${formatDisplayTime(fireTime)}`}.`,
    });
  } catch (err) {
    console.error('schedule-callback error', err);
    if (err instanceof Error && err.message.includes('Callbacks are only available')) {
      return jsonResponse(400, { error: err.message });
    }
    return jsonResponse(500, { error: 'Failed to schedule callback' });
  }
};
