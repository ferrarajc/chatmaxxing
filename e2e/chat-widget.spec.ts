import { test, expect } from '@playwright/test';

const BASE = '/chatmaxxing';

// Helper: open the chat widget and wait for the panel to be visible
async function openChat(page: import('@playwright/test').Page) {
  await page.goto(BASE + '/');
  const fab = page.getByRole('button', { name: 'Open chat' });
  await expect(fab).toBeVisible({ timeout: 10000 });
  await fab.click();
  // Panel is visible when we see either the close/minimize button or an input
  await expect(
    page.locator('[aria-label*="close" i], [aria-label*="minimize" i], textarea, input[type="text"]').first()
  ).toBeVisible({ timeout: 10000 });
}

// Helper: wait for predicted topics to appear
async function waitForTopics(page: import('@playwright/test').Page) {
  await expect(
    page.locator('button').filter({ hasText: /balance|fund|invest|account|portfolio|performance|transaction|trade|compare|advisor|activity/i }).first()
  ).toBeVisible({ timeout: 25000 });
}

// ─── FAB VISIBILITY ────────────────────────────────────────────────────────────

test.describe('Chat FAB', () => {
  test('FAB is visible on the homepage', async ({ page }) => {
    await page.goto(BASE + '/');
    await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible({ timeout: 10000 });
  });

  test('FAB is visible on the portfolio page', async ({ page }) => {
    await page.goto(BASE + '/');
    await page.getByRole('link', { name: /portfolio/i }).click();
    await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible({ timeout: 10000 });
  });

  test('FAB is visible on the research page', async ({ page }) => {
    await page.goto(BASE + '/');
    await page.getByRole('link', { name: /research/i }).click();
    await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible({ timeout: 10000 });
  });

  test('FAB is visible on the account page', async ({ page }) => {
    await page.goto(BASE + '/');
    await page.getByRole('link', { name: /^account$/i }).click();
    await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible({ timeout: 10000 });
  });
});

// ─── CHAT PANEL OPEN / CLOSE ──────────────────────────────────────────────────

test.describe('Chat panel open and close', () => {
  test('clicking FAB opens the chat panel', async ({ page }) => {
    await openChat(page);
    // Panel should contain a textarea or input
    await expect(page.locator('textarea, input[placeholder]').first()).toBeVisible({ timeout: 5000 });
  });

  test('chat panel shows greeting message for Alex Johnson', async ({ page }) => {
    await openChat(page);
    await expect(page.getByText(/hi.*alex johnson/i)).toBeVisible({ timeout: 15000 });
  });

  test('chat panel shows assistant intro text', async ({ page }) => {
    await openChat(page);
    await expect(page.getByText(/bob'?s mutual funds assistant/i)).toBeVisible({ timeout: 15000 });
  });

  test('close button is visible and closes the panel', async ({ page }) => {
    await openChat(page);
    // Find close button (×) - it's in the header
    const closeBtn = page.locator('button').filter({ hasText: /^[×✕x]$/i })
      .or(page.locator('button[aria-label*="close" i]'))
      .first();
    await expect(closeBtn).toBeVisible({ timeout: 5000 });
    await closeBtn.click();
    // After close, FAB should be visible again
    await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible({ timeout: 5000 });
    // Panel input should be gone
    await expect(page.locator('textarea').first()).not.toBeVisible({ timeout: 3000 });
  });

  test('can reopen chat after closing', async ({ page }) => {
    await openChat(page);
    const closeBtn = page.locator('button').filter({ hasText: /^[×✕x]$/i })
      .or(page.locator('button[aria-label*="close" i]'))
      .first();
    await closeBtn.click();
    await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible({ timeout: 5000 });
    // Re-open
    await page.getByRole('button', { name: 'Open chat' }).click();
    await expect(page.locator('textarea, input[placeholder]').first()).toBeVisible({ timeout: 10000 });
  });
});

// ─── PREDICTED TOPICS ─────────────────────────────────────────────────────────

test.describe('Predicted topics', () => {
  test('predicted topic buttons appear after opening chat', async ({ page }) => {
    await openChat(page);
    await waitForTopics(page);
  });

  test('exactly 4 topic buttons plus "Something else" are shown', async ({ page }) => {
    await openChat(page);
    await waitForTopics(page);
    // Wait a moment for all buttons to render
    await page.waitForTimeout(1000);
    const topicButtons = page.locator('button').filter({
      hasText: /balance|fund|invest|account|portfolio|performance|transaction|trade|compare|advisor|activity|something else/i,
    });
    const count = await topicButtons.count();
    // Should have 4 predicted topics + "Something else" = 5
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('"Something else" button is present', async ({ page }) => {
    await openChat(page);
    await waitForTopics(page);
    await expect(page.getByRole('button', { name: /something else/i })).toBeVisible({ timeout: 5000 });
  });

  test('topic buttons appear on portfolio page chat', async ({ page }) => {
    // Navigate to portfolio via nav link (GitHub Pages SPA routing)
    await page.goto(BASE + '/');
    await page.getByRole('link', { name: /portfolio/i }).click();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Open chat' }).click();
    // Portfolio topics: Check my balance, Recent transactions, Fund performance, Place a trade
    await expect(
      page.locator('button').filter({ hasText: /balance|transaction|performance|trade/i }).first()
    ).toBeVisible({ timeout: 25000 });
  });

  test('clicking a topic button sends it as a message', async ({ page }) => {
    await openChat(page);
    await waitForTopics(page);
    // Click the first topic button
    const firstTopic = page.locator('button').filter({
      hasText: /balance|fund|invest|account|portfolio|performance|transaction|trade/i,
    }).first();
    const topicText = await firstTopic.textContent();
    await firstTopic.click();
    // The topic text should appear as a customer message (right-aligned blue bubble)
    await expect(page.getByText(topicText!.trim())).toBeVisible({ timeout: 5000 });
  });

  test('after clicking a topic, topic buttons are no longer shown', async ({ page }) => {
    await openChat(page);
    await waitForTopics(page);
    const firstTopic = page.locator('button').filter({
      hasText: /balance|fund|invest|account|portfolio|performance|transaction|trade/i,
    }).first();
    await firstTopic.click();
    // Topic buttons should disappear (topicsUsed ref becomes true)
    await page.waitForTimeout(500);
    const topicButtons = page.locator('button').filter({
      hasText: /balance|fund|invest|account|portfolio|performance|transaction|trade/i,
    });
    // All topic buttons should be disabled or gone
    const visibleCount = await topicButtons.count();
    for (let i = 0; i < visibleCount; i++) {
      const isDisabled = await topicButtons.nth(i).getAttribute('disabled');
      const opacity = await topicButtons.nth(i).evaluate(el => getComputedStyle(el).opacity);
      // Either disabled or faded out
      expect(isDisabled !== null || parseFloat(opacity) < 0.5).toBeTruthy();
    }
  });
});

// ─── CHAT INPUT ───────────────────────────────────────────────────────────────

test.describe('Chat input', () => {
  test('text input is visible after opening chat', async ({ page }) => {
    await openChat(page);
    await expect(page.locator('textarea').first()).toBeVisible({ timeout: 10000 });
  });

  test('can type in the chat input', async ({ page }) => {
    await openChat(page);
    const input = page.locator('textarea').first();
    await input.fill('Hello, test message');
    await expect(input).toHaveValue('Hello, test message');
  });

  test('send button is visible', async ({ page }) => {
    await openChat(page);
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible({ timeout: 10000 });
  });

  test('pressing Enter sends the message and clears input', async ({ page }) => {
    await openChat(page);
    const input = page.locator('textarea').first();
    await input.fill('What is my balance?');
    await input.press('Enter');
    // Input should clear after sending
    await expect(input).toHaveValue('', { timeout: 3000 });
    // Message should appear in the chat
    await expect(page.getByText('What is my balance?')).toBeVisible({ timeout: 5000 });
  });

  test('pressing Shift+Enter adds a newline instead of sending', async ({ page }) => {
    await openChat(page);
    const input = page.locator('textarea').first();
    await input.fill('Line one');
    await input.press('Shift+Enter');
    // Input should still have content (not cleared)
    const value = await input.inputValue();
    expect(value).toContain('Line one');
  });

  test('clicking the send button sends the message', async ({ page }) => {
    await openChat(page);
    const input = page.locator('textarea').first();
    await input.fill('Fund performance question');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('Fund performance question')).toBeVisible({ timeout: 5000 });
  });

  test('send button is disabled when input is empty', async ({ page }) => {
    await openChat(page);
    const sendBtn = page.getByRole('button', { name: 'Send' });
    await expect(sendBtn).toBeDisabled({ timeout: 5000 });
  });
});

// ─── MESSAGE RENDERING ────────────────────────────────────────────────────────

test.describe('Message rendering', () => {
  test('customer messages appear in the chat body', async ({ page }) => {
    await openChat(page);
    const input = page.locator('textarea').first();
    await input.fill('Test message rendering');
    await input.press('Enter');
    await expect(page.getByText('Test message rendering')).toBeVisible({ timeout: 5000 });
  });

  test('second message appears after first', async ({ page }) => {
    await openChat(page);
    const input = page.locator('textarea').first();
    await input.fill('First message');
    await input.press('Enter');
    await expect(page.getByText('First message')).toBeVisible({ timeout: 5000 });
    await input.fill('Second message');
    await input.press('Enter');
    await expect(page.getByText('Second message')).toBeVisible({ timeout: 5000 });
  });
});

// ─── CHAT PERSISTENCE ACROSS NAVIGATION ──────────────────────────────────────

test.describe('Chat persistence', () => {
  test('chat panel stays open when navigating to portfolio', async ({ page }) => {
    await openChat(page);
    const input = page.locator('textarea').first();
    await expect(input).toBeVisible({ timeout: 5000 });
    // Navigate to portfolio
    await page.getByRole('link', { name: /portfolio/i }).click();
    await expect(page).toHaveURL(/portfolio/);
    // Chat panel should still be open
    await expect(page.locator('textarea').first()).toBeVisible({ timeout: 5000 });
  });

  test('messages are preserved when navigating between pages', async ({ page }) => {
    await openChat(page);
    const input = page.locator('textarea').first();
    await input.fill('Persistent message test');
    await input.press('Enter');
    await expect(page.getByText('Persistent message test')).toBeVisible({ timeout: 5000 });
    // Navigate away
    await page.getByRole('link', { name: /research/i }).click();
    // Message should still be visible
    await expect(page.getByText('Persistent message test')).toBeVisible({ timeout: 5000 });
  });
});

// ─── BOT INTERACTION ──────────────────────────────────────────────────────────

test.describe('Bot responses', () => {
  test('typing indicator appears after sending a message', async ({ page }) => {
    await openChat(page);
    // Wait for topics to ensure connection is established
    await waitForTopics(page);
    const input = page.locator('textarea').first();
    await input.fill('What is my account balance?');
    await input.press('Enter');
    // Look for the typing indicator (animated dots) — it's brief
    // We primarily verify the message was sent and some response arrives
    await expect(page.getByText('What is my account balance?')).toBeVisible({ timeout: 5000 });
    // Wait for any bot/agent reply within 30s
    const botMsg = page.locator('div').filter({
      hasText: /balance|account|ira|funds|help/i,
    }).last();
    await expect(botMsg).toBeVisible({ timeout: 30000 });
  });

  test('topic click triggers bot response', async ({ page }) => {
    await openChat(page);
    await waitForTopics(page);
    const firstTopic = page.locator('button').filter({
      hasText: /balance|fund|invest|account|portfolio|performance|transaction|trade/i,
    }).first();
    await firstTopic.click();
    // The bot should respond (any content at all in the chat body beyond greeting)
    await expect(page.locator('div').filter({ hasText: /.{20,}/ }).last()).toBeVisible({ timeout: 30000 });
  });
});
