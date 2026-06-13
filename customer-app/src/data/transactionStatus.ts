// Customer-app mirror of the transaction lifecycle statuses defined on the Lambda
// side (lambda/shared/transaction-status.ts). Same string values; this file adds the
// display copy shown in the status popover. Keep the two in sync.

import { theme } from '../theme';

export type TxnStatus = 'Scheduled' | 'Pending' | 'Settling' | 'Completed' | 'Canceled';

export interface TransactionRow {
  date: string;
  description: string;
  amount: number;
  account: string;
  accountId?: string;
  status?: string; // one of TxnStatus; kept loose so API/fallback rows assign freely
  type?: string;
  txnId?: string;
}

interface StatusMeta {
  label: string;
  definition: string;
  whatToExpect?: string; // shown for in-progress statuses
  color: string;
}

export const STATUS_META: Record<TxnStatus, StatusMeta> = {
  Scheduled: {
    label: 'Scheduled',
    definition: 'This transaction is scheduled for a future date and has not been placed yet.',
    whatToExpect: 'It will be placed automatically on its scheduled date and priced at that day’s closing price (NAV).',
    color: theme.color.primary,
  },
  Pending: {
    label: 'Pending',
    definition: 'Your order has been placed and is awaiting the next daily price (NAV).',
    whatToExpect: 'It will be priced after the market closes today, then settle the next business day.',
    color: theme.color.warning,
  },
  Settling: {
    label: 'Settling',
    definition: 'Your order has been priced at NAV and is now settling.',
    whatToExpect: 'Funds and shares typically settle by the next business day (T+1).',
    color: theme.color.accent,
  },
  Completed: {
    label: 'Completed',
    definition: 'This transaction has settled and posted to your account.',
    color: theme.color.textMuted,
  },
  Canceled: {
    label: 'Canceled',
    definition: 'This order was canceled and did not complete. No shares or funds changed hands.',
    color: theme.color.danger,
  },
};

/** Look up display metadata, defaulting unknown/missing statuses to Completed. */
export function statusMeta(status?: string): StatusMeta {
  return STATUS_META[(status as TxnStatus)] ?? STATUS_META.Completed;
}

export const ALL_STATUSES: TxnStatus[] = ['Scheduled', 'Pending', 'Settling', 'Completed', 'Canceled'];
