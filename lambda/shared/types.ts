export interface ClientProfile {
  clientId: string;
  name: string;
  phone: string;
  accounts: Account[];
  totalBalance: number;
  recentChatHistory: HistoryEntry[];
}

export interface Account {
  type: string;
  balance: number;
  id: string;
}

export interface HistoryEntry {
  date: string;
  topic: string;
  summary: string;
}

export interface ChatMessage {
  role: 'CUSTOMER' | 'AGENT' | 'BOT' | 'SYSTEM';
  content: string;
  timestamp: number;
}

export interface Resource {
  id: string;
  title: string;
  url: string;
  tags: string[];
}

export const KNOWLEDGE_BASE: Resource[] = [
  { id: 'kb-001', title: 'Fund Performance FAQ', url: '/resources/fund-performance', tags: ['performance', 'returns', 'fund', 'yield'] },
  { id: 'kb-002', title: 'IRA Contribution Limits 2025', url: '/resources/ira-limits', tags: ['ira', 'contribution', 'roth', 'traditional', 'limit'] },
  { id: 'kb-003', title: 'Change of Ownership Form', url: '/resources/ownership-form', tags: ['ownership', 'transfer', 'beneficiary', 'estate', 'deceased', 'inherited'] },
  { id: 'kb-004', title: 'Required Minimum Distributions Guide', url: '/resources/rmd-guide', tags: ['rmd', 'minimum', 'distribution', 'withdrawal', 'required'] },
  { id: 'kb-005', title: 'Beneficiary Designation Instructions', url: '/resources/beneficiary', tags: ['beneficiary', 'designation', 'update', 'change'] },
  { id: 'kb-006', title: 'Fee Schedule & Expense Ratios', url: '/resources/fees', tags: ['fee', 'expense', 'ratio', 'cost', 'charge'] },
  { id: 'kb-007', title: 'Tax Documents & 1099 Forms', url: '/resources/tax-documents', tags: ['tax', '1099', 'document', 'form', 'year-end'] },
  { id: 'kb-008', title: 'Account Transfer Instructions', url: '/resources/account-transfer', tags: ['transfer', 'move', 'rollover', '401k', 'ira'] },
  { id: 'kb-009', title: 'Trading Hours & Order Types', url: '/resources/trading', tags: ['trading', 'order', 'buy', 'sell', 'hours', 'market'] },
  { id: 'kb-010', title: 'Reset Password & Account Access', url: '/resources/account-access', tags: ['password', 'login', 'access', 'reset', 'locked'] },
];

export const PAGE_TOPIC_MAP: Record<string, string[]> = {
  portfolio: ['Check my balance', 'Recent transactions', 'Fund performance', 'Place a trade'],
  research:  ['Compare funds', 'Top performers', 'Bond fund details', 'ESG options'],
  account:   ['Update contact info', 'Change beneficiary', 'Tax documents', 'Security settings'],
  home:      ['Open an account', 'Learn about IRAs', 'Check recent activity', 'Talk to an advisor'],
};

export const DEFAULT_TOPICS = ['Check my balance', 'Fund performance', 'Talk to an advisor', 'Account help'];

export function matchResources(text: string): Resource[] {
  const lower = text.toLowerCase();
  const scored = KNOWLEDGE_BASE.map(r => ({
    resource: r,
    score: r.tags.filter(t => lower.includes(t)).length,
  }));
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(s => s.resource);
}

export function summarizeAccounts(accounts: Account[]): string {
  return accounts.map(a => `${a.type}: $${a.balance.toLocaleString()}`).join(', ');
}

export function formatTranscriptForBedrock(messages: ChatMessage[]): string {
  return messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');
}

export function dedupeAndLimit(items: string[], max: number): string[] {
  return [...new Set(items)].slice(0, max);
}

export function jsonResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
