// All client personas for the Bob's Mutual Funds demo.
// Each persona is a self-contained dataset that drives every page in the customer app.

export interface Beneficiary {
  id: string;
  accountId: string;
  accountType: string;
  type: 'Primary' | 'Contingent';
  name: string;
  relationship: string;
  dob: string;
  ssn: string;  // masked
  percentage: number;
}

export interface AutoInvestSchedule {
  id: string;
  accountId: string;
  accountType: string;
  fund: string;
  ticker: string;
  amount: number;
  frequency: 'Monthly' | 'Bi-weekly' | 'Quarterly';
  dayOfMonth?: number;
  nextDate: string;
  active: boolean;
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
  distributions?: { date: string; amount: number; method: string; withheld: number }[];
  projectedEligibilityYear?: number;  // for clients not yet at RMD age
}

export interface Persona {
  clientId: string;
  name: string;
  phone: string;
  displayPhone: string;
  email: string;
  address: string;
  accounts: { type: string; balance: number; id: string; change: number }[];
  totalBalance: number;
  holdings: { name: string; ticker: string; shares: number; price: number; change: number; value: number }[];
  transactions: { date: string; description: string; amount: number; account: string }[];
  beneficiaries: Beneficiary[];
  autoInvest: AutoInvestSchedule[];
  rmd: RmdData;
}

// ── Alex Johnson ──────────────────────────────────────────────────────────────
const alexJohnson: Persona = {
  clientId: 'demo-client-001',
  name: 'Alex Johnson',
  phone: '4842384838',
  displayPhone: '(484) 238-4838',
  email: 'alex.johnson@email.com',
  address: '234 Maple Drive, Wayne, PA 19087',
  accounts: [
    { type: 'Roth IRA',          balance: 45230,  id: 'acc-001', change: +4.2 },
    { type: 'Traditional IRA',   balance: 128450, id: 'acc-002', change: +2.8 },
    { type: 'Taxable Account',   balance: 67890,  id: 'acc-003', change: -0.9 },
  ],
  totalBalance: 241570,
  holdings: [
    { name: 'BobsFunds 500 Index',          ticker: 'BF500',  shares: 142.3, price: 218.40, change: +1.2, value: 31072  },
    { name: 'BobsFunds Growth',             ticker: 'BFGR',   shares: 88.1,  price: 341.20, change: +2.1, value: 30060  },
    { name: 'BobsFunds Bond Income',        ticker: 'BFBI',   shares: 210.0, price: 98.30,  change: -0.3, value: 20643  },
    { name: 'BobsFunds International',      ticker: 'BFIN',   shares: 55.4,  price: 87.60,  change: +0.7, value: 4853   },
    { name: 'BobsFunds ESG Leaders',        ticker: 'BFESG',  shares: 31.2,  price: 156.90, change: +1.8, value: 4895   },
    { name: 'BobsFunds Short-Term Treas.',  ticker: 'BFST',   shares: 499.8, price: 100.10, change: +0.1, value: 50030  },
  ],
  transactions: [
    { date: '2025-04-10', description: 'Dividend reinvestment - BF500',      amount: +124.20,  account: 'Roth IRA'         },
    { date: '2025-04-01', description: 'Monthly contribution',               amount: +583.33,  account: 'Roth IRA'         },
    { date: '2025-03-28', description: 'Purchase - BobsFunds Growth',        amount: -5000.00, account: 'Taxable Account'  },
    { date: '2025-03-15', description: 'Dividend reinvestment - BFBI',       amount: +62.40,   account: 'Traditional IRA'  },
    { date: '2025-03-01', description: 'Monthly contribution',               amount: +583.33,  account: 'Roth IRA'         },
  ],
  beneficiaries: [
    { id: 'ben-001', accountId: 'acc-001', accountType: 'Roth IRA',        type: 'Primary',    name: 'Sarah Johnson',  relationship: 'Spouse',     dob: '1988-03-14', ssn: '***-**-4721', percentage: 100 },
    { id: 'ben-002', accountId: 'acc-002', accountType: 'Traditional IRA', type: 'Primary',    name: 'Sarah Johnson',  relationship: 'Spouse',     dob: '1988-03-14', ssn: '***-**-4721', percentage: 60  },
    { id: 'ben-003', accountId: 'acc-002', accountType: 'Traditional IRA', type: 'Primary',    name: 'Tyler Johnson',  relationship: 'Child',      dob: '2015-07-22', ssn: '***-**-8834', percentage: 20  },
    { id: 'ben-004', accountId: 'acc-002', accountType: 'Traditional IRA', type: 'Primary',    name: 'Emma Johnson',   relationship: 'Child',      dob: '2018-11-03', ssn: '***-**-9251', percentage: 20  },
    { id: 'ben-005', accountId: 'acc-002', accountType: 'Traditional IRA', type: 'Contingent', name: 'Robert Johnson', relationship: 'Parent',     dob: '1958-04-09', ssn: '***-**-3317', percentage: 100 },
    { id: 'ben-006', accountId: 'acc-003', accountType: 'Taxable Account', type: 'Primary',    name: 'Sarah Johnson',  relationship: 'Spouse',     dob: '1988-03-14', ssn: '***-**-4721', percentage: 100 },
  ],
  autoInvest: [
    { id: 'ai-001', accountId: 'acc-001', accountType: 'Roth IRA', fund: 'BobsFunds 500 Index', ticker: 'BF500', amount: 583.33, frequency: 'Monthly', dayOfMonth: 1, nextDate: '2025-05-01', active: true },
  ],
  rmd: {
    eligible: false,
    projectedEligibilityYear: 2040,  // Alex turns 73 in ~2040
  },
};

// ── Maria Chen ────────────────────────────────────────────────────────────────
const mariaChen: Persona = {
  clientId: 'demo-client-002',
  name: 'Maria Chen',
  phone: '6175550192',
  displayPhone: '(617) 555-0192',
  email: 'maria.chen@email.com',
  address: '18 Harbor View Lane, Wellesley, MA 02482',
  accounts: [
    { type: 'Traditional IRA',   balance: 612000, id: 'acc-201', change: +1.4 },
    { type: 'Taxable Account',   balance: 278000, id: 'acc-202', change: +0.8 },
  ],
  totalBalance: 890000,
  holdings: [
    { name: 'BobsFunds 500 Index',         ticker: 'BF500',  shares: 850.0,  price: 218.40, change: +1.2, value: 185640 },
    { name: 'BobsFunds Bond Income',       ticker: 'BFBI',   shares: 1500.0, price: 98.30,  change: -0.3, value: 147450 },
    { name: 'BobsFunds Short-Term Treas.', ticker: 'BFST',   shares: 2800.0, price: 100.10, change: +0.1, value: 280280 },
    { name: 'BobsFunds International',     ticker: 'BFIN',   shares: 500.0,  price: 87.60,  change: +0.7, value: 43800  },
    { name: 'BobsFunds ESG Leaders',       ticker: 'BFESG',  shares: 150.0,  price: 156.90, change: +1.8, value: 23535  },
  ],
  transactions: [
    { date: '2025-04-10', description: 'RMD Distribution',                   amount: -15300.00, account: 'Traditional IRA' },
    { date: '2025-04-01', description: 'Dividend reinvestment - BFBI',       amount: +892.50,   account: 'Traditional IRA' },
    { date: '2025-03-15', description: 'Dividend reinvestment - BFST',       amount: +1403.00,  account: 'Taxable Account' },
    { date: '2025-03-10', description: 'Purchase - BobsFunds Bond Income',   amount: -25000.00, account: 'Taxable Account' },
    { date: '2025-02-15', description: 'Dividend reinvestment - BF500',      amount: +621.25,   account: 'Traditional IRA' },
  ],
  beneficiaries: [
    { id: 'ben-201', accountId: 'acc-201', accountType: 'Traditional IRA', type: 'Primary',    name: 'David Chen',    relationship: 'Child',  dob: '1975-06-18', ssn: '***-**-5529', percentage: 50 },
    { id: 'ben-202', accountId: 'acc-201', accountType: 'Traditional IRA', type: 'Primary',    name: 'Linda Chen',    relationship: 'Child',  dob: '1978-02-27', ssn: '***-**-8843', percentage: 50 },
    { id: 'ben-203', accountId: 'acc-202', accountType: 'Taxable Account', type: 'Primary',    name: 'David Chen',    relationship: 'Child',  dob: '1975-06-18', ssn: '***-**-5529', percentage: 50 },
    { id: 'ben-204', accountId: 'acc-202', accountType: 'Taxable Account', type: 'Primary',    name: 'Linda Chen',    relationship: 'Child',  dob: '1978-02-27', ssn: '***-**-8843', percentage: 50 },
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
  },
};

// ── Jordan Williams ───────────────────────────────────────────────────────────
const jordanWilliams: Persona = {
  clientId: 'demo-client-003',
  name: 'Jordan Williams',
  phone: '5035550847',
  displayPhone: '(503) 555-0847',
  email: 'jordan.williams@email.com',
  address: '512 NE Burnside St Apt 3B, Portland, OR 97214',
  accounts: [
    { type: 'Roth IRA',        balance: 18500, id: 'acc-301', change: +3.1 },
    { type: 'Taxable Account', balance: 4800,  id: 'acc-302', change: +1.4 },
  ],
  totalBalance: 23300,
  holdings: [
    { name: 'BobsFunds 500 Index',   ticker: 'BF500',  shares: 65.0,  price: 218.40, change: +1.2, value: 14196 },
    { name: 'BobsFunds Growth',      ticker: 'BFGR',   shares: 15.0,  price: 341.20, change: +2.1, value: 5118  },
    { name: 'BobsFunds ESG Leaders', ticker: 'BFESG',  shares: 25.0,  price: 156.90, change: +1.8, value: 3923  },
  ],
  transactions: [
    { date: '2025-04-01', description: 'Monthly contribution',               amount: +583.33,  account: 'Roth IRA'        },
    { date: '2025-03-28', description: 'Purchase - BobsFunds 500 Index',     amount: -1000.00, account: 'Taxable Account' },
    { date: '2025-03-01', description: 'Monthly contribution',               amount: +583.33,  account: 'Roth IRA'        },
    { date: '2025-02-01', description: 'Monthly contribution',               amount: +583.33,  account: 'Roth IRA'        },
    { date: '2025-01-15', description: 'Purchase - BobsFunds Growth',        amount: -500.00,  account: 'Roth IRA'        },
  ],
  beneficiaries: [
    { id: 'ben-301', accountId: 'acc-301', accountType: 'Roth IRA',        type: 'Primary', name: 'Casey Williams', relationship: 'Sibling', dob: '1993-09-05', ssn: '***-**-7712', percentage: 100 },
    { id: 'ben-302', accountId: 'acc-302', accountType: 'Taxable Account', type: 'Primary', name: 'Casey Williams', relationship: 'Sibling', dob: '1993-09-05', ssn: '***-**-7712', percentage: 100 },
  ],
  autoInvest: [
    { id: 'ai-301', accountId: 'acc-301', accountType: 'Roth IRA', fund: 'BobsFunds 500 Index', ticker: 'BF500', amount: 583.33, frequency: 'Monthly', dayOfMonth: 1, nextDate: '2025-05-01', active: true },
  ],
  rmd: { eligible: false },
};

// ── Robert Martinez ───────────────────────────────────────────────────────────
const robertMartinez: Persona = {
  clientId: 'demo-client-004',
  name: 'Robert Martinez',
  phone: '7135550234',
  displayPhone: '(713) 555-0234',
  email: 'robert.martinez@email.com',
  address: '4217 Westheimer Rd, Houston, TX 77027',
  accounts: [
    { type: 'SEP-IRA',           balance: 285000, id: 'acc-401', change: +1.9 },
    { type: 'Roth IRA',          balance: 42000,  id: 'acc-402', change: +3.2 },
    { type: 'Taxable Account',   balance: 118000, id: 'acc-403', change: -0.4 },
  ],
  totalBalance: 445000,
  holdings: [
    { name: 'BobsFunds 500 Index',         ticker: 'BF500',  shares: 380.0,  price: 218.40, change: +1.2, value: 82992  },
    { name: 'BobsFunds Growth',            ticker: 'BFGR',   shares: 145.0,  price: 341.20, change: +2.1, value: 49474  },
    { name: 'BobsFunds Bond Income',       ticker: 'BFBI',   shares: 800.0,  price: 98.30,  change: -0.3, value: 78640  },
    { name: 'BobsFunds International',     ticker: 'BFIN',   shares: 250.0,  price: 87.60,  change: +0.7, value: 21900  },
    { name: 'BobsFunds Short-Term Treas.', ticker: 'BFST',   shares: 1100.0, price: 100.10, change: +0.1, value: 110110 },
  ],
  transactions: [
    { date: '2025-04-10', description: 'SEP-IRA Contribution',               amount: +15000.00, account: 'SEP-IRA'         },
    { date: '2025-04-01', description: 'Dividend reinvestment - BFBI',       amount: +374.50,   account: 'SEP-IRA'         },
    { date: '2025-03-28', description: 'Purchase - BobsFunds Bond Income',   amount: -20000.00, account: 'SEP-IRA'         },
    { date: '2025-03-15', description: 'Dividend reinvestment - BF500',      amount: +831.00,   account: 'Taxable Account' },
    { date: '2025-02-15', description: 'Rebalance - Sale BobsFunds Growth',  amount: -10000.00, account: 'Taxable Account' },
  ],
  beneficiaries: [
    { id: 'ben-401', accountId: 'acc-401', accountType: 'SEP-IRA',         type: 'Primary',    name: 'Elena Martinez',  relationship: 'Spouse',  dob: '1976-12-08', ssn: '***-**-2241', percentage: 100 },
    { id: 'ben-402', accountId: 'acc-402', accountType: 'Roth IRA',        type: 'Primary',    name: 'Elena Martinez',  relationship: 'Spouse',  dob: '1976-12-08', ssn: '***-**-2241', percentage: 60  },
    { id: 'ben-403', accountId: 'acc-402', accountType: 'Roth IRA',        type: 'Primary',    name: 'Sofia Martinez',  relationship: 'Child',   dob: '2008-03-19', ssn: '***-**-6618', percentage: 20  },
    { id: 'ben-404', accountId: 'acc-402', accountType: 'Roth IRA',        type: 'Primary',    name: 'Marco Martinez',  relationship: 'Child',   dob: '2011-08-14', ssn: '***-**-7723', percentage: 20  },
    { id: 'ben-405', accountId: 'acc-403', accountType: 'Taxable Account', type: 'Primary',    name: 'Elena Martinez',  relationship: 'Spouse',  dob: '1976-12-08', ssn: '***-**-2241', percentage: 100 },
  ],
  autoInvest: [
    { id: 'ai-401', accountId: 'acc-401', accountType: 'SEP-IRA', fund: 'BobsFunds 500 Index', ticker: 'BF500', amount: 5000, frequency: 'Quarterly', nextDate: '2025-07-01', active: true },
    { id: 'ai-402', accountId: 'acc-401', accountType: 'SEP-IRA', fund: 'BobsFunds Bond Income', ticker: 'BFBI', amount: 2500, frequency: 'Quarterly', nextDate: '2025-07-01', active: true },
  ],
  rmd: { eligible: false },
};

export const PERSONAS: Persona[] = [alexJohnson, mariaChen, jordanWilliams, robertMartinez];

export const PERSONA_MAP: Record<string, Persona> = Object.fromEntries(
  PERSONAS.map(p => [p.clientId, p]),
);
