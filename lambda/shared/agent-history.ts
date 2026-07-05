// Deterministic per-agent performance-history generator for the Supervisor Dashboard.
//
// Produces ~18 months of weekly aggregate buckets per agent so the dashboard's metrics,
// trends, and AI insights demonstrate real-world contact-center scale. Pure and
// deterministic (mulberry32 PRNG seeded from the agent username — same pattern as
// transaction-history.ts) so a re-seed is idempotent and demo numbers are stable.
//
// These are AGGREGATES stored on the bobs-agents item — deliberately NOT fabricated
// transcript rows, so bobs-transcripts and every existing surface stay untouched.

import { AgentDef, Division } from './agent-roster';

export interface WeekBucket {
  weekStart: string; // YYYY-MM-DD (Monday, UTC)
  chats: number;
  calls: number;
  avgHandleMs: number;
  medianHandleMs: number;
  wrapUpMix: Record<string, number>; // wrap-up code -> conversation count
  escalations: number;
  qaScore: number; // 0–100 QA sampling score
}

// ── Division shape profiles ───────────────────────────────────────────────────
// weeklyVolume = combined chats+calls for an average full-productivity agent;
// chatShare splits it; handle times reflect the work (trades are quick, RMD
// walk-throughs are long); wrapUpPool uses the real generate-acw taxonomy so the
// donut and the live data share a vocabulary.
interface DivisionProfile {
  weeklyVolume: [number, number]; // min, max
  chatShare: number;              // 0..1 of volume that is chat
  handleMs: [number, number];     // avg handle-time range
  wrapUpPool: Array<[string, number]>; // code, weight
}

const PROFILES: Record<Division, DivisionProfile> = {
  'Client Services': {
    weeklyVolume: [55, 85], chatShare: 0.9, handleMs: [4.5 * 60_000, 8 * 60_000],
    wrapUpPool: [
      ['Account Inquiry', 5], ['General Information', 4], ['Address Update', 3],
      ['Password Reset', 3], ['Technical Issue', 2], ['Beneficiary Change', 2],
      ['Access Authorization', 2], ['Contribution Question', 1],
    ],
  },
  'Retirement & IRA Services': {
    weeklyVolume: [30, 50], chatShare: 0.6, handleMs: [9 * 60_000, 16 * 60_000],
    wrapUpPool: [
      ['RMD Calculation', 5], ['IRA Inquiry', 4], ['Retirement Planning', 3],
      ['Distribution Request', 3], ['Contribution Question', 2],
      ['Systematic Withdrawal', 2], ['SEP-IRA Question', 1], ['Tax Information', 1],
    ],
  },
  'Private Client Group': {
    weeklyVolume: [18, 30], chatShare: 0.45, handleMs: [14 * 60_000, 24 * 60_000],
    wrapUpPool: [
      ['Portfolio Review', 5], ['Estate Planning', 3], ['Rebalancing Discussion', 3],
      ['Performance Question', 2], ['Referral', 1], ['Account Inquiry', 1],
    ],
  },
  'Trading & Brokerage Services': {
    weeklyVolume: [45, 70], chatShare: 0.55, handleMs: [3.5 * 60_000, 6.5 * 60_000],
    wrapUpPool: [
      ['Fund Switch', 5], ['Fund Comparison', 3], ['Withdrawal Processing', 3],
      ['Transfer Request', 2], ['Market Question', 2], ['Performance Question', 1],
    ],
  },
  'Advice & Planning': {
    weeklyVolume: [15, 26], chatShare: 0.4, handleMs: [18 * 60_000, 30 * 60_000],
    wrapUpPool: [
      ['Retirement Planning', 5], ['Investment Advice', 4], ['Portfolio Review', 3],
      ['Rebalancing Discussion', 2], ['Fund Comparison', 1], ['Tax Information', 1],
    ],
  },
  'Onboarding & Transfers': {
    weeklyVolume: [35, 55], chatShare: 0.7, handleMs: [6 * 60_000, 11 * 60_000],
    wrapUpPool: [
      ['New Account', 5], ['Transfer Request', 4], ['Access Authorization', 2],
      ['Address Update', 2], ['Account Inquiry', 1],
    ],
  },
  'Phone & Callback Desk': {
    weeklyVolume: [40, 65], chatShare: 0.08, handleMs: [5.5 * 60_000, 10 * 60_000],
    wrapUpPool: [
      ['Account Inquiry', 4], ['Distribution Request', 3], ['General Information', 3],
      ['RMD Calculation', 2], ['Technical Issue', 2], ['Withdrawal Processing', 2],
    ],
  },
};

// Real Connect agents get modest synthetic baselines so live transcript rows layered
// on top read as part of their normal workload rather than as outliers.
const REAL_AGENT_DAMPING: Record<string, number> = {
  'john-ferrara': 0.55, 'jessica-le': 0.7, 'leah-marchesani': 0.7,
  'andrew-clemens': 0.7, 'savannah-bower': 0.7, 'steve-dodson': 0.7,
  'tyler-ryan': 0.7, 'jen-collopy': 0.7, 'jason-lewin': 0.7,
};

// ── Deterministic PRNG (mulberry32 seeded from a string hash) ────────────────
function makeRng(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** UTC Monday 00:00 of the week containing `ms`. */
export function mondayOf(ms: number): number {
  const d = new Date(ms);
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow);
}

const isoDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Seasonal volume multiplier: tax-season lift Jan–Apr, December RMD rush, summer lull. */
function seasonFactor(monthIdx0: number, division: Division): number {
  let f = 1;
  if (monthIdx0 <= 3) f *= 1.15; // Jan–Apr tax season
  if (monthIdx0 === 6 || monthIdx0 === 7) f *= 0.85; // Jul–Aug lull
  if (monthIdx0 === 11) f *= division === 'Retirement & IRA Services' ? 1.35 : 1.05; // Dec RMD rush
  return f;
}

export const HISTORY_WEEKS = 78; // ~18 months

/**
 * Generate the agent's weekly history, newest bucket = the CURRENT week (so the
 * "today"/"7d" windows always intersect data). Buckets before the agent's hire date
 * are omitted; ~4 near-zero vacation weeks a year; 'leave' agents go quiet for the
 * most recent 6 weeks.
 */
export function generateAgentHistory(agent: AgentDef, nowMs = Date.now()): WeekBucket[] {
  const profile = PROFILES[agent.division];
  const rng = makeRng(`bobs-agent-${agent.agentUsername}`);

  // Stable per-agent character: overall skill/productivity + speed vs the division norm.
  const productivity = (0.75 + rng() * 0.5) * (REAL_AGENT_DAMPING[agent.agentUsername] ?? 1);
  const speed = 0.85 + rng() * 0.3;           // <1 = faster than division average
  const qaBase = 82 + rng() * 14;             // 82–96 baseline QA
  const hireMs = Date.parse(`${agent.hireDate}T00:00:00Z`);

  const currentMonday = mondayOf(nowMs);
  const buckets: WeekBucket[] = [];

  for (let w = HISTORY_WEEKS - 1; w >= 0; w--) {
    const weekStartMs = currentMonday - w * WEEK_MS;
    if (weekStartMs + WEEK_MS <= hireMs) { void rng(); void rng(); continue; } // pre-hire (burn rng for stability)

    const monthIdx0 = new Date(weekStartMs).getUTCMonth();
    const vacation = rng() < 4 / 52;
    const onLeave = agent.status === 'leave' && w < 6;

    // Ramp-up: first 8 weeks after hire scale from 30% to full.
    const weeksSinceHire = Math.max(0, (weekStartMs - hireMs) / WEEK_MS);
    const ramp = Math.min(1, 0.3 + weeksSinceHire / 8 * 0.7);

    const [vMin, vMax] = profile.weeklyVolume;
    let volume = (vMin + rng() * (vMax - vMin)) * productivity * ramp * seasonFactor(monthIdx0, agent.division);
    if (vacation) volume *= 0.1;
    if (onLeave) volume = 0;
    const total = Math.max(0, Math.round(volume));

    const chats = Math.round(total * profile.chatShare * (0.9 + rng() * 0.2));
    const calls = Math.max(0, total - chats);

    const [hMin, hMax] = profile.handleMs;
    const avgHandleMs = Math.round((hMin + rng() * (hMax - hMin)) * speed);
    const medianHandleMs = Math.round(avgHandleMs * (0.8 + rng() * 0.15)); // right-skewed distribution

    // Spread the week's conversations across the division's wrap-up pool.
    const wrapUpMix: Record<string, number> = {};
    if (total > 0) {
      const weightSum = profile.wrapUpPool.reduce((s, [, wt]) => s + wt, 0);
      let assigned = 0;
      for (const [code, wt] of profile.wrapUpPool) {
        const n = Math.round(total * (wt / weightSum) * (0.7 + rng() * 0.6));
        if (n > 0) { wrapUpMix[code] = n; assigned += n; }
      }
      // Keep the mix summing to the total (dump remainder on the top code).
      const topCode = profile.wrapUpPool[0][0];
      const diff = total - assigned;
      wrapUpMix[topCode] = Math.max(0, (wrapUpMix[topCode] ?? 0) + diff);
      if (wrapUpMix[topCode] === 0) delete wrapUpMix[topCode];
    }

    const escalations = total > 0 ? Math.round(total * (0.02 + rng() * 0.05)) : 0;
    const qaScore = total > 0 ? Math.round(Math.min(100, Math.max(60, qaBase + (rng() - 0.5) * 8))) : 0;

    buckets.push({
      weekStart: isoDate(weekStartMs),
      chats, calls, avgHandleMs, medianHandleMs, wrapUpMix, escalations, qaScore,
    });
  }
  return buckets;
}
