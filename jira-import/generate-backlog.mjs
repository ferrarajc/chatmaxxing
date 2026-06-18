/**
 * Vanguard AI-Assisted Service Platform - Jira backlog generator.
 *
 * Emits Jira-importable CSV(s) describing the FULL breadth of the platform as a
 * Feature -> Epic -> Story -> Sub-task hierarchy with descriptions, value
 * statements, and Gherkin acceptance criteria.
 *
 * Hierarchy is encoded per Atlassian's "import issues with hierarchy from a CSV"
 * guidance:
 *   - Sub-task -> Story  via  "Parent ID"  (parent story's Issue ID)
 *   - Story   -> Epic    via  "Epic Link"  (parent epic's Epic Name)
 *   - Epic    -> Feature via  "Parent Link" (parent feature's Issue ID)
 * Every row also carries its top-level Feature as "Component/s" so the grouping
 * survives even on Jira plans that have no level above Epic.
 *
 * Run:  node generate-backlog.mjs
 */
import { writeFileSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Node builders. Each takes a summary + an options bag:
//   { desc, ac, priority, points, labels:[], component, children:[] }
// ---------------------------------------------------------------------------
const F = (summary, o = {}) => ({ kind: 'Feature', summary, ...o });
const E = (summary, o = {}) => ({ kind: 'Epic', summary, ...o });
const S = (summary, o = {}) => ({ kind: 'Story', summary, ...o });
const T = (summary, o = {}) => ({ kind: 'Sub-task', summary, ...o });

// Short helper to assemble a user story description (a/an chosen by leading sound).
const story = (asA, iWant, soThat, extra = '') => {
  const article = /^[aeiou]/i.test(asA) ? 'an' : 'a';
  return `As ${article} ${asA}, I want ${iWant}, so that ${soThat}.` + (extra ? `\n\n${extra}` : '');
};

const FEATURES = [];

// ===========================================================================
// FEATURE 1 - Client Self-Service Portal
// ===========================================================================
FEATURES.push(F('Client Self-Service Portal', {
  component: 'Client Portal',
  priority: 'Highest',
  labels: ['customer-app', 'self-service', 'react'],
  desc:
    'The Vanguard client web application: a responsive single-page portal where retail investors view ' +
    'accounts, holdings, and transactions; research the fund lineup; manage beneficiaries, automatic ' +
    'investing, RMDs, and tax documents; open new accounts; and read education content - all without ' +
    'calling in. This is the surface every other capability plugs into (the chat assistant, autopilot ' +
    'task fulfillment, and fund data all render here).\n\n' +
    'Value: deflects routine call volume, lets investors self-serve 24/7, and raises satisfaction by ' +
    'making the most common account actions doable in a few clicks.',
  ac:
    'Definition of done:\n' +
    '- Every route below is reachable from the global navigation and renders live account data.\n' +
    '- The app is gated behind an access check and is usable on desktop and mobile widths.\n' +
    '- No page shows placeholder/mock data where a real DynamoDB-backed value exists.',
  children: [

    // ---- Epic 1.1 ----
    E('Portal Shell, Navigation & Access Gating', {
      priority: 'Highest',
      labels: ['customer-app', 'react'],
      desc:
        'The application frame that hosts every page: global top navigation, client-side routing, the ' +
        'access gate that protects the demo, scroll-to-top on navigation, web-font loading, and the ' +
        'build-SHA stamp used to confirm exactly what is deployed.\n\n' +
        'Value: a consistent, fast, secure shell is the precondition for every other portal capability.',
      ac:
        'Definition of done:\n' +
        '- All routes are registered and 404s are handled gracefully.\n' +
        '- The access gate blocks unauthenticated access and remembers a valid entry per browser.\n' +
        '- window.__BUILD__ reflects the deployed commit SHA.',
      children: [
        S('Gate portal access behind an access code', {
          priority: 'High', points: 3, labels: ['customer-app', 'security'],
          desc: story(
            'platform owner',
            'the client portal to require a valid access code before any page renders',
            'only authorized people can reach the demo environment and we can detect first-time sign-ins',
            'On a correct code the gate persists a flag in localStorage so the prompt is not shown again on ' +
            'that browser; on a fresh/cleared browser a correct code fires a one-time client-log signin event.'),
          ac:
            'Scenario: First visit requires the code\n' +
            '  Given I have never entered the access code on this browser\n' +
            '  When I open any portal URL\n' +
            '  Then I am shown the access gate and no portal content is rendered\n\n' +
            'Scenario: Correct code unlocks and is remembered\n' +
            '  Given I am on the access gate\n' +
            '  When I enter the correct access code\n' +
            '  Then the portal renders and I am not prompted again on this browser\n\n' +
            'Scenario: Incorrect code is rejected\n' +
            '  Given I am on the access gate\n' +
            '  When I enter an incorrect code\n' +
            '  Then I remain on the gate with an error and no content is exposed',
          children: [
            T('Implement AccessGate component with localStorage flag', { desc: 'Wrap the router in an access gate; persist an access flag in localStorage on success so the prompt is shown once per browser.' }),
            T('Fire one-time access-code-entered client-log event on fresh unlock', { desc: 'PROD-only fire-and-forget POST /client-log {context:"access-code-entered"} when the flag was not already set.' }),
          ],
        }),
        S('Provide global top navigation across the portal', {
          priority: 'High', points: 3, labels: ['customer-app', 'ux'],
          desc: story(
            'investor',
            'a persistent top navigation bar with links to Home, Portfolio, Research, Account, and the help/resources areas',
            'I can move between portal areas from anywhere without using the browser back button'),
          ac:
            'Scenario: Navigation is always available\n' +
            '  Given I am on any portal page\n' +
            '  Then the top navigation is visible and links to the major areas\n' +
            '  And the current section is visually indicated',
        }),
        S('Reset scroll position and load fonts/branding on navigation', {
          points: 2, labels: ['customer-app', 'ux'],
          desc: story(
            'investor',
            'each page to open scrolled to the top with consistent Vanguard typography',
            'navigating feels like a fresh page rather than a mid-scroll jump'),
          ac:
            'Scenario: New route starts at the top\n' +
            '  Given I am scrolled down on one page\n' +
            '  When I navigate to a different route\n' +
            '  Then the new page is scrolled to the top',
        }),
        S('Stamp the deployed build SHA into the app', {
          points: 1, labels: ['customer-app', 'infra'],
          desc: story(
            'engineer',
            'the running app to log its build commit and expose it on window.__BUILD__',
            'I can confirm exactly which commit is live in prod without guessing'),
          ac:
            'Scenario: Build SHA is observable\n' +
            '  Given the app has loaded\n' +
            '  When I open the browser console\n' +
            '  Then it logs "build <sha>" and window.__BUILD__ equals that SHA',
        }),
      ],
    }),

    // ---- Epic 1.2 ----
    E('Account Overview & Detail', {
      priority: 'Highest',
      labels: ['customer-app', 'self-service'],
      desc:
        'The account hub and per-account detail pages: every account the investor holds (Roth IRA, ' +
        'Traditional IRA, SEP-IRA, Taxable), each balance and day change, and the holdings within each ' +
        'account. Detail pages link out to the self-service actions (beneficiaries, auto-invest, RMD, etc.).\n\n' +
        'Value: a single, trustworthy view of "what do I have and what is it worth" is the most-visited ' +
        'reason investors log in.',
      ac:
        'Definition of done:\n' +
        '- The account hub lists every account with type, balance, and day change from live data.\n' +
        '- Each account detail page shows that account\'s holdings and recent transactions.\n' +
        '- Deep links to beneficiaries/auto-invest/RMD/tax-docs are present where applicable.',
      children: [
        S('View all accounts on an account hub', {
          priority: 'High', points: 3, labels: ['customer-app'],
          desc: story(
            'investor',
            'a hub page listing every account I hold with its type, balance, and day change',
            'I get a complete picture of my relationship in one place'),
          ac:
            'Scenario: Accounts are listed from live data\n' +
            '  Given I am a signed-in investor with multiple accounts\n' +
            '  When I open the Account page\n' +
            '  Then I see each account with its type, current balance, and day change\n' +
            '  And the totals reconcile with my portfolio total balance',
        }),
        S('Drill into a single account\'s detail', {
          priority: 'High', points: 3, labels: ['customer-app'],
          desc: story(
            'investor',
            'an account detail page showing that account\'s holdings and recent transactions',
            'I can inspect a specific account without sifting through everything at once'),
          ac:
            'Scenario: Account detail shows holdings and recent activity\n' +
            '  Given I am on the Account hub\n' +
            '  When I open a specific account\n' +
            '  Then I see its holdings (fund, shares, price, value) and its most recent transactions\n' +
            '  And links to the relevant self-service actions for that account type',
        }),
      ],
    }),

    // ---- Epic 1.3 ----
    E('Portfolio Dashboard', {
      priority: 'High',
      labels: ['customer-app', 'self-service'],
      desc:
        'A consolidated portfolio view: total balance across accounts, holdings, and a recent-transactions ' +
        'snapshot, plus the primary entry point to open a new account. Where the account hub is "my accounts", ' +
        'the portfolio is "my money in aggregate".\n\n' +
        'Value: gives investors the at-a-glance net position and a clear next action (invest more / open an account).',
      ac:
        'Definition of done:\n' +
        '- Total balance and holdings aggregate correctly across all accounts.\n' +
        '- A recent-transactions snapshot links to the full Transaction History page.\n' +
        '- An "Open an account" action is present in the page header.',
      children: [
        S('See an aggregate portfolio with holdings and recent activity', {
          priority: 'High', points: 5, labels: ['customer-app'],
          desc: story(
            'investor',
            'a portfolio dashboard with my total balance, holdings, and a snapshot of recent transactions',
            'I understand my overall position at a glance'),
          ac:
            'Scenario: Portfolio aggregates across accounts\n' +
            '  Given I hold positions in more than one account\n' +
            '  When I open the Portfolio page\n' +
            '  Then I see my combined total balance and a holdings list spanning all accounts\n' +
            '  And a recent-transactions section linking to the full Transaction History',
        }),
        S('Start opening an account from the portfolio header', {
          points: 2, labels: ['customer-app', 'ux'],
          desc: story(
            'investor',
            'an "Open an account" action in the portfolio header',
            'I can begin opening a new account from the place I review my holdings'),
          ac:
            'Scenario: Open-account entry point\n' +
            '  Given I am on the Portfolio page\n' +
            '  When I click "Open an account"\n' +
            '  Then I am taken to the account-opening wizard',
        }),
      ],
    }),

    // ---- Epic 1.4 ----
    E('Fund Research & Discovery', {
      priority: 'High',
      labels: ['customer-app', 'funds'],
      desc:
        'The research surface: a screener over the full fund lineup, a per-fund profile page (objective, ' +
        'expense ratio, risk level, sector allocation, historical returns), and a buy entry point. All fund ' +
        'facts are read from the single fund catalog so pages never disagree with the chat assistant.\n\n' +
        'Value: lets investors discover and evaluate funds themselves, supporting confident, self-directed investing.',
      ac:
        'Definition of done:\n' +
        '- The screener lists every fund in the lineup with key attributes and supports filtering.\n' +
        '- Each fund profile renders catalog data plus live price/return from market data.\n' +
        '- A buy action routes into the purchase flow for that fund.',
      children: [
        S('Browse and filter the fund lineup', {
          priority: 'High', points: 5, labels: ['customer-app', 'funds'],
          desc: story(
            'self-directed investor',
            'a research screen that lists every fund with its asset class, expense ratio, and risk level and lets me filter',
            'I can narrow the lineup to funds that fit my strategy'),
          ac:
            'Scenario: Screener lists and filters funds\n' +
            '  Given I am on the Research page\n' +
            '  Then I see every fund in the lineup with asset class, expense ratio, and risk level\n' +
            '  When I apply a filter (e.g. asset class)\n' +
            '  Then only matching funds remain',
        }),
        S('View a single fund\'s profile', {
          priority: 'High', points: 5, labels: ['customer-app', 'funds'],
          desc: story(
            'investor',
            'a fund profile page with the objective, expense ratio, risk level, sector allocation, historical returns, and live price',
            'I can evaluate a fund in depth before investing'),
          ac:
            'Scenario: Fund profile shows catalog + live data\n' +
            '  Given I open a fund profile from the screener\n' +
            '  Then I see the fund\'s catalog attributes and its current live price/return\n' +
            '  And a clear action to buy the fund',
        }),
        S('Begin a purchase from a fund profile', {
          points: 3, labels: ['customer-app', 'funds'],
          desc: story(
            'investor',
            'a buy page reachable from a fund profile',
            'I can move from evaluating a fund to investing in it without leaving research'),
          ac:
            'Scenario: Buy entry point from profile\n' +
            '  Given I am on a fund profile\n' +
            '  When I choose to buy\n' +
            '  Then I land on the purchase flow pre-scoped to that fund',
        }),
      ],
    }),

    // ---- Epic 1.5 ----
    E('Self-Service Account Management Pages', {
      priority: 'High',
      labels: ['customer-app', 'self-service'],
      desc:
        'Dedicated functional pages for the account actions investors perform most: beneficiary designations, ' +
        'automatic investing schedules, Required Minimum Distribution settings, and tax-document retrieval. ' +
        'These pages read and write the same DynamoDB-backed data the autopilot uses, so the two channels agree.\n\n' +
        'Value: lets investors complete high-intent account maintenance on their own, the actions that ' +
        'otherwise generate the most calls.',
      ac:
        'Definition of done:\n' +
        '- Beneficiaries, Auto-Invest, RMD, and Tax Documents each have a functional page bound to live data.\n' +
        '- Beneficiary edits enforce 100% allocation per account.\n' +
        '- These pages are reachable from account detail and from in-chat links.',
      children: [
        S('Manage beneficiary designations', {
          priority: 'High', points: 5, labels: ['customer-app', 'self-service'],
          desc: story(
            'IRA account holder',
            'a beneficiaries page where I can view and edit primary and secondary beneficiaries per eligible account',
            'I control who inherits each account without paperwork'),
          ac:
            'Scenario: Allocation must total 100%\n' +
            '  Given I am editing beneficiaries on an eligible account\n' +
            '  When I save a set of beneficiaries whose percentages do not total 100%\n' +
            '  Then the save is blocked with a clear validation message\n\n' +
            'Scenario: Taxable accounts are excluded\n' +
            '  Given I hold a taxable brokerage account\n' +
            '  Then it does not appear as a beneficiary-eligible account',
        }),
        S('Manage automatic investment schedules', {
          priority: 'High', points: 5, labels: ['customer-app', 'self-service'],
          desc: story(
            'investor',
            'an auto-invest page to view, create, edit, pause, and resume recurring investments',
            'I can keep dollar-cost-averaging on autopilot and adjust it when life changes'),
          ac:
            'Scenario: View and modify schedules\n' +
            '  Given I have at least one auto-invest schedule\n' +
            '  When I open the Auto-Invest page\n' +
            '  Then I see each schedule (fund, amount, frequency, next date, active state)\n' +
            '  And I can pause, resume, or edit a schedule',
        }),
        S('View and configure RMD settings', {
          points: 5, labels: ['customer-app', 'self-service'],
          desc: story(
            'retiree with a Traditional or SEP IRA',
            'an RMD page showing my required minimum distribution status and letting me set delivery, frequency, and withholding',
            'I stay compliant with mandatory withdrawals without calling in'),
          ac:
            'Scenario: RMD page reflects eligibility\n' +
            '  Given I hold a Traditional IRA or SEP-IRA that is RMD-eligible\n' +
            '  When I open the RMD page\n' +
            '  Then I see my RMD status and can set delivery method, frequency, and tax withholding\n\n' +
            'Scenario: Not RMD-eligible\n' +
            '  Given I hold only Roth or taxable accounts\n' +
            '  Then the page explains I have no current RMD obligation',
        }),
        S('Retrieve tax documents', {
          points: 3, labels: ['customer-app', 'self-service'],
          desc: story(
            'investor',
            'a tax-documents page listing my available forms (1099-R, 1099-B, 1099-DIV, 5498) by year',
            'I can download what I need at tax time without contacting support'),
          ac:
            'Scenario: List available tax forms\n' +
            '  Given I have reportable activity in a prior tax year\n' +
            '  When I open the Tax Documents page\n' +
            '  Then I see the relevant forms for each available year with a way to request/download them',
        }),
      ],
    }),

    // ---- Epic 1.6 ----
    E('Open-an-Account Wizard', {
      priority: 'High',
      labels: ['customer-app', 'self-service'],
      desc:
        'A realistic, multi-step account-opening flow: choose account type, enter personal and contact ' +
        'information, acknowledge FINRA/SEC disclosures, complete account-type-specific setup (IRA ' +
        'beneficiaries with 100% allocation, SEP business info, taxable joint owner/TOD), fund the account ' +
        'and place an initial investment, opt into free dollar-cost-averaging, then review, sign, and confirm. ' +
        'Steps are URL-driven so browser back/forward and refresh work, and the in-flow chat tracks the exact step.\n\n' +
        'Value: converts prospective and existing investors into funded new accounts entirely online.',
      ac:
        'Definition of done:\n' +
        '- The wizard branches correctly by account type and enforces type-specific rules.\n' +
        '- Step and completion state are encoded in the URL (?step / ?done) and survive refresh.\n' +
        '- The flow ends in a confirmation timeline; in-flow chat pills track the current step.',
      children: [
        S('Open an account through a guided multi-step wizard', {
          priority: 'High', points: 8, labels: ['customer-app', 'self-service'],
          desc: story(
            'prospective or existing investor',
            'a guided wizard that walks me from account type through funding, agreements, and e-signature',
            'I can open and fund a new account online without paper forms or a phone call'),
          ac:
            'Scenario: Account-type branch is enforced\n' +
            '  Given I choose to open a SEP-IRA\n' +
            '  When I reach the setup step\n' +
            '  Then I am asked for business/EIN information specific to a SEP-IRA\n\n' +
            'Scenario: IRA beneficiary allocation is validated\n' +
            '  Given I am opening an IRA and adding beneficiaries\n' +
            '  When their allocations do not total 100%\n' +
            '  Then I cannot proceed until they do\n\n' +
            'Scenario: Completion confirmation\n' +
            '  Given I have signed and submitted the application\n' +
            '  Then I see a confirmation timeline describing what happens next',
          children: [
            T('Build the 8-step wizard scaffold and step branching', { desc: 'Type -> personal -> contact -> disclosures -> type setup -> funding+initial invest -> DCA opt-in -> review/sign/confirm.' }),
            T('Drive step/done state from URL query params', { desc: 'Use ?step=N and ?done=1 so browser back/forward and refresh traverse the wizard; form state stays in component state.' }),
            T('Publish per-step page context for in-flow chat pills', { desc: 'Publish open-account/<step> and open-account/setup-{ira,sep,taxable} keys via pageContextStore so chat topics track the screen.' }),
          ],
        }),
      ],
    }),

    // ---- Epic 1.7 ----
    E('Education: Resources, Library & Help Center', {
      priority: 'Medium',
      labels: ['customer-app', 'content'],
      desc:
        'The content estate that powers self-service learning and backs the chat assistant\'s links: ~10 ' +
        'resource pages (IRA contribution limits, Roth IRA, SEP-IRA, SEP vs Solo 401(k), tax-efficient ' +
        'investing, estate planning, self-employed retirement, tax deductions, rollovers, and an interactive ' +
        'retirement calculator); a library of guide/opinion articles and an investor podcast; and ~27 help ' +
        'pages (account access, transfers, beneficiaries, cost basis, DRIP, fees, fund performance, ' +
        'prospectus library, RMD guide, rollover guide, statements, trading, wire transfer, withdrawals, etc.).\n\n' +
        'Value: deflects informational contacts, builds investor confidence, and gives the bot authoritative ' +
        'pages to link to instead of free-typing answers.',
      ac:
        'Definition of done:\n' +
        '- All resource, library, and help routes render and are linkable from chat.\n' +
        '- The retirement calculator computes projections from user inputs.\n' +
        '- Pages that show fund data read from the shared fund catalog.',
      children: [
        S('Read education resource pages', {
          points: 5, labels: ['customer-app', 'content'],
          desc: story(
            'investor',
            'a set of resource pages covering IRAs, rollovers, tax-efficient investing, estate planning, and self-employed retirement',
            'I can learn the concepts behind my decisions without leaving the portal'),
          ac:
            'Scenario: Resource pages are reachable and self-contained\n' +
            '  Given I follow a resource link from navigation or chat\n' +
            '  Then the page explains the topic and links to related actions/pages',
        }),
        S('Project retirement outcomes with a calculator', {
          points: 5, labels: ['customer-app', 'content'],
          desc: story(
            'investor planning for retirement',
            'an interactive retirement calculator where I can enter ages, balances, and contributions',
            'I can see a projection and adjust assumptions'),
          ac:
            'Scenario: Calculator recomputes on input\n' +
            '  Given I am on the retirement calculator\n' +
            '  When I edit an input (e.g. monthly contribution)\n' +
            '  Then the projected outcome updates accordingly\n\n' +
            'Scenario: Inputs accept full edits\n' +
            '  Given a numeric input has a value\n' +
            '  When I select all and retype\n' +
            '  Then it is not min-clamped on each keystroke',
        }),
        S('Browse the library and listen to the investor podcast', {
          points: 3, labels: ['customer-app', 'content'],
          desc: story(
            'investor',
            'a content library of guide and opinion articles plus a podcast page',
            'I can engage with longer-form education in the format I prefer'),
          ac:
            'Scenario: Library lists articles by category\n' +
            '  Given I open the Library\n' +
            '  Then I can browse guide and opinion articles and open any one to read it\n' +
            '  And I can reach the podcast page',
        }),
        S('Find answers in the help center', {
          points: 5, labels: ['customer-app', 'content'],
          desc: story(
            'investor',
            'a help center with focused pages for common how-to topics (fees, beneficiaries, rollovers, statements, withdrawals, trading, and more)',
            'I can resolve specific questions on my own'),
          ac:
            'Scenario: Help pages are focused and linkable\n' +
            '  Given the bot or navigation links me to a help page\n' +
            '  Then the page answers that specific topic and the link opens the correct page',
        }),
      ],
    }),

    // ---- Epic 1.8 ----
    E('Transaction History & Order Status', {
      priority: 'High',
      labels: ['customer-app', 'dynamodb', 'self-service'],
      desc:
        'End-to-end transaction history: a dedicated table (one item per transaction) that stores each ' +
        'account\'s activity back to inception, a deterministic decades-deep seed for the demo personas, and ' +
        'a per-transaction status reflecting the real mutual-fund order lifecycle (Scheduled, Pending, ' +
        'Settling, Completed, Canceled). The portal surfaces this on every transaction list and on a full ' +
        'Transaction History page with filtering, search, sorting, and pagination; each status has a ' +
        'click-to-explain popover. The same data (including status) is exposed to the chatbot and autopilot.\n\n' +
        'Value: answers "where is my trade / what happened to my money" accurately and self-serve, across ' +
        'both the portal and the assistant.',
      ac:
        'Definition of done:\n' +
        '- Transactions are stored one-per-row with a per-account index and newest-first querying.\n' +
        '- The history page filters, searches, sorts, and paginates large histories.\n' +
        '- Status is computed deterministically and explained via an in-line popover.',
      children: [
        S('Browse full transaction history with filter/search/sort/paginate', {
          priority: 'High', points: 8, labels: ['customer-app', 'dynamodb'],
          desc: story(
            'investor',
            'a Transaction History page that lets me filter, search, sort, and page through my entire history',
            'I can find any past transaction quickly even across decades of activity'),
          ac:
            'Scenario: Paginate a deep history\n' +
            '  Given my account has years of transactions\n' +
            '  When I open Transaction History\n' +
            '  Then transactions load newest-first and I can page without loading everything at once\n\n' +
            'Scenario: Filter and search\n' +
            '  Given I am on Transaction History\n' +
            '  When I filter by account and search a description\n' +
            '  Then only matching rows are shown',
          children: [
            T('Create the transactions table with a per-account GSI', { desc: 'One item per transaction: PK clientId, SK <ISOdate>#<seq>, GSI account-index on acctKey; newest-first via descending sort-key query.' }),
            T('Add paginated client-data read actions', { desc: 'get-recent-transactions and get-transactions-page (base64 cursor) in client-data Lambda.' }),
            T('Build the Transaction History page UI', { desc: 'Filter/search/sort/paginate over the paginated API via useRecentTransactions/history hooks.' }),
          ],
        }),
        S('Understand each transaction\'s status', {
          priority: 'High', points: 3, labels: ['customer-app', 'ux'],
          desc: story(
            'investor',
            'a status on every transaction with a click-to-explain popover',
            'I understand whether an order is scheduled, pending, settling, completed, or canceled and what happens next'),
          ac:
            'Scenario: Status popover explains the lifecycle\n' +
            '  Given a transaction shows a status with a dotted underline\n' +
            '  When I click the status\n' +
            '  Then a popover explains what the status means and what happens next',
          children: [
            T('Implement deterministic status assignment', { desc: 'assignStatus by date vs frozen DEMO_TODAY in shared/transaction-status.ts.' }),
            T('Build StatusCell popover component', { desc: 'Dotted-underline status with click popover; copy in data/transactionStatus.ts.' }),
          ],
        }),
        S('Seed decades-deep transaction history for demo personas', {
          points: 5, labels: ['backend', 'dynamodb'],
          desc: story(
            'platform owner',
            'a deterministic generator that seeds realistic multi-decade histories for all demo personas',
            'the history, status, and pagination features can be demonstrated convincingly and reset idempotently'),
          ac:
            'Scenario: Idempotent deep seed\n' +
            '  Given a clean dev environment\n' +
            '  When I run the data reset\n' +
            '  Then each persona has a deterministic multi-year transaction history with realistic statuses',
        }),
      ],
    }),
  ],
}));

// ===========================================================================
// FEATURE 2 - Conversational AI Assistant (Client Chat Experience)
// ===========================================================================
FEATURES.push(F('Conversational AI Assistant (Client Chat)', {
  component: 'Client Chat',
  priority: 'Highest',
  labels: ['customer-app', 'ai', 'connect'],
  desc:
    'A floating chat assistant available on every portal page. It opens an Amazon Connect chat session, ' +
    'answers questions instantly via an AI bot, links investors to self-service pages, and escalates to a ' +
    'live agent (or schedules a callback) the moment a request needs a human or an account change. The ' +
    'experience is engineered to feel human: realistic typing/reading delays, agent avatars and names, ' +
    'minimize/persist behavior, chat history, and the ability to resume a recent agent conversation.\n\n' +
    'Value: gives every investor an immediate, knowledgeable first responder, deflecting simple contacts ' +
    'and warming up the ones that escalate so agents start with full context.',
  ac:
    'Definition of done:\n' +
    '- The widget is reachable from any page and reliably starts and ends Connect sessions.\n' +
    '- The bot answers, links, and escalates; live-agent UX is indistinguishable from a human.\n' +
    '- History, persistence, and resume all work across reloads and off-site navigation.',
  children: [

    E('Embedded Chat Widget & Session Lifecycle', {
      priority: 'Highest', labels: ['customer-app', 'connect'],
      desc:
        'The chat surface and its full lifecycle: a floating action button that expands into a panel, ' +
        'session creation via the start-chat Lambda + Connect ChatJS, minimize-to-docked-bar with an unread ' +
        'badge, a close-confirmation dialog, true Connect disconnect on end, and per-tab persistence so a ' +
        'reload or a trip off-site and back resumes the conversation (with missed agent messages backfilled).\n\n' +
        'Value: a dependable, forgiving chat container that never loses a conversation is the foundation the ' +
        'rest of the assistant stands on.',
      ac:
        'Definition of done:\n' +
        '- Opening the widget starts (or resumes) exactly one Connect session.\n' +
        '- Minimize keeps the session live; close-after-engagement confirms; end truly disconnects.\n' +
        '- A reload or off-site round-trip restores the live conversation; tab close ends it.',
      children: [
        S('Open a chat from any page', {
          priority: 'High', points: 3, labels: ['customer-app'],
          desc: story('investor', 'a chat button on every page that expands into a chat panel', 'I can ask for help from wherever I am in the portal'),
          ac:
            'Scenario: Launch chat\n' +
            '  Given I am on any portal page\n' +
            '  When I click the chat button\n' +
            '  Then a chat panel opens and a Connect chat session is started',
        }),
        S('Minimize chat without ending it', {
          points: 3, labels: ['customer-app', 'ux'],
          desc: story('investor', 'to minimize the chat to a docked bar while keeping the session live', 'I can keep using the portal and return to my conversation, seeing if new messages arrived'),
          ac:
            'Scenario: Minimize keeps session and badges unread\n' +
            '  Given I am in an active chat\n' +
            '  When I minimize it and a new message arrives\n' +
            '  Then the docked bar shows an unread badge and restoring the panel shows the message',
        }),
        S('Close chat with an intentional confirmation', {
          points: 3, labels: ['customer-app', 'ux'],
          desc: story('investor', 'a confirmation when I close an engaged chat offering minimize or truly end it', 'I do not accidentally end a live conversation, and ending it actually disconnects me'),
          ac:
            'Scenario: Closing an engaged chat confirms\n' +
            '  Given I have exchanged messages\n' +
            '  When I click close\n' +
            '  Then I am offered Minimize (default) or End chat\n\n' +
            'Scenario: Tire-kicker close is silent\n' +
            '  Given I opened the chat but never engaged\n' +
            '  When I click close\n' +
            '  Then the chat closes without a dialog\n\n' +
            'Scenario: End truly disconnects\n' +
            '  Given I choose End chat\n' +
            '  Then the Connect participant is genuinely disconnected',
          children: [
            T('Wire close-confirm dialog (Minimize / End chat)', { desc: 'Skip dialog for never-engaged or already-ended chats.' }),
            T('Call disconnectParticipant() on end', { desc: 'Customer ChatJS ends via disconnectParticipant() - there is no disconnect(); ensure errors are not swallowed.' }),
          ],
        }),
        S('Resume a chat after reload or leaving the site', {
          priority: 'High', points: 5, labels: ['customer-app'],
          desc: story('investor', 'my chat to persist per browser tab and resume on reload or when I navigate away and back', 'I do not lose an in-progress conversation due to a refresh or a quick detour'),
          ac:
            'Scenario: Reload resumes the conversation\n' +
            '  Given I am in an active chat\n' +
            '  When I reload the page\n' +
            '  Then the chat resumes and any agent messages I missed are backfilled\n\n' +
            'Scenario: Tab close ends it\n' +
            '  Given I am in an active chat\n' +
            '  When I close the browser tab\n' +
            '  Then the chat is treated as over',
        }),
        S('Download a transcript when a live chat ends', {
          points: 2, labels: ['customer-app'],
          desc: story('investor', 'a Download transcript button when my live-agent chat ends', 'I keep a record of what was discussed and agreed'),
          ac:
            'Scenario: Transcript download on end\n' +
            '  Given a live-agent chat has ended\n' +
            '  Then I see "Chat ended." and a Download transcript button that saves a timestamped .txt',
        }),
      ],
    }),

    E('Full-Auto Bot Q&A & Self-Service Linking', {
      priority: 'Highest', labels: ['customer-app', 'ai', 'backend'],
      desc:
        'The pre-agent bot (autopilot full-auto scope) that handles conversations end-to-end: answering ' +
        'general questions about account types, IRAs, RMDs, rollovers, contributions, and taxes; directing ' +
        'investors to self-service pages with clickable in-chat links; and recognizing when a request needs ' +
        'escalation. It hard-routes trade requests and financial-advice questions to the proper channels and ' +
        'never claims it can make account changes itself.\n\n' +
        'Value: resolves the large tail of simple informational contacts without a human, at any hour.',
      ac:
        'Definition of done:\n' +
        '- The bot answers in-scope questions and links to the correct self-service page.\n' +
        '- Trade and advice intents are detected and routed, not answered.\n' +
        '- The bot never claims it can directly perform an account change.',
      children: [
        S('Get instant answers to common questions', {
          priority: 'High', points: 5, labels: ['ai', 'backend'],
          desc: story('investor', 'the bot to answer common questions about account types, IRA rules, RMDs, rollovers, contributions, and taxes', 'I get accurate answers immediately without waiting for an agent'),
          ac:
            'Scenario: In-scope question is answered\n' +
            '  Given I ask the bot an informational question in scope\n' +
            '  Then it answers concisely and, where relevant, links me to the page that goes deeper',
        }),
        S('Follow clickable in-chat links to portal pages', {
          points: 3, labels: ['customer-app', 'ai'],
          desc: story('investor', 'the bot to give me clickable links to the exact portal page for my need', 'I can act on its guidance in one click'),
          ac:
            'Scenario: In-chat link navigates\n' +
            '  Given the bot suggests a self-service page\n' +
            '  When I click the in-chat link\n' +
            '  Then the portal navigates to that page',
        }),
        S('Be safely routed for trades and financial advice', {
          priority: 'High', points: 3, labels: ['ai', 'compliance'],
          desc: story('compliance owner', 'the bot to refuse to give personalized investment advice or execute trades and instead route to the proper channel', 'we stay within regulatory boundaries while still helping the client'),
          ac:
            'Scenario: Advice is declined and routed\n' +
            '  Given I ask the bot which fund I should buy\n' +
            '  Then it does not recommend a security and offers a callback with a licensed representative\n\n' +
            'Scenario: Bot does not overclaim\n' +
            '  Given I ask the bot to change my account\n' +
            '  Then it does not imply it can perform the change itself and routes me appropriately',
        }),
      ],
    }),

    E('Escalation to Live Agent & Intent Summary', {
      priority: 'High', labels: ['customer-app', 'ai', 'connect'],
      desc:
        'When a request needs a human or an account action, the bot offers escalation to a live agent or a ' +
        'callback. On escalation, a secondary LLM call generates an intent label and a suggested agent ' +
        'greeting so the agent\'s workspace is pre-populated with context before the first human word.\n\n' +
        'Value: shortens handle time and makes the handoff feel seamless - the agent already knows why the ' +
        'client is here.',
      ac:
        'Definition of done:\n' +
        '- The bot offers live chat or callback when escalation is warranted.\n' +
        '- An intent label and suggested greeting are generated and attached to the contact.\n' +
        '- The client is told what to expect while connecting.',
      children: [
        S('Escalate to a live agent or a callback', {
          priority: 'High', points: 5, labels: ['customer-app', 'connect'],
          desc: story('investor', 'to choose between chatting with a live agent now or scheduling a callback when I need a human', 'I can pick the path that fits my situation'),
          ac:
            'Scenario: Escalation choice\n' +
            '  Given the bot determines I need a human\n' +
            '  Then it offers live chat or a scheduled callback\n' +
            '  And routes me down whichever I choose',
        }),
        S('Hand the agent a pre-built intent summary and greeting', {
          priority: 'High', points: 5, labels: ['ai', 'backend'],
          desc: story('agent', 'an AI-generated intent label and suggested greeting waiting in my workspace when a chat arrives', 'I open the conversation already knowing the context and can greet the client by need'),
          ac:
            'Scenario: Context precedes the human\n' +
            '  Given a client escalates to live chat\n' +
            '  When the contact appears in the agent workspace\n' +
            '  Then an intent label and a suggested greeting are present before any agent message',
        }),
      ],
    }),

    E('Human-Realistic Live Chat UX', {
      priority: 'High', labels: ['customer-app', 'agent-app', 'ux'],
      desc:
        'The details that make a live (and autopilot-assisted) chat feel human: bidirectional typing ' +
        'indicators with a reading delay before a typing delay, avatars that switch from a "V" assistant mark ' +
        'to the connected agent\'s initials, and the agent\'s full name broadcast on connect so initials and ' +
        'attribution are correct.\n\n' +
        'Value: trust and warmth - clients engage more openly when the experience feels like a real person.',
      ac:
        'Definition of done:\n' +
        '- Typing indicators appear/expire correctly in both directions.\n' +
        '- Autopilot replies show a reading delay then a typing delay before sending.\n' +
        '- Avatars and names reflect the connected agent for the rest of the chat.',
      children: [
        S('See when the agent is typing', {
          points: 3, labels: ['customer-app', 'ux'],
          desc: story('investor', 'an animated typing indicator when the agent (or autopilot drafting on their behalf) is composing', 'I know a reply is coming and do not send duplicate messages'),
          ac:
            'Scenario: Typing indicator lifecycle\n' +
            '  Given I am connected to an agent\n' +
            '  When the agent is composing\n' +
            '  Then I see an animated ellipsis that fades after ~60s of inactivity and reappears when they resume',
        }),
        S('Make autopilot replies feel human-paced', {
          points: 5, labels: ['agent-app', 'ai'],
          desc: story('investor', 'autopilot replies to arrive at a human pace - a reading pause before the typing indicator even appears', 'AI-assisted replies are indistinguishable from a person typing'),
          ac:
            'Scenario: Reading then typing delay\n' +
            '  Given autopilot has drafted the next agent message\n' +
            '  Then it first waits a reading delay (min ~2s, longer for longer client messages) with no ellipsis\n' +
            '  And only then shows the typing ellipsis during the typing delay before sending',
        }),
        S('Show the connected agent\'s identity', {
          points: 3, labels: ['customer-app', 'agent-app'],
          desc: story('investor', 'the avatar and name to reflect the real agent once a human connects', 'I know I am talking to a named person, not a bot'),
          ac:
            'Scenario: Avatar switches to the agent\n' +
            '  Given a live agent connects to my chat\n' +
            '  Then agent messages and the typing ellipsis show the agent\'s initials for the rest of the chat',
        }),
      ],
    }),

    E('Continue a Recent Agent Chat', {
      priority: 'Medium', labels: ['customer-app', 'connect'],
      desc:
        'If the client spoke with a live agent within the last 7 days, opening the chat shows a card (above ' +
        'the topic pills) with the date and a one-sentence recap and a "Continue this chat" button. Clicking ' +
        'it checks whether that specific agent is currently available and lets the client wait for them or ' +
        'take the first available agent; on accept, the prior transcript loads into the agent\'s workspace ' +
        'marked as a continued conversation. Purely additive - absent when there is no recent agent chat.\n\n' +
        'Value: continuity - clients pick up where they left off with the person who already knows their story.',
      ac:
        'Definition of done:\n' +
        '- The card appears only when a qualifying recent agent chat exists.\n' +
        '- Availability of the specific prior agent is checked; client can wait or take first-available.\n' +
        '- On accept, the prior transcript loads above a "continued chat" divider.',
      children: [
        S('Offer to continue a recent agent conversation', {
          points: 5, labels: ['customer-app'],
          desc: story('returning investor', 'a card offering to continue my recent live-agent chat with its date and a one-line recap', 'I can resume an in-flight matter instead of re-explaining it'),
          ac:
            'Scenario: Continue card shows for recent agent chat\n' +
            '  Given I had a live-agent chat in the last 7 days\n' +
            '  When I open the chat\n' +
            '  Then I see a "Continue this chat" card with the date and a one-sentence recap\n\n' +
            'Scenario: No recent agent chat\n' +
            '  Given I have not had a live-agent chat recently\n' +
            '  Then the card is absent and the experience is unchanged',
        }),
        S('Choose to wait for my prior agent or take the next available', {
          points: 5, labels: ['customer-app', 'connect'],
          desc: story('returning investor', 'to see whether my previous agent is available and choose to wait for them or take the first available agent', 'I can balance continuity against how quickly I need help'),
          ac:
            'Scenario: Prior agent availability drives the choice\n' +
            '  Given I click Continue this chat\n' +
            '  When the system checks my prior agent\'s availability\n' +
            '  Then I can wait for that agent if available, or take the first available\n' +
            '  And on accept the agent sees my prior transcript marked as continued',
        }),
      ],
    }),

    E('In-Chat Topic & Question Pills', {
      priority: 'Medium', labels: ['customer-app', 'ai'],
      desc:
        'Context-aware suggestion chips in the chat: topic pills reflecting what investors actually ask on ' +
        'the exact page (or wizard step) they are on, and follow-on question pills with pre-written answers ' +
        'for a chosen topic. Open-account in-flow topics are step-aware and ungated to the account being ' +
        'opened.\n\n' +
        'Value: lowers the effort to ask the right question and showcases relevant self-service, increasing ' +
        'successful self-resolution.',
      ac:
        'Definition of done:\n' +
        '- Topic pills are specific to the current page/step, not generic.\n' +
        '- Selecting a topic surfaces likely follow-up questions with answers.\n' +
        '- Wizard steps publish a fine-grained context key that the chat prefers.',
      children: [
        S('See page-relevant topic suggestions', {
          points: 3, labels: ['customer-app', 'ai'],
          desc: story('investor', 'topic chips that reflect what people actually ask on the page I am viewing', 'I can start a useful conversation in one tap'),
          ac:
            'Scenario: Topics match the page\n' +
            '  Given I open the chat on a specific page or wizard step\n' +
            '  Then the topic pills are specific to that page/step\n' +
            '  And selecting one starts a relevant exchange',
        }),
        S('See predicted follow-up questions with answers', {
          points: 3, labels: ['customer-app', 'ai'],
          desc: story('investor', 'suggested follow-up questions with ready answers after I pick a topic', 'I can get deeper without typing'),
          ac:
            'Scenario: Question pills carry answers\n' +
            '  Given I selected a topic\n' +
            '  Then I see likely follow-up questions\n' +
            '  And choosing one shows its pre-written answer',
        }),
      ],
    }),

    E('Chat History & Transcript Access', {
      priority: 'Medium', labels: ['customer-app'],
      desc:
        'A hamburger menu in the chat header opens the client\'s live-agent chats from the last 90 days, ' +
        'newest first - each card shows the date/time, duration, and a short second-person recap. Only chats ' +
        'that have that recap are listed. Cards open a read-only transcript with a download link, and can be ' +
        'pinned to the top for easy future reference.\n\n' +
        'Value: gives clients a durable, self-serve record of their agent interactions.',
      ac:
        'Definition of done:\n' +
        '- History lists qualifying past agent chats with date, duration, and recap.\n' +
        '- A card opens a read-only, downloadable transcript.\n' +
        '- Pin/unpin reorders pinned chats to the top and persists.',
      children: [
        S('Browse my past agent chats', {
          points: 5, labels: ['customer-app'],
          desc: story('investor', 'a history list of my live-agent chats from the last 90 days with date, duration, and a recap', 'I can find and revisit a prior conversation'),
          ac:
            'Scenario: History lists recapped chats\n' +
            '  Given I open the chat history menu\n' +
            '  Then I see my recent live-agent chats newest-first with date, duration, and a recap\n' +
            '  And bot-only conversations are not listed',
        }),
        S('Open and download a past transcript', {
          points: 3, labels: ['customer-app'],
          desc: story('investor', 'to open a read-only transcript of a past chat and download it', 'I can review or keep a record of what was said'),
          ac:
            'Scenario: Read-only transcript with download\n' +
            '  Given I open a history card\n' +
            '  Then I see the full conversation read-only with a download link',
        }),
        S('Pin important chats to the top of history', {
          points: 3, labels: ['customer-app'],
          desc: story('investor', 'to pin a chat so it stays at the top of my history', 'I can quickly return to a conversation that matters'),
          ac:
            'Scenario: Pin reorders and persists\n' +
            '  Given I pin a chat in history\n' +
            '  Then it moves to a pinned section at the top and stays pinned on my next visit',
        }),
      ],
    }),
  ],
}));

// ===========================================================================
// FEATURE 3 - AI Autopilot Engine (Task Automation Brain)
// ===========================================================================
FEATURES.push(F('AI Autopilot Engine', {
  component: 'Autopilot Engine',
  priority: 'Highest',
  labels: ['backend', 'ai', 'llm'],
  desc:
    'The core intelligence of the platform: a single Lambda that handles every AI-driven chat turn for both ' +
    'the pre-agent bot and the live-agent autopilot. For a live chat it identifies which of 19 account tasks ' +
    'the client needs, then drives a structured, reactive field-collection conversation until every required ' +
    'value is confirmed - at which point it hands the agent a ready-to-approve Proposed Action. It applies ' +
    'shared guardrails (financial advice, trades, fraud, inheritance) across every task and uses the right ' +
    'model for each job (Amazon Nova Micro for fast classification; OpenAI GPT for the conversational experts).\n\n' +
    'Value: this is what lets one agent supervise many conversations - the AI does the collecting, validating, ' +
    'and structuring; the agent does the judgment.',
  ac:
    'Definition of done:\n' +
    '- The engine routes every scope correctly and never hands off without a complete Proposed Action.\n' +
    '- All 19 task experts collect their fields, enforce their rules, and exit cleanly.\n' +
    '- Shared guardrails apply identically across every task.',
  children: [

    E('Autopilot Scopes & Turn Orchestration', {
      priority: 'Highest', labels: ['backend', 'ai'],
      desc:
        'The dispatcher that runs every chat turn under one of several scopes (full-auto, get-intent, ' +
        'idle-check, callback, locate-evidence) in a single stateless, reactive Lambda. It selects the model ' +
        'per job (Nova Micro vs OpenAI GPT), applies a safety guard that prevents exiting autopilot without a ' +
        'concrete Proposed Action, and degrades gracefully on LLM error.\n\n' +
        'Value: a single well-structured engine is cheaper to operate, easier to reason about, and avoids the ' +
        'race conditions of a polling design.',
      ac:
        'Definition of done:\n' +
        '- Each scope is dispatched correctly from a single handler.\n' +
        '- The safety guard resets a premature exit when no Proposed Action exists.\n' +
        '- An LLM failure yields a safe holding message rather than a broken turn.',
      children: [
        S('Run all chat turns through one scoped engine', {
          priority: 'High', points: 5, labels: ['backend', 'ai'],
          desc: story('platform owner', 'every AI chat turn to run through one scoped, stateless Lambda', 'behavior is consistent and the system stays simple to operate and reason about'),
          ac:
            'Scenario: Scope dispatch\n' +
            '  Given an incoming chat turn with a scope\n' +
            '  When the engine runs\n' +
            '  Then it executes the matching behavior (full-auto, get-intent, idle-check, callback, or locate-evidence)',
        }),
        S('Never hand off without a complete Proposed Action', {
          priority: 'High', points: 3, labels: ['backend', 'ai'],
          desc: story('agent', 'autopilot to never exit to me unless a concrete Proposed Action is ready', 'I never receive a handoff with nothing to act on'),
          ac:
            'Scenario: Premature exit is blocked\n' +
            '  Given the expert signals completion but has produced no Proposed Action\n' +
            '  When the engine evaluates the exit\n' +
            '  Then it resets the exit to false and keeps collecting',
        }),
        S('Degrade gracefully on AI failure', {
          points: 3, labels: ['backend', 'ai'],
          desc: story('investor', 'a calm holding message if the AI errors rather than a broken chat', 'a transient model failure never leaves me staring at an error'),
          ac:
            'Scenario: Safe fallback on error\n' +
            '  Given the LLM call throws during a turn\n' +
            '  Then the client receives a brief "pulling some information" style message and the turn ends safely',
        }),
      ],
    }),

    E('Task Identification (Phase 1)', {
      priority: 'Highest', labels: ['backend', 'ai'],
      desc:
        'Phase 1 of the live-agent autopilot: determine which of the 19 tasks the client needs. A zero-LLM ' +
        'keyword matcher tries first (fastest, cheapest); an LLM fallback (Nova Micro) resolves the ' +
        'paraphrased cases ("give his wife access"). Financial-advice requests short-circuit to the callback ' +
        'scope before identification so "best stocks to buy" is not swallowed by a purchase task.\n\n' +
        'Value: fast, accurate task routing keeps cost down and gets the right expert on the conversation.',
      ac:
        'Definition of done:\n' +
        '- Keyword matching resolves common intents with no LLM call.\n' +
        '- The LLM fallback resolves paraphrased intents.\n' +
        '- Advice intents are routed to callback before task identification.',
      children: [
        S('Identify the task from the client\'s words', {
          priority: 'High', points: 5, labels: ['backend', 'ai'],
          desc: story('agent', 'autopilot to recognize which account task the client needs from their own phrasing', 'the right expert starts collecting without me categorizing the request'),
          ac:
            'Scenario: Keyword match first, LLM fallback\n' +
            '  Given a client describes their need\n' +
            '  When keyword matching finds a task\n' +
            '  Then that task starts immediately\n' +
            '  And when keywords miss, an LLM classifies the intent before starting',
        }),
        S('Route advice requests away from task collection', {
          priority: 'High', points: 3, labels: ['ai', 'compliance'],
          desc: story('compliance owner', 'requests for financial advice to short-circuit to a callback before any task is identified', 'we never let an advice request masquerade as a transactional task'),
          ac:
            'Scenario: Advice short-circuit\n' +
            '  Given the client asks what they should buy\n' +
            '  When intent is evaluated\n' +
            '  Then it is routed to the callback scope, not the purchase task',
        }),
      ],
    }),

    E('Reactive Field Collection (Phase 2)', {
      priority: 'Highest', labels: ['backend', 'ai', 'llm'],
      desc:
        'Phase 2: a dedicated expert prompt for the identified task drives a reactive conversation. The expert ' +
        'knows which fields remain, the client\'s current account state, the field validation rules, and how ' +
        'to format the proposedAction JSON. It runs only when the client sends a new message (no polling) and ' +
        'exits with shouldExitAutopilot + a populated proposedAction when every field is confirmed.\n\n' +
        'Value: structured, reliable collection turns messy natural language into a clean, reviewable action.',
      ac:
        'Definition of done:\n' +
        '- The expert collects only the fields still needed, honoring conditional skips.\n' +
        '- It runs reactively (one turn per client message) and never double-sends.\n' +
        '- On completion it emits a well-formed proposedAction and exits.',
      children: [
        S('Collect a task\'s fields conversationally', {
          priority: 'High', points: 8, labels: ['backend', 'ai'],
          desc: story('agent', 'autopilot to gather every required field for the identified task by conversing with the client', 'a complete, structured request is assembled for me to review'),
          ac:
            'Scenario: Reactive collection to completion\n' +
            '  Given a task is in progress\n' +
            '  When the client answers a question\n' +
            '  Then the expert records it, asks only for what remains, and on the final field emits a proposedAction and exits',
        }),
        S('Follow up on partially answered prompts', {
          points: 3, labels: ['ai'],
          desc: story('investor', 'the assistant to notice when I answered only part of a multi-part question and ask for the rest', 'nothing required is silently skipped'),
          ac:
            'Scenario: Partial answer triggers follow-up\n' +
            '  Given the assistant asked for two pieces of information\n' +
            '  When I provide only one\n' +
            '  Then it follows up for the missing piece before moving on',
        }),
      ],
    }),

    E('Cross-Cutting Guardrails (All Tasks)', {
      priority: 'Highest', labels: ['backend', 'ai', 'compliance'],
      desc:
        'Shared constants injected into all 19 task prompts so behavior is uniform: FORBIDDEN_TOPICS ' +
        '(financial advice, trade execution, fraud/security incidents, inheritance) each with a scripted ' +
        'response; a no-trades variant for tasks that legitimately handle trades; language rules for restating ' +
        'client-stated vs database-sourced facts; a no-repeat / frustrated-yes rule; and hallucination ' +
        'protection. Changing one constant changes every expert at once.\n\n' +
        'Value: consistent, compliant handling of sensitive topics regardless of which task is active.',
      ac:
        'Definition of done:\n' +
        '- All 19 experts share identical forbidden-topic handling.\n' +
        '- Restating language distinguishes client-stated from database-sourced facts.\n' +
        '- Experts do not invent account facts they were not given.',
      children: [
        S('Apply forbidden-topic handling uniformly', {
          priority: 'High', points: 5, labels: ['ai', 'compliance'],
          desc: story('compliance owner', 'every task expert to handle advice, trades, fraud, and inheritance with the same scripted responses', 'sensitive topics are handled consistently no matter which task is active'),
          ac:
            'Scenario: Uniform forbidden-topic response\n' +
            '  Given any of the 19 tasks is active\n' +
            '  When the client raises a forbidden topic\n' +
            '  Then the expert gives the shared scripted response and routes appropriately',
        }),
        S('Restate facts with correct attribution', {
          points: 3, labels: ['ai'],
          desc: story('investor', 'the assistant to say "Got it - X will be Y" for what I just told it and "I see X is currently" for what it read from my account', 'I can trust which facts came from me versus from the system'),
          ac:
            'Scenario: Attribution language\n' +
            '  Given the assistant restates information\n' +
            '  Then client-stated values use "Got it" phrasing and database values use "I see ... currently" phrasing',
        }),
        S('Prevent the assistant from inventing account facts', {
          priority: 'High', points: 3, labels: ['ai', 'compliance'],
          desc: story('compliance owner', 'experts to refuse to fabricate account data they were not provided', 'clients are never given hallucinated balances, holdings, or statuses'),
          ac:
            'Scenario: No hallucinated data\n' +
            '  Given the expert lacks a specific account fact\n' +
            '  When the client asks for it\n' +
            '  Then it does not invent a value and instead fetches it or declines',
        }),
      ],
    }),

    E('The 19 Task Experts', {
      priority: 'Highest', labels: ['backend', 'ai'],
      desc:
        'The catalog of nineteen task experts. Each is a narrow, testable conversational specialist with its ' +
        'own field schema (including conditional skips and account-type/eligibility filters), business rules, ' +
        'and an execution type of real (writes data) or mock (returns a realistic confirmation). Each story ' +
        'below is one expert; the engine selects exactly one per conversation.\n\n' +
        'Value: per-task experts keep each flow precise and verifiable instead of blurring rules in one giant ' +
        'general agent.',
      ac:
        'Definition of done:\n' +
        '- Each expert collects exactly its required fields and honors its skips/eligibility.\n' +
        '- Each exits with a correctly shaped proposedAction stamped with its submission type.\n' +
        '- Real-execution experts write the right records; mock experts return clean confirmations.',
      children: [
        S('Autopilot: Update Contact Information', {
          points: 3, labels: ['ai'],
          desc: story('investor', 'to update my phone, email, or mailing address through chat', 'I can keep my contact details current without a form or a call'),
          ac:
            'Scenario: Collect contact change\n' +
            '  Given I want to update contact info\n' +
            '  When I provide which item and the new value\n' +
            '  Then autopilot produces a Proposed Action to update that field',
        }),
        S('Autopilot: Change Beneficiary Designations', {
          priority: 'High', points: 8, labels: ['ai', 'self-service'],
          desc: story('IRA account holder', 'to add, update, or remove a beneficiary on an eligible account through chat', 'I control inheritance without paperwork, with the allocations validated'),
          ac:
            'Scenario: Collect a beneficiary change\n' +
            '  Given I choose an eligible (IRA/SEP) account and an action\n' +
            '  When the action is add or update\n' +
            '  Then autopilot collects name, relationship, percentage, and primary/secondary\n' +
            '  And for remove it collects only the name\n\n' +
            'Scenario: Allocation and existing-beneficiary rules\n' +
            '  Given existing beneficiaries are present\n' +
            '  Then the expert acknowledges them and enforces a 100% total\n' +
            '  And taxable accounts are never offered for beneficiaries\n\n' +
            'Scenario: Real write on approval\n' +
            '  Given the Proposed Action is approved\n' +
            '  Then the beneficiaries for that account are atomically replaced while other accounts are preserved',
        }),
        S('Autopilot: Add Authorized Account User (Type 3)', {
          priority: 'High', points: 5, labels: ['ai', 'compliance'],
          desc: story('account owner', 'to grant another person view-only, limited, or full access to my account', 'I can add a trusted user, with the authorization requiring my own approval'),
          ac:
            'Scenario: Collect access grant\n' +
            '  Given I want to add an authorized user\n' +
            '  When I provide their name, email, and access level\n' +
            '  Then autopilot produces a Proposed Action marked as client-submitted (Type 3)\n\n' +
            'Scenario: Owner must approve\n' +
            '  Given the agent sends the action to me\n' +
            '  Then I approve it in my own chat before it executes',
        }),
        S('Autopilot: Open a New Account', {
          points: 5, labels: ['ai'],
          desc: story('investor', 'to open a Roth IRA, Traditional IRA, SEP-IRA, or Taxable account through chat', 'I can start a new account in conversation'),
          ac:
            'Scenario: Collect new-account details\n' +
            '  Given I want to open an account\n' +
            '  When I provide account type, initial contribution, and funding source\n' +
            '  Then autopilot produces a Proposed Action to open it',
        }),
        S('Autopilot: Buy / Make a Contribution', {
          points: 5, labels: ['ai'],
          desc: story('investor', 'to buy shares of a fund or contribute to an account through chat', 'I can place a purchase request for an agent to execute'),
          ac:
            'Scenario: Collect purchase\n' +
            '  Given I want to buy into an account\n' +
            '  When I provide account (if I have several), fund, amount, and funding source\n' +
            '  Then autopilot produces a Proposed Action for the purchase',
        }),
        S('Autopilot: Sell Fund Shares', {
          points: 5, labels: ['ai'],
          desc: story('investor', 'to sell shares of a fund through chat', 'I can request a sale with the reason captured'),
          ac:
            'Scenario: Collect sale\n' +
            '  Given I want to sell\n' +
            '  When I provide account, fund, amount or full redemption, and reason\n' +
            '  Then autopilot produces a Proposed Action for the sale',
        }),
        S('Autopilot: Exchange Between Funds', {
          points: 3, labels: ['ai'],
          desc: story('investor', 'to move money from one fund to another within an account through chat', 'I can rebalance without separate buy/sell steps'),
          ac:
            'Scenario: Collect exchange\n' +
            '  Given I want to exchange funds\n' +
            '  When I provide account, from-fund, to-fund, and amount\n' +
            '  Then autopilot produces a Proposed Action for the exchange',
        }),
        S('Autopilot: Change Dividend Reinvestment (DRIP)', {
          points: 3, labels: ['ai'],
          desc: story('investor', 'to turn dividend reinvestment on or off for a fund through chat', 'I control whether dividends buy more shares or pay out as cash'),
          ac:
            'Scenario: Collect DRIP change\n' +
            '  Given I want to change dividend handling\n' +
            '  When I provide account, fund, and on/off\n' +
            '  Then autopilot produces a Proposed Action for the DRIP setting',
        }),
        S('Autopilot: Set Up Automatic Investment', {
          points: 5, labels: ['ai', 'self-service'],
          desc: story('investor', 'to create a recurring automatic investment through chat', 'I can start dollar-cost-averaging on a schedule'),
          ac:
            'Scenario: Collect new auto-invest\n' +
            '  Given I want to set up automatic investing\n' +
            '  When I provide account, fund, amount, frequency, and day of month\n' +
            '  Then autopilot produces a Proposed Action that, on approval, creates the schedule (real write)',
        }),
        S('Autopilot: Modify Auto-Invest Schedule', {
          points: 3, labels: ['ai', 'self-service'],
          desc: story('investor', 'to change the amount, frequency, or day of an existing auto-invest schedule through chat', 'I can adjust recurring investing as my situation changes'),
          ac:
            'Scenario: Collect auto-invest change\n' +
            '  Given I describe which schedule to change\n' +
            '  When I provide the new amount, frequency, and day\n' +
            '  Then autopilot produces a Proposed Action that updates the schedule (real write)',
        }),
        S('Autopilot: Pause or Resume Auto-Invest', {
          points: 3, labels: ['ai', 'self-service'],
          desc: story('investor', 'to pause or resume an auto-invest schedule through chat', 'I can temporarily stop and later restart recurring investing'),
          ac:
            'Scenario: Collect pause/resume\n' +
            '  Given I describe the schedule\n' +
            '  When I choose pause or resume\n' +
            '  Then autopilot produces a Proposed Action that toggles it (real write)',
        }),
        S('Autopilot: Request a Distribution', {
          points: 5, labels: ['ai'],
          desc: story('investor', 'to request a one-time withdrawal from an account through chat', 'I can take money out with delivery and withholding captured correctly'),
          ac:
            'Scenario: Collect distribution\n' +
            '  Given I want to withdraw\n' +
            '  When I provide account, amount, and delivery method\n' +
            '  Then autopilot also asks about federal tax withholding for Traditional/SEP IRAs\n' +
            '  And produces a Proposed Action for the distribution',
        }),
        S('Autopilot: Set Up Recurring Distributions', {
          points: 5, labels: ['ai'],
          desc: story('retiree', 'to set up systematic recurring withdrawals through chat', 'I can create reliable retirement income'),
          ac:
            'Scenario: Collect systematic withdrawal\n' +
            '  Given I want recurring distributions\n' +
            '  When I provide account, amount, frequency, start date, and delivery method\n' +
            '  Then autopilot produces a Proposed Action for the recurring plan',
        }),
        S('Autopilot: Update RMD Settings', {
          points: 5, labels: ['ai', 'self-service'],
          desc: story('retiree with a Traditional or SEP IRA', 'to set how and when I receive my Required Minimum Distribution through chat', 'I stay compliant with delivery and withholding I choose'),
          ac:
            'Scenario: Eligibility-gated RMD settings\n' +
            '  Given I hold a Traditional IRA or SEP-IRA\n' +
            '  When I provide delivery method, frequency, and withholding percentage\n' +
            '  Then autopilot produces a Proposed Action that writes my RMD preferences (real write)\n\n' +
            'Scenario: Not offered when ineligible\n' +
            '  Given I hold only Roth/taxable accounts\n' +
            '  Then this task is not eligible',
        }),
        S('Autopilot: Roll Over From Another Institution', {
          points: 5, labels: ['ai'],
          desc: story('investor', 'to start rolling over an employer plan or outside account into Vanguard through chat', 'I can begin consolidating assets without a phone call'),
          ac:
            'Scenario: Collect rollover\n' +
            '  Given I want to roll money in\n' +
            '  When I provide source institution, source type, estimated amount, and receiving account\n' +
            '  Then autopilot produces a Proposed Action to initiate the rollover',
        }),
        S('Autopilot: Convert to Roth IRA', {
          points: 5, labels: ['ai', 'compliance'],
          desc: story('investor with a Traditional or SEP IRA', 'to convert all or part of it to a Roth IRA through chat', 'I can initiate a conversion with the taxable nature made clear'),
          ac:
            'Scenario: Collect Roth conversion\n' +
            '  Given I hold a Traditional or SEP IRA\n' +
            '  When I provide source account, amount, and tax year\n' +
            '  Then autopilot produces a Proposed Action and conveys that a conversion is a taxable event',
        }),
        S('Autopilot: Request Tax Document', {
          points: 3, labels: ['ai'],
          desc: story('investor', 'to request a tax form (1099-R, 1099-B, 1099-DIV, or 5498) through chat', 'I can get the document I need for filing'),
          ac:
            'Scenario: Collect tax-document request\n' +
            '  Given I need a tax form\n' +
            '  When I provide the form type and tax year\n' +
            '  Then autopilot produces a Proposed Action for the document',
        }),
        S('Autopilot: Cancel or Reschedule Callback', {
          points: 3, labels: ['ai'],
          desc: story('investor', 'to cancel or reschedule a callback I previously arranged through chat', 'I can change my mind without re-explaining'),
          ac:
            'Scenario: Collect callback change\n' +
            '  Given I have a callback arranged\n' +
            '  When I choose cancel, or reschedule with a new time\n' +
            '  Then autopilot produces a Proposed Action accordingly',
        }),
        S('Autopilot: Update Security Settings', {
          points: 3, labels: ['ai', 'security'],
          desc: story('investor', 'to change my password, manage two-factor authentication, or remove a trusted device through chat', 'I can keep my account secure'),
          ac:
            'Scenario: Collect security change\n' +
            '  Given I want to update security\n' +
            '  When I choose the security action\n' +
            '  Then autopilot produces a Proposed Action for it',
        }),
      ],
    }),

    E('Callback Scope & Time Resolution', {
      priority: 'High', labels: ['backend', 'ai'],
      desc:
        'The conversational callback scope: it arranges a phone callback while the LLM never computes ' +
        'timestamps - it emits a day reference, hour, and minute, and the server resolves and validates the ' +
        'Eastern-Time to UTC instant (TZ-safe) and injects authoritative agent availability. Financial-advice ' +
        'requests are funneled here.\n\n' +
        'Value: reliable, correct scheduling (no timezone bugs) and a compliant home for advice requests.',
      ac:
        'Definition of done:\n' +
        '- The model emits a structured time; the server resolves/validates ET->UTC.\n' +
        '- Real agent availability is injected into the conversation.\n' +
        '- Advice requests are handled in this scope.',
      children: [
        S('Arrange a callback at a valid time', {
          priority: 'High', points: 5, labels: ['ai', 'backend'],
          desc: story('investor', 'to arrange a callback by describing a day and time in plain language', 'I get a correctly scheduled call without timezone confusion'),
          ac:
            'Scenario: Server resolves the time\n' +
            '  Given I describe a callback time conversationally\n' +
            '  When autopilot captures a day reference, hour, and minute\n' +
            '  Then the server resolves it to a validated ET->UTC instant and reflects real availability',
        }),
      ],
    }),

    E('Proposed-Action Evidence Location', {
      priority: 'Medium', labels: ['backend', 'ai', 'agent-app'],
      desc:
        'A post-hoc utility scope (locate-evidence) that, given a transcript and a Proposed Action, picks the ' +
        'authoritative transcript span for each collected field - the client\'s own statement, else the ' +
        'client-confirmed agent recap, never post-confirmation echoes. Every quote is validated server-side ' +
        'against the actual message text. Drives the evidence highlighting in the agent UI.\n\n' +
        'Value: lets agents verify, at a glance, exactly where each value in a Proposed Action came from.',
      ac:
        'Definition of done:\n' +
        '- For each field it returns a validated {messageId, start, end} span or nothing.\n' +
        '- Post-confirmation echoes are never selected.\n' +
        '- Any failure yields an empty evidence set (no false highlights).',
      children: [
        S('Locate the transcript evidence for each collected field', {
          points: 5, labels: ['backend', 'ai'],
          desc: story('agent', 'the system to identify where in the transcript each Proposed Action value was established', 'I can trust the card by seeing its source, and scrutinize anything unlocatable'),
          ac:
            'Scenario: Validated spans only\n' +
            '  Given a Proposed Action and its transcript\n' +
            '  When evidence location runs\n' +
            '  Then each field maps to a validated client statement or confirmed recap span\n' +
            '  And degenerate or unverifiable cases return no evidence rather than a wrong span',
        }),
      ],
    }),

    E('Idle Detection & Proactive Check-In', {
      priority: 'Low', labels: ['backend', 'ai', 'agent-app'],
      desc:
        'The idle-check scope: when an agent has asked a question and the client goes quiet, an automatic ' +
        'timer triggers a gentle check-in message so the conversation does not stall.\n\n' +
        'Value: keeps conversations moving and reduces silent abandonment.',
      ac:
        'Definition of done:\n' +
        '- A check-in fires after the configured idle period following an agent question.\n' +
        '- It does not fire repeatedly or when the client is actively typing.',
      children: [
        S('Nudge a quiet client with a check-in', {
          points: 3, labels: ['ai'],
          desc: story('agent', 'autopilot to send a friendly check-in when the client goes quiet after I asked something', 'conversations do not stall and I do not have to babysit silence'),
          ac:
            'Scenario: Idle check-in\n' +
            '  Given I asked the client a question\n' +
            '  When the client is idle past the threshold\n' +
            '  Then autopilot sends a single check-in message',
        }),
      ],
    }),
  ],
}));

// ===========================================================================
// FEATURE 4 - Agent Workspace (Representative Console)
// ===========================================================================
FEATURES.push(F('Agent Workspace', {
  component: 'Agent Workspace',
  priority: 'Highest',
  labels: ['agent-app', 'connect', 'react'],
  desc:
    'A four-column dashboard that lets a single representative handle up to four simultaneous client chats. ' +
    'Each column carries the client profile, the live chat thread, an AI support panel (suggested replies, ' +
    'predicted topics/questions, recommended articles, autopilot controls), and a Proposed Action card the ' +
    'agent reviews and approves. The workspace also manages incoming contacts, detects client disconnects, ' +
    'and auto-generates after-call work. The guiding principle: the AI does the work, the agent does the ' +
    'judgment.\n\n' +
    'Value: multiplies agent capacity and quality - more concurrent conversations, less typing and lookup, ' +
    'and consistent wrap-up.',
  ac:
    'Definition of done:\n' +
    '- An agent can run up to four concurrent chats with per-column context and AI support.\n' +
    '- Incoming contacts, disconnects, and ACW are handled in every UI mode.\n' +
    '- Proposed Actions can be reviewed, edited, and submitted with evidence visible.',
  children: [

    E('Multi-Chat Desktop & CCP Integration', {
      priority: 'Highest', labels: ['agent-app', 'connect'],
      desc:
        'The core desktop: an Amazon Connect CCP-backed, four-column layout where each column is one ' +
        'conversation slot showing client info, the chat thread, and AI support. Connection tokens are ' +
        'managed via the agent-connection Lambda; chat rendering and control messages are handled per column.\n\n' +
        'Value: the canvas that makes concurrent, context-rich handling possible.',
      ac:
        'Definition of done:\n' +
        '- Up to four slots render independently with correct client context.\n' +
        '- CCP connection and tokens are established reliably.\n' +
        '- Control messages (names, typing, approvals) are intercepted, not rendered as chat.',
      children: [
        S('Handle up to four chats at once', {
          priority: 'High', points: 5, labels: ['agent-app', 'connect'],
          desc: story('agent', 'a four-column desktop where each column is a separate client conversation', 'I can help several clients at once without losing track of any'),
          ac:
            'Scenario: Independent slots\n' +
            '  Given I am handling multiple chats\n' +
            '  Then each column shows its own client info, thread, and AI support independently',
        }),
        S('See the client\'s profile and accounts alongside the chat', {
          points: 3, labels: ['agent-app'],
          desc: story('agent', 'each column to show the client name, intent label, and account summary', 'I have the context I need without switching tools'),
          ac:
            'Scenario: Client context panel\n' +
            '  Given a chat is active in a column\n' +
            '  Then I see the client name, AI intent label, and account details for that client',
        }),
      ],
    }),

    E('Incoming Contact Management', {
      priority: 'High', labels: ['agent-app', 'connect'],
      desc:
        'New contacts arrive as an alert card with a countdown timer, the client name, the AI-generated intent ' +
        'summary, and the account types held; agents accept or skip. A bonus-opportunity badge surfaces when a ' +
        'contact qualifies for an incentive.\n\n' +
        'Value: agents triage incoming work quickly and with context, improving acceptance and prioritization.',
      ac:
        'Definition of done:\n' +
        '- Incoming alerts show name, intent summary, accounts, and a countdown.\n' +
        '- Accept routes the contact into a slot; skip releases it.\n' +
        '- Bonus badges render when applicable.',
      children: [
        S('Triage incoming contacts with context and a timer', {
          priority: 'High', points: 5, labels: ['agent-app'],
          desc: story('agent', 'incoming contacts to appear as a timed alert with the client name, intent summary, and accounts', 'I can decide to accept or skip with enough context and urgency'),
          ac:
            'Scenario: Accept an incoming contact\n' +
            '  Given a contact alert appears with a countdown\n' +
            '  When I accept it\n' +
            '  Then it opens in a column with the client context loaded\n\n' +
            'Scenario: Bonus opportunity badge\n' +
            '  Given an incoming contact qualifies for an incentive\n' +
            '  Then a bonus badge is shown on the alert',
        }),
      ],
    }),

    E('Focus Mode', {
      priority: 'Medium', labels: ['agent-app', 'ux'],
      desc:
        'A single-contact focused view (FocusingDesktop) for agents who want to concentrate on one conversation ' +
        'while retaining the same AI support, Proposed Action, evidence, and disconnect behaviors as the grid.\n\n' +
        'Value: reduces cognitive load for complex conversations without losing any capability.',
      ac:
        'Definition of done:\n' +
        '- Focus mode shows one contact full-width with full AI support and Proposed Action.\n' +
        '- Evidence highlighting and disconnect handling work identically to grid mode.',
      children: [
        S('Focus on one conversation full-width', {
          points: 3, labels: ['agent-app', 'ux'],
          desc: story('agent', 'to expand a single conversation into a focused view', 'I can concentrate on a complex case without distraction'),
          ac:
            'Scenario: Focus retains capabilities\n' +
            '  Given I focus a conversation\n' +
            '  Then I see its full thread, AI support, and Proposed Action\n' +
            '  And evidence highlighting and disconnect handling still work',
        }),
      ],
    }),

    E('AI Support Panel', {
      priority: 'High', labels: ['agent-app', 'ai'],
      desc:
        'The per-column assist surface: a next-best-response draft the agent can adopt/edit/ignore, predicted ' +
        'topic buttons, one-click predicted questions, recommended knowledge-base articles, and autopilot ' +
        'controls (start/stop, scope hints). It turns the agent from a typist into an editor.\n\n' +
        'Value: cuts typing and lookup time and raises response quality and consistency.',
      ac:
        'Definition of done:\n' +
        '- A suggested reply and an autopilot scope hint are shown per turn.\n' +
        '- Topic and question suggestions inject into the composer in one click.\n' +
        '- Autopilot can be started and stopped from the panel.',
      children: [
        S('Adopt an AI-suggested reply', {
          priority: 'High', points: 5, labels: ['agent-app', 'ai'],
          desc: story('agent', 'a concise suggested reply for my next turn that I can adopt, edit, or ignore', 'I respond faster without sacrificing my judgment or voice'),
          ac:
            'Scenario: Suggested reply is editable\n' +
            '  Given a client message awaits a response\n' +
            '  Then the panel shows a one-to-two sentence suggested reply and an autopilot scope hint\n' +
            '  And I can insert it into the composer and edit before sending',
        }),
        S('Insert predicted questions and recommended articles', {
          points: 3, labels: ['agent-app', 'ai'],
          desc: story('agent', 'predicted client questions and recommended KB articles I can inject with one click', 'I steer the conversation and share the right resource instantly'),
          ac:
            'Scenario: One-click inject\n' +
            '  Given the AI support panel shows predicted questions and articles\n' +
            '  When I click one\n' +
            '  Then it is inserted into my composer or shared as appropriate',
        }),
        S('Start and stop autopilot from the panel', {
          priority: 'High', points: 5, labels: ['agent-app', 'ai'],
          desc: story('agent', 'controls to start and stop autopilot for a conversation', 'I can delegate routine collection to the AI and reclaim control whenever I want'),
          ac:
            'Scenario: Autopilot control\n' +
            '  Given a conversation is active\n' +
            '  When I start autopilot\n' +
            '  Then it begins driving turns until it produces a Proposed Action or I stop it\n' +
            '  And stopping it immediately returns control to me and clears any pending typing indicator',
        }),
      ],
    }),

    E('Proposed Action Review, Evidence & Submission', {
      priority: 'Highest', labels: ['agent-app', 'ai'],
      desc:
        'When autopilot has collected all fields, a structured Proposed Action card appears with every value. ' +
        'The agent can edit any field, then submit (Type 1) or send to the client (Type 3). While the card is ' +
        'visible, the transcript highlights the exact span each value came from, and each field has a locate ' +
        '(crosshair) button that scrolls to and flashes its span; unlocatable values are flagged.\n\n' +
        'Value: fast, accountable approvals - the agent verifies the source of each value in seconds.',
      ac:
        'Definition of done:\n' +
        '- Every collected field is shown and editable before submission.\n' +
        '- Evidence highlights and locate buttons work while the card is visible.\n' +
        '- Submit executes the task and posts a confirmation to the client.',
      children: [
        S('Review and edit a Proposed Action before submitting', {
          priority: 'High', points: 5, labels: ['agent-app'],
          desc: story('agent', 'a card showing every collected field that I can edit before I submit', 'I keep final judgment over what gets executed'),
          ac:
            'Scenario: Edit then submit\n' +
            '  Given autopilot produced a Proposed Action\n' +
            '  When I correct a field and submit\n' +
            '  Then the task executes with my edited values and the client receives a confirmation',
        }),
        S('Verify each value against the transcript with evidence', {
          priority: 'High', points: 5, labels: ['agent-app', 'ai'],
          desc: story('agent', 'each card field to highlight where in the transcript it was established and let me jump to that span', 'I can trust the action and catch anything not actually said'),
          ac:
            'Scenario: Locate evidence span\n' +
            '  Given a Proposed Action card is visible\n' +
            '  When I click a field\'s locate button\n' +
            '  Then the transcript scrolls to and flashes the span where that value was established\n\n' +
            'Scenario: Unlocatable value is flagged\n' +
            '  Given a value cannot be traced to the transcript\n' +
            '  Then the field shows a "not located in transcript" hint',
          children: [
            T('Fire parallel locate-evidence request on action ready', { desc: 'During the autopilot send delay, request validated spans and store on slot.proposedActionEvidence.' }),
            T('Render highlights + crosshair jump buttons while card visible', { desc: 'Container-scoped lookup; clear on submit/reject; bail on hidden columns (clientWidth===0).' }),
          ],
        }),
      ],
    }),

    E('Client Disconnect Detection', {
      priority: 'High', labels: ['agent-app', 'connect'],
      desc:
        'If the client ends/closes the chat on their side, the column does not silently jump to wrap-up: the ' +
        'AI area is replaced by a clear "Client closed the chat." notice with an explicit End chat button, the ' +
        'composer is disabled, and any running autopilot stops. Works in all four UI modes.\n\n' +
        'Value: prevents agents from typing into a dead chat and makes the end-of-conversation explicit.',
      ac:
        'Definition of done:\n' +
        '- The customer participant-left event is detected and surfaced as a notice.\n' +
        '- The composer is disabled and autopilot stops on disconnect.\n' +
        '- Clicking End chat transitions the column to ACW.',
      children: [
        S('Know immediately when a client leaves', {
          priority: 'High', points: 5, labels: ['agent-app', 'connect'],
          desc: story('agent', 'a clear notice and a disabled composer when the client closes the chat', 'I do not keep typing into a conversation that has ended'),
          ac:
            'Scenario: Client-left notice\n' +
            '  Given a client closes the chat on their side\n' +
            '  Then I see "Client closed the chat.", the composer is disabled, and autopilot stops\n' +
            '  And clicking End chat moves the column to after-call work',
        }),
      ],
    }),

    E('After-Call Work (ACW) Generation', {
      priority: 'High', labels: ['agent-app', 'ai'],
      desc:
        'When a chat ends, the generate-acw Lambda produces a standardized wrap-up code, a 3-5 sentence ' +
        'factual summary, and one sentence of specific second-person coaching. The agent reviews and submits ' +
        'rather than writing wrap-up by hand.\n\n' +
        'Value: eliminates manual after-call work, improving accuracy and freeing capacity.',
      ac:
        'Definition of done:\n' +
        '- ACW returns a valid wrap-up code, summary, and coaching for any ended chat.\n' +
        '- The agent can review and submit (and adjust if needed).',
      children: [
        S('Get wrap-up written automatically', {
          priority: 'High', points: 5, labels: ['agent-app', 'ai'],
          desc: story('agent', 'the system to generate the wrap-up code, summary, and coaching when a chat ends', 'I review and submit after-call work instead of typing it'),
          ac:
            'Scenario: Auto-generated ACW\n' +
            '  Given a chat has ended\n' +
            '  Then I am presented a standardized wrap-up code, a 3-5 sentence summary, and one coaching point\n' +
            '  And I can review and submit it',
        }),
      ],
    }),

    E('Agent-to-Customer Messaging & Autopilot Send', {
      priority: 'High', labels: ['agent-app', 'connect', 'ai'],
      desc:
        'The send path from agent to client: the send-agent-message Lambda pushes agent messages and typing ' +
        'events via the Connect API; autopilotSend layers the human-realistic reading+typing delays and the ' +
        'agent-name broadcast so AI-assisted replies are indistinguishable from the agent typing.\n\n' +
        'Value: a single, reliable outbound path that powers both manual and AI-assisted replies.',
      ac:
        'Definition of done:\n' +
        '- Agent messages and typing events reach the client via Connect.\n' +
        '- Autopilot sends honor reading/typing delays and cancel cleanly.\n' +
        '- The agent full name is broadcast so client-side attribution is correct.',
      children: [
        S('Send agent messages and typing reliably', {
          points: 3, labels: ['agent-app', 'connect'],
          desc: story('agent', 'my messages and typing state to reach the client reliably', 'the conversation feels live and responsive'),
          ac:
            'Scenario: Outbound message and typing\n' +
            '  Given I am connected to a client\n' +
            '  When I type and send\n' +
            '  Then the client sees my typing indicator and then my message',
        }),
      ],
    }),
  ],
}));

// ===========================================================================
// FEATURE 5 - Task Execution & Fulfillment
// ===========================================================================
FEATURES.push(F('Task Execution & Fulfillment', {
  component: 'Task Execution',
  priority: 'Highest',
  labels: ['backend', 'dynamodb'],
  desc:
    'Turns an approved Proposed Action into a real outcome. The execute-task Lambda performs the action - ' +
    'writing to DynamoDB for the tasks that own real data (beneficiaries, auto-invest, RMD settings) and ' +
    'returning realistic confirmations for the rest - always producing a traceable reference number and a ' +
    'structured confirmation the client sees as a green card. It also implements the submission-type ' +
    'framework, including the client-submitted (Type 3) approval round-trip.\n\n' +
    'Value: closes the loop - requests collected by AI and approved by an agent actually take effect, with ' +
    'an auditable confirmation.',
  ac:
    'Definition of done:\n' +
    '- Every execution returns a REF-XXXXXX reference and a structured confirmation.\n' +
    '- Real-data tasks persist correctly; mock tasks return clean confirmations.\n' +
    '- Type 3 actions execute only after the client approves, with identical confirmation.',
  children: [

    E('Execute-Task Engine', {
      priority: 'Highest', labels: ['backend'],
      desc:
        'The single execution entry point: dispatches by task, distinguishes real vs mock execution, mints a ' +
        'REF-XXXXXX reference number, and returns the confirmation payload that the client chat renders.\n\n' +
        'Value: one consistent, traceable execution path for all 19 tasks.',
      ac:
        'Definition of done:\n' +
        '- Each task maps to an execution handler (real or mock).\n' +
        '- Every execution returns a unique reference number and confirmation text.',
      children: [
        S('Execute an approved action and return a reference', {
          priority: 'High', points: 5, labels: ['backend'],
          desc: story('agent', 'an approved action to execute and return a reference number', 'the client and I both have proof the action was taken'),
          ac:
            'Scenario: Execution yields a reference\n' +
            '  Given I submit an approved Proposed Action\n' +
            '  When execute-task runs\n' +
            '  Then it returns a REF-XXXXXX reference and a structured confirmation',
        }),
      ],
    }),

    E('Real DynamoDB Executions', {
      priority: 'High', labels: ['backend', 'dynamodb'],
      desc:
        'The tasks that own real data write it: beneficiaries (atomic per-account replace that preserves other ' +
        'accounts), auto-invest create/update/pause-resume, and RMD settings. Live trades append a Pending ' +
        'transaction row dated today.\n\n' +
        'Value: these high-value actions actually change the client record, so portal and assistant stay true.',
      ac:
        'Definition of done:\n' +
        '- Beneficiary writes are atomic and preserve untouched accounts.\n' +
        '- Auto-invest and RMD writes persist and are reflected on the portal.\n' +
        '- Trade executions append a Pending transaction row.',
      children: [
        S('Persist beneficiary, auto-invest, and RMD changes', {
          priority: 'High', points: 5, labels: ['backend', 'dynamodb'],
          desc: story('investor', 'my approved beneficiary, auto-invest, and RMD changes to actually save', 'the change I asked for is real, not just acknowledged'),
          ac:
            'Scenario: Atomic beneficiary replace\n' +
            '  Given I approve a beneficiary change on one account\n' +
            '  When it executes\n' +
            '  Then that account\'s beneficiaries are replaced and my other accounts are untouched\n\n' +
            'Scenario: Auto-invest and RMD persist\n' +
            '  Given I approve an auto-invest or RMD change\n' +
            '  Then the new schedule/settings appear on the corresponding portal page',
        }),
        S('Reflect executed trades in transaction history', {
          points: 3, labels: ['backend', 'dynamodb'],
          desc: story('investor', 'an executed buy to show up immediately as a Pending transaction', 'I can see the order I just placed in my history'),
          ac:
            'Scenario: Trade appends a Pending row\n' +
            '  Given a purchase is executed\n' +
            '  Then a Pending transaction dated today appears in my history',
        }),
      ],
    }),

    E('Confirmation Experience', {
      priority: 'High', labels: ['customer-app', 'ux'],
      desc:
        'Completed actions are rendered to the client as a distinct green confirmation card - structured ' +
        'header, reference number, and a past-tense description - rather than a plain chat bubble.\n\n' +
        'Value: unambiguous, reassuring proof that an action completed, with a reference for follow-up.',
      ac:
        'Definition of done:\n' +
        '- Confirmations render as a green card with header, reference, and past-tense summary.\n' +
        '- The same card renders for agent-submitted (Type 1) and client-submitted (Type 3) actions.',
      children: [
        S('Receive a clear confirmation card for completed actions', {
          points: 3, labels: ['customer-app', 'ux'],
          desc: story('investor', 'a clear confirmation card with a reference number when an action completes', 'I know exactly what was done and can reference it later'),
          ac:
            'Scenario: Green confirmation card\n' +
            '  Given an action I requested completes\n' +
            '  Then I see a green card with a header, reference number, and a past-tense description of what was done',
        }),
      ],
    }),

    E('Client-Submitted Approvals (Type 3)', {
      priority: 'High', labels: ['customer-app', 'agent-app', 'compliance'],
      desc:
        'For actions only the account owner may authorize (the first is adding an authorized user), the agent ' +
        'collects the details but cannot submit: their card button reads "Send to client", which places an ' +
        'editable "Your approval is required" card in the client\'s chat while the agent sees a waiting note. ' +
        'On the client\'s Submit, the agent app runs the exact same submit path as Type 1, so the confirmation ' +
        'is identical. Decline returns the card to the agent; agent cancel / chat-end / client-left all clean ' +
        'up the pending state, with an idempotency guard on the relay.\n\n' +
        'Value: enforces that owner-only authorizations are actually made by the owner, without a separate flow.',
      ac:
        'Definition of done:\n' +
        '- Agent "Send to client" places an editable approval card in the client chat.\n' +
        '- Client Submit executes via the shared Type 1 path; Decline returns it to the agent.\n' +
        '- Cancel/chat-end/client-left clean up; the relay is idempotent.',
      children: [
        S('Approve an owner-only action in my own chat', {
          priority: 'High', points: 5, labels: ['customer-app'],
          desc: story('account owner', 'to review and submit owner-only actions (like granting account access) myself in chat', 'authorizations that require my consent are actually made by me'),
          ac:
            'Scenario: Owner approves in chat\n' +
            '  Given an agent sends me an approval card\n' +
            '  When I review the editable fields and Submit\n' +
            '  Then the action executes and I receive the same confirmation as any other action\n\n' +
            'Scenario: Decline returns to the agent\n' +
            '  Given I have an approval card\n' +
            '  When I Decline\n' +
            '  Then the agent is notified and the card returns to them',
          children: [
            T('Agent "Send to client" relay + waiting state', { desc: 'Send an approval-form control message to the client chat; show "Waiting for client to submit..." with Cancel; add an idempotency guard before the await.' }),
            T('Client approval card (editable fields, no evidence) + control messages', { desc: 'Render the approval card from the approval-form state; Submit sends a client-approved control message, Decline sends a client-declined one; reuse the shared submit utility so confirmation is identical to agent submit.' }),
          ],
        }),
      ],
    }),

    E('Submission-Type Framework', {
      priority: 'Medium', labels: ['backend'],
      desc:
        'A per-task submissionType (agent default / licensed-agent reserved / client = Type 3) stamped onto ' +
        'every Proposed Action, so the agent UI and execution path know who may submit each action.\n\n' +
        'Value: a clean, extensible model for authorization that new tasks can opt into.',
      ac:
        'Definition of done:\n' +
        '- Every Proposed Action carries its submission type.\n' +
        '- The agent card adapts its button to the type.\n' +
        '- Adding a Type 3 task requires only setting the field.',
      children: [
        S('Stamp and honor each task\'s submission type', {
          points: 3, labels: ['backend', 'agent-app'],
          desc: story('product owner', 'each task to declare who may submit it and the system to honor that', 'authorization rules are explicit and consistent across tasks'),
          ac:
            'Scenario: Submission type drives the UI\n' +
            '  Given a task declares its submission type\n' +
            '  Then the Proposed Action is stamped with it\n' +
            '  And the agent card shows Submit Action (agent) or Send to client (Type 3) accordingly',
        }),
      ],
    }),
  ],
}));

// ===========================================================================
// FEATURE 6 - Knowledge & Predictive Assistance
// ===========================================================================
FEATURES.push(F('Knowledge & Predictive Assistance', {
  component: 'Knowledge & Predict',
  priority: 'High',
  labels: ['backend', 'ai'],
  desc:
    'The knowledge and prediction layer that makes both the client chat and the agent workspace feel ' +
    'anticipatory: a curated knowledge base (62 topics, 247 Q&A pairs) mapped to pages and wizard steps, plus ' +
    'three predictive services - predict-intent (relevant topics for the page/conversation), predict-questions ' +
    '(the client\'s likely next questions), and next-best-response (a suggested agent reply with an autopilot ' +
    'scope hint).\n\n' +
    'Value: reduces effort on both sides of the conversation and surfaces the right knowledge at the right moment.',
  ac:
    'Definition of done:\n' +
    '- KB content is page/step-mapped and powers chat pills and the agent topic row.\n' +
    '- Predict-intent, predict-questions, and next-best-response each return useful, scoped results.',
  children: [

    E('Knowledge Base Content & Mapping', {
      priority: 'High', labels: ['backend', 'content'],
      desc:
        'The curated KB: 62 financial topics with 247 pre-written Q&A pairs covering IRAs, RMDs, rollovers, ' +
        'taxes, fund info, and account types, mapped to the page (and, in flows, the exact step) so suggestions ' +
        'stay tightly relevant. Includes per-page extra-topic mappings and the page-context keys the wizard ' +
        'publishes.\n\n' +
        'Value: authoritative, reusable answers that keep the assistant accurate and on-message.',
      ac:
        'Definition of done:\n' +
        '- Topics and Q&A are mapped to page/step keys.\n' +
        '- The mapping resolves the correct topics for each page and wizard step.',
      children: [
        S('Maintain a page-mapped knowledge base', {
          priority: 'High', points: 5, labels: ['backend', 'content'],
          desc: story('content owner', 'a knowledge base of topics and Q&A mapped to the pages and steps where they apply', 'the assistant always offers relevant, accurate answers'),
          ac:
            'Scenario: Topics resolve by page/step\n' +
            '  Given a client is on a specific page or wizard step\n' +
            '  When topic suggestions are requested\n' +
            '  Then the KB returns topics mapped to that exact context',
        }),
      ],
    }),

    E('Predict Intent (Topic Suggestions)', {
      priority: 'Medium', labels: ['backend', 'ai'],
      desc:
        'Given the client\'s current page (or published sub-page/step) and recent messages, predict-intent ' +
        'suggests which KB topics are most relevant. Powers the client chat\'s topic pills and the agent AI ' +
        'support panel\'s topic row.\n\n' +
        'Value: one engine drives relevant suggestions on both sides of the conversation.',
      ac:
        'Definition of done:\n' +
        '- Returns ranked topics for a given page/context and recent messages.\n' +
        '- Powers both client pills and the agent topic row.',
      children: [
        S('Suggest relevant topics from page and conversation', {
          points: 3, labels: ['backend', 'ai'],
          desc: story('investor', 'topic suggestions based on where I am and what we have discussed', 'the suggestions feel relevant rather than generic'),
          ac:
            'Scenario: Context-ranked topics\n' +
            '  Given my page and recent messages\n' +
            '  When predict-intent runs\n' +
            '  Then it returns the most relevant KB topics for my situation',
        }),
      ],
    }),

    E('Predict Questions', {
      priority: 'Medium', labels: ['backend', 'ai'],
      desc:
        'Given the current conversation, predict-questions suggests the three most likely next questions the ' +
        'client might ask; each can be injected into the agent composer with one click.\n\n' +
        'Value: helps agents pre-empt needs and keeps clients moving with one-tap follow-ups.',
      ac:
        'Definition of done:\n' +
        '- Returns three plausible next questions for the conversation.\n' +
        '- Each is insertable into the agent composer in one click.',
      children: [
        S('Anticipate the client\'s next questions', {
          points: 3, labels: ['backend', 'ai'],
          desc: story('agent', 'the three most likely next questions surfaced so I can address them proactively', 'I stay a step ahead and reduce back-and-forth'),
          ac:
            'Scenario: Next-question suggestions\n' +
            '  Given an in-progress conversation\n' +
            '  When predict-questions runs\n' +
            '  Then it returns three likely next questions I can insert with one click',
        }),
      ],
    }),

    E('Next-Best Response', {
      priority: 'High', labels: ['backend', 'ai'],
      desc:
        'next-best-response suggests a concise one-to-two sentence reply for the agent\'s next turn plus an ' +
        'autopilot scope recommendation, shown as a draft the agent can adopt, edit, or ignore.\n\n' +
        'Value: the single biggest lever on agent typing time and consistency.',
      ac:
        'Definition of done:\n' +
        '- Returns a concise suggested reply and an autopilot scope hint per turn.\n' +
        '- The suggestion is non-binding and editable.',
      children: [
        S('Draft the agent\'s next reply', {
          priority: 'High', points: 5, labels: ['backend', 'ai'],
          desc: story('agent', 'a suggested next reply and a recommended autopilot scope each turn', 'I can respond quickly and know when to hand off to autopilot'),
          ac:
            'Scenario: Reply + scope hint\n' +
            '  Given a client message awaits my response\n' +
            '  When next-best-response runs\n' +
            '  Then it returns a concise suggested reply and an autopilot scope recommendation',
        }),
      ],
    }),
  ],
}));

// ===========================================================================
// FEATURE 7 - Callback Scheduling Infrastructure
// ===========================================================================
FEATURES.push(F('Callback Scheduling', {
  component: 'Callbacks',
  priority: 'Medium',
  labels: ['backend', 'connect'],
  desc:
    'For clients who prefer a phone call to a chat, the platform schedules a validated callback: the ' +
    'schedule-callback Lambda creates an Amazon EventBridge Scheduler event for the requested time, the ' +
    'execute-callback Lambda fires at that time (in production it would trigger an outbound call), and the ' +
    'cancel/reschedule task path lets clients change it. The agent app shows a callback confirmation with the ' +
    'scheduled time and a reference.\n\n' +
    'Value: meets clients on their preferred channel and guarantees the call is scheduled at the right instant.',
  ac:
    'Definition of done:\n' +
    '- A requested callback creates a scheduled event at the correct (validated) time.\n' +
    '- The event fires at the scheduled time and is observable.\n' +
    '- Clients can cancel or reschedule via the standard task flow.',
  children: [

    E('Schedule a Callback', {
      priority: 'Medium', labels: ['backend', 'connect'],
      desc:
        'Create a scheduled callback from the client\'s requested time, with agent availability reflected and ' +
        'the time validated server-side. Surfaced via the in-chat callback scheduler UI and confirmed in the ' +
        'agent app.\n\n' +
        'Value: dependable scheduling with no timezone or availability surprises.',
      ac:
        'Definition of done:\n' +
        '- A schedule event is created for the validated instant.\n' +
        '- The client and agent both see a confirmation with the time and reference.',
      children: [
        S('Schedule a callback for a chosen time', {
          points: 5, labels: ['backend', 'connect'],
          desc: story('investor', 'to schedule a callback at a time that works for me', 'I can get help by phone without waiting on hold'),
          ac:
            'Scenario: Callback is scheduled\n' +
            '  Given I request a callback at a specific time\n' +
            '  When the request is accepted\n' +
            '  Then a scheduled event is created for the validated time and I receive a confirmation with a reference',
        }),
      ],
    }),

    E('Execute & Manage Callback Lifecycle', {
      priority: 'Medium', labels: ['backend'],
      desc:
        'The execution and lifecycle side: the execute-callback Lambda fires at the scheduled time, and ' +
        'cancel/reschedule (handled by the standard autopilot task) updates or removes the scheduled event.\n\n' +
        'Value: callbacks actually happen, and clients can adjust them without friction.',
      ac:
        'Definition of done:\n' +
        '- The scheduled handler runs at the target time.\n' +
        '- Cancel removes and reschedule moves the event; both confirm to the client.',
      children: [
        S('Have my callback fire at the scheduled time', {
          points: 3, labels: ['backend'],
          desc: story('investor', 'my scheduled callback to actually trigger at the right time', 'the call I arranged happens as promised'),
          ac:
            'Scenario: Scheduled callback fires\n' +
            '  Given a callback is scheduled\n' +
            '  When the scheduled time arrives\n' +
            '  Then the execute-callback handler runs (and in production would place the outbound call)',
        }),
        S('Cancel or reschedule a callback', {
          points: 3, labels: ['backend', 'ai'],
          desc: story('investor', 'to cancel or move a callback I arranged', 'plans change and I am not stuck with the original time'),
          ac:
            'Scenario: Cancel and reschedule\n' +
            '  Given I have a callback scheduled\n' +
            '  When I cancel it, the event is removed\n' +
            '  And when I reschedule it, the event moves to the new validated time',
        }),
      ],
    }),
  ],
}));

// ===========================================================================
// FEATURE 8 - Fund Catalog & Market Data
// ===========================================================================
FEATURES.push(F('Fund Catalog & Market Data', {
  component: 'Funds & Market Data',
  priority: 'High',
  labels: ['backend', 'customer-app', 'funds'],
  desc:
    'A single source of truth for fund reference data and a separate live-price service. The fund catalog ' +
    '(the full lineup) is seeded into a DynamoDB table from one canonical definition and served via an API ' +
    'with caching; every content page, picker, and all three AI systems read the same catalog, so they can ' +
    'never disagree about what funds exist or what they cost. Live intraday prices and returns come from a ' +
    'dedicated market-data service whose symbol map is derived from the catalog (so it cannot drift).\n\n' +
    'Value: consistency and trust - one update propagates everywhere, and pages never contradict the assistant.',
  ac:
    'Definition of done:\n' +
    '- The catalog is the runtime source of truth, served with caching and an offline fallback.\n' +
    '- Content pages, pickers, and all AI systems read the same catalog.\n' +
    '- Live prices come from market data whose symbols derive from the catalog.',
  children: [

    E('Fund Catalog Source of Truth', {
      priority: 'High', labels: ['backend', 'funds', 'dynamodb'],
      desc:
        'One canonical fund definition seeds a DynamoDB catalog table; an API serves it (module-cached) and a ' +
        'client hook consumes it with a local cache and a bundled offline fallback. A per-environment seed/refresh ' +
        'endpoint repopulates it.\n\n' +
        'Value: a single edit point that fans out to every consumer, eliminating drift.',
      ac:
        'Definition of done:\n' +
        '- The catalog table is seeded from the canonical definition.\n' +
        '- The serving API is cached; the client hook caches and falls back offline.\n' +
        '- A seed/refresh endpoint repopulates a fresh environment.',
      children: [
        S('Serve the fund catalog from a single source', {
          priority: 'High', points: 5, labels: ['backend', 'funds'],
          desc: story('platform owner', 'one fund catalog that seeds the database and feeds every page and AI system', 'fund facts can never disagree between the portal and the assistant'),
          ac:
            'Scenario: One catalog, many consumers\n' +
            '  Given the catalog is seeded from the canonical definition\n' +
            '  When a page or AI system needs fund data\n' +
            '  Then it reads the same catalog (cached) with a bundled offline fallback',
          children: [
            T('Seed the funds catalog table from the canonical fund definition', { desc: 'Bridge the canonical fund list into the table via a seed/reset endpoint; one item per fund keyed by ticker.' }),
            T('Serve via cached API + client hook with offline fallback', { desc: 'get-funds module-cached; useFunds() with local TTL cache and bundled fallback.' }),
          ],
        }),
      ],
    }),

    E('Fund Content Pages', {
      priority: 'Medium', labels: ['customer-app', 'funds', 'content'],
      desc:
        'The investor-facing pages that present fund data - fees/expense ratios, fund performance, the ' +
        'prospectus library, the research screener and per-fund profile, and tax-efficient-investing - all ' +
        'reading from the shared catalog with the content-above-long-lists ordering rule applied.\n\n' +
        'Value: trustworthy, consistent fund information presented where investors make decisions.',
      ac:
        'Definition of done:\n' +
        '- Fees, performance, prospectus, research, and profile pages read the catalog.\n' +
        '- Long fund tables follow the content-first ordering and scroll rules.',
      children: [
        S('See consistent fund data across content pages', {
          points: 3, labels: ['customer-app', 'funds'],
          desc: story('investor', 'fees, performance, and prospectus pages to show the same fund facts as everywhere else', 'I can rely on the numbers no matter where I read them'),
          ac:
            'Scenario: Pages reflect the catalog\n' +
            '  Given the catalog defines the lineup and its attributes\n' +
            '  When I view the fees, performance, or prospectus pages\n' +
            '  Then they show data consistent with the catalog and the assistant',
        }),
      ],
    }),

    E('AI Fund Access', {
      priority: 'Medium', labels: ['backend', 'ai', 'funds'],
      desc:
        'A fund-lookup capability that exposes the catalog to all three AI systems (customer bot, agent ' +
        'suggested reply, and autopilot experts), plus a fund pick-list injected into task-expert prompts so ' +
        'they reference only real funds.\n\n' +
        'Value: the AI never invents or misquotes a fund - it reads the same catalog the pages do.',
      ac:
        'Definition of done:\n' +
        '- A fund-lookup tool is available to bot, NBR, and experts.\n' +
        '- Expert prompts inject a current fund pick-list.',
      children: [
        S('Let the AI look up real fund data', {
          points: 3, labels: ['backend', 'ai', 'funds'],
          desc: story('investor', 'the assistant to answer fund questions from real catalog data', 'I get accurate fund facts, not hallucinated ones'),
          ac:
            'Scenario: AI reads the catalog\n' +
            '  Given I ask the assistant about a fund\n' +
            '  When it answers\n' +
            '  Then it uses the fund-lookup tool and references only funds in the catalog',
        }),
      ],
    }),

    E('Live Market Data', {
      priority: 'Medium', labels: ['backend', 'funds'],
      desc:
        'A market-data service that provides live intraday prices and returns, with its ticker-to-symbol map ' +
        'derived from the catalog so the priced set always matches the lineup and cannot drift.\n\n' +
        'Value: current, accurate prices wherever fund data appears, with zero manual sync.',
      ac:
        'Definition of done:\n' +
        '- Live prices/returns are available for every fund in the lineup.\n' +
        '- The symbol map derives from the catalog (no hand-maintained list).',
      children: [
        S('Show live fund prices and returns', {
          points: 3, labels: ['backend', 'funds'],
          desc: story('investor', 'fund pages to show current prices and returns', 'I make decisions on up-to-date numbers'),
          ac:
            'Scenario: Live pricing matches the lineup\n' +
            '  Given the catalog defines the lineup\n' +
            '  When market data is fetched\n' +
            '  Then every listed fund has a live price/return and the symbol set matches the catalog',
        }),
      ],
    }),
  ],
}));

// ===========================================================================
// FEATURE 9 - Platform, Infrastructure & Delivery
// ===========================================================================
FEATURES.push(F('Platform, Infrastructure & Delivery', {
  component: 'Platform & Infra',
  priority: 'High',
  labels: ['infra', 'cdk', 'backend'],
  desc:
    'The serverless foundation and the safe path to production. Everything is defined as AWS CDK ' +
    '(API Gateway, Lambdas, DynamoDB, EventBridge, IAM, contact center, budgets, CI/CD roles), with an ' +
    'isolated dev environment that mirrors prod and a "main always equals production" delivery model: merging ' +
    'to main triggers guarded GitHub Actions deploys that refuse to delete or replace a live resource. It also ' +
    'covers the data layer and demo-data tooling, transcript storage and review, and observability and cost ' +
    'safety.\n\n' +
    'Value: reliable, low-cost, reproducible infrastructure and a delivery process that cannot silently break ' +
    'prod.',
  ac:
    'Definition of done:\n' +
    '- All infrastructure is code; dev and prod are built from the same definitions.\n' +
    '- Merging to main deploys prod through a destroy-guarded pipeline.\n' +
    '- Data, transcripts, observability, and cost controls are in place.',
  children: [

    E('Infrastructure as Code (CDK)', {
      priority: 'High', labels: ['infra', 'cdk'],
      desc:
        'The full stack expressed in CDK: an HTTP API Gateway, all Lambdas with their environment wiring, ' +
        'DynamoDB tables, the EventBridge scheduler role, the contact-center stack, a budget stack, and the ' +
        'CI/CD role stack. Secrets (e.g. the model API key) resolve from SSM at deploy time.\n\n' +
        'Value: reproducible, reviewable infrastructure with no click-ops.',
      ac:
        'Definition of done:\n' +
        '- API, Lambdas, tables, scheduler, budget, and CI/CD roles are all defined in CDK.\n' +
        '- Secrets resolve from SSM at deploy time (no shell variables).',
      children: [
        S('Define all infrastructure as code', {
          priority: 'High', points: 5, labels: ['infra', 'cdk'],
          desc: story('platform engineer', 'the entire platform defined in CDK', 'I can review, reproduce, and safely change infrastructure'),
          ac:
            'Scenario: One source for infrastructure\n' +
            '  Given the CDK app\n' +
            '  When I synthesize/deploy\n' +
            '  Then it provisions the API, Lambdas, tables, scheduler, budget, and CI/CD roles with secrets from SSM',
        }),
      ],
    }),

    E('Dev/Prod Environments', {
      priority: 'High', labels: ['infra', 'cdk'],
      desc:
        'A stage-parameterized setup: prod is byte-identical to the code, and STAGE=dev produces an isolated ' +
        'parallel environment (suffix-named tables and stack, separate API) that costs ~$0 idle. Local dev ' +
        'points at the dev API so engineers can mutate, seed, and break freely without touching prod.\n\n' +
        'Value: safe iteration - test against real infrastructure without risk to production.',
      ac:
        'Definition of done:\n' +
        '- The same CDK builds an isolated dev environment from STAGE=dev.\n' +
        '- Local development targets dev data by default.',
      children: [
        S('Test against an isolated dev environment', {
          priority: 'High', points: 5, labels: ['infra', 'cdk'],
          desc: story('engineer', 'an isolated dev environment that mirrors prod', 'I can validate changes against real infrastructure before they reach customers'),
          ac:
            'Scenario: Dev mirrors prod, isolated\n' +
            '  Given I deploy with STAGE=dev\n' +
            '  Then an isolated parallel environment is created\n' +
            '  And local development targets the dev API and data',
        }),
      ],
    }),

    E('CI/CD & Guarded Deploys', {
      priority: 'Highest', labels: ['infra', 'cdk'],
      desc:
        'Continuous delivery with a hard safety guard: merging to main triggers GitHub Actions that deploy the ' +
        'backend (CDK via OIDC) and both frontends (to GitHub Pages), all routed through a deploy guard that ' +
        'typechecks, diffs, and refuses to remove or replace a live resource (override only with an explicit ' +
        'flag). PR checks build both apps and bundle-check the Lambdas; the build SHA is stamped into each app.\n\n' +
        'Value: fast, hands-off releases that cannot silently delete production infrastructure.',
      ac:
        'Definition of done:\n' +
        '- Merge to main auto-deploys backend and frontends.\n' +
        '- The deploy guard aborts on any destructive diff unless explicitly overridden.\n' +
        '- PR checks gate builds and bundles; the deployed SHA is observable.',
      children: [
        S('Ship to prod automatically on merge', {
          priority: 'High', points: 5, labels: ['infra', 'cdk'],
          desc: story('engineer', 'merging to main to deploy prod automatically', 'releases are consistent and nobody deploys by hand'),
          ac:
            'Scenario: Auto-deploy on merge\n' +
            '  Given a PR is merged to main\n' +
            '  Then GitHub Actions deploy the backend (CDK via OIDC) and both frontends',
        }),
        S('Block deploys that would delete live resources', {
          priority: 'High', points: 5, labels: ['infra', 'cdk'],
          desc: story('platform owner', 'any deploy that would remove or replace a live resource to be blocked by default', 'a stale or wrong branch can never silently destroy prod'),
          ac:
            'Scenario: Destroy guard aborts\n' +
            '  Given a deploy diff would remove or replace a live resource\n' +
            '  When the guarded deploy runs\n' +
            '  Then it aborts with a clear list unless an explicit override flag is set',
        }),
        S('Gate every PR with builds and bundle checks', {
          points: 3, labels: ['infra'],
          desc: story('engineer', 'every PR to build both apps, typecheck CDK, and bundle-check the Lambdas', 'broken code cannot merge'),
          ac:
            'Scenario: PR gate\n' +
            '  Given an open PR\n' +
            '  Then CI builds both frontends, typechecks CDK, and bundle-checks the Lambdas before it can merge',
        }),
      ],
    }),

    E('Data Layer & Demo Data', {
      priority: 'High', labels: ['backend', 'dynamodb'],
      desc:
        'The DynamoDB data model (Clients, Sessions, Transcripts, Transactions, Funds) and the read/write ' +
        'access layer (client-data), plus demo-data tooling: reset endpoints that restore all client fields to ' +
        'factory defaults (and seed transactions and funds) per environment, idempotently.\n\n' +
        'Value: a clean, well-modeled data layer and the ability to reset the demo to a known-good state.',
      ac:
        'Definition of done:\n' +
        '- All five tables are modeled with correct keys and indexes.\n' +
        '- Reset endpoints restore defaults and seed data idempotently per environment.',
      children: [
        S('Read and write client data through one access layer', {
          points: 3, labels: ['backend', 'dynamodb'],
          desc: story('platform engineer', 'a single access layer for client profile reads and writes', 'data access is consistent and testable'),
          ac:
            'Scenario: Consistent client-data access\n' +
            '  Given a client profile operation\n' +
            '  When it runs through client-data\n' +
            '  Then it reads/writes the Clients table consistently',
        }),
        S('Reset demo data to a known-good state', {
          points: 3, labels: ['backend', 'dynamodb'],
          desc: story('platform owner', 'a one-call reset that restores all demo client data, transactions, and funds', 'the demo can always be returned to a clean, predictable state'),
          ac:
            'Scenario: Idempotent reset\n' +
            '  Given any environment state\n' +
            '  When I call the reset endpoint\n' +
            '  Then all client fields return to defaults and transactions/funds are reseeded idempotently',
        }),
      ],
    }),

    E('Transcript Storage & Review', {
      priority: 'Medium', labels: ['backend', 'dynamodb'],
      desc:
        'Durable transcript handling: save-transcript writes the full message history (with the AI recap ' +
        'summary, wrap-up code, ACW summary, and the agent who handled it) to a retained table and records the ' +
        'client\'s most recent agent chat as continuation memory; get-transcripts reads them; pin-transcript ' +
        'flags pinned chats; and a standalone transcript review UI supports post-hoc quality analysis.\n\n' +
        'Value: a permanent record for continuity, history, compliance, and quality review.',
      ac:
        'Definition of done:\n' +
        '- Transcripts persist with recap, wrap-up, ACW, and agent attribution.\n' +
        '- Continuation memory powers Continue this chat; pins persist.\n' +
        '- A review UI can browse and deep-link transcripts.',
      children: [
        S('Persist every agent chat as a reviewable transcript', {
          points: 5, labels: ['backend', 'dynamodb'],
          desc: story('quality lead', 'every live-agent chat saved with its recap, wrap-up, and the agent who handled it', 'we have a durable record for history, continuity, and quality review'),
          ac:
            'Scenario: Transcript saved on end\n' +
            '  Given a live-agent chat ends\n' +
            '  When save-transcript runs\n' +
            '  Then the full transcript persists with recap summary, wrap-up code, ACW summary, and agent attribution\n' +
            '  And the client\'s most recent agent chat is recorded as continuation memory',
        }),
        S('Review transcripts in a dedicated tool', {
          points: 3, labels: ['backend'],
          desc: story('quality lead', 'a standalone UI to browse and deep-link transcripts', 'I can perform post-hoc conversation review and quality analysis'),
          ac:
            'Scenario: Deep-linkable review\n' +
            '  Given a saved transcript\n' +
            '  When I open the review UI with its id\n' +
            '  Then it loads that conversation for review',
        }),
      ],
    }),

    E('Observability & Cost Safety', {
      priority: 'Medium', labels: ['infra', 'backend'],
      desc:
        'Operational guardrails: CloudWatch logging across Lambdas (optionally enriched by an AI observability ' +
        'integration), a monthly budget alarm that emails the owner at 80% actual / 100% forecast, and a ' +
        'client-log path that pages the owner on a customer-site access-code sign-in.\n\n' +
        'Value: the team sees problems and spend early, and gets alerted to noteworthy events.',
      ac:
        'Definition of done:\n' +
        '- Lambdas log to CloudWatch; optional AI tracing can be enabled.\n' +
        '- A budget alarm notifies at the configured thresholds.\n' +
        '- Access-code sign-ins trigger an alert.',
      children: [
        S('Get alerted on spend and key events', {
          points: 3, labels: ['infra'],
          desc: story('platform owner', 'budget alerts and an alert on customer-site sign-in', 'I catch cost overruns and noteworthy access early'),
          ac:
            'Scenario: Budget threshold alert\n' +
            '  Given monthly spend crosses the configured threshold\n' +
            '  Then the owner is emailed\n\n' +
            'Scenario: Sign-in alert\n' +
            '  Given someone enters the customer-site access code on a fresh browser\n' +
            '  Then an urgent alert is sent to the owner',
        }),
        S('Diagnose production behavior from logs', {
          points: 2, labels: ['infra', 'backend'],
          desc: story('engineer', 'each Lambda to log enough context to CloudWatch', 'I can diagnose production issues without redeploying'),
          ac:
            'Scenario: Traceable turns\n' +
            '  Given a production chat turn\n' +
            '  When I inspect CloudWatch\n' +
            '  Then I can trace the scope, model, and outcome of the turn',
        }),
      ],
    }),

    E('Contact-Center Platform (Amazon Connect)', {
      priority: 'High', labels: ['infra', 'connect'],
      desc:
        'The Amazon Connect foundation shared by client chat and the agent CCP: the Connect instance/stack and ' +
        'agent provisioning (logins and routing profiles) that make live chat handoff possible.\n\n' +
        'Value: the real contact-center backbone behind every live conversation.',
      ac:
        'Definition of done:\n' +
        '- The Connect instance and routing are provisioned.\n' +
        '- New agents can be added with the correct routing profile.',
      children: [
        S('Provision Connect and agent logins', {
          points: 3, labels: ['infra', 'connect'],
          desc: story('platform engineer', 'the Connect instance and agent logins provisioned', 'live chat can be routed to real agents'),
          ac:
            'Scenario: Agent can take chats\n' +
            '  Given the Connect instance is provisioned\n' +
            '  When an agent login with the correct routing profile is created\n' +
            '  Then that agent can receive and handle live chats',
        }),
      ],
    }),
  ],
}));

// ===INSERT-MORE-FEATURES-ABOVE-THIS-LINE===

// ===========================================================================
// TECHNICAL CONTENT (authored separately, keyed by ticket summary).
//   TECH:            design notes appended to a ticket's Description.
//   EXTRA_SUBTASKS:  concrete implementation sub-tasks injected under a Story.
// Brand-neutral, but concrete: names the modules/contracts/algorithms/gotchas a
// developer needs. The reference architecture is summarized in README.md.
// ===========================================================================
const TECH = {
  // ---------------- FEATURE 1: Client Self-Service Portal ----------------
  'Client Self-Service Portal':
    'This is the customer SPA (one of two React apps). Stack: React 18 + Vite + TypeScript, Zustand for\n' +
    'state, React Router v6 (BrowserRouter, basename = import.meta.env.BASE_URL). Built as a static bundle\n' +
    'deployed to the web root (GitHub Pages or S3+CloudFront).\n' +
    'State: clientStore (Zustand) loads the whole client profile once via fetchAll() and exposes selectors;\n' +
    'chatStore owns chat UI state. Components read stores and call the API; they hold no business logic.\n' +
    'Data path: ALL reads/writes go browser -> API Gateway (HTTP API) -> client-data Lambda -> DynamoDB\n' +
    'Clients table (PK clientId). Never call DynamoDB from the browser.\n' +
    'Shell: an AccessGate wraps the router; a ScrollToTop listener resets scroll on route change; theme\n' +
    'tokens live in one module; the build SHA is stamped on window for prod verification.\n' +
    'Demo data: seed/reset per environment via GET /reset-client-data?key=...',
  'Portal Shell, Navigation & Access Gating':
    'Components: AccessGate, a top-nav component, a ScrollToTop route listener, a theme-tokens module.\n' +
    'AccessGate compares the entered code to a build-time env var (VITE_DEMO_CODE); on success it writes a\n' +
    'localStorage flag and renders children; the flag short-circuits the gate on return visits.\n' +
    'Build stamp: set window.__BUILD__ and console.log("build " + sha); inject the commit SHA via a Vite\n' +
    'define at build time (CI passes it from the workflow context).',
  'Gate portal access behind an access code':
    'Implement AccessGate as a wrapper around <Routes>. Read VITE_DEMO_CODE at build time. State: an\n' +
    '"unlocked" boolean seeded from localStorage (e.g. key portal_access). On submit compare; on match set\n' +
    'localStorage + state; on miss show an inline error and keep the gate. Store only an opaque flag, never\n' +
    'the code itself.\n' +
    'Signin beacon: only when the flag was NOT already set (first unlock on this browser) AND only in PROD\n' +
    '(guard on import.meta.env), fire-and-forget POST /client-log {context:"access-code-entered"} using\n' +
    'fetch keepalive so it never blocks render.',
  'Provide global top navigation across the portal':
    'One top-nav component rendered above <Routes>; use NavLink for active styling. Drive links from a small\n' +
    'declarative config array (Home, Portfolio, Research, Account, Resources/Help). Collapse to a menu under\n' +
    'a mobile breakpoint.',
  'Reset scroll position and load fonts/branding on navigation':
    'ScrollToTop: a component using useLocation + useEffect to window.scrollTo(0,0) on pathname change. Load\n' +
    'web fonts via a <link> injected in an effect (or in index.html). Keep theme tokens centralized.',
  'Stamp the deployed build SHA into the app':
    'Inject the git SHA via a Vite define (e.g. __BUILD_SHA__) at build time; at startup set window.__BUILD__\n' +
    'and console.log it. CI provides the SHA from the workflow context (e.g. github.sha).',
  'Account Overview & Detail':
    'Pages: Account hub (/account) and Account detail (/account/detail/:accountId). Data from clientStore\n' +
    '(accounts[], holdings[], totalBalance). Reuse a shared AccountCard + HoldingsTable. Detail filters\n' +
    'holdings + recent transactions by accountId and shows type-specific action links.\n' +
    'Shapes: account {type,balance,id,change}; holding {name,ticker,accountId,shares,price,change,value,drip?}.',
  'View all accounts on an account hub':
    'Map clientStore.accounts to AccountCards; verify the displayed total equals the sum of balances;\n' +
    'right-align currency per the table rules; link each card to /account/detail/:id.',
  "Drill into a single account's detail":
    'Read :accountId from route params; filter holdings by accountId; show recent activity via\n' +
    'useRecentTransactions(accountId); render type-specific links (IRA/SEP -> beneficiaries, RMD; etc.).',
  'Portfolio Dashboard':
    'Page /portfolio. Aggregate totalBalance + holdings across accounts from clientStore; a recent-\n' +
    'transactions snapshot (top N via useRecentTransactions) links to /transactions; an "Open an account"\n' +
    'button in the header navigates to /open-account. The chat FAB is global (rendered outside <Routes>).',
  'See an aggregate portfolio with holdings and recent activity':
    'Aggregate holdings across accounts, sort by value; reuse HoldingsTable. Snapshot = top 5 recent\n' +
    'transactions with StatusCell. Right-align numeric/currency columns.',
  'Start opening an account from the portfolio header':
    'Header button -> navigate("/open-account"). Keep the global chat FAB mounted across the transition.',
  'Fund Research & Discovery':
    'Pages: /research (screener), /research/fund/:ticker (profile), /research/fund/:ticker/buy. All fund\n' +
    'facts via the useFunds() hook (catalog); live price/return via the market-data API. Screener filters in\n' +
    'component state over the funds array; profile shows catalog attributes + live quote; buy routes into the\n' +
    'purchase flow scoped to the ticker.',
  'Browse and filter the fund lineup':
    'useFunds() for the list; filter/sort in component state (asset class, risk level, expense ratio). ~36\n' +
    'rows so no virtualization needed. Right-align numeric columns; link rows to the profile.',
  "View a single fund's profile":
    'Read :ticker; find it in useFunds(); fetch the live quote from market-data; render sectorAllocation and\n' +
    'annualReturns; primary CTA -> /research/fund/:ticker/buy.',
  'Begin a purchase from a fund profile':
    'Buy page reads :ticker and prefills the fund; collects account/amount/funding; in the portal this is a\n' +
    'mock confirmation (the real brokerage path runs through an agent via execute-task).',
  'Self-Service Account Management Pages':
    'Pages: /account/beneficiaries, /account/auto-invest, /account/rmd, /account/tax-documents. Reads/writes\n' +
    'go through client-data Lambda actions; writes MUST mirror the execute-task real-write logic so the\n' +
    'portal and the autopilot never disagree. Beneficiary editor filters to IRA/SEP only and enforces 100%\n' +
    'per account; auto-invest supports create/edit/pause/resume; RMD shows eligibility + delivery/frequency/\n' +
    'withholding; tax docs list by year + form.',
  'Manage beneficiary designations':
    'Editor keyed by accountId; list only IRA/SEP accounts (never taxable). On save validate\n' +
    'sum(percentage) === 100 (block otherwise). Persist via a client-data update that atomically replaces\n' +
    "that account's beneficiaries while preserving the other accounts (identical semantics to execute-task\n" +
    'update-beneficiaries). Beneficiary shape {accountId,name,relationship,percentage,type}.',
  'Manage automatic investment schedules':
    'List autoInvest[] {id,accountId,accountType,fund,ticker,amount,frequency,dayOfMonth,nextDate,active}.\n' +
    'Actions create/update/pause-resume via client-data; recompute nextDate on change; reflect active state\n' +
    'in the UI.',
  'View and configure RMD settings':
    'rmd object {eligible,age,annualRmd,takenThisYear,remainingThisYear,nextDeadline,deliveryMethod,\n' +
    'frequency,taxWithholding}. If !eligible, render an explanatory state. Writable: deliveryMethod,\n' +
    'frequency, taxWithholding (0-99%).',
  'Retrieve tax documents':
    'Derive available forms by year (1099-R/1099-B/1099-DIV/5498) from account types + activity; request/\n' +
    'download triggers a mock document action returning a reference number.',
  'Open-an-Account Wizard':
    'Single route /open-account; 8 steps with step + completion encoded in the URL (?step=N, ?done=1) via\n' +
    'useSearchParams so browser Back/Forward and refresh traverse the wizard. Form state stays in component\n' +
    'state (a query-param change does not unmount the page). Branch by accountType at the setup step. Publish\n' +
    'a fine-grained page-context key per step + branch via a pageContextStore so chat pills track the exact\n' +
    'screen; in-flow topics are ungated and do not link back to /open-account.',
  'Open an account through a guided multi-step wizard':
    'Steps: type -> personal -> contact -> FINRA/SEC disclosures -> setup(branch) -> funding + initial\n' +
    'investment -> free DCA opt-in -> review/agreements/e-signature -> confirmation. goTo(step)/handleSubmit\n' +
    'push merged search params. Branch components: IRA (beneficiaries with 100% allocation check), SEP\n' +
    '(business/EIN), Taxable (joint owner + TOD). Validate per step; block IRA progress until beneficiaries\n' +
    'total 100%. On submit, mock-create the account and render a confirmation timeline (?done=1).',
  'Education: Resources, Library & Help Center':
    'Mostly static content components: ~10 resource pages, a library (index + ArticlePage by category guide/\n' +
    'opinion + slug, plus a podcast page), and ~27 help pages. Pages that show fund data use useFunds(). The\n' +
    'retirement calculator is interactive. Help/resource routes are the bot link targets (SELF_SERVICE_PAGES)\n' +
    '- keep slugs stable and aligned with the KB link table.',
  'Read education resource pages':
    'Static content components with a consistent layout; cross-link to related actions/pages; ensure routes\n' +
    'match the bot link table so in-chat links resolve.',
  'Project retirement outcomes with a calculator':
    'Controlled inputs. The NumberInput must NOT min-clamp on each keystroke (support select-all + retype);\n' +
    'digits-only with a maxDigits cap; ages unclamped by design. Compute a future-value-with-contributions\n' +
    'projection and re-render on input change.',
  'Browse the library and listen to the investor podcast':
    'Library index + ArticlePage (route params: category in {guide,opinion}, slug); a podcast page. Source\n' +
    'content from a data module or markdown.',
  'Find answers in the help center':
    '~27 focused help-topic pages, each a stable route the bot can deep-link. Keep slugs aligned with the KB\n' +
    'link table so the bot never links to a 404.',
  'Transaction History & Order Status':
    'Dedicated Transactions DynamoDB table, one item per transaction: PK clientId, SK "<ISOdate>#<seq>", GSI\n' +
    'account-index on acctKey="<clientId>#<accountId>"; newest-first = Query with ScanIndexForward:false.\n' +
    'Status engine: assignStatus(date vs a frozen DEMO_TODAY) -> Scheduled/Pending/Settling/Completed/\n' +
    'Canceled. Deterministic seed generator (idempotent, decades deep across personas) via the reset Lambda.\n' +
    'API: client-data actions get-recent-transactions / get-transactions-page (base64 cursor) /\n' +
    'append-transaction. Frontend: useRecentTransactions hook + StatusCell popover + the /transactions page.\n' +
    'Live trades (execute-task) PutItem a Pending row dated today.',
  'Browse full transaction history with filter/search/sort/paginate':
    'Page calls get-transactions-page with a base64 cursor; render a table with right-aligned amounts and\n' +
    'StatusCell; provide account filter, text search, column sort, and next/prev paging. Handle loading/\n' +
    'empty/error states.',
  "Understand each transaction's status":
    'StatusCell: a dotted-underline label that opens a popover from a display-copy map (per status: meaning +\n' +
    'what happens next). Status value comes from assignStatus; expose it through the read APIs and the\n' +
    'get_transactions AI tool too.',
  'Seed decades-deep transaction history for demo personas':
    'A deterministic generator seeded by clientId (identical on reruns); idempotent PutItem; covers each\n' +
    'account from inception; assigns status via the frozen DEMO_TODAY so the mix of statuses is stable.',
  // ---------------- FEATURE 2: Conversational AI Assistant (Client Chat) ----------------
  'Conversational AI Assistant (Client Chat)':
`Lives in the customer SPA. Transport: Amazon Connect ChatJS SDK. A useChatSession hook owns the Connect
session: start via POST /start-chat (creates the Connect contact, returns participant credentials), then
ChatJS connect/sendMessage/onMessage/onTyping. chatStore (Zustand) holds view state and is persisted to
sessionStorage (per tab) for resume.
Components: ChatWidget (global FAB, mounted OUTSIDE <Routes>), ChatPanel (header, minimize/close, view
switch chat/history/transcript), ChatBody (messages + typing + cards), ChatMessage, ChatInput,
TopicButtons/QuestionButtons, ContinueChatCard, ApprovalFormCard, ChatHistoryView, ChatMinimizedBar.
Pre-agent AI replies come from POST /autopilot-turn (full-auto scope). Control messages (agent name,
typing-stop sentinel, approval forms) are intercepted in onMessage and NOT rendered as chat bubbles.
GOTCHA: a customer ChatJS session ends via disconnectParticipant() - there is NO disconnect() (calling it
throws; a swallowing try/catch hid this for weeks). Treat ChatJS onEnded as "chat over" ONLY in
CONNECTED_TO_AGENT / WAITING_FOR_AGENT states - non-escalated contacts fire onEnded seconds after connect
while the bot keeps answering via the fallback path.`,
  'Embedded Chat Widget & Session Lifecycle':
`useChatSession owns start (POST /start-chat -> contactId + token -> ChatJS connect), send, receive
(onMessage), typing (onTyping/notifyTyping), end (disconnectParticipant). chatStore persists
{persist, minimized, unreadCount, chatEnded, messages} to sessionStorage. On load, if a live session
exists, reconnect and backfill missed agent messages via getTranscript, reconciling by message id. Tab
close (no persisted live session) = chat over. Close-confirm dialog offers Minimize (default) / End chat;
skip the dialog for never-engaged or already-ended chats.`,
  'Open a chat from any page':
`ChatWidget renders a FAB globally (outside <Routes> in App). On open, useChatSession.start -> POST
/start-chat {clientId, page} -> ChatJS connect with the returned token. Render the greeting + topic pills.`,
  'Minimize chat without ending it':
`Minimize sets chatStore.minimized=true and renders ChatMinimizedBar; the session stays connected. Increment
unreadCount on inbound messages while minimized; restoring the panel clears it.`,
  'Close chat with an intentional confirmation':
`On close after engagement, show the confirm dialog. End chat -> endChat() -> disconnectParticipant() (NOT
disconnect()); do not swallow errors. Never-engaged or already-ended chats close silently (no dialog).`,
  'Resume a chat after reload or leaving the site':
`Persist session essentials to sessionStorage. On mount, if persisted + live, reconnect ChatJS and backfill
via getTranscript; reconcile the message list by id (dedupe). A real tab close clears sessionStorage, so it
ends the chat.`,
  'Download a transcript when a live chat ends':
`On agent-chat end, render a Download button. Build a .txt (date, agent, duration, timestamped lines) via a
transcriptDownload util and trigger a client-side Blob download.`,
  'Full-Auto Bot Q&A & Self-Service Linking':
`Pre-agent bot = autopilot-turn full-auto scope (FULL_AUTO_PROMPT), on Nova Micro or gpt-4o-mini. The prompt
embeds SELF_SERVICE_PAGES (the route table) so the bot LINKS instead of free-typing, plus the shared
FORBIDDEN_TOPICS block. In-chat links use a markdown-style link token the client renders as an <a> that
calls React Router navigate() (same-tab, in-app). The bot must not claim it can perform account changes;
trade/advice intents are detected and routed (advice -> callback scope).`,
  'Get instant answers to common questions':
`full-auto prompt answers from the KB + general knowledge; keep replies concise; attach a self-service link
when one fits the question.`,
  'Follow clickable in-chat links to portal pages':
`Define a link-token format the bot emits (e.g. [Beneficiaries](/account/beneficiaries)); ChatMessage parses
it and renders a clickable link that calls navigate() (in-app, same tab). Validate the path against the
known route table.`,
  'Be safely routed for trades and financial advice':
`Detect advice/trade intent (ADVICE_RE keyword + LLM). Respond with the scripted FORBIDDEN_TOPICS line and
offer a callback with a licensed rep; never recommend a security or imply the bot can execute a trade.`,
  'Escalation to Live Agent & Intent Summary':
`EscalationPanel offers live chat or callback. start-chat generates intentLabel + intentGreeting via Nova
Micro and attaches them to the Connect contact attributes so the agent app shows context before the first
human word. Pass clientName explicitly to the model to avoid beneficiary/name confusion.`,
  'Escalate to a live agent or a callback':
`EscalationPanel: live -> route the Connect contact to the agent queue; callback -> callback scope /
CallbackScheduler. Reflect the choice in chatStore state.`,
  'Hand the agent a pre-built intent summary and greeting':
`Nova Micro prompt -> {intentLabel, intentGreeting}; store on the contact attributes; the agent IntentLabel
+ AISupport components read them on accept.`,
  'Human-Realistic Live Chat UX':
`Typing: customer notifyTyping on keystrokes -> agent maps onTyping to slot.customerTyping -> TypingDots
(30s expiry). Agent->customer typing via send-agent-message event:'typing' -> customer agentTyping (60s
expiry). Autopilot send (autopilotSend) runs two phases via autopilotDelay: a READING delay (ellipsis
hidden) = 2000ms + 10ms*(clientMsgLen-200), min 2000ms, based on the client's last message; then a TYPING
delay (ellipsis shown) = chars/15 seconds. Cancel sends a typing-stop sentinel to clear it promptly.
Avatars: an assistant mark for bot turns; once a human connects, agent bubbles + ellipsis show the agent's
initials (chatStore.agentName via an initialsFromName util). The agent broadcasts its FULL name on connect
as a control message because Connect DisplayName is only the first name.`,
  'See when the agent is typing':
`Customer ChatInput calls notifyTyping; agent useConnectStreams maps chatSession.onTyping to
slot.customerTyping and ChatColumn renders TypingDots (30s expiry). Reverse direction: customer ChatBody
shows agentTyping (60s expiry).`,
  'Make autopilot replies feel human-paced':
`Implement autopilotDelay with the reading-then-typing phases (formulas above). Keep the ellipsis hidden
during the reading delay; show it during the typing delay; then send via send-agent-message.`,
  "Show the connected agent's identity":
`On agent connect, broadcast the agent's full name as a control message (intercepted client-side, not
rendered); store it as chatStore.agentName; derive initials with an initialsFromName util for bubbles + the
typing ellipsis.`,
  'Continue a Recent Agent Chat':
`Continuation memory = lastAgentChat attribute on the Clients table, written by save-transcript at agent-
chat end {transcriptId,endedAt,summary,agentUsername,agentName}; cleared by reset-all-data (the permanent
transcript log is untouched). ContinueChatCard renders above the topic pills when lastAgentChat is within
7 days. On click: GET /agent-availability?username=... checks whether THAT agent is on queue/Available; the
client chooses wait-for-them vs first-available (auto first-available if unavailable). On agent accept the
prior transcript loads above a "Continued chat" divider (loadContinuationTranscript). NOTE: true per-agent
Connect routing is best-effort + a preferredAgentUsername metadata attribute today (documented follow-up).`,
  'Offer to continue a recent agent conversation':
`Fetch continuation memory; if lastAgentChat is within 7 days render ContinueChatCard (date + one-line
summary); otherwise render nothing (degrade to the prior UI exactly).`,
  'Choose to wait for my prior agent or take the next available':
`On click, GET /agent-availability for the prior agent; present wait vs first-available; set
preferredAgentUsername on the contact; on the agent side, load the prior transcript on accept.`,
  'In-Chat Topic & Question Pills':
`Topic pills: predict-intent over the page key (pageContextStore finer key preferred over pageKeyFromPath)
+ recent messages + KB EXTRA_PAGE_TOPICS. Question pills + pre-written answers: predict-questions for the
chosen topic. Components: TopicButtons, QuestionButtons. Open-account in-flow topics are ungated + step-
aware.`,
  'See page-relevant topic suggestions':
`ChatWidget computes the page key (prefer pageContextStore over pageKeyFromPath), calls predict-intent, and
renders TopicButtons.`,
  'See predicted follow-up questions with answers':
`On topic select, call predict-questions; render QuestionButtons; clicking one shows its pre-written answer
in the thread.`,
  'Chat History & Transcript Access':
`A hamburger in the ChatPanel header switches view (chat/history/transcript). ChatHistoryView: GET
/get-transcripts?clientId=... for the last 90 days; show ONLY rows that have the second-person summary
recap (no fallback). Card = bold date/time, (mm:ss) duration, recap. Open a transcript via ?transcriptId=;
Download. Pin: POST /pin-transcript {transcriptId,pinned}; optimistic toggle with revert-on-error; pinned
sorted first in a tinted section.`,
  'Browse my past agent chats':
`GET /get-transcripts (list projection incl. summary, acwSummary, agentName, pinned); filter to rows with a
summary; render cards newest-first; bot-only chats are never saved so never appear.`,
  'Open and download a past transcript':
`GET /get-transcripts?transcriptId= -> render read-only; Download via the transcriptDownload util.`,
  'Pin important chats to the top of history':
`POST /pin-transcript; optimistic update + revert on error; pinned-first sort; smooth scroll-to-top on pin.`,
  // ---------------- FEATURE 3: AI Autopilot Engine ----------------
  'AI Autopilot Engine':
`A single Node 20 Lambda (handler.ts, ~1900 lines) behind POST /autopilot-turn, scope-dispatched
(full-auto | get-intent | idle-check | callback | locate-evidence). Stateless and reactive: ONE invocation
per client message, no polling, no server-side state between turns (the transcript is passed in).
Models: Bedrock Nova Micro (invokeNovaMicro) for classification, full-auto, ACW, NBR, intent labels; OpenAI
gpt-4o for the get-intent task experts (gpt-4o-mini proved too weak for the experts' rules); gpt-4o-mini is
the default for bot/NBR/labels for cost. OPENAI_API_KEY resolves from SSM at deploy.
Shared modules: tasks.ts (TASKS catalog + matchTaskByIntent + filterFields), kb.ts, types.ts, client-tools
.ts (on-demand tool calling). Returns {reply, shouldExitAutopilot, proposedAction?, scope}.
INVARIANT (safety guard): never return shouldExitAutopilot=true without a concrete proposedAction - if that
happens, reset it to false. Wrap model calls in try/catch (holding message + safe exit on error).`,
  'Autopilot Scopes & Turn Orchestration':
`Top-level dispatch by scope. full-auto -> FULL_AUTO_PROMPT; get-intent -> two-phase task engine; idle-check
-> check-in; callback -> CALLBACK_PROMPT; locate-evidence -> post-hoc utility (early-returns before chat-
turn logic). Choose the model per job. Apply the safety guard before returning.`,
  'Run all chat turns through one scoped engine':
`Single handler; parse {scope, transcript, profile, ...}; branch by scope; keep it stateless so concurrent
turns never race.`,
  'Never hand off without a complete Proposed Action':
`After the expert turn: if (shouldExitAutopilot && !proposedAction) shouldExitAutopilot = false. Add a unit
test for this exact case.`,
  'Degrade gracefully on AI failure':
`try/catch around the model call; on throw, reply with a brief holding line ("pulling some information...")
and set shouldExitAutopilot=true; log the error to CloudWatch.`,
  'Task Identification (Phase 1)':
`matchTaskByIntent(intent, accountTypes) scores TASKS by keyword overlap (zero LLM). On miss,
identifyTaskWithLLM (Nova Micro) classifies. ADVICE_RE short-circuits "what should I buy" to the callback
scope BEFORE identification. Eligibility: tasks with eligibleAccountTypes only match clients holding those
types.`,
  "Identify the task from the client's words":
`Keyword match first; LLM fallback. Once identified, build the expert prompt via buildTaskSystemPrompt(
profile, taskId) and run the first turn.`,
  'Route advice requests away from task collection':
`Test ADVICE_RE (and/or an LLM check) BEFORE matchTaskByIntent; if it is advice, set scope=callback so a
purchase task never swallows it.`,
  'Reactive Field Collection (Phase 2)':
`A per-task expert prompt (buildTaskSystemPrompt switch case) handles each subsequent message. It knows the
remaining fields (filterFields applies requiresMultipleAccounts / requiresAccountTypes / skipWhenFieldIs),
the current account state (summarizeAccounts header), the business rules, and the proposedAction JSON
contract. Exits with shouldExitAutopilot=true + proposedAction when all required fields are confirmed.
proposedAction shape: {taskId, fields:[{key,label,value}], ...} stamped via withSubmissionType.`,
  "Collect a task's fields conversationally":
`Expert enumerates remaining fields and restates captured values; on completion emits the proposedAction
JSON; the server validates that all required (post-filter) fields are present before honoring the exit.`,
  'Follow up on partially answered prompts':
`Prompt rule (shared block): if multiple items were asked and only some answered, follow up for the rest
before moving on.`,
  'Cross-Cutting Guardrails (All Tasks)':
`Shared constants injected into every task prompt: FORBIDDEN_TOPICS (advice, trades, fraud, inheritance -
each with a scripted response, plus the field-follow-up + restating-language rules) and
FORBIDDEN_TOPICS_NO_TRADES (same minus the trade clause, for trade-handling tasks). Editing one constant
changes all 19 experts - scope changes carefully. Plus a hallucination rule: never invent account facts.`,
  'Apply forbidden-topic handling uniformly':
`Define FORBIDDEN_TOPICS once and inject it into every buildTaskSystemPrompt case; trade-handling tasks use
the FORBIDDEN_TOPICS_NO_TRADES variant.`,
  'Restate facts with correct attribution':
`Prompt rule: "Got it - X will be Y" for client-stated values; "I see X is currently" for database-sourced
values.`,
  'Prevent the assistant from inventing account facts':
`Hallucination-protection rule in all system prompts; route unknown facts through client-tools (get_*) or
decline rather than guessing.`,
  'The 19 Task Experts':
`Each expert = a case in buildTaskSystemPrompt + a TASKS entry {id,name,keywords,fields[],executionType
real|mock, submissionType?} + an execute-task handler. Fields support requiresMultipleAccounts (skip the
account picker when the client has one account), requiresAccountTypes, skipWhenFieldIs (conditional skip),
and enum options. Adding a task = tasks.ts entry + prompt case + execute-task case.`,
  'Autopilot: Update Contact Information':
`Fields: infoType (enum: Phone/Email/Mailing address), newValue (text). executionType mock. Echo the new
value back for confirmation before exit.`,
  'Autopilot: Change Beneficiary Designations':
`Fields: accountId (only if multiple accounts), action (Add/Update/Remove), beneficiaryName, relationship
(skip if Remove), percentage (skip if Remove), beneficiaryType Primary/Secondary (skip if Remove).
executionType REAL. Pre-prompt: fetch current beneficiaries from DynamoDB; filter accounts to IRA/SEP only
(iraAccounts) for BOTH the picker and the summarizeAccounts header. Enforce 100% allocation; acknowledge
existing beneficiaries; handle ADD/REMOVE/UPDATE/REPLACE-ALL. On execute, atomically replace that account's
beneficiaries, preserving others.`,
  'Autopilot: Add Authorized Account User (Type 3)':
`Fields: personName, personEmail, accessLevel (View-only / Limited / Full, with the access definitions in
the question text). executionType mock. submissionType 'client' (Type 3): the proposedAction is stamped
client-submitted; the agent's card reads "Send to client" and the client approves in their own chat.`,
  'Autopilot: Open a New Account':
`Fields: accountType (Roth/Traditional/SEP/Taxable), initialAmount, fundingSource (ACH/Check/Rollover).
executionType mock.`,
  'Autopilot: Buy / Make a Contribution':
`Fields: accountId (if multiple), fund (from FUND_PICKLIST), amount, fundingSource (Linked bank / Cash in
account). executionType mock. Uses FORBIDDEN_TOPICS_NO_TRADES.`,
  'Autopilot: Sell Fund Shares':
`Fields: accountId (if multiple), fund, amount (text - allows a dollar amount or full redemption), reason
(Withdrawal/Exchange/Rebalancing/Other). executionType mock. NO_TRADES variant.`,
  'Autopilot: Exchange Between Funds':
`Fields: accountId (if multiple), fromFund, toFund, amount (text - dollar amount or full balance).
executionType mock. NO_TRADES variant.`,
  'Autopilot: Change Dividend Reinvestment (DRIP)':
`Fields: accountId (if multiple), fund, dripEnabled (ON reinvest / OFF cash). executionType mock.`,
  'Autopilot: Set Up Automatic Investment':
`Fields: accountId (if multiple), fund, amount, frequency (Monthly/Quarterly), dayOfMonth (1-28).
executionType REAL - creates an autoInvest schedule record; recompute nextDate.`,
  'Autopilot: Modify Auto-Invest Schedule':
`Fields: scheduleDescription (free text to identify the schedule), amount, frequency (Monthly/Quarterly/Keep
the same), dayOfMonth. executionType REAL - updates the matched schedule.`,
  'Autopilot: Pause or Resume Auto-Invest':
`Fields: scheduleDescription, action (Pause/Resume). executionType REAL - toggles active.`,
  'Autopilot: Request a Distribution':
`Fields: accountId (if multiple), amount, deliveryMethod (ACH/Check), taxWithholding (ONLY for Traditional/
SEP via requiresAccountTypes). executionType mock.`,
  'Autopilot: Set Up Recurring Distributions':
`Fields: accountId (if multiple), amount, frequency (Monthly/Quarterly/Annually), startDate (datetime),
deliveryMethod (ACH/Check). executionType mock.`,
  'Autopilot: Update RMD Settings':
`eligibleAccountTypes: Traditional IRA, SEP-IRA (task is not offered otherwise). Fields: deliveryMethod
(ACH/Check), frequency (Annual December/Monthly/Quarterly), taxWithholding (0-99%). executionType REAL.`,
  'Autopilot: Roll Over From Another Institution':
`Fields: sourceInstitution, sourceAccountType (401k/Roth 401k/403b/IRA/Other), estimatedAmount,
targetAccountId (if multiple). executionType mock.`,
  'Autopilot: Convert to Roth IRA':
`eligibleAccountTypes: Traditional IRA, SEP-IRA. Fields: fromAccountId, amount (text - dollar or full
balance), taxYear. executionType mock. Convey clearly that a conversion is a taxable event.`,
  'Autopilot: Request Tax Document':
`Fields: formType (1099-R / 1099-B / 1099-DIV / 5498), taxYear. executionType mock.`,
  'Autopilot: Cancel or Reschedule Callback':
`Fields: action (Cancel/Reschedule), newScheduledTime (datetime; skip if Cancel). executionType mock - the
reschedule updates the EventBridge schedule.`,
  'Autopilot: Update Security Settings':
`Fields: securityAction (Change password / Enable 2FA / Disable 2FA / Remove trusted device). executionType
mock.`,
  'Callback Scope & Time Resolution':
`CALLBACK_PROMPT. The LLM NEVER computes timestamps: it emits {dayReference, hour24, minute}; the server
resolveCallbackTime (TZ-safe via Intl / date-fns-tz) resolves + validates the ET->UTC instant. The server
injects authoritative availability (describeCallbackAvailability) and composes the first-turn "why a
callback" opener deterministically. Advice requests short-circuit here (ADVICE_RE).`,
  'Arrange a callback at a valid time':
`Expert emits {dayReference, hour24, minute}; resolveCallbackTime validates business hours / availability
and rejects invalid times; on success create the schedule via schedule-callback.`,
  'Proposed-Action Evidence Location':
`locate-evidence scope (LOCATE_EVIDENCE_PROMPT, model gpt-4o). Input {transcript, proposedAction}. One LLM
call picks the authoritative span per field (the client's statement, else the client-confirmed agent recap
- NEVER post-confirmation echoes). The SERVER validates every quote against the actual message text and
returns {evidence:[{fieldKey, messageId, start, end}]}. Early-returns before chat-turn logic; ANY failure
-> {evidence:[]} so the UI simply shows no highlights.`,
  'Locate the transcript evidence for each collected field':
`Additive scope; for each field, validate that message.text.slice(start,end) equals the quoted span (reject
otherwise); return {evidence:[]} on any mismatch or failure.`,
  'Idle Detection & Proactive Check-In':
`idle-check scope. A client-side ~3-minute timer (started when the agent asks a question) triggers ONE
check-in turn. Guard against double-fire in React StrictMode (dev) and against firing while the client is
typing.`,
  'Nudge a quiet client with a check-in':
`Timer lives in the agent column; on expiry POST /autopilot-turn scope=idle-check exactly once; clear the
timer on any new message.`,
  // ---------------- FEATURE 4: Agent Workspace ----------------
  'Agent Workspace':
`The agent SPA (React 18 + Vite + TS), served at /agent. Telephony/chat via Amazon Connect Streams + an
embedded CCP. agentStore (Zustand) holds up to 4 ContactSlots {contactId, clientId, status, messages,
proposedAction, proposedActionEvidence, customerTyping, customerDisconnected, ...}. A useConnectStreams
hook wires CCP events (contact.onConnecting/onConnected/onEnded, chatSession.onMessage/onTyping) into the
store. Layout: AgentDesktop (4-column grid) + FocusingDesktop (single contact). Per column: ChatColumn,
ProposedActionCard, AISupport, IncomingAlert, IntentLabel, ResponseTimer, AfterCallWork, AutopilotMenu.
Connection tokens via the agent-connection Lambda; agent->customer messages/typing via send-agent-message.
GOTCHA: chatjs routes unmapped event types (e.g. participant.left) to onMessage - use that to detect the
customer leaving. Because Connect ends the whole contact on customer disconnect, hold the slot at 'active'
(don't auto-advance to ACW) until the agent clicks End chat.`,
  'Multi-Chat Desktop & CCP Integration':
`useConnectStreams subscribes to CCP/Streams events and maps them onto agentStore ContactSlots (max 4). The
agent-connection Lambda mints/refreshes the connection token (a raw fetch with the connection token is what
fixed the 403s on agent->customer sends). ChatColumn renders each slot's thread; control messages (agent
name, approval form, typing) are intercepted, not rendered.`,
  'Handle up to four chats at once':
`agentStore keeps an array of <=4 slots keyed by contactId; each column reads only its slot so state never
bleeds across conversations.`,
  "See the client's profile and accounts alongside the chat":
`On accept, load the client profile (client-data) plus the intent attributes from the contact; render
IntentLabel + an account summary panel.`,
  'Incoming Contact Management':
`IncomingAlert renders on contact.onConnecting with the client name, AI intentSummary, account types, and a
ResponseTimer countdown. Accept routes the contact into a slot; skip releases it. Show a bonus badge when
the contact qualifies (metadata). Guard the Accept/Close handlers against double-fire in React StrictMode
(dev).`,
  'Triage incoming contacts with context and a timer':
`Render IncomingAlert + ResponseTimer; accept -> agentStore adds the slot + loads context; skip -> release.
De-dupe the StrictMode double-invoke.`,
  'Focus Mode':
`FocusingDesktop renders one slot full-width, reusing the same ChatColumn/ProposedActionCard/AISupport
halves; evidence highlighting + disconnect handling must behave identically. GOTCHA: hidden focusing-mode
ChatColumns must bail on clientWidth===0 for the container-scoped evidence lookups.`,
  'Focus on one conversation full-width':
`Toggle focus -> render FocusingDesktop with the FocusMessageBubble mirror; verify evidence + disconnect
parity with the grid.`,
  'AI Support Panel':
`AISupport per column: a next-best-response draft (reply + autopilot scope hint), topic buttons (predict-
intent), predicted questions (predict-questions, one-click inject into the composer), recommended KB
articles (matchResources), and AutopilotMenu (start/stop + scope). All suggestions are non-binding
(adopt/edit/ignore).`,
  'Adopt an AI-suggested reply':
`Call next-best-response; show the draft + scope hint; clicking inserts it into the composer; the agent can
edit before sending.`,
  'Insert predicted questions and recommended articles':
`predict-questions -> QuestionButtons; KB matchResources -> article links; one click injects the question
into the composer or shares the article.`,
  'Start and stop autopilot from the panel':
`AutopilotMenu starts the runAutopilotTurn loop (POST /autopilot-turn scope=get-intent) until a
proposedAction appears or the agent stops. Stop cancels in-flight sends and emits the typing-stop sentinel.`,
  'Proposed Action Review, Evidence & Submission':
`ProposedActionCard shows proposedAction.fields (editable). Type 1 button "Submit Action"; Type 3 "Send to
client". Submit is shared via the submitProposedAction util -> POST /execute-task -> confirmation appended +
send-agent-message. Evidence: while the card is visible, ChatColumn (and FocusingDesktop's FocusMessageBubble)
highlight each field's span from slot.proposedActionEvidence; each field has a crosshair button firing an
evidence-jump CustomEvent (container-scoped lookup because pre-*/prior-* message ids repeat across columns).
Clear evidence on submit/reject; unlocatable fields show a "not located in transcript" hint.
KNOWN BUG to fix: ProposedActionCard editedFields state doesn't reset when FocusingDesktop switches between
two contacts that both have cards - fix with key={slot.contactId}.`,
  'Review and edit a Proposed Action before submitting':
`Render fields editable; submit via submitProposedAction; append the confirmation; reset editedFields on
contact switch via key={slot.contactId}.`,
  'Verify each value against the transcript with evidence':
`Fire the locate-evidence request in parallel during the autopilot send delay; store slot.proposedAction
Evidence; highlight + crosshair-jump (CustomEvent); bail hidden columns (clientWidth===0); clear on
submit/reject.`,
  'Client Disconnect Detection':
`Detect the customer's participant.left event (chatjs routes unmapped events to chatSession.onMessage) ->
set slot.customerDisconnected. contact.onEnded holds the slot at 'active' while customerDisconnected is set
(Connect ends the whole contact on customer disconnect). Replace the AI area with a "Client closed the
chat." notice + End chat button (all 4 UI modes); disable the composer; stop autopilot. End chat -> the ACW
transition.`,
  'Know immediately when a client leaves':
`Map participant.left in onMessage -> notice + End chat + disabled composer + autopilot stop; End chat
advances the column to ACW.`,
  'After-Call Work (ACW) Generation':
`generate-acw Lambda (Nova Micro) takes transcript + profile and returns {wrapUpCode (one of ~30), summary
(3-5 factual sentences), coaching (1 sentence, second person, + optional improvement)}. The AfterCallWork
component shows it for review/submit; triggered on chat end (End chat click).`,
  'Get wrap-up written automatically':
`POST /generate-acw on end; render AfterCallWork with the three outputs; allow light edit + submit.`,
  'Agent-to-Customer Messaging & Autopilot Send':
`send-agent-message Lambda pushes an agent message OR a typing event (event:'typing') to the client via the
Connect API (raw fetch with the connection token avoided 403s). autopilotSend layers autopilotDelay
(reading + typing) and the typing-stop sentinel on cancel; the agent broadcasts its full name on connect.`,
  'Send agent messages and typing reliably':
`POST /send-agent-message {contactId, text | event:'typing'}; use the connection token; preserve ordering
with autopilotSend.`,
  // ---------------- FEATURE 5: Task Execution & Fulfillment ----------------
  'Task Execution & Fulfillment':
`execute-task Lambda (Node 20) behind POST /execute-task; dispatch by taskId. Real writes use the
lib-dynamodb DocumentClient (UpdateCommand) on the Clients table; mock tasks return a well-formed
confirmation. Every result carries referenceNumber = REF-XXXXXX. The confirmation is delivered to the
client chat (via send-agent-message) as a structured payload the customer renders as a green confirmation
card. submissionType is stamped on the proposedAction (withSubmissionType) at both return sites in
autopilot-turn.`,
  'Execute-Task Engine':
`switch(taskId){...}; mint REF-XXXXXX; return {referenceNumber, confirmation, ...}. Mock handlers return
canned confirmations; real handlers perform the DynamoDB write. Make real writes safe to retry.`,
  'Execute an approved action and return a reference':
`Map each taskId to a handler; generate the REF; shape the structured confirmation payload the client card
renders.`,
  'Real DynamoDB Executions':
`Real writers: update-beneficiaries (atomic per-account replace, preserving other accounts), setup/update/
pause auto-invest, update-rmd-settings. Use UpdateCommand with attribute-path expressions; read-modify-write
only the target sub-structure. Live trades PutItem a Pending transaction row dated today into the
Transactions table.`,
  'Persist beneficiary, auto-invest, and RMD changes':
`UpdateCommand against accounts/autoInvest/rmd; replace beneficiaries keyed by accountId while preserving
siblings; recompute derived fields (e.g. nextDate).`,
  'Reflect executed trades in transaction history':
`On buy execute, append a Pending row (PK clientId, SK "<today>#<seq>", status Pending) to the Transactions
table so it shows immediately.`,
  'Confirmation Experience':
`The customer renders a green confirmation card (structured header, REF number, past-tense description)
rather than a plain bubble; deliver it as a control payload recognized client-side in ChatMessage.`,
  'Receive a clear confirmation card for completed actions':
`Define the confirmation payload schema {referenceNumber, title, body}; ChatMessage detects + renders it as
the green card.`,
  'Client-Submitted Approvals (Type 3)':
`For submissionType 'client': the agent ProposedActionCard button = "Send to client". Round-trip via control
messages (agent->customer: approval-form, approval-cancel; customer->agent: client-approved, client-
declined). Agent sends the form -> customer renders ApprovalFormCard (editable fields, NO evidence buttons)
-> Submit sends client-approved -> the agent app runs the SAME submitProposedAction path as Type 1 (byte-
identical confirmation). Decline returns the card to the agent. Idempotency: flip awaitingClientApproval=
false BEFORE the await on the relay. Agent Cancel / chat-end / client-left all clean up the pending state.`,
  'Approve an owner-only action in my own chat':
`Wire the control-message round-trip + ApprovalFormCard + the shared submit util + the idempotency guard +
cleanup paths.`,
  'Submission-Type Framework':
`Task.submissionType ('agent' default | 'licensed-agent' reserved | 'client'); withSubmissionType stamps it
onto the proposedAction at both autopilot-turn return sites; the card adapts its button; a new Type 3 task
is just the field set to 'client'.`,
  "Stamp and honor each task's submission type":
`Add submissionType to the TASKS entry; stamp it in autopilot-turn; branch the card button; keep the execute
path identical regardless of type.`,
  // ---------------- FEATURE 6: Knowledge & Predictive Assistance ----------------
  'Knowledge & Predictive Assistance':
`kb.ts is a pure (React-free) data module: KB topics + ~247 Q&A + EXTRA_PAGE_TOPICS (page/step -> topic ids)
+ matchResources (article recommender). Three Nova Micro Lambdas behind their routes: predict-intent
(page+convo -> topics), predict-questions (convo -> 3 next questions), next-best-response (convo -> reply +
autopilot scope). Consumed by the customer chat pills (TopicButtons/QuestionButtons) and the agent AISupport
panel. Keep kb.ts importable by both frontends and lambdas.`,
  'Knowledge Base Content & Mapping':
`KB[] topics each with questions + answers; EXTRA_PAGE_TOPICS maps page keys (and open-account/<step>) to
topic ids; pageKeyFromPath derives the key from the route; a pageContextStore can publish a finer key. Keep
help-page slugs aligned with the link table.`,
  'Maintain a page-mapped knowledge base':
`Author topics + Q&A; map them to page/step keys in EXTRA_PAGE_TOPICS; verify each mapped page route exists.`,
  'Predict Intent (Topic Suggestions)':
`predict-intent Lambda (Nova Micro): input {pageKey, recentMessages} -> ranked topic ids drawn from KB +
EXTRA_PAGE_TOPICS. Powers the customer TopicButtons and the agent topic row.`,
  'Suggest relevant topics from page and conversation':
`Build the prompt from pageKey + EXTRA_PAGE_TOPICS + recent messages; return ranked topic ids; cache per
page where possible.`,
  'Predict Questions':
`predict-questions Lambda: input conversation -> 3 likely next questions (strings) with optional pre-written
answers; one-click inject into the agent composer.`,
  "Anticipate the client's next questions":
`Prompt for the top 3 next questions; return an array; render as QuestionButtons.`,
  'Next-Best Response':
`next-best-response Lambda: input conversation -> {reply (1-2 sentences), scope hint}; shown in AISupport as
an editable draft.`,
  "Draft the agent's next reply":
`Prompt for a concise reply + a recommended autopilot scope; return both; keep it non-binding.`,
  // ---------------- FEATURE 7: Callback Scheduling ----------------
  'Callback Scheduling':
`schedule-callback Lambda creates a one-time Amazon EventBridge Scheduler schedule targeting the
execute-callback Lambda at the resolved UTC instant. The time is computed + validated SERVER-side (never by
the LLM - see the autopilot callback scope, which emits {dayReference,hour24,minute} and lets the server
resolve ET->UTC). The agent app shows a callback confirmation (time + REF). cancel-reschedule-callback (a
standard task) updates or deletes the schedule.`,
  'Schedule a Callback':
`schedule-callback creates the EventBridge schedule (no flexible window); persist {callbackId, scheduledUtc,
clientId, REF}. CallbackScheduler renders in chat; reflect availability from describeCallbackAvailability.`,
  'Schedule a callback for a chosen time':
`POST /schedule-callback {clientId, instantUtc}; create the schedule; return REF + confirmation; render it
in chat and in the agent app.`,
  'Execute & Manage Callback Lifecycle':
`execute-callback is the schedule target (in prod it would place the outbound call / notify the queue).
Cancel deletes the schedule; reschedule updates its time. Both confirm to the client.`,
  'Have my callback fire at the scheduled time':
`execute-callback handler invoked by EventBridge at the instant; make it idempotent; log it and (in prod)
trigger the outbound action.`,
  'Cancel or reschedule a callback':
`The cancel-reschedule-callback task -> execute-task -> delete or update the EventBridge schedule; confirm
to the client.`,
  // ---------------- FEATURE 8: Fund Catalog & Market Data ----------------
  'Fund Catalog & Market Data':
`One canonical fund data file (pure data, framework-free) is the single edit point, the SEED for the Funds
DynamoDB table (PK ticker), and the frontend offline fallback. At runtime the TABLE is the source of truth:
the get-funds Lambda serves GET /funds (module-cached ~60min); the useFunds() hook consumes it (localStorage
TTL + bundled fallback). The backend reaches the canonical file through ONE bridge module (re-exports the
fund list + a FUND_PICKLIST). AI access: a get_funds tool (reads the table) for bot/NBR/experts, plus
FUND_PICKLIST injected into expert prompts. Live prices/returns come from a separate market-data Lambda
whose ticker->symbol map is DERIVED from the catalog (so it cannot drift). Seed/refresh a fresh env via
GET /reset-funds?key=...`,
  'Fund Catalog Source of Truth':
`Canonical file -> seed table (one item per fund). get-funds Scans once and module-caches; useFunds reads
/funds with a localStorage TTL + a bundled fallback. ~36 small items that change < once/day, so a single
Scan + cache is correct. reset-funds (key-gated) seeds/refreshes per environment.`,
  'Serve the fund catalog from a single source':
`Build the bridge re-export (fund list + FUND_PICKLIST). reset-funds writes one item per fund. get-funds
Scans + caches. useFunds reads /funds with localStorage TTL and falls back to the bundled catalog offline.`,
  'Fund Content Pages':
`Fees, Fund Performance, Prospectus library, Research screener, Fund Profile, and tax-efficient-investing
all read via useFunds(). Apply the content-above-long-lists rule: put general content first and give long
fund tables a maxHeight + scroll (e.g. the Fees page: account fees above the 36-row expense-ratio table).`,
  'See consistent fund data across content pages':
`Each page reads useFunds() so it matches the catalog + the assistant; fees page uses content-first
ordering; performance/prospectus read the same source.`,
  'AI Fund Access':
`A get_funds tool in client-tools.ts (reads the Funds table) registered for the customer bot, NBR, and the
task experts; FUND_PICKLIST is injected into expert prompts so experts only ever reference real funds.`,
  'Let the AI look up real fund data':
`Implement get_funds as an OpenAI tool/function (reads the table); register it for bot/NBR/experts; inject
FUND_PICKLIST into the expert prompts.`,
  'Live Market Data':
`market-data Lambda fetches live quotes (e.g. Yahoo) per fund; the ticker->realSymbol FUND_MAP is derived
from the catalog via the bridge (FUNDS.map(...)) so it always matches the lineup. Cache quotes briefly.`,
  'Show live fund prices and returns':
`Derive FUND_MAP from the catalog; fetch quotes; short cache; expose via the market-data route consumed by
the fund pages.`,
  // ---------------- FEATURE 9: Platform, Infrastructure & Delivery ----------------
  'Platform, Infrastructure & Delivery':
`AWS CDK (TypeScript). Stacks: DataStack (DynamoDB + IAM), LambdaStack (API Gateway HTTP API + all Lambdas +
env wiring + EventBridge scheduler role), plus ConnectStack, BudgetStack, CicdStack (rarely changed). Stage-
parameterized: STAGE=dev synthesizes an isolated env (-dev suffixes + a separate API); prod is byte-
identical. Secrets (model + pager keys) resolve from SSM at deploy. Deploys go through a guarded script
(safe-deploy.mjs): tsc --noEmit + cdk diff + a destroy-guard that ABORTS if any live resource would be
removed/replaced (override only with ALLOW_DESTROY=1). GitHub Actions on merge to main: deploy-cdk (CDK via
OIDC) + frontend deploys to gh-pages. main == production; rollback = revert the merge commit.`,
  'Infrastructure as Code (CDK)':
`API Gateway HTTP API with a route per Lambda; Lambdas bundled with esbuild (Node 20); DynamoDB tables (on-
demand); EventBridge scheduler role; secrets via CloudFormation SSM dynamic references. DataStack +
LambdaStack are the CI-deployed pair; the others are deployed manually when they change.`,
  'Define all infrastructure as code':
`Author the stacks; wire env vars + least-privilege IAM; resolve secrets from SSM at deploy; esbuild-bundle
each Lambda. Verify with cdk synth/diff.`,
  'Dev/Prod Environments':
`A STAGE parameter drives -dev suffixes (dev tables, a -dev Lambda stack, a separate API); .env.development
points local frontends at the dev API; dev is ~$0 idle (on-demand). NOTE: Connect/live-chat is shared with
prod (single instance), so chat-handoff testing still hits prod.`,
  'Test against an isolated dev environment':
`Parameterize stack/resource names by STAGE; "npm run deploy:dev" provisions dev; local "npm run dev" uses
.env.development (dev API + dev data).`,
  'CI/CD & Guarded Deploys':
`GitHub Actions: a PR gate (build both apps + tsc the CDK + bundle-check the Lambdas; both 'build' and
'backend' checks required) and, on merge to main, deploy-cdk (assumes an OIDC role) + frontend deploys. The
guarded safe-deploy.mjs is the ONLY deploy path (CI + manual). The build SHA is stamped into both apps.`,
  'Ship to prod automatically on merge':
`deploy-cdk.yml assumes the OIDC role and runs the guarded deploy; the frontend workflows build + publish to
the gh-pages root (customer) and /agent (agent).`,
  'Block deploys that would delete live resources':
`safe-deploy.mjs parses cdk diff for REMOVE/REPLACE of any live resource (Lambda / route / integration /
permission / table / GSI) and aborts with the list unless ALLOW_DESTROY=1. This is why a stale-branch
deploy can no longer silently delete prod resources.`,
  'Gate every PR with builds and bundle checks':
`The PR workflow builds both frontends, typechecks the CDK, and bundle-checks each Lambda before merge is
allowed.`,
  'Data Layer & Demo Data':
`Tables: Clients (PK clientId), Sessions (PK contactId, 30-day TTL), Transcripts (RETAIN, GSI clientId-
savedAt-index), Transactions (PK clientId, SK "<ISOdate>#<seq>", GSI account-index), Funds (PK ticker).
client-data is the read/write access layer (lib-dynamodb). reset-all-data / reset-client-data /
reset-beneficiaries seed defaults + transactions + funds idempotently per env (key-gated). Factory defaults
live in a client-defaults module.`,
  'Read and write client data through one access layer':
`client-data dispatches actions over the Clients table via the lib-dynamodb DocumentClient; provide
consistent read/write helpers so callers never hand-roll DynamoDB calls.`,
  'Reset demo data to a known-good state':
`reset-all-data restores all fields from client-defaults, REMOVEs legacy arrays + lastAgentChat, and reseeds
transactions (deterministic) + funds. Idempotent and key-gated (?key=...).`,
  'Transcript Storage & Review':
`save-transcript writes the full record (messages, intentSummary, wrapUpCode, acwSummary, agentUsername/
agentName, and a second-person summary recap) to the Transcripts table (RETAIN) and writes lastAgentChat
continuation memory on Clients. get-transcripts lists via the GSI (clientId-savedAt-index) and fetches by
id. pin-transcript sets pinned. A standalone review UI (separate from the agent app) deep-links via ?id=.`,
  'Persist every agent chat as a reviewable transcript':
`On end, generate the recap summary (Nova Micro), save the transcript row, and write the lastAgentChat
continuation memory (transcriptId, endedAt, summary, agentUsername, agentName).`,
  'Review transcripts in a dedicated tool':
`A standalone static review UI (separate deploy from the agent app) reads get-transcripts; support ?id=
deep-linking (pushState/popstate) and a copy-conversation-id button.`,
  'Observability & Cost Safety':
`CloudWatch logs per Lambda (log scope/model/taskId/outcome); optional Arize tracing (arize.ts). BudgetStack
= a $15/mo budget alarm at 80% actual / 100% forecast (emails the owner). The client-log Lambda pages the
owner (via the pager API, base+key from SSM) on an access-code signin.`,
  'Get alerted on spend and key events':
`BudgetStack budget + email/SNS; client-log {context:"access-code-entered"} -> an urgent page via the pager
API (base + key from SSM).`,
  'Diagnose production behavior from logs':
`Emit structured logs in each Lambda (scope, model, taskId, outcome) - enough to trace a turn end-to-end
without redeploying.`,
  'Contact-Center Platform (Amazon Connect)':
`ConnectStack provisions the instance + routing. Agent provisioning = aws connect create-user with the right
routing profile (mirror an existing agent). Connect is shared across dev + prod (single instance). Do not
re-enable Contact Lens (cost).`,
  'Provision Connect and agent logins':
`Stand up the Connect instance, queues, and routing profiles; add an agent via aws connect create-user with
the chat routing profile id.`,
  // ===TECH-INSERT-ABOVE===
};

const EXTRA_SUBTASKS = {
  'Open an account through a guided multi-step wizard': [
    { summary: 'Encode wizard step + done in URL query params (useSearchParams)', desc: 'Drive ?step=N and ?done=1 from the URL so Back/Forward + refresh work; keep form values in component state.' },
    { summary: 'Build the 8 step components + account-type branch components', desc: 'type, personal, contact, disclosures, setup(IRA/SEP/Taxable), funding+initial invest, DCA opt-in, review/sign/confirm.' },
    { summary: 'Per-step validation incl. IRA 100% beneficiary allocation gate', desc: 'Block advancing past IRA setup until primary beneficiary allocations total 100%.' },
    { summary: 'Publish per-step page-context keys for chat pills', desc: 'Publish open-account/<step> and setup-{ira,sep,taxable} via pageContextStore; ChatWidget prefers it over the path key.' },
    { summary: 'Mock account creation + confirmation timeline', desc: 'On submit, create the account (mock) and render the terminal confirmation timeline.' },
  ],
  'Manage beneficiary designations': [
    { summary: 'IRA/SEP account filter + per-account beneficiary editor UI', desc: 'Exclude taxable accounts; edit primary/secondary entries with percentages.' },
    { summary: '100% allocation validation', desc: 'Block save unless the per-account percentages total exactly 100.' },
    { summary: 'Atomic per-account replace via client-data', desc: 'Replace only the target account beneficiaries; preserve all other accounts (match execute-task semantics).' },
  ],
  'Browse full transaction history with filter/search/sort/paginate': [
    { summary: 'Implement get-transactions-page (base64 cursor) in client-data', desc: 'Query newest-first (ScanIndexForward:false); return items + opaque cursor.' },
    { summary: 'Table UI with account filter, search, sort, paging', desc: 'Right-aligned amounts; StatusCell; loading/empty/error states.' },
  ],
  // --- Feature 2 ---
  'Close chat with an intentional confirmation': [
    { summary: 'Implement endChat via disconnectParticipant() (not disconnect())', desc: 'Customer ChatJS has no disconnect(); call disconnectParticipant() and surface (do not swallow) errors.' },
    { summary: 'Close-confirm dialog + silent-close rules', desc: 'Minimize (default) / End chat; skip the dialog for never-engaged or already-ended chats.' },
  ],
  'Resume a chat after reload or leaving the site': [
    { summary: 'Persist chat session to sessionStorage', desc: 'Persist persist/minimized/unreadCount/chatEnded/messages per tab.' },
    { summary: 'Reconnect on load + backfill missed agent messages', desc: 'If a live session exists, reconnect ChatJS and backfill via getTranscript; reconcile by message id.' },
  ],
  'Make autopilot replies feel human-paced': [
    { summary: 'Implement autopilotDelay reading phase', desc: 'Ellipsis hidden; 2000ms + 10ms*(clientMsgLen-200), min 2000ms, based on the client last message.' },
    { summary: 'Implement autopilotDelay typing phase + cancel sentinel', desc: 'Show ellipsis; delay chars/15 s; on cancel send the typing-stop sentinel to clear it.' },
  ],
  // --- Feature 3 ---
  "Identify the task from the client's words": [
    { summary: 'Keyword scorer matchTaskByIntent', desc: 'Score TASKS by keyword overlap, filtered by eligibleAccountTypes; zero LLM.' },
    { summary: 'LLM fallback identifyTaskWithLLM (Nova Micro)', desc: 'Classify intent when keywords miss; then build the expert prompt for turn 1.' },
  ],
  "Collect a task's fields conversationally": [
    { summary: 'filterFields conditional logic', desc: 'Apply requiresMultipleAccounts / requiresAccountTypes / skipWhenFieldIs to compute remaining fields.' },
    { summary: 'proposedAction JSON contract + required-field validation', desc: 'Emit {taskId, fields:[{key,label,value}]}; server validates all required fields before honoring exit.' },
  ],
  'Autopilot: Change Beneficiary Designations': [
    { summary: 'Fetch current beneficiaries before building the prompt', desc: 'Read existing beneficiaries from DynamoDB so the expert can acknowledge them.' },
    { summary: 'IRA/SEP-only account filter (iraAccounts)', desc: 'Filter both the account picker and the summarizeAccounts header to IRA/SEP; never taxable.' },
    { summary: 'Enforce 100% allocation + ADD/REMOVE/UPDATE/REPLACE-ALL semantics', desc: 'Validate totals; support all four actions; atomic per-account replace on execute.' },
  ],
  'Arrange a callback at a valid time': [
    { summary: 'Server-side resolveCallbackTime (TZ-safe ET->UTC)', desc: 'LLM emits {dayReference,hour24,minute}; server resolves+validates via Intl/date-fns-tz.' },
    { summary: 'Inject availability + deterministic opener', desc: 'describeCallbackAvailability into the prompt; server composes the first-turn why-a-callback line.' },
  ],
  // --- Feature 4 ---
  'Know immediately when a client leaves': [
    { summary: 'Detect participant.left via chatSession.onMessage', desc: 'chatjs routes unmapped events to onMessage; set slot.customerDisconnected.' },
    { summary: 'Hold slot at active + show notice/End chat in all 4 modes', desc: 'Do not auto-advance to ACW; disable composer; stop autopilot; End chat -> ACW.' },
  ],
  'Start and stop autopilot from the panel': [
    { summary: 'runAutopilotTurn loop (scope=get-intent)', desc: 'Drive turns until a proposedAction appears or the agent stops.' },
    { summary: 'Stop cancels in-flight send + emits typing-stop sentinel', desc: 'Immediately return control; clear the customer typing indicator.' },
  ],
  // --- Feature 5 ---
  'Approve an owner-only action in my own chat': [
    { summary: 'Agent Send-to-client relay + waiting note + idempotency guard', desc: 'Send the approval-form control message; flip awaitingClientApproval=false before the await.' },
    { summary: 'Client approval card + approve/decline control messages', desc: 'Editable fields, no evidence; Submit -> client-approved -> shared submit util (identical confirmation); Decline returns to agent.' },
    { summary: 'Cleanup on cancel / chat-end / client-left', desc: 'Clear the pending approval state in every termination path.' },
  ],
  // --- Feature 9 ---
  'Define all infrastructure as code': [
    { summary: 'DataStack: DynamoDB tables + IAM', desc: 'Clients/Sessions/Transcripts/Transactions/Funds with the documented keys, indexes, TTL, and RETAIN.' },
    { summary: 'LambdaStack: HTTP API routes + env wiring + scheduler role', desc: 'A route per Lambda; SSM secret references; EventBridge scheduler role.' },
  ],
  'Block deploys that would delete live resources': [
    { summary: 'Implement safe-deploy.mjs (typecheck + cdk diff + destroy-guard)', desc: 'Parse the diff for REMOVE/REPLACE of live resources; abort unless ALLOW_DESTROY=1.' },
  ],
  'Reset demo data to a known-good state': [
    { summary: 'reset-all-data from client-defaults (+ legacy cleanup)', desc: 'Restore all fields; REMOVE legacy arrays + lastAgentChat; key-gated.' },
    { summary: 'Deterministic transaction + fund reseed', desc: 'Seed transactions (deterministic, idempotent) and funds from the canonical catalog.' },
  ],
  'Persist every agent chat as a reviewable transcript': [
    { summary: 'Generate recap summary (Nova Micro) on chat end', desc: 'Second-person summary used by history + Continue this chat.' },
    { summary: 'Write transcript row + lastAgentChat continuation memory', desc: 'Save to Transcripts (RETAIN); write lastAgentChat on Clients.' },
  ],
  // ===SUBTASKS-INSERT-ABOVE===
};

// ===========================================================================
// ENGINE: walk the tree, assign IDs, derive hierarchy columns, emit CSV(s).
// ===========================================================================
let counter = 0;
const rows = [];
const epicNames = new Set();

// Compose the full ticket body: narrative + the technical layer for that level.
// Technical content is authored in the TECH map (keyed by summary) so the ticket
// objects above stay clean. Header is chosen by level: Features carry ARCHITECTURE
// & STACK, Epics carry TECHNICAL SCOPE, Stories carry TECHNICAL DESIGN.
const TECH_HEADER = {
  Feature: 'ARCHITECTURE & STACK',
  Epic: 'TECHNICAL SCOPE',
  Story: 'TECHNICAL DESIGN',
  'Sub-task': 'IMPLEMENTATION NOTE',
};
function composeDesc(node) {
  let d = node.desc || '';
  const t = node.tech || TECH[node.summary];
  if (t) d += `\n\n=== ${TECH_HEADER[node.kind] || 'TECHNICAL DESIGN'} ===\n${t}`;
  return d;
}

function walk(node, ctx) {
  node.id = ++counter;
  const isFeature = node.kind === 'Feature';
  const isEpic = node.kind === 'Epic';
  const isStory = node.kind === 'Story';
  const isSub = node.kind === 'Sub-task';

  const component = isFeature ? (node.component || node.summary) : ctx.component;

  if (isEpic) {
    if (epicNames.has(node.summary)) {
      throw new Error(`Duplicate Epic Name (must be unique for Epic Link): "${node.summary}"`);
    }
    epicNames.add(node.summary);
  }

  rows.push({
    issueType: node.kind,
    id: String(node.id),
    parentId: isSub ? String(ctx.storyId) : '',
    epicLink: isStory ? ctx.epicName : '',
    epicName: isEpic ? node.summary : '',
    parentLink: isEpic ? String(ctx.featureId) : '',
    // Unified immediate-parent pointer (modern Jira Cloud "Parent" field):
    // every non-feature row points at its direct parent's Issue ID.
    parent: isFeature ? '' : String(ctx.parentNodeId || ''),
    summary: node.summary,
    component,
    priority: node.priority || '',
    points: node.points != null ? String(node.points) : '',
    labels: node.labels || [],
    description: composeDesc(node),
    ac: node.ac || '',
  });

  const childCtx = {
    component,
    featureId: isFeature ? node.id : ctx.featureId,
    epicName: isEpic ? node.summary : ctx.epicName,
    storyId: isStory ? node.id : ctx.storyId,
    parentNodeId: node.id,
  };
  for (const child of node.children || []) walk(child, childCtx);

  // Inject additional implementation sub-tasks authored in EXTRA_SUBTASKS (keyed by
  // the story summary) so the existing ticket objects stay untouched.
  if (node.kind === 'Story' && EXTRA_SUBTASKS[node.summary]) {
    for (const st of EXTRA_SUBTASKS[node.summary]) {
      walk({ kind: 'Sub-task', summary: st.summary, desc: st.desc }, childCtx);
    }
  }
}

// Guard: EXTRA_SUBTASKS keys must match exactly one Story summary (catch typos/dupes).
const storySummaryCounts = {};
(function count(nodes) {
  for (const n of nodes) {
    if (n.kind === 'Story') storySummaryCounts[n.summary] = (storySummaryCounts[n.summary] || 0) + 1;
    count(n.children || []);
  }
})(FEATURES);
for (const key of Object.keys(EXTRA_SUBTASKS)) {
  if (storySummaryCounts[key] !== 1) {
    throw new Error(`EXTRA_SUBTASKS key matches ${storySummaryCounts[key] || 0} stories (need exactly 1): "${key}"`);
  }
}

for (const f of FEATURES) walk(f, {});

// Validate Epic Links resolve to a real Epic Name.
for (const r of rows) {
  if (r.issueType === 'Story' && r.epicLink && !epicNames.has(r.epicLink)) {
    throw new Error(`Story "${r.summary}" has Epic Link "${r.epicLink}" with no matching Epic Name`);
  }
}

// ---- CSV emit -------------------------------------------------------------
const MAX_LABELS = Math.max(1, ...rows.map(r => r.labels.length));
const LABEL_HEADERS = Array.from({ length: MAX_LABELS }, () => 'Labels');

const HEADER = [
  'Issue Type', 'Issue ID', 'Parent ID', 'Epic Link', 'Epic Name', 'Parent Link', 'Parent',
  'Summary', 'Component/s', 'Priority', 'Story Points',
  ...LABEL_HEADERS, 'Description', 'Acceptance Criteria',
];

function cell(v) {
  v = v == null ? '' : String(v);
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

function rowToArray(r, { includeParentLink } = { includeParentLink: true }) {
  const labels = [];
  for (let i = 0; i < MAX_LABELS; i++) labels.push(r.labels[i] || '');
  return [
    r.issueType, r.id, r.parentId, r.epicLink, r.epicName,
    includeParentLink ? r.parentLink : '',
    // In the no-features file, Epics are top-level so their unified Parent is blanked.
    (!includeParentLink && r.issueType === 'Epic') ? '' : r.parent,
    r.summary, r.component, r.priority, r.points,
    ...labels, r.description, r.ac,
  ];
}

function toCsv(rowObjs, opts) {
  const lines = [HEADER, ...rowObjs.map(r => rowToArray(r, opts))];
  return lines.map(cols => cols.map(cell).join(',')).join('\r\n') + '\r\n';
}

const DIR = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

// 1) Full 4-level backlog (Premium / single-file).
writeFileSync(DIR + 'vanguard-backlog.csv', toCsv(rows, { includeParentLink: true }));

// 2) Feature rows only (Premium two-file method, step 1).
writeFileSync(DIR + 'vanguard-features.csv',
  toCsv(rows.filter(r => r.issueType === 'Feature'), { includeParentLink: true }));

// 3) Everything except Features (works on every Jira plan; Feature kept as Component).
writeFileSync(DIR + 'vanguard-backlog-no-features.csv',
  toCsv(rows.filter(r => r.issueType !== 'Feature'), { includeParentLink: false }));

const counts = rows.reduce((m, r) => ((m[r.issueType] = (m[r.issueType] || 0) + 1), m), {});
console.log('Rows by type:', counts, 'TOTAL', rows.length);
console.log('Wrote vanguard-backlog.csv, vanguard-features.csv, vanguard-backlog-no-features.csv to', DIR);
