export interface KBQuestion {
  id: string;
  text: string;         // pill label, ≤ 12 words
  answer: string;       // 2–4 sentence pre-written answer
  accountTypes?: string[];  // restrict to clients with at least one of these
}

export interface KBTopic {
  id: string;
  label: string;        // topic pill label, ≤ 5 words
  pages: string[];      // pages where this topic is eligible
  accountTypes?: string[];  // restrict to clients with at least one of these
  priority: number;     // 1 = high, 2 = medium, 3 = low
  questions: KBQuestion[];
}

export const KB: KBTopic[] = [

  // ── Universal topics ─────────────────────────────────────────────────────

  {
    id: 't-balance',
    label: 'Check my balance',
    pages: ['portfolio'],
    priority: 1,
    questions: [
      {
        id: 'q-balance-001',
        text: 'What is my current total portfolio value?',
        answer: "Your total portfolio value is the sum of all your account balances as of the most recent market close. You can see a real-time breakdown on the Portfolio page, where each account's current balance is shown alongside your holdings. Balances update at the end of each trading day.",
      },
      {
        id: 'q-balance-002',
        text: 'Why is my balance different from yesterday?',
        answer: "Your balance changes daily based on the market value of your holdings. If your funds had a good day, the balance goes up; if markets fell, it decreases. Dividends, contributions, and withdrawals also affect your balance. The Portfolio page shows you exactly which holdings drove the change.",
      },
      {
        id: 'q-balance-003',
        text: 'How do I view balances for each account separately?',
        answer: "On the Portfolio page, each account (Roth IRA, Traditional IRA, Taxable Account, etc.) is listed individually with its current balance. You can click any account to see its specific holdings and transaction history. All accounts are also shown in the summary panel at the top of the page.",
      },
      {
        id: 'q-balance-004',
        text: 'How often does my balance update?',
        answer: "Account balances reflect the prior business day's closing prices and are updated each morning before market open. During trading hours, your displayed balance does not change in real time — it is refreshed once the market closes at 4:00 PM Eastern. Pending contributions or withdrawals may show separately as processing.",
      },
    ],
  },

  {
    id: 't-transactions',
    label: 'Recent transactions',
    pages: ['portfolio'],
    priority: 1,
    questions: [
      {
        id: 'q-tx-001',
        text: 'When will my recent contribution appear?',
        answer: "Contributions made via ACH bank transfer typically take 1–3 business days to settle and appear in your account. Wire transfers usually post the same business day. Once settled, the transaction will appear in your transaction history and your balance will update accordingly.",
      },
      {
        id: 'q-tx-002',
        text: 'How far back does my transaction history go?',
        answer: "Your online transaction history shows up to 10 years of activity. You can filter by account, date range, or transaction type on the Portfolio page. For records older than 10 years, please call us and we can provide a statement upon request.",
      },
      {
        id: 'q-tx-003',
        text: 'What does "dividend reinvestment" mean on my statement?',
        answer: "Dividend reinvestment (DRIP) means that when a fund distributes dividends, instead of sending cash to your account, the dividends are automatically used to purchase additional shares of the same fund. This allows your investment to compound over time. You can change this setting to receive cash dividends instead — just visit the account settings page.",
      },
      {
        id: 'q-tx-004',
        text: 'Can I download my transaction history?',
        answer: "Yes — on the Portfolio page, click the download icon near your transaction history to export it as a CSV or PDF. You can filter by account and date range before downloading. This file can be imported into most tax software or spreadsheet tools.",
      },
    ],
  },

  {
    id: 't-contact',
    label: 'Update contact info',
    pages: ['account'],
    priority: 1,
    questions: [
      {
        id: 'q-contact-001',
        text: 'How do I update my email address?',
        answer: "Go to the Account page, then select 'Contact Information.' Enter your new email address and confirm it. You'll receive a verification email at the new address — click the link to confirm the change. For security, you'll also receive a notification at your old email address.",
      },
      {
        id: 'q-contact-002',
        text: 'How do I change my phone number on file?',
        answer: "On the Account page under 'Contact Information,' you can update your phone number directly. After saving, we may send a verification code to the new number to confirm ownership. This number is used for two-factor authentication and callback scheduling.",
      },
      {
        id: 'q-contact-003',
        text: 'How do I update my mailing address?',
        answer: "Visit the Account page and select 'Contact Information' to update your address. Address changes may require identity verification for security purposes. Once confirmed, all future statements and correspondence will be sent to the new address. Changes typically take 1 business day to process.",
      },
      {
        id: 'q-contact-004',
        text: 'Will I get a confirmation after updating my info?',
        answer: "Yes — whenever you update your contact information, we send a confirmation to both your old and new contact details as a security measure. If you did not make the change, call us immediately at the number on our Contact page. All profile changes are also logged in your account activity.",
      },
    ],
  },

  {
    id: 't-beneficiary',
    label: 'Change beneficiary',
    pages: ['account'],
    priority: 1,
    questions: [
      {
        id: 'q-ben-001',
        text: 'How do I add or update a beneficiary?',
        answer: "On the Account page, select 'Beneficiary Designations.' You can add, edit, or remove beneficiaries for each account separately. You'll need the beneficiary's full legal name, date of birth, Social Security Number, and relationship to you. Changes take effect immediately upon saving.",
      },
      {
        id: 'q-ben-002',
        text: 'Can I name multiple beneficiaries?',
        answer: "Yes — you can name multiple primary beneficiaries and specify the percentage each receives (they must total 100%). You can also name contingent beneficiaries, who receive the assets if all primary beneficiaries predecease you. We recommend reviewing your beneficiary designations after major life events.",
      },
      {
        id: 'q-ben-003',
        text: 'What happens if I have no beneficiary on file?',
        answer: "If no beneficiary is designated, your account assets typically pass through your estate and are subject to probate. This process can be lengthy and costly. For retirement accounts, probate may also affect the tax treatment for heirs. We strongly recommend keeping your beneficiary designations up to date.",
      },
      {
        id: 'q-ben-004',
        text: 'Does my beneficiary designation override my will?',
        answer: "Yes — beneficiary designations on retirement accounts (IRAs, SEP-IRAs) and investment accounts override your will. The assets pass directly to the named beneficiary outside of probate, regardless of what your will says. It's important to keep both your will and beneficiary designations aligned, especially after life changes like marriage or divorce.",
      },
    ],
  },

  {
    id: 't-tax-docs',
    label: 'Tax documents',
    pages: ['account'],
    priority: 1,
    questions: [
      {
        id: 'q-tax-001',
        text: 'When will my 1099 form be available?',
        answer: "Tax forms are typically available by mid-February for the prior tax year. Consolidated 1099 forms (covering dividends, interest, and capital gains) are mailed and posted online by February 15. Roth and Traditional IRA contribution records (Form 5498) are available by May 31. You'll receive an email notification when your forms are ready.",
      },
      {
        id: 'q-tax-002',
        text: 'What tax forms does Bob\'s Mutual Funds provide?',
        answer: "We provide Form 1099-DIV for dividend distributions, Form 1099-B for sale proceeds and cost basis, Form 1099-R for retirement account distributions (including RMDs), Form 5498 showing IRA contributions, and Form 1099-INT for interest income. All forms are available on the Account page under 'Tax Documents.'",
      },
      {
        id: 'q-tax-003',
        text: 'How do I access my tax documents online?',
        answer: "Go to the Account page and select 'Tax Documents.' You can view and download all available forms by tax year, going back up to 7 years. Forms are available as PDFs. If you need a corrected form or a paper copy, please call our support line and we'll assist you.",
      },
      {
        id: 'q-tax-004',
        text: 'Why didn\'t I receive a 1099 this year?',
        answer: "You may not receive a 1099 if your account earned less than $10 in dividends or interest, had no reportable transactions, or if you only hold tax-deferred accounts (like a Traditional IRA or SEP-IRA) where distributions are reported on Form 1099-R instead. If you expected a form and haven't received it, check the Account page or contact us — we'll investigate.",
      },
    ],
  },

  {
    id: 't-security',
    label: 'Security settings',
    pages: ['account'],
    priority: 2,
    questions: [
      {
        id: 'q-sec-001',
        text: 'How do I enable two-factor authentication?',
        answer: "On the Account page, go to 'Security Settings' and select 'Two-Factor Authentication.' You can choose to receive a verification code via SMS or an authenticator app. Once enabled, you'll be prompted for a code every time you log in from a new device. We strongly recommend enabling 2FA for account security.",
      },
      {
        id: 'q-sec-002',
        text: 'How do I reset my password?',
        answer: "On the login page, click 'Forgot Password' and enter your email address. You'll receive a password reset link valid for 15 minutes. Your new password must be at least 12 characters and include a mix of letters, numbers, and symbols. If you're locked out, call our support line for identity verification assistance.",
      },
      {
        id: 'q-sec-003',
        text: 'How can I see my recent login activity?',
        answer: "On the Account page under 'Security Settings,' select 'Login Activity' to see a list of recent logins including date, time, device type, and approximate location. If you see activity you don't recognize, change your password immediately and contact us to flag the account for review.",
      },
      {
        id: 'q-sec-004',
        text: 'What should I do if I suspect unauthorized access?',
        answer: "Call our security line immediately — do not use chat for this. Our security team can place a temporary hold on your account, reverse unauthorized transactions if caught quickly, and investigate the breach. In the meantime, change your password from a trusted device and do not share your credentials with anyone, including us.",
      },
    ],
  },

  {
    id: 't-callback',
    label: 'Schedule a callback',
    pages: ['home'],
    priority: 1,
    questions: [
      {
        id: 'q-cb-001',
        text: 'When are agents available for callbacks?',
        answer: "Our agents are available Monday through Friday, 8:00 AM to 7:30 PM Eastern Time. Callbacks requested outside of those hours will be scheduled for the next available business day. We'll confirm your preferred time and call you back within a 30-minute window of the scheduled time.",
      },
      {
        id: 'q-cb-002',
        text: 'What phone number will you call me on?',
        answer: "We'll call the phone number on file for your account by default. During scheduling, you can confirm that number or provide a different one for the callback. The number we'll use for this callback will be shown on your confirmation. You can update your phone number permanently on the Account page.",
      },
      {
        id: 'q-cb-003',
        text: 'Can I request a specific topic for my callback?',
        answer: "Yes — when scheduling a callback, you can describe the topic you'd like to discuss. This helps us route your call to the right specialist and ensures the agent is prepared before calling. Common topics include RMDs, account transfers, beneficiary changes, and SEP-IRA contributions.",
      },
      {
        id: 'q-cb-004',
        text: 'How will I know my callback is confirmed?',
        answer: "Once a callback is scheduled, you'll see a confirmation in this chat with the date, time, and phone number. You'll also receive a confirmation email to the address on file. If you need to reschedule or cancel, you can do so by calling our main support line at least one hour before the scheduled time.",
      },
    ],
  },

  {
    id: 't-open-account',
    label: 'Open a new account',
    pages: ['home'],
    priority: 2,
    questions: [
      {
        id: 'q-open-001',
        text: 'What types of accounts can I open?',
        answer: "Bob's Mutual Funds offers Roth IRAs, Traditional IRAs, SEP-IRAs (for self-employed individuals), and individual taxable brokerage accounts. Joint taxable accounts are also available. You can open multiple account types to optimize your tax situation. If you're unsure which is right for you, schedule a callback with an advisor.",
      },
      {
        id: 'q-open-002',
        text: 'Is there a minimum to open an account?',
        answer: "There is no minimum balance required to open an IRA or taxable account at Bob's Mutual Funds. However, most BobsFunds mutual funds have a $1,000 minimum initial investment. Once your account is open, you can begin investing in any fund that meets your initial investment threshold.",
      },
      {
        id: 'q-open-003',
        text: 'How long does it take to open a new account?',
        answer: "Opening a new account online typically takes about 10 minutes. You'll need your Social Security Number, a government-issued ID, and your bank account information for initial funding. Accounts are usually approved and funded within 1–3 business days after submission.",
      },
      {
        id: 'q-open-004',
        text: 'Can I open a joint account?',
        answer: "Yes — joint taxable accounts are available for two account holders who share ownership of the assets. IRAs, however, cannot be joint accounts — they must be held individually. To open a joint account, both holders will need to provide their personal information and agree to the account terms.",
      },
    ],
  },

  {
    id: 't-fund-perf',
    label: 'Fund performance',
    pages: ['portfolio', 'home'],
    priority: 1,
    questions: [
      {
        id: 'q-perf-001',
        text: 'What is BobsFunds 500 Index\'s 1-year return?',
        answer: "BobsFunds 500 Index (BF500) returned +24.1% over the past year, with a 3-year annualized return of +9.8% and a 5-year annualized return of +13.2%. Its expense ratio is just 0.03%, making it one of the most cost-efficient funds we offer. It tracks a broad index of 500 large U.S. companies.",
      },
      {
        id: 'q-perf-002',
        text: 'Which BobsFunds fund has the highest 1-year return?',
        answer: "BobsFunds Growth (BFGR) had the highest 1-year return at +31.4%, followed by BobsFunds 500 Index at +24.1% and BobsFunds ESG Leaders at +22.7%. BobsFunds Growth focuses on U.S. growth companies and has an expense ratio of 0.25%. Past performance is not a guarantee of future results.",
      },
      {
        id: 'q-perf-003',
        text: 'How did BobsFunds Bond Income perform last year?',
        answer: "BobsFunds Bond Income (BFBI) returned +4.2% over the past year, with a 3-year annualized return of +2.1% and a 5-year return of +3.8%. Its expense ratio is 0.10%. As a bond fund, it is designed for income and stability rather than growth, and is less volatile than equity funds.",
      },
      {
        id: 'q-perf-004',
        text: 'What is BobsFunds ESG Leaders\' expense ratio?',
        answer: "BobsFunds ESG Leaders (BFESG) has an expense ratio of 0.18% per year. Over the past year it returned +22.7%, with a 3-year annualized return of +9.3% and 5-year return of +12.8%. It invests in companies with strong environmental, social, and governance scores while seeking competitive market returns.",
      },
    ],
  },

  {
    id: 't-compare-funds',
    label: 'Compare BobsFunds funds',
    pages: ['research'],
    priority: 1,
    questions: [
      {
        id: 'q-cmp-001',
        text: 'What is the difference between BF500 and BobsFunds Growth?',
        answer: "BF500 tracks a broad market index of 500 large U.S. companies and has a very low expense ratio of 0.03%. BobsFunds Growth actively focuses on companies with above-average earnings growth potential and charges 0.25%. BF500 returned +24.1% over the past year; Growth returned +31.4% — though active funds carry more variability year to year.",
      },
      {
        id: 'q-cmp-002',
        text: 'Which fund is best for income vs. growth?',
        answer: "For income, BobsFunds Bond Income (BFBI) and BobsFunds Short-Term Treasury (BFST) are designed to generate regular interest income with lower volatility. For growth, BobsFunds 500 Index (BF500) and BobsFunds Growth (BFGR) are equity-focused. Many investors hold both for a balanced portfolio. An advisor can help tailor the mix to your goals.",
      },
      {
        id: 'q-cmp-003',
        text: 'Which BobsFunds fund has the lowest expense ratio?',
        answer: "BobsFunds 500 Index (BF500) has the lowest expense ratio at 0.03% per year. BobsFunds Short-Term Treasury is next at 0.08%, followed by BobsFunds Bond Income at 0.10%. BobsFunds ESG Leaders is 0.18%, International is 0.20%, and Growth is 0.25%. Lower fees mean more of your return stays in your account.",
      },
      {
        id: 'q-cmp-004',
        text: 'Which fund offers international exposure?',
        answer: "BobsFunds International (BFIN) invests in developed international markets outside the U.S. It returned +15.3% last year with a 5-year annualized return of +9.1% and an expense ratio of 0.20%. Adding international exposure can reduce portfolio concentration risk in U.S. markets. Many financial planning guidelines suggest 20–40% international allocation.",
      },
    ],
  },

  {
    id: 't-expense-ratios',
    label: 'Expense ratios explained',
    pages: ['research'],
    priority: 2,
    questions: [
      {
        id: 'q-er-001',
        text: 'What is an expense ratio and why does it matter?',
        answer: "An expense ratio is the annual fee a mutual fund charges, expressed as a percentage of your investment. A 0.10% expense ratio means you pay $10 per year for every $10,000 invested. Over decades, even small differences in fees compound significantly — a 0.25% fund vs. a 0.03% fund could cost you tens of thousands of dollars over 30 years.",
      },
      {
        id: 'q-er-002',
        text: 'What are the expense ratios for all BobsFunds funds?',
        answer: "BobsFunds 500 Index: 0.03% | BobsFunds Short-Term Treasury: 0.08% | BobsFunds Bond Income: 0.10% | BobsFunds ESG Leaders: 0.18% | BobsFunds International: 0.20% | BobsFunds Growth: 0.25%. All expense ratios are deducted automatically from fund assets — you never receive a separate bill for them.",
      },
      {
        id: 'q-er-003',
        text: 'Does Bob\'s Mutual Funds charge any other fees?',
        answer: "There are no account maintenance fees, inactivity fees, or trading commissions for buying or selling BobsFunds mutual funds. The only ongoing cost is each fund's expense ratio. Wire transfers and outgoing ACAT transfers may carry a small processing fee — see the full fee schedule on the Account page under 'Fee Information.'",
      },
      {
        id: 'q-er-004',
        text: 'How much do fees cost me over 10 years?',
        answer: "On a $50,000 investment growing at 8% annually: a fund with a 0.03% expense ratio would cost about $170 in fees over 10 years, while a 0.25% fund would cost about $1,400. The difference ($1,230) stays invested and compounds in the lower-cost fund. This is why minimizing expense ratios is one of the most reliable ways to improve long-term returns.",
      },
    ],
  },

  {
    id: 't-index-vs-active',
    label: 'Index vs. active funds',
    pages: ['research'],
    priority: 2,
    questions: [
      {
        id: 'q-idx-001',
        text: 'What is the difference between index and active funds?',
        answer: "Index funds track a market benchmark (like the S&P 500) by holding the same securities in the same proportions. They are passively managed and have very low fees. Active funds employ portfolio managers who try to beat the market through stock selection and timing. Active management typically charges higher fees and most active funds underperform their benchmarks over long periods.",
      },
      {
        id: 'q-idx-002',
        text: 'Which BobsFunds funds are index funds?',
        answer: "BobsFunds 500 Index (BF500) is an index fund tracking a broad U.S. large-cap benchmark, with a 0.03% expense ratio. BobsFunds Short-Term Treasury (BFST) also follows an index of short-duration U.S. government bonds. The other BobsFunds funds — Growth, Bond Income, International, and ESG Leaders — are actively managed.",
      },
      {
        id: 'q-idx-003',
        text: 'Do index funds always outperform active funds?',
        answer: "Over long periods (10+ years), data consistently shows that most active funds underperform their comparable index funds, primarily due to higher fees and the difficulty of consistently picking winning stocks. However, in the short term, active funds can and do outperform — BobsFunds Growth returned +31.4% last year vs. BF500's +24.1%. Your time horizon matters.",
      },
      {
        id: 'q-idx-004',
        text: 'Should I invest in index or active funds?',
        answer: "Many investors use both: a core position in low-cost index funds for broad market exposure, plus a smaller allocation to active funds or thematic funds (like ESG or international) for targeted exposure. There's no universal answer — it depends on your goals, time horizon, and risk tolerance. Our advisors can walk you through a personalized allocation.",
      },
    ],
  },

  {
    id: 't-historical-returns',
    label: 'Historical returns',
    pages: ['research'],
    priority: 2,
    questions: [
      {
        id: 'q-hist-001',
        text: 'What is BobsFunds 500 Index\'s 5-year return?',
        answer: "BobsFunds 500 Index (BF500) has a 5-year annualized return of +13.2% and a 3-year annualized return of +9.8%. Its 1-year return is +24.1%. These figures are as of the most recent quarter-end. Past performance does not guarantee future results, but BF500's long-term track record reflects broad U.S. market performance.",
      },
      {
        id: 'q-hist-002',
        text: 'How has BobsFunds ESG Leaders performed long-term?',
        answer: "BobsFunds ESG Leaders (BFESG) has a 5-year annualized return of +12.8% and a 3-year return of +9.3%, closely tracking its non-ESG peers. Its 1-year return of +22.7% demonstrates that ESG screening has not come at a performance cost in recent years. The fund's expense ratio is 0.18%.",
      },
      {
        id: 'q-hist-003',
        text: 'What were BobsFunds International\'s returns?',
        answer: "BobsFunds International (BFIN) returned +15.3% over the past year, +6.4% annualized over 3 years, and +9.1% annualized over 5 years. International funds can lag U.S. funds in strong domestic markets but provide diversification and potentially stronger performance when the U.S. dollar weakens. Its expense ratio is 0.20%.",
      },
      {
        id: 'q-hist-004',
        text: 'Where can I see full historical performance data?',
        answer: "Full historical performance data for all BobsFunds funds — including annual returns going back 10+ years, quarterly returns, and benchmark comparisons — is available on the Fund Research page. You can also download a fund's prospectus from the Research page for detailed performance disclosure. Each fund's performance is updated at each month-end.",
      },
    ],
  },

  {
    id: 't-auto-invest',
    label: 'Auto-invest setup',
    pages: ['account', 'home'],
    priority: 2,
    questions: [
      {
        id: 'q-ai-001',
        text: 'How do I set up automatic monthly contributions?',
        answer: "On the Account page, select 'Automatic Investments' and choose the account and fund you'd like to contribute to. You'll specify the contribution amount, frequency (monthly, bi-weekly, etc.), and the bank account to pull from. Contributions as low as $50 per period are allowed. The setup takes effect within 1–2 business days.",
      },
      {
        id: 'q-ai-002',
        text: 'Can I change or cancel my automatic investment?',
        answer: "Yes — you can modify or pause automatic investments at any time on the Account page under 'Automatic Investments.' Changes made before 3:00 PM Eastern on a business day will take effect before the next scheduled contribution. To skip one contribution without canceling, use the 'Skip Next' option.",
      },
      {
        id: 'q-ai-003',
        text: 'What day does my auto-investment execute?',
        answer: "You choose the day of the month when setting up your automatic investment — any day from 1 to 28 is available. If your chosen date falls on a weekend or holiday, the contribution will process on the next business day. The funds will be available in your account for investment 1–3 business days after the ACH transfer initiates.",
      },
      {
        id: 'q-ai-004',
        text: 'Does auto-invest count toward my IRA contribution limit?',
        answer: "Yes — automatic contributions to an IRA count toward your annual contribution limit. For 2025, the limit is $7,000 per year ($8,000 if you're 50 or older), across all your IRAs combined. Bob's Mutual Funds will not automatically stop contributions when you reach the limit — you are responsible for monitoring your annual total.",
      },
    ],
  },

  // ── Account-specific topics ───────────────────────────────────────────────

  {
    id: 't-ira-limits',
    label: 'IRA contribution limits',
    pages: ['home', 'account'],
    accountTypes: ['Roth IRA', 'Traditional IRA'],
    priority: 1,
    questions: [
      {
        id: 'q-ira-001',
        text: 'What are the 2025 Roth IRA contribution limits?',
        answer: "For 2025, you can contribute up to $7,000 to a Roth IRA, or $8,000 if you're age 50 or older (the $1,000 catch-up contribution). This limit is shared across all your IRAs combined — Roth and Traditional. Income limits apply: single filers earning over $161,000 and joint filers over $240,000 face phase-outs.",
      },
      {
        id: 'q-ira-002',
        text: 'What are the 2025 Traditional IRA contribution limits?',
        answer: "The 2025 Traditional IRA contribution limit is $7,000 per year, or $8,000 if you're age 50 or older. Unlike a Roth IRA, there are no income limits on contributing to a Traditional IRA, but the deductibility of your contribution depends on your income and whether you (or your spouse) have access to a workplace retirement plan.",
      },
      {
        id: 'q-ira-003',
        text: 'Can I contribute to both a Roth and Traditional IRA?',
        answer: "Yes, but your combined contributions across all IRAs cannot exceed the annual limit ($7,000 or $8,000 if 50+). For example, you could put $4,000 in a Roth IRA and $3,000 in a Traditional IRA in the same year. Many investors split contributions based on their expected tax rate now vs. in retirement.",
      },
      {
        id: 'q-ira-004',
        text: 'What happens if I over-contribute to my IRA?',
        answer: "An excess IRA contribution is subject to a 6% excise tax for each year it remains in the account. To fix it, you must withdraw the excess plus any earnings before the tax filing deadline (including extensions). Contact us as soon as possible if you've over-contributed — we can help you process a corrective withdrawal.",
      },
    ],
  },

  {
    id: 't-roth-strategies',
    label: 'Roth IRA strategies',
    pages: ['research', 'home'],
    accountTypes: ['Roth IRA'],
    priority: 2,
    questions: [
      {
        id: 'q-roth-001',
        text: 'What is the main advantage of a Roth IRA?',
        answer: "Roth IRA contributions are made with after-tax dollars, so qualified withdrawals in retirement are completely tax-free — including all the growth. There are also no required minimum distributions (RMDs) during your lifetime, giving you more flexibility to let assets grow or pass them to heirs. The younger you are, the more powerful the tax-free compounding becomes.",
      },
      {
        id: 'q-roth-002',
        text: 'Can I withdraw Roth IRA contributions penalty-free?',
        answer: "Yes — your Roth IRA contributions (not earnings) can be withdrawn at any time, at any age, without taxes or penalties. This is because you already paid taxes on those dollars. However, to withdraw earnings tax-free and penalty-free, you must be at least 59½ and the account must have been open for at least 5 years.",
      },
      {
        id: 'q-roth-003',
        text: 'What is the Roth IRA 5-year rule?',
        answer: "The 5-year rule requires that your Roth IRA be open for at least 5 years before you can withdraw earnings tax-free, even after age 59½. The clock starts January 1 of the year you made your first Roth IRA contribution. Contributions can always be withdrawn penalty-free — the 5-year rule only applies to the earnings portion.",
      },
      {
        id: 'q-roth-004',
        text: 'Should I convert my Traditional IRA to a Roth IRA?',
        answer: "A Roth conversion can be smart if you expect to be in a higher tax bracket in retirement than you are now, or if you want to avoid future RMDs. The amount converted is taxable as ordinary income in the year of conversion. This is a nuanced decision — we recommend speaking with a financial advisor or tax professional before converting.",
      },
    ],
  },

  {
    id: 't-rmd',
    label: 'Required minimum distributions',
    pages: ['portfolio', 'account', 'home'],
    accountTypes: ['Traditional IRA'],
    priority: 1,
    questions: [
      {
        id: 'q-rmd-001',
        text: 'At what age must I start taking RMDs?',
        answer: "Under the SECURE 2.0 Act, the required beginning date for RMDs is April 1 of the year following the year you turn 73. For example, if you turn 73 in 2025, your first RMD must be taken by April 1, 2026. If you delay your first RMD to the following year, you must also take your second RMD by December 31 of that same year.",
      },
      {
        id: 'q-rmd-002',
        text: 'How is my RMD amount calculated?',
        answer: "Your RMD is calculated by dividing your account balance as of December 31 of the prior year by a life expectancy factor from the IRS Uniform Lifetime Table (or the Joint and Last Survivor Table if your spouse is more than 10 years younger). Bob's Mutual Funds calculates this for you automatically — the amount is shown on your Account page each January.",
      },
      {
        id: 'q-rmd-003',
        text: 'What is the penalty for missing an RMD?',
        answer: "If you miss an RMD or take less than the required amount, the IRS imposes a 25% excise tax on the shortfall (reduced to 10% if corrected within 2 years). This penalty was reduced from 50% under SECURE 2.0. You can request a penalty waiver by filing IRS Form 5329 with a reasonable cause explanation.",
      },
      {
        id: 'q-rmd-004',
        text: 'Can I reinvest my RMD in a taxable account?',
        answer: "Yes — once you've withdrawn your RMD from your Traditional IRA (and paid the income taxes), you are free to invest those funds anywhere, including a taxable brokerage account, a Roth IRA (if you're eligible), savings, or anywhere else. You cannot reinvest an RMD back into the same IRA it came from.",
      },
    ],
  },

  {
    id: 't-rmd-setup',
    label: 'RMD distribution setup',
    pages: ['account'],
    accountTypes: ['Traditional IRA'],
    priority: 1,
    questions: [
      {
        id: 'q-rmdset-001',
        text: 'How do I set up automatic RMD distributions?',
        answer: "On the Account page, under 'Required Minimum Distributions,' you can enroll in our automatic RMD service. We'll calculate your annual RMD and distribute it on the schedule you choose — monthly, quarterly, or as a single annual payment. Automatic RMDs help ensure you never miss a distribution deadline.",
      },
      {
        id: 'q-rmdset-002',
        text: 'What frequency options are available for RMD payments?',
        answer: "You can receive your RMD as a single annual lump sum, quarterly payments, or monthly installments. Many clients prefer monthly payments for a steady income stream. The total amount distributed over the year must meet or exceed your calculated RMD — you can always take more than the minimum if needed.",
      },
      {
        id: 'q-rmdset-003',
        text: 'Where will my RMD be deposited?',
        answer: "Your RMD can be deposited directly to a linked bank account via ACH transfer, moved to your taxable brokerage account here at Bob's Mutual Funds, or sent as a check. Your preference can be set on the Account page under 'RMD Delivery Method.' Direct deposit is the fastest option, typically arriving within 1–2 business days.",
      },
      {
        id: 'q-rmdset-004',
        text: 'How do I update tax withholding on my RMD?',
        answer: "Federal and state income tax can be withheld from your RMD distributions. Default withholding is 10% federal; you can increase, decrease, or waive withholding on the Account page under 'RMD Tax Withholding.' Bob's Mutual Funds will send you a Form 1099-R each year showing the gross distribution and taxes withheld.",
      },
    ],
  },

  {
    id: 't-bond-funds',
    label: 'Bond fund options',
    pages: ['research', 'portfolio'],
    accountTypes: ['Traditional IRA', 'Taxable Account', 'SEP-IRA'],
    priority: 2,
    questions: [
      {
        id: 'q-bond-001',
        text: 'What does BobsFunds Bond Income hold?',
        answer: "BobsFunds Bond Income (BFBI) invests primarily in investment-grade U.S. corporate bonds and U.S. government bonds with intermediate maturities (typically 5–10 years). It aims to provide regular income with moderate interest rate sensitivity. Its 1-year return was +4.2% and the expense ratio is 0.10%.",
      },
      {
        id: 'q-bond-002',
        text: 'What does BobsFunds Short-Term Treasury hold?',
        answer: "BobsFunds Short-Term Treasury (BFST) invests exclusively in U.S. Treasury securities with maturities of 1–3 years. It is designed for capital preservation and income with minimal credit risk and low interest rate sensitivity. Its 1-year return was +5.1% and its expense ratio is a very low 0.08%.",
      },
      {
        id: 'q-bond-003',
        text: 'How does rising interest rates affect bond funds?',
        answer: "Bond prices move inversely to interest rates — when rates rise, existing bond prices fall, causing bond fund values to decline short-term. Funds with shorter average maturities (like BFST) are less sensitive to rate changes than longer-duration funds (like BFBI). Over time, rising rates also mean higher income as bonds mature and are replaced with higher-yielding ones.",
      },
      {
        id: 'q-bond-004',
        text: 'Should I hold bond funds in my IRA or taxable account?',
        answer: "Bond funds generate ordinary income (interest), which is taxed at higher rates than stock dividends or capital gains. Holding bond funds inside a tax-deferred account (IRA or SEP-IRA) shields that income from current taxes. Equity index funds, which tend to be more tax-efficient, are generally better suited for taxable accounts. This strategy is called 'asset location.'",
      },
    ],
  },

  {
    id: 't-tax-efficient',
    label: 'Tax-efficient investing',
    pages: ['research', 'home'],
    accountTypes: ['Traditional IRA', 'Taxable Account', 'SEP-IRA'],
    priority: 2,
    questions: [
      {
        id: 'q-taxeff-001',
        text: 'Which BobsFunds funds are most tax-efficient?',
        answer: "BobsFunds 500 Index (BF500) is the most tax-efficient — it has very low turnover, meaning few taxable capital gains distributions. BobsFunds Short-Term Treasury (BFST) generates interest income taxed as ordinary income, making it better suited for tax-advantaged accounts. Growth and Bond Income are less tax-efficient due to higher turnover and income distributions.",
      },
      {
        id: 'q-taxeff-002',
        text: 'What is the benefit of holding investments in an IRA?',
        answer: "In a Traditional IRA or SEP-IRA, your investments grow tax-deferred — you pay no taxes on dividends, interest, or capital gains until you withdraw in retirement. In a Roth IRA, growth is tax-free entirely. By contrast, a taxable account triggers taxes each year on dividends and capital gains distributions, even if you reinvest them.",
      },
      {
        id: 'q-taxeff-003',
        text: 'What is tax-loss harvesting?',
        answer: "Tax-loss harvesting means selling an investment that has declined in value to realize a loss, then using that loss to offset capital gains elsewhere in your taxable account. The freed-up cash is typically reinvested in a similar (but not identical) fund to maintain your market exposure. This strategy can reduce your current year tax bill. It only applies to taxable accounts — losses in IRAs cannot be harvested.",
      },
      {
        id: 'q-taxeff-004',
        text: 'How are dividends from BobsFunds funds taxed?',
        answer: "Qualified dividends (from stocks held for more than 60 days) are taxed at the lower long-term capital gains rate — 0%, 15%, or 20% depending on your income. Ordinary dividends and bond interest income are taxed at your regular income tax rate. All dividends in IRAs or SEP-IRAs are tax-deferred and not taxed until withdrawal.",
      },
    ],
  },

  {
    id: 't-sep-limits',
    label: 'SEP-IRA contribution limits',
    pages: ['account', 'home', 'portfolio'],
    accountTypes: ['SEP-IRA'],
    priority: 1,
    questions: [
      {
        id: 'q-sep-001',
        text: 'What is the 2025 SEP-IRA contribution limit?',
        answer: "For 2025, you can contribute up to the lesser of $70,000 or 25% of your net self-employment compensation to a SEP-IRA. Net self-employment compensation is your business net profit minus the deductible portion of self-employment taxes. This limit is substantially higher than IRA limits, making SEP-IRAs a powerful savings tool for self-employed individuals.",
      },
      {
        id: 'q-sep-002',
        text: 'How is my SEP-IRA contribution limit calculated exactly?',
        answer: "Your contribution limit equals 20% of your net self-employment income (after deducting self-employment taxes). For example, if your Schedule C net profit is $150,000, your net self-employment income is approximately $139,000 after the SE tax deduction, and your SEP-IRA limit would be roughly $27,800. We recommend having your accountant compute the exact figure.",
      },
      {
        id: 'q-sep-003',
        text: 'When is the SEP-IRA contribution deadline for 2025?',
        answer: "You can make your 2025 SEP-IRA contribution up to the due date of your federal income tax return, including extensions. For most self-employed individuals, that is October 15, 2026 (with an extension). You don't need to set up or fund the account before December 31 — the extended deadline gives you maximum flexibility for tax planning.",
      },
      {
        id: 'q-sep-004',
        text: 'Can I contribute to both a SEP-IRA and a Roth IRA?',
        answer: "Yes — you can contribute to both a SEP-IRA and a Roth IRA in the same year, provided your income meets Roth IRA eligibility requirements. The SEP-IRA limit ($70,000 or 25% of compensation) and the Roth IRA limit ($7,000/$8,000) are entirely separate. Many self-employed individuals maximize both for both immediate tax deductions and future tax-free income.",
      },
    ],
  },

  {
    id: 't-sep-vs-solo',
    label: 'SEP-IRA vs. solo 401(k)',
    pages: ['research'],
    accountTypes: ['SEP-IRA'],
    priority: 2,
    questions: [
      {
        id: 'q-sepvs-001',
        text: 'What is the main difference between a SEP-IRA and solo 401(k)?',
        answer: "A SEP-IRA is simpler to administer — no annual IRS filing is required and it can cover employees if you have them. A solo 401(k) is only for self-employed individuals with no employees (other than a spouse) but allows higher contributions at lower income levels because it includes both employee and employer contributions. A solo 401(k) also allows Roth contributions; a SEP-IRA does not.",
      },
      {
        id: 'q-sepvs-002',
        text: 'Can a solo 401(k) allow higher contributions than a SEP-IRA?',
        answer: "At lower income levels, yes. A solo 401(k) allows up to $23,500 in employee deferrals (plus $7,500 catch-up if 50+) plus employer contributions up to 25% of compensation. At low income levels where 25% of compensation is small, the employee deferral portion makes the total solo 401(k) limit much higher than a SEP-IRA. At higher incomes both converge near the $70,000 cap.",
      },
      {
        id: 'q-sepvs-003',
        text: 'Does a solo 401(k) allow Roth contributions?',
        answer: "Yes — a solo 401(k) can include a Roth component, meaning you can designate some or all of your employee deferrals as Roth (after-tax). This allows tax-free growth and withdrawals in retirement, similar to a Roth IRA but without the income limits. A SEP-IRA does not have a Roth option — all contributions are pre-tax.",
      },
      {
        id: 'q-sepvs-004',
        text: 'Are there administrative differences between the two?',
        answer: "A SEP-IRA has minimal administration — no IRS Form 5500 filing, easy to set up, and straightforward rules. A solo 401(k) requires an IRS-approved plan document and, once plan assets exceed $250,000, annual filing of Form 5500-EZ. If you expect to hire employees, only a SEP-IRA would be appropriate — solo 401(k) plans cannot cover non-owner employees.",
      },
    ],
  },

  {
    id: 't-rebalancing',
    label: 'Rebalancing strategies',
    pages: ['portfolio', 'research'],
    accountTypes: ['SEP-IRA', 'Traditional IRA', 'Taxable Account'],
    priority: 2,
    questions: [
      {
        id: 'q-reb-001',
        text: 'How do I rebalance my portfolio?',
        answer: "To rebalance, compare your current allocation to your target (e.g., 70% stocks / 30% bonds). If stocks have grown to 80%, you would sell some equity funds and buy bond funds to restore the target. On the Portfolio page, the allocation chart shows your current mix. Rebalancing within an IRA or SEP-IRA has no immediate tax consequences.",
      },
      {
        id: 'q-reb-002',
        text: 'How often should I rebalance?',
        answer: "Most financial planning guidelines suggest rebalancing annually or whenever your allocation drifts more than 5 percentage points from your target. Rebalancing too frequently can generate unnecessary taxes (in taxable accounts) and transaction costs. Many investors rebalance once per year at a fixed date, or use new contributions to gradually bring the portfolio back in line.",
      },
      {
        id: 'q-reb-003',
        text: 'Are there tax consequences when rebalancing?',
        answer: "Inside a Traditional IRA or SEP-IRA, rebalancing is tax-free — you can buy and sell without triggering capital gains. In a taxable account, selling appreciated holdings generates capital gains taxes. To minimize taxes, consider rebalancing through new contributions (directing them to underweight funds) or rebalancing primarily within your tax-advantaged accounts.",
      },
      {
        id: 'q-reb-004',
        text: 'What target allocation is right for me?',
        answer: "A common starting point is to subtract your age from 110 to find your stock percentage (e.g., age 45 → 65% stocks, 35% bonds). However, the right allocation depends on your risk tolerance, time horizon, income needs, and other factors. For a personalized recommendation, schedule a callback with one of our advisors — this is exactly what they specialize in.",
      },
    ],
  },

  {
    id: 't-esg',
    label: 'ESG fund options',
    pages: ['research', 'home'],
    accountTypes: ['Roth IRA', 'Taxable Account'],
    priority: 2,
    questions: [
      {
        id: 'q-esg-001',
        text: 'What does ESG stand for?',
        answer: "ESG stands for Environmental, Social, and Governance. ESG funds screen companies based on their environmental impact, treatment of employees and communities, and quality of corporate governance. BobsFunds ESG Leaders invests in companies that score highly across all three dimensions while still seeking competitive market returns.",
      },
      {
        id: 'q-esg-002',
        text: 'What is BobsFunds ESG Leaders\' 1-year return?',
        answer: "BobsFunds ESG Leaders (BFESG) returned +22.7% over the past year, compared to BF500's +24.1%. Its 3-year annualized return is +9.3% and 5-year is +12.8%. The expense ratio is 0.18%. ESG screening has not materially impacted performance in recent years — the fund's long-term returns are competitive with broad market index funds.",
      },
      {
        id: 'q-esg-003',
        text: 'What industries does BobsFunds ESG Leaders exclude?',
        answer: "BobsFunds ESG Leaders excludes or underweights companies involved in fossil fuel extraction, weapons manufacturing, tobacco, and those with poor labor or governance records. It focuses on companies with leading ESG scores in their respective industries. The fund holds across most sectors but with tilts toward technology, healthcare, and renewable energy.",
      },
      {
        id: 'q-esg-004',
        text: 'How does BobsFunds ESG Leaders compare to BF500?',
        answer: "BobsFunds ESG Leaders (0.18% ER, +22.7% 1yr) is more concentrated than BF500 (0.03% ER, +24.1% 1yr) because it screens out companies that fail ESG criteria. BF500 is cheaper and more broadly diversified; ESG Leaders costs more but aligns with values-based investing. Both are reasonable choices — many investors hold both for different goals.",
      },
    ],
  },

  {
    id: 't-growth-vs-index',
    label: 'Growth vs. index funds',
    pages: ['research'],
    accountTypes: ['Roth IRA', 'Taxable Account'],
    priority: 2,
    questions: [
      {
        id: 'q-gvi-001',
        text: 'What types of stocks does BobsFunds Growth hold?',
        answer: "BobsFunds Growth (BFGR) focuses on U.S. companies with above-average earnings growth potential — typically technology, consumer discretionary, and healthcare companies. It is more concentrated than BF500 and tends to be more volatile. Its 1-year return of +31.4% outpaced the index, though this can reverse in market downturns.",
      },
      {
        id: 'q-gvi-002',
        text: 'Which fund has higher fees: BobsFunds Growth or BF500?',
        answer: "BobsFunds Growth charges 0.25% per year, while BF500 charges only 0.03%. Over 20 years on a $50,000 investment growing at 9%, the fee difference compounds to roughly $15,000 in lost returns. Growth funds need to consistently outperform to justify the higher fee — which is challenging over long periods.",
      },
      {
        id: 'q-gvi-003',
        text: 'Has BobsFunds Growth outperformed the market index?',
        answer: "Over the past year, BobsFunds Growth returned +31.4% versus BF500's +24.1% — a 7.3 percentage point advantage. Over 5 years, Growth returned +18.7% annualized vs. BF500's +13.2%, showing consistent outperformance. However, growth stocks can underperform significantly during market corrections or rising-rate environments.",
      },
      {
        id: 'q-gvi-004',
        text: 'Is BobsFunds Growth appropriate for a Roth IRA?',
        answer: "A Roth IRA's tax-free growth makes it a natural home for higher-growth investments like BobsFunds Growth — the higher potential returns are never taxed. The risk is that growth stocks are more volatile, which is more tolerable in a retirement account with a long horizon. If you are decades from retirement, the Roth IRA + Growth combination can be powerful.",
      },
    ],
  },

  {
    id: 't-fixed-income',
    label: 'Fixed income allocation',
    pages: ['research', 'portfolio'],
    priority: 2,
    questions: [
      {
        id: 'q-fi-001',
        text: 'What percentage of my portfolio should be in bonds?',
        answer: "A common rule of thumb is to hold a percentage of bonds equal to your age (e.g., 60 years old → 60% bonds, 40% stocks), though many modern advisors suggest a more aggressive equity tilt for longer retirements. Your allocation depends on your risk tolerance, income needs, and time horizon. Our advisors can build a personalized recommendation.",
      },
      {
        id: 'q-fi-002',
        text: 'What is the difference between BobsFunds Bond Income and Short-Term Treasury?',
        answer: "BobsFunds Bond Income (BFBI) holds intermediate-term corporate and government bonds, offering higher yield (+4.2% last year) with more interest rate sensitivity. BobsFunds Short-Term Treasury (BFST) holds only short-term U.S. Treasuries, offering lower yield (+5.1% last year) but much lower volatility and credit risk. BFST is closer to a cash equivalent; BFBI carries more market risk.",
      },
      {
        id: 'q-fi-003',
        text: 'Is BobsFunds Bond Income or Short-Term Treasury safer?',
        answer: "BobsFunds Short-Term Treasury is generally safer: it holds only U.S. government bonds (no default risk) with short maturities (low rate sensitivity). BobsFunds Bond Income holds corporate bonds, which carry credit risk, and intermediate maturities, which make it more sensitive to interest rate changes. In market stress scenarios, Short-Term Treasury tends to hold value better.",
      },
      {
        id: 'q-fi-004',
        text: 'Does BobsFunds Short-Term Treasury pay monthly income?',
        answer: "Yes — BobsFunds Short-Term Treasury distributes income monthly, reflecting the interest earned from its Treasury holdings. You can choose to receive these distributions as cash or have them automatically reinvested in additional shares via DRIP. The current yield reflects short-term Treasury rates, which have been elevated in recent years.",
      },
    ],
  },

  {
    id: 't-estate',
    label: 'Estate planning basics',
    pages: ['home'],
    accountTypes: ['Traditional IRA'],
    priority: 2,
    questions: [
      {
        id: 'q-estate-001',
        text: 'Why is beneficiary designation critical for my IRA?',
        answer: "Your IRA beneficiary designation controls who receives the account after you pass — and it overrides your will. If no beneficiary is named, the account passes through your estate, subject to probate, which can delay distribution for months and trigger accelerated taxes. Keeping your designation current (especially after marriage, divorce, or death of a prior beneficiary) is one of the most important estate planning steps.",
      },
      {
        id: 'q-estate-002',
        text: 'What happens to my Traditional IRA when I pass away?',
        answer: "Your Traditional IRA passes to your named beneficiary. A surviving spouse can roll the IRA into their own IRA and defer RMDs. Non-spouse beneficiaries generally must withdraw all funds within 10 years under the SECURE 2.0 rules (the 10-year rule). The withdrawals are taxable as ordinary income to the beneficiary in the year taken.",
      },
      {
        id: 'q-estate-003',
        text: 'Can I name a trust as my IRA beneficiary?',
        answer: "Yes, but it's complex. For a trust to qualify as a 'see-through' beneficiary and allow individual beneficiaries to use their own life expectancy rules, the trust must meet specific IRS requirements. An improperly drafted trust can accelerate tax obligations significantly. We strongly recommend working with an estate planning attorney if you want to use a trust as beneficiary.",
      },
      {
        id: 'q-estate-004',
        text: 'What is a stretch IRA and does it still exist?',
        answer: "The 'stretch IRA' allowed non-spouse beneficiaries to take distributions over their lifetime, 'stretching' the tax deferral. The SECURE Act (2019) eliminated this for most non-spouse beneficiaries, replacing it with a 10-year rule requiring full withdrawal within 10 years. Exceptions exist for spouses, minor children, disabled individuals, and beneficiaries not more than 10 years younger than the deceased.",
      },
    ],
  },

  {
    id: 't-self-employed',
    label: 'Self-employed retirement options',
    pages: ['home'],
    accountTypes: ['SEP-IRA'],
    priority: 1,
    questions: [
      {
        id: 'q-se-001',
        text: 'What retirement accounts are available for self-employed individuals?',
        answer: "Self-employed individuals can use a SEP-IRA (up to $70,000/year), a solo 401(k) (up to $70,000/year with employee deferrals), a SIMPLE IRA (up to $16,500/year, requires employees), and a Roth IRA ($7,000/year with income limits). Most self-employed individuals start with a SEP-IRA for its simplicity and high contribution limits.",
      },
      {
        id: 'q-se-002',
        text: 'What is the biggest advantage of a SEP-IRA for self-employed?',
        answer: "A SEP-IRA allows self-employed individuals to contribute up to $70,000 per year (vs. $7,000 for a regular IRA), with contributions that are fully tax-deductible. It's simple to set up and maintain — no annual IRS filings required unless you hire employees. The high limit and simplicity make it the most popular retirement vehicle for sole proprietors and freelancers.",
      },
      {
        id: 'q-se-003',
        text: 'Do I need to have employees to open a SEP-IRA?',
        answer: "No — a SEP-IRA can be opened by a self-employed individual with no employees. However, if you do have eligible employees, you must make contributions for them at the same percentage of compensation as you contribute for yourself. This employer-contribution requirement makes some business owners with employees prefer a solo 401(k) or SIMPLE IRA instead.",
      },
      {
        id: 'q-se-004',
        text: 'Can I open a SEP-IRA even if I have a day job?',
        answer: "Yes — if you have self-employment income (from freelancing, consulting, a side business, etc.), you can open a SEP-IRA regardless of whether you also participate in an employer's 401(k). The SEP-IRA limit is based only on your self-employment income, not your W-2 salary. This makes it a powerful supplement for people with both employment and self-employment income.",
      },
    ],
  },

  {
    id: 't-tax-deductions',
    label: 'Tax deduction strategies',
    pages: ['home', 'research'],
    accountTypes: ['SEP-IRA'],
    priority: 2,
    questions: [
      {
        id: 'q-taxded-001',
        text: 'Is my SEP-IRA contribution tax-deductible?',
        answer: "Yes — SEP-IRA contributions are fully tax-deductible as a business expense (reported on Schedule C or Schedule SE), regardless of whether you itemize deductions. For someone in the 24% federal bracket, a $20,000 SEP-IRA contribution saves approximately $4,800 in federal income tax. State tax savings may apply in addition.",
      },
      {
        id: 'q-taxded-002',
        text: 'Does a SEP-IRA contribution reduce self-employment taxes?',
        answer: "A SEP-IRA contribution reduces your adjusted gross income (AGI), which can affect other deductions, but it does not reduce your self-employment (SE) tax base directly — SE tax is calculated on net self-employment income before the SEP-IRA deduction. However, the income tax savings are still substantial, and the deductible portion of SE taxes reduces your AGI as well.",
      },
      {
        id: 'q-taxded-003',
        text: 'When should I make my SEP-IRA contribution for maximum benefit?',
        answer: "You have until your tax filing deadline (including extensions, up to October 15) to make your SEP-IRA contribution and have it count for the prior tax year. Many advisors recommend contributing as early as possible in the calendar year so funds have more time to grow. At minimum, contributing before April 15 ensures the deduction without needing an extension.",
      },
      {
        id: 'q-taxded-004',
        text: 'What records do I need for my SEP-IRA deduction?',
        answer: "Keep your Form 5498 (provided by Bob's Mutual Funds each May) which shows your SEP-IRA contributions for the year. Also retain your Schedule C (or applicable business income form) showing your net self-employment income, as that determines your contribution limit. Your tax preparer will use these to calculate and report the deduction on your return.",
      },
    ],
  },

  {
    id: 't-rollover',
    label: 'Rollover options',
    pages: ['home', 'research'],
    priority: 2,
    questions: [
      {
        id: 'q-roll-001',
        text: 'Can I roll over a 401(k) to Bob\'s Mutual Funds?',
        answer: "Yes — you can roll over a 401(k) or other employer-sponsored retirement plan into a Traditional IRA at Bob's Mutual Funds. A direct rollover (where the funds go directly from your old plan to your IRA) is the simplest method and avoids any withholding or penalties. Contact us to get a rollover contribution form and wiring instructions.",
      },
      {
        id: 'q-roll-002',
        text: 'What is the difference between a direct and indirect rollover?',
        answer: "In a direct rollover, funds move directly from your old plan to your new IRA — no taxes are withheld and there is no deadline pressure. In an indirect rollover, the check is made payable to you, 20% is withheld for taxes, and you have 60 days to deposit the full original amount (including the withheld portion from your own funds) into an IRA to avoid taxes and penalties. Direct rollovers are almost always preferable.",
      },
      {
        id: 'q-roll-003',
        text: 'Is there a tax penalty for rolling over a 401(k) to an IRA?',
        answer: "There is no tax penalty for a properly executed rollover from a 401(k) to a Traditional IRA — the transfer is not a taxable event. If you roll over to a Roth IRA instead, the amount converted is taxable as ordinary income in that year. Rolling over to a Traditional IRA preserves your tax-deferred status without any immediate tax impact.",
      },
      {
        id: 'q-roll-004',
        text: 'How long do I have to complete a 60-day rollover?',
        answer: "You have exactly 60 days from the date you receive the distribution to deposit it into a new IRA to avoid taxes and penalties. The IRS offers limited exceptions (illness, disaster, financial institution errors) but these require a private letter ruling, which is costly. To avoid the 60-day risk entirely, always request a direct rollover from your plan administrator.",
      },
    ],
  },

];

export function getKBTopicByLabel(label: string): KBTopic | undefined {
  return KB.find(t => t.label === label);
}

export function getEligibleTopics(page: string, accountTypes: string[]): KBTopic[] {
  return KB.filter(t =>
    t.pages.includes(page) &&
    (!t.accountTypes || t.accountTypes.some(at => accountTypes.includes(at))),
  );
}

export function getEligibleQuestions(topic: KBTopic, accountTypes: string[]): KBQuestion[] {
  return topic.questions.filter(q =>
    !q.accountTypes || q.accountTypes.some(at => accountTypes.includes(at)),
  );
}
