# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: agent-app.spec.ts >> Agent App >> has correct page title
- Location: e2e\agent-app.spec.ts:31:7

# Error details

```
Error: expect(page).toHaveTitle(expected) failed

Expected pattern: /bob'?s mutual funds|agent desktop/i
Received string:  "agent-app"
Timeout: 5000ms

Call log:
  - Expect "toHaveTitle" with timeout 5000ms
    9 × unexpected value "agent-app"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]: B
      - generic [ref=e7]: Bob's — Agent Desktop
    - generic [ref=e8]:
      - generic [ref=e9]:
        - text: "Active chats:"
        - strong [ref=e10]: "0"
        - text: / 4
      - generic [ref=e11]:
        - button "Available" [ref=e12] [cursor=pointer]
        - button "Away" [ref=e13] [cursor=pointer]
      - generic [ref=e14]: DA
  - generic [ref=e15]:
    - generic [ref=e17]:
      - generic [ref=e18]: 💬
      - generic [ref=e19]: Waiting for a chat
    - generic [ref=e21]:
      - generic [ref=e22]: 💬
      - generic [ref=e23]: Waiting for a chat
    - generic [ref=e25]:
      - generic [ref=e26]: 💬
      - generic [ref=e27]: Waiting for a chat
    - generic [ref=e29]:
      - generic [ref=e30]: 💬
      - generic [ref=e31]: Waiting for a chat
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | const AGENT_BASE = '/chatmaxxing/agent';
  4   | 
  5   | test.describe('Agent App', () => {
  6   |   test.beforeEach(async ({ page }) => {
  7   |     await page.goto(AGENT_BASE + '/');
  8   |     // Wait for React to hydrate
  9   |     await page.waitForLoadState('networkidle');
  10  |   });
  11  | 
  12  |   // ─── PAGE LOAD ─────────────────────────────────────────────────────────────
  13  | 
  14  |   test('agent desktop page loads without errors', async ({ page }) => {
  15  |     // No uncaught JS errors should crash the page
  16  |     const errors: string[] = [];
  17  |     page.on('pageerror', err => errors.push(err.message));
  18  |     await page.goto(AGENT_BASE + '/');
  19  |     await page.waitForTimeout(3000);
  20  |     // Filter out expected Amazon Connect / CCP network errors (no active agent session)
  21  |     const criticalErrors = errors.filter(e =>
  22  |       !e.includes('connect') &&
  23  |       !e.includes('ccp') &&
  24  |       !e.includes('Network') &&
  25  |       !e.includes('fetch') &&
  26  |       !e.includes('CORS')
  27  |     );
  28  |     expect(criticalErrors).toHaveLength(0);
  29  |   });
  30  | 
  31  |   test('has correct page title', async ({ page }) => {
> 32  |     await expect(page).toHaveTitle(/bob'?s mutual funds|agent desktop/i);
      |                        ^ Error: expect(page).toHaveTitle(expected) failed
  33  |   });
  34  | 
  35  |   // ─── TOP BAR ───────────────────────────────────────────────────────────────
  36  | 
  37  |   test('TopBar shows Bob\'s Agent Desktop branding', async ({ page }) => {
  38  |     await expect(page.getByText(/bob'?s.*agent desktop/i)).toBeVisible({ timeout: 10000 });
  39  |   });
  40  | 
  41  |   test('TopBar shows active chat count "0 / 4"', async ({ page }) => {
  42  |     await expect(page.getByText(/active chats.*0.*4/i)).toBeVisible({ timeout: 10000 });
  43  |   });
  44  | 
  45  |   test('TopBar shows Available status button', async ({ page }) => {
  46  |     await expect(page.getByRole('button', { name: /available/i })).toBeVisible({ timeout: 10000 });
  47  |   });
  48  | 
  49  |   test('TopBar shows Away status button', async ({ page }) => {
  50  |     await expect(page.getByRole('button', { name: /away/i })).toBeVisible({ timeout: 10000 });
  51  |   });
  52  | 
  53  |   test('TopBar shows agent avatar "DA"', async ({ page }) => {
  54  |     await expect(page.getByText('DA')).toBeVisible({ timeout: 10000 });
  55  |   });
  56  | 
  57  |   test('clicking Away sets status to Away', async ({ page }) => {
  58  |     const awayBtn = page.getByRole('button', { name: /away/i });
  59  |     await awayBtn.click();
  60  |     // After clicking Away, the Away button should be highlighted (active state)
  61  |     // We check via background color change — active button has yellow background (#f59e0b)
  62  |     await page.waitForTimeout(300);
  63  |     const awayBtnColor = await awayBtn.evaluate(el =>
  64  |       window.getComputedStyle(el).backgroundColor
  65  |     );
  66  |     // Yellow: rgb(245, 158, 11) or similar
  67  |     expect(awayBtnColor).toMatch(/rgb\(245|rgb\(246/);
  68  |   });
  69  | 
  70  |   test('clicking Available restores Available status', async ({ page }) => {
  71  |     // Set to Away first
  72  |     await page.getByRole('button', { name: /away/i }).click();
  73  |     await page.waitForTimeout(200);
  74  |     // Then back to Available
  75  |     const availableBtn = page.getByRole('button', { name: /available/i });
  76  |     await availableBtn.click();
  77  |     await page.waitForTimeout(300);
  78  |     const color = await availableBtn.evaluate(el =>
  79  |       window.getComputedStyle(el).backgroundColor
  80  |     );
  81  |     // Green: rgb(16, 185, 129) or similar
  82  |     expect(color).toMatch(/rgb\(16|rgb\(17/);
  83  |   });
  84  | 
  85  |   // ─── 4-COLUMN GRID ─────────────────────────────────────────────────────────
  86  | 
  87  |   test('renders 4 chat columns', async ({ page }) => {
  88  |     // All 4 columns should show "Waiting for a chat"
  89  |     const waitingSlots = page.getByText('Waiting for a chat');
  90  |     await expect(waitingSlots.first()).toBeVisible({ timeout: 10000 });
  91  |     const count = await waitingSlots.count();
  92  |     expect(count).toBe(4);
  93  |   });
  94  | 
  95  |   test('chat bubble emoji is present in empty slots', async ({ page }) => {
  96  |     const bubbles = page.getByText('💬');
  97  |     await expect(bubbles.first()).toBeVisible({ timeout: 10000 });
  98  |     const count = await bubbles.count();
  99  |     expect(count).toBe(4);
  100 |   });
  101 | 
  102 |   test('4-column grid is visible', async ({ page }) => {
  103 |     // The grid container has gridTemplateColumns: repeat(4, 1fr)
  104 |     const grid = page.locator('div').filter({ hasText: /waiting for a chat/i }).nth(0).locator('..');
  105 |     // Just verify the columns are in a flex/grid layout
  106 |     const columns = page.locator('div').filter({ hasText: 'Waiting for a chat' });
  107 |     expect(await columns.count()).toBe(4);
  108 |   });
  109 | 
  110 |   // ─── CCP / AMAZON CONNECT STREAMS ─────────────────────────────────────────
  111 | 
  112 |   test('CCP container element is present in DOM', async ({ page }) => {
  113 |     // The hidden CCP div exists but has 0x0 size
  114 |     // We look for any iframe injected by Connect Streams
  115 |     // Even without login, the CCP iframe gets injected into the page
  116 |     await page.waitForTimeout(3000);
  117 |     // Either an iframe exists, or the app rendered without crashing
  118 |     const hasFrame = await page.locator('iframe').count();
  119 |     // Just verify the app loaded (iframe may or may not exist without valid CCP URL)
  120 |     expect(hasFrame).toBeGreaterThanOrEqual(0);
  121 |   });
  122 | });
  123 | 
  124 | // ─── AGENT APP NAVIGATION ─────────────────────────────────────────────────────
  125 | 
  126 | test.describe('Agent App accessibility', () => {
  127 |   test('page is accessible at /chatmaxxing/agent/', async ({ page }) => {
  128 |     const res = await page.goto('/chatmaxxing/agent/');
  129 |     expect(res?.status()).toBeLessThan(400);
  130 |   });
  131 | 
  132 |   test('agent app does not redirect to customer app', async ({ page }) => {
```