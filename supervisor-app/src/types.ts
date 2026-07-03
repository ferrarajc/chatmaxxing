// Payload shapes returned by the supervisor-stats Lambda (lambda/supervisor-stats/handler.ts).

export type WindowKey = 'today' | '7d' | '30d' | 'all';

export const WINDOW_LABELS: Record<WindowKey, string> = {
  today: 'Today', '7d': '7 days', '30d': '30 days', all: 'All time',
};

export interface AgentStats {
  agentUsername: string;
  name: string;
  division: string;
  title: string;
  licenses: string[];
  licensed: boolean;
  hireDate: string;
  location: string;
  status: string;
  chats: number;
  calls: number;
  realCount: number;
  avgHandleMs: number;
  medianHandleMs: number;
  escalations: number;
  qaScore: number | null;
  topWrapUps: Array<{ code: string; count: number }>;
  trend: Array<{ weekStart: string; chats: number; calls: number }>;
}

export interface DivisionRollup {
  division: string;
  headcount: number;
  licensedCount: number;
  conversations: number;
  avgHandleMs: number;
}

export interface RecentRow {
  transcriptId: string;
  clientName?: string;
  transcriptType: string;
  intentSummary?: string;
  wrapUpCode: string | null;
  agentName: string | null;
  durationMs: number | null;
  savedAt: number | null;
}

export interface StatsPayload {
  window: { key: WindowKey; fromMs: number; toMs: number };
  division: string | null;
  totals: {
    conversations: number;
    chats: number;
    phones: number;
    avgHandleMs: number;
    medianHandleMs: number;
    escalations: number;
    activeAgents: number;
    headcount: number;
    realConversations: number;
    callbacksUpcoming: number;
    callbacksCompleted: number;
    nextCallback: { scheduledTime?: string; clientName?: string; intentSummary?: string } | null;
  };
  channelMix: { chat: number; phone: number };
  wrapUpMix: Array<{ code: string; count: number }>;
  volume: { granularity: 'day' | 'week'; points: Array<{ label: string; chat: number; phone: number }> };
  divisions: DivisionRollup[];
  agents: AgentStats[];
  recent: RecentRow[];
  note: string;
  error?: string;
}

export interface InsightsPayload {
  digest: string | null;
  topics: Array<{ theme: string; count: number; trend: string; example: string }>;
  agentThemes: Record<string, string>;
  generatedAtMs: number;
  basedOnRealRows: number;
}

export const DIVISIONS = [
  'Client Services',
  'Retirement & IRA Services',
  'Private Client Group',
  'Trading & Brokerage Services',
  'Advice & Planning',
  'Onboarding & Transfers',
  'Phone & Callback Desk',
];
