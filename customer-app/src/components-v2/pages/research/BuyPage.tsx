import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { theme } from '../../../theme';
import { FUND_BY_TICKER } from '../../../data/funds';
import { useMarketData } from '../../../hooks/useMarketData';
import { useClientStore } from '../../../store/clientStore';

const S = {
  page: {
    maxWidth: 560,
    margin: '0 auto',
    padding: '40px 24px',
    fontFamily: theme.font.sans,
  } as React.CSSProperties,

  card: {
    background: theme.color.surface,
    borderRadius: theme.radius.lg,
    padding: '28px',
    boxShadow: theme.shadow.sm,
    border: `1px solid ${theme.color.border}`,
  } as React.CSSProperties,

  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: theme.color.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: 8,
  } as React.CSSProperties,

  input: {
    width: '100%',
    padding: '10px 14px',
    fontSize: 16,
    border: `1px solid ${theme.color.borderStrong}`,
    borderRadius: theme.radius.md,
    background: theme.color.surface,
    color: theme.color.text,
    fontFamily: theme.font.sans,
    boxSizing: 'border-box' as const,
    outline: 'none',
  } as React.CSSProperties,

  select: {
    width: '100%',
    padding: '10px 14px',
    fontSize: 15,
    border: `1px solid ${theme.color.borderStrong}`,
    borderRadius: theme.radius.md,
    background: theme.color.surface,
    color: theme.color.text,
    fontFamily: theme.font.sans,
    boxSizing: 'border-box' as const,
    outline: 'none',
    appearance: 'none' as const,
    cursor: 'pointer',
  } as React.CSSProperties,

  btnPrimary: {
    padding: '12px 24px',
    background: theme.color.primary,
    color: theme.color.textOnPrimary,
    border: 'none',
    borderRadius: theme.radius.md,
    fontSize: 15,
    fontWeight: 600,
    fontFamily: theme.font.sans,
    cursor: 'pointer',
    letterSpacing: '0.01em',
  } as React.CSSProperties,

  btnGhost: {
    padding: '12px 24px',
    background: 'transparent',
    color: theme.color.textMuted,
    border: `1px solid ${theme.color.borderStrong}`,
    borderRadius: theme.radius.md,
    fontSize: 15,
    fontWeight: 500,
    fontFamily: theme.font.sans,
    cursor: 'pointer',
  } as React.CSSProperties,

  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: `1px solid ${theme.color.border}`,
    fontSize: 14,
  } as React.CSSProperties,
};

function fmt(n: number, d = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function FundBadge({ ticker }: { ticker: string }) {
  return (
    <span style={{
      fontSize: 12, fontWeight: 700, color: theme.color.accent,
      fontFamily: theme.font.mono, letterSpacing: '0.04em',
      background: theme.color.accentSoft, padding: '2px 8px',
      borderRadius: theme.radius.sm, marginLeft: 8,
    }}>
      {ticker}
    </span>
  );
}

export function BuyPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const navigate = useNavigate();
  const fundDef = FUND_BY_TICKER.get(ticker ?? '');
  const { fundQuote, loading: priceLoading } = useMarketData();
  const { activePersona, buyFund } = useClientStore();

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [accountId, setAccountId] = useState(activePersona.accounts[0]?.id ?? '');
  const [amountStr, setAmountStr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!fundDef) {
    return (
      <div style={S.page}>
        <Link to="/research" style={{ fontSize: 13, color: theme.color.textMuted, textDecoration: 'none' }}>← Back to Fund Research</Link>
        <p style={{ color: theme.color.textMuted, marginTop: 24 }}>Fund not found.</p>
      </div>
    );
  }

  const live = fundQuote(fundDef.ticker);
  const price = live?.price ?? 0;
  const amount = parseFloat(amountStr) || 0;
  const shares = price > 0 && amount > 0 ? amount / price : 0;
  const selectedAccount = activePersona.accounts.find(a => a.id === accountId);
  const isValid = amount > 0 && accountId !== '' && (price > 0 || priceLoading);

  async function handleConfirm() {
    if (!isValid || price === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await buyFund({
        ticker: fundDef!.ticker,
        fundName: fundDef!.name,
        accountId,
        amount,
        shares,
        price,
      });
      setStep(2);
    } catch (err) {
      setSubmitError('Purchase could not be saved. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step 0: Order Entry ──────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div style={S.page}>
        <Link
          to={`/research/fund/${fundDef.ticker}`}
          style={{ fontSize: 13, color: theme.color.textMuted, textDecoration: 'none', display: 'block', marginBottom: 24 }}
        >
          ← Back to fund profile
        </Link>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{
            margin: 0, fontSize: 24, fontWeight: 600, color: theme.color.text,
            fontFamily: theme.font.serif, letterSpacing: '-0.02em', display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 6,
          }}>
            Buy {fundDef.name}<FundBadge ticker={fundDef.ticker} />
          </h1>
          {price > 0 ? (
            <p style={{ margin: '6px 0 0', fontSize: 14, color: theme.color.textMuted }}>
              Current price: <strong style={{ color: theme.color.text }}>${fmt(price)}</strong>
              <span style={{ fontSize: 12, marginLeft: 6, color: theme.color.textSubtle }}>(delayed)</span>
            </p>
          ) : (
            <p style={{ margin: '6px 0 0', fontSize: 14, color: theme.color.textSubtle }}>Loading price…</p>
          )}
        </div>

        <div style={S.card}>
          <div style={{ marginBottom: 22 }}>
            <label style={S.label}>Account</label>
            <div style={{ position: 'relative' }}>
              <select
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                style={S.select}
              >
                {activePersona.accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.type} — ${a.balance.toLocaleString()}</option>
                ))}
              </select>
              <svg style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.color.textMuted} strokeWidth="2" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          <div style={{ marginBottom: 22 }}>
            <label style={S.label}>Investment Amount (USD)</label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                fontSize: 16, color: theme.color.textMuted, pointerEvents: 'none',
              }}>$</span>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0.00"
                value={amountStr}
                onChange={e => setAmountStr(e.target.value)}
                style={{ ...S.input, paddingLeft: 28 }}
              />
            </div>
          </div>

          {price > 0 && amount > 0 && (
            <div style={{ background: theme.color.surfaceMuted, borderRadius: theme.radius.md, padding: '12px 16px', marginBottom: 22 }}>
              <div style={{ fontSize: 12, color: theme.color.textSubtle, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 4 }}>
                Estimated Shares
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, fontFamily: theme.font.serif, fontVariantNumeric: 'tabular-nums', color: theme.color.text }}>
                {fmt(shares, 4)} shares
              </div>
              <div style={{ fontSize: 12, color: theme.color.textSubtle, marginTop: 2 }}>
                at ${fmt(price)} per share
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setStep(1)}
              disabled={!isValid}
              style={{
                ...S.btnPrimary,
                opacity: isValid ? 1 : 0.45,
                cursor: isValid ? 'pointer' : 'not-allowed',
              }}
            >
              Review Order →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 1: Review ───────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div style={S.page}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{
            margin: 0, fontSize: 24, fontWeight: 600, color: theme.color.text,
            fontFamily: theme.font.serif, letterSpacing: '-0.02em',
          }}>
            Review Your Order
          </h1>
        </div>

        <div style={S.card}>
          <div style={S.row}>
            <span style={{ color: theme.color.textMuted }}>Fund</span>
            <span style={{ fontWeight: 500 }}>{fundDef.name} <FundBadge ticker={fundDef.ticker} /></span>
          </div>
          <div style={S.row}>
            <span style={{ color: theme.color.textMuted }}>Account</span>
            <span style={{ fontWeight: 500 }}>{selectedAccount?.type ?? accountId}</span>
          </div>
          <div style={S.row}>
            <span style={{ color: theme.color.textMuted }}>Amount</span>
            <span style={{ fontWeight: 600, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>${fmt(amount)}</span>
          </div>
          <div style={S.row}>
            <span style={{ color: theme.color.textMuted }}>Price per share</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>${fmt(price)}</span>
          </div>
          <div style={{ ...S.row, borderBottom: 'none' }}>
            <span style={{ color: theme.color.textMuted }}>Estimated shares</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(shares, 4)}</span>
          </div>

          <div style={{
            marginTop: 16, padding: '12px 14px', background: theme.color.warningSoft,
            borderRadius: theme.radius.md, border: `1px solid ${theme.color.warningBorder}`,
            fontSize: 12, color: theme.color.warning, lineHeight: 1.5,
          }}>
            Prices are delayed. Final shares are determined at the next NAV calculation at market close.
            Trades typically settle next business day (T+1).
          </div>

          {submitError && (
            <div style={{
              marginTop: 14, padding: '10px 14px', background: theme.color.dangerSoft,
              borderRadius: theme.radius.md, fontSize: 13, color: theme.color.danger,
            }}>
              {submitError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
            <button onClick={() => setStep(0)} style={S.btnGhost} disabled={submitting}>
              ← Modify
            </button>
            <button
              onClick={handleConfirm}
              disabled={submitting}
              style={{
                ...S.btnPrimary,
                opacity: submitting ? 0.6 : 1,
                cursor: submitting ? 'not-allowed' : 'pointer',
                minWidth: 160,
              }}
            >
              {submitting ? 'Placing Order…' : 'Confirm Purchase'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Success ──────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={{ ...S.card, textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: theme.color.successSoft, border: `2px solid ${theme.color.successBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke={theme.color.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h2 style={{
          margin: '0 0 6px', fontSize: 22, fontWeight: 600, color: theme.color.text,
          fontFamily: theme.font.serif, letterSpacing: '-0.01em',
        }}>
          Order Placed Successfully
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: theme.color.textMuted }}>
          Your purchase has been recorded and will settle next business day.
        </p>

        <div style={{
          background: theme.color.surfaceMuted, borderRadius: theme.radius.md,
          padding: '16px 20px', marginBottom: 24, textAlign: 'left',
        }}>
          <div style={S.row}>
            <span style={{ color: theme.color.textMuted }}>Fund</span>
            <span style={{ fontWeight: 500 }}>{fundDef.name} <FundBadge ticker={fundDef.ticker} /></span>
          </div>
          <div style={S.row}>
            <span style={{ color: theme.color.textMuted }}>Account</span>
            <span>{selectedAccount?.type ?? accountId}</span>
          </div>
          <div style={S.row}>
            <span style={{ color: theme.color.textMuted }}>Amount</span>
            <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>${fmt(amount)}</span>
          </div>
          <div style={{ ...S.row, borderBottom: 'none' }}>
            <span style={{ color: theme.color.textMuted }}>Est. shares</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(shares, 4)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            to={`/research/fund/${fundDef.ticker}`}
            style={{
              ...S.btnGhost, textDecoration: 'none',
              display: 'inline-block', textAlign: 'center' as const,
            }}
          >
            View Fund Profile
          </Link>
          <Link
            to="/portfolio"
            style={{
              ...S.btnPrimary, textDecoration: 'none',
              display: 'inline-block', textAlign: 'center' as const,
            }}
          >
            Go to Portfolio
          </Link>
        </div>
      </div>
    </div>
  );
}
