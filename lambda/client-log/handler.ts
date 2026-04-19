import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { jsonResponse } from '../shared/types';

/**
 * Receives browser-side telemetry / error events and writes them to CloudWatch
 * via console.log so they can be queried with Log Insights.
 *
 * POST /client-log  { level, context, data, ts }
 */
export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const body = JSON.parse(event.body ?? '{}');
    const { level = 'INFO', context = 'unknown', data, ts } = body;

    // Structured log entry — queryable in CloudWatch Log Insights
    console.log(JSON.stringify({
      logType: 'CLIENT_TELEMETRY',
      level,
      context,
      ts: ts ?? new Date().toISOString(),
      data,
    }));

    return jsonResponse(200, { ok: true });
  } catch (err) {
    console.error('client-log handler error', err);
    return jsonResponse(500, { error: 'log failed' });
  }
};
