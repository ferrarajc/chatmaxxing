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
  suggestedText: string;
  suggestedResources: Resource[];
  lastAgentMessageAt: number | null;
  lastCustomerMessageAt: number | null;
  connectionToken: string | null;
  /** True when this contact occupies slot index 3 (4th active chat) */
  bonusEligible: boolean;
  /** Populated after chat ends for After Call Work UI; null while loading */
  acwData: ACWData | null;
}

export type AgentStatus = 'Available' | 'Away' | 'Offline';
