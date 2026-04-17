# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pages.spec.ts >> Research Page >> fund card shows 1-year return for BobsFunds Growth
- Location: e2e\pages.spec.ts:194:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/31\.4%/)
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByText(/31\.4%/)

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
  96  |     await expect(page.getByText('Traditional IRA').first()).toBeVisible({ timeout: 10000 });
  97  |     await expect(page.getByText(/128[,.]450/).first()).toBeVisible({ timeout: 10000 });
  98  |   });
  99  | 
  100 |   test('shows Taxable Account with correct balance', async ({ page }) => {
  101 |     await expect(page.getByText('Taxable Account').first()).toBeVisible({ timeout: 10000 });
  102 |     await expect(page.getByText(/67[,.]890/).first()).toBeVisible({ timeout: 10000 });
  103 |   });
  104 | 
  105 |   test('shows positive change % for Roth IRA', async ({ page }) => {
  106 |     await expect(page.getByText(/\+4\.2%/)).toBeVisible({ timeout: 10000 });
  107 |   });
  108 | 
  109 |   test('shows negative change % for Taxable Account', async ({ page }) => {
  110 |     await expect(page.getByText(/-0\.9%/)).toBeVisible({ timeout: 10000 });
  111 |   });
  112 | 
  113 |   test('holdings table shows all 6 fund tickers', async ({ page }) => {
  114 |     for (const ticker of ['BF500', 'BFGR', 'BFBI', 'BFIN', 'BFESG', 'BFST']) {
  115 |       await expect(page.getByText(ticker).first()).toBeVisible({ timeout: 10000 });
  116 |     }
  117 |   });
  118 | 
  119 |   test('holdings table shows BobsFunds 500 Index', async ({ page }) => {
  120 |     await expect(page.getByText('BobsFunds 500 Index').first()).toBeVisible({ timeout: 10000 });
  121 |   });
  122 | 
  123 |   test('holdings table shows shares for BF500', async ({ page }) => {
  124 |     await expect(page.getByText(/142\.3/).first()).toBeVisible({ timeout: 10000 });
  125 |   });
  126 | 
  127 |   test('recent transactions section is present', async ({ page }) => {
  128 |     await expect(page.getByText(/recent transactions/i)).toBeVisible({ timeout: 10000 });
  129 |   });
  130 | 
  131 |   test('shows dividend reinvestment transaction', async ({ page }) => {
  132 |     await expect(page.getByText(/dividend reinvestment/i)).toBeVisible({ timeout: 10000 });
  133 |   });
  134 | 
  135 |   test('shows contribution transactions', async ({ page }) => {
  136 |     await expect(page.getByText(/contribution/i).first()).toBeVisible({ timeout: 10000 });
  137 |   });
  138 | 
  139 |   test('shows allocation chart section', async ({ page }) => {
  140 |     await expect(page.getByText(/allocation/i)).toBeVisible({ timeout: 10000 });
  141 |   });
  142 | 
  143 |   test('chat FAB is visible on portfolio page', async ({ page }) => {
  144 |     await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible({ timeout: 10000 });
  145 |   });
  146 | });
  147 | 
  148 | // ─── RESEARCH PAGE ────────────────────────────────────────────────────────────
  149 | 
  150 | test.describe('Research Page', () => {
  151 |   test.beforeEach(async ({ page }) => {
  152 |     await goTo(page, '/research');
  153 |   });
  154 | 
  155 |   test('has Fund Research heading', async ({ page }) => {
  156 |     await expect(page.getByRole('heading', { name: /fund research/i })).toBeVisible({ timeout: 10000 });
  157 |   });
  158 | 
  159 |   test('shows all 6 fund cards', async ({ page }) => {
  160 |     const funds = [
  161 |       'BobsFunds 500 Index',
  162 |       'BobsFunds Growth',
  163 |       'BobsFunds Bond Income',
  164 |       'BobsFunds International',
  165 |       'BobsFunds ESG Leaders',
  166 |       'BobsFunds Short-Term Treasury',
  167 |     ];
  168 |     for (const name of funds) {
  169 |       await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 });
  170 |     }
  171 |   });
  172 | 
  173 |   test('category filter buttons are present', async ({ page }) => {
  174 |     await expect(page.getByRole('button', { name: /all/i })).toBeVisible({ timeout: 10000 });
  175 |     await expect(page.getByRole('button', { name: /large cap blend/i })).toBeVisible({ timeout: 10000 });
  176 |     await expect(page.getByRole('button', { name: /intermediate bond/i })).toBeVisible({ timeout: 10000 });
  177 |   });
  178 | 
  179 |   test('"All" filter shows all 6 funds', async ({ page }) => {
  180 |     const fundMatches = page.getByText(/BobsFunds/);
  181 |     await expect(fundMatches.first()).toBeVisible({ timeout: 10000 });
  182 |     const count = await fundMatches.count();
  183 |     expect(count).toBeGreaterThanOrEqual(6);
  184 |   });
  185 | 
  186 |   test('Large Cap Blend filter shows BF500 and hides Bond Income', async ({ page }) => {
  187 |     await page.getByRole('button', { name: /large cap blend/i }).click();
  188 |     await expect(page.getByText('BobsFunds 500 Index').first()).toBeVisible({ timeout: 5000 });
  189 |     await expect(page.getByText('BobsFunds Bond Income')).not.toBeVisible({ timeout: 3000 });
  190 |   });
  191 | 
  192 |   test('Intermediate Bond filter shows Bond Income fund', async ({ page }) => {
  193 |     await page.getByRole('button', { name: /intermediate bond/i }).click();
  194 |     await expect(page.getByText('BobsFunds Bond Income').first()).toBeVisible({ timeout: 5000 });
  195 |     await expect(page.getByText('BobsFunds 500 Index')).not.toBeVisible({ timeout: 3000 });
> 196 |   });
      |                                            ^ Error: expect(locator).toBeVisible() failed
  197 | 
  198 |   test('ESG filter shows ESG Leaders fund', async ({ page }) => {
  199 |     await page.getByRole('button', { name: /esg/i }).click();
  200 |     await expect(page.getByText('BobsFunds ESG Leaders').first()).toBeVisible({ timeout: 5000 });
  201 |   });
  202 | 
  203 |   test('fund card shows expense ratio for BF500 (0.03%)', async ({ page }) => {
  204 |     await expect(page.getByText(/0\.03%/).first()).toBeVisible({ timeout: 10000 });
  205 |   });
  206 | 
  207 |   test('fund card shows 1-year return for BobsFunds Growth (31.4%)', async ({ page }) => {
  208 |     await expect(page.getByText(/31\.4%/).first()).toBeVisible({ timeout: 10000 });
  209 |   });
  210 | 
  211 |   test('fund cards show YTD/1Y return labels', async ({ page }) => {
  212 |     await expect(page.getByText(/YTD/i).first()).toBeVisible({ timeout: 10000 });
  213 |     await expect(page.getByText(/\b1Y\b/).first()).toBeVisible({ timeout: 10000 });
  214 |   });
  215 | 
  216 |   test('chat FAB is visible on research page', async ({ page }) => {
  217 |     await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible({ timeout: 10000 });
  218 |   });
  219 | });
  220 | 
  221 | // ─── ACCOUNT PAGE ─────────────────────────────────────────────────────────────
  222 | 
  223 | test.describe('Account Page', () => {
  224 |   test.beforeEach(async ({ page }) => {
  225 |     await goTo(page, '/account');
  226 |   });
  227 | 
  228 |   test('has My Account heading', async ({ page }) => {
  229 |     await expect(page.getByRole('heading', { name: /my account/i })).toBeVisible({ timeout: 10000 });
  230 |   });
  231 | 
  232 |   test('shows client name', async ({ page }) => {
  233 |     await expect(page.getByText('Alex Johnson').first()).toBeVisible({ timeout: 10000 });
  234 |   });
  235 | 
  236 |   test('shows client phone number', async ({ page }) => {
  237 |     await expect(page.getByText('(484) 238-4838')).toBeVisible({ timeout: 10000 });
  238 |   });
  239 | 
  240 |   test('shows Personal Information section', async ({ page }) => {
  241 |     await expect(page.getByText(/personal information/i)).toBeVisible({ timeout: 10000 });
  242 |   });
  243 | 
  244 |   test('shows Security section', async ({ page }) => {
  245 |     await expect(page.getByText(/^security$/i)).toBeVisible({ timeout: 10000 });
  246 |   });
  247 | 
  248 |   test('shows two-factor authentication status', async ({ page }) => {
  249 |     await expect(page.getByText(/two.?factor/i)).toBeVisible({ timeout: 10000 });
  250 |     await expect(page.getByText(/enabled/i)).toBeVisible({ timeout: 10000 });
  251 |   });
  252 | 
  253 |   test('shows Preferences section', async ({ page }) => {
  254 |     await expect(page.getByText(/preferences/i)).toBeVisible({ timeout: 10000 });
  255 |   });
  256 | 
  257 |   test('shows paperless statements preference', async ({ page }) => {
  258 |     await expect(page.getByText(/paperless/i)).toBeVisible({ timeout: 10000 });
  259 |   });
  260 | 
  261 |   test('chat FAB is visible on account page', async ({ page }) => {
  262 |     await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible({ timeout: 10000 });
  263 |   });
  264 | });
  265 | 
  266 | // ─── NAVIGATION ───────────────────────────────────────────────────────────────
  267 | 
  268 | test.describe('Navigation', () => {
  269 |   test('navigates from home to portfolio', async ({ page }) => {
  270 |     await goTo(page, '/');
  271 |     await page.getByRole('link', { name: /portfolio/i }).click();
  272 |     await expect(page).toHaveURL(/portfolio/);
  273 |     await expect(page.getByRole('heading', { name: /my portfolio/i })).toBeVisible({ timeout: 10000 });
  274 |   });
  275 | 
  276 |   test('navigates from home to research', async ({ page }) => {
  277 |     await goTo(page, '/');
  278 |     await page.getByRole('link', { name: /research/i }).click();
  279 |     await expect(page).toHaveURL(/research/);
  280 |     await expect(page.getByRole('heading', { name: /fund research/i })).toBeVisible({ timeout: 10000 });
  281 |   });
  282 | 
  283 |   test('navigates from home to account', async ({ page }) => {
  284 |     await goTo(page, '/');
  285 |     await page.getByRole('link', { name: /^account$/i }).click();
  286 |     await expect(page).toHaveURL(/account/);
  287 |     await expect(page.getByRole('heading', { name: /my account/i })).toBeVisible({ timeout: 10000 });
  288 |   });
  289 | 
  290 |   test('navigates back to home via brand link', async ({ page }) => {
  291 |     await goTo(page, '/portfolio');
  292 |     await page.getByRole('link', { name: /home/i }).click();
  293 |     await expect(page).toHaveURL(/\/(#.*)?$/);
  294 |   });
  295 | 
  296 |   test('chat FAB persists across portfolio → research navigation', async ({ page }) => {
```