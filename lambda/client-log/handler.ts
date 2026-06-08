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

    // A successful customer-site access-code entry pages the site owner so they
    // can hop in as a live agent. Isolated below so a Pager Doodie failure never
    // turns this telemetry response into a 500.
    if (context === 'access-code-entered') {
      await sendSigninPage();
    }

    return jsonResponse(200, { ok: true });
  } catch (err) {
    console.error('client-log handler error', err);
    return jsonResponse(500, { error: 'log failed' });
  }
};

/**
 * Sends an "urgent" Pager Doodie push so the owner can jump in as a live agent
 * for a fresh demo visitor. Carries no visitor metadata — just the fact that it
 * happened. Swallows its own errors: paging must never break telemetry logging.
 */
async function sendSigninPage(): Promise<void> {
  const base = process.env.PAGERDOODIE_API_BASE;
  const key = process.env.PAGERDOODIE_API_KEY;
  if (!base || !key) {
    console.warn('Pager Doodie not configured — skipping signin page');
    return;
  }
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        level: 'urgent',
        title: "New Bob's demo visitor",
        body: 'Someone just entered the access code on the customer site.',
        source: 'bobs-customer-site',
      }),
    });
    if (!res.ok) {
      console.error('Pager Doodie notify failed', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.error('Pager Doodie notify error', err);
  }
}
