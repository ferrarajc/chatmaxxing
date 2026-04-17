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

export interface ContactSlot {
  contactId: string;
  clientId: string;
  clientName: string;
  intentSummary: string;
  status: 'incoming' | 'active' | 'ended';
  messages: ChatMessage[];
  isAutopilot: boolean;
  connectionToken: string | null;
  suggestedText: string;
  suggestedResources: Resource[];
  /** Timestamp of agent's last sent message — drives the ResponseTimer */
  lastAgentMessageAt: number | null;
  /** Timestamp of last customer message — triggers NBR fetch */
  lastCustomerMessageAt: number | null;
}

export type AgentStatus = 'Available' | 'Away' | 'Offline';
