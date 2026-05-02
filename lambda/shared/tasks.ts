export interface TaskField {
  key: string;
  label: string;
  question: string;
  type: 'text' | 'phone' | 'datetime' | 'enum' | 'amount' | 'boolean';
  options?: string[];
  required: boolean;
  /** Lambda pre-filters: only include if client has more than one account */
  requiresMultipleAccounts?: boolean;
  /** Lambda pre-filters: only include if client has one of these account types */
  requiresAccountTypes?: string[];
  /** Lambda pre-filters: exclude when another collected field equals a value */
  skipWhenFieldIs?: { field: string; value: string };
}

export interface Task {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  eligibleAccountTypes?: string[];
  fields: TaskField[];
  executionType: 'real' | 'mock';
}

export const TASKS: Task[] = [
  {
    id: 'update-contact-info',
    name: 'Update Contact Information',
    description: "Update the client's phone number, email address, or mailing address on file.",
    keywords: ['contact', 'phone number', 'email', 'address', 'update my number', 'change my number', 'change my email', 'mailing', 'update contact'],
    fields: [
      {
        key: 'infoType',
        label: 'What to update',
        question: 'What would you like to update — your phone number, email address, or mailing address?',
        type: 'enum',
        options: ['Phone number', 'Email address', 'Mailing address'],
        required: true,
      },
      {
        key: 'newValue',
        label: 'New value',
        question: 'What is the new value you\'d like us to have on file?',
        type: 'text',
        required: true,
      },
    ],
    executionType: 'mock',
  },

  {
    id: 'update-beneficiaries',
    name: 'Change Beneficiary Designations',
    description: 'Add, remove, or update a beneficiary on one of the client\'s accounts.',
    keywords: ['beneficiary', 'beneficiaries', 'inherit', 'designation', 'who gets', 'leave to', 'upon death', 'change beneficiary', 'add beneficiary'],
    fields: [
      {
        key: 'accountId',
        label: 'Account',
        question: 'Which account would you like to update beneficiaries on?',
        type: 'text',
        required: true,
        requiresMultipleAccounts: true,
      },
      {
        key: 'action',
        label: 'Action',
        question: 'Would you like to add a new beneficiary, update an existing one, or remove one?',
        type: 'enum',
        options: ['Add', 'Update', 'Remove'],
        required: true,
      },
      {
        key: 'beneficiaryName',
        label: 'Beneficiary name',
        question: 'What is the full name of the beneficiary?',
        type: 'text',
        required: true,
      },
      {
        key: 'relationship',
        label: 'Relationship to client',
        question: 'What is their relationship to you (e.g. spouse, child, sibling, parent)?',
        type: 'text',
        required: true,
        skipWhenFieldIs: { field: 'action', value: 'Remove' },
      },
      {
        key: 'percentage',
        label: 'Percentage of account',
        question: 'What percentage of the account should go to this beneficiary?',
        type: 'amount',
        required: true,
        skipWhenFieldIs: { field: 'action', value: 'Remove' },
      },
      {
        key: 'beneficiaryType',
        label: 'Primary or contingent',
        question: 'Should this be a primary beneficiary or a contingent (backup) beneficiary?',
        type: 'enum',
        options: ['Primary', 'Contingent'],
        required: true,
        skipWhenFieldIs: { field: 'action', value: 'Remove' },
      },
    ],
    executionType: 'real',
  },

  {
    id: 'add-account-access',
    name: 'Add Authorized Account User',
    description: 'Grant another person access to the client\'s account — full trading access or view-only.',
    keywords: ['add access', 'authorized user', 'account access', 'give access', 'add someone', 'add person', 'view-only', 'joint', 'shared access', 'grant access'],
    fields: [
      {
        key: 'personName',
        label: 'Person\'s full name',
        question: 'What is the full name of the person you\'d like to add?',
        type: 'text',
        required: true,
      },
      {
        key: 'personEmail',
        label: 'Person\'s email address',
        question: 'What is their email address? We\'ll use this to set up their login.',
        type: 'text',
        required: true,
      },
      {
        key: 'accessLevel',
        label: 'Access level',
        question: 'What level of access should they have? Options are: Full trading access (can buy/sell), View-only (can see balances but not trade), or Limited (can manage profile but not trade).',
        type: 'enum',
        options: ['Full trading', 'View-only', 'Limited'],
        required: true,
      },
    ],
    executionType: 'mock',
  },

  {
    id: 'open-account',
    name: 'Open a New Account',
    description: 'Open a new investment account — Roth IRA, Traditional IRA, SEP-IRA, or Taxable.',
    keywords: ['open account', 'new account', 'open a', 'start an ira', 'create account', 'open roth', 'open traditional', 'open sep', 'open taxable'],
    fields: [
      {
        key: 'accountType',
        label: 'Account type',
        question: 'Which type of account would you like to open? Options are: Roth IRA, Traditional IRA, SEP-IRA, or Taxable (individual brokerage).',
        type: 'enum',
        options: ['Roth IRA', 'Traditional IRA', 'SEP-IRA', 'Taxable'],
        required: true,
      },
      {
        key: 'initialAmount',
        label: 'Initial contribution',
        question: 'How much would you like to contribute to start? (Minimum is $0 — you can add funds later.)',
        type: 'amount',
        required: true,
      },
      {
        key: 'fundingSource',
        label: 'Funding source',
        question: 'How would you like to fund the account — by bank transfer (ACH), check, or rollover from another institution?',
        type: 'enum',
        options: ['Bank transfer (ACH)', 'Check', 'Rollover'],
        required: true,
      },
    ],
    executionType: 'mock',
  },

  {
    id: 'place-purchase',
    name: 'Buy / Make a Contribution',
    description: 'Purchase shares of a BobsFunds fund or make a lump-sum contribution to an account.',
    keywords: ['buy', 'purchase', 'contribute', 'add money', 'invest', 'make a contribution', 'put money in', 'lump sum'],
    fields: [
      {
        key: 'accountId',
        label: 'Account',
        question: 'Which account would you like to purchase into?',
        type: 'text',
        required: true,
        requiresMultipleAccounts: true,
      },
      {
        key: 'fund',
        label: 'Fund',
        question: 'Which fund would you like to purchase? Options: BF500 (500 Index), BFGR (Growth), BFBI (Bond Income), BFIN (International), BFESG (ESG Leaders), BFST (Short-Term Bond).',
        type: 'enum',
        options: ['BF500', 'BFGR', 'BFBI', 'BFIN', 'BFESG', 'BFST'],
        required: true,
      },
      {
        key: 'amount',
        label: 'Purchase amount',
        question: 'How much would you like to purchase (in dollars)?',
        type: 'amount',
        required: true,
      },
      {
        key: 'fundingSource',
        label: 'Funding source',
        question: 'Should we fund this from your linked bank account on file, or from cash already in the account?',
        type: 'enum',
        options: ['Linked bank account', 'Cash in account'],
        required: true,
      },
    ],
    executionType: 'mock',
  },

  {
    id: 'place-sale',
    name: 'Sell Fund Shares',
    description: 'Sell shares in a BobsFunds fund within one of the client\'s accounts.',
    keywords: ['sell', 'redeem', 'liquidate', 'sell shares', 'sell my', 'get out of', 'exit position'],
    fields: [
      {
        key: 'accountId',
        label: 'Account',
        question: 'Which account would you like to sell from?',
        type: 'text',
        required: true,
        requiresMultipleAccounts: true,
      },
      {
        key: 'fund',
        label: 'Fund to sell',
        question: 'Which fund would you like to sell? Options: BF500, BFGR, BFBI, BFIN, BFESG, BFST.',
        type: 'enum',
        options: ['BF500', 'BFGR', 'BFBI', 'BFIN', 'BFESG', 'BFST'],
        required: true,
      },
      {
        key: 'amount',
        label: 'Amount or shares',
        question: 'How much would you like to sell — a dollar amount (e.g. "$5,000") or all shares ("full redemption")?',
        type: 'text',
        required: true,
      },
      {
        key: 'reason',
        label: 'Reason for sale',
        question: 'Is this sale for a withdrawal, a fund exchange, or rebalancing?',
        type: 'enum',
        options: ['Withdrawal', 'Fund exchange', 'Rebalancing', 'Other'],
        required: true,
      },
    ],
    executionType: 'mock',
  },

  {
    id: 'exchange-funds',
    name: 'Exchange Between Funds',
    description: 'Move money from one BobsFunds fund to another within the same account.',
    keywords: ['exchange', 'switch funds', 'move from', 'move to', 'swap funds', 'transfer between funds', 'reallocate'],
    fields: [
      {
        key: 'accountId',
        label: 'Account',
        question: 'Which account would you like to exchange within?',
        type: 'text',
        required: true,
        requiresMultipleAccounts: true,
      },
      {
        key: 'fromFund',
        label: 'Fund to exchange out of',
        question: 'Which fund would you like to move money out of?',
        type: 'enum',
        options: ['BF500', 'BFGR', 'BFBI', 'BFIN', 'BFESG', 'BFST'],
        required: true,
      },
      {
        key: 'toFund',
        label: 'Fund to exchange into',
        question: 'Which fund would you like to move money into?',
        type: 'enum',
        options: ['BF500', 'BFGR', 'BFBI', 'BFIN', 'BFESG', 'BFST'],
        required: true,
      },
      {
        key: 'amount',
        label: 'Amount to exchange',
        question: 'How much would you like to exchange — a specific dollar amount, or the full balance of that fund?',
        type: 'text',
        required: true,
      },
    ],
    executionType: 'mock',
  },

  {
    id: 'toggle-drip',
    name: 'Change Dividend Reinvestment (DRIP)',
    description: 'Enable or disable automatic dividend reinvestment for a fund.',
    keywords: ['dividend', 'drip', 'reinvest', 'dividend reinvestment', 'reinvestment', 'dividends'],
    fields: [
      {
        key: 'accountId',
        label: 'Account',
        question: 'Which account would you like to change dividend settings for?',
        type: 'text',
        required: true,
        requiresMultipleAccounts: true,
      },
      {
        key: 'fund',
        label: 'Fund',
        question: 'Which fund would you like to change the dividend setting for?',
        type: 'enum',
        options: ['BF500', 'BFGR', 'BFBI', 'BFIN', 'BFESG', 'BFST'],
        required: true,
      },
      {
        key: 'dripEnabled',
        label: 'Enable or disable',
        question: 'Would you like to turn dividend reinvestment ON (automatically buy more shares) or OFF (receive dividends as cash)?',
        type: 'enum',
        options: ['Turn ON (reinvest)', 'Turn OFF (receive as cash)'],
        required: true,
      },
    ],
    executionType: 'mock',
  },

  {
    id: 'setup-auto-invest',
    name: 'Set Up Automatic Investment',
    description: 'Create a new recurring automatic investment into a fund.',
    keywords: ['set up auto', 'automatic investment', 'recurring investment', 'auto invest', 'automatic contribute', 'schedule investment', 'monthly investment'],
    fields: [
      {
        key: 'accountId',
        label: 'Account',
        question: 'Which account would you like to set up automatic investing for?',
        type: 'text',
        required: true,
        requiresMultipleAccounts: true,
      },
      {
        key: 'fund',
        label: 'Fund',
        question: 'Which fund should the automatic investment go into?',
        type: 'enum',
        options: ['BF500', 'BFGR', 'BFBI', 'BFIN', 'BFESG', 'BFST'],
        required: true,
      },
      {
        key: 'amount',
        label: 'Investment amount',
        question: 'How much would you like to invest each time?',
        type: 'amount',
        required: true,
      },
      {
        key: 'frequency',
        label: 'Frequency',
        question: 'How often should this investment occur — monthly or quarterly?',
        type: 'enum',
        options: ['Monthly', 'Quarterly'],
        required: true,
      },
      {
        key: 'dayOfMonth',
        label: 'Day of month',
        question: 'Which day of the month should we process the investment (1–28)?',
        type: 'text',
        required: true,
      },
    ],
    executionType: 'real',
  },

  {
    id: 'update-auto-invest',
    name: 'Modify Auto-Invest Schedule',
    description: 'Change the amount, frequency, or day for an existing automatic investment schedule.',
    keywords: ['change auto invest', 'update auto invest', 'modify auto invest', 'change automatic', 'update automatic', 'change recurring', 'update my investment schedule'],
    fields: [
      {
        key: 'scheduleDescription',
        label: 'Which schedule',
        question: 'Which automatic investment schedule would you like to change? (Please describe it, e.g. "the monthly $500 into BF500 in my Roth IRA.")',
        type: 'text',
        required: true,
      },
      {
        key: 'amount',
        label: 'New investment amount',
        question: 'What should the new investment amount be?',
        type: 'amount',
        required: true,
      },
      {
        key: 'frequency',
        label: 'New frequency',
        question: 'Should it continue at the same frequency, or change to monthly or quarterly?',
        type: 'enum',
        options: ['Monthly', 'Quarterly', 'Keep the same'],
        required: true,
      },
      {
        key: 'dayOfMonth',
        label: 'Day of month',
        question: 'What day of the month should it process on (1–28)? Or should we keep the current day?',
        type: 'text',
        required: true,
      },
    ],
    executionType: 'real',
  },

  {
    id: 'pause-auto-invest',
    name: 'Pause or Resume Auto-Invest',
    description: 'Temporarily pause or resume an existing automatic investment schedule.',
    keywords: ['pause auto', 'stop auto', 'pause automatic', 'suspend automatic', 'resume auto', 'restart auto', 'resume automatic', 'turn off auto invest', 'disable auto'],
    fields: [
      {
        key: 'scheduleDescription',
        label: 'Which schedule',
        question: 'Which automatic investment would you like to pause or resume? (e.g. "the monthly $500 into BF500 in my Roth IRA")',
        type: 'text',
        required: true,
      },
      {
        key: 'action',
        label: 'Pause or resume',
        question: 'Would you like to pause this schedule (stop temporarily) or resume it (restart)?',
        type: 'enum',
        options: ['Pause', 'Resume'],
        required: true,
      },
    ],
    executionType: 'real',
  },

  {
    id: 'request-withdrawal',
    name: 'Request a Distribution',
    description: 'Request a one-time withdrawal or distribution from an investment account.',
    keywords: ['withdrawal', 'withdraw', 'take out', 'distribution', 'take money', 'cash out', 'pull funds', 'need money', 'take a distribution'],
    fields: [
      {
        key: 'accountId',
        label: 'Account',
        question: 'Which account would you like to withdraw from?',
        type: 'text',
        required: true,
        requiresMultipleAccounts: true,
      },
      {
        key: 'amount',
        label: 'Amount',
        question: 'How much would you like to withdraw?',
        type: 'amount',
        required: true,
      },
      {
        key: 'deliveryMethod',
        label: 'Delivery method',
        question: 'How would you like to receive the funds — direct deposit to your bank account on file, or a check by mail?',
        type: 'enum',
        options: ['Direct deposit (ACH)', 'Check by mail'],
        required: true,
      },
      {
        key: 'taxWithholding',
        label: 'Federal tax withholding',
        question: 'Would you like us to withhold federal income tax from this distribution? If yes, what percentage (standard is 10%)?',
        type: 'text',
        required: true,
        requiresAccountTypes: ['Traditional IRA', 'SEP-IRA'],
      },
    ],
    executionType: 'mock',
  },

  {
    id: 'setup-systematic-withdrawal',
    name: 'Set Up Recurring Distributions',
    description: 'Create a scheduled recurring withdrawal (e.g. monthly income in retirement).',
    keywords: ['systematic withdrawal', 'recurring withdrawal', 'monthly withdrawal', 'regular distribution', 'monthly income', 'set up withdrawals', 'automatic withdrawal', 'schedule withdrawals'],
    fields: [
      {
        key: 'accountId',
        label: 'Account',
        question: 'Which account would you like to set up recurring withdrawals from?',
        type: 'text',
        required: true,
        requiresMultipleAccounts: true,
      },
      {
        key: 'amount',
        label: 'Amount per period',
        question: 'How much would you like withdrawn each time?',
        type: 'amount',
        required: true,
      },
      {
        key: 'frequency',
        label: 'Frequency',
        question: 'How often should the withdrawal occur — monthly, quarterly, or annually?',
        type: 'enum',
        options: ['Monthly', 'Quarterly', 'Annually'],
        required: true,
      },
      {
        key: 'startDate',
        label: 'Start date',
        question: 'When would you like the first withdrawal to occur?',
        type: 'datetime',
        required: true,
      },
      {
        key: 'deliveryMethod',
        label: 'Delivery method',
        question: 'How would you like to receive the funds — direct deposit to your bank or a check by mail?',
        type: 'enum',
        options: ['Direct deposit (ACH)', 'Check by mail'],
        required: true,
      },
    ],
    executionType: 'mock',
  },

  {
    id: 'update-rmd-settings',
    name: 'Update RMD Settings',
    description: "Change the delivery method, frequency, or tax withholding for the client's Required Minimum Distribution.",
    keywords: ['rmd', 'required minimum', 'minimum distribution', 'rmd settings', 'rmd delivery', 'rmd withholding', 'update rmd'],
    eligibleAccountTypes: ['Traditional IRA', 'SEP-IRA'],
    fields: [
      {
        key: 'deliveryMethod',
        label: 'RMD delivery method',
        question: 'How would you like to receive your RMD — direct deposit to your bank account, or a check by mail?',
        type: 'enum',
        options: ['Direct deposit (ACH)', 'Check by mail'],
        required: true,
      },
      {
        key: 'frequency',
        label: 'RMD frequency',
        question: 'Would you like to receive your RMD as one lump sum in December, or spread out monthly or quarterly throughout the year?',
        type: 'enum',
        options: ['Annual (December)', 'Monthly', 'Quarterly'],
        required: true,
      },
      {
        key: 'taxWithholding',
        label: 'Federal tax withholding percentage',
        question: 'What percentage of federal income tax would you like withheld from each RMD payment? (0% to 99%; default is 10%.)',
        type: 'amount',
        required: true,
      },
    ],
    executionType: 'real',
  },

  {
    id: 'initiate-rollover',
    name: 'Roll Over From Another Institution',
    description: "Start the process of transferring assets from an employer plan or another firm into Bob's Mutual Funds.",
    keywords: ['rollover', 'roll over', 'transfer in', '401k', 'transfer from', 'bring in', 'incoming transfer', 'move my 401'],
    fields: [
      {
        key: 'sourceInstitution',
        label: 'Source institution',
        question: 'Which institution or employer plan are you rolling over from? (e.g. "Fidelity 401k from my last employer")',
        type: 'text',
        required: true,
      },
      {
        key: 'sourceAccountType',
        label: 'Source account type',
        question: 'What type of account is it — a traditional 401(k), Roth 401(k), 403(b), or IRA?',
        type: 'enum',
        options: ['Traditional 401(k)', 'Roth 401(k)', '403(b)', 'Traditional IRA', 'Other'],
        required: true,
      },
      {
        key: 'estimatedAmount',
        label: 'Estimated rollover amount',
        question: 'Approximately how much are you rolling over?',
        type: 'amount',
        required: true,
      },
      {
        key: 'targetAccountId',
        label: 'Receiving account',
        question: 'Which Bob\'s Mutual Funds account should receive the rollover?',
        type: 'text',
        required: true,
        requiresMultipleAccounts: true,
      },
    ],
    executionType: 'mock',
  },

  {
    id: 'roth-conversion',
    name: 'Convert to Roth IRA',
    description: 'Convert all or part of a Traditional IRA or SEP-IRA to a Roth IRA (taxable event).',
    keywords: ['roth conversion', 'convert to roth', 'roth convert', 'backdoor roth', 'traditional to roth', 'sep to roth'],
    eligibleAccountTypes: ['Traditional IRA', 'SEP-IRA'],
    fields: [
      {
        key: 'fromAccountId',
        label: 'Source account',
        question: 'Which account would you like to convert from — your Traditional IRA, SEP-IRA, or both?',
        type: 'text',
        required: true,
      },
      {
        key: 'amount',
        label: 'Conversion amount',
        question: 'How much would you like to convert — a specific dollar amount, or the full balance?',
        type: 'text',
        required: true,
      },
      {
        key: 'taxYear',
        label: 'Tax year',
        question: 'Which tax year should this conversion be credited to?',
        type: 'enum',
        options: ['2025', '2026'],
        required: true,
      },
    ],
    executionType: 'mock',
  },

  {
    id: 'request-tax-document',
    name: 'Request Tax Document',
    description: 'Request a copy of a specific tax form.',
    keywords: ['tax document', 'tax form', '1099', '5498', '1099-r', '1099-div', 'tax paperwork', 'request form', 'tax year'],
    fields: [
      {
        key: 'formType',
        label: 'Form type',
        question: 'Which tax form do you need? Options: 1099-R (retirement distributions), 1099-B (proceeds from sales), 1099-DIV (dividends), or Form 5498 (IRA contributions).',
        type: 'enum',
        options: ['1099-R', '1099-B', '1099-DIV', '5498'],
        required: true,
      },
      {
        key: 'taxYear',
        label: 'Tax year',
        question: 'For which tax year?',
        type: 'enum',
        options: ['2024', '2023', '2022'],
        required: true,
      },
    ],
    executionType: 'mock',
  },

  {
    id: 'cancel-reschedule-callback',
    name: 'Cancel or Reschedule Callback',
    description: "Cancel or reschedule an existing callback that was previously arranged.",
    keywords: ['cancel callback', 'reschedule callback', 'cancel my call', 'change my callback', 'move my callback', 'cancel the call', 'reschedule the call'],
    fields: [
      {
        key: 'action',
        label: 'Action',
        question: 'Would you like to cancel the callback entirely, or reschedule it for a different time?',
        type: 'enum',
        options: ['Cancel', 'Reschedule'],
        required: true,
      },
      {
        key: 'newScheduledTime',
        label: 'New callback time',
        question: 'What day and time would you prefer for the callback?',
        type: 'datetime',
        required: true,
        skipWhenFieldIs: { field: 'action', value: 'Cancel' },
      },
    ],
    executionType: 'mock',
  },

  {
    id: 'update-security',
    name: 'Update Security Settings',
    description: "Update the client's account security — password, two-factor authentication, or trusted devices.",
    keywords: ['security', 'password', 'two-factor', '2fa', 'two factor', 'change password', 'account security', 'trusted device', 'login', 'locked out'],
    fields: [
      {
        key: 'securityAction',
        label: 'Security action',
        question: 'What would you like to update? Options: Change password, Enable two-factor authentication, Disable two-factor authentication, or Remove a trusted device.',
        type: 'enum',
        options: ['Change password', 'Enable 2FA', 'Disable 2FA', 'Remove trusted device'],
        required: true,
      },
    ],
    executionType: 'mock',
  },
];

/** Match a task to a free-text intent string using keyword scoring */
export function matchTaskByIntent(intent: string, accountTypes: string[]): Task | undefined {
  const lower = intent.toLowerCase();
  const scored = TASKS
    .filter(t =>
      !t.eligibleAccountTypes ||
      t.eligibleAccountTypes.some(at => accountTypes.includes(at))
    )
    .map(t => ({
      task: t,
      score: t.keywords.filter(kw => lower.includes(kw)).length,
    }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.task;
}

/** Filter a task's fields based on client context */
export function filterFields(
  task: Task,
  accountTypes: string[],
  accountCount: number,
  collectedSoFar: Record<string, string>,
): TaskField[] {
  return task.fields.filter(f => {
    // Skip accountId if only one account
    if (f.requiresMultipleAccounts && accountCount <= 1) return false;
    // Skip fields that require specific account types the client doesn't have
    if (f.requiresAccountTypes && !f.requiresAccountTypes.some(at => accountTypes.includes(at))) return false;
    // Skip conditional fields when trigger field has the skip value
    if (f.skipWhenFieldIs) {
      const triggerValue = collectedSoFar[f.skipWhenFieldIs.field];
      if (triggerValue === f.skipWhenFieldIs.value) return false;
    }
    return true;
  });
}
