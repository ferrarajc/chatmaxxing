# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pages.spec.ts >> Homepage >> displays total portfolio balance
- Location: e2e\pages.spec.ts:20:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/241,570/)
Expected: visible
Error: strict mode violation: getByText(/241,570/) resolved to 2 elements:
    1) <div>Total: $241,570</div> aka getByText('Total: $')
    2) <div>$241,570</div> aka getByText('$241,570', { exact: true })

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByText(/241,570/)

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - navigation [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]: B
      - generic [ref=e7]: Bob's Mutual Funds
    - link "Home" [ref=e8] [cursor=pointer]:
      - /url: /chatmaxxing/
    - link "Portfolio" [ref=e9] [cursor=pointer]:
      - /url: /chatmaxxing/portfolio
    - link "Research" [ref=e10] [cursor=pointer]:
      - /url: /chatmaxxing/research
    - link "Account" [ref=e11] [cursor=pointer]:
      - /url: /chatmaxxing/account
    - generic [ref=e12]:
      - generic [ref=e13]:
        - generic [ref=e14]: Alex Johnson
        - generic [ref=e15]: "Total: $241,570"
      - generic [ref=e16]: AJ
  - main [ref=e17]:
    - generic [ref=e18]:
      - generic [ref=e19]:
        - heading "Welcome back, Alex." [level=1] [ref=e20]
        - paragraph [ref=e21]: Your total portfolio value
        - generic [ref=e22]: $241,570
        - paragraph [ref=e23]: Across 3 accounts
      - generic [ref=e24]:
        - generic [ref=e25]:
          - generic [ref=e26]: S&P 500
          - generic [ref=e27]: 5,248.33
          - generic [ref=e28]: +0.83%
        - generic [ref=e29]:
          - generic [ref=e30]: Dow Jones
          - generic [ref=e31]: 39,127.14
          - generic [ref=e32]: +0.44%
        - generic [ref=e33]:
          - generic [ref=e34]: NASDAQ
          - generic [ref=e35]: 16,394.21
          - generic [ref=e36]: +1.02%
      - heading "Featured Funds" [level=2] [ref=e37]
      - generic [ref=e38]:
        - generic [ref=e39]:
          - generic [ref=e40]:
            - generic [ref=e41]:
              - generic [ref=e42]: BobsFunds 500 Index
              - generic [ref=e43]: Large Cap Blend
            - generic [ref=e44]: BF500
          - paragraph [ref=e45]: Tracks the performance of 500 large-cap US companies.
          - generic [ref=e46]:
            - generic [ref=e47]:
              - generic [ref=e48]: +24.1%
              - generic [ref=e49]: 1-year
            - generic [ref=e50]:
              - generic [ref=e51]: 0.03%
              - generic [ref=e52]: Expense ratio
        - generic [ref=e53]:
          - generic [ref=e54]:
            - generic [ref=e55]:
              - generic [ref=e56]: BobsFunds Growth
              - generic [ref=e57]: Large Cap Growth
            - generic [ref=e58]: BFGR
          - paragraph [ref=e59]: High-growth US companies with strong earnings momentum.
          - generic [ref=e60]:
            - generic [ref=e61]:
              - generic [ref=e62]: +31.4%
              - generic [ref=e63]: 1-year
            - generic [ref=e64]:
              - generic [ref=e65]: 0.25%
              - generic [ref=e66]: Expense ratio
        - generic [ref=e67]:
          - generic [ref=e68]:
            - generic [ref=e69]:
              - generic [ref=e70]: BobsFunds Bond Income
              - generic [ref=e71]: Intermediate Bond
            - generic [ref=e72]: BFBI
          - paragraph [ref=e73]: Investment-grade corporate and government bonds.
          - generic [ref=e74]:
            - generic [ref=e75]:
              - generic [ref=e76]: +4.2%
              - generic [ref=e77]: 1-year
            - generic [ref=e78]:
              - generic [ref=e79]: 0.1%
              - generic [ref=e80]: Expense ratio
      - generic [ref=e81]:
        - generic [ref=e82]: 💬
        - generic [ref=e83]:
          - generic [ref=e84]: Need help? Chat is our front door.
          - generic [ref=e85]: Our chat support team is available 24/7. Click the chat bubble in the corner to get started. If you call our 800 number, you'll be directed here for the fastest service.
  - button "Open chat" [ref=e86] [cursor=pointer]: 💬
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | const BASE = '/chatmaxxing';
  4   | 
  5   | // ─── HOMEPAGE ────────────────────────────────────────────────────────────────
  6   | 
  7   | test.describe('Homepage', () => {
  8   |   test.beforeEach(async ({ page }) => {
  9   |     await page.goto(BASE + '/');
  10  |   });
  11  | 
  12  |   test('has correct page title', async ({ page }) => {
  13  |     await expect(page).toHaveTitle("Bob's Mutual Funds");
  14  |   });
  15  | 
  16  |   test('displays client name in hero', async ({ page }) => {
  17  |     await expect(page.getByText('Alex Johnson')).toBeVisible({ timeout: 10000 });
  18  |   });
  19  | 
  20  |   test('displays total portfolio balance', async ({ page }) => {
> 21  |     await expect(page.getByText(/241,570/)).toBeVisible({ timeout: 10000 });
      |                                             ^ Error: expect(locator).toBeVisible() failed
  22  |   });
  23  | 
  24  |   test('displays account count', async ({ page }) => {
  25  |     await expect(page.getByText(/3\s*accounts?/i)).toBeVisible({ timeout: 10000 });
  26  |   });
  27  | 
  28  |   test('displays S&P 500 market data', async ({ page }) => {
  29  |     await expect(page.getByText(/S&P 500/i)).toBeVisible({ timeout: 10000 });
  30  |     await expect(page.getByText(/5,248/)).toBeVisible({ timeout: 10000 });
  31  |   });
  32  | 
  33  |   test('displays Dow Jones market data', async ({ page }) => {
  34  |     await expect(page.getByText(/Dow Jones/i)).toBeVisible({ timeout: 10000 });
  35  |   });
  36  | 
  37  |   test('displays NASDAQ market data', async ({ page }) => {
  38  |     await expect(page.getByText(/NASDAQ/i)).toBeVisible({ timeout: 10000 });
  39  |   });
  40  | 
  41  |   test('displays at least 3 featured fund cards', async ({ page }) => {
  42  |     await expect(page.getByText('BobsFunds 500 Index')).toBeVisible({ timeout: 10000 });
  43  |     await expect(page.getByText('BobsFunds Growth')).toBeVisible({ timeout: 10000 });
  44  |     await expect(page.getByText('BobsFunds Bond Income')).toBeVisible({ timeout: 10000 });
  45  |   });
  46  | 
  47  |   test('featured fund shows 1-year return', async ({ page }) => {
  48  |     // BF500 has 1Y return of 24.1%
  49  |     await expect(page.getByText(/24\.1%/)).toBeVisible({ timeout: 10000 });
  50  |   });
  51  | 
  52  |   test('chat FAB is visible', async ({ page }) => {
  53  |     await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible({ timeout: 10000 });
  54  |   });
  55  | 
  56  |   test('navigation links are present', async ({ page }) => {
  57  |     await expect(page.getByRole('link', { name: /portfolio/i })).toBeVisible({ timeout: 10000 });
  58  |     await expect(page.getByRole('link', { name: /research/i })).toBeVisible({ timeout: 10000 });
  59  |   });
  60  | });
  61  | 
  62  | // ─── PORTFOLIO PAGE ───────────────────────────────────────────────────────────
  63  | 
  64  | test.describe('Portfolio Page', () => {
  65  |   test.beforeEach(async ({ page }) => {
  66  |     await page.goto(BASE + '/portfolio');
  67  |     await page.waitForLoadState('networkidle');
  68  |   });
  69  | 
  70  |   test('has My Portfolio heading', async ({ page }) => {
  71  |     await expect(page.getByRole('heading', { name: /my portfolio/i })).toBeVisible({ timeout: 10000 });
  72  |   });
  73  | 
  74  |   test('shows Roth IRA account card with correct balance', async ({ page }) => {
  75  |     await expect(page.getByText('Roth IRA')).toBeVisible({ timeout: 10000 });
  76  |     await expect(page.getByText(/45,230/)).toBeVisible({ timeout: 10000 });
  77  |   });
  78  | 
  79  |   test('shows Traditional IRA account card with correct balance', async ({ page }) => {
  80  |     await expect(page.getByText('Traditional IRA')).toBeVisible({ timeout: 10000 });
  81  |     await expect(page.getByText(/128,450/)).toBeVisible({ timeout: 10000 });
  82  |   });
  83  | 
  84  |   test('shows Taxable Account with correct balance', async ({ page }) => {
  85  |     await expect(page.getByText('Taxable Account')).toBeVisible({ timeout: 10000 });
  86  |     await expect(page.getByText(/67,890/)).toBeVisible({ timeout: 10000 });
  87  |   });
  88  | 
  89  |   test('shows positive change % for Roth IRA', async ({ page }) => {
  90  |     await expect(page.getByText(/\+4\.2%/)).toBeVisible({ timeout: 10000 });
  91  |   });
  92  | 
  93  |   test('shows negative change % for Taxable Account', async ({ page }) => {
  94  |     await expect(page.getByText(/-0\.9%/)).toBeVisible({ timeout: 10000 });
  95  |   });
  96  | 
  97  |   test('holdings table shows all 6 fund tickers', async ({ page }) => {
  98  |     for (const ticker of ['BF500', 'BFGR', 'BFBI', 'BFIN', 'BFESG', 'BFST']) {
  99  |       await expect(page.getByText(ticker)).toBeVisible({ timeout: 10000 });
  100 |     }
  101 |   });
  102 | 
  103 |   test('holdings table shows BobsFunds 500 Index', async ({ page }) => {
  104 |     await expect(page.getByText('BobsFunds 500 Index')).toBeVisible({ timeout: 10000 });
  105 |   });
  106 | 
  107 |   test('holdings table shows shares for BF500', async ({ page }) => {
  108 |     await expect(page.getByText(/142\.3/)).toBeVisible({ timeout: 10000 });
  109 |   });
  110 | 
  111 |   test('recent transactions section is present', async ({ page }) => {
  112 |     await expect(page.getByText(/recent transactions/i)).toBeVisible({ timeout: 10000 });
  113 |   });
  114 | 
  115 |   test('shows dividend reinvestment transaction', async ({ page }) => {
  116 |     await expect(page.getByText(/dividend reinvestment/i)).toBeVisible({ timeout: 10000 });
  117 |   });
  118 | 
  119 |   test('shows contribution transactions', async ({ page }) => {
  120 |     await expect(page.getByText(/contribution/i).first()).toBeVisible({ timeout: 10000 });
  121 |   });
```