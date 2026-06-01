export const MOCK_CLIENT = {
  clientId: 'demo-client-001',
  name: 'Alex Johnson',
  phone: '4842384838',
  displayPhone: '(484) 238-4838',
  accounts: [
    { type: 'Roth IRA',          balance: 45230,  id: 'acc-001', change: +4.2 },
    { type: 'Traditional IRA',   balance: 128450, id: 'acc-002', change: +2.8 },
    { type: 'Taxable Account',   balance: 67890,  id: 'acc-003', change: -0.9 },
  ],
  totalBalance: 241570,
  holdings: [
    { name: "BobsFunds 500 Index",        ticker: "BF500", shares: 142.3, price: 218.40, change: +1.2, value: 31072 },
    { name: "BobsFunds Growth",           ticker: "BFGR",  shares: 88.1,  price: 341.20, change: +2.1, value: 30060 },
    { name: "BobsFunds Bond Income",      ticker: "BFBI",  shares: 210.0, price: 98.30,  change: -0.3, value: 20643 },
    { name: "BobsFunds International",    ticker: "BFIN",  shares: 55.4,  price: 87.60,  change: +0.7, value: 4853  },
    { name: "BobsFunds ESG Leaders",      ticker: "BFESG", shares: 31.2,  price: 156.90, change: +1.8, value: 4895  },
    { name: "BobsFunds Short-Term Treas", ticker: "BFST",  shares: 499.8, price: 100.10, change: +0.1, value: 50030 },
  ],
  transactions: [
    { date: '2025-04-10', description: 'Dividend reinvestment - BF500', amount: +124.20, account: 'Roth IRA' },
    { date: '2025-04-01', description: 'Contribution', amount: +583.33, account: 'Roth IRA' },
    { date: '2025-03-28', description: 'Purchase - BobsFunds Growth', amount: -5000.00, account: 'Taxable Account' },
    { date: '2025-03-15', description: 'Dividend reinvestment - BFBI', amount: +62.40, account: 'Traditional IRA' },
    { date: '2025-03-01', description: 'Contribution', amount: +583.33, account: 'Roth IRA' },
  ],
};

export { FUNDS } from './funds';

export const MARKET_DATA = [
  { name: 'S&P 500',  value: '5,248.33', change: '+0.83%', up: true },
  { name: 'Dow Jones', value: '39,127.14', change: '+0.44%', up: true },
  { name: 'NASDAQ',   value: '16,394.21', change: '+1.02%', up: true },
];
