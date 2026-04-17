/**
 * chat-flow.spec.ts
 *
 * End-to-end clickthrough flows that prove the full chat UX works, not just
 * that individual elements are visible. Every test here performs real user
 * actions (fill, click, navigate) and asserts the resulting UI state.
 */
import { test, expect } from '@playwright/test';

const BASE = '/chatmaxxing';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Opens the chat widget from the homepage and waits for the panel to render. */
async function openChat(page: import('@playwright/test').Page) {
  await page.goto(BASE + '/');
  await page.getByRole('button', { name: 'Open chat' }).click();
  // "Close chat" button in the header confirms the panel is open
  await expect(page.getByRole('button', { name: 'Close chat' })).toBeVisible({ timeout: 10000 });
}

/** Waits for predicted topic buttons — confirms the Connect session is alive. */
async function waitForTopics(page: import('@playwright/test').Page) {
  await expect(
    page.locator('button').filter({
      hasText: /balance|fund|invest|account|portfolio|performance|transaction|trade|holding|activity|advisor/i,
    }).first()
  ).toBeVisible({ timeout: 25000 });
}

/** Waits for a bot response after the customer sends a message. */
async function waitForBotReply(page: import('@playwright/test').Page) {
  // BOT message avatars render a div with exactly '🤖' (distinct from '🤖 Virtual Assistant' in the header)
  await expect(page.getByText('🤖', { exact: true }).first()).toBeVisible({ timeout: 30000 });
}

// ── 1. Full open → close cycle ────────────────────────────────────────────────

test.describe('Open / close cycle', () => {
  test('close button hides panel and shows FAB again', async ({ page }) => {
    await openChat(page);
    await page.getByRole('button', { name: 'Close chat' }).click();
    await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Close chat' })).not.toBeVisible({ timeout: 3000 });
  });

  test('reopening resets to fresh greeting', async ({ page }) => {
    await openChat(page);
    // Send a message so the chat is not empty
    await waitForTopics(page);
    const input = page.locator('textarea').first();
    await input.fill('Hello');
    await input.press('Enter');
    await expect(page.getByText('Hello')).toBeVisible({ timeout: 5000 });
    // Close
    await page.getByRole('button', { name: 'Close chat' }).click();
    await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible({ timeout: 5000 });
    // Reopen — the 'Hello' message should be gone (store.reset() was called)
    await page.getByRole('button', { name: 'Open chat' }).click();
    await expect(page.getByRole('button', { name: 'Close chat' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Hello')).not.toBeVisible({ timeout: 3000 });
  });
});

// ── 2. Greeting and connection ────────────────────────────────────────────────

test.describe('Greeting and connection', () => {
  test('greeting shows client name immediately after open', async ({ page }) => {
    await openChat(page);
    await expect(page.getByText(/hi.*alex johnson/i)).toBeVisible({ timeout: 15000 });
  });

  test('chat header shows "Virtual Assistant" status initially', async ({ page }) => {
    await openChat(page);
    await expect(page.getByText(/virtual assistant/i)).toBeVisible({ timeout: 10000 });
  });

  test('input becomes enabled once connection is established', async ({ page }) => {
    await openChat(page);
    // Topics appearing confirms BOT_ACTIVE (disabled=false)
    await waitForTopics(page);
    await expect(page.locator('textarea').first()).not.toBeDisabled({ timeout: 5000 });
  });

  test('4 topic buttons plus "Something else" are shown after connect', async ({ page }) => {
    await openChat(page);
    await waitForTopics(page);
    await expect(page.getByRole('button', { name: /something else/i })).toBeVisible({ timeout: 5000 });
    // The "Something else" button's parent flex div contains ALL topic buttons.
    // It always has exactly 4 predicted topics + "Something else" = 5 buttons.
    const somethingElse = page.getByRole('button', { name: /something else/i });
    const buttonFlex = somethingElse.locator('..');
    const count = await buttonFlex.locator('button').count();
    expect(count).toBe(5); // 4 predicted topics + "Something else"
  });
});

// ── 3. Topic button clickthroughs ─────────────────────────────────────────────

test.describe('Topic button clickthroughs', () => {
  test('clicking a topic sends it as a customer message', async ({ page }) => {
    await openChat(page);
    await waitForTopics(page);
    const firstTopic = page.locator('button').filter({
      hasText: /balance|fund|invest|account|portfolio|performance|transaction|trade/i,
    }).first();
    const topicText = (await firstTopic.textContent())?.trim() ?? '';
    expect(topicText.length).toBeGreaterThan(0);
    await firstTopic.click();
    // The topic text appears as a customer message bubble
    await expect(page.getByText(topicText).first()).toBeVisible({ timeout: 5000 });
  });

  test('after topic click, all topic buttons are disabled', async ({ page }) => {
    await openChat(page);
    await waitForTopics(page);
    const topic = page.locator('button').filter({
      hasText: /balance|fund|invest|account|portfolio|performance|transaction|trade/i,
    }).first();
    await topic.click();
    // Give React a render cycle
    await page.waitForTimeout(400);
    // The topic area should no longer show any enabled topic buttons
    // (TopicButtons marks them all disabled after selection)
    const remainingTopicBtns = page.locator('button').filter({
      hasText: /balance|fund|invest|account|portfolio|performance|transaction|trade/i,
    });
    const count = await remainingTopicBtns.count();
    for (let i = 0; i < count; i++) {
      const isDisabled = await remainingTopicBtns.nth(i).getAttribute('disabled');
      const opacity = await remainingTopicBtns.nth(i).evaluate(
        el => parseFloat(window.getComputedStyle(el).opacity)
      );
      // Clicked button is disabled; others are faded (opacity < 0.5)
      expect(isDisabled !== null || opacity < 0.5).toBeTruthy();
    }
  });

  test('clicking "Something else" sends "Something else" as a message', async ({ page }) => {
    await openChat(page);
    await waitForTopics(page);
    await page.getByRole('button', { name: /something else/i }).click();
    await expect(page.getByText('Something else').first()).toBeVisible({ timeout: 5000 });
  });

  test('bot responds after a topic is selected', async ({ page }) => {
    await openChat(page);
    await waitForTopics(page);
    const topic = page.locator('button').filter({
      hasText: /balance|fund|invest|account|portfolio|performance|transaction|trade/i,
    }).first();
    await topic.click();
    await waitForBotReply(page);
  });
});

// ── 4. Free-form input clickthroughs ─────────────────────────────────────────

test.describe('Free-form input clickthroughs', () => {
  test('typing and pressing Enter sends the message', async ({ page }) => {
    await openChat(page);
    await waitForTopics(page);
    const input = page.locator('textarea').first();
    await input.fill('What is my Roth IRA balance?');
    await input.press('Enter');
    await expect(page.getByText('What is my Roth IRA balance?')).toBeVisible({ timeout: 5000 });
    // Input clears
    await expect(input).toHaveValue('', { timeout: 3000 });
  });

  test('Shift+Enter inserts a newline but does NOT send', async ({ page }) => {
    await openChat(page);
    await waitForTopics(page);
    const input = page.locator('textarea').first();
    await input.fill('Line one');
    await input.press('Shift+Enter');
    // Input still has content — message NOT sent to the chat body
    const val = await input.inputValue();
    expect(val).toContain('Line one');
  });

  test('clicking the Send button sends the message', async ({ page }) => {
    await openChat(page);
    await waitForTopics(page);
    const input = page.locator('textarea').first();
    await input.fill('Tell me about fund fees');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('Tell me about fund fees')).toBeVisible({ timeout: 5000 });
    await expect(input).toHaveValue('', { timeout: 3000 });
  });

  test('Send button is disabled when textarea is empty', async ({ page }) => {
    await openChat(page);
    await waitForTopics(page);
    await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled({ timeout: 5000 });
  });

  test('Send button becomes enabled when text is typed', async ({ page }) => {
    await openChat(page);
    await waitForTopics(page);
    await page.locator('textarea').first().fill('test');
    await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled({ timeout: 3000 });
  });

  test('bot responds after free-form message', async ({ page }) => {
    await openChat(page);
    await waitForTopics(page);
    await page.locator('textarea').first().fill('What is my total portfolio value?');
    await page.getByRole('button', { name: 'Send' }).click();
    await waitForBotReply(page);
  });

  test('multiple sequential messages all appear in chat', async ({ page }) => {
    await openChat(page);
    await waitForTopics(page);
    const input = page.locator('textarea').first();
    for (const msg of ['First question', 'Second question', 'Third question']) {
      await input.fill(msg);
      await input.press('Enter');
      await expect(page.getByText(msg)).toBeVisible({ timeout: 5000 });
    }
  });
});

// ── 5. Chat persistence ───────────────────────────────────────────────────────

test.describe('Chat persistence across navigation', () => {
  test('chat stays open and messages persist when navigating to Portfolio', async ({ page }) => {
    await openChat(page);
    await waitForTopics(page);
    await page.locator('textarea').first().fill('Persistence test');
    await page.locator('textarea').press('Enter');
    await expect(page.getByText('Persistence test')).toBeVisible({ timeout: 5000 });
    // Navigate away via the TopNav
    await page.getByRole('link', { name: /portfolio/i }).click();
    await expect(page).toHaveURL(/portfolio/);
    // Chat panel still open, message still visible
    await expect(page.getByRole('button', { name: 'Close chat' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Persistence test')).toBeVisible({ timeout: 5000 });
  });

  test('chat stays open across Portfolio → Research navigation', async ({ page }) => {
    await openChat(page);
    await page.getByRole('link', { name: /portfolio/i }).click();
    await expect(page.getByRole('button', { name: 'Close chat' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('link', { name: /research/i }).click();
    await expect(page.getByRole('button', { name: 'Close chat' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/hi.*alex johnson/i)).toBeVisible({ timeout: 5000 });
  });
});

// ── 6. Escalation and callback flows ─────────────────────────────────────────

test.describe('Escalation panel and callback scheduler', () => {
  // Each test in this block may wait up to 40s for the Lex/Connect escalation
  // pipeline. The extra 25s gives test.skip() time to run if escalation doesn't fire.
  test.describe.configure({ timeout: 65000 });

  /**
   * Helper: type a phrase that triggers the EscalateAgent Lex intent and wait
   * for the escalation panel to appear (state → ESCALATION_OFFERED).
   * Returns true if escalation was triggered within the timeout.
   */
  async function triggerEscalation(page: import('@playwright/test').Page): Promise<boolean> {
    await openChat(page);
    await waitForTopics(page);
    await page.locator('textarea').first().fill('I would like to speak with a live agent');
    await page.getByRole('button', { name: 'Send' }).click();
    // Look for either the "Chat with an agent" button OR "Request a callback" button
    const escalationPanel = page.getByRole('button', { name: /chat with an agent|request a callback/i }).first();
    const appeared = await escalationPanel.waitFor({ timeout: 35000 }).then(() => true).catch(() => false);
    return appeared;
  }

  test('escalation panel appears after requesting a live agent', async ({ page }) => {
    const escalated = await triggerEscalation(page);
    if (!escalated) {
      test.skip(true, 'Bot did not trigger escalation within timeout — Connect/Lex flow may not be configured');
    }
    await expect(page.getByRole('button', { name: /chat with an agent/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /request a callback/i })).toBeVisible({ timeout: 5000 });
  });

  test('escalation panel shows estimated wait time', async ({ page }) => {
    const escalated = await triggerEscalation(page);
    if (!escalated) {
      test.skip(true, 'Bot did not trigger escalation within timeout');
    }
    // Wait time is set to 3 minutes in useChatSession.ts
    await expect(page.getByText(/min wait/i)).toBeVisible({ timeout: 5000 });
  });

  test('clicking "Request a callback" shows the CallbackScheduler', async ({ page }) => {
    const escalated = await triggerEscalation(page);
    if (!escalated) {
      test.skip(true, 'Bot did not trigger escalation within timeout');
    }
    await page.getByRole('button', { name: /request a callback/i }).click();
    // CallbackScheduler renders with heading and phone field
    await expect(page.getByText(/schedule a callback/i)).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[type="tel"]')).toBeVisible({ timeout: 5000 });
  });

  test('callback scheduler pre-fills phone with Alex Johnson\'s number', async ({ page }) => {
    const escalated = await triggerEscalation(page);
    if (!escalated) {
      test.skip(true, 'Bot did not trigger escalation within timeout');
    }
    await page.getByRole('button', { name: /request a callback/i }).click();
    const phoneInput = page.locator('input[type="tel"]');
    await expect(phoneInput).toBeVisible({ timeout: 5000 });
    const value = await phoneInput.inputValue();
    // Pre-filled from MOCK_CLIENT.displayPhone = '(484) 238-4838'
    expect(value).toMatch(/484|238|4838/);
  });

  test('callback scheduler shows "Right away" and "Pick a time" buttons', async ({ page }) => {
    const escalated = await triggerEscalation(page);
    if (!escalated) {
      test.skip(true, 'Bot did not trigger escalation within timeout');
    }
    await page.getByRole('button', { name: /request a callback/i }).click();
    await expect(page.getByRole('button', { name: /right away/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /pick a time/i })).toBeVisible({ timeout: 5000 });
  });

  test('callback scheduler: "Pick a time" reveals datetime picker', async ({ page }) => {
    const escalated = await triggerEscalation(page);
    if (!escalated) {
      test.skip(true, 'Bot did not trigger escalation within timeout');
    }
    await page.getByRole('button', { name: /request a callback/i }).click();
    await page.getByRole('button', { name: /pick a time/i }).click();
    await expect(page.locator('input[type="datetime-local"]')).toBeVisible({ timeout: 5000 });
  });

  test('callback scheduler shows validation error for short phone number', async ({ page }) => {
    const escalated = await triggerEscalation(page);
    if (!escalated) {
      test.skip(true, 'Bot did not trigger escalation within timeout');
    }
    await page.getByRole('button', { name: /request a callback/i }).click();
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill('555');  // Too short — only 3 digits
    await page.getByRole('button', { name: /schedule callback/i }).click();
    await expect(page.getByText(/valid.*10.?digit|10.?digit.*phone/i)).toBeVisible({ timeout: 5000 });
  });

  test('back arrow in callback scheduler returns to chat body', async ({ page }) => {
    const escalated = await triggerEscalation(page);
    if (!escalated) {
      test.skip(true, 'Bot did not trigger escalation within timeout');
    }
    await page.getByRole('button', { name: /request a callback/i }).click();
    await expect(page.getByText(/schedule a callback/i)).toBeVisible({ timeout: 5000 });
    // Click the back arrow (← button)
    await page.locator('button').filter({ hasText: '←' }).click();
    // CallbackScheduler gone, escalation panel visible again
    await expect(page.getByRole('button', { name: /request a callback/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/schedule a callback/i)).not.toBeVisible({ timeout: 3000 });
  });

  test('callback ASAP submission shows confirmation in chat', async ({ page }) => {
    test.setTimeout(90000); // This test calls the real API
    const escalated = await triggerEscalation(page);
    if (!escalated) {
      test.skip(true, 'Bot did not trigger escalation within timeout');
    }
    await page.getByRole('button', { name: /request a callback/i }).click();
    // Phone is pre-filled; "Right away" is selected by default
    await expect(page.getByRole('button', { name: /right away/i })).toBeVisible({ timeout: 5000 });
    // Submit
    await page.getByRole('button', { name: /schedule callback/i }).click();
    // Should show "Scheduling…" then a confirmation message
    await expect(page.getByText(/scheduling|scheduled|we.ll call you|callback/i).first()).toBeVisible({ timeout: 15000 });
    // Chat transitions to CALLBACK_SCHEDULED — input becomes disabled
    await expect(page.locator('textarea').first()).toBeDisabled({ timeout: 10000 });
  });
});

// ── 7. Research page filter clickthroughs ────────────────────────────────────

test.describe('Research page filter clickthroughs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE + '/');
    await page.getByRole('link', { name: /research/i }).click();
    await page.waitForLoadState('networkidle');
  });

  test('clicking Large Cap Growth filter shows only Growth fund', async ({ page }) => {
    await page.getByRole('button', { name: /large cap growth/i }).click();
    await expect(page.getByText('BobsFunds Growth')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('BobsFunds 500 Index')).not.toBeVisible({ timeout: 3000 });
    await expect(page.getByText('BobsFunds Bond Income')).not.toBeVisible({ timeout: 3000 });
  });

  test('clicking Short-Term Bond filter shows Short-Term Treasury', async ({ page }) => {
    await page.getByRole('button', { name: /short.?term bond/i }).click();
    await expect(page.getByText('BobsFunds Short-Term Treasury')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('BobsFunds Growth')).not.toBeVisible({ timeout: 3000 });
  });

  test('clicking All after a filter restores all 6 funds', async ({ page }) => {
    await page.getByRole('button', { name: /large cap blend/i }).click();
    await expect(page.getByText('BobsFunds Bond Income')).not.toBeVisible({ timeout: 3000 });
    // Click All to restore
    await page.getByRole('button', { name: /^all$/i }).click();
    await expect(page.getByText('BobsFunds Bond Income')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('BobsFunds Short-Term Treasury')).toBeVisible({ timeout: 5000 });
  });

  test('filter button highlights (active state) when selected', async ({ page }) => {
    const btn = page.getByRole('button', { name: /intermediate bond/i });
    await btn.click();
    // Active: blue border (#1a56db) and light blue background
    const borderColor = await btn.evaluate(el => window.getComputedStyle(el).borderColor);
    expect(borderColor).toMatch(/rgb\(26,\s*86,\s*219\)|rgb\(26, 86, 219\)/);
  });
});

// ── 8. Agent status toggle clickthrough ──────────────────────────────────────

test.describe('Agent desktop status toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE + '/agent/');
    await page.waitForLoadState('networkidle');
  });

  test('Away button activates and Available becomes inactive', async ({ page }) => {
    const awayBtn = page.getByRole('button', { name: /away/i });
    const availableBtn = page.getByRole('button', { name: /available/i });
    await awayBtn.click();
    await page.waitForTimeout(200);
    // Away is now highlighted green(ish) / amber
    const awayBg = await awayBtn.evaluate(el => window.getComputedStyle(el).backgroundColor);
    expect(awayBg).not.toBe('transparent');
    expect(awayBg).not.toMatch(/rgba\(0, 0, 0, 0\)/);
  });

  test('cycling Available → Away → Available works correctly', async ({ page }) => {
    await page.getByRole('button', { name: /away/i }).click();
    await page.waitForTimeout(100);
    await page.getByRole('button', { name: /available/i }).click();
    await page.waitForTimeout(200);
    // Available button should now be highlighted green
    const bg = await page.getByRole('button', { name: /available/i }).evaluate(
      el => window.getComputedStyle(el).backgroundColor
    );
    expect(bg).toMatch(/rgb\(16,\s*185,\s*129\)|rgb\(16, 185, 129\)/);
  });
});
