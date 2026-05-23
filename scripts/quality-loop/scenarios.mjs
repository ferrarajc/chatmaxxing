/**
 * Quality Loop — Scenario Definitions
 *
 * 11 test scenarios targeting specific QUALITY_HEURISTICS.md failure modes.
 * Each scenario supplies:
 *   - id: unique slug
 *   - client: which demo client (matches DynamoDB after reset)
 *   - scope: 'get-intent' | 'full-auto'
 *   - currentIntent: hint passed to autopilot-turn
 *   - openingMessage: the customer's first message
 *   - customerPrompt: system prompt for GPT-4o-mini playing the customer
 *   - heuristics: which H-codes this scenario primarily probes
 *   - notes: human description of what failure we're looking for
 */

// ── Client profiles (inlined from lambda/shared/client-defaults.ts) ────────────

export const CLIENT_PROFILES = {
  alex: {
    clientId: 'demo-client-001',
    name: 'Alex Johnson',
    phone: '4842384838',
    displayPhone: '(484) 238-4838',
    email: 'alex.johnson@email.com',
    address: '234 Maple Drive, Wayne, PA 19087',
    totalBalance: 241570,
    accounts: [
      { type: 'Roth IRA',        balance: 45230,  id: 'acc-001', change: 4.2  },
      { type: 'Traditional IRA', balance: 128450, id: 'acc-002', change: 2.8  },
      { type: 'Taxable Account', balance: 67890,  id: 'acc-003', change: -0.9 },
    ],
    holdings: [
      { name: 'BobsFunds 500 Index',         ticker: 'BF500', accountId: 'acc-001', shares: 142.3, price: 218.40, change: 1.2,  value: 31072  },
      { name: 'BobsFunds Growth',            ticker: 'BFGR',  accountId: 'acc-001', shares: 88.1,  price: 341.20, change: 2.1,  value: 30060  },
      { name: 'BobsFunds Bond Income',       ticker: 'BFBI',  accountId: 'acc-002', shares: 210.0, price: 98.30,  change: -0.3, value: 20643  },
      { name: 'BobsFunds International',     ticker: 'BFIN',  accountId: 'acc-002', shares: 55.4,  price: 87.60,  change: 0.7,  value: 4853   },
      { name: 'BobsFunds ESG Leaders',       ticker: 'BFESG', accountId: 'acc-003', shares: 31.2,  price: 156.90, change: 1.8,  value: 4895   },
      { name: 'BobsFunds Short-Term Treas.', ticker: 'BFST',  accountId: 'acc-003', shares: 499.8, price: 100.10, change: 0.1,  value: 50030  },
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
    transactions: [
      { date: '2025-04-10', description: 'Dividend reinvestment - BF500',    amount: 124.20,   account: 'Roth IRA'        },
      { date: '2025-04-01', description: 'Monthly contribution',             amount: 583.33,   account: 'Roth IRA'        },
    ],
    rmd: { eligible: false, projectedEligibilityYear: 2040 },
    recentChatHistory: [],
  },

  maria: {
    clientId: 'demo-client-002',
    name: 'Maria Chen',
    phone: '6175550192',
    displayPhone: '(617) 555-0192',
    email: 'maria.chen@email.com',
    address: '18 Harbor View Lane, Wellesley, MA 02482',
    totalBalance: 890000,
    accounts: [
      { type: 'Traditional IRA', balance: 612000, id: 'acc-201', change: 1.4 },
      { type: 'Taxable Account', balance: 278000, id: 'acc-202', change: 0.8 },
    ],
    holdings: [
      { name: 'BobsFunds 500 Index',         ticker: 'BF500', accountId: 'acc-201', shares: 850.0,  price: 218.40, change: 1.2,  value: 185640 },
      { name: 'BobsFunds Bond Income',       ticker: 'BFBI',  accountId: 'acc-201', shares: 1500.0, price: 98.30,  change: -0.3, value: 147450 },
      { name: 'BobsFunds Short-Term Treas.', ticker: 'BFST',  accountId: 'acc-201', shares: 2800.0, price: 100.10, change: 0.1,  value: 280280 },
      { name: 'BobsFunds International',     ticker: 'BFIN',  accountId: 'acc-202', shares: 500.0,  price: 87.60,  change: 0.7,  value: 43800  },
      { name: 'BobsFunds ESG Leaders',       ticker: 'BFESG', accountId: 'acc-202', shares: 150.0,  price: 156.90, change: 1.8,  value: 23535  },
    ],
    beneficiaries: [
      { accountId: 'acc-201', name: 'David Chen', relationship: 'Child', percentage: 50, type: 'Primary' },
      { accountId: 'acc-201', name: 'Linda Chen', relationship: 'Child', percentage: 50, type: 'Primary' },
    ],
    autoInvest: [],
    transactions: [
      { date: '2025-04-10', description: 'RMD Distribution',              amount: -15300.00, account: 'Traditional IRA' },
      { date: '2025-04-01', description: 'Dividend reinvestment - BFBI',  amount:   892.50,  account: 'Traditional IRA' },
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
      deliveryMethod: 'Direct deposit (ACH)',
      frequency: 'Annual (December)',
      taxWithholding: 10,
    },
    recentChatHistory: [],
  },

  jordan: {
    clientId: 'demo-client-003',
    name: 'Jordan Williams',
    phone: '5035550847',
    displayPhone: '(503) 555-0847',
    email: 'jordan.williams@email.com',
    address: '512 NE Burnside St Apt 3B, Portland, OR 97214',
    totalBalance: 23300,
    accounts: [
      { type: 'Roth IRA',        balance: 18500, id: 'acc-301', change: 3.1 },
      { type: 'Taxable Account', balance: 4800,  id: 'acc-302', change: 1.4 },
    ],
    holdings: [
      { name: 'BobsFunds 500 Index',   ticker: 'BF500', accountId: 'acc-301', shares: 65.0, price: 218.40, change: 1.2, value: 14196 },
      { name: 'BobsFunds Growth',      ticker: 'BFGR',  accountId: 'acc-301', shares: 15.0, price: 341.20, change: 2.1, value: 5118  },
      { name: 'BobsFunds ESG Leaders', ticker: 'BFESG', accountId: 'acc-302', shares: 25.0, price: 156.90, change: 1.8, value: 3923  },
    ],
    beneficiaries: [
      { accountId: 'acc-301', name: 'Casey Williams', relationship: 'Sibling', percentage: 100, type: 'Primary'   },
      { accountId: 'acc-301', name: 'Pat Williams',   relationship: 'Parent',  percentage: 100, type: 'Secondary' },
    ],
    autoInvest: [
      { id: 'ai-301', accountId: 'acc-301', accountType: 'Roth IRA', fund: 'BobsFunds 500 Index', ticker: 'BF500', amount: 583.33, frequency: 'Monthly', dayOfMonth: 1, nextDate: '2025-05-01', active: true },
    ],
    transactions: [
      { date: '2025-04-01', description: 'Monthly contribution', amount: 583.33, account: 'Roth IRA' },
    ],
    rmd: { eligible: false },
    recentChatHistory: [],
  },

  robert: {
    clientId: 'demo-client-004',
    name: 'Robert Martinez',
    phone: '7135550234',
    displayPhone: '(713) 555-0234',
    email: 'robert.martinez@email.com',
    address: '4217 Westheimer Rd, Houston, TX 77027',
    totalBalance: 445000,
    accounts: [
      { type: 'SEP-IRA',         balance: 285000, id: 'acc-401', change: 1.9  },
      { type: 'Roth IRA',        balance: 42000,  id: 'acc-402', change: 3.2  },
      { type: 'Taxable Account', balance: 118000, id: 'acc-403', change: -0.4 },
    ],
    holdings: [
      { name: 'BobsFunds 500 Index',         ticker: 'BF500', accountId: 'acc-401', shares: 380.0,  price: 218.40, change: 1.2,  value: 82992  },
      { name: 'BobsFunds Bond Income',       ticker: 'BFBI',  accountId: 'acc-401', shares: 800.0,  price: 98.30,  change: -0.3, value: 78640  },
      { name: 'BobsFunds Growth',            ticker: 'BFGR',  accountId: 'acc-402', shares: 145.0,  price: 341.20, change: 2.1,  value: 49474  },
      { name: 'BobsFunds International',     ticker: 'BFIN',  accountId: 'acc-402', shares: 250.0,  price: 87.60,  change: 0.7,  value: 21900  },
      { name: 'BobsFunds Short-Term Treas.', ticker: 'BFST',  accountId: 'acc-403', shares: 1100.0, price: 100.10, change: 0.1,  value: 110110 },
    ],
    beneficiaries: [
      { accountId: 'acc-401', name: 'Elena Martinez', relationship: 'Spouse', percentage: 100, type: 'Primary' },
      { accountId: 'acc-402', name: 'Elena Martinez', relationship: 'Spouse', percentage: 60,  type: 'Primary' },
      { accountId: 'acc-402', name: 'Sofia Martinez', relationship: 'Child',  percentage: 20,  type: 'Primary' },
      { accountId: 'acc-402', name: 'Marco Martinez', relationship: 'Child',  percentage: 20,  type: 'Primary' },
    ],
    autoInvest: [
      { id: 'ai-401', accountId: 'acc-401', accountType: 'SEP-IRA', fund: 'BobsFunds 500 Index',   ticker: 'BF500', amount: 5000, frequency: 'Quarterly', nextDate: '2025-07-01', active: true },
      { id: 'ai-402', accountId: 'acc-401', accountType: 'SEP-IRA', fund: 'BobsFunds Bond Income', ticker: 'BFBI',  amount: 2500, frequency: 'Quarterly', nextDate: '2025-07-01', active: true },
    ],
    transactions: [
      { date: '2025-04-10', description: 'SEP-IRA Contribution',             amount: 15000.00, account: 'SEP-IRA' },
      { date: '2025-04-01', description: 'Dividend reinvestment - BFBI',     amount:   374.50, account: 'SEP-IRA' },
    ],
    rmd: { eligible: false },
    recentChatHistory: [],
  },
};

// ── Scenario definitions ───────────────────────────────────────────────────────

export const SCENARIOS = [

  // ── BENEFICIARY SCENARIOS (probe H2, H3, H5, H10) ──────────────────────────

  {
    id: 'robert-beneficiary-copy-roth-to-sep',
    client: CLIENT_PROFILES.robert,
    scope: 'get-intent',
    currentIntent: 'update beneficiaries copy roth to sep',
    openingMessage: "I'd like to update the beneficiaries on my SEP-IRA to match my Roth IRA.",
    customerPrompt: `You are Robert Martinez, a busy small business owner chatting with a financial services agent.

Your goal: You want the beneficiaries on your SEP-IRA (acc-401) to exactly match the ones on your Roth IRA (acc-402).

Your Roth IRA beneficiaries are: Elena Martinez (spouse) 60%, Sofia Martinez (child) 20%, Marco Martinez (child) 20%.
Your SEP-IRA currently has only Elena Martinez at 100%.

Rules:
- You want the SEP-IRA to match the Roth IRA exactly — same people, same percentages.
- If asked about account: say "my SEP-IRA".
- If asked what you want: say "make it match my Roth IRA".
- If asked to specify who: say "same as the Roth — Elena, Sofia, and Marco".
- If asked for specific percentages: say "same percentages as the Roth IRA".
- You are direct and time-pressed. Keep replies to 1-2 sentences.
- Do NOT end the conversation yourself. Wait for the agent to wrap up.`,
    heuristics: ['H2', 'H3', 'H5', 'H10'],
    notes: 'Classic bb736f72 scenario. Tests whether bot recognizes the Roth percentages, applies them correctly to SEP-IRA, acknowledges Elena drops from 100%→60%, and confirms with full before→after state.',
  },

  {
    id: 'robert-beneficiary-add-two-alongside',
    client: CLIENT_PROFILES.robert,
    scope: 'get-intent',
    currentIntent: 'add beneficiaries to sep ira',
    openingMessage: "I want to add Marco and Sofia as beneficiaries on my SEP-IRA alongside Elena.",
    customerPrompt: `You are Robert Martinez, a busy small business owner chatting with a financial services agent.

Your goal: Add Marco Martinez and Sofia Martinez as primary beneficiaries on your SEP-IRA (acc-401), alongside Elena who is already there.

Current SEP-IRA beneficiary: Elena Martinez (Spouse) 100%.
You want: Elena stays, but add Marco Martinez (son) at 25% and Sofia Martinez (daughter) at 25%.

Rules:
- If asked who to add: say "Marco and Sofia Martinez, my son and daughter".
- If asked percentages: say "25 percent each for Marco and Sofia".
- If asked about Elena: say "she stays on".
- Do NOT volunteer that Elena's percentage changes — let the agent work that out.
- If asked if Elena keeps her 100%: say "no, she just stays on the account. Whatever's left after Marco and Sofia."
- Keep replies short. Do NOT end the conversation yourself.`,
    heuristics: ['H2', 'H3', 'H6', 'H10'],
    notes: 'Classic 4b56e6e3 scenario. Tests whether agent calculates Elena 100%→50% automatically, acknowledges the math impact, and gives a complete confirmation with all three parties.',
  },

  {
    id: 'maria-beneficiary-update-remarried',
    client: CLIENT_PROFILES.maria,
    scope: 'get-intent',
    currentIntent: 'update beneficiary designations',
    openingMessage: "I recently remarried and I need to update the beneficiary on my Traditional IRA.",
    customerPrompt: `You are Maria Chen, a 74-year-old retired teacher. You are patient but not very tech-savvy.

Your goal: Replace both existing beneficiaries (David Chen and Linda Chen, each at 50%) on your Traditional IRA with your new husband, James Chen, as 100% primary beneficiary.

Rules:
- If asked which account: say "my Traditional IRA, the larger one".
- If asked who to add: say "my new husband, James Chen".
- If asked relationship: say "spouse" or "my husband".
- If asked percentage: say "everything, 100 percent" or "all of it to him".
- If asked about existing beneficiaries (David and Linda): say "they'll be moved to secondary, or removed — I need to discuss with my estate planner, but for now please remove them from primary."
- Speak slowly and naturally. 1-2 sentences per reply.
- Do NOT end the conversation yourself.`,
    heuristics: ['H3', 'H10'],
    notes: 'Tests before→after transparency (David 50%+Linda 50% → James 100%) and confirmation completeness with reference number.',
  },

  {
    id: 'alex-beneficiary-add-simple',
    client: CLIENT_PROFILES.alex,
    scope: 'get-intent',
    currentIntent: 'add beneficiary to roth ira',
    openingMessage: "I'd like to add my daughter as a beneficiary on my Roth IRA.",
    customerPrompt: `You are Alex Johnson, a 38-year-old marketing manager.

Your goal: Add Emma Johnson as a secondary beneficiary on your Roth IRA (acc-001) at 100%.

Current Roth IRA beneficiary: Sarah Johnson (Spouse) 100% primary.

Rules:
- If asked which account: say "my Roth IRA".
- If asked who: say "Emma Johnson, my daughter".
- If asked relationship: say "daughter" or "my child".
- If asked primary or secondary: say "secondary".
- If asked percentage: say "100 percent secondary".
- Keep replies short. Do NOT end the conversation yourself.`,
    heuristics: ['H10', 'H12'],
    notes: 'Simpler scenario — baseline. Tests turn economy (should complete in 6-8 turns) and confirmation completeness. EVALUATOR NOTE: The correct final state is Sarah Johnson 100% Primary AND Emma Johnson 100% Secondary. Both at 100% in their separate tiers is mathematically valid — do NOT score this as an H2 failure.',
  },

  // ── AUTO-INVEST & RMD SCENARIOS (probe H3, H10, H12) ───────────────────────

  {
    id: 'jordan-setup-auto-invest',
    client: CLIENT_PROFILES.jordan,
    scope: 'get-intent',
    currentIntent: 'set up automatic investment contributions',
    openingMessage: "I want to set up automatic monthly contributions of $200 to my Roth IRA into BobsFunds Growth.",
    customerPrompt: `You are Jordan Williams, a 26-year-old nurse who is new to investing.

Your goal: Set up a new monthly auto-invest of $200 into BobsFunds Growth (BFGR) in your Roth IRA (acc-301), on the 15th of each month.

Note: You already have a $583.33/month auto-invest into BF500 in your Roth IRA. This is a NEW additional one.

Rules:
- If asked which account: say "my Roth IRA".
- If asked which fund: say "BobsFunds Growth" or "the growth fund".
- If asked amount: say "$200 a month".
- If asked day of month: say "the 15th".
- Speak in a friendly, slightly uncertain tone. 1-2 sentences.
- Do NOT end the conversation yourself.`,
    heuristics: ['H3', 'H10', 'H12'],
    notes: 'Tests confirmation completeness (account, fund, amount, frequency, day, start date all stated) and before→after (existing $583 auto-invest acknowledged).',
  },

  {
    id: 'maria-update-rmd-settings',
    client: CLIENT_PROFILES.maria,
    scope: 'get-intent',
    currentIntent: 'update rmd distribution settings',
    openingMessage: "I'd like to change my RMD to be paid out quarterly instead of annually, and I want to increase the tax withholding to 15%.",
    customerPrompt: `You are Maria Chen, a 74-year-old retired teacher.

Your goal: Change your RMD distribution frequency from "Annual (December)" to "Quarterly" and change tax withholding from 10% to 15%.

Current settings: frequency = "Annual (December)", withholding = 10%.

Rules:
- You've already stated both changes in your opening message. Don't repeat them unless asked.
- If asked to confirm what you want: say "quarterly distributions and 15% tax withholding".
- If asked about delivery method: say "keep it the same, direct deposit is fine".
- Speak slowly and patiently. 1-2 sentences.
- Do NOT end the conversation yourself.`,
    heuristics: ['H3', 'H10'],
    notes: 'Tests change transparency: should state "changed from Annual to Quarterly" and "changed from 10% to 15% withholding" in confirmation — not just the new values.',
  },

  // ── TRANSACTION SCENARIOS (probe H1, H3, H10) ──────────────────────────────

  {
    id: 'alex-place-purchase',
    client: CLIENT_PROFILES.alex,
    scope: 'get-intent',
    currentIntent: 'place purchase buy fund shares',
    openingMessage: "I'd like to buy $1,000 of BobsFunds 500 Index in my Roth IRA.",
    customerPrompt: `You are Alex Johnson, a 38-year-old marketing manager.

Your goal: Purchase $1,000 of BobsFunds 500 Index (BF500) in your Roth IRA (acc-001).

Rules:
- If asked which fund: say "BobsFunds 500 Index" or "BF500".
- If asked which account: say "my Roth IRA".
- If asked amount: say "$1,000".
- If asked funding source: say "cash in the account" or "from my settlement fund".
- Keep replies short. Do NOT end the conversation yourself.`,
    heuristics: ['H1', 'H3', 'H10'],
    notes: 'Tests factual accuracy (price: $218.40, so ~4.58 shares) and confirmation completeness (shares purchased, fund, account, reference number).',
  },

  {
    id: 'robert-exchange-funds',
    client: CLIENT_PROFILES.robert,
    scope: 'get-intent',
    currentIntent: 'exchange funds between investments',
    openingMessage: "I want to move $10,000 from BobsFunds 500 Index into BobsFunds Bond Income in my SEP-IRA.",
    customerPrompt: `You are Robert Martinez, a direct and time-pressed business owner.

Your goal: Exchange $10,000 from BobsFunds 500 Index (BF500) to BobsFunds Bond Income (BFBI) within your SEP-IRA (acc-401).

Current SEP-IRA BF500 holding: 380 shares at $218.40 = $82,992.

Rules:
- If asked from which fund: say "BobsFunds 500 Index".
- If asked to which fund: say "BobsFunds Bond Income".
- If asked which account: say "my SEP-IRA".
- If asked amount: say "$10,000".
- Keep replies to 1 sentence. Do NOT end the conversation yourself.`,
    heuristics: ['H1', 'H3', 'H10'],
    notes: 'Tests share math ($10,000 ÷ $218.40 ≈ 45.79 shares sold; $10,000 ÷ $98.30 ≈ 101.73 shares purchased) and confirmation completeness.',
  },

  // ── CONTACT INFO SCENARIO (probe H3, H4, H10, H12) ─────────────────────────

  {
    id: 'alex-update-contact-info',
    client: CLIENT_PROFILES.alex,
    scope: 'get-intent',
    currentIntent: 'update contact information email address',
    openingMessage: "I need to update my email address on file.",
    customerPrompt: `You are Alex Johnson, a 38-year-old marketing manager.

Your goal: Update your email from alex.johnson@email.com to alexj2025@gmail.com.

Rules:
- If asked what to update: say "my email address".
- If asked for new email: say "alexj2025@gmail.com".
- Do NOT volunteer your old email unless specifically asked "what is your current email?".
- If asked current email: say "alex.johnson@email.com".
- Keep replies short. Do NOT end the conversation yourself.`,
    heuristics: ['H3', 'H4', 'H10', 'H12'],
    notes: 'Tests info-gathering efficiency (agent should not ask for old email if it has it via tool), before→after transparency (from alex.johnson@email.com to alexj2025@gmail.com), and turn economy (should complete in 4-6 turns).',
  },

  // ── FULL-AUTO / CUSTOMER BOT SCENARIOS (probe H7, H8, H9) ──────────────────

  {
    id: 'robert-bot-beneficiary-request',
    client: CLIENT_PROFILES.robert,
    scope: 'full-auto',
    currentIntent: undefined,
    openingMessage: "I'd like to update the beneficiaries on my SEP-IRA.",
    customerPrompt: `You are Robert Martinez, a direct and time-pressed business owner.

You just told the pre-agent bot you want to update beneficiaries on your SEP-IRA.

Rules:
- If the bot offers a self-service link: say you'd rather talk to someone.
- If the bot asks for more details before transferring: answer briefly (e.g., "Add my kids alongside Elena").
- If the bot says it will process changes itself: push back ("wait, can you actually do that?").
- Keep replies short. Do NOT end the conversation yourself.`,
    heuristics: ['H7', 'H8', 'H9'],
    notes: 'Tests escalation timing (should escalate after gathering basic intent, not immediately or after too many turns), role honesty (bot must not imply it can execute changes), and routing consistency (no self-service link then escalation without explanation).',
  },

  {
    id: 'jordan-bot-balance-inquiry',
    client: CLIENT_PROFILES.jordan,
    scope: 'full-auto',
    currentIntent: undefined,
    openingMessage: "Hi, can you tell me what my current Roth IRA balance is?",
    customerPrompt: `You are Jordan Williams, a 26-year-old nurse and new investor.

You just asked about your Roth IRA balance.

Rules:
- If the bot gives you a balance: respond with a follow-up question like "Is that up or down from last month?"
- If the bot can't give you a balance: ask why.
- If the bot tries to escalate you to an agent for a simple balance question: express confusion.
- Keep replies short and friendly. Do NOT end the conversation yourself.`,
    heuristics: ['H1', 'H8', 'H12'],
    notes: 'Tests factual accuracy (Roth IRA balance is $18,500), role honesty (bot should not over-promise on what it can do), and turn economy (balance question should resolve in 2-4 turns).',
  },
];

export default SCENARIOS;
