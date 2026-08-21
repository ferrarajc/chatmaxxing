// ── In-progress buy order, carried in the URL ────────────────────────────────
//
// A client filling in the buy form can step out to the fund list to pick a different
// fund. That is a full navigation, so whatever they had already entered would be lost
// unless it travels with them. This is the shape that travels.
//
// It is a shared util rather than three hand-rolled query strings because the same
// params are written by BuyPage and read back through ResearchPage and FundProfilePage
// on the way to the buy screen — three places that must agree on the spelling.

import { AutoInvestSchedule } from '../data/personas';

export interface BuyIntent {
  /** Destination account id — the one thing that also arrives from a Contribute button. */
  account?: string;
  /** Kept as the raw input string so a half-typed "1200." survives the round trip. */
  amount?: string;
  type?: 'onetime' | 'recurring';
  freq?: AutoInvestSchedule['frequency'];
}

const FREQUENCIES: AutoInvestSchedule['frequency'][] = ['Monthly', 'Bi-weekly', 'Quarterly'];

/** Read a buy intent out of a URL's query params, ignoring anything malformed. */
export function readBuyIntent(sp: URLSearchParams): BuyIntent {
  const intent: BuyIntent = {};

  const account = sp.get('account');
  if (account) intent.account = account;

  // Digits with an optional decimal part — the same shape the amount field accepts.
  const amount = sp.get('amount');
  if (amount && /^[0-9]*\.?[0-9]*$/.test(amount) && amount !== '') intent.amount = amount;

  const type = sp.get('type');
  if (type === 'onetime' || type === 'recurring') intent.type = type;

  const freq = sp.get('freq') as AutoInvestSchedule['frequency'] | null;
  if (freq && FREQUENCIES.includes(freq)) intent.freq = freq;

  return intent;
}

/**
 * Serialize a buy intent for a link. Returns '' when there is nothing to carry, so it
 * can be appended to any path unconditionally.
 */
export function buyIntentQuery(intent: BuyIntent): string {
  const sp = new URLSearchParams();
  if (intent.account) sp.set('account', intent.account);
  if (intent.amount) sp.set('amount', intent.amount);
  if (intent.type) sp.set('type', intent.type);
  if (intent.freq) sp.set('freq', intent.freq);
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}
