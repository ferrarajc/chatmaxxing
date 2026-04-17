# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: chat-widget.spec.ts >> Chat FAB >> FAB is visible on the account page
- Location: e2e\chat-widget.spec.ts:42:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: 'Open chat' })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('button', { name: 'Open chat' })

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
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | const BASE = '/chatmaxxing';
  4   | 
  5   | // Helper: open the chat widget and wait for the panel to be visible
  6   | async function openChat(page: import('@playwright/test').Page) {
  7   |   await page.goto(BASE + '/');
  8   |   const fab = page.getByRole('button', { name: 'Open chat' });
  9   |   await expect(fab).toBeVisible({ timeout: 10000 });
  10  |   await fab.click();
  11  |   // Panel is visible when we see either the close/minimize button or an input
  12  |   await expect(
  13  |     page.locator('[aria-label*="close" i], [aria-label*="minimize" i], textarea, input[type="text"]').first()
  14  |   ).toBeVisible({ timeout: 10000 });
  15  | }
  16  | 
  17  | // Helper: wait for predicted topics to appear
  18  | async function waitForTopics(page: import('@playwright/test').Page) {
  19  |   await expect(
  20  |     page.locator('button').filter({ hasText: /balance|fund|invest|account|portfolio|performance|transaction|trade|compare|advisor|activity/i }).first()
  21  |   ).toBeVisible({ timeout: 25000 });
  22  | }
  23  | 
  24  | // ─── FAB VISIBILITY ────────────────────────────────────────────────────────────
  25  | 
  26  | test.describe('Chat FAB', () => {
  27  |   test('FAB is visible on the homepage', async ({ page }) => {
  28  |     await page.goto(BASE + '/');
  29  |     await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible({ timeout: 10000 });
  30  |   });
  31  | 
  32  |   test('FAB is visible on the portfolio page', async ({ page }) => {
  33  |     await page.goto(BASE + '/portfolio');
  34  |     await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible({ timeout: 10000 });
  35  |   });
  36  | 
  37  |   test('FAB is visible on the research page', async ({ page }) => {
  38  |     await page.goto(BASE + '/research');
  39  |     await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible({ timeout: 10000 });
  40  |   });
  41  | 
  42  |   test('FAB is visible on the account page', async ({ page }) => {
  43  |     await page.goto(BASE + '/account');
> 44  |     await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible({ timeout: 10000 });
      |                                                                   ^ Error: expect(locator).toBeVisible() failed
  45  |   });
  46  | });
  47  | 
  48  | // ─── CHAT PANEL OPEN / CLOSE ──────────────────────────────────────────────────
  49  | 
  50  | test.describe('Chat panel open and close', () => {
  51  |   test('clicking FAB opens the chat panel', async ({ page }) => {
  52  |     await openChat(page);
  53  |     // Panel should contain a textarea or input
  54  |     await expect(page.locator('textarea, input[placeholder]').first()).toBeVisible({ timeout: 5000 });
  55  |   });
  56  | 
  57  |   test('chat panel shows greeting message for Alex Johnson', async ({ page }) => {
  58  |     await openChat(page);
  59  |     await expect(page.getByText(/hi.*alex johnson/i)).toBeVisible({ timeout: 15000 });
  60  |   });
  61  | 
  62  |   test('chat panel shows assistant intro text', async ({ page }) => {
  63  |     await openChat(page);
  64  |     await expect(page.getByText(/bob'?s mutual funds assistant/i)).toBeVisible({ timeout: 15000 });
  65  |   });
  66  | 
  67  |   test('close button is visible and closes the panel', async ({ page }) => {
  68  |     await openChat(page);
  69  |     // Find close button (×) - it's in the header
  70  |     const closeBtn = page.locator('button').filter({ hasText: /^[×✕x]$/i })
  71  |       .or(page.locator('button[aria-label*="close" i]'))
  72  |       .first();
  73  |     await expect(closeBtn).toBeVisible({ timeout: 5000 });
  74  |     await closeBtn.click();
  75  |     // After close, FAB should be visible again
  76  |     await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible({ timeout: 5000 });
  77  |     // Panel input should be gone
  78  |     await expect(page.locator('textarea').first()).not.toBeVisible({ timeout: 3000 });
  79  |   });
  80  | 
  81  |   test('can reopen chat after closing', async ({ page }) => {
  82  |     await openChat(page);
  83  |     const closeBtn = page.locator('button').filter({ hasText: /^[×✕x]$/i })
  84  |       .or(page.locator('button[aria-label*="close" i]'))
  85  |       .first();
  86  |     await closeBtn.click();
  87  |     await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible({ timeout: 5000 });
  88  |     // Re-open
  89  |     await page.getByRole('button', { name: 'Open chat' }).click();
  90  |     await expect(page.locator('textarea, input[placeholder]').first()).toBeVisible({ timeout: 10000 });
  91  |   });
  92  | });
  93  | 
  94  | // ─── PREDICTED TOPICS ─────────────────────────────────────────────────────────
  95  | 
  96  | test.describe('Predicted topics', () => {
  97  |   test('predicted topic buttons appear after opening chat', async ({ page }) => {
  98  |     await openChat(page);
  99  |     await waitForTopics(page);
  100 |   });
  101 | 
  102 |   test('exactly 4 topic buttons plus "Something else" are shown', async ({ page }) => {
  103 |     await openChat(page);
  104 |     await waitForTopics(page);
  105 |     // Wait a moment for all buttons to render
  106 |     await page.waitForTimeout(1000);
  107 |     const topicButtons = page.locator('button').filter({
  108 |       hasText: /balance|fund|invest|account|portfolio|performance|transaction|trade|compare|advisor|activity|something else/i,
  109 |     });
  110 |     const count = await topicButtons.count();
  111 |     // Should have 4 predicted topics + "Something else" = 5
  112 |     expect(count).toBeGreaterThanOrEqual(4);
  113 |   });
  114 | 
  115 |   test('"Something else" button is present', async ({ page }) => {
  116 |     await openChat(page);
  117 |     await waitForTopics(page);
  118 |     await expect(page.getByRole('button', { name: /something else/i })).toBeVisible({ timeout: 5000 });
  119 |   });
  120 | 
  121 |   test('topic buttons appear on portfolio page chat', async ({ page }) => {
  122 |     await page.goto(BASE + '/portfolio');
  123 |     await page.getByRole('button', { name: 'Open chat' }).click();
  124 |     // Portfolio topics are: Check my balance, Recent transactions, Fund performance, Place a trade
  125 |     await expect(
  126 |       page.locator('button').filter({ hasText: /balance|transaction|performance|trade/i }).first()
  127 |     ).toBeVisible({ timeout: 25000 });
  128 |   });
  129 | 
  130 |   test('clicking a topic button sends it as a message', async ({ page }) => {
  131 |     await openChat(page);
  132 |     await waitForTopics(page);
  133 |     // Click the first topic button
  134 |     const firstTopic = page.locator('button').filter({
  135 |       hasText: /balance|fund|invest|account|portfolio|performance|transaction|trade/i,
  136 |     }).first();
  137 |     const topicText = await firstTopic.textContent();
  138 |     await firstTopic.click();
  139 |     // The topic text should appear as a customer message (right-aligned blue bubble)
  140 |     await expect(page.getByText(topicText!.trim())).toBeVisible({ timeout: 5000 });
  141 |   });
  142 | 
  143 |   test('after clicking a topic, topic buttons are no longer shown', async ({ page }) => {
  144 |     await openChat(page);
```