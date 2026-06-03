export interface IntentOption {
  label: string;
  summary: string;
}

export interface RmdDistribution {
  date: string;
  amount: number;
  method: string;
  withheld: number;
}

export interface RmdData {
  eligible: boolean;
  age?: number;
  accountId?: string;
  priorYearBalance?: number;
  lifeExpectancyFactor?: number;
  annualRmd?: number;
  takenThisYear?: number;
  remainingThisYear?: number;
  nextDeadline?: string;
  distributions?: RmdDistribution[];
  deliveryMethod?: string;
  frequency?: string;
  taxWithholding?: number;
}

export interface ClientHolding {
  name: string;
  ticker: string;
  accountId: string;
  shares: number;
  price: number;
  change: number;
  value: number;
  drip?: boolean;
}

export interface ClientTransaction {
  date: string;
  description: string;
  amount: number;
  account: string;
}

export interface ClientProfile {
  clientId: string;
  name: string;
  phone: string;
  displayPhone?: string;
  email?: string;
  address?: string;
  accounts: Account[];
  totalBalance: number;
  holdings?: ClientHolding[];
  transactions?: ClientTransaction[];
  recentChatHistory: HistoryEntry[];
  intents?: IntentOption[];
}

export interface Account {
  type: string;
  balance: number;
  id: string;
  change?: number;
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

const BASE     = 'https://ferrarajc.github.io/chatmaxxing/help';
const RES      = 'https://ferrarajc.github.io/chatmaxxing/resources';
const LIB      = 'https://ferrarajc.github.io/chatmaxxing/library';
const LIB_G    = `${LIB}/guide`;
const LIB_O    = `${LIB}/opinion`;

export const KNOWLEDGE_BASE: Resource[] = [
  // ── Help / reference pages (existing) ─────────────────────────────────────
  { id: 'kb-001', title: 'Fund Performance FAQ',              url: `${BASE}/fund-performance`,  tags: ['performance', 'returns', 'fund', 'yield', 'benchmark'] },
  { id: 'kb-002', title: 'IRA Contribution Limits 2025',      url: `${BASE}/ira-limits`,         tags: ['ira', 'contribution', 'roth', 'traditional', 'limit', '2025'] },
  { id: 'kb-003', title: 'Change of Ownership Form',          url: `${BASE}/ownership-form`,     tags: ['ownership', 'transfer', 'estate', 'deceased', 'inherited', 'change'] },
  { id: 'kb-004', title: 'Required Minimum Distributions',    url: `${BASE}/rmd-guide`,          tags: ['rmd', 'minimum', 'distribution', 'withdrawal', 'required', 'age'] },
  { id: 'kb-005', title: 'Beneficiary Designation Guide',     url: `${BASE}/beneficiary`,        tags: ['beneficiary', 'designation', 'update', 'change', 'estate'] },
  { id: 'kb-006', title: 'Fee Schedule & Expense Ratios',     url: `${BASE}/fees`,               tags: ['fee', 'expense', 'ratio', 'cost', 'charge', 'annual'] },
  { id: 'kb-007', title: 'Tax Documents & 1099 Forms',        url: `${BASE}/tax-documents`,      tags: ['tax', '1099', 'document', 'form', 'year-end', 'schedule'] },
  { id: 'kb-008', title: 'Account Transfer Instructions',     url: `${BASE}/account-transfer`,   tags: ['transfer', 'move', 'acat', 'incoming', 'outgoing'] },
  { id: 'kb-009', title: 'Trading Hours & Order Types',       url: `${BASE}/trading`,            tags: ['trading', 'order', 'buy', 'sell', 'hours', 'market', 'limit'] },
  { id: 'kb-010', title: 'Password Reset & Account Access',   url: `${BASE}/account-access`,     tags: ['password', 'login', 'access', 'reset', 'locked', 'two-factor'] },
  { id: 'kb-011', title: '401(k) to IRA Rollover Guide',      url: `${BASE}/rollover-guide`,     tags: ['rollover', '401k', 'ira', 'employer', 'plan', 'pension'] },
  { id: 'kb-012', title: 'Cost Basis Methods Explained',      url: `${BASE}/cost-basis`,         tags: ['cost', 'basis', 'fifo', 'average', 'capital', 'gains', 'tax'] },
  { id: 'kb-013', title: 'Systematic Investment Plans',       url: `${BASE}/sip`,                tags: ['systematic', 'automatic', 'recurring', 'investment', 'plan', 'schedule'] },
  { id: 'kb-014', title: 'Wire Transfers & Bank Linking',     url: `${BASE}/wire-transfer`,      tags: ['wire', 'bank', 'ach', 'link', 'transfer', 'withdrawal', 'deposit'] },
  { id: 'kb-015', title: 'Account Statements & Reports',      url: `${BASE}/statements`,         tags: ['statement', 'report', 'quarterly', 'annual', 'history', 'download'] },
  { id: 'kb-016', title: 'Opening a New Account',             url: `${BASE}/open-account`,       tags: ['open', 'new', 'account', 'application', 'start', 'enroll'] },
  { id: 'kb-017', title: 'Dividend Reinvestment (DRIP)',      url: `${BASE}/drip`,               tags: ['dividend', 'reinvestment', 'drip', 'automatic', 'compounding'] },
  { id: 'kb-018', title: 'Estate Planning & Inherited Accounts', url: `${BASE}/estate-planning`, tags: ['estate', 'inherited', 'trust', 'death', 'beneficiary', 'probate'] },
  { id: 'kb-019', title: 'Fund Prospectus Library',           url: `${BASE}/prospectus`,         tags: ['prospectus', 'fund', 'document', 'disclosure', 'risk', 'objective'] },
  { id: 'kb-020', title: 'Contact Us & Support Hours',        url: `${BASE}/contact`,            tags: ['contact', 'support', 'hours', 'phone', 'email', 'chat', 'help'] },
  { id: 'kb-021', title: 'How to Place a Trade',              url: `${BASE}/place-trade`,        tags: ['trade', 'buy', 'sell', 'purchase', 'redeem', 'exchange', 'order', 'liquidate'] },
  { id: 'kb-022', title: 'Inheriting an Account',             url: `${BASE}/inheritance`,        tags: ['inherit', 'inheritance', 'deceased', 'death', 'beneficiary', 'estate', 'transfer', 'condolence'] },

  // ── Resource pages (new) ───────────────────────────────────────────────────
  { id: 'kb-023', title: 'Retirement Calculator',             url: `${RES}/retirement-calculator`, tags: ['retire', 'retirement', 'calculate', 'on track', 'nest egg', 'projection', 'enough to retire', 'retirement savings', 'retirement planning'] },
  { id: 'kb-024', title: 'SEP-IRA vs. Solo 401(k)',           url: `${RES}/sep-ira-vs-solo`,       tags: ['sep', 'solo 401k', 'self-employed', 'which is better', 'freelance', 'small business retirement', 'compare plans'] },

  // ── Library — Investor's Handbook (how-to guides) ─────────────────────────
  { id: 'kb-025', title: 'Guide: Your First Investment Account',          url: `${LIB_G}/first-investment-account`,    tags: ['beginner', 'first investment', 'getting started investing', 'how to invest', 'new investor', 'open brokerage', 'where to start'] },
  { id: 'kb-026', title: 'Guide: Index Funds vs. Active Funds',           url: `${LIB_G}/index-vs-active-funds`,       tags: ['index fund', 'active fund', 'passive investing', 'actively managed', 'spiva', 'fund comparison', 'should i use index funds'] },
  { id: 'kb-027', title: 'Guide: Asset Allocation',                       url: `${LIB_G}/asset-allocation`,            tags: ['asset allocation', 'how to allocate', 'stocks vs bonds', 'portfolio mix', '60 40', 'portfolio composition', 'balance my portfolio'] },
  { id: 'kb-028', title: 'Guide: Dollar-Cost Averaging',                  url: `${LIB_G}/dollar-cost-averaging`,       tags: ['dollar cost averaging', 'dca', 'invest regularly', 'automatic investing', 'market timing', 'lump sum', 'buy over time'] },
  { id: 'kb-029', title: 'Guide: How to Read a Prospectus',               url: `${LIB_G}/reading-a-prospectus`,        tags: ['read prospectus', 'understand prospectus', 'fund document', 'turnover rate', 'fund fees explained'] },
  { id: 'kb-030', title: 'Guide: Rebalancing Your Portfolio',             url: `${LIB_G}/rebalancing`,                 tags: ['rebalance', 'rebalancing', 'portfolio drift', 'drift', 'reset allocation', 'portfolio maintenance', 'restore balance'] },
  { id: 'kb-031', title: 'Guide: Understanding Expense Ratios',           url: `${LIB_G}/expense-ratios`,              tags: ['expense ratio', 'fund cost', 'management fee', 'annual fee', 'fee impact', 'how much does a fund cost', 'low cost fund'] },
  { id: 'kb-032', title: 'Guide: Compound Interest',                      url: `${LIB_G}/compound-interest`,           tags: ['compound interest', 'compounding', 'grow my money', 'start investing early', 'time value of money', 'reinvest dividends', 'rule of 72'] },
  { id: 'kb-033', title: 'Guide: Tax-Loss Harvesting',                    url: `${LIB_G}/tax-loss-harvesting`,         tags: ['tax loss harvesting', 'capital loss', 'wash sale', 'offset gains', 'tax savings', 'realize a loss', 'tax strategy'] },
  { id: 'kb-034', title: 'Guide: Investing Through Market Volatility',    url: `${LIB_G}/investing-through-volatility`, tags: ['volatility', 'market drop', 'bear market', 'market crash', 'downturn', 'nervous about market', 'scared', 'panic selling', 'stay invested'] },

  // ── Library — Bob's Views (opinion columns) ───────────────────────────────
  { id: 'kb-035', title: "Bob's View: Sixty Years of Markets",            url: `${LIB_O}/sixty-years-of-markets`,          tags: ['wisdom', 'lessons', 'long term investing', 'investing advice', 'what matters', 'experience', 'founder'] },
  { id: 'kb-036', title: "Bob's View: The Illusion of Market Timing",     url: `${LIB_O}/illusion-of-market-timing`,        tags: ['market timing', 'timing the market', 'call the market', 'predict market', 'buy the dip', 'sell before crash'] },
  { id: 'kb-037', title: "Bob's View: AI and Your Portfolio",             url: `${LIB_O}/the-age-of-artificial-intelligence`, tags: ['ai', 'artificial intelligence', 'technology stocks', 'tech bubble', 'ai investing', 'future of investing'] },
  { id: 'kb-038', title: "Bob's View: The Hidden Tax of Inflation",       url: `${LIB_O}/hidden-tax-of-inflation`,          tags: ['inflation', 'purchasing power', 'real return', 'cash losing value', 'inflation risk', 'beat inflation'] },
  { id: 'kb-039', title: "Bob's View: Stop Checking Your Portfolio Daily",url: `${LIB_O}/case-against-checking-daily`,       tags: ['check portfolio', 'anxiety', 'obsessing over portfolio', 'loss aversion', 'emotional investing', 'portfolio monitoring'] },
  { id: 'kb-040', title: "Bob's View: Why Boring Investments Win",        url: `${LIB_O}/why-boring-investments-win`,        tags: ['boring investing', 'simple portfolio', 'exciting stocks', 'glamour stocks', 'why index funds work', 'keep it simple'] },
  { id: 'kb-041', title: "Bob's View: What Young Investors Get Wrong",    url: `${LIB_O}/what-young-investors-get-wrong`,    tags: ['young investor', 'millennial investor', 'too conservative', 'not enough risk', 'young and investing', 'time horizon'] },
  { id: 'kb-042', title: "Bob's View: The Real Retirement Crisis",        url: `${LIB_O}/real-retirement-crisis`,            tags: ['retirement crisis', 'longevity risk', 'sequence of returns', 'outlive savings', 'drawdown risk', 'retirement spending', '4 percent rule'] },
  { id: 'kb-043', title: "Bob's View: The Virtue of Patience",            url: `${LIB_O}/virtue-of-patience`,               tags: ['patience', 'stay the course', 'long term', 'hold through volatility', 'behavioral finance', 'conviction'] },
  { id: 'kb-044', title: "Bob's View: Diversification — The Free Lunch",  url: `${LIB_O}/diversification-free-lunch`,        tags: ['diversification', 'diversify', 'spread risk', 'not diversified', 'concentrated', 'markowitz', 'home country bias', 'employer stock'] },

  // ── Library landing page ──────────────────────────────────────────────────
  { id: 'kb-045', title: "The Library — Education, Guides & Opinion",     url: LIB,                                          tags: ['learn', 'education', 'library', 'articles', 'guides', 'read more', 'learn about investing', 'financial education'] },
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

export function summarizeIntents(intents: IntentOption[] | undefined): string {
  if (!intents || intents.length === 0) return '';
  const lines = intents.map((it, i) => `${i + 1}. ${it.label}: ${it.summary}`).join('\n');
  return `\nKnown inquiry types for this client — use these to guide your questions:\n${lines}`;
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
