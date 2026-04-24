// Client profiles mirror for agent app — keyed by clientId.
// Used by ChatColumn to pass the correct client context to AI Lambda calls.

export interface ClientProfile {
  clientId: string;
  name: string;
  phone: string;
  accounts: { type: string; balance: number; id: string }[];
  totalBalance: number;
  recentChatHistory: { date: string; topic: string; summary: string }[];
}

const profiles: ClientProfile[] = [
  {
    clientId: 'demo-client-001',
    name: 'Alex Johnson',
    phone: '4842384838',
    accounts: [
      { type: 'Roth IRA',        balance: 45230,  id: 'acc-001' },
      { type: 'Traditional IRA', balance: 128450, id: 'acc-002' },
      { type: 'Taxable Account', balance: 67890,  id: 'acc-003' },
    ],
    totalBalance: 241570,
    recentChatHistory: [],
  },
  {
    clientId: 'demo-client-002',
    name: 'Maria Chen',
    phone: '6175550192',
    accounts: [
      { type: 'Traditional IRA', balance: 612000, id: 'acc-201' },
      { type: 'Taxable Account', balance: 278000, id: 'acc-202' },
    ],
    totalBalance: 890000,
    recentChatHistory: [],
  },
  {
    clientId: 'demo-client-003',
    name: 'Jordan Williams',
    phone: '5035550847',
    accounts: [
      { type: 'Roth IRA',        balance: 18500, id: 'acc-301' },
      { type: 'Taxable Account', balance: 4800,  id: 'acc-302' },
    ],
    totalBalance: 23300,
    recentChatHistory: [],
  },
  {
    clientId: 'demo-client-004',
    name: 'Robert Martinez',
    phone: '7135550234',
    accounts: [
      { type: 'SEP-IRA',         balance: 285000, id: 'acc-401' },
      { type: 'Roth IRA',        balance: 42000,  id: 'acc-402' },
      { type: 'Taxable Account', balance: 118000, id: 'acc-403' },
    ],
    totalBalance: 445000,
    recentChatHistory: [],
  },
];

export const CLIENT_PROFILES: Record<string, ClientProfile> = Object.fromEntries(
  profiles.map(p => [p.clientId, p]),
);

export const DEFAULT_PROFILE = profiles[0];
