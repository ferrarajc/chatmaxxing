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
