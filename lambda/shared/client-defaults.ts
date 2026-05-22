// Default data for all 4 demo clients — used by reset-all-data Lambda and CDK seed.
// This is the single source of truth for factory-reset values.

export interface HoldingEntry {
  name: string;
  ticker: string;
  accountId: string;
  shares: number;
  price: number;
  change: number;
  value: number;
}

export interface TransactionEntry {
  date: string;
  description: string;
  amount: number;
  account: string;
}

export interface AccountEntry {
  type: string;
  balance: number;
  id: string;
  change: number;
}

export interface BeneficiaryEntry {
  accountId: string;
  name: string;
  relationship: string;
  percentage: number;
  type: 'Primary' | 'Secondary';
}

export interface AutoInvestEntry {
  id: string;
  accountId: string;
  accountType: string;
  fund: string;
  ticker: string;
  amount: number;
  frequency: string;
  dayOfMonth?: number;
  nextDate: string;
  active: boolean;
}

export interface RmdEntry {
  eligible: boolean;
  age?: number;
  accountId?: string;
  priorYearBalance?: number;
  lifeExpectancyFactor?: number;
  annualRmd?: number;
  takenThisYear?: number;
  remainingThisYear?: number;
  nextDeadline?: string;
  distributions?: { date: string; amount: number; method: string; withheld: number }[];
  projectedEligibilityYear?: number;
  deliveryMethod?: string;
  frequency?: string;
  taxWithholding?: number;
}

export interface FullClientData {
  clientId: string;
  name: string;
  phone: string;
  displayPhone: string;
  email: string;
  address: string;
  totalBalance: number;
  accounts: AccountEntry[];
  holdings: HoldingEntry[];
  transactions: TransactionEntry[];
  beneficiaries: BeneficiaryEntry[];
  autoInvest: AutoInvestEntry[];
  rmd: RmdEntry;
  recentChatHistory: { date: string; topic: string; summary: string }[];
}

// Fund price catalog — used by execute-task when computing new holding values
export const FUND_PRICES: Record<string, { name: string; price: number }> = {
  BF500:  { name: 'BobsFunds 500 Index',          price: 218.40 },
  BFGR:   { name: 'BobsFunds Growth',             price: 341.20 },
  BFBI:   { name: 'BobsFunds Bond Income',        price: 98.30  },
  BFIN:   { name: 'BobsFunds International',      price: 87.60  },
  BFESG:  { name: 'BobsFunds ESG Leaders',        price: 156.90 },
  BFST:   { name: "BobsFunds Short-Term Treas.",  price: 100.10 },
};

// ── Alex Johnson ─────────────────────────────────────────────────────────────
const alexJohnson: FullClientData = {
  clientId: 'demo-client-001',
  name: 'Alex Johnson',
  phone: '4842384838',
  displayPhone: '(484) 238-4838',
  email: 'alex.johnson@email.com',
  address: '234 Maple Drive, Wayne, PA 19087',
  totalBalance: 241570,
  accounts: [
    { type: 'Roth IRA',        balance: 45230,  id: 'acc-001', change: +4.2 },
    { type: 'Traditional IRA', balance: 128450, id: 'acc-002', change: +2.8 },
    { type: 'Taxable Account', balance: 67890,  id: 'acc-003', change: -0.9 },
  ],
  holdings: [
    { name: 'BobsFunds 500 Index',         ticker: 'BF500', accountId: 'acc-001', shares: 142.3, price: 218.40, change: +1.2, value: 31072  },
    { name: 'BobsFunds Growth',            ticker: 'BFGR',  accountId: 'acc-001', shares: 88.1,  price: 341.20, change: +2.1, value: 30060  },
    { name: 'BobsFunds Bond Income',       ticker: 'BFBI',  accountId: 'acc-002', shares: 210.0, price: 98.30,  change: -0.3, value: 20643  },
    { name: 'BobsFunds International',     ticker: 'BFIN',  accountId: 'acc-002', shares: 55.4,  price: 87.60,  change: +0.7, value: 4853   },
    { name: 'BobsFunds ESG Leaders',       ticker: 'BFESG', accountId: 'acc-003', shares: 31.2,  price: 156.90, change: +1.8, value: 4895   },
    { name: "BobsFunds Short-Term Treas.", ticker: 'BFST',  accountId: 'acc-003', shares: 499.8, price: 100.10, change: +0.1, value: 50030  },
  ],
  transactions: [
    { date: '2025-04-10', description: 'Dividend reinvestment - BF500',    amount: +124.20,  account: 'Roth IRA'        },
    { date: '2025-04-01', description: 'Monthly contribution',             amount: +583.33,  account: 'Roth IRA'        },
    { date: '2025-03-28', description: 'Purchase - BobsFunds Growth',      amount: -5000.00, account: 'Taxable Account' },
    { date: '2025-03-15', description: 'Dividend reinvestment - BFBI',     amount: +62.40,   account: 'Traditional IRA' },
    { date: '2025-03-01', description: 'Monthly contribution',             amount: +583.33,  account: 'Roth IRA'        },
  ],
  beneficiaries: [
    { accountId: 'acc-001', name: 'Sarah Johnson',  relationship: 'Spouse', percentage: 100, type: 'Primary'   },
    { accountId: 'acc-002', name: 'Sarah Johnson',  relationship: 'Spouse', percentage: 60,  type: 'Primary'   },
    { accountId: 'acc-002', name: 'Tyler Johnson',  relationship: 'Child',  percentage: 20,  type: 'Primary'   },
    { accountId: 'acc-002', name: 'Emma Johnson',   relationship: 'Child',  percentage: 20,  type: 'Primary'   },
    { accountId: 'acc-002', name: 'Robert Johnson', relationship: 'Parent', percentage: 100, type: 'Secondary' },
  ],
  autoInvest: [
    { id: 'ai-001', accountId: 'acc-001', accountType: 'Roth IRA', fund: 'BobsFunds 500 Index', ticker: 'BF500', amount: 583.33, frequency: 'Monthly', dayOfMonth: 1, nextDate: '2025-05-01', active: true },
  ],
  rmd: {
    eligible: false,
    projectedEligibilityYear: 2040,
  },
  recentChatHistory: [
    { date: '2025-03-10', topic: 'Fund performance', summary: 'Asked about BobsFunds 500 Index YTD returns' },
    { date: '2025-02-14', topic: 'RMD rules',        summary: 'Asked about required minimum distributions for Traditional IRA' },
  ],
};

// ── Maria Chen ────────────────────────────────────────────────────────────────
const mariaChen: FullClientData = {
  clientId: 'demo-client-002',
  name: 'Maria Chen',
  phone: '6175550192',
  displayPhone: '(617) 555-0192',
  email: 'maria.chen@email.com',
  address: '18 Harbor View Lane, Wellesley, MA 02482',
  totalBalance: 890000,
  accounts: [
    { type: 'Traditional IRA', balance: 612000, id: 'acc-201', change: +1.4 },
    { type: 'Taxable Account', balance: 278000, id: 'acc-202', change: +0.8 },
  ],
  holdings: [
    { name: 'BobsFunds 500 Index',         ticker: 'BF500', accountId: 'acc-201', shares: 850.0,  price: 218.40, change: +1.2, value: 185640 },
    { name: 'BobsFunds Bond Income',       ticker: 'BFBI',  accountId: 'acc-201', shares: 1500.0, price: 98.30,  change: -0.3, value: 147450 },
    { name: "BobsFunds Short-Term Treas.", ticker: 'BFST',  accountId: 'acc-201', shares: 2800.0, price: 100.10, change: +0.1, value: 280280 },
    { name: 'BobsFunds International',     ticker: 'BFIN',  accountId: 'acc-202', shares: 500.0,  price: 87.60,  change: +0.7, value: 43800  },
    { name: 'BobsFunds ESG Leaders',       ticker: 'BFESG', accountId: 'acc-202', shares: 150.0,  price: 156.90, change: +1.8, value: 23535  },
  ],
  transactions: [
    { date: '2025-04-10', description: 'RMD Distribution',                 amount: -15300.00, account: 'Traditional IRA' },
    { date: '2025-04-01', description: 'Dividend reinvestment - BFBI',     amount: +892.50,   account: 'Traditional IRA' },
    { date: '2025-03-15', description: 'Dividend reinvestment - BFST',     amount: +1403.00,  account: 'Taxable Account' },
    { date: '2025-03-10', description: 'Purchase - BobsFunds Bond Income',  amount: -25000.00, account: 'Taxable Account' },
    { date: '2025-02-15', description: 'Dividend reinvestment - BF500',    amount: +621.25,   account: 'Traditional IRA' },
  ],
  beneficiaries: [
    { accountId: 'acc-201', name: 'David Chen', relationship: 'Child', percentage: 50, type: 'Primary' },
    { accountId: 'acc-201', name: 'Linda Chen', relationship: 'Child', percentage: 50, type: 'Primary' },
  ],
  autoInvest: [],
  rmd: {
    eligible: true,
    age: 74,
    accountId: 'acc-201',
    priorYearBalance: 628000,
    lifeExpectancyFactor: 23.8,
    annualRmd: 26387,
    takenThisYear: 15300,
    remainingThisYear: 11087,
    nextDeadline: '2025-12-31',
    distributions: [
      { date: '2025-04-10', amount: 15300, method: 'Direct deposit — Wellesley Savings Bank', withheld: 1530 },
      { date: '2024-12-15', amount: 25800, method: 'Direct deposit — Wellesley Savings Bank', withheld: 2580 },
      { date: '2023-12-14', amount: 24100, method: 'Direct deposit — Wellesley Savings Bank', withheld: 2410 },
    ],
    deliveryMethod: 'Direct deposit (ACH)',
    frequency: 'Annual (December)',
    taxWithholding: 10,
  },
  recentChatHistory: [],
};

// ── Jordan Williams ───────────────────────────────────────────────────────────
const jordanWilliams: FullClientData = {
  clientId: 'demo-client-003',
  name: 'Jordan Williams',
  phone: '5035550847',
  displayPhone: '(503) 555-0847',
  email: 'jordan.williams@email.com',
  address: '512 NE Burnside St Apt 3B, Portland, OR 97214',
  totalBalance: 23300,
  accounts: [
    { type: 'Roth IRA',        balance: 18500, id: 'acc-301', change: +3.1 },
    { type: 'Taxable Account', balance: 4800,  id: 'acc-302', change: +1.4 },
  ],
  holdings: [
    { name: 'BobsFunds 500 Index',   ticker: 'BF500', accountId: 'acc-301', shares: 65.0,  price: 218.40, change: +1.2, value: 14196 },
    { name: 'BobsFunds Growth',      ticker: 'BFGR',  accountId: 'acc-301', shares: 15.0,  price: 341.20, change: +2.1, value: 5118  },
    { name: 'BobsFunds ESG Leaders', ticker: 'BFESG', accountId: 'acc-302', shares: 25.0,  price: 156.90, change: +1.8, value: 3923  },
  ],
  transactions: [
    { date: '2025-04-01', description: 'Monthly contribution',             amount: +583.33,  account: 'Roth IRA'        },
    { date: '2025-03-28', description: 'Purchase - BobsFunds 500 Index',   amount: -1000.00, account: 'Taxable Account' },
    { date: '2025-03-01', description: 'Monthly contribution',             amount: +583.33,  account: 'Roth IRA'        },
    { date: '2025-02-01', description: 'Monthly contribution',             amount: +583.33,  account: 'Roth IRA'        },
    { date: '2025-01-15', description: 'Purchase - BobsFunds Growth',      amount: -500.00,  account: 'Roth IRA'        },
  ],
  beneficiaries: [
    { accountId: 'acc-301', name: 'Casey Williams', relationship: 'Sibling', percentage: 100, type: 'Primary'   },
    { accountId: 'acc-301', name: 'Pat Williams',   relationship: 'Parent',  percentage: 100, type: 'Secondary' },
  ],
  autoInvest: [
    { id: 'ai-301', accountId: 'acc-301', accountType: 'Roth IRA', fund: 'BobsFunds 500 Index', ticker: 'BF500', amount: 583.33, frequency: 'Monthly', dayOfMonth: 1, nextDate: '2025-05-01', active: true },
  ],
  rmd: { eligible: false },
  recentChatHistory: [],
};

// ── Robert Martinez ───────────────────────────────────────────────────────────
const robertMartinez: FullClientData = {
  clientId: 'demo-client-004',
  name: 'Robert Martinez',
  phone: '7135550234',
  displayPhone: '(713) 555-0234',
  email: 'robert.martinez@email.com',
  address: '4217 Westheimer Rd, Houston, TX 77027',
  totalBalance: 445000,
  accounts: [
    { type: 'SEP-IRA',         balance: 285000, id: 'acc-401', change: +1.9 },
    { type: 'Roth IRA',        balance: 42000,  id: 'acc-402', change: +3.2 },
    { type: 'Taxable Account', balance: 118000, id: 'acc-403', change: -0.4 },
  ],
  holdings: [
    { name: 'BobsFunds 500 Index',         ticker: 'BF500', accountId: 'acc-401', shares: 380.0,  price: 218.40, change: +1.2, value: 82992  },
    { name: 'BobsFunds Bond Income',       ticker: 'BFBI',  accountId: 'acc-401', shares: 800.0,  price: 98.30,  change: -0.3, value: 78640  },
    { name: 'BobsFunds Growth',            ticker: 'BFGR',  accountId: 'acc-402', shares: 145.0,  price: 341.20, change: +2.1, value: 49474  },
    { name: 'BobsFunds International',     ticker: 'BFIN',  accountId: 'acc-402', shares: 250.0,  price: 87.60,  change: +0.7, value: 21900  },
    { name: "BobsFunds Short-Term Treas.", ticker: 'BFST',  accountId: 'acc-403', shares: 1100.0, price: 100.10, change: +0.1, value: 110110 },
  ],
  transactions: [
    { date: '2025-04-10', description: 'SEP-IRA Contribution',              amount: +15000.00, account: 'SEP-IRA'         },
    { date: '2025-04-01', description: 'Dividend reinvestment - BFBI',      amount: +374.50,   account: 'SEP-IRA'         },
    { date: '2025-03-28', description: 'Purchase - BobsFunds Bond Income',  amount: -20000.00, account: 'SEP-IRA'         },
    { date: '2025-03-15', description: 'Dividend reinvestment - BF500',     amount: +831.00,   account: 'Taxable Account' },
    { date: '2025-02-15', description: 'Rebalance - Sale BobsFunds Growth', amount: -10000.00, account: 'Taxable Account' },
  ],
  beneficiaries: [
    { accountId: 'acc-401', name: 'Elena Martinez', relationship: 'Spouse', percentage: 100, type: 'Primary' },
    { accountId: 'acc-402', name: 'Elena Martinez', relationship: 'Spouse', percentage: 60,  type: 'Primary' },
    { accountId: 'acc-402', name: 'Sofia Martinez', relationship: 'Child',  percentage: 20,  type: 'Primary' },
    { accountId: 'acc-402', name: 'Marco Martinez', relationship: 'Child',  percentage: 20,  type: 'Primary' },
  ],
  autoInvest: [
    { id: 'ai-401', accountId: 'acc-401', accountType: 'SEP-IRA', fund: 'BobsFunds 500 Index', ticker: 'BF500', amount: 5000, frequency: 'Quarterly', nextDate: '2025-07-01', active: true },
    { id: 'ai-402', accountId: 'acc-401', accountType: 'SEP-IRA', fund: 'BobsFunds Bond Income', ticker: 'BFBI', amount: 2500, frequency: 'Quarterly', nextDate: '2025-07-01', active: true },
  ],
  rmd: { eligible: false },
  recentChatHistory: [],
};

export const DEFAULT_CLIENT_DATA: Record<string, FullClientData> = {
  'demo-client-001': alexJohnson,
  'demo-client-002': mariaChen,
  'demo-client-003': jordanWilliams,
  'demo-client-004': robertMartinez,
};

export const ALL_CLIENT_IDS = Object.keys(DEFAULT_CLIENT_DATA);
