import { Persona } from '../../data/personas';

// Derive a small on-screen card to show while Bob answers, straight from the signed-in
// client's real data (no backend, no LLM — so the visual is instant and accurate). Returns
// null when the question doesn't map to a card; Bob still answers out loud either way.

export type VoiceCard =
  | { kind: 'balance'; total: number; accounts: { type: string; balance: number }[] }
  | { kind: 'allocation'; slices: { name: string; value: number }[] }
  | { kind: 'holding'; label: string; name: string; ticker: string; change: number; value: number };

export function deriveCard(intent: string, p: Persona): VoiceCard | null {
  const q = intent.toLowerCase();

  if (/balance|how much|net worth|worth|total|do i have/.test(q)) {
    return {
      kind: 'balance',
      total: p.totalBalance,
      accounts: p.accounts.map(a => ({ type: a.type, balance: a.balance })),
    };
  }

  // Spotlight a single holding: by daily change for "best/top performer", by value for "biggest".
  const spotlight = /best|top|winning|performer|gain|grew|up the most/.test(q) ? 'change'
    : /biggest|largest/.test(q) ? 'value'
    : null;
  if (spotlight) {
    if (!p.holdings.length) return null;
    const sorted = [...p.holdings].sort((a, b) =>
      spotlight === 'value' ? b.value - a.value : (b.change ?? 0) - (a.change ?? 0));
    const top = sorted[0];
    return {
      kind: 'holding',
      label: spotlight === 'value' ? 'Your biggest holding' : 'Top performer today',
      name: top.name, ticker: top.ticker, change: top.change ?? 0, value: top.value,
    };
  }

  if (/portfolio|holding|allocation|doing|mix|diversif|invest|breakdown/.test(q)) {
    if (!p.holdings.length) return null;
    const byTicker = new Map<string, { name: string; value: number }>();
    for (const h of p.holdings) {
      const e = byTicker.get(h.ticker) ?? { name: h.name, value: 0 };
      e.value += h.value;
      byTicker.set(h.ticker, e);
    }
    const slices = [...byTicker.values()].sort((a, b) => b.value - a.value);
    return { kind: 'allocation', slices };
  }

  return null;
}
