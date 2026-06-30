import { GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from './dynamo-client';

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: { type: 'object'; properties: Record<string, never>; required: never[] };
  };
}

// Tool catalog — empty input schemas since clientId lives in Lambda scope. Most read the
// client's own data; get_funds reads the client-agnostic fund lineup (bobs-funds table).
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
      name: 'get_balance_history',
      description: "Fetch month-end MARKET-VALUE history for each of the client's accounts (roughly the last 16 months), including the start-of-year and current values. Use this to COMPUTE returns the client asks about — year-to-date, trailing 1-year, etc. — by combining it with contributions/withdrawals from get_transactions. This tool returns the raw balances; you do the math.",
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
      description: "Fetch the client's recent transaction history (last 20 transactions): date, description, amount, account, and status (Scheduled/Pending/Settling/Completed/Canceled).",
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
  {
    type: 'function',
    function: {
      name: 'get_chat_history',
      description: "Fetch the client's recent chat history with Bob's Mutual Funds support: dates, topics discussed, and what was resolved in each session.",
      parameters: { type: 'object', properties: {} as Record<string, never>, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_funds',
      description: "Fetch Bob's Mutual Funds' FULL fund lineup (every fund offered): ticker, name, asset-class family (US Equity / Sector Equity / International / Fixed Income), annual expense ratio, and risk level. Use this whenever the customer asks what funds are available, for fund options/expense ratios, or to look up a fund by name or ticker. This is the authoritative catalog — do not rely on memory. Live prices/returns are NOT included here.",
      parameters: { type: 'object', properties: {} as Record<string, never>, required: [] },
    },
  },
];

export const NBR_CLIENT_TOOLS = ALL_CLIENT_TOOLS;

const TABLE = () => process.env.CLIENTS_TABLE ?? 'bobs-clients';
const TXNS_TABLE = () => process.env.TRANSACTIONS_TABLE ?? 'bobs-transactions';
const FUNDS_TABLE = () => process.env.FUNDS_TABLE ?? 'bobs-funds';
const MAX_RESULT_CHARS = 2000;

// Module-cached formatted fund catalog. The fund lineup is client-agnostic and changes
// < once/day, so we scan once and reuse across warm invocations (60-min TTL).
let fundsCache: { text: string; expiresAt: number } | null = null;
const FUNDS_CACHE_TTL_MS = 60 * 60 * 1000;

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

    case 'get_balance_history': {
      const item = await fetchField(clientId, 'accounts');
      const accounts = (item.accounts as Array<{ type: string; id: string; balance: number; balanceHistory?: Array<{ asOf: string; balance: number }> }> | undefined) ?? [];
      if (!accounts.length) return 'No accounts found.';
      // Anchor + summary block first (survives truncation), then the monthly detail.
      const summary: string[] = ['Month-end account balances (market value) — DERIVE returns from these; do the math yourself.'];
      const detail: string[] = ['', 'Monthly detail:'];
      let totalStart = 0, totalNow = 0, yearStartLabel = '';
      for (const a of accounts) {
        const hist = (a.balanceHistory ?? []).slice().sort((x, y) => x.asOf.localeCompare(y.asOf));
        const yearStart = hist.filter(h => h.asOf.endsWith('-12-31')).pop() ?? hist[0];
        const now = a.balance;
        if (yearStart) { totalStart += yearStart.balance; totalNow += now; yearStartLabel = yearStart.asOf; }
        summary.push(`${a.type} (${a.id}): start of year (${yearStart ? yearStart.asOf : 'n/a'}) $${fmt(yearStart ? yearStart.balance : now)} → current $${fmt(now)}`);
        if (hist.length) detail.push(`  ${a.type}: ` + hist.map(h => `${h.asOf.slice(0, 7)} $${fmt(h.balance)}`).join(', ') + `, now $${fmt(now)}`);
      }
      summary.push(`Portfolio: start of year (${yearStartLabel || 'n/a'}) $${fmt(totalStart)} → current $${fmt(totalNow)}.`);
      summary.push("To get a contribution-adjusted return, net out this year's contributions/withdrawals (from get_transactions) before dividing by the start-of-year value.");
      return cap([...summary, ...detail].join('\n'));
    }

    case 'get_holdings': {
      const item = await fetchField(clientId, 'holdings, accounts');
      const holdings = (item.holdings as Array<{ name: string; ticker: string; accountId: string; shares: number; price: number; value: number; change?: number; drip?: boolean }> | undefined) ?? [];
      if (!holdings.length) return 'No holdings on file.';
      const acctTypeMap = new Map(
        ((item.accounts as Array<{ type: string; id: string }> | undefined) ?? []).map(a => [a.id, a.type]),
      );
      const byAccount = new Map<string, typeof holdings>();
      for (const h of holdings) {
        const list = byAccount.get(h.accountId) ?? [];
        list.push(h);
        byAccount.set(h.accountId, list);
      }
      const lines: string[] = [];
      for (const [acctId, hs] of byAccount) {
        lines.push(`${acctTypeMap.get(acctId) ?? acctId}:`);
        for (const h of hs) {
          lines.push(`  ${h.name} (${h.ticker}): ${h.shares} shares @ $${fmt(h.price)} = $${fmt(h.value)}${h.drip ? ' [DRIP on]' : ''}${h.change !== undefined ? ` (${h.change >= 0 ? '+' : ''}${h.change}% today)` : ''}`);
        }
      }
      return cap(lines.join('\n'));
    }

    case 'get_transactions': {
      // Newest-first Query on the bobs-transactions table (PK clientId, SK txnSort).
      const result = await docClient.send(new QueryCommand({
        TableName: TXNS_TABLE(),
        KeyConditionExpression: 'clientId = :c',
        ExpressionAttributeValues: { ':c': clientId },
        ScanIndexForward: false,
        Limit: 20,
      }));
      const txns = (result.Items as Array<{ date: string; description: string; amount: number; account: string; status: string }> | undefined) ?? [];
      if (!txns.length) return 'No transactions on file.';
      const lines = txns.map(t => {
        const sign = t.amount >= 0 ? '+' : '';
        return `${t.date} | ${sign}$${fmt(Math.abs(t.amount))} | ${t.description} | ${t.account} | ${t.status}`;
      });
      return cap(lines.join('\n'));
    }

    case 'get_beneficiaries': {
      const item = await fetchField(clientId, 'beneficiaries, accounts');
      const benes = (item.beneficiaries as Array<{ accountId: string; name: string; relationship: string; percentage: number; type: string }> | undefined) ?? [];
      if (!benes.length) return 'No beneficiaries on file.';
      const acctTypeMap = new Map(
        ((item.accounts as Array<{ type: string; id: string }> | undefined) ?? []).map(a => [a.id, a.type]),
      );
      const byAccount = new Map<string, typeof benes>();
      for (const b of benes) {
        const list = byAccount.get(b.accountId) ?? [];
        list.push(b);
        byAccount.set(b.accountId, list);
      }
      const lines: string[] = [];
      for (const [acctId, bs] of byAccount) {
        lines.push(`${acctTypeMap.get(acctId) ?? acctId}:`);
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

    case 'get_chat_history': {
      const item = await fetchField(clientId, 'recentChatHistory');
      const history = (item.recentChatHistory as Array<{ date: string; topic: string; summary: string }> | undefined) ?? [];
      if (!history.length) return 'No recent chat history on file.';
      const lines = history.map(h => `${h.date} — ${h.topic}: ${h.summary}`);
      return cap(lines.join('\n'));
    }

    case 'get_funds': {
      // Client-agnostic — reads the bobs-funds catalog (module-cached). Returns the full list
      // uncapped (the whole lineup matters); ~36 compact lines stay well under token limits.
      if (fundsCache && Date.now() < fundsCache.expiresAt) return fundsCache.text;
      const res = await docClient.send(new ScanCommand({ TableName: FUNDS_TABLE() }));
      const funds = (res.Items as Array<{ ticker: string; name: string; group: string; expenseRatio: number; riskLevel: string }> | undefined) ?? [];
      if (!funds.length) return 'Fund lineup is temporarily unavailable.';
      const order = ['US Equity', 'Sector Equity', 'International', 'Fixed Income'];
      funds.sort((a, b) => (order.indexOf(a.group) - order.indexOf(b.group)) || a.name.localeCompare(b.name));
      const lines = funds.map(f => `${f.ticker} | ${f.name} | ${f.group} | ${f.expenseRatio}% expense ratio | ${f.riskLevel} risk`);
      const text = `Bob's Mutual Funds — full lineup (${funds.length} funds):\n${lines.join('\n')}`;
      fundsCache = { text, expiresAt: Date.now() + FUNDS_CACHE_TTL_MS };
      return text;
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
