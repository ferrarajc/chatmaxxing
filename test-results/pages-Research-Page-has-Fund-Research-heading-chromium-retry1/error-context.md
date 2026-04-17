# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pages.spec.ts >> Research Page >> has Fund Research heading
- Location: e2e\pages.spec.ts:141:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /fund research/i })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('heading', { name: /fund research/i })

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - heading "404" [level=1] [ref=e3]
  - paragraph [ref=e4]:
    - strong [ref=e5]: File not found
  - paragraph [ref=e6]: The site configured at this address does not contain the requested file.
  - paragraph [ref=e7]:
    - text: If this is your site, make sure that the filename case matches the URL as well as any file permissions.
    - text: For root URLs (like
    - code [ref=e8]: http://example.com/
    - text: ) you must provide an
    - code [ref=e9]: index.html
    - text: file.
  - paragraph [ref=e10]:
    - link "Read the full documentation" [ref=e11] [cursor=pointer]:
      - /url: https://help.github.com/pages/
    - text: for more information about using
    - strong [ref=e12]: GitHub Pages
    - text: .
  - generic [ref=e13]:
    - link "GitHub Status" [ref=e14] [cursor=pointer]:
      - /url: https://githubstatus.com
    - text: —
    - link "@githubstatus" [ref=e15] [cursor=pointer]:
      - /url: https://twitter.com/githubstatus
  - link [ref=e16] [cursor=pointer]:
    - /url: /
```

# Test source

```ts
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
  122 | 
  123 |   test('shows allocation chart section', async ({ page }) => {
  124 |     // Recharts renders an SVG; look for the section heading
  125 |     await expect(page.getByText(/allocation/i)).toBeVisible({ timeout: 10000 });
  126 |   });
  127 | 
  128 |   test('chat FAB is visible on portfolio page', async ({ page }) => {
  129 |     await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible({ timeout: 10000 });
  130 |   });
  131 | });
  132 | 
  133 | // ─── RESEARCH PAGE ────────────────────────────────────────────────────────────
  134 | 
  135 | test.describe('Research Page', () => {
  136 |   test.beforeEach(async ({ page }) => {
  137 |     await page.goto(BASE + '/research');
  138 |     await page.waitForLoadState('networkidle');
  139 |   });
  140 | 
  141 |   test('has Fund Research heading', async ({ page }) => {
> 142 |     await expect(page.getByRole('heading', { name: /fund research/i })).toBeVisible({ timeout: 10000 });
      |                                                                         ^ Error: expect(locator).toBeVisible() failed
  143 |   });
  144 | 
  145 |   test('shows all 6 fund cards', async ({ page }) => {
  146 |     const funds = [
  147 |       'BobsFunds 500 Index',
  148 |       'BobsFunds Growth',
  149 |       'BobsFunds Bond Income',
  150 |       'BobsFunds International',
  151 |       'BobsFunds ESG Leaders',
  152 |       'BobsFunds Short-Term Treasury',
  153 |     ];
  154 |     for (const name of funds) {
  155 |       await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });
  156 |     }
  157 |   });
  158 | 
  159 |   test('category filter buttons are present', async ({ page }) => {
  160 |     await expect(page.getByRole('button', { name: /all/i })).toBeVisible({ timeout: 10000 });
  161 |     await expect(page.getByRole('button', { name: /large cap blend/i })).toBeVisible({ timeout: 10000 });
  162 |     await expect(page.getByRole('button', { name: /intermediate bond/i })).toBeVisible({ timeout: 10000 });
  163 |   });
  164 | 
  165 |   test('"All" filter is selected by default (shows all 6 funds)', async ({ page }) => {
  166 |     const fundNames = page.getByText(/BobsFunds/);
  167 |     await expect(fundNames.first()).toBeVisible({ timeout: 10000 });
  168 |     const count = await fundNames.count();
  169 |     expect(count).toBeGreaterThanOrEqual(6);
  170 |   });
  171 | 
  172 |   test('Large Cap Blend filter shows only matching funds', async ({ page }) => {
  173 |     await page.getByRole('button', { name: /large cap blend/i }).click();
  174 |     await expect(page.getByText('BobsFunds 500 Index')).toBeVisible({ timeout: 5000 });
  175 |     await expect(page.getByText('BobsFunds Bond Income')).not.toBeVisible({ timeout: 3000 });
  176 |   });
  177 | 
  178 |   test('Intermediate Bond filter shows Bond Income fund', async ({ page }) => {
  179 |     await page.getByRole('button', { name: /intermediate bond/i }).click();
  180 |     await expect(page.getByText('BobsFunds Bond Income')).toBeVisible({ timeout: 5000 });
  181 |     await expect(page.getByText('BobsFunds 500 Index')).not.toBeVisible({ timeout: 3000 });
  182 |   });
  183 | 
  184 |   test('ESG filter shows ESG Leaders fund', async ({ page }) => {
  185 |     await page.getByRole('button', { name: /esg/i }).click();
  186 |     await expect(page.getByText('BobsFunds ESG Leaders')).toBeVisible({ timeout: 5000 });
  187 |   });
  188 | 
  189 |   test('fund card shows expense ratio for BF500', async ({ page }) => {
  190 |     // BF500 expense ratio is 0.03%
  191 |     await expect(page.getByText(/0\.03%/)).toBeVisible({ timeout: 10000 });
  192 |   });
  193 | 
  194 |   test('fund card shows 1-year return for BobsFunds Growth', async ({ page }) => {
  195 |     // BFGR 1Y return 31.4%
  196 |     await expect(page.getByText(/31\.4%/)).toBeVisible({ timeout: 10000 });
  197 |   });
  198 | 
  199 |   test('fund cards show YTD/1Y/3Y/5Y return labels', async ({ page }) => {
  200 |     await expect(page.getByText(/YTD/i).first()).toBeVisible({ timeout: 10000 });
  201 |     await expect(page.getByText(/1Y/i).first()).toBeVisible({ timeout: 10000 });
  202 |   });
  203 | 
  204 |   test('chat FAB is visible on research page', async ({ page }) => {
  205 |     await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible({ timeout: 10000 });
  206 |   });
  207 | });
  208 | 
  209 | // ─── ACCOUNT PAGE ─────────────────────────────────────────────────────────────
  210 | 
  211 | test.describe('Account Page', () => {
  212 |   test.beforeEach(async ({ page }) => {
  213 |     await page.goto(BASE + '/account');
  214 |     await page.waitForLoadState('networkidle');
  215 |   });
  216 | 
  217 |   test('has My Account heading', async ({ page }) => {
  218 |     await expect(page.getByRole('heading', { name: /my account/i })).toBeVisible({ timeout: 10000 });
  219 |   });
  220 | 
  221 |   test('shows client name', async ({ page }) => {
  222 |     await expect(page.getByText('Alex Johnson')).toBeVisible({ timeout: 10000 });
  223 |   });
  224 | 
  225 |   test('shows client phone number', async ({ page }) => {
  226 |     await expect(page.getByText('(484) 238-4838')).toBeVisible({ timeout: 10000 });
  227 |   });
  228 | 
  229 |   test('shows Personal Information section', async ({ page }) => {
  230 |     await expect(page.getByText(/personal information/i)).toBeVisible({ timeout: 10000 });
  231 |   });
  232 | 
  233 |   test('shows Security section', async ({ page }) => {
  234 |     await expect(page.getByText(/security/i)).toBeVisible({ timeout: 10000 });
  235 |   });
  236 | 
  237 |   test('shows two-factor authentication status', async ({ page }) => {
  238 |     await expect(page.getByText(/two-factor/i)).toBeVisible({ timeout: 10000 });
  239 |     await expect(page.getByText(/enabled/i)).toBeVisible({ timeout: 10000 });
  240 |   });
  241 | 
  242 |   test('shows Preferences section', async ({ page }) => {
```