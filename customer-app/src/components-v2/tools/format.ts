// Shared number/format helpers for the Tools suite.
// Pure functions — no React, no theme. Mirrors the conventions in RetirementCalculatorPage.

/** Compact currency for big headline figures: $1.2M, $950K, $500. */
export function fmtCurrency(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000) return sign + '$' + (abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1) + 'M';
  if (abs >= 1_000)     return sign + '$' + (abs / 1_000).toFixed(0) + 'K';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}

/** Full currency, no cents: $1,234,567. */
export function fmtMoney(v: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.round(v));
}

/** Full currency with cents: $1,234.56 — for small per-unit amounts. */
export function fmtMoneyCents(v: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

/** Percent with a fixed number of decimals. */
export function fmtPct(v: number, digits = 2): string {
  return v.toFixed(digits) + '%';
}

/** Compact axis label for chart ticks: $1.2M, $950K, $0. */
export function fmtAxis(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return '$' + (abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1) + 'M';
  if (abs >= 1_000)     return '$' + Math.round(abs / 1_000) + 'K';
  return '$' + Math.round(abs);
}

/** Plain integer with thousands separators. */
export function fmtNum(v: number, digits = 0): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
}
