import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from './dynamo-client';

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: { type: 'object'; properties: Record<string, never>; required: never[] };
  };
}

// All 7 client data tools — empty input schema since clientId lives in Lambda scope
export const ALL_CLIENT_TOOLS: OpenAITool[] = [
  {
    type: 'function',
    function: {
      name: 'get_contact_info',
      description: "Fetch the client's contact information: phone number, email address, and mailing address.",
      parameters: { type: 'object', properties: {} as Record<string, never>, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_accounts',
      description: "Fetch the client's full account list with types, IDs, balances, and total portfolio value.",
      parameters: { type: 'object', properties: {} as Record<string, never>, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_holdings',
      description: "Fetch the client's investment holdings: fund name, ticker, shares, price, market value, and DRIP status for each position.",
      parameters: { type: 'object', properties: {} as Record<string, never>, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_transactions',
      description: "Fetch the client's recent transaction history (last 20 transactions): date, description, amount, and account.",
      parameters: { type: 'object', properties: {} as Record<string, never>, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_beneficiaries',
      description: "Fetch the client's beneficiary designations grouped by account: name, relationship, allocation percentage, and type (primary/contingent).",
      parameters: { type: 'object', properties: {} as Record<string, never>, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_auto_invest',
      description: "Fetch the client's automatic investment schedules: fund, amount, frequency, day of month, active status, and next scheduled date.",
      parameters: { type: 'object', properties: {} as Record<string, never>, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_rmd',
      description: "Fetch the client's Required Minimum Distribution (RMD) settings: eligibility, annual RMD amount, amount taken this year, remaining amount, distribution preferences, and tax withholding.",
      parameters: { type: 'object', properties: {} as Record<string, never>, required: [] },
    },
  },
];

// Lighter tool list for next-best-response — accounts already pre-loaded in system prompt
export const NBR_CLIENT_TOOLS: OpenAITool[] = ALL_CLIENT_TOOLS.filter(t =>
  ['get_holdings', 'get_transactions', 'get_beneficiaries', 'get_auto_invest'].includes(t.function.name),
);

const TABLE = () => process.env.CLIENTS_TABLE ?? 'bobs-clients';
const MAX_RESULT_CHARS = 2000;

function cap(s: string): string {
  return s.length > MAX_RESULT_CHARS ? s.slice(0, MAX_RESULT_CHARS) + '...[truncated]' : s;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : raw;
}

async function fetchField(clientId: string, projection: string, exprAttrNames?: Record<string, string>): Promise<Record<string, unknown>> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE(),
      Key: { clientId },
      ProjectionExpression: projection,
      ...(exprAttrNames ? { ExpressionAttributeNames: exprAttrNames } : {}),
    }));
    return result.Item ?? {};
  } catch {
    return {};
  }
}

async function runTool(toolName: string, clientId: string): Promise<string> {
  switch (toolName) {

    case 'get_contact_info': {
      const item = await fetchField(clientId, 'phone, displayPhone, email, address');
      if (!item.phone && !item.email && !item.address) return 'No contact information on file.';
      const phone = (item.displayPhone as string | undefined) ?? fmtPhone((item.phone as string | undefined) ?? '');
      const lines = [
        `Phone: ${phone || 'not on file'}`,
        `Email: ${(item.email as string | undefined) || 'not on file'}`,
        `Address: ${(item.address as string | undefined) || 'not on file'}`,
      ];
      return cap(lines.join('\n'));
    }

    case 'get_accounts': {
      const item = await fetchField(clientId, 'accounts, totalBalance');
      const accounts = (item.accounts as Array<{ type: string; id: string; balance: number; change?: number }> | undefined) ?? [];
      if (!accounts.length) return 'No accounts found.';
      const lines = accounts.map(a =>
        `${a.type} (${a.id}): $${fmt(a.balance)}${a.change !== undefined ? ` (${a.change >= 0 ? '+' : ''}${a.change}% today)` : ''}`,
      );
      lines.push(`Total portfolio value: $${fmt((item.totalBalance as number | undefined) ?? 0)}`);
      return cap(lines.join('\n'));
    }

    case 'get_holdings': {
      const item = await fetchField(clientId, 'holdings');
      const holdings = (item.holdings as Array<{ name: string; ticker: string; accountId: string; shares: number; price: number; value: number; change?: number; drip?: boolean }> | undefined) ?? [];
      if (!holdings.length) return 'No holdings on file.';
      const byAccount = new Map<string, typeof holdings>();
      for (const h of holdings) {
        const list = byAccount.get(h.accountId) ?? [];
        list.push(h);
        byAccount.set(h.accountId, list);
      }
      const lines: string[] = [];
      for (const [acctId, hs] of byAccount) {
        lines.push(`Account ${acctId}:`);
        for (const h of hs) {
          lines.push(`  ${h.name} (${h.ticker}): ${h.shares} shares @ $${fmt(h.price)} = $${fmt(h.value)}${h.drip ? ' [DRIP on]' : ''}${h.change !== undefined ? ` (${h.change >= 0 ? '+' : ''}${h.change}% today)` : ''}`);
        }
      }
      return cap(lines.join('\n'));
    }

    case 'get_transactions': {
      const item = await fetchField(clientId, 'transactions');
      const txns = (item.transactions as Array<{ date: string; description: string; amount: number; account: string }> | undefined) ?? [];
      if (!txns.length) return 'No transactions on file.';
      const recent = txns.slice(-20);
      const lines = recent.map(t => {
        const sign = t.amount >= 0 ? '+' : '';
        return `${t.date} | ${sign}$${fmt(Math.abs(t.amount))} | ${t.description} | ${t.account}`;
      });
      return cap(lines.join('\n'));
    }

    case 'get_beneficiaries': {
      const item = await fetchField(clientId, 'beneficiaries');
      const benes = (item.beneficiaries as Array<{ accountId: string; name: string; relationship: string; percentage: number; type: string }> | undefined) ?? [];
      if (!benes.length) return 'No beneficiaries on file.';
      const byAccount = new Map<string, typeof benes>();
      for (const b of benes) {
        const list = byAccount.get(b.accountId) ?? [];
        list.push(b);
        byAccount.set(b.accountId, list);
      }
      const lines: string[] = [];
      for (const [acctId, bs] of byAccount) {
        lines.push(`Account ${acctId}:`);
        for (const b of bs) {
          lines.push(`  ${b.type}: ${b.name} (${b.relationship}) — ${b.percentage}%`);
        }
      }
      return cap(lines.join('\n'));
    }

    case 'get_auto_invest': {
      const item = await fetchField(clientId, 'autoInvest');
      const schedules = (item.autoInvest as Array<{ fund: string; ticker: string; accountId: string; accountType: string; amount: number; frequency: string; dayOfMonth?: number; active: boolean; nextDate: string; type?: string }> | undefined) ?? [];
      if (!schedules.length) return 'No automatic investment schedules on file.';
      const lines = schedules.map(s => {
        const day = s.frequency === 'Monthly' && s.dayOfMonth ? ` on the ${s.dayOfMonth}th` : '';
        return `${s.fund} (${s.ticker}) — $${fmt(s.amount)} ${s.frequency.toLowerCase()}${day} into ${s.accountType} (${s.accountId}) — ${s.active ? 'Active' : 'Paused'} — Next: ${s.nextDate}`;
      });
      return cap(lines.join('\n'));
    }

    case 'get_rmd': {
      const item = await fetchField(clientId, 'rmd');
      const rmd = item.rmd as Record<string, unknown> | undefined;
      if (!rmd) return 'No RMD information on file.';
      if (!rmd.eligible) return 'Client is not yet eligible for Required Minimum Distributions.';
      const lines = [
        `RMD eligible: yes (age ${rmd.age ?? 'unknown'})`,
        `Annual RMD: $${fmt((rmd.annualRmd as number | undefined) ?? 0)}`,
        `Taken this year: $${fmt((rmd.takenThisYear as number | undefined) ?? 0)}`,
        `Remaining this year: $${fmt((rmd.remainingThisYear as number | undefined) ?? 0)}`,
        `Next deadline: ${(rmd.nextDeadline as string | undefined) ?? 'N/A'}`,
        `Delivery method: ${(rmd.deliveryMethod as string | undefined) ?? 'not set'}`,
        `Frequency: ${(rmd.frequency as string | undefined) ?? 'not set'}`,
        `Tax withholding: ${(rmd.taxWithholding as number | undefined) ?? 0}%`,
      ];
      return cap(lines.join('\n'));
    }

    default:
      return `Unknown tool: ${toolName}`;
  }
}

/**
 * Returns a bound tool executor for a given clientId.
 * On error, returns a safe error string instead of throwing,
 * so the LLM can handle unavailability gracefully.
 */
export function createToolExecutor(
  clientId: string,
  _ctx: { contactId?: string },
): (toolName: string) => Promise<string> {
  return async (toolName: string): Promise<string> => {
    try {
      return await runTool(toolName, clientId);
    } catch {
      return 'Unable to retrieve this data right now. Please inform the client it is temporarily unavailable.';
    }
  };
}
