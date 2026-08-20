import { useEffect, useState } from 'react';
import { post } from '../api/client';

// Mirrors the payload of lambda/shared/contributions.ts. The numbers are computed
// server-side on purpose: the annual IRA limit applies across ALL of a client's IRAs,
// so this is a portfolio-wide figure that the account page, the chatbot, and the phone
// cockpit must all agree on. Nothing here recomputes it.

export interface AccountContribution {
  accountId: string;
  type: string;
  amount: number;
}

export interface ContributionYear {
  taxYear: number;
  deadline: string;
  stillOpen: boolean;
  ageAtYearEnd: number | null;
  baseLimit: number;
  catchUp: number;
  limit: number;
  contributed: number;
  scheduled: number;
  remaining: number;
  overLimit: boolean;
  byAccount: AccountContribution[];
  limitEstimated: boolean;
}

export interface SepBucket {
  taxYear: number;
  deadline: string;
  stillOpen: boolean;
  contributed: number;
  scheduled: number;
  dcCap: number;
  byAccount: AccountContribution[];
}

export interface ContributionSummary {
  asOf: string;
  hasAggregateIra: boolean;
  years: ContributionYear[];
  sep: SepBucket[];
  assumptions: string[];
}

/**
 * Fetch the client's IRA contribution summary.
 *
 * @param enabled  skip the request entirely for non-IRA accounts.
 * @param asOf     optional YYYY-MM-DD override, for exercising the prior-tax-year
 *                 panel outside the January–April window when it is the only path
 *                 that renders.
 */
export function useContributions(
  clientId: string,
  enabled: boolean,
  asOf?: string,
): { summary: ContributionSummary | null; loading: boolean; error: string | null } {
  const [summary, setSummary] = useState<ContributionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !clientId) { setSummary(null); return; }
    let active = true;
    setLoading(true);
    setError(null);
    post<ContributionSummary>('/client-data', {
      action: 'get-contributions',
      clientId,
      data: asOf ? { asOf } : {},
    })
      .then(res => { if (active) setSummary(res); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [clientId, enabled, asOf]);

  return { summary, loading, error };
}
