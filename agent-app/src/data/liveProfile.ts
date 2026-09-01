// ── Live account figures for the agent app ───────────────────────────────────
//
// `clientProfiles.ts` is a hardcoded literal, and it is what the agent app posted to
// /autopilot-turn on EVERY turn and rendered in the agent's own client-context panel.
// Nothing ever refreshed it. So a task expert was handed the client's positions read
// live from DynamoDB alongside balances frozen at seed time, and told a client
// "$67,890 in total in your Taxable Account" when the table said $68,890 — the
// difference being a purchase they had made minutes earlier in that same chat.
//
// This fetches the real accounts once per client and merges them over the literal.
// `intents`, `pronouns` and `recentChatHistory` exist ONLY in the literal (they are not
// in DynamoDB), so they are preserved.
//
// The Lambda ALSO overrides balances server-side and does not trust what we send —
// belt and braces, deliberately. This layer exists so the human agent sees the same
// numbers the model does.

import { post } from '../api/client';
import { CLIENT_PROFILES, DEFAULT_PROFILE, type ClientProfile } from './clientProfiles';

type Account = ClientProfile['accounts'][number];

/** clientId → live-merged profile. Populated on first use, then reused. */
const cache = new Map<string, ClientProfile>();
const inflight = new Map<string, Promise<ClientProfile>>();

/** The static literal, unchanged — the fallback whenever the fetch has not landed. */
export function staticProfile(clientId: string): ClientProfile {
  return CLIENT_PROFILES[clientId] ?? DEFAULT_PROFILE;
}

/** Best profile available RIGHT NOW, synchronously. Never blocks a render or a send. */
export function currentProfile(clientId: string): ClientProfile {
  return cache.get(clientId) ?? staticProfile(clientId);
}

/**
 * Fetch the live accounts and cache the merged profile.
 *
 * Resolves to the static profile on any failure: a stale balance in the agent's side
 * panel is a far smaller problem than a chat that will not start, and the Lambda
 * refuses to quote figures it could not read anyway.
 */
export function loadLiveProfile(clientId: string): Promise<ClientProfile> {
  const cached = cache.get(clientId);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(clientId);
  if (pending) return pending;

  const req = post<{ accounts?: Account[]; totalBalance?: number | null }>(
    '/client-data', { action: 'get-all', clientId },
  )
    .then(data => {
      const base = staticProfile(clientId);
      if (!data.accounts?.length) return base;
      const merged: ClientProfile = {
        ...base,
        accounts: data.accounts,
        totalBalance: typeof data.totalBalance === 'number'
          ? data.totalBalance
          : data.accounts.reduce((sum, a) => sum + (a.balance ?? 0), 0),
      };
      cache.set(clientId, merged);
      return merged;
    })
    .catch(() => staticProfile(clientId))
    .finally(() => inflight.delete(clientId));

  inflight.set(clientId, req);
  return req;
}

/** Drop a cached profile so the next read re-fetches — e.g. after a submitted action. */
export function invalidateLiveProfile(clientId: string): void {
  cache.delete(clientId);
}
