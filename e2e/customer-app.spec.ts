import { test, expect } from '@playwright/test';

const BASE = 'https://ferrarajc.github.io/chatmaxxing';
const API = 'https://0y3s5vq2v5.execute-api.us-east-1.amazonaws.com';

test.describe('Customer App', () => {

  test('homepage loads with correct title and chat FAB', async ({ page }) => {
    await page.goto(BASE + '/');
    await expect(page).toHaveTitle("Bob's Mutual Funds");
    await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible({ timeout: 10000 });
  });

  test('navigation between pages works', async ({ page }) => {
    await page.goto(BASE + '/');
    await page.getByRole('link', { name: /portfolio/i }).click();
    await expect(page).toHaveURL(/portfolio/);
    await page.getByRole('link', { name: /research/i }).click();
    await expect(page).toHaveURL(/research/);
  });

  test('chat widget opens on FAB click', async ({ page }) => {
    await page.goto(BASE + '/');
    await page.getByRole('button', { name: 'Open chat' }).click();
    // Panel should open — look for an input or close button
    await expect(
      page.locator('input[placeholder], textarea, button[aria-label*="close" i], button[aria-label*="minimize" i]').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('chat widget shows predicted topics after open', async ({ page }) => {
    await page.goto(BASE + '/');
    await page.getByRole('button', { name: 'Open chat' }).click();
    // Topics should appear within 15s (predict-intent call + Connect start-chat)
    await expect(page.locator('button').filter({ hasText: /balance|fund|invest|account|portfolio|performance/i }).first())
      .toBeVisible({ timeout: 20000 });
  });

  test('predict-intent API returns 4 topics for portfolio page', async ({ request }) => {
    const res = await request.post(`${API}/predict-intent`, {
      data: { clientId: 'demo-client-001', currentPage: 'portfolio' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.topics)).toBeTruthy();
    expect(body.topics).toHaveLength(4);
    body.topics.forEach((t: string) => expect(t.length).toBeGreaterThan(0));
  });

  test('next-best-response API returns a suggestion', async ({ request }) => {
    const res = await request.post(`${API}/next-best-response`, {
      data: {
        transcript: [{ role: 'customer', content: 'What is my account balance?' }],
        clientProfile: {
          clientId: 'demo-client-001',
          name: 'Alex Johnson',
          totalBalance: 241570,
          accounts: [
            { type: 'Roth IRA', balance: 45230 },
            { type: 'Traditional IRA', balance: 128450 },
            { type: 'Taxable Account', balance: 67890 },
          ],
        },
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(typeof body.suggestedText).toBe('string');
    expect(body.suggestedText.length).toBeGreaterThan(10);
  });

  test('schedule-callback API rejects missing required fields', async ({ request }) => {
    const res = await request.post(`${API}/schedule-callback`, {
      data: { phoneNumber: '4842384838' }, // missing clientId
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

});
