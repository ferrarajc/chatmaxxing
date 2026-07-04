export type AutopilotScope = 'get-intent' | 'researching' | 'callback' | 'idle-check' | 'full-auto';

export const AUTOPILOT_SCOPE_LABELS: Record<AutopilotScope, string> = {
  'get-intent': 'Get intent',
  'researching': 'Researching',
  'callback': 'Callback',
  'idle-check': 'Idle check',
  'full-auto': 'Full auto',
};

export interface ChatMessage {
  id: string;
  role: 'CUSTOMER' | 'AGENT' | 'BOT' | 'SYSTEM';
  content: string;
  timestamp: number;
}

export interface Resource {
  id: string;
  title: string;
  url: string;
}

/** One entry in the per-conversation suggested-reply history. */
export interface Suggestion {
  /** Stable id — used to attach async "Change to" options and to find the entry after paging. */
  id: string;
  /** Current (possibly edited) text — what's shown in the box. */
  text: string;
  /** The text as first authored — for edit detection in telemetry. */
  originalText: string;
  /** How this entry was produced. */
  source: 'greeting' | 'nbr' | 'change-to' | 'magic';
  /** If source === 'change-to', the "Change to" direction the agent picked. */
  changeDirection?: string;
  /** If source === 'magic', the restyle direction the agent picked (canned or custom). */
  magicStyle?: string;
  /** Cached "Change to" alternatives; null = not generated yet. */
  changeOptions: string[] | null;
  /** True while this entry's "Change to" options are being generated. */
  changeOptionsLoading: boolean;
}

export interface ACWData {
  wrapUpCode: string;
  coaching: { positive: string; bullets: string[] };
  summary: string;
  wrapUpCodes?: string[];
}

export interface ContactSlot {
  contactId: string;
  clientId: string;
  clientName: string;
  intentSummary: string;
  intentGreeting: string;
  status: 'incoming' | 'active' | 'ended' | 'acw';
  messages: ChatMessage[];
  /** Active autopilot scope; null = off */
  autopilotScope: AutopilotScope | null;
  /** AI-suggested scope shown in header in black, icon default state */
  suggestedScope: AutopilotScope | null;
  /** true for 100 ms on autopilot exit — triggers yellow flash */
  autopilotFlash: boolean;
  /** Message staged for send during autopilot delay — shown in AI panel */
  autopilotPending: string | null;
  /** True while autopilot progression is paused (send countdown frozen, not exited). */
  autopilotPaused: boolean;
  /** Absolute epoch-ms deadline the current pending send counts down to; null when
   *  no send is pending or while paused. Drives the visible countdown timer. */
  autopilotSendAt: number | null;
  /** Remaining ms captured at the moment of pause, frozen until resume; null while running. */
  autopilotPausedRemainingMs: number | null;
  /** Human-readable reason for last autopilot exit; null while autopilot is active or never ran */
  autopilotExitMessage: string | null;
  /** Currently DISPLAYED suggested reply — a mirror of suggestionHistory[suggestionIndex]
   *  (kept in sync by the suggestion store actions), read by FocusingDesktop, autopilot
   *  reuse, and the insert flow. */
  suggestedText: string;
  suggestedResources: Resource[];
  /** Every suggested reply produced this conversation, in order (as `Suggestion` objects);
   *  edited entries are stored in their edited state. */
  suggestionHistory: Suggestion[];
  /** Index into suggestionHistory of the entry currently shown in the Suggested reply box. */
  suggestionIndex: number;
  /** When true, a newly-arrived suggestion snaps the view to newest; turned off by editing
   *  or paging off-newest, back on by sending or paging to newest. */
  suggestionAutoAdvance: boolean;
  /** True while a next-best-response fetch is in flight (drives the header spinner). */
  suggestionLoading: boolean;
  /** True when a newer suggestion arrived while the agent was paged back (red dot on ›). */
  suggestionNewBadge: boolean;
  lastAgentMessageAt: number | null;
  lastCustomerMessageAt: number | null;
  connectionToken: string | null;
  /** True when this contact occupies slot index 3 (4th active chat) */
  bonusEligible: boolean;
  /** Populated after chat ends for After Call Work UI; null while loading */
  acwData: ACWData | null;
  /** Populated when get-intent scope collects all required fields; cleared after submit/reject */
  proposedAction: ProposedActionData | null;
  /** Transcript spans backing the current proposedAction's field values (locate-evidence
   *  call); null/undefined while loading or unavailable — UI then shows no highlights. */
  proposedActionEvidence?: EvidenceSpan[] | null;
  /** transcriptId of the prior chat when this contact is a "continue this chat" resume; loaded on accept */
  continuedFromTranscriptId?: string;
  /** True when this contact was started via the customer "Continue this chat" card */
  isContinuation?: boolean;
  /** Connect username of the agent the client asked to wait for, if any */
  preferredAgentUsername?: string;
  /** True while the client is actively typing; drives the ellipsis indicator in this column. */
  customerTyping?: boolean;
  /** True when the customer disconnected from the chat (participant.left) while the
   *  contact is still active — the agent must explicitly End chat to move to ACW. */
  customerDisconnected?: boolean;
  /** True for a Type 3 (client-submitted) proposed action that has been sent to the
   *  customer and is awaiting their submission. While true the card shows a waiting
   *  note instead of the action buttons; cleared when the client submits/declines or
   *  the agent cancels. */
  awaitingClientApproval?: boolean;
}

export type AgentStatus = 'Available' | 'Away' | 'Offline';

export interface ProposedActionField {
  key: string;
  label: string;
  value: string;
}

export interface ProposedActionData {
  taskId: string;
  taskName: string;
  summary: string;
  fields: ProposedActionField[];
  /** Who may submit this action. 'agent' (default) = standard Submit Action flow;
   *  'client' = Type 3, the agent sends it to the customer to submit themselves;
   *  'licensed-agent' reserved (currently behaves like 'agent'). */
  submissionType?: 'agent' | 'licensed-agent' | 'client';
}

/** One transcript span that backs a proposedAction field value. Offsets index
 *  the content of the message with the given id. */
export interface EvidenceSpan {
  fieldKey: string;
  messageId: string;
  start: number;
  end: number;
}
