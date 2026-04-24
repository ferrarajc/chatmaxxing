// All client personas for the Bob's Mutual Funds demo.
// Each persona is a self-contained dataset that drives every page in the customer app.

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
};

export const PERSONAS: Persona[] = [alexJohnson, mariaChen, jordanWilliams, robertMartinez];

export const PERSONA_MAP: Record<string, Persona> = Object.fromEntries(
  PERSONAS.map(p => [p.clientId, p]),
);
