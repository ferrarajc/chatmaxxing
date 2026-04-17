# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api.spec.ts >> POST /autopilot-turn >> returns 400 when transcript is missing
- Location: e2e\api.spec.ts:400:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 400
Received: 200
```

# Test source

```ts
  304 |   test('returns 400 for scheduled time outside business hours (midnight ET)', async ({ request }) => {
  305 |     // Use a future date at 2:00 AM ET — well outside business hours
  306 |     // Pick next Monday at 02:00 ET (UTC-4 in summer / UTC-5 in winter)
  307 |     const nextMonday = new Date();
  308 |     nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7));
  309 |     nextMonday.setHours(7, 0, 0, 0); // 07:00 local → ~02:00 ET in EST
  310 |     // Use an explicit off-hours ISO string: next Monday, 01:00 UTC = 8pm ET previous night edge, use 06:00 UTC
  311 |     const offHours = new Date(nextMonday);
  312 |     offHours.setUTCHours(7, 0, 0, 0); // 7:00 AM UTC = 3:00 AM ET (EST) — outside hours
  313 | 
  314 |     const res = await request.post(`${API}/schedule-callback`, {
  315 |       data: {
  316 |         clientId: 'demo-client-001',
  317 |         phoneNumber: '4842384838',
  318 |         scheduledTime: offHours.toISOString(),
  319 |         intentSummary: 'Test outside hours',
  320 |       },
  321 |     });
  322 |     expect(res.status()).toBe(400);
  323 |     const body = await res.json();
  324 |     expect(body.error).toMatch(/business hours|outside|weekend|Mon/i);
  325 |   });
  326 | 
  327 |   test('returns 400 for scheduled time on a weekend', async ({ request }) => {
  328 |     // Find next Saturday
  329 |     const d = new Date();
  330 |     const day = d.getDay();
  331 |     const daysUntilSat = (6 - day + 7) % 7 || 7;
  332 |     d.setDate(d.getDate() + daysUntilSat);
  333 |     d.setUTCHours(14, 0, 0, 0); // 10 AM ET — normally business hours but weekend
  334 | 
  335 |     const res = await request.post(`${API}/schedule-callback`, {
  336 |       data: {
  337 |         clientId: 'demo-client-001',
  338 |         phoneNumber: '4842384838',
  339 |         scheduledTime: d.toISOString(),
  340 |         intentSummary: 'Test weekend',
  341 |       },
  342 |     });
  343 |     expect(res.status()).toBe(400);
  344 |     const body = await res.json();
  345 |     expect(body.error).toBeTruthy();
  346 |   });
  347 | });
  348 | 
  349 | // ─── POST /autopilot-turn ─────────────────────────────────────────────────────
  350 | 
  351 | test.describe('POST /autopilot-turn', () => {
  352 |   test('returns response and shouldExitAutopilot flag', async ({ request }) => {
  353 |     const res = await request.post(`${API}/autopilot-turn`, {
  354 |       data: {
  355 |         transcript: [
  356 |           { role: 'CUSTOMER', content: 'What is my Roth IRA balance?', timestamp: Date.now() },
  357 |         ],
  358 |         clientProfile: MOCK_CLIENT_PROFILE,
  359 |         currentIntent: 'AccountBalance',
  360 |       },
  361 |     });
  362 |     expect(res.ok(), `Expected 200, got ${res.status()}`).toBeTruthy();
  363 |     const body = await res.json();
  364 |     expect(typeof body.response).toBe('string');
  365 |     expect(body.response.length).toBeGreaterThan(5);
  366 |     expect(typeof body.shouldExitAutopilot).toBe('boolean');
  367 |   });
  368 | 
  369 |   test('returns confidence score between 0 and 1', async ({ request }) => {
  370 |     const res = await request.post(`${API}/autopilot-turn`, {
  371 |       data: {
  372 |         transcript: [
  373 |           { role: 'CUSTOMER', content: 'What is my account balance?', timestamp: Date.now() },
  374 |         ],
  375 |         clientProfile: MOCK_CLIENT_PROFILE,
  376 |         currentIntent: 'AccountBalance',
  377 |       },
  378 |     });
  379 |     const body = await res.json();
  380 |     expect(typeof body.confidence).toBe('number');
  381 |     expect(body.confidence).toBeGreaterThanOrEqual(0);
  382 |     expect(body.confidence).toBeLessThanOrEqual(1);
  383 |   });
  384 | 
  385 |   test('requests to place a trade should exit autopilot', async ({ request }) => {
  386 |     const res = await request.post(`${API}/autopilot-turn`, {
  387 |       data: {
  388 |         transcript: [
  389 |           { role: 'CUSTOMER', content: 'I want to buy $10,000 of BobsFunds Growth right now', timestamp: Date.now() },
  390 |         ],
  391 |         clientProfile: MOCK_CLIENT_PROFILE,
  392 |         currentIntent: 'PlaceOrder',
  393 |       },
  394 |     });
  395 |     const body = await res.json();
  396 |     // Trade execution should require agent → shouldExitAutopilot = true
  397 |     expect(body.shouldExitAutopilot).toBe(true);
  398 |   });
  399 | 
  400 |   test('returns 400 when transcript is missing', async ({ request }) => {
  401 |     const res = await request.post(`${API}/autopilot-turn`, {
  402 |       data: { clientProfile: MOCK_CLIENT_PROFILE, currentIntent: 'AccountBalance' },
  403 |     });
> 404 |     expect(res.status()).toBe(400);
      |                          ^ Error: expect(received).toBe(expected) // Object.is equality
  405 |   });
  406 | 
  407 |   test('works without connectionToken (no message sent to Connect)', async ({ request }) => {
  408 |     const res = await request.post(`${API}/autopilot-turn`, {
  409 |       data: {
  410 |         transcript: [
  411 |           { role: 'CUSTOMER', content: 'How are my investments doing?', timestamp: Date.now() },
  412 |         ],
  413 |         clientProfile: MOCK_CLIENT_PROFILE,
  414 |         currentIntent: 'FundPerformance',
  415 |         // No connectionToken — just returns the response
  416 |       },
  417 |     });
  418 |     expect(res.ok()).toBeTruthy();
  419 |     const body = await res.json();
  420 |     expect(typeof body.response).toBe('string');
  421 |   });
  422 | });
  423 | 
  424 | // ─── POST /agent-connection ───────────────────────────────────────────────────
  425 | 
  426 | test.describe('POST /agent-connection', () => {
  427 |   test('returns 400 when participantToken is missing', async ({ request }) => {
  428 |     const res = await request.post(`${API}/agent-connection`, {
  429 |       data: {},
  430 |     });
  431 |     expect(res.status()).toBe(400);
  432 |     const body = await res.json();
  433 |     expect(body.error).toBeTruthy();
  434 |   });
  435 | 
  436 |   test('returns 400 when body is empty', async ({ request }) => {
  437 |     const res = await request.post(`${API}/agent-connection`, {
  438 |       data: '',
  439 |       headers: { 'Content-Type': 'application/json' },
  440 |     });
  441 |     expect(res.status()).toBeGreaterThanOrEqual(400);
  442 |   });
  443 | 
  444 |   test('returns 4xx/5xx for invalid (fake) participantToken', async ({ request }) => {
  445 |     const res = await request.post(`${API}/agent-connection`, {
  446 |       data: { participantToken: 'this-is-not-a-real-token' },
  447 |     });
  448 |     // Connect will reject with error; we just verify the API handles it
  449 |     expect(res.status()).toBeGreaterThanOrEqual(400);
  450 |   });
  451 | });
  452 | 
  453 | // ─── CORS HEADERS ─────────────────────────────────────────────────────────────
  454 | 
  455 | test.describe('CORS headers', () => {
  456 |   test('predict-intent allows cross-origin requests', async ({ request }) => {
  457 |     const res = await request.post(`${API}/predict-intent`, {
  458 |       data: { clientId: 'demo-client-001', currentPage: 'home' },
  459 |       headers: { Origin: 'https://ferrarajc.github.io' },
  460 |     });
  461 |     expect(res.ok()).toBeTruthy();
  462 |     // CORS headers should allow GitHub Pages origin or wildcard
  463 |     const corsHeader = res.headers()['access-control-allow-origin'];
  464 |     expect(corsHeader).toBeTruthy();
  465 |   });
  466 | 
  467 |   test('next-best-response allows cross-origin requests', async ({ request }) => {
  468 |     const res = await request.post(`${API}/next-best-response`, {
  469 |       data: {
  470 |         transcript: [{ role: 'CUSTOMER', content: 'Hello' }],
  471 |         clientProfile: MOCK_CLIENT_PROFILE,
  472 |       },
  473 |       headers: { Origin: 'https://ferrarajc.github.io' },
  474 |     });
  475 |     expect(res.ok()).toBeTruthy();
  476 |     const corsHeader = res.headers()['access-control-allow-origin'];
  477 |     expect(corsHeader).toBeTruthy();
  478 |   });
  479 | });
  480 | 
  481 | // ─── RESPONSE TIME PERFORMANCE ────────────────────────────────────────────────
  482 | 
  483 | test.describe('API response times', () => {
  484 |   test('predict-intent responds within 10 seconds', async ({ request }) => {
  485 |     const start = Date.now();
  486 |     const res = await request.post(`${API}/predict-intent`, {
  487 |       data: { clientId: 'demo-client-001', currentPage: 'home' },
  488 |     });
  489 |     const elapsed = Date.now() - start;
  490 |     expect(res.ok()).toBeTruthy();
  491 |     expect(elapsed).toBeLessThan(10000);
  492 |   });
  493 | 
  494 |   test('next-best-response responds within 10 seconds', async ({ request }) => {
  495 |     const start = Date.now();
  496 |     const res = await request.post(`${API}/next-best-response`, {
  497 |       data: {
  498 |         transcript: [{ role: 'CUSTOMER', content: 'What is my balance?' }],
  499 |         clientProfile: MOCK_CLIENT_PROFILE,
  500 |       },
  501 |     });
  502 |     const elapsed = Date.now() - start;
  503 |     expect(res.ok()).toBeTruthy();
  504 |     expect(elapsed).toBeLessThan(10000);
```