# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: chat-widget.spec.ts >> Chat input >> clicking the send button sends the message
- Location: e2e\chat-widget.spec.ts:207:7

# Error details

```
Test timeout of 40000ms exceeded.
```

```
Error: locator.click: Test timeout of 40000ms exceeded.
Call log:
  - waiting for locator('button[type="submit"], button').filter({ hasText: /send/i }).first()

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
  - generic [ref=e86]:
    - generic [ref=e87]:
      - generic [ref=e88]: 💼
      - generic [ref=e89]:
        - generic [ref=e90]: Bob's Mutual Funds
        - generic [ref=e91]: 🤖 Virtual Assistant
      - button "Close chat" [ref=e92] [cursor=pointer]: ×
    - generic [ref=e93]:
      - generic [ref=e94]:
        - generic [ref=e95]:
          - text: Hi
          - strong [ref=e96]: Alex Johnson
          - text: "! 👋 I'm your Bob's Mutual Funds assistant. How can I help you today?"
        - generic [ref=e97]:
          - generic [ref=e98]: I think you might be here about…
          - generic [ref=e99]:
            - button "Open an account" [ref=e100] [cursor=pointer]
            - button "Learn about IRAs" [ref=e101] [cursor=pointer]
            - button "Check recent activity" [ref=e102] [cursor=pointer]
            - button "Talk to an advisor" [ref=e103] [cursor=pointer]
            - button "Something else" [ref=e104] [cursor=pointer]
        - generic [ref=e105]: Chat ended.
      - generic [ref=e106]:
        - textbox "Type a message…" [active] [ref=e107]: Fund performance question
        - button "Send" [ref=e108] [cursor=pointer]: ➤
```

# Test source

```ts
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
  145 |     await waitForTopics(page);
  146 |     const firstTopic = page.locator('button').filter({
  147 |       hasText: /balance|fund|invest|account|portfolio|performance|transaction|trade/i,
  148 |     }).first();
  149 |     await firstTopic.click();
  150 |     // Topic buttons should disappear (topicsUsed ref becomes true)
  151 |     await page.waitForTimeout(500);
  152 |     const topicButtons = page.locator('button').filter({
  153 |       hasText: /balance|fund|invest|account|portfolio|performance|transaction|trade/i,
  154 |     });
  155 |     // All topic buttons should be disabled or gone
  156 |     const visibleCount = await topicButtons.count();
  157 |     for (let i = 0; i < visibleCount; i++) {
  158 |       const isDisabled = await topicButtons.nth(i).getAttribute('disabled');
  159 |       const opacity = await topicButtons.nth(i).evaluate(el => getComputedStyle(el).opacity);
  160 |       // Either disabled or faded out
  161 |       expect(isDisabled !== null || parseFloat(opacity) < 0.5).toBeTruthy();
  162 |     }
  163 |   });
  164 | });
  165 | 
  166 | // ─── CHAT INPUT ───────────────────────────────────────────────────────────────
  167 | 
  168 | test.describe('Chat input', () => {
  169 |   test('text input is visible after opening chat', async ({ page }) => {
  170 |     await openChat(page);
  171 |     await expect(page.locator('textarea').first()).toBeVisible({ timeout: 10000 });
  172 |   });
  173 | 
  174 |   test('can type in the chat input', async ({ page }) => {
  175 |     await openChat(page);
  176 |     const input = page.locator('textarea').first();
  177 |     await input.fill('Hello, test message');
  178 |     await expect(input).toHaveValue('Hello, test message');
  179 |   });
  180 | 
  181 |   test('send button is visible', async ({ page }) => {
  182 |     await openChat(page);
  183 |     await expect(page.locator('button[type="submit"], button').filter({ hasText: /send/i }).first()).toBeVisible({ timeout: 10000 });
  184 |   });
  185 | 
  186 |   test('pressing Enter sends the message and clears input', async ({ page }) => {
  187 |     await openChat(page);
  188 |     const input = page.locator('textarea').first();
  189 |     await input.fill('What is my balance?');
  190 |     await input.press('Enter');
  191 |     // Input should clear after sending
  192 |     await expect(input).toHaveValue('', { timeout: 3000 });
  193 |     // Message should appear in the chat
  194 |     await expect(page.getByText('What is my balance?')).toBeVisible({ timeout: 5000 });
  195 |   });
  196 | 
  197 |   test('pressing Shift+Enter adds a newline instead of sending', async ({ page }) => {
  198 |     await openChat(page);
  199 |     const input = page.locator('textarea').first();
  200 |     await input.fill('Line one');
  201 |     await input.press('Shift+Enter');
  202 |     // Input should still have content (not cleared)
  203 |     const value = await input.inputValue();
  204 |     expect(value).toContain('Line one');
  205 |   });
  206 | 
  207 |   test('clicking the send button sends the message', async ({ page }) => {
  208 |     await openChat(page);
  209 |     const input = page.locator('textarea').first();
  210 |     await input.fill('Fund performance question');
  211 |     const sendBtn = page.locator('button[type="submit"], button').filter({ hasText: /send/i }).first();
> 212 |     await sendBtn.click();
      |                   ^ Error: locator.click: Test timeout of 40000ms exceeded.
  213 |     await expect(page.getByText('Fund performance question')).toBeVisible({ timeout: 5000 });
  214 |   });
  215 | 
  216 |   test('send button is disabled when input is empty', async ({ page }) => {
  217 |     await openChat(page);
  218 |     const input = page.locator('textarea').first();
  219 |     await input.fill('');
  220 |     const sendBtn = page.locator('button[type="submit"], button').filter({ hasText: /send/i }).first();
  221 |     const isDisabled = await sendBtn.getAttribute('disabled');
  222 |     const opacity = await sendBtn.evaluate(el => getComputedStyle(el).opacity);
  223 |     expect(isDisabled !== null || parseFloat(opacity) < 0.8).toBeTruthy();
  224 |   });
  225 | });
  226 | 
  227 | // ─── MESSAGE RENDERING ────────────────────────────────────────────────────────
  228 | 
  229 | test.describe('Message rendering', () => {
  230 |   test('customer messages appear in the chat body', async ({ page }) => {
  231 |     await openChat(page);
  232 |     const input = page.locator('textarea').first();
  233 |     await input.fill('Test message rendering');
  234 |     await input.press('Enter');
  235 |     await expect(page.getByText('Test message rendering')).toBeVisible({ timeout: 5000 });
  236 |   });
  237 | 
  238 |   test('second message appears after first', async ({ page }) => {
  239 |     await openChat(page);
  240 |     const input = page.locator('textarea').first();
  241 |     await input.fill('First message');
  242 |     await input.press('Enter');
  243 |     await expect(page.getByText('First message')).toBeVisible({ timeout: 5000 });
  244 |     await input.fill('Second message');
  245 |     await input.press('Enter');
  246 |     await expect(page.getByText('Second message')).toBeVisible({ timeout: 5000 });
  247 |   });
  248 | });
  249 | 
  250 | // ─── CHAT PERSISTENCE ACROSS NAVIGATION ──────────────────────────────────────
  251 | 
  252 | test.describe('Chat persistence', () => {
  253 |   test('chat panel stays open when navigating to portfolio', async ({ page }) => {
  254 |     await openChat(page);
  255 |     const input = page.locator('textarea').first();
  256 |     await expect(input).toBeVisible({ timeout: 5000 });
  257 |     // Navigate to portfolio
  258 |     await page.getByRole('link', { name: /portfolio/i }).click();
  259 |     await expect(page).toHaveURL(/portfolio/);
  260 |     // Chat panel should still be open
  261 |     await expect(page.locator('textarea').first()).toBeVisible({ timeout: 5000 });
  262 |   });
  263 | 
  264 |   test('messages are preserved when navigating between pages', async ({ page }) => {
  265 |     await openChat(page);
  266 |     const input = page.locator('textarea').first();
  267 |     await input.fill('Persistent message test');
  268 |     await input.press('Enter');
  269 |     await expect(page.getByText('Persistent message test')).toBeVisible({ timeout: 5000 });
  270 |     // Navigate away
  271 |     await page.getByRole('link', { name: /research/i }).click();
  272 |     // Message should still be visible
  273 |     await expect(page.getByText('Persistent message test')).toBeVisible({ timeout: 5000 });
  274 |   });
  275 | });
  276 | 
  277 | // ─── BOT INTERACTION ──────────────────────────────────────────────────────────
  278 | 
  279 | test.describe('Bot responses', () => {
  280 |   test('typing indicator appears after sending a message', async ({ page }) => {
  281 |     await openChat(page);
  282 |     // Wait for topics to ensure connection is established
  283 |     await waitForTopics(page);
  284 |     const input = page.locator('textarea').first();
  285 |     await input.fill('What is my account balance?');
  286 |     await input.press('Enter');
  287 |     // Look for the typing indicator (animated dots) — it's brief
  288 |     // We primarily verify the message was sent and some response arrives
  289 |     await expect(page.getByText('What is my account balance?')).toBeVisible({ timeout: 5000 });
  290 |     // Wait for any bot/agent reply within 30s
  291 |     const botMsg = page.locator('div').filter({
  292 |       hasText: /balance|account|ira|funds|help/i,
  293 |     }).last();
  294 |     await expect(botMsg).toBeVisible({ timeout: 30000 });
  295 |   });
  296 | 
  297 |   test('topic click triggers bot response', async ({ page }) => {
  298 |     await openChat(page);
  299 |     await waitForTopics(page);
  300 |     const firstTopic = page.locator('button').filter({
  301 |       hasText: /balance|fund|invest|account|portfolio|performance|transaction|trade/i,
  302 |     }).first();
  303 |     await firstTopic.click();
  304 |     // The bot should respond (any content at all in the chat body beyond greeting)
  305 |     await expect(page.locator('div').filter({ hasText: /.{20,}/ }).last()).toBeVisible({ timeout: 30000 });
  306 |   });
  307 | });
  308 | 
```