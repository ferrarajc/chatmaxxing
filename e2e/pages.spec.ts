import { test, expect } from '@playwright/test';

const BASE = '/chatmaxxing';

// Navigate to a sub-page via root link clicks (avoids GitHub Pages SPA 404 issues)
// Falls back to direct URL once 404.html SPA redirect is deployed.
async function goTo(page: import('@playwright/test').Page, path: '/' | '/portfolio' | '/research' | '/account') {
  if (path === '/') {
    await page.goto(BASE + '/');
  } else {
    // Try direct navigation first (works once 404.html is deployed)
    const res = await page.goto(BASE + path);
    if (!res || res.status() >= 400) {
      // Fallback: navigate from root, then click nav link
      await page.goto(BASE + '/');
      await page.getByRole('link', { name: new RegExp(path.slice(1), 'i') }).click();
    }
  }
  await page.waitForLoadState('networkidle');
}

// ─── HOMEPAGE ────────────────────────────────────────────────────────────────

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await goTo(page, '/');
  });

  test('has correct page title', async ({ page }) => {
    await expect(page).toHaveTitle("Bob's Mutual Funds");
  });

  test('displays client name in hero', async ({ page }) => {
    await expect(page.getByText('Alex Johnson').first()).toBeVisible({ timeout: 10000 });
  });

  test('displays total portfolio balance', async ({ page }) => {
    // Balance shows in TopNav as "$241,570" and/or in hero section
    await expect(page.getByText(/241[,.]570/).first()).toBeVisible({ timeout: 10000 });
  });

  test('displays account count', async ({ page }) => {
    await expect(page.getByText(/3\s*accounts?/i)).toBeVisible({ timeout: 10000 });
  });

  test('displays S&P 500 market data', async ({ page }) => {
    await expect(page.getByText(/S&P 500/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/5[,.]?248/).first()).toBeVisible({ timeout: 10000 });
  });

  test('displays Dow Jones market data', async ({ page }) => {
    await expect(page.getByText(/Dow Jones/i)).toBeVisible({ timeout: 10000 });
  });

  test('displays NASDAQ market data', async ({ page }) => {
    await expect(page.getByText(/NASDAQ/i)).toBeVisible({ timeout: 10000 });
  });

  test('displays at least 3 featured fund cards', async ({ page }) => {
    await expect(page.getByText('BobsFunds 500 Index')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('BobsFunds Growth')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('BobsFunds Bond Income')).toBeVisible({ timeout: 10000 });
  });

  test('featured fund shows 1-year return for BF500', async ({ page }) => {
    await expect(page.getByText(/24\.1%/)).toBeVisible({ timeout: 10000 });
  });

  test('chat FAB is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible({ timeout: 10000 });
  });

  test('navigation links are present', async ({ page }) => {
    await expect(page.getByRole('link', { name: /portfolio/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('link', { name: /research/i })).toBeVisible({ timeout: 10000 });
  });
});

// ─── PORTFOLIO PAGE ───────────────────────────────────────────────────────────

test.describe('Portfolio Page', () => {
  test.beforeEach(async ({ page }) => {
    await goTo(page, '/portfolio');
  });

  test('has My Portfolio heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /my portfolio/i })).toBeVisible({ timeout: 10000 });
  });

  test('shows Roth IRA account card with correct balance', async ({ page }) => {
    await expect(page.getByText('Roth IRA').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/45[,.]230/).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows Traditional IRA account card with correct balance', async ({ page }) => {
    await expect(page.getByText('Traditional IRA').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/128[,.]450/).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows Taxable Account with correct balance', async ({ page }) => {
    await expect(page.getByText('Taxable Account').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/67[,.]890/).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows positive change % for Roth IRA', async ({ page }) => {
    await expect(page.getByText(/\+4\.2%/)).toBeVisible({ timeout: 10000 });
  });

  test('shows negative change % for Taxable Account', async ({ page }) => {
    await expect(page.getByText(/-0\.9%/)).toBeVisible({ timeout: 10000 });
  });

  test('holdings table shows all 6 fund tickers', async ({ page }) => {
    for (const ticker of ['BF500', 'BFGR', 'BFBI', 'BFIN', 'BFESG', 'BFST']) {
      await expect(page.getByText(ticker).first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('holdings table shows BobsFunds 500 Index', async ({ page }) => {
    await expect(page.getByText('BobsFunds 500 Index').first()).toBeVisible({ timeout: 10000 });
  });

  test('holdings table shows shares for BF500', async ({ page }) => {
    await expect(page.getByText(/142\.3/).first()).toBeVisible({ timeout: 10000 });
  });

  test('recent transactions section is present', async ({ page }) => {
    await expect(page.getByText(/recent transactions/i)).toBeVisible({ timeout: 10000 });
  });

  test('shows dividend reinvestment transaction', async ({ page }) => {
    await expect(page.getByText(/dividend reinvestment/i)).toBeVisible({ timeout: 10000 });
  });

  test('shows contribution transactions', async ({ page }) => {
    await expect(page.getByText(/contribution/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows allocation chart section', async ({ page }) => {
    await expect(page.getByText(/allocation/i)).toBeVisible({ timeout: 10000 });
  });

  test('chat FAB is visible on portfolio page', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible({ timeout: 10000 });
  });
});

// ─── RESEARCH PAGE ────────────────────────────────────────────────────────────

test.describe('Research Page', () => {
  test.beforeEach(async ({ page }) => {
    await goTo(page, '/research');
  });

  test('has Fund Research heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /fund research/i })).toBeVisible({ timeout: 10000 });
  });

  test('shows all 6 fund cards', async ({ page }) => {
    const funds = [
      'BobsFunds 500 Index',
      'BobsFunds Growth',
      'BobsFunds Bond Income',
      'BobsFunds International',
      'BobsFunds ESG Leaders',
      'BobsFunds Short-Term Treasury',
    ];
    for (const name of funds) {
      await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('category filter buttons are present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /all/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /large cap blend/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /intermediate bond/i })).toBeVisible({ timeout: 10000 });
  });

  test('"All" filter shows all 6 funds', async ({ page }) => {
    const fundMatches = page.getByText(/BobsFunds/);
    await expect(fundMatches.first()).toBeVisible({ timeout: 10000 });
    const count = await fundMatches.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test('Large Cap Blend filter shows BF500 and hides Bond Income', async ({ page }) => {
    await page.getByRole('button', { name: /large cap blend/i }).click();
    await expect(page.getByText('BobsFunds 500 Index').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('BobsFunds Bond Income')).not.toBeVisible({ timeout: 3000 });
  });

  test('Intermediate Bond filter shows Bond Income fund', async ({ page }) => {
    await page.getByRole('button', { name: /intermediate bond/i }).click();
    await expect(page.getByText('BobsFunds Bond Income').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('BobsFunds 500 Index')).not.toBeVisible({ timeout: 3000 });
  });

  test('ESG filter shows ESG Leaders fund', async ({ page }) => {
    await page.getByRole('button', { name: /esg/i }).click();
    await expect(page.getByText('BobsFunds ESG Leaders').first()).toBeVisible({ timeout: 5000 });
  });

  test('fund card shows expense ratio for BF500 (0.03%)', async ({ page }) => {
    await expect(page.getByText(/0\.03%/).first()).toBeVisible({ timeout: 10000 });
  });

  test('fund card shows 1-year return for BobsFunds Growth (31.4%)', async ({ page }) => {
    await expect(page.getByText(/31\.4%/).first()).toBeVisible({ timeout: 10000 });
  });

  test('fund cards show YTD/1Y return labels', async ({ page }) => {
    await expect(page.getByText(/YTD/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/\b1Y\b/).first()).toBeVisible({ timeout: 10000 });
  });

  test('chat FAB is visible on research page', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible({ timeout: 10000 });
  });
});

// ─── ACCOUNT PAGE ─────────────────────────────────────────────────────────────

test.describe('Account Page', () => {
  test.beforeEach(async ({ page }) => {
    await goTo(page, '/account');
  });

  test('has My Account heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /my account/i })).toBeVisible({ timeout: 10000 });
  });

  test('shows client name', async ({ page }) => {
    await expect(page.getByText('Alex Johnson').first()).toBeVisible({ timeout: 10000 });
  });

  test('shows client phone number', async ({ page }) => {
    await expect(page.getByText('(484) 238-4838')).toBeVisible({ timeout: 10000 });
  });

  test('shows Personal Information section', async ({ page }) => {
    await expect(page.getByText(/personal information/i)).toBeVisible({ timeout: 10000 });
  });

  test('shows Security section', async ({ page }) => {
    await expect(page.getByText(/^security$/i)).toBeVisible({ timeout: 10000 });
  });

  test('shows two-factor authentication status', async ({ page }) => {
    await expect(page.getByText(/two.?factor/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/enabled/i)).toBeVisible({ timeout: 10000 });
  });

  test('shows Preferences section', async ({ page }) => {
    await expect(page.getByText(/preferences/i)).toBeVisible({ timeout: 10000 });
  });

  test('shows paperless statements preference', async ({ page }) => {
    await expect(page.getByText(/paperless/i)).toBeVisible({ timeout: 10000 });
  });

  test('chat FAB is visible on account page', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible({ timeout: 10000 });
  });
});

// ─── NAVIGATION ───────────────────────────────────────────────────────────────

test.describe('Navigation', () => {
  test('navigates from home to portfolio', async ({ page }) => {
    await goTo(page, '/');
    await page.getByRole('link', { name: /portfolio/i }).click();
    await expect(page).toHaveURL(/portfolio/);
    await expect(page.getByRole('heading', { name: /my portfolio/i })).toBeVisible({ timeout: 10000 });
  });

  test('navigates from home to research', async ({ page }) => {
    await goTo(page, '/');
    await page.getByRole('link', { name: /research/i }).click();
    await expect(page).toHaveURL(/research/);
    await expect(page.getByRole('heading', { name: /fund research/i })).toBeVisible({ timeout: 10000 });
  });

  test('navigates from home to account', async ({ page }) => {
    await goTo(page, '/');
    await page.getByRole('link', { name: /^account$/i }).click();
    await expect(page).toHaveURL(/account/);
    await expect(page.getByRole('heading', { name: /my account/i })).toBeVisible({ timeout: 10000 });
  });

  test('navigates back to home via brand link', async ({ page }) => {
    await goTo(page, '/portfolio');
    await page.getByRole('link', { name: /home/i }).click();
    await expect(page).toHaveURL(/\/(#.*)?$/);
  });

  test('chat FAB persists across portfolio → research navigation', async ({ page }) => {
    await goTo(page, '/');
    const fab = page.getByRole('button', { name: 'Open chat' });
    await expect(fab).toBeVisible({ timeout: 10000 });
    await page.getByRole('link', { name: /portfolio/i }).click();
    await expect(fab).toBeVisible({ timeout: 5000 });
    await page.getByRole('link', { name: /research/i }).click();
    await expect(fab).toBeVisible({ timeout: 5000 });
  });
});
