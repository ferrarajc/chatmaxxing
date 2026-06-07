export type ChatState =
  | 'CLOSED'
  | 'GREETING'
  | 'BOT_ACTIVE'
  | 'ESCALATION_OFFERED'
  | 'WAITING_FOR_AGENT'
  | 'CONNECTED_TO_AGENT'
  | 'CALLBACK_SCHEDULED';

export interface ChatMessageLink {
  text: string;
  url: string;
}

export interface ChatMessage {
  id: string;
  role: 'CUSTOMER' | 'BOT' | 'AGENT' | 'SYSTEM';
  content: string;
  timestamp: number;
  link?: ChatMessageLink;
  toolsUsed?: string[];
}

export interface CallbackConfirmation {
  callbackId: string;
  scheduledTime: string;
  displayTime: string;
  message: string;
}

export interface KBQuestionResult {
  id: string;
  text: string;
  answer: string;
  link?: ChatMessageLink;
}

/**
 * The client's most recent live-agent chat, used to offer "Continue this chat".
 * Sourced from the `lastAgentChat` attribute on the client record; null when the
 * client hasn't chatted with an agent recently or after a "Reset all".
 */
export interface LastAgentChat {
  transcriptId: string;
  endedAt: number;
  summary: string;
  agentUsername: string;
  agentName: string;
}
