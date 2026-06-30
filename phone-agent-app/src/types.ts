// Mirrors the dossier written by lambda/prep-callback and served by lambda/agent-callbacks.

export interface Finding { point: string; detail: string; source?: string }
export interface OpenItem { question: string; why: string }

/** The interaction that precipitated the callback, reviewable via the cockpit's flipper. */
export type TranscriptChannel = 'chatbot' | 'escalated' | 'ivr';
export type TranscriptSpeaker = 'client' | 'bob' | 'agent' | 'ivr' | 'system';
export interface TranscriptMessage {
  speaker: TranscriptSpeaker;
  text: string;
  highlights?: string[];          // exact substrings to mark — the client's intent / material parameters
}
export interface OriginTranscript {
  channel: TranscriptChannel;
  title: string;                 // e.g. "Web chat with Bob · earlier today"
  messages: TranscriptMessage[];
}

/** The client's objective, shown large at the very top of the cockpit. */
export interface IntentBrief {
  headline: string;        // ≤18 words, single sentence, MUST start with the client's first name
  detail?: string[];       // optional extra germane facts about the ask (omitted when there's nothing more)
}

/**
 * A guided call script the agent drives. After the (UI-composed) greeting + intent confirmation,
 * the agent walks `steps`: a `say` line is read aloud; an `ask` step presents selector buttons and
 * reveals the chosen answer branch. Branches nest their own steps inline — no goto IDs — so the tree
 * is always self-consistent.
 */
export type ScriptStep =
  | { kind: 'say'; text: string }
  | { kind: 'ask'; text: string; options: ScriptBranch[] };

export interface ScriptBranch { label: string; then: ScriptStep[] }

export interface GuidedScript {
  confirmAsk: string;      // second-person clause completing "…you want ___", e.g. "to know your 2026 RMD deadline"
  steps: ScriptStep[];     // walked once the client confirms the ask
  points?: string[];       // open-ended points/questions to cover (complex asks, or a safety net)
}

export interface Dossier {
  topic: string;
  intent: IntentBrief;
  research: {
    summary: string;
    findings: Finding[];
    answeredFully: boolean;
    openItems: OpenItem[];
  };
  coaching: string[];
  guidedScript: GuidedScript;
  originTranscript?: OriginTranscript;   // the chat / escalation / IVR that led to this callback
  /** Legacy flat script — kept optional so records prepped before the guided-script upgrade still type-check. */
  script?: { opening: string; talkingPoints: string[] };
  resources: { id: string; title: string; url: string }[];
  clientSnapshot: {
    name: string;
    totalBalance: number;
    accountsSummary: string;
    riskProfile?: string;
    memberSince?: string;
    accountCount?: number;
    timeHorizon?: string;
    investmentExperience?: string;
  };
  generatedAt: string;
}

/** Light row from the `list` action (board cards). */
export interface CallbackListItem {
  callbackId: string;
  clientId: string;
  clientName: string;
  intentSummary: string;
  scheduledTime: string;
  phoneNumber: string;
  dossierStatus: string;          // 'researching' | 'ready'
  answeredFully: boolean | null;
}

/** Full record from the `get` action (incl. dossier). */
export interface CallbackFull extends CallbackListItem {
  dossier?: Dossier;
}
