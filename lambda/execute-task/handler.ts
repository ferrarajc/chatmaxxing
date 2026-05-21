import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { jsonResponse } from '../shared/types';
import { FUND_PRICES } from '../shared/client-defaults';

interface ExecuteTaskRequest {
  taskId: string;
  clientId: string;
  fields: Record<string, string>;
}

function refNumber(): string {
  return 'REF-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Match a fund by name or ticker — returns the FUND_PRICES entry
function matchFund(nameOrTicker: string): { name: string; ticker: string; price: number } | null {
  const s = (nameOrTicker ?? '').trim().toUpperCase();
  for (const [ticker, info] of Object.entries(FUND_PRICES)) {
    if (ticker === s || info.name.toUpperCase() === s) {
      return { ticker, name: info.name, price: info.price };
    }
  }
  // Partial match on ticker prefix
  for (const [ticker, info] of Object.entries(FUND_PRICES)) {
    if (s.includes(ticker) || ticker.includes(s)) {
      return { ticker, name: info.name, price: info.price };
    }
  }
  return null;
}

type AccountEntry  = { type: string; balance: number; id: string; change: number };
type HoldingEntry  = { name: string; ticker: string; accountId: string; shares: number; price: number; change: number; value: number; drip?: boolean };
type TxEntry       = { date: string; description: string; amount: number; account: string };

async function readClient(table: string, clientId: string): Promise<{
  accounts: AccountEntry[];
  holdings: HoldingEntry[];
  transactions: TxEntry[];
  totalBalance: number;
}> {
  const r = await docClient.send(new GetCommand({
    TableName: table,
    Key: { clientId },
    ProjectionExpression: 'accounts, holdings, transactions, totalBalance',
  }));
  return {
    accounts:     (r.Item?.accounts     ?? []) as AccountEntry[],
    holdings:     (r.Item?.holdings     ?? []) as HoldingEntry[],
    transactions: (r.Item?.transactions ?? []) as TxEntry[],
    totalBalance: (r.Item?.totalBalance ?? 0)  as number,
  };
}

async function writeFinancials(
  table: string, clientId: string,
  accounts: AccountEntry[], holdings: HoldingEntry[], transactions: TxEntry[], totalBalance: number,
) {
  await docClient.send(new UpdateCommand({
    TableName: table,
    Key: { clientId },
    UpdateExpression:
      'SET accounts = :accs, holdings = :h, transactions = :tx, totalBalance = :tb',
    ExpressionAttributeValues: {
      ':accs': accounts,
      ':h':    holdings,
      ':tx':   transactions,
      ':tb':   totalBalance,
    },
  }));
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
    const ref = refNumber();

    switch (taskId) {

      // ── Beneficiaries ─────────────────────────────────────────────────────

      case 'update-beneficiaries': {
        const accountId = fields.accountId;
        if (!accountId) return jsonResponse(400, { error: 'accountId is required' });

        const existing = await docClient.send(new GetCommand({
          TableName: table,
          Key: { clientId },
          ProjectionExpression: 'beneficiaries',
        }));
        const allBens: Array<Record<string, unknown>> = existing.Item?.beneficiaries ?? [];

        const newAccountBens: Array<Record<string, unknown>> = [];
        for (let i = 1; i <= 20; i++) {
          const name = fields[`ben_${i}_name`];
          if (!name) break;
          newAccountBens.push({
            accountId,
            name,
            relationship: fields[`ben_${i}_relationship`] ?? '',
            percentage:   parseFloat(fields[`ben_${i}_percentage`] ?? '0'),
            type:         fields[`ben_${i}_type`] ?? 'Primary',
          });
        }

        const otherBens = allBens.filter(b => b.accountId !== accountId);
        const updated   = [...otherBens, ...newAccountBens];

        await docClient.send(new UpdateCommand({
          TableName: table,
          Key: { clientId },
          UpdateExpression: 'SET beneficiaries = :v',
          ExpressionAttributeValues: { ':v': updated },
        }));

        const countMsg = newAccountBens.length === 0
          ? 'All beneficiaries removed from account.'
          : `${newAccountBens.length} beneficiar${newAccountBens.length === 1 ? 'y' : 'ies'} saved successfully.`;

        return jsonResponse(200, { success: true, message: countMsg, referenceNumber: ref });
      }

      // ── Auto-invest ───────────────────────────────────────────────────────

      case 'setup-auto-invest': {
        const existing = await docClient.send(new GetCommand({
          TableName: table,
          Key: { clientId },
          ProjectionExpression: 'autoInvest, accounts',
        }));
        const current: Array<Record<string, unknown>> = existing.Item?.autoInvest ?? [];
        const accounts: AccountEntry[] = existing.Item?.accounts ?? [];
        const accountType = accounts.find(a => a.id === fields.accountId)?.type ?? '';
        const fundInfo = matchFund(fields.fund ?? '');

        const newSchedule = {
          id:          'sched-' + Math.random().toString(36).slice(2, 8),
          accountId:   fields.accountId,
          accountType,
          fund:        fundInfo?.name ?? fields.fund ?? '',
          ticker:      fundInfo?.ticker ?? '',
          amount:      parseFloat(fields.amount ?? '0'),
          frequency:   fields.frequency ?? 'Monthly',
          dayOfMonth:  parseInt(fields.dayOfMonth ?? '1', 10),
          nextDate:    fields.startDate ?? today(),
          active:      true,
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
          referenceNumber: ref,
        });
      }

      case 'update-auto-invest': {
        const existing = await docClient.send(new GetCommand({
          TableName: table,
          Key: { clientId },
          ProjectionExpression: 'autoInvest',
        }));
        const current: Array<Record<string, unknown>> = existing.Item?.autoInvest ?? [];
        const updated = current.map((s, i) => {
          if (i === 0) {
            return {
              ...s,
              amount:    fields.amount    ? parseFloat(fields.amount) : s.amount,
              frequency: fields.frequency && fields.frequency !== 'Keep the same' ? fields.frequency : s.frequency,
              dayOfMonth: fields.dayOfMonth && fields.dayOfMonth !== 'Keep the same'
                ? parseInt(fields.dayOfMonth, 10) : s.dayOfMonth,
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
          referenceNumber: ref,
        });
      }

      case 'pause-auto-invest': {
        const existing = await docClient.send(new GetCommand({
          TableName: table,
          Key: { clientId },
          ProjectionExpression: 'autoInvest',
        }));
        const current: Array<Record<string, unknown>> = existing.Item?.autoInvest ?? [];
        const pausing = (fields.action ?? 'Pause').toLowerCase() === 'pause';
        const updated = current.map((s, i) => i === 0 ? { ...s, active: !pausing } : s);
        await docClient.send(new UpdateCommand({
          TableName: table,
          Key: { clientId },
          UpdateExpression: 'SET autoInvest = :v',
          ExpressionAttributeValues: { ':v': updated },
        }));
        return jsonResponse(200, {
          success: true,
          message: `Automatic investment schedule ${pausing ? 'paused' : 'resumed'} successfully.`,
          referenceNumber: ref,
        });
      }

      // ── RMD ───────────────────────────────────────────────────────────────

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
          frequency:      fields.frequency,
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
          referenceNumber: ref,
        });
      }

      // ── Contact info (real write) ─────────────────────────────────────────

      case 'update-contact-info': {
        const infoType  = (fields.infoType  ?? '').toLowerCase();
        const newValue  = fields.newValue ?? '';

        const profileGet = await docClient.send(new GetCommand({
          TableName: table,
          Key: { clientId },
          ProjectionExpression: '#nm, phone, displayPhone, email, address',
          ExpressionAttributeNames: { '#nm': 'name' },
        }));
        const profile = profileGet.Item ?? {};

        let updateExpr = '';
        const eav: Record<string, unknown> = {};
        const ean: Record<string, string> = { '#nm': 'name' };

        if (infoType.includes('phone')) {
          const digits = newValue.replace(/\D/g, '');
          const disp   = digits.length === 10
            ? `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
            : newValue;
          updateExpr = 'SET phone = :p, displayPhone = :dp';
          eav[':p']  = digits;
          eav[':dp'] = disp;
        } else if (infoType.includes('email')) {
          updateExpr = 'SET email = :v';
          eav[':v']  = newValue;
        } else if (infoType.includes('address') || infoType.includes('mailing')) {
          updateExpr = 'SET address = :v';
          eav[':v']  = newValue;
        } else if (infoType.includes('name')) {
          updateExpr = 'SET #nm = :v';
          eav[':v']  = newValue;
        } else {
          // Generic — store as email if we can't determine type
          updateExpr = 'SET email = :v';
          eav[':v']  = newValue;
        }

        await docClient.send(new UpdateCommand({
          TableName: table,
          Key: { clientId },
          UpdateExpression: updateExpr,
          ExpressionAttributeNames: Object.keys(ean).length ? ean : undefined,
          ExpressionAttributeValues: eav,
        }));

        return jsonResponse(200, {
          success: true,
          message: `Contact information updated: ${fields.infoType ?? 'field'} changed successfully.`,
          referenceNumber: ref,
        });
      }

      // ── Purchase (real write) ─────────────────────────────────────────────

      case 'place-purchase': {
        const { accounts, holdings, transactions, totalBalance } = await readClient(table, clientId);
        const accountId = fields.accountId ?? accounts[0]?.id ?? '';
        const amount    = parseFloat(fields.amount ?? '0');
        const fundInfo  = matchFund(fields.fund ?? '');

        if (!fundInfo || !accountId || amount <= 0) {
          return jsonResponse(200, {
            success: true,
            message: `Purchase order placed: $${fields.amount} into ${fields.fund}. Order will execute at next available NAV.`,
            referenceNumber: ref,
          });
        }

        const sharesAdded = Math.round((amount / fundInfo.price) * 1000) / 1000;
        const account     = accounts.find(a => a.id === accountId);
        const accountType = account?.type ?? '';

        // Update or create holding
        const hIdx = holdings.findIndex(h => h.ticker === fundInfo.ticker && h.accountId === accountId);
        if (hIdx >= 0) {
          const h = holdings[hIdx];
          const newShares = Math.round((h.shares + sharesAdded) * 1000) / 1000;
          holdings[hIdx] = { ...h, shares: newShares, value: Math.round(newShares * h.price) };
        } else {
          holdings.push({
            name: fundInfo.name, ticker: fundInfo.ticker, accountId,
            shares: sharesAdded, price: fundInfo.price, change: 0,
            value: Math.round(sharesAdded * fundInfo.price),
          });
        }

        // Update account balance and total
        const updatedAccounts = accounts.map(a =>
          a.id === accountId ? { ...a, balance: a.balance + amount } : a,
        );
        const newTotal = updatedAccounts.reduce((s, a) => s + a.balance, 0);

        // Append transaction
        transactions.unshift({
          date: today(),
          description: `Purchase - ${fundInfo.name}`,
          amount: -amount,
          account: accountType,
        });

        await writeFinancials(table, clientId, updatedAccounts, holdings, transactions, Math.round(newTotal));
        return jsonResponse(200, {
          success: true,
          message: `Purchase order placed: $${fields.amount} into ${fundInfo.name}. Order executed at NAV.`,
          referenceNumber: ref,
        });
      }

      // ── Sale (real write) ─────────────────────────────────────────────────

      case 'place-sale': {
        const { accounts, holdings, transactions } = await readClient(table, clientId);
        const accountId = fields.accountId ?? accounts[0]?.id ?? '';
        const amount    = parseFloat(fields.amount ?? '0');
        const fundInfo  = matchFund(fields.fund ?? '');

        if (!fundInfo || !accountId || amount <= 0) {
          return jsonResponse(200, {
            success: true,
            message: `Sale order placed: ${fields.amount} of ${fields.fund}. Order will execute at next available NAV.`,
            referenceNumber: ref,
          });
        }

        const sharesRemoved = Math.round((amount / fundInfo.price) * 1000) / 1000;
        const account = accounts.find(a => a.id === accountId);
        const accountType = account?.type ?? '';

        const hIdx = holdings.findIndex(h => h.ticker === fundInfo.ticker && h.accountId === accountId);
        if (hIdx >= 0) {
          const h = holdings[hIdx];
          const newShares = Math.max(0, Math.round((h.shares - sharesRemoved) * 1000) / 1000);
          if (newShares === 0) {
            holdings.splice(hIdx, 1);
          } else {
            holdings[hIdx] = { ...h, shares: newShares, value: Math.round(newShares * h.price) };
          }
        }

        const updatedAccounts = accounts.map(a =>
          a.id === accountId ? { ...a, balance: Math.max(0, a.balance - amount) } : a,
        );
        const newTotal = updatedAccounts.reduce((s, a) => s + a.balance, 0);

        transactions.unshift({
          date: today(),
          description: `Sale - ${fundInfo.name}`,
          amount: +amount,
          account: accountType,
        });

        await writeFinancials(table, clientId, updatedAccounts, holdings, transactions, Math.round(newTotal));
        return jsonResponse(200, {
          success: true,
          message: `Sale order placed: $${fields.amount} of ${fundInfo.name}. Order executed at NAV.`,
          referenceNumber: ref,
        });
      }

      // ── Exchange (real write) ─────────────────────────────────────────────

      case 'exchange-funds': {
        const { accounts, holdings, transactions } = await readClient(table, clientId);
        const accountId  = fields.accountId ?? accounts[0]?.id ?? '';
        const amount     = parseFloat(fields.amount ?? '0');
        const fromFund   = matchFund(fields.fromFund ?? '');
        const toFund     = matchFund(fields.toFund   ?? '');
        const account    = accounts.find(a => a.id === accountId);
        const accountType = account?.type ?? '';

        if (!fromFund || !toFund || !accountId || amount <= 0) {
          return jsonResponse(200, {
            success: true,
            message: `Exchange initiated: ${fields.amount} from ${fields.fromFund} to ${fields.toFund}. Will execute at next NAV.`,
            referenceNumber: ref,
          });
        }

        const sharesOut = Math.round((amount / fromFund.price) * 1000) / 1000;
        const sharesIn  = Math.round((amount / toFund.price)   * 1000) / 1000;

        // Reduce fromFund holding
        const fromIdx = holdings.findIndex(h => h.ticker === fromFund.ticker && h.accountId === accountId);
        if (fromIdx >= 0) {
          const h = holdings[fromIdx];
          const newShares = Math.max(0, Math.round((h.shares - sharesOut) * 1000) / 1000);
          if (newShares === 0) holdings.splice(fromIdx, 1);
          else holdings[fromIdx] = { ...h, shares: newShares, value: Math.round(newShares * h.price) };
        }

        // Increase toFund holding
        const toIdx = holdings.findIndex(h => h.ticker === toFund.ticker && h.accountId === accountId);
        if (toIdx >= 0) {
          const h = holdings[toIdx];
          const newShares = Math.round((h.shares + sharesIn) * 1000) / 1000;
          holdings[toIdx] = { ...h, shares: newShares, value: Math.round(newShares * h.price) };
        } else {
          holdings.push({
            name: toFund.name, ticker: toFund.ticker, accountId,
            shares: sharesIn, price: toFund.price, change: 0,
            value: Math.round(sharesIn * toFund.price),
          });
        }

        transactions.unshift({
          date: today(),
          description: `Exchange - ${fromFund.name} → ${toFund.name}`,
          amount: 0,
          account: accountType,
        });

        await writeFinancials(table, clientId, accounts, holdings, transactions,
          accounts.reduce((s, a) => s + a.balance, 0));
        return jsonResponse(200, {
          success: true,
          message: `Exchange completed: $${fields.amount} from ${fromFund.name} to ${toFund.name}.`,
          referenceNumber: ref,
        });
      }

      // ── DRIP toggle (real write) ──────────────────────────────────────────

      case 'toggle-drip': {
        const { holdings } = await readClient(table, clientId);
        const accountId = fields.accountId ?? '';
        const fundInfo  = matchFund(fields.fund ?? '');
        const enabled   = (fields.dripEnabled ?? '').toUpperCase().includes('ON');

        const hIdx = holdings.findIndex(h =>
          h.accountId === accountId && (fundInfo ? h.ticker === fundInfo.ticker : true),
        );
        if (hIdx >= 0) {
          holdings[hIdx] = { ...holdings[hIdx], drip: enabled };
        }

        await docClient.send(new UpdateCommand({
          TableName: table,
          Key: { clientId },
          UpdateExpression: 'SET holdings = :v',
          ExpressionAttributeValues: { ':v': holdings },
        }));
        return jsonResponse(200, {
          success: true,
          message: `Dividend reinvestment for ${fields.fund} has been ${enabled ? 'enabled' : 'disabled'}.`,
          referenceNumber: ref,
        });
      }

      // ── Withdrawal (real write) ───────────────────────────────────────────

      case 'request-withdrawal': {
        const { accounts, holdings, transactions } = await readClient(table, clientId);
        const accountId   = fields.accountId ?? accounts[0]?.id ?? '';
        const amount      = parseFloat(fields.amount ?? '0');
        const account     = accounts.find(a => a.id === accountId);
        const accountType = account?.type ?? '';

        const updatedAccounts = accounts.map(a =>
          a.id === accountId ? { ...a, balance: Math.max(0, a.balance - amount) } : a,
        );
        const newTotal = updatedAccounts.reduce((s, a) => s + a.balance, 0);

        transactions.unshift({
          date: today(),
          description: `Distribution - ${fields.deliveryMethod ?? 'ACH'}`,
          amount: +amount,
          account: accountType,
        });

        await writeFinancials(table, clientId, updatedAccounts, holdings, transactions, Math.round(newTotal));
        return jsonResponse(200, {
          success: true,
          message: `Distribution of $${fields.amount} requested. Funds will arrive via ${fields.deliveryMethod} within 3–5 business days.`,
          referenceNumber: ref,
        });
      }

      // ── Systematic withdrawal (real write — stored like auto-invest) ───────

      case 'setup-systematic-withdrawal': {
        const existing = await docClient.send(new GetCommand({
          TableName: table,
          Key: { clientId },
          ProjectionExpression: 'autoInvest, accounts',
        }));
        const current: Array<Record<string, unknown>> = existing.Item?.autoInvest ?? [];
        const accounts: AccountEntry[] = existing.Item?.accounts ?? [];
        const accountType = accounts.find(a => a.id === fields.accountId)?.type ?? '';

        const schedule = {
          id:           'sw-' + Math.random().toString(36).slice(2, 8),
          accountId:    fields.accountId,
          accountType,
          fund:         '',
          ticker:       '',
          amount:       parseFloat(fields.amount ?? '0'),
          frequency:    fields.frequency ?? 'Monthly',
          nextDate:     fields.startDate ?? today(),
          active:       true,
          type:         'withdrawal',
          deliveryMethod: fields.deliveryMethod ?? '',
        };
        await docClient.send(new UpdateCommand({
          TableName: table,
          Key: { clientId },
          UpdateExpression: 'SET autoInvest = :v',
          ExpressionAttributeValues: { ':v': [...current, schedule] },
        }));
        return jsonResponse(200, {
          success: true,
          message: `Recurring distribution set up: $${fields.amount} ${fields.frequency?.toLowerCase()}, starting ${fields.startDate}.`,
          referenceNumber: ref,
        });
      }

      // ── Open account (real write) ─────────────────────────────────────────

      case 'open-account': {
        const { accounts, holdings, transactions } = await readClient(table, clientId);
        const accountType   = fields.accountType ?? 'Taxable Account';
        const initialAmount = parseFloat(fields.initialAmount ?? '0');
        const newId         = 'acc-' + Math.random().toString(36).slice(2, 7);

        const newAccount: AccountEntry = {
          type:    accountType,
          balance: initialAmount,
          id:      newId,
          change:  0,
        };
        const updatedAccounts = [...accounts, newAccount];
        const newTotal        = updatedAccounts.reduce((s, a) => s + a.balance, 0);

        if (initialAmount > 0) {
          transactions.unshift({
            date: today(),
            description: `Initial funding - ${accountType}`,
            amount: -initialAmount,
            account: accountType,
          });
        }

        await writeFinancials(table, clientId, updatedAccounts, holdings, transactions, Math.round(newTotal));
        return jsonResponse(200, {
          success: true,
          message: `${accountType} opened successfully (ID: ${newId}). Confirmation email will arrive within 1 business day.`,
          referenceNumber: ref,
        });
      }

      // ── Roth conversion (real write) ──────────────────────────────────────

      case 'roth-conversion': {
        const { accounts, holdings, transactions } = await readClient(table, clientId);
        const fromAccountId = fields.fromAccountId ?? '';
        const amount        = parseFloat(fields.amount ?? '0');
        const fromAccount   = accounts.find(a => a.id === fromAccountId);
        const rothAccount   = accounts.find(a => a.type === 'Roth IRA');

        if (!fromAccount) {
          return jsonResponse(200, {
            success: true,
            message: `Roth conversion of $${fields.amount} submitted for tax year ${fields.taxYear}.`,
            referenceNumber: ref,
          });
        }

        const updatedAccounts = accounts.map(a => {
          if (a.id === fromAccountId) return { ...a, balance: Math.max(0, a.balance - amount) };
          if (rothAccount && a.id === rothAccount.id) return { ...a, balance: a.balance + amount };
          return a;
        });
        const newTotal = updatedAccounts.reduce((s, a) => s + a.balance, 0);

        transactions.unshift({
          date: today(),
          description: `Roth Conversion - from ${fromAccount.type}`,
          amount: +amount,
          account: 'Roth IRA',
        });
        transactions.unshift({
          date: today(),
          description: `Roth Conversion - from ${fromAccount.type}`,
          amount: -amount,
          account: fromAccount.type,
        });

        await writeFinancials(table, clientId, updatedAccounts, holdings, transactions, Math.round(newTotal));
        return jsonResponse(200, {
          success: true,
          message: `Roth conversion of $${fields.amount} from ${fromAccount.type} submitted for tax year ${fields.taxYear}.`,
          referenceNumber: ref,
        });
      }

      // ── Remaining mock executions ─────────────────────────────────────────

      case 'add-account-access':
        return jsonResponse(200, {
          success: true,
          message: `Account access granted to ${fields.personName} (${fields.accessLevel}).`,
          referenceNumber: ref,
        });

      case 'initiate-rollover':
        return jsonResponse(200, {
          success: true,
          message: `Rollover request initiated from ${fields.sourceInstitution}. Our team will contact you within 2 business days.`,
          referenceNumber: ref,
        });

      case 'request-tax-document':
        return jsonResponse(200, {
          success: true,
          message: `${fields.formType} for ${fields.taxYear} will be mailed within 7–10 business days.`,
          referenceNumber: ref,
        });

      case 'cancel-reschedule-callback':
        if (fields.action === 'Cancel') {
          return jsonResponse(200, { success: true, message: 'Callback cancelled successfully.', referenceNumber: ref });
        }
        return jsonResponse(200, {
          success: true,
          message: `Callback rescheduled to ${fields.newScheduledTime}.`,
          referenceNumber: ref,
        });

      case 'update-security':
        return jsonResponse(200, {
          success: true,
          message: `Security update completed: ${fields.securityAction}.`,
          referenceNumber: ref,
        });

      default:
        return jsonResponse(400, { error: `Unknown taskId: ${taskId}` });
    }
  } catch (err) {
    console.error('execute-task error', err);
    return jsonResponse(500, { error: 'Task execution failed' });
  }
};
