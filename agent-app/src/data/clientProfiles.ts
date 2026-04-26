// Client profiles mirror for agent app — keyed by clientId.
// Used by ChatColumn to pass the correct client context to AI Lambda calls.

export interface ClientProfile {
  clientId: string;
  name: string;
  phone: string;
  accounts: { type: string; balance: number; id: string }[];
  totalBalance: number;
  recentChatHistory: { date: string; topic: string; summary: string }[];
  intents?: { label: string; summary: string }[];
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
    intents: [
      {
        label: 'Roth conversion strategy',
        summary: 'Alex wants to understand whether it makes sense to convert a portion of his Traditional IRA to a Roth IRA this year given his current tax bracket.',
      },
      {
        label: 'Taxable account rebalancing',
        summary: 'Alex noticed his taxable account has drifted heavily toward tech stocks and wants to discuss rebalancing and potential tax-loss harvesting opportunities.',
      },
      {
        label: 'Increase Roth IRA contribution',
        summary: 'Alex wants to set up automatic monthly contributions to his Roth IRA and confirm he hasn\'t exceeded the annual contribution limit.',
      },
      {
        label: 'Retirement timeline check',
        summary: 'Alex is 38 and wants a gut-check on whether his current savings rate and allocation put him on track for retirement at 65.',
      },
    ],
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
    intents: [
      {
        label: 'Required Minimum Distribution calculation',
        summary: 'Maria turned 73 this year and needs help calculating her first RMD from her Traditional IRA — she wants to know the exact amount and the deadline to avoid the penalty.',
      },
      {
        label: 'Move to capital preservation during volatility',
        summary: 'Maria is concerned about recent market swings and wants to shift a meaningful portion of her IRA into a stable-value or money market fund temporarily.',
      },
      {
        label: 'Update beneficiary designations',
        summary: 'Maria recently remarried and wants to update the beneficiary on both her IRA and taxable account to reflect her new spouse and revise the contingent beneficiaries.',
      },
      {
        label: 'Systematic withdrawal planning',
        summary: 'Maria is fully retired and wants to set up a monthly withdrawal from her taxable account to cover living expenses while leaving her IRA to grow as long as possible.',
      },
    ],
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
    intents: [
      {
        label: 'First-time fund selection',
        summary: 'Jordan just opened their Roth IRA six months ago and left it in the default money market — they want guidance on which funds to invest in and how to think about risk at their age.',
      },
      {
        label: 'Set up automatic contributions',
        summary: 'Jordan wants to automate a $200/month contribution to their Roth IRA so they can hit the annual limit over time without having to think about it.',
      },
      {
        label: 'Emergency fund vs. investing',
        summary: 'Jordan has $4,800 in their taxable account and is unsure whether to keep it as an emergency fund or invest it — they want help thinking through the tradeoff.',
      },
      {
        label: 'Understanding account types',
        summary: 'Jordan\'s new employer offers a 401(k) and Jordan wants to understand how it fits alongside their existing Roth IRA and whether they should prioritize one over the other.',
      },
    ],
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
    intents: [
      {
        label: 'Maximize SEP-IRA contribution',
        summary: 'Robert had a strong revenue year and wants to confirm the maximum SEP-IRA contribution he can make before the tax filing deadline and how to initiate the deposit.',
      },
      {
        label: 'Roth conversion in a down year',
        summary: 'Robert\'s business income is lower than usual this year and he wants to explore converting a portion of his SEP-IRA to Roth to take advantage of the lower tax bracket.',
      },
      {
        label: 'Taxable account concentration concern',
        summary: 'Robert realizes that about 60% of his taxable account is in a single sector and wants to discuss a gradual diversification plan that minimizes the tax hit from selling.',
      },
      {
        label: 'Compare SEP-IRA vs. Solo 401(k)',
        summary: 'Robert is considering switching from a SEP-IRA to a Solo 401(k) for next year to allow for Roth contributions and higher limits — he wants a side-by-side comparison.',
      },
    ],
  },
];

export const CLIENT_PROFILES: Record<string, ClientProfile> = Object.fromEntries(
  profiles.map(p => [p.clientId, p]),
);

export const DEFAULT_PROFILE = profiles[0];
