import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { jsonResponse } from '../shared/types';

interface ExecuteTaskRequest {
  taskId: string;
  clientId: string;
  fields: Record<string, string>;
}

function refNumber(): string {
  return 'REF-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const body = JSON.parse(event.body ?? '{}') as ExecuteTaskRequest;
    const { taskId, clientId, fields } = body;

    if (!taskId || !clientId) {
      return jsonResponse(400, { error: 'taskId and clientId are required' });
    }

    const table = process.env.CLIENTS_TABLE!;

    switch (taskId) {

      // ── Real executions: update DynamoDB via client-data fields ───────────

      case 'update-beneficiaries': {
        // Read existing beneficiaries, apply the change described in fields
        const existing = await docClient.send(new GetCommand({
          TableName: table,
          Key: { clientId },
          ProjectionExpression: 'beneficiaries',
        }));
        const current: Array<Record<string, unknown>> = existing.Item?.beneficiaries ?? [];

        const action = fields.action ?? 'Add';
        const newEntry = {
          id: 'ben-' + Math.random().toString(36).slice(2, 8),
          name: fields.beneficiaryName,
          relationship: fields.relationship,
          percentage: parseFloat(fields.percentage ?? '0'),
          type: fields.beneficiaryType ?? 'Primary',
          accountId: fields.accountId,
        };

        let updated: Array<Record<string, unknown>>;
        if (action === 'Remove') {
          updated = current.filter(b => b.name !== fields.beneficiaryName);
        } else if (action === 'Update') {
          updated = current.map(b =>
            b.name === fields.beneficiaryName ? { ...b, ...newEntry, id: b.id } : b,
          );
        } else {
          updated = [...current, newEntry];
        }

        await docClient.send(new UpdateCommand({
          TableName: table,
          Key: { clientId },
          UpdateExpression: 'SET beneficiaries = :v',
          ExpressionAttributeValues: { ':v': updated },
        }));

        return jsonResponse(200, {
          success: true,
          message: `Beneficiary ${action === 'Remove' ? 'removed' : action === 'Update' ? 'updated' : 'added'} successfully.`,
          referenceNumber: refNumber(),
        });
      }

      case 'setup-auto-invest': {
        const existing = await docClient.send(new GetCommand({
          TableName: table,
          Key: { clientId },
          ProjectionExpression: 'autoInvest',
        }));
        const current: Array<Record<string, unknown>> = existing.Item?.autoInvest ?? [];
        const newSchedule = {
          id: 'sched-' + Math.random().toString(36).slice(2, 8),
          accountId: fields.accountId,
          fund: fields.fund,
          amount: parseFloat(fields.amount ?? '0'),
          frequency: (fields.frequency ?? 'Monthly').toLowerCase(),
          dayOfMonth: parseInt(fields.dayOfMonth ?? '1', 10),
          status: 'active',
        };
        await docClient.send(new UpdateCommand({
          TableName: table,
          Key: { clientId },
          UpdateExpression: 'SET autoInvest = :v',
          ExpressionAttributeValues: { ':v': [...current, newSchedule] },
        }));
        return jsonResponse(200, {
          success: true,
          message: `Automatic investment set up: $${fields.amount} ${fields.frequency?.toLowerCase()} into ${fields.fund}.`,
          referenceNumber: refNumber(),
        });
      }

      case 'update-auto-invest': {
        const existing = await docClient.send(new GetCommand({
          TableName: table,
          Key: { clientId },
          ProjectionExpression: 'autoInvest',
        }));
        const current: Array<Record<string, unknown>> = existing.Item?.autoInvest ?? [];
        // Update the first matching schedule (best effort match by description)
        const updated = current.map((s, i) => {
          if (i === 0) {
            return {
              ...s,
              amount: fields.amount ? parseFloat(fields.amount) : s.amount,
              frequency: fields.frequency && fields.frequency !== 'Keep the same'
                ? fields.frequency.toLowerCase()
                : s.frequency,
              dayOfMonth: fields.dayOfMonth && fields.dayOfMonth !== 'Keep the same'
                ? parseInt(fields.dayOfMonth, 10)
                : s.dayOfMonth,
            };
          }
          return s;
        });
        await docClient.send(new UpdateCommand({
          TableName: table,
          Key: { clientId },
          UpdateExpression: 'SET autoInvest = :v',
          ExpressionAttributeValues: { ':v': updated },
        }));
        return jsonResponse(200, {
          success: true,
          message: 'Automatic investment schedule updated successfully.',
          referenceNumber: refNumber(),
        });
      }

      case 'pause-auto-invest': {
        const existing = await docClient.send(new GetCommand({
          TableName: table,
          Key: { clientId },
          ProjectionExpression: 'autoInvest',
        }));
        const current: Array<Record<string, unknown>> = existing.Item?.autoInvest ?? [];
        const action = (fields.action ?? 'Pause').toLowerCase();
        const newStatus = action === 'pause' ? 'paused' : 'active';
        // Apply to first schedule (best effort)
        const updated = current.map((s, i) => i === 0 ? { ...s, status: newStatus } : s);
        await docClient.send(new UpdateCommand({
          TableName: table,
          Key: { clientId },
          UpdateExpression: 'SET autoInvest = :v',
          ExpressionAttributeValues: { ':v': updated },
        }));
        return jsonResponse(200, {
          success: true,
          message: `Automatic investment schedule ${newStatus === 'paused' ? 'paused' : 'resumed'} successfully.`,
          referenceNumber: refNumber(),
        });
      }

      case 'update-rmd-settings': {
        const existing = await docClient.send(new GetCommand({
          TableName: table,
          Key: { clientId },
          ProjectionExpression: 'rmd',
        }));
        const current: Record<string, unknown> = existing.Item?.rmd ?? { eligible: true };
        const updated = {
          ...current,
          deliveryMethod: fields.deliveryMethod,
          frequency: (fields.frequency ?? 'Annual').toLowerCase().replace(' (december)', ''),
          taxWithholding: parseFloat(fields.taxWithholding ?? '10'),
        };
        await docClient.send(new UpdateCommand({
          TableName: table,
          Key: { clientId },
          UpdateExpression: 'SET rmd = :v',
          ExpressionAttributeValues: { ':v': updated },
        }));
        return jsonResponse(200, {
          success: true,
          message: 'RMD settings updated successfully.',
          referenceNumber: refNumber(),
        });
      }

      // ── Mock executions ───────────────────────────────────────────────────

      case 'update-contact-info':
        return jsonResponse(200, {
          success: true,
          message: `Contact information updated: ${fields.infoType} changed successfully.`,
          referenceNumber: refNumber(),
        });

      case 'add-account-access':
        return jsonResponse(200, {
          success: true,
          message: `Account access granted to ${fields.personName} (${fields.accessLevel}).`,
          referenceNumber: refNumber(),
        });

      case 'open-account':
        return jsonResponse(200, {
          success: true,
          message: `${fields.accountType} application submitted. You'll receive a confirmation email within 1 business day.`,
          referenceNumber: refNumber(),
        });

      case 'place-purchase':
        return jsonResponse(200, {
          success: true,
          message: `Purchase order placed: $${fields.amount} into ${fields.fund}. Order will execute at next available NAV.`,
          referenceNumber: refNumber(),
        });

      case 'place-sale':
        return jsonResponse(200, {
          success: true,
          message: `Sale order placed: ${fields.amount} of ${fields.fund}. Order will execute at next available NAV.`,
          referenceNumber: refNumber(),
        });

      case 'exchange-funds':
        return jsonResponse(200, {
          success: true,
          message: `Exchange initiated: ${fields.amount} from ${fields.fromFund} to ${fields.toFund}. Will execute at next NAV.`,
          referenceNumber: refNumber(),
        });

      case 'toggle-drip':
        return jsonResponse(200, {
          success: true,
          message: `Dividend reinvestment for ${fields.fund} has been ${fields.dripEnabled?.includes('ON') ? 'enabled' : 'disabled'}.`,
          referenceNumber: refNumber(),
        });

      case 'request-withdrawal':
        return jsonResponse(200, {
          success: true,
          message: `Distribution of $${fields.amount} requested. Funds will arrive via ${fields.deliveryMethod} within 3–5 business days.`,
          referenceNumber: refNumber(),
        });

      case 'setup-systematic-withdrawal':
        return jsonResponse(200, {
          success: true,
          message: `Recurring distribution set up: $${fields.amount} ${fields.frequency?.toLowerCase()}, starting ${fields.startDate}.`,
          referenceNumber: refNumber(),
        });

      case 'initiate-rollover':
        return jsonResponse(200, {
          success: true,
          message: `Rollover request initiated from ${fields.sourceInstitution}. Our team will contact you within 2 business days.`,
          referenceNumber: refNumber(),
        });

      case 'roth-conversion':
        return jsonResponse(200, {
          success: true,
          message: `Roth conversion of ${fields.amount} from ${fields.fromAccountId} submitted for tax year ${fields.taxYear}.`,
          referenceNumber: refNumber(),
        });

      case 'request-tax-document':
        return jsonResponse(200, {
          success: true,
          message: `${fields.formType} for ${fields.taxYear} will be mailed within 7–10 business days.`,
          referenceNumber: refNumber(),
        });

      case 'cancel-reschedule-callback':
        if (fields.action === 'Cancel') {
          return jsonResponse(200, {
            success: true,
            message: 'Callback cancelled successfully.',
            referenceNumber: refNumber(),
          });
        }
        return jsonResponse(200, {
          success: true,
          message: `Callback rescheduled to ${fields.newScheduledTime}.`,
          referenceNumber: refNumber(),
        });

      case 'update-security':
        return jsonResponse(200, {
          success: true,
          message: `Security update completed: ${fields.securityAction}.`,
          referenceNumber: refNumber(),
        });

      default:
        return jsonResponse(400, { error: `Unknown taskId: ${taskId}` });
    }
  } catch (err) {
    console.error('execute-task error', err);
    return jsonResponse(500, { error: 'Task execution failed' });
  }
};
