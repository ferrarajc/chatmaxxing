import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { UpdateCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { jsonResponse } from '../shared/types';
import { FUND_PRICES } from '../shared/fund-catalog';
import { buildTransactionRow, TxnType } from '../shared/transaction-history';
import { isIraAccount } from '../shared/contribution-limits';
import { parseMoney, isValidAmount, formatMoney, resolveAmount, numberOr } from '../shared/money';
import { cashOf, applyCashDelta, recomputeAccounts, portfolioTotal, transferValue, resolveAccount } from '../shared/account-math';

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

type AccountEntry  = { type: string; balance: number; cash?: number; id: string; change: number };
type HoldingEntry  = { name: string; ticker: string; accountId: string; shares: number; price: number; change: number; value: number; drip?: boolean };

async function readClient(table: string, clientId: string): Promise<{
  accounts: AccountEntry[];
  holdings: HoldingEntry[];
  totalBalance: number;
}> {
  const r = await docClient.send(new GetCommand({
    TableName: table,
    Key: { clientId },
    ProjectionExpression: 'accounts, holdings, totalBalance',
  }));
  return {
    accounts:     (r.Item?.accounts     ?? []) as AccountEntry[],
    holdings:     (r.Item?.holdings     ?? []) as HoldingEntry[],
    totalBalance: (r.Item?.totalBalance ?? 0)  as number,
  };
}

async function writeFinancials(
  table: string, clientId: string,
  accounts: AccountEntry[], holdings: HoldingEntry[], totalBalance: number,
) {
  await docClient.send(new UpdateCommand({
    TableName: table,
    Key: { clientId },
    UpdateExpression: 'SET accounts = :accs, holdings = :h, totalBalance = :tb',
    ExpressionAttributeValues: {
      ':accs': accounts,
      ':h':    holdings,
      ':tb':   totalBalance,
    },
  }));
}

// Transactions now live as one item per row in the bobs-transactions table (not an
// array on the client item). A freshly placed order is Pending (awaiting tonight's
// NAV). Live rows use the real current date so they sort above the frozen demo history.
const TXNS_TABLE = (): string => process.env.TRANSACTIONS_TABLE ?? 'bobs-transactions';

function liveSeq(): number {
  const now = new Date();
  return now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
}

async function appendTransactionRows(
  clientId: string,
  inputs: Array<{ description: string; amount: number; account: string; accountId: string; type: TxnType }>,
): Promise<void> {
  const base = liveSeq();
  await Promise.all(inputs.map((input, i) =>
    docClient.send(new PutCommand({
      TableName: TXNS_TABLE(),
      Item: buildTransactionRow({
        clientId,
        seq: base + i,
        date: today(),
        status: 'Pending',
        ...input,
      }),
    })),
  ));
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
            percentage:   numberOr(fields[`ben_${i}_percentage`], 0),
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
        const schedAccount = resolveAccount(accounts, fields.accountId);
        const accountType = schedAccount?.type ?? '';
        const fundInfo = matchFund(fields.fund ?? '');

        const scheduleAmount = parseMoney(fields.amount);
        if (!isValidAmount(scheduleAmount)) {
          return jsonResponse(200, {
            success: false,
            message: `"${fields.amount ?? ''}" isn't an amount I can process. Enter a dollar figure, like $250.`,
          });
        }

        const newSchedule = {
          id:          'sched-' + Math.random().toString(36).slice(2, 8),
          accountId:   fields.accountId,
          accountType,
          fund:        fundInfo?.name ?? fields.fund ?? '',
          ticker:      fundInfo?.ticker ?? '',
          amount:      scheduleAmount,
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
          message: `Automatic investment set up: $${formatMoney(scheduleAmount)} ${fields.frequency?.toLowerCase()} into ${fields.fund}.`,
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
              // Keep the existing amount unless a NEW, parseable one was given —
              // an unparseable edit must not blank out a working schedule.
              amount:    isValidAmount(parseMoney(fields.amount)) ? parseMoney(fields.amount) : s.amount,
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
          taxWithholding: numberOr(fields.taxWithholding, 10),
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
        const ean: Record<string, string> = {};

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
          ean['#nm'] = 'name';
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
        const { accounts, holdings } = await readClient(table, clientId);
        const account   = (fields.accountId ?? '').trim()
          ? resolveAccount(accounts, fields.accountId)
          : (accounts[0] ?? null);
        const accountId = account?.id ?? '';
        const amount    = parseMoney(fields.amount ?? '0');
        const fundInfo  = matchFund(fields.fund ?? '');

        // Validate BEFORE the first write. These used to fall through to a cheerful
        // "order placed" that wrote nothing at all — the agent saw success, the ledger
        // never moved, and an IRA contribution never reached the contributions card.
        if (!isValidAmount(amount)) {
          return jsonResponse(200, {
            success: false,
            message: `"${fields.amount ?? ''}" isn't an amount I can process. Enter a dollar figure, like $1,500.`,
          });
        }
        if (!fundInfo) {
          return jsonResponse(200, {
            success: false,
            message: `I couldn't match "${fields.fund ?? ''}" to a fund in the lineup. Check the ticker and try again.`,
          });
        }
        // Refuse rather than guess. An unresolvable account used to sail through and
        // create a holding keyed to the label, which belonged to no account at all.
        if (!account) {
          return jsonResponse(200, {
            success: false,
            message: `I couldn't match "${fields.accountId ?? ''}" to one of this client's accounts.`,
          });
        }
        const accountType = account.type;

        // The funding source is finally READ. It was collected by the expert, shown on
        // the proposed-action card, submitted — and then silently discarded, so both
        // options behaved identically (and both CREATED money: the purchase added the
        // full amount to the balance AND added the shares).
        //
        // Anything other than an explicit "cash" answer — including a missing field —
        // means the linked bank, which preserves today's behavior for callers that
        // don't send it.
        const fromCash = /cash/i.test(fields.fundingSource ?? '');

        if (fromCash) {
          const available = cashOf(account, holdings);
          if (available < amount) {
            return jsonResponse(200, {
              success: false,
              message: `That account has $${formatMoney(available)} in cash — not enough for a $${formatMoney(amount)} purchase. `
                     + `You can fund it from the linked bank account instead, sell holdings to raise cash, `
                     + `or purchase up to $${formatMoney(available)} from cash.`,
            });
          }
        }

        const sharesAdded = Math.round((amount / fundInfo.price) * 1000) / 1000;

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

        // Cash-funded: the money was already in the account, so cash goes DOWN and the
        // total is unchanged. Bank-funded: new money arrives, cash is untouched and the
        // total goes UP. Either way the balance is recomputed from the identity rather
        // than adjusted by hand.
        let cashAdjusted = accounts;
        if (fromCash) {
          const debit = applyCashDelta(accounts, holdings, accountId, -amount);
          // Never ignore ok:false. Discarding it is what let a failed cash debit
          // continue to a "success" response with the money silently unmoved.
          if (!debit.ok) {
            return jsonResponse(200, {
              success: false,
              message: `That account has $${formatMoney(debit.available)} in cash — not enough for a $${formatMoney(amount)} purchase.`,
            });
          }
          cashAdjusted = debit.accounts;
        }
        const updatedAccounts = recomputeAccounts(cashAdjusted, holdings);
        const newTotal = portfolioTotal(updatedAccounts);

        await writeFinancials(table, clientId, updatedAccounts, holdings, newTotal);
        // New money into a retirement account is an IRA CONTRIBUTION, not a plain buy —
        // it counts against the annual limit and must feed the contributions card. This
        // mirrors clientStore.buyFund so a contribution made through an agent or
        // autopilot is recorded identically to one made through the portal. The task is
        // already named "Buy / Make a Contribution"; this makes the ledger agree.
        // Note the SIGN FLIP: a contribution is money in (positive).
        //
        // ...but ONLY new money. Moving cash that is ALREADY inside a Roth into a fund
        // is not a contribution and must not count against the annual limit. That was
        // invisible while "cash in account" did nothing; now that it moves real cash,
        // it would have overstated the client's contributions.
        const purchaseIsContribution = isIraAccount(accountType) && !fromCash;
        await appendTransactionRows(clientId, [{
          description: purchaseIsContribution
            ? `Contribution - ${fundInfo.name}`
            : `Purchase - ${fundInfo.name}`,
          amount: purchaseIsContribution ? amount : -amount,
          account: accountType,
          accountId,
          type: purchaseIsContribution ? 'contribution' : 'purchase',
        }]);
        return jsonResponse(200, {
          success: true,
          message: `Purchase order placed: $${formatMoney(amount)} into ${fundInfo.name}. Order executed at NAV.`,
          referenceNumber: ref,
        });
      }

      // ── Sale (real write) ─────────────────────────────────────────────────

      case 'place-sale': {
        const { accounts, holdings } = await readClient(table, clientId);
        const account   = (fields.accountId ?? '').trim()
          ? resolveAccount(accounts, fields.accountId)
          : (accounts[0] ?? null);
        const accountId = account?.id ?? '';
        const fundInfo  = matchFund(fields.fund ?? '');

        if (!fundInfo) {
          return jsonResponse(200, {
            success: false,
            message: `I couldn't match "${fields.fund ?? ''}" to a fund in the lineup. Check the ticker and try again.`,
          });
        }
        if (!account) {
          return jsonResponse(200, {
            success: false,
            message: `I couldn't match "${fields.accountId ?? ''}" to one of this client's accounts.`,
          });
        }

        const hIdx = holdings.findIndex(h => h.ticker === fundInfo.ticker && h.accountId === accountId);
        const position = hIdx >= 0 ? holdings[hIdx] : null;

        // "Full redemption" / "all shares" is an answer the expert explicitly invites,
        // so resolve it against the position rather than feeding the phrase to a parser.
        const amount = resolveAmount(fields.amount, position?.value ?? 0);

        if (!isValidAmount(amount)) {
          return jsonResponse(200, {
            success: false,
            message: position
              ? `"${fields.amount ?? ''}" isn't an amount I can process. Enter a dollar figure, or "full redemption".`
              : `There's no ${fundInfo.name} position in that account to sell.`,
          });
        }
        if (position && amount > position.value) {
          return jsonResponse(200, {
            success: false,
            message: `That position is worth $${formatMoney(position.value)} — not enough to sell $${formatMoney(amount)}. `
                   + `You can sell up to $${formatMoney(position.value)}, or request a full redemption.`,
          });
        }

        const sharesRemoved = Math.round((amount / fundInfo.price) * 1000) / 1000;
        const accountType = account?.type ?? '';

        if (hIdx >= 0) {
          const h = holdings[hIdx];
          const newShares = Math.max(0, Math.round((h.shares - sharesRemoved) * 1000) / 1000);
          if (newShares === 0) {
            holdings.splice(hIdx, 1);
          } else {
            holdings[hIdx] = { ...h, shares: newShares, value: Math.round(newShares * h.price) };
          }
        }

        // A sale CONVERTS shares to cash: proceeds land in the account and the total is
        // unchanged. It used to subtract the amount from the balance while also removing
        // the shares, so the money simply vanished from the client's account.
        const withProceeds = applyCashDelta(accounts, holdings, accountId, +amount).accounts;
        const updatedAccounts = recomputeAccounts(withProceeds, holdings);
        const newTotal = portfolioTotal(updatedAccounts);

        await writeFinancials(table, clientId, updatedAccounts, holdings, newTotal);
        await appendTransactionRows(clientId, [{
          description: `Sale - ${fundInfo.name}`,
          amount: +amount,
          account: accountType,
          accountId,
          type: 'sale',
        }]);
        return jsonResponse(200, {
          success: true,
          message: `Sale order placed: $${formatMoney(amount)} of ${fundInfo.name}. Order executed at NAV.`,
          referenceNumber: ref,
        });
      }

      // ── Exchange (real write) ─────────────────────────────────────────────

      case 'exchange-funds': {
        const { accounts, holdings } = await readClient(table, clientId);
        const account    = (fields.accountId ?? '').trim()
          ? resolveAccount(accounts, fields.accountId)
          : (accounts[0] ?? null);
        const accountId  = account?.id ?? '';
        const fromFund   = matchFund(fields.fromFund ?? '');
        const toFund     = matchFund(fields.toFund   ?? '');
        const accountType = account?.type ?? '';

        if (!fromFund || !toFund) {
          return jsonResponse(200, {
            success: false,
            message: `I couldn't match "${(!fromFund ? fields.fromFund : fields.toFund) ?? ''}" to a fund in the lineup. Check the ticker and try again.`,
          });
        }
        if (!account) {
          return jsonResponse(200, {
            success: false,
            message: `I couldn't match "${fields.accountId ?? ''}" to one of this client's accounts.`,
          });
        }

        const fromPosition = holdings.find(h => h.ticker === fromFund.ticker && h.accountId === accountId) ?? null;

        // "Full balance" / "everything in that fund" is a documented answer here too.
        const amount = resolveAmount(fields.amount, fromPosition?.value ?? 0);

        if (!isValidAmount(amount)) {
          return jsonResponse(200, {
            success: false,
            message: fromPosition
              ? `"${fields.amount ?? ''}" isn't an amount I can process. Enter a dollar figure, or "the full balance".`
              : `There's no ${fromFund.name} position in that account to exchange out of.`,
          });
        }
        if (fromPosition && amount > fromPosition.value) {
          return jsonResponse(200, {
            success: false,
            message: `That ${fromFund.name} position is worth $${formatMoney(fromPosition.value)} — not enough to exchange $${formatMoney(amount)}. `
                   + `You can exchange up to $${formatMoney(fromPosition.value)}.`,
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

        // An exchange moves value between two funds inside one account: cash untouched.
        // (The two roundings are independent, so invested value can drift by ~$1 per
        // exchange; recomputing means that lands on the balance rather than nowhere.)
        const exchangedAccounts = recomputeAccounts(accounts, holdings);
        await writeFinancials(table, clientId, exchangedAccounts, holdings, portfolioTotal(exchangedAccounts));
        await appendTransactionRows(clientId, [{
          description: `Exchange - ${fromFund.name} → ${toFund.name}`,
          amount: 0,
          account: accountType,
          accountId,
          type: 'exchange',
        }]);
        return jsonResponse(200, {
          success: true,
          message: `Exchange completed: $${formatMoney(amount)} from ${fromFund.name} to ${toFund.name}.`,
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
        const { accounts, holdings } = await readClient(table, clientId);
        const account     = (fields.accountId ?? '').trim()
          ? resolveAccount(accounts, fields.accountId)
          : (accounts[0] ?? null);
        const accountId   = account?.id ?? '';
        const accountType = account?.type ?? '';

        if (!account) {
          return jsonResponse(200, {
            success: false,
            message: `I couldn't match "${fields.accountId ?? ''}" to one of this client's accounts.`,
          });
        }

        // A distribution is paid out of CASH, so "full balance" resolves to the cash
        // available, not the account total. (It also used to reach parseFloat as a
        // phrase, producing NaN and a failed submit.)
        const availableCash = cashOf(account, holdings);
        const amount = resolveAmount(fields.amount, availableCash);

        if (!isValidAmount(amount)) {
          return jsonResponse(200, {
            success: false,
            message: `"${fields.amount ?? ''}" isn't an amount I can process. Enter a dollar figure, or "full balance".`,
          });
        }
        // DELIBERATE BEHAVIOR CHANGE: this used to always succeed, silently driving the
        // balance below the value of the holdings. Money has to be in cash to be paid
        // out — matching kb-014 and WithdrawalsPage ("sell the holdings you need...
        // proceeds settle in about 1 business day"). We do NOT auto-liquidate to cover
        // the gap: choosing which lot of which fund to sell, and its tax treatment, is
        // not something this data model represents, and pretending otherwise is the
        // exact class of fiction being removed here.
        if (amount > availableCash) {
          return jsonResponse(200, {
            success: false,
            message: `That account has $${formatMoney(availableCash)} available in cash — not enough for a `
                   + `$${formatMoney(amount)} distribution. Sell holdings first to raise cash, or request up `
                   + `to $${formatMoney(availableCash)}.`,
          });
        }

        const afterWithdrawal = applyCashDelta(accounts, holdings, accountId, -amount).accounts;
        const updatedAccounts = recomputeAccounts(afterWithdrawal, holdings);
        const newTotal = portfolioTotal(updatedAccounts);

        await writeFinancials(table, clientId, updatedAccounts, holdings, newTotal);
        await appendTransactionRows(clientId, [{
          description: `Distribution - ${fields.deliveryMethod ?? 'ACH'}`,
          amount: +amount,
          account: accountType,
          accountId,
          type: 'withdrawal',
        }]);
        return jsonResponse(200, {
          success: true,
          message: `Distribution of $${formatMoney(amount)} requested. Funds will arrive via ${fields.deliveryMethod} within 3–5 business days.`,
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

        const swAmount = parseMoney(fields.amount);
        if (!isValidAmount(swAmount)) {
          return jsonResponse(200, {
            success: false,
            message: `"${fields.amount ?? ''}" isn't an amount I can process. Enter a dollar figure, like $1,500.`,
          });
        }

        const schedule = {
          id:           'sw-' + Math.random().toString(36).slice(2, 8),
          accountId:    fields.accountId,
          accountType,
          fund:         '',
          ticker:       '',
          amount:       swAmount,
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
          message: `Recurring distribution set up: $${formatMoney(swAmount)} ${fields.frequency?.toLowerCase()}, starting ${fields.startDate}.`,
          referenceNumber: ref,
        });
      }

      // ── Open account (real write) ─────────────────────────────────────────

      case 'open-account': {
        const { accounts, holdings } = await readClient(table, clientId);
        const accountType   = fields.accountType ?? 'Taxable Account';
        // An opening deposit is optional, so an absent/blank field means $0 — but a
        // present-and-unparseable one must not become NaN on the new account's balance.
        const rawInitial    = fields.initialAmount ?? '';
        const parsedInitial = parseMoney(rawInitial);
        if (rawInitial.trim() !== '' && !Number.isFinite(parsedInitial)) {
          return jsonResponse(200, {
            success: false,
            message: `"${rawInitial}" isn't an amount I can process. Enter a dollar figure, like $1,500.`,
          });
        }
        const initialAmount = Number.isFinite(parsedInitial) ? Math.max(0, parsedInitial) : 0;
        const newId         = 'acc-' + Math.random().toString(36).slice(2, 7);

        // A new account holds nothing yet, so the opening deposit is ENTIRELY cash —
        // which is what makes the client's first purchase from it work.
        const newAccount: AccountEntry = {
          type:    accountType,
          balance: initialAmount,
          cash:    initialAmount,
          id:      newId,
          change:  0,
        };
        const updatedAccounts = recomputeAccounts([...accounts, newAccount], holdings);
        const newTotal        = portfolioTotal(updatedAccounts);

        await writeFinancials(table, clientId, updatedAccounts, holdings, newTotal);
        if (initialAmount > 0) {
          await appendTransactionRows(clientId, [{
            description: `Initial funding - ${accountType}`,
            amount: -initialAmount,
            account: accountType,
            accountId: newId,
            type: 'deposit',
          }]);
        }
        return jsonResponse(200, {
          success: true,
          message: `${accountType} opened successfully (ID: ${newId}). Confirmation email will arrive within 1 business day.`,
          referenceNumber: ref,
        });
      }

      // ── Roth conversion (real write) ──────────────────────────────────────

      case 'roth-conversion': {
        const { accounts, holdings } = await readClient(table, clientId);
        const fromAccount   = resolveAccount(accounts, fields.fromAccountId);
        const fromAccountId = fromAccount?.id ?? '';
        const rothAccount   = accounts.find(a => a.type === 'Roth IRA');

        if (!fromAccount) {
          return jsonResponse(200, {
            success: false,
            message: 'I couldn\'t find the account to convert from.',
          });
        }

        // A conversion is an INTERNAL transfer between two accounts at the same
        // custodian, and converting IN KIND — moving the shares themselves rather than
        // liquidating — is standard practice. So unlike a distribution (where money
        // actually leaves the firm and must therefore be in cash), this is capped by the
        // source account's TOTAL value, and "full balance" means the whole account.
        //
        // Capping it by cash instead broke the flagship "Roth conversion strategy" demo:
        // Alex's Traditional IRA holds $128,450 but only $1,897 in cash, so every
        // realistic conversion was refused.
        const convertible = fromAccount.balance;
        const amount = resolveAmount(fields.amount, convertible);

        if (!isValidAmount(amount)) {
          return jsonResponse(200, {
            success: false,
            message: `"${fields.amount ?? ''}" isn't an amount I can process. Enter a dollar figure, or "full balance".`,
          });
        }
        if (!rothAccount) {
          return jsonResponse(200, {
            success: false,
            message: 'There is no Roth IRA on this account to convert into.',
          });
        }
        if (amount > convertible) {
          return jsonResponse(200, {
            success: false,
            message: `That ${fromAccount.type} is worth $${formatMoney(convertible)} — not enough to convert `
                   + `$${formatMoney(amount)}. You can convert up to $${formatMoney(convertible)}.`,
          });
        }

        // Cash first, then positions in kind, pro-rata. Keeps balance = cash + holdings
        // true on BOTH accounts; the old code moved balances only and left holdings
        // behind, which is what drove the source account underwater.
        const moved = transferValue(accounts, holdings, fromAccountId, rothAccount.id, amount);
        if (!moved.ok) {
          return jsonResponse(200, {
            success: false,
            message: `That ${fromAccount.type} is worth $${formatMoney(moved.available)} — not enough to convert $${formatMoney(amount)}.`,
          });
        }
        const updatedAccounts = moved.accounts;
        const newTotal = portfolioTotal(updatedAccounts);

        await writeFinancials(table, clientId, updatedAccounts, moved.holdings, newTotal);
        await appendTransactionRows(clientId, [
          {
            description: `Roth Conversion - from ${fromAccount.type}`,
            amount: -amount,
            account: fromAccount.type,
            accountId: fromAccount.id,
            type: 'exchange',
          },
          {
            description: `Roth Conversion - from ${fromAccount.type}`,
            amount: +amount,
            account: 'Roth IRA',
            accountId: rothAccount?.id ?? fromAccount.id,
            type: 'exchange',
          },
        ]);
        return jsonResponse(200, {
          success: true,
          message: `Roth conversion of $${formatMoney(amount)} from ${fromAccount.type} submitted for tax year ${fields.taxYear}.`,
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
