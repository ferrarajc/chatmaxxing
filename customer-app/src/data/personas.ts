// All client personas for the Bob's Mutual Funds demo.
// Each persona is a self-contained dataset that drives every page in the customer app.

export interface Beneficiary {
  id: string;
  accountId: string;
  accountType: string;
  type: 'Primary' | 'Secondary';
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
  // preference fields — written by expert task, read by expert + page
  deliveryMethod?: string;
  frequency?: string;
  taxWithholding?: number;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountType: 'Checking' | 'Savings';
  maskedNumber: string;
  primary: boolean;
  verified?: boolean;              // undefined = established/verified; false = awaiting micro-deposits
  pendingMicroDeposits?: number[]; // two trial-deposit amounts the customer must confirm
}

export type AuthorizationLevel = 'View only' | 'Limited' | 'Full';

export interface AuthorizedAgent {
  id: string;
  name: string;
  relationship: string;
  email: string;
  level: AuthorizationLevel;
  addedAt: string;
}

// ── My Account hub types (mirror lambda/shared/client-defaults.ts) ─────────────
export const SMS_DISCLOSURE_VERSION = 'sms-2026-06-v1';

export interface PhoneSmsConsent {
  accountAlerts: boolean;
  marketing: boolean;
  status: 'opted-in' | 'opted-out' | 'none';
  consentedAt?: string;
  disclosureVersion?: string;
  method?: string;
}

export interface PhoneEntry {
  id: string;
  type: 'mobile' | 'home' | 'work' | 'other';
  number: string;
  displayNumber: string;
  verified: boolean;
  sms: PhoneSmsConsent;
}

export interface PersonalDetails {
  dateOfBirth: string;
  maritalStatus: string;
  employmentStatus: string;
  employer: string;
  occupation: string;
  citizenship: string;
  memberSince: string;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  twoFactorMethod: 'sms' | 'email' | 'app';
  loginAlerts: boolean;
  lastPasswordChange: string;
  recentLogins?: { date: string; device: string; location: string }[];
}

export interface CommunicationPreferences {
  paperlessStatements: boolean;
  taxDocDelivery: 'electronic' | 'mail';
  tradeConfirms: 'electronic' | 'mail';
  prospectusDelivery: 'electronic' | 'mail';
  proxyDelivery: 'electronic' | 'mail';
  notifyEmail: boolean;
  notifySms: boolean;
  notifyPush: boolean;
  language: string;
  marketing: boolean;
}

export interface TrustedContact {
  name: string;
  relationship: string;
  phone: string;
  email: string;
}

export interface InvestorProfile {
  riskProfile: string;
  riskScorePct: number;
  stocksPct: number;
  bondPct: number;
  cashPct: number;
  slices?: { name: string; ticker: string; pct: number }[];
  goals: string[];
  timeHorizon: string;
  annualIncomeRange: string;
  netWorthRange: string;
  investmentExperience: string;
  updatedAt: string;
}

export interface WatchlistEntry {
  ticker: string;
  addedAt: string;
}

export interface AgreementEntry {
  id: string;
  title: string;
  version: string;
  type: string;
  signedAt: string;
  signature: string;
}

export interface Persona {
  clientId: string;
  name: string;
  age: number;
  salary: number;
  phone: string;
  displayPhone: string;
  email: string;
  address: string;
  accounts: { type: string; balance: number; id: string; change: number }[];
  totalBalance: number;
  holdings: { name: string; ticker: string; accountId: string; shares: number; price: number; change: number; value: number }[];
  transactions: { date: string; description: string; amount: number; account: string; status?: string; accountId?: string }[];
  beneficiaries: Beneficiary[];
  autoInvest: AutoInvestSchedule[];
  rmd: RmdData;
  bankAccounts: BankAccount[];
  // ── My Account hub (DB-driven, editable) ──────────────────────────────────
  phones: PhoneEntry[];
  emailVerified: boolean;
  personal: PersonalDetails;
  security: SecuritySettings;
  preferences: CommunicationPreferences;
  trustedContact: TrustedContact | null;
  investorProfile: InvestorProfile | null;
  watchlist: WatchlistEntry[];
  agreements: AgreementEntry[];
  authorizedAgents?: AuthorizedAgent[];
}

// ── Alex Johnson ──────────────────────────────────────────────────────────────
const alexJohnson: Persona = {
  clientId: 'demo-client-001',
  name: 'Alex Johnson',
  age: 59,       // turns 73 in 2040 per rmd.projectedEligibilityYear
  salary: 95000,
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
    { name: 'BobsFunds 500 Index',          ticker: 'BF500',  accountId: 'acc-001', shares: 142.3, price: 218.40, change: +1.2, value: 31072  },
    { name: 'BobsFunds Growth',             ticker: 'BFGR',   accountId: 'acc-001', shares: 88.1,  price: 341.20, change: +2.1, value: 30060  },
    { name: 'BobsFunds Bond Income',        ticker: 'BFBI',   accountId: 'acc-002', shares: 210.0, price: 98.30,  change: -0.3, value: 20643  },
    { name: 'BobsFunds International',      ticker: 'BFIN',   accountId: 'acc-002', shares: 55.4,  price: 87.60,  change: +0.7, value: 4853   },
    { name: 'BobsFunds ESG Leaders',        ticker: 'BFESG',  accountId: 'acc-003', shares: 31.2,  price: 156.90, change: +1.8, value: 4895   },
    { name: 'BobsFunds Short-Term Treas.',  ticker: 'BFST',   accountId: 'acc-003', shares: 499.8, price: 100.10, change: +0.1, value: 50030  },
  ],
  transactions: [
    { date: '2025-04-10', description: 'Dividend reinvestment - BF500',      amount: +124.20,  account: 'Roth IRA'         },
    { date: '2025-04-01', description: 'Monthly contribution',               amount: +583.33,  account: 'Roth IRA'         },
    { date: '2025-03-28', description: 'Purchase - BobsFunds Growth',        amount: -5000.00, account: 'Taxable Account'  },
    { date: '2025-03-15', description: 'Dividend reinvestment - BFBI',       amount: +62.40,   account: 'Traditional IRA'  },
    { date: '2025-03-01', description: 'Monthly contribution',               amount: +583.33,  account: 'Roth IRA'         },
  ],
  beneficiaries: [
    { id: 'ben-001', accountId: 'acc-001', accountType: 'Roth IRA',        type: 'Primary',    name: 'Sarah Johnson',  relationship: 'Spouse',  dob: '1988-03-14', ssn: '***-**-4721', percentage: 100 },
    { id: 'ben-002', accountId: 'acc-002', accountType: 'Traditional IRA', type: 'Primary',    name: 'Sarah Johnson',  relationship: 'Spouse',  dob: '1988-03-14', ssn: '***-**-4721', percentage: 60  },
    { id: 'ben-003', accountId: 'acc-002', accountType: 'Traditional IRA', type: 'Primary',    name: 'Tyler Johnson',  relationship: 'Child',   dob: '2015-07-22', ssn: '***-**-8834', percentage: 20  },
    { id: 'ben-004', accountId: 'acc-002', accountType: 'Traditional IRA', type: 'Primary',    name: 'Emma Johnson',   relationship: 'Child',   dob: '2018-11-03', ssn: '***-**-9251', percentage: 20  },
    { id: 'ben-005', accountId: 'acc-002', accountType: 'Traditional IRA', type: 'Secondary',  name: 'Robert Johnson', relationship: 'Parent',  dob: '1958-04-09', ssn: '***-**-3317', percentage: 100 },
  ],
  autoInvest: [
    { id: 'ai-001', accountId: 'acc-001', accountType: 'Roth IRA', fund: 'BobsFunds 500 Index', ticker: 'BF500', amount: 583.33, frequency: 'Monthly', dayOfMonth: 1, nextDate: '2025-05-01', active: true },
  ],
  rmd: {
    eligible: false,
    projectedEligibilityYear: 2040,  // Alex turns 73 in ~2040
  },
  bankAccounts: [
    { id: 'bank-001', bankName: 'Keystone Community Bank',      accountType: 'Checking', maskedNumber: '••••7832', primary: true  },
    { id: 'bank-002', bankName: 'Philadelphia Federal Savings', accountType: 'Savings',  maskedNumber: '••••4419', primary: false },
  ],
  phones: [
    { id: 'ph-001a', type: 'mobile', number: '4842384838', displayNumber: '(484) 238-4838', verified: true,
      sms: { accountAlerts: true, marketing: false, status: 'opted-in', consentedAt: '2024-11-02', disclosureVersion: SMS_DISCLOSURE_VERSION, method: 'web' } },
    { id: 'ph-001b', type: 'home', number: '6105550173', displayNumber: '(610) 555-0173', verified: false,
      sms: { accountAlerts: false, marketing: false, status: 'none' } },
  ],
  emailVerified: true,
  personal: {
    dateOfBirth: '1966-08-19', maritalStatus: 'Married', employmentStatus: 'Employed',
    employer: 'Keystone Analytics', occupation: 'Software Engineer',
    citizenship: 'U.S. Citizen', memberSince: '2016-03-12',
  },
  security: {
    twoFactorEnabled: true, twoFactorMethod: 'sms', loginAlerts: true, lastPasswordChange: '2025-01-15',
    recentLogins: [
      { date: '2025-04-14 09:14 ET', device: 'Chrome · macOS',  location: 'Wayne, PA' },
      { date: '2025-04-10 18:02 ET', device: 'Safari · iPhone', location: 'Philadelphia, PA' },
      { date: '2025-04-03 07:48 ET', device: 'Chrome · macOS',  location: 'Wayne, PA' },
    ],
  },
  preferences: {
    paperlessStatements: true, taxDocDelivery: 'electronic', tradeConfirms: 'electronic',
    prospectusDelivery: 'electronic', proxyDelivery: 'electronic',
    notifyEmail: true, notifySms: true, notifyPush: false, language: 'English', marketing: false,
  },
  trustedContact: { name: 'Sarah Johnson', relationship: 'Spouse', phone: '(484) 238-4801', email: 'sarah.johnson@email.com' },
  investorProfile: {
    riskProfile: 'Balanced', riskScorePct: 52, stocksPct: 65, bondPct: 35, cashPct: 0,
    slices: [
      { name: 'BobsFunds Total Market', ticker: 'BFTM', pct: 43 },
      { name: 'BobsFunds International', ticker: 'BFIN', pct: 22 },
      { name: 'BobsFunds Bond Income',  ticker: 'BFBI', pct: 35 },
    ],
    goals: ['Retirement', 'Build long-term wealth'], timeHorizon: '10+ years',
    annualIncomeRange: '$75,000–$150,000', netWorthRange: '$250,000–$500,000',
    investmentExperience: 'Good', updatedAt: '2025-02-20',
  },
  watchlist: [
    { ticker: 'BFGR',  addedAt: '2025-03-01' },
    { ticker: 'BFESG', addedAt: '2025-02-12' },
  ],
  authorizedAgents: [
    { id: 'aa-001', name: 'Sarah Johnson', relationship: 'Spouse',            email: 'sarah.johnson@email.com', level: 'Full',      addedAt: '2018-05-01' },
    { id: 'aa-002', name: 'Dana Brooks',   relationship: 'Financial advisor', email: 'dana.brooks@advisors.com', level: 'View only', addedAt: '2022-09-14' },
  ],
  agreements: [
    { id: 'ag-001', title: "Bob's Mutual Funds Customer Agreement", version: '2024.1',             type: 'customer',    signedAt: '2016-03-12', signature: 'Alex Johnson' },
    { id: 'ag-002', title: 'Electronic Delivery Consent',          version: '2024.1',             type: 'e-delivery',  signedAt: '2016-03-12', signature: 'Alex Johnson' },
    { id: 'ag-003', title: 'Privacy Policy Acknowledgment',        version: '2024.1',             type: 'privacy',     signedAt: '2016-03-12', signature: 'Alex Johnson' },
    { id: 'ag-004', title: 'Text Messaging Consent (SMS)',         version: SMS_DISCLOSURE_VERSION, type: 'sms-consent', signedAt: '2024-11-02', signature: 'Alex Johnson' },
  ],
};

// ── Maria Chen ────────────────────────────────────────────────────────────────
const mariaChen: Persona = {
  clientId: 'demo-client-002',
  name: 'Maria Chen',
  age: 74,   // rmd.age is explicit
  salary: 0, // retired
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
    { name: 'BobsFunds 500 Index',         ticker: 'BF500',  accountId: 'acc-201', shares: 850.0,  price: 218.40, change: +1.2, value: 185640 },
    { name: 'BobsFunds Bond Income',       ticker: 'BFBI',   accountId: 'acc-201', shares: 1500.0, price: 98.30,  change: -0.3, value: 147450 },
    { name: 'BobsFunds Short-Term Treas.', ticker: 'BFST',   accountId: 'acc-201', shares: 2800.0, price: 100.10, change: +0.1, value: 280280 },
    { name: 'BobsFunds International',     ticker: 'BFIN',   accountId: 'acc-202', shares: 500.0,  price: 87.60,  change: +0.7, value: 43800  },
    { name: 'BobsFunds ESG Leaders',       ticker: 'BFESG',  accountId: 'acc-202', shares: 150.0,  price: 156.90, change: +1.8, value: 23535  },
  ],
  transactions: [
    { date: '2025-04-10', description: 'RMD Distribution',                   amount: -15300.00, account: 'Traditional IRA' },
    { date: '2025-04-01', description: 'Dividend reinvestment - BFBI',       amount: +892.50,   account: 'Traditional IRA' },
    { date: '2025-03-15', description: 'Dividend reinvestment - BFST',       amount: +1403.00,  account: 'Taxable Account' },
    { date: '2025-03-10', description: 'Purchase - BobsFunds Bond Income',   amount: -25000.00, account: 'Taxable Account' },
    { date: '2025-02-15', description: 'Dividend reinvestment - BF500',      amount: +621.25,   account: 'Traditional IRA' },
  ],
  beneficiaries: [
    { id: 'ben-201', accountId: 'acc-201', accountType: 'Traditional IRA', type: 'Primary', name: 'David Chen', relationship: 'Child', dob: '1975-06-18', ssn: '***-**-5529', percentage: 50 },
    { id: 'ben-202', accountId: 'acc-201', accountType: 'Traditional IRA', type: 'Primary', name: 'Linda Chen', relationship: 'Child', dob: '1978-02-27', ssn: '***-**-8843', percentage: 50 },
  ],
  autoInvest: [],
  bankAccounts: [
    { id: 'bank-201', bankName: 'Wellesley Savings Bank',           accountType: 'Checking', maskedNumber: '••••2291', primary: true  },
    { id: 'bank-202', bankName: 'New England Federal Credit Union', accountType: 'Savings',  maskedNumber: '••••6074', primary: false },
  ],
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
  phones: [
    { id: 'ph-002a', type: 'mobile', number: '6175550192', displayNumber: '(617) 555-0192', verified: true,
      sms: { accountAlerts: true, marketing: false, status: 'opted-in', consentedAt: '2023-08-14', disclosureVersion: SMS_DISCLOSURE_VERSION, method: 'phone-agent' } },
    { id: 'ph-002b', type: 'home', number: '7815550144', displayNumber: '(781) 555-0144', verified: true,
      sms: { accountAlerts: false, marketing: false, status: 'opted-out' } },
  ],
  emailVerified: true,
  personal: {
    dateOfBirth: '1951-02-03', maritalStatus: 'Widowed', employmentStatus: 'Retired',
    employer: '', occupation: 'Retired (former Professor)',
    citizenship: 'U.S. Citizen', memberSince: '2009-06-01',
  },
  security: {
    twoFactorEnabled: true, twoFactorMethod: 'sms', loginAlerts: true, lastPasswordChange: '2024-09-30',
    recentLogins: [
      { date: '2025-04-13 11:20 ET', device: 'Safari · iPad', location: 'Wellesley, MA' },
      { date: '2025-04-08 15:55 ET', device: 'Safari · iPad', location: 'Wellesley, MA' },
    ],
  },
  preferences: {
    paperlessStatements: false, taxDocDelivery: 'mail', tradeConfirms: 'mail',
    prospectusDelivery: 'mail', proxyDelivery: 'mail',
    notifyEmail: true, notifySms: true, notifyPush: false, language: 'English', marketing: false,
  },
  trustedContact: { name: 'David Chen', relationship: 'Child', phone: '(617) 555-0455', email: 'david.chen@email.com' },
  investorProfile: {
    riskProfile: 'Conservative', riskScorePct: 18, stocksPct: 30, bondPct: 55, cashPct: 15,
    slices: [
      { name: 'BobsFunds Total Market',        ticker: 'BFTM', pct: 20 },
      { name: 'BobsFunds International',        ticker: 'BFIN', pct: 10 },
      { name: 'BobsFunds Bond Income',         ticker: 'BFBI', pct: 55 },
      { name: 'BobsFunds Short-Term Treasury', ticker: 'BFST', pct: 15 },
    ],
    goals: ['Preserve capital', 'Generate retirement income'], timeHorizon: 'Income now',
    annualIncomeRange: 'Under $75,000', netWorthRange: '$750,000–$1,000,000',
    investmentExperience: 'Extensive', updatedAt: '2025-01-08',
  },
  watchlist: [
    { ticker: 'BFBI', addedAt: '2025-02-20' },
    { ticker: 'BFST', addedAt: '2025-01-15' },
  ],
  authorizedAgents: [
    { id: 'aa-201', name: 'David Chen', relationship: 'Child', email: 'david.chen@email.com', level: 'Limited', addedAt: '2021-03-22' },
  ],
  agreements: [
    { id: 'ag-201', title: "Bob's Mutual Funds Customer Agreement", version: '2024.1', type: 'customer', signedAt: '2009-06-01', signature: 'Maria Chen' },
    { id: 'ag-202', title: 'IRA Custodial Agreement & Disclosure',  version: '2024.1', type: 'ira',      signedAt: '2009-06-01', signature: 'Maria Chen' },
    { id: 'ag-203', title: 'Privacy Policy Acknowledgment',         version: '2024.1', type: 'privacy',  signedAt: '2009-06-01', signature: 'Maria Chen' },
  ],
};

// ── Jordan Williams ───────────────────────────────────────────────────────────
const jordanWilliams: Persona = {
  clientId: 'demo-client-003',
  name: 'Jordan Williams',
  age: 28,
  salary: 52000,
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
    { name: 'BobsFunds 500 Index',   ticker: 'BF500',  accountId: 'acc-301', shares: 65.0,  price: 218.40, change: +1.2, value: 14196 },
    { name: 'BobsFunds Growth',      ticker: 'BFGR',   accountId: 'acc-301', shares: 15.0,  price: 341.20, change: +2.1, value: 5118  },
    { name: 'BobsFunds ESG Leaders', ticker: 'BFESG',  accountId: 'acc-302', shares: 25.0,  price: 156.90, change: +1.8, value: 3923  },
  ],
  transactions: [
    { date: '2025-04-01', description: 'Monthly contribution',               amount: +583.33,  account: 'Roth IRA'        },
    { date: '2025-03-28', description: 'Purchase - BobsFunds 500 Index',     amount: -1000.00, account: 'Taxable Account' },
    { date: '2025-03-01', description: 'Monthly contribution',               amount: +583.33,  account: 'Roth IRA'        },
    { date: '2025-02-01', description: 'Monthly contribution',               amount: +583.33,  account: 'Roth IRA'        },
    { date: '2025-01-15', description: 'Purchase - BobsFunds Growth',        amount: -500.00,  account: 'Roth IRA'        },
  ],
  beneficiaries: [
    { id: 'ben-301', accountId: 'acc-301', accountType: 'Roth IRA', type: 'Primary',   name: 'Casey Williams', relationship: 'Sibling', dob: '1993-09-05', ssn: '***-**-7712', percentage: 100 },
    { id: 'ben-302', accountId: 'acc-301', accountType: 'Roth IRA', type: 'Secondary', name: 'Pat Williams',   relationship: 'Parent',  dob: '1965-04-12', ssn: '***-**-3301', percentage: 100 },
  ],
  autoInvest: [
    { id: 'ai-301', accountId: 'acc-301', accountType: 'Roth IRA', fund: 'BobsFunds 500 Index', ticker: 'BF500', amount: 583.33, frequency: 'Monthly', dayOfMonth: 1, nextDate: '2025-05-01', active: true },
  ],
  rmd: { eligible: false },
  bankAccounts: [
    { id: 'bank-301', bankName: 'Pacific Northwest Credit Union', accountType: 'Checking', maskedNumber: '••••5583', primary: true  },
    { id: 'bank-302', bankName: 'Cascade Community Bank',         accountType: 'Savings',  maskedNumber: '••••9027', primary: false },
  ],
  phones: [
    { id: 'ph-003a', type: 'mobile', number: '5035550847', displayNumber: '(503) 555-0847', verified: true,
      sms: { accountAlerts: true, marketing: true, status: 'opted-in', consentedAt: '2024-02-09', disclosureVersion: SMS_DISCLOSURE_VERSION, method: 'web' } },
    { id: 'ph-003b', type: 'work', number: '5035550900', displayNumber: '(503) 555-0900', verified: false,
      sms: { accountAlerts: false, marketing: false, status: 'none' } },
  ],
  emailVerified: false,
  personal: {
    dateOfBirth: '1997-05-27', maritalStatus: 'Single', employmentStatus: 'Employed',
    employer: 'Rose City Creative', occupation: 'Graphic Designer',
    citizenship: 'U.S. Citizen', memberSince: '2021-09-15',
  },
  security: {
    twoFactorEnabled: false, twoFactorMethod: 'email', loginAlerts: true, lastPasswordChange: '2024-12-02',
    recentLogins: [
      { date: '2025-04-14 22:40 ET', device: 'Chrome · Android', location: 'Portland, OR' },
      { date: '2025-04-11 08:15 ET', device: 'Chrome · Windows', location: 'Portland, OR' },
    ],
  },
  preferences: {
    paperlessStatements: true, taxDocDelivery: 'electronic', tradeConfirms: 'electronic',
    prospectusDelivery: 'electronic', proxyDelivery: 'electronic',
    notifyEmail: true, notifySms: true, notifyPush: true, language: 'English', marketing: true,
  },
  trustedContact: null,
  investorProfile: {
    riskProfile: 'Growth', riskScorePct: 74, stocksPct: 80, bondPct: 20, cashPct: 0,
    slices: [
      { name: 'BobsFunds Total Market', ticker: 'BFTM', pct: 53 },
      { name: 'BobsFunds International', ticker: 'BFIN', pct: 27 },
      { name: 'BobsFunds Bond Income',  ticker: 'BFBI', pct: 20 },
    ],
    goals: ['Build long-term wealth', 'Buy a home'], timeHorizon: '10+ years',
    annualIncomeRange: '$50,000–$75,000', netWorthRange: 'Under $100,000',
    investmentExperience: 'Some', updatedAt: '2025-03-18',
  },
  watchlist: [
    { ticker: 'BFGR',  addedAt: '2025-03-10' },
    { ticker: 'BF500', addedAt: '2025-02-28' },
    { ticker: 'BFTM',  addedAt: '2025-02-28' },
  ],
  authorizedAgents: [],
  agreements: [
    { id: 'ag-301', title: "Bob's Mutual Funds Customer Agreement", version: '2024.1',             type: 'customer',    signedAt: '2021-09-15', signature: 'Jordan Williams' },
    { id: 'ag-302', title: 'Electronic Delivery Consent',          version: '2024.1',             type: 'e-delivery',  signedAt: '2021-09-15', signature: 'Jordan Williams' },
    { id: 'ag-303', title: 'Text Messaging Consent (SMS)',         version: SMS_DISCLOSURE_VERSION, type: 'sms-consent', signedAt: '2024-02-09', signature: 'Jordan Williams' },
  ],
};

// ── Robert Martinez ───────────────────────────────────────────────────────────
const robertMartinez: Persona = {
  clientId: 'demo-client-004',
  name: 'Robert Martinez',
  age: 52,        // kids born 2008/2011, self-employed with substantial SEP-IRA
  salary: 140000,
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
    { name: 'BobsFunds 500 Index',         ticker: 'BF500',  accountId: 'acc-401', shares: 380.0,  price: 218.40, change: +1.2, value: 82992  },
    { name: 'BobsFunds Bond Income',       ticker: 'BFBI',   accountId: 'acc-401', shares: 800.0,  price: 98.30,  change: -0.3, value: 78640  },
    { name: 'BobsFunds Growth',            ticker: 'BFGR',   accountId: 'acc-402', shares: 145.0,  price: 341.20, change: +2.1, value: 49474  },
    { name: 'BobsFunds International',     ticker: 'BFIN',   accountId: 'acc-402', shares: 250.0,  price: 87.60,  change: +0.7, value: 21900  },
    { name: 'BobsFunds Short-Term Treas.', ticker: 'BFST',   accountId: 'acc-403', shares: 1100.0, price: 100.10, change: +0.1, value: 110110 },
  ],
  transactions: [
    { date: '2025-04-10', description: 'SEP-IRA Contribution',               amount: +15000.00, account: 'SEP-IRA'         },
    { date: '2025-04-01', description: 'Dividend reinvestment - BFBI',       amount: +374.50,   account: 'SEP-IRA'         },
    { date: '2025-03-28', description: 'Purchase - BobsFunds Bond Income',   amount: -20000.00, account: 'SEP-IRA'         },
    { date: '2025-03-15', description: 'Dividend reinvestment - BF500',      amount: +831.00,   account: 'Taxable Account' },
    { date: '2025-02-15', description: 'Rebalance - Sale BobsFunds Growth',  amount: -10000.00, account: 'Taxable Account' },
  ],
  beneficiaries: [
    { id: 'ben-401', accountId: 'acc-401', accountType: 'SEP-IRA',  type: 'Primary', name: 'Elena Martinez', relationship: 'Spouse', dob: '1976-12-08', ssn: '***-**-2241', percentage: 100 },
    { id: 'ben-402', accountId: 'acc-402', accountType: 'Roth IRA', type: 'Primary', name: 'Elena Martinez', relationship: 'Spouse', dob: '1976-12-08', ssn: '***-**-2241', percentage: 60  },
    { id: 'ben-403', accountId: 'acc-402', accountType: 'Roth IRA', type: 'Primary', name: 'Sofia Martinez', relationship: 'Child',  dob: '2008-03-19', ssn: '***-**-6618', percentage: 20  },
    { id: 'ben-404', accountId: 'acc-402', accountType: 'Roth IRA', type: 'Primary', name: 'Marco Martinez', relationship: 'Child',  dob: '2011-08-14', ssn: '***-**-7723', percentage: 20  },
  ],
  autoInvest: [
    { id: 'ai-401', accountId: 'acc-401', accountType: 'SEP-IRA', fund: 'BobsFunds 500 Index', ticker: 'BF500', amount: 5000, frequency: 'Quarterly', nextDate: '2025-07-01', active: true },
    { id: 'ai-402', accountId: 'acc-401', accountType: 'SEP-IRA', fund: 'BobsFunds Bond Income', ticker: 'BFBI', amount: 2500, frequency: 'Quarterly', nextDate: '2025-07-01', active: true },
  ],
  rmd: { eligible: false },
  bankAccounts: [
    { id: 'bank-401', bankName: 'Lone Star National Bank',         accountType: 'Checking', maskedNumber: '••••8847', primary: true  },
    { id: 'bank-402', bankName: 'Gulf Coast Federal Credit Union', accountType: 'Savings',  maskedNumber: '••••3319', primary: false },
  ],
  phones: [
    { id: 'ph-004a', type: 'mobile', number: '7135550234', displayNumber: '(713) 555-0234', verified: true,
      sms: { accountAlerts: true, marketing: false, status: 'opted-in', consentedAt: '2024-05-21', disclosureVersion: SMS_DISCLOSURE_VERSION, method: 'web' } },
    { id: 'ph-004b', type: 'work', number: '7135550588', displayNumber: '(713) 555-0588', verified: true,
      sms: { accountAlerts: true, marketing: false, status: 'opted-in', consentedAt: '2024-05-21', disclosureVersion: SMS_DISCLOSURE_VERSION, method: 'web' } },
  ],
  emailVerified: true,
  personal: {
    dateOfBirth: '1973-11-30', maritalStatus: 'Married', employmentStatus: 'Self-employed',
    employer: 'Martinez Consulting LLC', occupation: 'Business Owner / Consultant',
    citizenship: 'U.S. Citizen', memberSince: '2014-02-20',
  },
  security: {
    twoFactorEnabled: true, twoFactorMethod: 'app', loginAlerts: true, lastPasswordChange: '2025-03-01',
    recentLogins: [
      { date: '2025-04-14 13:05 ET', device: 'Chrome · Windows', location: 'Houston, TX' },
      { date: '2025-04-12 09:30 ET', device: 'Safari · iPhone',  location: 'Houston, TX' },
    ],
  },
  preferences: {
    paperlessStatements: true, taxDocDelivery: 'electronic', tradeConfirms: 'electronic',
    prospectusDelivery: 'electronic', proxyDelivery: 'mail',
    notifyEmail: true, notifySms: true, notifyPush: false, language: 'English', marketing: false,
  },
  trustedContact: { name: 'Elena Martinez', relationship: 'Spouse', phone: '(713) 555-0299', email: 'elena.martinez@email.com' },
  investorProfile: {
    riskProfile: 'Growth', riskScorePct: 64, stocksPct: 80, bondPct: 20, cashPct: 0,
    slices: [
      { name: 'BobsFunds Total Market', ticker: 'BFTM', pct: 53 },
      { name: 'BobsFunds International', ticker: 'BFIN', pct: 27 },
      { name: 'BobsFunds Bond Income',  ticker: 'BFBI', pct: 20 },
    ],
    goals: ['Retirement', 'Tax-efficient growth', "Fund children's education"], timeHorizon: '10+ years',
    annualIncomeRange: '$150,000+', netWorthRange: '$500,000–$750,000',
    investmentExperience: 'Good', updatedAt: '2025-02-02',
  },
  watchlist: [
    { ticker: 'BFGR', addedAt: '2025-03-05' },
    { ticker: 'BFIN', addedAt: '2025-01-20' },
  ],
  authorizedAgents: [
    { id: 'aa-401', name: 'Elena Martinez', relationship: 'Spouse',     email: 'elena.martinez@email.com', level: 'Full',      addedAt: '2015-06-10' },
    { id: 'aa-402', name: 'Raymond Ortiz',  relationship: 'Accountant', email: 'r.ortiz@ortizcpa.com',     level: 'View only', addedAt: '2019-01-30' },
  ],
  agreements: [
    { id: 'ag-401', title: "Bob's Mutual Funds Customer Agreement", version: '2024.1',             type: 'customer',    signedAt: '2014-02-20', signature: 'Robert Martinez' },
    { id: 'ag-402', title: 'SEP Plan Adoption Agreement',          version: '2024.1',             type: 'sep',         signedAt: '2014-02-20', signature: 'Robert Martinez' },
    { id: 'ag-403', title: 'Electronic Delivery Consent',          version: '2024.1',             type: 'e-delivery',  signedAt: '2014-02-20', signature: 'Robert Martinez' },
    { id: 'ag-404', title: 'Text Messaging Consent (SMS)',         version: SMS_DISCLOSURE_VERSION, type: 'sms-consent', signedAt: '2024-05-21', signature: 'Robert Martinez' },
  ],
};

export const PERSONAS: Persona[] = [alexJohnson, mariaChen, jordanWilliams, robertMartinez];

export const PERSONA_MAP: Record<string, Persona> = Object.fromEntries(
  PERSONAS.map(p => [p.clientId, p]),
);
