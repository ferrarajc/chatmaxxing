import { test, expect } from '@playwright/test';

const API = 'https://0y3s5vq2v5.execute-api.us-east-1.amazonaws.com';

const MOCK_CLIENT_PROFILE = {
  clientId: 'demo-client-001',
  name: 'Alex Johnson',
  phone: '4842384838',
  totalBalance: 241570,
  accounts: [
    { type: 'Roth IRA', balance: 45230, id: 'acc-001' },
    { type: 'Traditional IRA', balance: 128450, id: 'acc-002' },
    { type: 'Taxable Account', balance: 67890, id: 'acc-003' },
  ],
  recentChatHistory: [],
};

// ─── POST /start-chat ─────────────────────────────────────────────────────────

test.describe('POST /start-chat', () => {
  test('returns 200 with participantToken, contactId, participantId', async ({ request }) => {
    const res = await request.post(`${API}/start-chat`, {
      data: {
        clientId: 'demo-client-001',
        clientName: 'Alex Johnson',
        currentPage: 'home',
      },
    });
    expect(res.ok(), `Expected 200, got ${res.status()}`).toBeTruthy();
    const body = await res.json();
    expect(typeof body.participantToken).toBe('string');
    expect(body.participantToken.length).toBeGreaterThan(10);
    expect(typeof body.contactId).toBe('string');
    expect(body.contactId.length).toBeGreaterThan(0);
    expect(typeof body.participantId).toBe('string');
    expect(body.participantId.length).toBeGreaterThan(0);
  });

  test('returns 200 for portfolio page', async ({ request }) => {
    const res = await request.post(`${API}/start-chat`, {
      data: {
        clientId: 'demo-client-001',
        clientName: 'Alex Johnson',
        currentPage: 'portfolio',
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(typeof body.contactId).toBe('string');
  });

  test('returns 400 when clientId is missing', async ({ request }) => {
    const res = await request.post(`${API}/start-chat`, {
      data: { clientName: 'Alex Johnson', currentPage: 'home' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('returns 400 when clientName is missing', async ({ request }) => {
    const res = await request.post(`${API}/start-chat`, {
      data: { clientId: 'demo-client-001', currentPage: 'home' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('returns 400 when both clientId and clientName are missing', async ({ request }) => {
    const res = await request.post(`${API}/start-chat`, {
      data: { currentPage: 'home' },
    });
    expect(res.status()).toBe(400);
  });

  test('currentPage defaults gracefully when omitted', async ({ request }) => {
    const res = await request.post(`${API}/start-chat`, {
      data: { clientId: 'demo-client-001', clientName: 'Alex Johnson' },
    });
    expect(res.ok()).toBeTruthy();
  });
});

// ─── POST /predict-intent ─────────────────────────────────────────────────────

test.describe('POST /predict-intent', () => {
  const pages = ['home', 'portfolio', 'research', 'account'];

  for (const currentPage of pages) {
    test(`returns 4 non-empty topics for "${currentPage}" page`, async ({ request }) => {
      const res = await request.post(`${API}/predict-intent`, {
        data: { clientId: 'demo-client-001', currentPage },
      });
      expect(res.ok(), `Expected 200, got ${res.status()} for page=${currentPage}`).toBeTruthy();
      const body = await res.json();
      expect(Array.isArray(body.topics), 'body.topics should be an array').toBeTruthy();
      expect(body.topics).toHaveLength(4);
      for (const topic of body.topics) {
        expect(typeof topic).toBe('string');
        expect(topic.trim().length).toBeGreaterThan(0);
      }
    });
  }

  test('topics for portfolio page are relevant to portfolio', async ({ request }) => {
    const res = await request.post(`${API}/predict-intent`, {
      data: { clientId: 'demo-client-001', currentPage: 'portfolio' },
    });
    const body = await res.json();
    const allTopics = body.topics.join(' ').toLowerCase();
    // At least one topic should relate to balance, trade, performance, or transactions
    expect(allTopics).toMatch(/balance|trade|performance|transaction|fund/i);
  });

  test('topics for research page are relevant to research', async ({ request }) => {
    const res = await request.post(`${API}/predict-intent`, {
      data: { clientId: 'demo-client-001', currentPage: 'research' },
    });
    const body = await res.json();
    const allTopics = body.topics.join(' ').toLowerCase();
    expect(allTopics).toMatch(/fund|perform|compare|esg|bond|index/i);
  });

  test('returns 200 without clientId (uses fallback topics)', async ({ request }) => {
    const res = await request.post(`${API}/predict-intent`, {
      data: { currentPage: 'home' },
    });
    // Should still succeed with fallback topics
    expect(res.status()).toBeLessThan(500);
  });
});

// ─── POST /next-best-response ─────────────────────────────────────────────────

test.describe('POST /next-best-response', () => {
  test('returns suggestedText for balance inquiry', async ({ request }) => {
    const res = await request.post(`${API}/next-best-response`, {
      data: {
        transcript: [{ role: 'CUSTOMER', content: 'What is my account balance?' }],
        clientProfile: MOCK_CLIENT_PROFILE,
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(typeof body.suggestedText).toBe('string');
    expect(body.suggestedText.length).toBeGreaterThan(10);
  });

  test('returns suggestedText for fund performance inquiry', async ({ request }) => {
    const res = await request.post(`${API}/next-best-response`, {
      data: {
        transcript: [{ role: 'CUSTOMER', content: 'How is my BobsFunds 500 Index doing?' }],
        clientProfile: MOCK_CLIENT_PROFILE,
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(typeof body.suggestedText).toBe('string');
    expect(body.suggestedText.length).toBeGreaterThan(10);
  });

  test('returns resources array (can be empty)', async ({ request }) => {
    const res = await request.post(`${API}/next-best-response`, {
      data: {
        transcript: [{ role: 'CUSTOMER', content: 'What is my account balance?' }],
        clientProfile: MOCK_CLIENT_PROFILE,
      },
    });
    const body = await res.json();
    expect(Array.isArray(body.resources)).toBeTruthy();
  });

  test('returns IRA-related resources for IRA question', async ({ request }) => {
    const res = await request.post(`${API}/next-best-response`, {
      data: {
        transcript: [{ role: 'CUSTOMER', content: 'What are the IRA contribution limits for this year?' }],
        clientProfile: MOCK_CLIENT_PROFILE,
      },
    });
    const body = await res.json();
    expect(Array.isArray(body.resources)).toBeTruthy();
    if (body.resources.length > 0) {
      const titles = body.resources.map((r: { title: string }) => r.title.toLowerCase()).join(' ');
      expect(titles).toMatch(/ira|contribution|roth|traditional/i);
    }
  });

  test('returns tax-related resources for tax question', async ({ request }) => {
    const res = await request.post(`${API}/next-best-response`, {
      data: {
        transcript: [{ role: 'CUSTOMER', content: 'When will I receive my 1099 tax documents?' }],
        clientProfile: MOCK_CLIENT_PROFILE,
      },
    });
    const body = await res.json();
    if (body.resources.length > 0) {
      const titles = body.resources.map((r: { title: string }) => r.title.toLowerCase()).join(' ');
      expect(titles).toMatch(/tax|1099|document/i);
    }
  });

  test('handles multi-turn transcript', async ({ request }) => {
    const res = await request.post(`${API}/next-best-response`, {
      data: {
        transcript: [
          { role: 'CUSTOMER', content: 'What is my account balance?' },
          { role: 'AGENT', content: 'Your total balance is $241,570.' },
          { role: 'CUSTOMER', content: 'Can you break that down by account type?' },
        ],
        clientProfile: MOCK_CLIENT_PROFILE,
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.suggestedText.length).toBeGreaterThan(10);
  });

  test('returns 400 when transcript is missing', async ({ request }) => {
    const res = await request.post(`${API}/next-best-response`, {
      data: { clientProfile: MOCK_CLIENT_PROFILE },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('returns 400 when transcript is empty array', async ({ request }) => {
    const res = await request.post(`${API}/next-best-response`, {
      data: { transcript: [], clientProfile: MOCK_CLIENT_PROFILE },
    });
    expect(res.status()).toBe(400);
  });
});

// ─── POST /schedule-callback ──────────────────────────────────────────────────

test.describe('POST /schedule-callback', () => {
  test('returns 200 with callbackId for ASAP request', async ({ request }) => {
    const res = await request.post(`${API}/schedule-callback`, {
      data: {
        clientId: 'demo-client-001',
        phoneNumber: '4842384838',
        scheduledTime: 'ASAP',
        intentSummary: 'Client requested callback via automated test',
      },
    });
    expect(res.ok(), `Expected 200, got ${res.status()}: ${await res.text()}`).toBeTruthy();
    const body = await res.json();
    expect(typeof body.callbackId).toBe('string');
    expect(body.callbackId.length).toBeGreaterThan(0);
    expect(body.message).toBeTruthy();
  });

  test('ASAP response includes a scheduled time', async ({ request }) => {
    const res = await request.post(`${API}/schedule-callback`, {
      data: {
        clientId: 'demo-client-001',
        phoneNumber: '4842384838',
        scheduledTime: 'ASAP',
        intentSummary: 'Automated test',
      },
    });
    const body = await res.json();
    expect(body.scheduledTime).toBeTruthy();
    // Should be a valid ISO timestamp roughly 2 minutes from now
    const scheduled = new Date(body.scheduledTime).getTime();
    const now = Date.now();
    expect(scheduled).toBeGreaterThan(now);
    expect(scheduled).toBeLessThan(now + 10 * 60 * 1000); // within 10 minutes
  });

  test('returns 400 when clientId is missing', async ({ request }) => {
    const res = await request.post(`${API}/schedule-callback`, {
      data: {
        phoneNumber: '4842384838',
        scheduledTime: 'ASAP',
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('returns 400 when phoneNumber is missing', async ({ request }) => {
    const res = await request.post(`${API}/schedule-callback`, {
      data: {
        clientId: 'demo-client-001',
        scheduledTime: 'ASAP',
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('returns 400 when both clientId and phoneNumber are missing', async ({ request }) => {
    const res = await request.post(`${API}/schedule-callback`, {
      data: { scheduledTime: 'ASAP' },
    });
    expect(res.status()).toBe(400);
  });

  test('returns 400 for scheduled time outside business hours (midnight ET)', async ({ request }) => {
    // Use a future date at 2:00 AM ET — well outside business hours
    // Pick next Monday at 02:00 ET (UTC-4 in summer / UTC-5 in winter)
    const nextMonday = new Date();
    nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7));
    nextMonday.setHours(7, 0, 0, 0); // 07:00 local → ~02:00 ET in EST
    // Use an explicit off-hours ISO string: next Monday, 01:00 UTC = 8pm ET previous night edge, use 06:00 UTC
    const offHours = new Date(nextMonday);
    offHours.setUTCHours(7, 0, 0, 0); // 7:00 AM UTC = 3:00 AM ET (EST) — outside hours

    const res = await request.post(`${API}/schedule-callback`, {
      data: {
        clientId: 'demo-client-001',
        phoneNumber: '4842384838',
        scheduledTime: offHours.toISOString(),
        intentSummary: 'Test outside hours',
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/business hours|outside|weekend|Mon/i);
  });

  test('returns 400 for scheduled time on a weekend', async ({ request }) => {
    // Find next Saturday
    const d = new Date();
    const day = d.getDay();
    const daysUntilSat = (6 - day + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntilSat);
    d.setUTCHours(14, 0, 0, 0); // 10 AM ET — normally business hours but weekend

    const res = await request.post(`${API}/schedule-callback`, {
      data: {
        clientId: 'demo-client-001',
        phoneNumber: '4842384838',
        scheduledTime: d.toISOString(),
        intentSummary: 'Test weekend',
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});

// ─── POST /autopilot-turn ─────────────────────────────────────────────────────

test.describe('POST /autopilot-turn', () => {
  test('returns response and shouldExitAutopilot flag', async ({ request }) => {
    const res = await request.post(`${API}/autopilot-turn`, {
      data: {
        transcript: [
          { role: 'CUSTOMER', content: 'What is my Roth IRA balance?', timestamp: Date.now() },
        ],
        clientProfile: MOCK_CLIENT_PROFILE,
        currentIntent: 'AccountBalance',
      },
    });
    expect(res.ok(), `Expected 200, got ${res.status()}`).toBeTruthy();
    const body = await res.json();
    expect(typeof body.response).toBe('string');
    expect(body.response.length).toBeGreaterThan(5);
    expect(typeof body.shouldExitAutopilot).toBe('boolean');
  });

  test('returns confidence score between 0 and 1', async ({ request }) => {
    const res = await request.post(`${API}/autopilot-turn`, {
      data: {
        transcript: [
          { role: 'CUSTOMER', content: 'What is my account balance?', timestamp: Date.now() },
        ],
        clientProfile: MOCK_CLIENT_PROFILE,
        currentIntent: 'AccountBalance',
      },
    });
    const body = await res.json();
    expect(typeof body.confidence).toBe('number');
    expect(body.confidence).toBeGreaterThanOrEqual(0);
    expect(body.confidence).toBeLessThanOrEqual(1);
  });

  test('requests to place a trade should exit autopilot', async ({ request }) => {
    const res = await request.post(`${API}/autopilot-turn`, {
      data: {
        transcript: [
          { role: 'CUSTOMER', content: 'I want to buy $10,000 of BobsFunds Growth right now', timestamp: Date.now() },
        ],
        clientProfile: MOCK_CLIENT_PROFILE,
        currentIntent: 'PlaceOrder',
      },
    });
    const body = await res.json();
    // Trade execution should require agent → shouldExitAutopilot = true
    expect(body.shouldExitAutopilot).toBe(true);
  });

  test('returns 400 when transcript is missing', async ({ request }) => {
    const res = await request.post(`${API}/autopilot-turn`, {
      data: { clientProfile: MOCK_CLIENT_PROFILE, currentIntent: 'AccountBalance' },
    });
    expect(res.status()).toBe(400);
  });

  test('works without connectionToken (no message sent to Connect)', async ({ request }) => {
    const res = await request.post(`${API}/autopilot-turn`, {
      data: {
        transcript: [
          { role: 'CUSTOMER', content: 'How are my investments doing?', timestamp: Date.now() },
        ],
        clientProfile: MOCK_CLIENT_PROFILE,
        currentIntent: 'FundPerformance',
        // No connectionToken — just returns the response
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(typeof body.response).toBe('string');
  });
});

// ─── POST /agent-connection ───────────────────────────────────────────────────

test.describe('POST /agent-connection', () => {
  test('returns 400 when participantToken is missing', async ({ request }) => {
    const res = await request.post(`${API}/agent-connection`, {
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('returns 400 when body is empty', async ({ request }) => {
    const res = await request.post(`${API}/agent-connection`, {
      data: '',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('returns 4xx/5xx for invalid (fake) participantToken', async ({ request }) => {
    const res = await request.post(`${API}/agent-connection`, {
      data: { participantToken: 'this-is-not-a-real-token' },
    });
    // Connect will reject with error; we just verify the API handles it
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});

// ─── CORS HEADERS ─────────────────────────────────────────────────────────────

test.describe('CORS headers', () => {
  test('predict-intent allows cross-origin requests', async ({ request }) => {
    const res = await request.post(`${API}/predict-intent`, {
      data: { clientId: 'demo-client-001', currentPage: 'home' },
      headers: { Origin: 'https://ferrarajc.github.io' },
    });
    expect(res.ok()).toBeTruthy();
    // CORS headers should allow GitHub Pages origin or wildcard
    const corsHeader = res.headers()['access-control-allow-origin'];
    expect(corsHeader).toBeTruthy();
  });

  test('next-best-response allows cross-origin requests', async ({ request }) => {
    const res = await request.post(`${API}/next-best-response`, {
      data: {
        transcript: [{ role: 'CUSTOMER', content: 'Hello' }],
        clientProfile: MOCK_CLIENT_PROFILE,
      },
      headers: { Origin: 'https://ferrarajc.github.io' },
    });
    expect(res.ok()).toBeTruthy();
    const corsHeader = res.headers()['access-control-allow-origin'];
    expect(corsHeader).toBeTruthy();
  });
});

// ─── RESPONSE TIME PERFORMANCE ────────────────────────────────────────────────

test.describe('API response times', () => {
  test('predict-intent responds within 10 seconds', async ({ request }) => {
    const start = Date.now();
    const res = await request.post(`${API}/predict-intent`, {
      data: { clientId: 'demo-client-001', currentPage: 'home' },
    });
    const elapsed = Date.now() - start;
    expect(res.ok()).toBeTruthy();
    expect(elapsed).toBeLessThan(10000);
  });

  test('next-best-response responds within 10 seconds', async ({ request }) => {
    const start = Date.now();
    const res = await request.post(`${API}/next-best-response`, {
      data: {
        transcript: [{ role: 'CUSTOMER', content: 'What is my balance?' }],
        clientProfile: MOCK_CLIENT_PROFILE,
      },
    });
    const elapsed = Date.now() - start;
    expect(res.ok()).toBeTruthy();
    expect(elapsed).toBeLessThan(10000);
  });

  test('schedule-callback ASAP responds within 8 seconds', async ({ request }) => {
    const start = Date.now();
    const res = await request.post(`${API}/schedule-callback`, {
      data: {
        clientId: 'demo-client-001',
        phoneNumber: '4842384838',
        scheduledTime: 'ASAP',
        intentSummary: 'Performance test',
      },
    });
    const elapsed = Date.now() - start;
    expect(res.ok()).toBeTruthy();
    expect(elapsed).toBeLessThan(8000);
  });
});
