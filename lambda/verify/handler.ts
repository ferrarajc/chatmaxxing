import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { GetCommand, PutCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { PinpointSMSVoiceV2Client, SendTextMessageCommand } from '@aws-sdk/client-pinpoint-sms-voice-v2';
import { createHash, randomInt } from 'crypto';
import { docClient } from '../shared/dynamo-client';
import { jsonResponse } from '../shared/types';

// Real email + SMS verification for the My Account hub.
//  - send-*-code: generate a 6-digit code, store only its hash with a 10-min TTL,
//    and deliver it (Amazon SES for email, AWS End User Messaging SMS for text).
//  - confirm-*-code: compare the hash and, on success, flip the verified flag on
//    the client record (emailVerified, or the matching phones[].verified).
// Codes are never echoed back. Delivery degrades gracefully when the sender
// identity isn't configured yet (returns a clear error, never throws).

type Action = 'send-email-code' | 'confirm-email-code' | 'send-sms-code' | 'confirm-sms-code';

const VERIFICATION_TABLE = (): string => process.env.VERIFICATION_TABLE ?? 'bobs-verification-codes';
const CLIENTS_TABLE = (): string => process.env.CLIENTS_TABLE!;
const CODE_TTL_SECONDS = 600;          // 10 minutes
const RESEND_COOLDOWN_SECONDS = 30;
const MAX_ATTEMPTS = 5;

const sesClient = new SESv2Client({});
const smsClient = new PinpointSMSVoiceV2Client({});

const nowSec = () => Math.floor(Date.now() / 1000);
const hashCode = (code: string, clientId: string) =>
  createHash('sha256').update(`${code}:${clientId}`).digest('hex');

const normalizeEmail = (t: string) => t.trim().toLowerCase();
const phoneDigits = (t: string) => t.replace(/\D/g, '').slice(-10);

interface CodeRow {
  codeId: string;
  codeHash: string;
  expiresAt: number;
  createdAt: number;
  attempts: number;
  channel: 'email' | 'sms';
  target: string;
}

async function sendEmail(to: string, code: string): Promise<void> {
  const sender = process.env.SES_SENDER;
  if (!sender) throw new ConfigError('Email verification is not configured yet.');
  await sesClient.send(new SendEmailCommand({
    FromEmailAddress: sender,
    Destination: { ToAddresses: [to] },
    Content: {
      Simple: {
        Subject: { Data: "Your Bob's Mutual Funds verification code" },
        Body: {
          Text: { Data: `Your Bob's Mutual Funds verification code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.` },
          Html: { Data: `<p>Your Bob's Mutual Funds verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>` },
        },
      },
    },
  }));
}

async function sendSms(digits: string, code: string): Promise<void> {
  const origination = process.env.SMS_ORIGINATION;
  if (!origination) throw new ConfigError('Text verification is not configured yet.');
  await smsClient.send(new SendTextMessageCommand({
    DestinationPhoneNumber: `+1${digits}`,
    OriginationIdentity: origination,
    MessageType: 'TRANSACTIONAL',
    MessageBody: `${code} is your Bob's Mutual Funds verification code. Msg & data rates may apply. Reply STOP to opt out, HELP for help.`,
  }));
}

class ConfigError extends Error {}

/** Mark the email verified, or the phone matching `digits` verified, on the client item. */
async function markVerified(clientId: string, channel: 'email' | 'sms', target: string): Promise<void> {
  if (channel === 'email') {
    await docClient.send(new UpdateCommand({
      TableName: CLIENTS_TABLE(),
      Key: { clientId },
      UpdateExpression: 'SET emailVerified = :t',
      ExpressionAttributeValues: { ':t': true },
    }));
    return;
  }
  // SMS: read phones, flip the matching number's verified flag, write back.
  const res = await docClient.send(new GetCommand({
    TableName: CLIENTS_TABLE(), Key: { clientId }, ProjectionExpression: 'phones',
  }));
  const phones = (res.Item?.phones ?? []) as { number?: string; verified?: boolean }[];
  const digits = phoneDigits(target);
  const updated = phones.map(p => (phoneDigits(p.number ?? '') === digits ? { ...p, verified: true } : p));
  await docClient.send(new UpdateCommand({
    TableName: CLIENTS_TABLE(),
    Key: { clientId },
    UpdateExpression: 'SET phones = :p',
    ExpressionAttributeValues: { ':p': updated },
  }));
}

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const body = JSON.parse(event.body ?? '{}') as { action: Action; clientId: string; target: string; code?: string };
    const { action, clientId } = body;
    if (!clientId || !action || !body.target) {
      return jsonResponse(400, { ok: false, error: 'clientId, action and target are required' });
    }

    const channel: 'email' | 'sms' = action.includes('email') ? 'email' : 'sms';
    const target = channel === 'email' ? normalizeEmail(body.target) : phoneDigits(body.target);
    if (channel === 'sms' && target.length !== 10) {
      return jsonResponse(400, { ok: false, error: 'A valid 10-digit US phone number is required.' });
    }
    const codeId = `${clientId}#${channel}#${target}`;

    // ── Send ────────────────────────────────────────────────────────────────
    if (action === 'send-email-code' || action === 'send-sms-code') {
      const existing = await docClient.send(new GetCommand({ TableName: VERIFICATION_TABLE(), Key: { codeId } }));
      const row = existing.Item as CodeRow | undefined;
      if (row && nowSec() - row.createdAt < RESEND_COOLDOWN_SECONDS) {
        return jsonResponse(429, { ok: false, error: 'Please wait a moment before requesting another code.' });
      }

      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      try {
        if (channel === 'email') await sendEmail(target, code);
        else await sendSms(target, code);
      } catch (err) {
        if (err instanceof ConfigError) return jsonResponse(200, { ok: false, error: err.message });
        console.error('verify send error', err);
        return jsonResponse(502, { ok: false, error: 'We could not send a code right now. Please try again later.' });
      }

      await docClient.send(new PutCommand({
        TableName: VERIFICATION_TABLE(),
        Item: {
          codeId, codeHash: hashCode(code, clientId),
          expiresAt: nowSec() + CODE_TTL_SECONDS, createdAt: nowSec(),
          attempts: 0, channel, target,
        } as CodeRow,
      }));
      return jsonResponse(200, { ok: true, sent: true });
    }

    // ── Confirm ──────────────────────────────────────────────────────────────
    if (action === 'confirm-email-code' || action === 'confirm-sms-code') {
      const code = (body.code ?? '').replace(/\D/g, '');
      if (code.length !== 6) return jsonResponse(400, { ok: false, error: 'Enter the 6-digit code.' });

      const res = await docClient.send(new GetCommand({ TableName: VERIFICATION_TABLE(), Key: { codeId } }));
      const row = res.Item as CodeRow | undefined;
      if (!row || row.expiresAt < nowSec()) {
        return jsonResponse(200, { ok: false, error: 'That code has expired. Request a new one.' });
      }
      if (row.attempts >= MAX_ATTEMPTS) {
        await docClient.send(new DeleteCommand({ TableName: VERIFICATION_TABLE(), Key: { codeId } }));
        return jsonResponse(200, { ok: false, error: 'Too many attempts. Request a new code.' });
      }
      if (row.codeHash !== hashCode(code, clientId)) {
        await docClient.send(new UpdateCommand({
          TableName: VERIFICATION_TABLE(), Key: { codeId },
          UpdateExpression: 'SET attempts = attempts + :one',
          ExpressionAttributeValues: { ':one': 1 },
        }));
        return jsonResponse(200, { ok: false, error: 'That code was incorrect. Try again.' });
      }

      await markVerified(clientId, channel, target);
      await docClient.send(new DeleteCommand({ TableName: VERIFICATION_TABLE(), Key: { codeId } }));
      return jsonResponse(200, { ok: true, verified: true });
    }

    return jsonResponse(400, { ok: false, error: `Unknown action: ${action}` });
  } catch (err) {
    console.error('verify error', err);
    return jsonResponse(500, { ok: false, error: 'Internal server error' });
  }
};
