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

const BASE = 'https://ferrarajc.github.io/chatmaxxing/resources';

export const KNOWLEDGE_BASE: Resource[] = [
  { id: 'kb-001', title: 'Fund Performance FAQ',              url: `${BASE}/fund-performance/`,  tags: ['performance', 'returns', 'fund', 'yield', 'benchmark'] },
  { id: 'kb-002', title: 'IRA Contribution Limits 2025',      url: `${BASE}/ira-limits/`,         tags: ['ira', 'contribution', 'roth', 'traditional', 'limit', '2025'] },
  { id: 'kb-003', title: 'Change of Ownership Form',          url: `${BASE}/ownership-form/`,     tags: ['ownership', 'transfer', 'estate', 'deceased', 'inherited', 'change'] },
  { id: 'kb-004', title: 'Required Minimum Distributions',    url: `${BASE}/rmd-guide/`,          tags: ['rmd', 'minimum', 'distribution', 'withdrawal', 'required', 'age'] },
  { id: 'kb-005', title: 'Beneficiary Designation Guide',     url: `${BASE}/beneficiary/`,        tags: ['beneficiary', 'designation', 'update', 'change', 'estate'] },
  { id: 'kb-006', title: 'Fee Schedule & Expense Ratios',     url: `${BASE}/fees/`,              tags: ['fee', 'expense', 'ratio', 'cost', 'charge', 'annual'] },
  { id: 'kb-007', title: 'Tax Documents & 1099 Forms',        url: `${BASE}/tax-documents/`,     tags: ['tax', '1099', 'document', 'form', 'year-end', 'schedule'] },
  { id: 'kb-008', title: 'Account Transfer Instructions',     url: `${BASE}/account-transfer/`,  tags: ['transfer', 'move', 'acat', 'incoming', 'outgoing'] },
  { id: 'kb-009', title: 'Trading Hours & Order Types',       url: `${BASE}/trading/`,           tags: ['trading', 'order', 'buy', 'sell', 'hours', 'market', 'limit'] },
  { id: 'kb-010', title: 'Password Reset & Account Access',   url: `${BASE}/account-access/`,    tags: ['password', 'login', 'access', 'reset', 'locked', 'two-factor'] },
  { id: 'kb-011', title: '401(k) to IRA Rollover Guide',      url: `${BASE}/rollover-guide/`,    tags: ['rollover', '401k', 'ira', 'employer', 'plan', 'pension'] },
  { id: 'kb-012', title: 'Cost Basis Methods Explained',      url: `${BASE}/cost-basis/`,        tags: ['cost', 'basis', 'fifo', 'average', 'capital', 'gains', 'tax'] },
  { id: 'kb-013', title: 'Systematic Investment Plans',       url: `${BASE}/sip/`,               tags: ['systematic', 'automatic', 'recurring', 'investment', 'plan', 'schedule'] },
  { id: 'kb-014', title: 'Wire Transfers & Bank Linking',     url: `${BASE}/wire-transfer/`,     tags: ['wire', 'bank', 'ach', 'link', 'transfer', 'withdrawal', 'deposit'] },
  { id: 'kb-015', title: 'Account Statements & Reports',      url: `${BASE}/statements/`,        tags: ['statement', 'report', 'quarterly', 'annual', 'history', 'download'] },
  { id: 'kb-016', title: 'Opening a New Account',             url: `${BASE}/open-account/`,      tags: ['open', 'new', 'account', 'application', 'start', 'enroll'] },
  { id: 'kb-017', title: 'Dividend Reinvestment (DRIP)',      url: `${BASE}/drip/`,              tags: ['dividend', 'reinvestment', 'drip', 'automatic', 'compounding'] },
  { id: 'kb-018', title: 'Estate Planning & Inherited Accounts', url: `${BASE}/estate-planning/`, tags: ['estate', 'inherited', 'trust', 'death', 'beneficiary', 'probate'] },
  { id: 'kb-019', title: 'Fund Prospectus Library',           url: `${BASE}/prospectus/`,        tags: ['prospectus', 'fund', 'document', 'disclosure', 'risk', 'objective'] },
  { id: 'kb-020', title: 'Contact Us & Support Hours',        url: `${BASE}/contact/`,           tags: ['contact', 'support', 'hours', 'phone', 'email', 'chat', 'help'] },
  { id: 'kb-021', title: 'How to Place a Trade',             url: `${BASE}/place-trade/`,        tags: ['trade', 'buy', 'sell', 'purchase', 'redeem', 'exchange', 'order', 'liquidate'] },
  { id: 'kb-022', title: 'Inheriting an Account',            url: `${BASE}/inheritance/`,        tags: ['inherit', 'inheritance', 'deceased', 'death', 'beneficiary', 'estate', 'transfer', 'condolence'] },
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
