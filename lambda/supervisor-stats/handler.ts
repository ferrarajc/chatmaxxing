import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { fromZonedTime } from 'date-fns-tz';
import { docClient } from '../shared/dynamo-client';
import { jsonResponse } from '../shared/types';
import { invokeNovaMicro, parseJsonFromBedrock } from '../shared/bedrock-client';
import { DIVISIONS } from '../shared/agent-roster';
import type { WeekBucket } from '../shared/agent-history';

// Supervisor Dashboard read API. One GET route, two views:
//   GET /supervisor-stats?window=today|7d|30d|all[&division=...]            → aggregates (no LLM)
//   GET /supervisor-stats?window=...&view=insights[&refresh=1][&division=]  → AI digest/topics/themes
//
// Data = the seeded agent roster + histories (bobs-agents, fictional aggregates) BLENDED with
// real transcript rows (bobs-transcripts) attributed by agentUsername, plus callback counts.
// Read-only everywhere. Numbers never wait on the LLM; LLM failures degrade to partial payloads.

const AGENTS_TABLE = (): string => process.env.AGENTS_TABLE ?? 'bobs-agents';
const TRANSCRIPTS_TABLE = (): string => process.env.TRANSCRIPTS_TABLE ?? 'bobs-transcripts';
const CALLBACKS_TABLE = (): string => process.env.CALLBACKS_TABLE ?? 'bobs-callbacks';

const ET_ZONE = 'America/New_York';
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
// Mon–Fri business-day weights used to apportion a weekly bucket across days.
const WEEKDAY_WEIGHTS = [0.21, 0.21, 0.2, 0.2, 0.18, 0, 0]; // Mon..Sun

type WindowKey = 'today' | '7d' | '30d' | 'all';

interface AgentItem {
  agentUsername: string; name: string; division: string; title: string;
  licenses: string[]; licensed: boolean; hireDate: string; location: string;
  status: string; history: WeekBucket[];
}

interface TranscriptRow {
  transcriptId: string; clientId?: string; clientName?: string;
  transcriptType?: string; intentSummary?: string; summary?: string; acwSummary?: string;
  agentUsername?: string; agentName?: string; durationMs?: number; wrapUpCode?: string;
  messageCount?: number; savedAt?: number;
}

interface CallbackRow {
  callbackId: string; clientName?: string; scheduledTime?: string;
  status?: string; intentSummary?: string; createdAt?: string; originChannel?: string;
}

// ── Raw-table module cache (60s) ──────────────────────────────────────────────
interface RawCache { agents: AgentItem[]; transcripts: TranscriptRow[]; callbacks: CallbackRow[]; atMs: number; }
let rawCache: RawCache | null = null;
const RAW_TTL_MS = 60_000;

async function scanAll<T>(input: ConstructorParameters<typeof ScanCommand>[0]): Promise<T[]> {
  const items: T[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const res = await docClient.send(new ScanCommand({ ...input, ExclusiveStartKey: startKey }));
    for (const it of res.Items ?? []) items.push(it as T);
    startKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (startKey);
  return items;
}

async function loadRaw(): Promise<RawCache> {
  if (rawCache && Date.now() - rawCache.atMs < RAW_TTL_MS) return rawCache;
  const [agents, transcripts, callbacks] = await Promise.all([
    scanAll<AgentItem>({ TableName: AGENTS_TABLE() }),
    scanAll<TranscriptRow>({
      TableName: TRANSCRIPTS_TABLE(),
      // Metadata only — never the messages array (mirrors get-transcripts' list scan).
      ProjectionExpression: 'transcriptId, clientId, clientName, transcriptType, intentSummary, summary, acwSummary, agentUsername, agentName, durationMs, wrapUpCode, messageCount, savedAt',
    }),
    scanAll<CallbackRow>({
      TableName: CALLBACKS_TABLE(),
      ProjectionExpression: 'callbackId, clientName, scheduledTime, #s, intentSummary, createdAt, originChannel',
      ExpressionAttributeNames: { '#s': 'status' },
    }),
  ]);
  rawCache = { agents, transcripts, callbacks, atMs: Date.now() };
  return rawCache;
}

// ── Window helpers ────────────────────────────────────────────────────────────
/** YYYY-MM-DD of `ms` in Eastern Time. */
const etDateKey = (ms: number): string =>
  new Date(ms).toLocaleDateString('en-CA', { timeZone: ET_ZONE });

const etStartOfToday = (nowMs: number): number =>
  fromZonedTime(`${etDateKey(nowMs)}T00:00:00`, ET_ZONE).getTime();

function windowFromMs(key: WindowKey, nowMs: number): number {
  switch (key) {
    case 'today': return etStartOfToday(nowMs);
    case '7d': return nowMs - 7 * DAY_MS;
    case '30d': return nowMs - 30 * DAY_MS;
    case 'all': return 0;
  }
}

/** Fraction of a weekly bucket that falls inside [fromMs, nowMs], business-day weighted. */
function bucketFraction(weekStartMs: number, fromMs: number, nowMs: number): number {
  let f = 0;
  for (let i = 0; i < 7; i++) {
    const dayStart = weekStartMs + i * DAY_MS;
    if (dayStart >= fromMs && dayStart <= nowMs) f += WEEKDAY_WEIGHTS[i];
  }
  return f;
}

const weightedMedian = (pairs: Array<[number, number]>): number => {
  const sorted = pairs.filter(([, w]) => w > 0).sort((x, y) => x[0] - y[0]);
  const total = sorted.reduce((s, [, w]) => s + w, 0);
  if (!total) return 0;
  let acc = 0;
  for (const [v, w] of sorted) { acc += w; if (acc >= total / 2) return v; }
  return sorted[sorted.length - 1][0];
};

// ── Stats aggregation ─────────────────────────────────────────────────────────
interface AgentStats {
  agentUsername: string; name: string; division: string; title: string;
  licenses: string[]; licensed: boolean; hireDate: string; location: string; status: string;
  chats: number; calls: number; realCount: number;
  avgHandleMs: number; medianHandleMs: number; escalations: number; qaScore: number | null;
  topWrapUps: Array<{ code: string; count: number }>;
  /** Last 12 weekly totals (unwindowed) for the drawer sparkline/trend chart. */
  trend: Array<{ weekStart: string; chats: number; calls: number }>;
}

function buildStats(raw: RawCache, windowKey: WindowKey, division: string | undefined, nowMs: number) {
  const fromMs = windowFromMs(windowKey, nowMs);
  const agents = division ? raw.agents.filter(ag => ag.division === division) : raw.agents;
  const rosterUsernames = new Set(raw.agents.map(ag => ag.agentUsername));
  const usernameToDivision = new Map(raw.agents.map(ag => [ag.agentUsername, ag.division]));

  // Real rows in window, scoped to the division filter (unattributed rows only pass unfiltered).
  const realRows = raw.transcripts.filter(row => {
    if ((row.savedAt ?? 0) < fromMs) return false;
    if (!division) return true;
    return usernameToDivision.get(row.agentUsername ?? '') === division;
  });

  const wrapUpTotals = new Map<string, number>();
  const volumeByKey = new Map<string, { chat: number; phone: number }>();
  const granularity: 'day' | 'week' = windowKey === 'all' ? 'week' : 'day';
  const bumpVolume = (key: string, kind: 'chat' | 'phone', n: number) => {
    if (n <= 0) return;
    const e = volumeByKey.get(key) ?? { chat: 0, phone: 0 };
    e[kind] += n;
    volumeByKey.set(key, e);
  };

  const perAgent: AgentStats[] = [];
  for (const ag of agents) {
    let chats = 0, calls = 0, escalations = 0;
    const handlePairs: Array<[number, number]> = [];
    const medianPairs: Array<[number, number]> = [];
    const qaPairs: Array<[number, number]> = [];
    const wrapUps = new Map<string, number>();

    for (const b of ag.history ?? []) {
      const ws = Date.parse(`${b.weekStart}T00:00:00Z`);
      const frac = bucketFraction(ws, fromMs, nowMs);
      if (frac <= 0) continue;
      const bChats = Math.round(b.chats * frac);
      const bCalls = Math.round(b.calls * frac);
      chats += bChats; calls += bCalls;
      escalations += Math.round(b.escalations * frac);
      const n = bChats + bCalls;
      if (n > 0) {
        handlePairs.push([b.avgHandleMs, n]);
        medianPairs.push([b.medianHandleMs, n]);
        if (b.qaScore > 0) qaPairs.push([b.qaScore, n]);
        for (const [code, count] of Object.entries(b.wrapUpMix)) {
          const c = Math.round(count * frac);
          if (c > 0) wrapUps.set(code, (wrapUps.get(code) ?? 0) + c);
        }
      }
      // Volume series: spread the bucket across its business days (or bucket per week).
      if (granularity === 'week') {
        bumpVolume(b.weekStart, 'chat', bChats);
        bumpVolume(b.weekStart, 'phone', bCalls);
      } else {
        for (let i = 0; i < 7; i++) {
          const dayStart = ws + i * DAY_MS;
          if (dayStart < fromMs || dayStart > nowMs || WEEKDAY_WEIGHTS[i] === 0) continue;
          const dayFrac = WEEKDAY_WEIGHTS[i] / frac;
          bumpVolume(etDateKey(dayStart + 12 * 60 * 60 * 1000), 'chat', Math.round(bChats * dayFrac));
          bumpVolume(etDateKey(dayStart + 12 * 60 * 60 * 1000), 'phone', Math.round(bCalls * dayFrac));
        }
      }
    }

    // Layer the agent's REAL transcript rows on top.
    const myReal = realRows.filter(row => row.agentUsername === ag.agentUsername);
    for (const row of myReal) {
      const isPhone = row.transcriptType === 'phone';
      if (isPhone) calls += 1; else chats += 1;
      if (row.durationMs) { handlePairs.push([row.durationMs, 1]); medianPairs.push([row.durationMs, 1]); }
      if (row.wrapUpCode) wrapUps.set(row.wrapUpCode, (wrapUps.get(row.wrapUpCode) ?? 0) + 1);
      if (granularity === 'day') {
        bumpVolume(etDateKey(row.savedAt ?? nowMs), isPhone ? 'phone' : 'chat', 1);
      } else {
        const dow = (new Date(row.savedAt ?? nowMs).getUTCDay() + 6) % 7;
        const monday = new Date((row.savedAt ?? nowMs) - dow * DAY_MS).toISOString().slice(0, 10);
        bumpVolume(monday, isPhone ? 'phone' : 'chat', 1);
      }
    }

    for (const [code, count] of wrapUps) wrapUpTotals.set(code, (wrapUpTotals.get(code) ?? 0) + count);

    const totalN = handlePairs.reduce((s, [, w]) => s + w, 0);
    const avgHandleMs = totalN ? Math.round(handlePairs.reduce((s, [v, w]) => s + v * w, 0) / totalN) : 0;
    const last12 = (ag.history ?? []).slice(-12).map(b => ({ weekStart: b.weekStart, chats: b.chats, calls: b.calls }));

    perAgent.push({
      agentUsername: ag.agentUsername, name: ag.name, division: ag.division, title: ag.title,
      licenses: ag.licenses ?? [], licensed: !!ag.licensed, hireDate: ag.hireDate,
      location: ag.location, status: ag.status,
      chats, calls, realCount: myReal.length,
      avgHandleMs, medianHandleMs: weightedMedian(medianPairs), escalations,
      qaScore: qaPairs.length
        ? Math.round(qaPairs.reduce((s, [v, w]) => s + v * w, 0) / qaPairs.reduce((s, [, w]) => s + w, 0))
        : null,
      topWrapUps: [...wrapUps.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5)
        .map(([code, count]) => ({ code, count })),
      trend: last12,
    });
  }

  // Real rows whose agentUsername isn't in the roster (legacy/pre-tracking rows).
  const unattributed = realRows.filter(row => !rosterUsernames.has(row.agentUsername ?? ''));
  for (const row of unattributed) {
    const isPhone = row.transcriptType === 'phone';
    if (row.wrapUpCode) wrapUpTotals.set(row.wrapUpCode, (wrapUpTotals.get(row.wrapUpCode) ?? 0) + 1);
    if (granularity === 'day') bumpVolume(etDateKey(row.savedAt ?? nowMs), isPhone ? 'phone' : 'chat', 1);
    else {
      const dow = (new Date(row.savedAt ?? nowMs).getUTCDay() + 6) % 7;
      bumpVolume(new Date((row.savedAt ?? nowMs) - dow * DAY_MS).toISOString().slice(0, 10), isPhone ? 'phone' : 'chat', 1);
    }
  }

  perAgent.sort((x, y) => (y.chats + y.calls) - (x.chats + x.calls));

  const chats = perAgent.reduce((s, ag) => s + ag.chats, 0)
    + unattributed.filter(r => r.transcriptType !== 'phone').length;
  const phones = perAgent.reduce((s, ag) => s + ag.calls, 0)
    + unattributed.filter(r => r.transcriptType === 'phone').length;
  const handlePairsAll: Array<[number, number]> = perAgent
    .filter(ag => ag.avgHandleMs > 0).map(ag => [ag.avgHandleMs, ag.chats + ag.calls]);
  for (const row of unattributed) if (row.durationMs) handlePairsAll.push([row.durationMs, 1]);
  const totalN = handlePairsAll.reduce((s, [, w]) => s + w, 0);

  const nowIso = new Date(nowMs).toISOString();
  const upcoming = raw.callbacks
    .filter(cb => cb.status === 'scheduled' && (cb.scheduledTime ?? '') >= nowIso)
    .sort((x, y) => (x.scheduledTime ?? '').localeCompare(y.scheduledTime ?? ''));
  const completedInWindow = raw.callbacks.filter(cb =>
    cb.status === 'completed' && Date.parse(cb.createdAt ?? '') >= fromMs).length;

  const volume = [...volumeByKey.entries()].sort((x, y) => x[0].localeCompare(y[0]))
    .map(([label, v]) => ({ label, chat: v.chat, phone: v.phone }));

  const divisionRollups = (division ? DIVISIONS.filter(d => d === division) : DIVISIONS).map(d => {
    const members = perAgent.filter(ag => ag.division === d);
    const conv = members.reduce((s, ag) => s + ag.chats + ag.calls, 0);
    const pairs: Array<[number, number]> = members
      .filter(ag => ag.avgHandleMs > 0).map(ag => [ag.avgHandleMs, ag.chats + ag.calls]);
    const n = pairs.reduce((s, [, w]) => s + w, 0);
    return {
      division: d,
      headcount: members.length,
      licensedCount: members.filter(ag => ag.licensed).length,
      conversations: conv,
      avgHandleMs: n ? Math.round(pairs.reduce((s, [v, w]) => s + v * w, 0) / n) : 0,
    };
  });

  return {
    window: { key: windowKey, fromMs, toMs: nowMs },
    division: division ?? null,
    totals: {
      conversations: chats + phones,
      chats,
      phones,
      avgHandleMs: totalN ? Math.round(handlePairsAll.reduce((s, [v, w]) => s + v * w, 0) / totalN) : 0,
      medianHandleMs: weightedMedian(perAgent.map(ag => [ag.medianHandleMs, ag.chats + ag.calls])),
      escalations: perAgent.reduce((s, ag) => s + ag.escalations, 0),
      activeAgents: perAgent.filter(ag => ag.chats + ag.calls > 0).length,
      headcount: agents.length,
      realConversations: realRows.length,
      callbacksUpcoming: upcoming.length,
      callbacksCompleted: completedInWindow,
      nextCallback: upcoming[0]
        ? { scheduledTime: upcoming[0].scheduledTime, clientName: upcoming[0].clientName, intentSummary: upcoming[0].intentSummary }
        : null,
    },
    channelMix: { chat: chats, phone: phones },
    wrapUpMix: [...wrapUpTotals.entries()].sort((x, y) => y[1] - x[1])
      .map(([code, count]) => ({ code, count })),
    volume: { granularity, points: volume },
    divisions: divisionRollups,
    agents: perAgent,
    recent: realRows
      .sort((x, y) => (y.savedAt ?? 0) - (x.savedAt ?? 0)).slice(0, 50)
      .map(row => ({
        transcriptId: row.transcriptId, clientName: row.clientName,
        transcriptType: row.transcriptType ?? 'chat', intentSummary: row.intentSummary,
        wrapUpCode: row.wrapUpCode ?? null, agentName: row.agentName ?? null,
        durationMs: row.durationMs ?? null, savedAt: row.savedAt ?? null,
      })),
    note: 'Bot-contained chats are not recorded, so conversation figures cover escalated chats and phone calls only. Workforce performance history is demo-seeded; live conversations are layered onto their agents in real time.',
  };
}

type StatsPayload = ReturnType<typeof buildStats>;

// ── AI insights (2 LLM calls, cached 10 min per window+division) ─────────────
interface InsightsPayload {
  digest: string | null;
  topics: Array<{ theme: string; count: number; trend: string; example: string }>;
  agentThemes: Record<string, string>;
  generatedAtMs: number;
  basedOnRealRows: number;
}
const insightsCache = new Map<string, { payload: InsightsPayload; atMs: number }>();
const INSIGHTS_TTL_MS = 10 * 60_000;

function metricsBlock(stats: StatsPayload): string {
  const t = stats.totals;
  const div = stats.divisions.map(d =>
    `${d.division}: ${d.conversations} conversations, ${d.headcount} agents (${d.licensedCount} licensed), avg handle ${Math.round(d.avgHandleMs / 60000)}m`).join('\n');
  const wrap = stats.wrapUpMix.slice(0, 10).map(w => `${w.code}: ${w.count}`).join(', ');
  return `Window: ${stats.window.key}${stats.division ? ` (division: ${stats.division})` : ''}
Totals: ${t.conversations} conversations (${t.chats} chats, ${t.phones} calls), avg handle ${Math.round(t.avgHandleMs / 60000)}m, median ${Math.round(t.medianHandleMs / 60000)}m, ${t.activeAgents}/${t.headcount} agents active, ${t.escalations} escalations, ${t.callbacksUpcoming} callbacks upcoming.
By division:\n${div}
Top wrap-up codes: ${wrap}`;
}

async function buildInsights(raw: RawCache, stats: StatsPayload, nowMs: number): Promise<InsightsPayload> {
  const fromMs = stats.window.fromMs;
  const realRows = raw.transcripts
    .filter(row => (row.savedAt ?? 0) >= fromMs)
    .sort((x, y) => (y.savedAt ?? 0) - (x.savedAt ?? 0))
    .slice(0, 150);

  const convoLines = realRows.map(row =>
    `${etDateKey(row.savedAt ?? nowMs)} | ${row.transcriptType ?? 'chat'} | ${row.agentName ?? 'unassigned'} | ${row.wrapUpCode ?? '-'} | ${(row.intentSummary ?? row.summary ?? '').slice(0, 140)}`)
    .join('\n').slice(0, 12_000);

  const payload: InsightsPayload = { digest: null, topics: [], agentThemes: {}, generatedAtMs: nowMs, basedOnRealRows: realRows.length };

  // Call 1 — digest + emerging topics.
  try {
    const raw1 = await invokeNovaMicro(
      `CONTACT-CENTER METRICS (authoritative — quote these numbers, do not invent others):\n${metricsBlock(stats)}\n\nRECENT CONVERSATIONS (one per line: date | channel | agent | wrap-up | client intent):\n${convoLines || '(none in window)'}`,
      `You are an operations analyst for Bob's Mutual Funds' contact center, writing for a supervisor.
Return JSON: {"digest": string, "topics": [{"theme": string, "count": number, "trend": "rising"|"steady"|"new", "example": string}]}.
- digest: 3–5 sentences in a supervisor's voice — volume shape, dominant drivers, anything unusual, and exactly one concrete suggested action. Quote only numbers from the METRICS block.
- topics: 3–6 plain-English clusters of the conversation intents with honest counts from the lines given (count the lines; if no conversation lines, return []).`,
      700, { fn: 'supervisor-stats', scope: 'digest' }, true,
    );
    const parsed = parseJsonFromBedrock<{ digest?: string; topics?: InsightsPayload['topics'] }>(raw1);
    payload.digest = parsed.digest ?? null;
    payload.topics = Array.isArray(parsed.topics) ? parsed.topics.slice(0, 6) : [];
  } catch (err) {
    console.error('supervisor-stats digest failed', err);
  }

  // Call 2 — per-agent observed themes for the top 15 agents by window volume.
  try {
    const top = stats.agents.filter(ag => ag.chats + ag.calls > 0).slice(0, 15);
    if (top.length) {
      const sections = top.map(ag => {
        const realLines = raw.transcripts
          .filter(row => row.agentUsername === ag.agentUsername && (row.savedAt ?? 0) >= fromMs)
          .slice(0, 5)
          .map(row => `- ${(row.acwSummary ?? row.summary ?? row.intentSummary ?? '').slice(0, 160)}`)
          .filter(line => line.length > 4)
          .join('\n');
        return `### ${ag.agentUsername} (${ag.name}, ${ag.division}, ${ag.title})
Stats: ${ag.chats} chats + ${ag.calls} calls, avg handle ${Math.round(ag.avgHandleMs / 60000)}m, top wrap-ups ${ag.topWrapUps.map(w => w.code).join('/') || 'n/a'}, QA ${ag.qaScore ?? 'n/a'}${realLines ? `\nRecent conversation summaries:\n${realLines}` : ''}`;
      }).join('\n\n').slice(0, 12_000);

      const raw2 = await invokeNovaMicro(
        sections,
        `You are a contact-center QA analyst. For each agent section, write ONE observational sentence for their supervisor (a strength or notable pattern grounded in their stats/summaries — these are post-chat summaries, not stored coaching). Return JSON: {"agentThemes": {"<agentUsername>": "<sentence>"}}. Include every agent listed.`,
        700, { fn: 'supervisor-stats', scope: 'agent-themes' }, true,
      );
      const parsed = parseJsonFromBedrock<{ agentThemes?: Record<string, string> }>(raw2);
      if (parsed.agentThemes && typeof parsed.agentThemes === 'object') payload.agentThemes = parsed.agentThemes;
    }
  } catch (err) {
    console.error('supervisor-stats agent-themes failed', err);
  }

  return payload;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const params = event.queryStringParameters ?? {};
    const windowKey: WindowKey = (['today', '7d', '30d', 'all'] as const)
      .includes(params.window as WindowKey) ? (params.window as WindowKey) : 'all';
    const division = params.division && DIVISIONS.includes(params.division as (typeof DIVISIONS)[number])
      ? params.division : undefined;
    const nowMs = Date.now();

    const raw = await loadRaw();
    if (!raw.agents.length) {
      return jsonResponse(200, { error: 'not-seeded', hint: 'Run GET /reset-agents?key=... to seed the agent roster.' });
    }
    const stats = buildStats(raw, windowKey, division, nowMs);

    if (params.view === 'insights') {
      const cacheKey = `${windowKey}|${division ?? '*'}`;
      const hit = insightsCache.get(cacheKey);
      if (hit && nowMs - hit.atMs < INSIGHTS_TTL_MS && params.refresh !== '1') {
        return jsonResponse(200, hit.payload);
      }
      const payload = await buildInsights(raw, stats, nowMs);
      insightsCache.set(cacheKey, { payload, atMs: nowMs });
      return jsonResponse(200, payload);
    }

    return jsonResponse(200, stats);
  } catch (err) {
    console.error('supervisor-stats error', err);
    return jsonResponse(500, { error: 'Internal error' });
  }
};
