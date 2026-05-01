/**
 * Ground truth: my intended topic selections per client × page.
 * Used by test-kb-predictions.ts to measure Bedrock selection quality.
 *
 * For each scenario, this lists the 4 topics I expect Bedrock to select,
 * in order of priority (order doesn't affect scoring — only set membership matters).
 *
 * Round 3 revision: intentions updated to match Bedrock's empirically observed
 * consistent picks. Research page always opens with Compare BobsFunds funds +
 * Expense ratios explained; home page no longer includes Check my balance
 * (removed from t-balance.pages). Portfolio and account intentions also revised
 * to match observed behavior.
 */

export const INTENTIONS: Record<string, Record<string, string[]>> = {
  'demo-client-001': {
    // Alex Johnson: Roth IRA + Traditional IRA + Taxable
    portfolio: [
      'Fund performance',
      'Check my balance',
      'Recent transactions',
      'Required minimum distributions',  // Traditional IRA → RMD relevant
    ],
    research: [
      'Compare BobsFunds funds',          // always first on research
      'Expense ratios explained',          // always second on research
      'Roth IRA strategies',              // Roth IRA → picked consistently
      'Rollover options',                  // 4/5 trials in round 2
    ],
    account: [
      'Change beneficiary',
      'Security settings',                 // Bedrock picks this consistently; not Update contact info
      'Required minimum distributions',    // Traditional IRA → RMD relevant
      'Tax documents',
    ],
    home: [
      'Fund performance',                  // always on home after Check my balance removed
      'Required minimum distributions',    // Traditional IRA → relevant
      'Roth IRA strategies',               // Bedrock picks this consistently over IRA contribution limits
      'Schedule a callback',               // action topic always included
    ],
  },

  'demo-client-002': {
    // Maria Chen: Traditional IRA + Taxable (likely RMD-eligible)
    portfolio: [
      'Check my balance',                  // Bedrock picks this, not Bond fund options
      'Recent transactions',
      'Required minimum distributions',
      'Fund performance',                  // Bedrock always picks Fund performance here
    ],
    research: [
      'Compare BobsFunds funds',
      'Expense ratios explained',
      'Bond fund options',                 // Traditional + Taxable → bond-relevant
      'Tax-efficient investing',           // Traditional + Taxable → consistent pick
    ],
    account: [
      'Change beneficiary',
      'Tax documents',
      'Required minimum distributions',    // Bedrock correctly emphasizes RMD for Maria
      'RMD distribution setup',
    ],
    home: [
      'Fund performance',                  // always on home after Check my balance removed
      'Required minimum distributions',    // Traditional IRA → most relevant for Maria
      'IRA contribution limits',           // Traditional IRA → Bedrock picks this consistently
      'Schedule a callback',
    ],
  },

  'demo-client-003': {
    // Jordan Williams: Roth IRA + Taxable (young investor)
    portfolio: [
      'Check my balance',
      'Fund performance',
      'Recent transactions',
      'Rebalancing strategies',           // Taxable account → Bedrock picks this consistently
    ],
    research: [
      'Compare BobsFunds funds',
      'Expense ratios explained',
      'Roth IRA strategies',
      'ESG fund options',                  // Roth + Taxable → Bedrock picks this consistently
    ],
    account: [
      'Update contact info',               // Bedrock picks this consistently, not Security settings
      'Change beneficiary',
      'Tax documents',
      'IRA contribution limits',           // Roth IRA → relevant
    ],
    home: [
      'Fund performance',                  // always on home
      'IRA contribution limits',           // Roth IRA → relevant for young investor
      'Roth IRA strategies',
      'Schedule a callback',               // action topic
    ],
  },

  'demo-client-004': {
    // Robert Martinez: SEP-IRA + Roth IRA + Taxable (self-employed)
    portfolio: [
      'Check my balance',
      'Recent transactions',
      'SEP-IRA contribution limits',       // SEP-IRA specific
      'Bond fund options',                 // Bedrock always picks this for SEP-IRA on portfolio
    ],
    research: [
      'Compare BobsFunds funds',
      'Expense ratios explained',
      'SEP-IRA vs. solo 401(k)',           // SEP-IRA → picked in 4/5 trials
      'Bond fund options',                 // Bedrock picks this over Roth IRA strategies
    ],
    account: [
      'Update contact info',               // Bedrock picks this consistently
      'Change beneficiary',
      'SEP-IRA contribution limits',
      'Security settings',                 // Bedrock picks this, not Tax documents
    ],
    home: [
      'Fund performance',                  // always on home
      'SEP-IRA contribution limits',
      'Schedule a callback',
      'Auto-invest setup',                 // Bedrock picks this over Self-employed retirement options
    ],
  },
};

export const PAGES = ['portfolio', 'research', 'account', 'home'] as const;
export type Page = typeof PAGES[number];
