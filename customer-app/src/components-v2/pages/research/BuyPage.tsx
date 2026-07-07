import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { theme } from '../../../theme';
import { FUND_BY_TICKER } from '../../../data/funds';
import { useMarketData } from '../../../hooks/useMarketData';
import { useFundMarketSummary } from '../../../hooks/useFundMarket';
import { useClientStore } from '../../../store/clientStore';
import { AutoInvestSchedule } from '../../../data/personas';
import { post } from '../../../api/client';

// ── Styles ─────────────────────────────────────────────────────────────────

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
    textDecoration: 'none' as const,
  } as React.CSSProperties,

  reviewRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: `1px solid ${theme.color.border}`,
    fontSize: 14,
  } as React.CSSProperties,
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, d = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function nextDateFor(from: Date, freq: AutoInvestSchedule['frequency']): string {
  const d = new Date(from);
  if (freq === 'Monthly')    d.setMonth(d.getMonth() + 1);
  else if (freq === 'Bi-weekly') d.setDate(d.getDate() + 14);
  else                       d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 10);
}

function TickerBadge({ ticker }: { ticker: string }) {
  return (
    <span style={{
      fontSize: 12, fontWeight: 700, color: theme.color.accent,
      fontFamily: theme.font.mono, letterSpacing: '0.04em',
      background: theme.color.accentSoft, padding: '2px 8px',
      borderRadius: theme.radius.sm, marginLeft: 8, flexShrink: 0,
    }}>
      {ticker}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 600, color: theme.color.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
      {children}
    </div>
  );
}

type RadioOption<T extends string> = { value: T; label: string; sub?: string };

function RadioGroup<T extends string>({
  options, value, onChange,
}: { options: RadioOption<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {options.map(opt => (
        <label
          key={opt.value}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
            padding: '10px 14px', borderRadius: theme.radius.md,
            border: `1px solid ${value === opt.value ? theme.color.primary : theme.color.border}`,
            background: value === opt.value ? theme.color.primarySoft : theme.color.surface,
            transition: 'border-color 0.15s, background 0.15s',
          }}
        >
          <input
            type="radio"
            name={`radio-${opt.value}`}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            style={{ marginTop: 2, accentColor: theme.color.primary, flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: theme.color.text }}>{opt.label}</div>
            {opt.sub && <div style={{ fontSize: 12, color: theme.color.textMuted, marginTop: 2 }}>{opt.sub}</div>}
          </div>
        </label>
      ))}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function BuyPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const fundDef = FUND_BY_TICKER.get(ticker ?? '');
  const { fundQuote, loading: priceLoading } = useMarketData();
  const summary = useFundMarketSummary();
  const { activePersona, buyFund, setAutoInvestSchedules } = useClientStore();

  const today = new Date();
  const dayOfMonth = today.getDate();

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [bankAccountId, setBankAccountId] = useState(activePersona.bankAccounts[0]?.id ?? '');
  const [accountId, setAccountId] = useState(activePersona.accounts[0]?.id ?? '');
  const [amountStr, setAmountStr] = useState('');
  const [purchaseType, setPurchaseType] = useState<'recurring' | 'onetime'>('recurring');
  const [frequency, setFrequency] = useState<AutoInvestSchedule['frequency']>('Monthly');
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
  // Live intraday quote first; the nightly real-data cache covers the gap while
  // market-data is still loading (kills the "Loading price…" dead state).
  const cachedRow = summary?.funds.find(f => f.ticker === fundDef.ticker);
  const price = live?.price ?? cachedRow?.price ?? 0;
  const amount = parseFloat(amountStr.replace(/[^0-9.]/g, '')) || 0;
  const shares = price > 0 && amount > 0 ? amount / price : 0;
  const selectedAccount = activePersona.accounts.find(a => a.id === accountId);
  const selectedBank = activePersona.bankAccounts.find(b => b.id === bankAccountId);
  const isValid = amount > 0 && accountId !== '' && bankAccountId !== '';

  const freqOptions: RadioOption<AutoInvestSchedule['frequency']>[] = [
    { value: 'Monthly',    label: 'Monthly',    sub: `Every month on the ${dayOfMonth}${dayOfMonth === 1 ? 'st' : dayOfMonth === 2 ? 'nd' : dayOfMonth === 3 ? 'rd' : 'th'}` },
    { value: 'Bi-weekly',  label: 'Bi-weekly',  sub: 'Every two weeks' },
    { value: 'Quarterly',  label: 'Quarterly',  sub: 'Every three months' },
  ];

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

      if (purchaseType === 'recurring') {
        const newSchedule: AutoInvestSchedule = {
          id: `ai-${Date.now()}`,
          accountId,
          accountType: selectedAccount?.type ?? accountId,
          fund: fundDef!.name,
          ticker: fundDef!.ticker,
          amount,
          frequency,
          dayOfMonth: frequency === 'Monthly' ? dayOfMonth : undefined,
          nextDate: nextDateFor(today, frequency),
          active: true,
        };
        const updated = [...activePersona.autoInvest, newSchedule];
        setAutoInvestSchedules(updated);
        await post<{ ok: boolean }>('/client-data', {
          action: 'put-auto-invest',
          clientId: activePersona.clientId,
          data: updated,
        });
      }

      setStep(2);
    } catch {
      setSubmitError('Purchase could not be saved. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step 0: Order entry ──────────────────────────────────────────────────

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
            fontFamily: theme.font.serif, letterSpacing: '-0.02em',
            display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 6,
          }}>
            Buy {fundDef.name}<TickerBadge ticker={fundDef.ticker} />
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

          {/* Funding source */}
          <div style={{ marginBottom: 24 }}>
            <SectionLabel>Funding Source</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activePersona.bankAccounts.map(bank => (
                <label
                  key={bank.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                    padding: '10px 14px', borderRadius: theme.radius.md,
                    border: `1px solid ${bankAccountId === bank.id ? theme.color.primary : theme.color.border}`,
                    background: bankAccountId === bank.id ? theme.color.primarySoft : theme.color.surface,
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <input
                    type="radio"
                    name="bank"
                    value={bank.id}
                    checked={bankAccountId === bank.id}
                    onChange={() => setBankAccountId(bank.id)}
                    style={{ accentColor: theme.color.primary, flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: theme.color.text }}>{bank.bankName}</div>
                    <div style={{ fontSize: 12, color: theme.color.textMuted }}>
                      {bank.accountType} {bank.maskedNumber}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Invest into account */}
          <div style={{ marginBottom: 24 }}>
            <SectionLabel>Invest Into</SectionLabel>
            <div style={{ position: 'relative' }}>
              <select
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                style={{
                  width: '100%', padding: '10px 36px 10px 14px', fontSize: 15,
                  border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.md,
                  background: theme.color.surface, color: theme.color.text,
                  fontFamily: theme.font.sans, boxSizing: 'border-box', outline: 'none',
                  appearance: 'none', cursor: 'pointer',
                }}
              >
                {activePersona.accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.type} — ${a.balance.toLocaleString()}</option>
                ))}
              </select>
              <svg style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={theme.color.textMuted} strokeWidth="2" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          {/* Amount */}
          <div style={{ marginBottom: 24 }}>
            <SectionLabel>Amount (USD)</SectionLabel>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                fontSize: 16, color: theme.color.textMuted, pointerEvents: 'none',
              }}>$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amountStr}
                onChange={e => {
                  const v = e.target.value;
                  if (/^[0-9]*\.?[0-9]*$/.test(v)) setAmountStr(v);
                }}
                style={{ ...S.input, paddingLeft: 28 }}
              />
            </div>
            {price > 0 && amount > 0 && (
              <div style={{ marginTop: 8, fontSize: 13, color: theme.color.textMuted }}>
                ≈ <strong style={{ color: theme.color.text }}>{fmt(shares, 4)} shares</strong> at ${fmt(price)} per share
              </div>
            )}
          </div>

          {/* Purchase type */}
          <div style={{ marginBottom: 8 }}>
            <SectionLabel>Purchase Type</SectionLabel>
            <RadioGroup
              options={[
                { value: 'recurring', label: 'Recurring investment', sub: 'Automatically reinvest on a schedule you choose' },
                { value: 'onetime',   label: 'One-time purchase',    sub: 'Purchase once at the current price' },
              ]}
              value={purchaseType}
              onChange={setPurchaseType}
            />
          </div>

          {/* Frequency (only when recurring) */}
          {purchaseType === 'recurring' && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${theme.color.border}` }}>
              <SectionLabel>Frequency</SectionLabel>
              <RadioGroup options={freqOptions} value={frequency} onChange={setFrequency} />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
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
    const freqLabel = freqOptions.find(f => f.value === frequency)?.label ?? frequency;
    const startDate = nextDateFor(today, frequency);

    return (
      <div style={S.page}>
        <h1 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 600, color: theme.color.text, fontFamily: theme.font.serif, letterSpacing: '-0.02em' }}>
          Review Your Order
        </h1>

        <div style={S.card}>
          <div style={S.reviewRow}>
            <span style={{ color: theme.color.textMuted }}>Fund</span>
            <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center' }}>{fundDef.name}<TickerBadge ticker={fundDef.ticker} /></span>
          </div>
          <div style={S.reviewRow}>
            <span style={{ color: theme.color.textMuted }}>Funding source</span>
            <span>{selectedBank?.bankName} {selectedBank?.maskedNumber}</span>
          </div>
          <div style={S.reviewRow}>
            <span style={{ color: theme.color.textMuted }}>Invest into</span>
            <span>{selectedAccount?.type}</span>
          </div>
          <div style={S.reviewRow}>
            <span style={{ color: theme.color.textMuted }}>Amount</span>
            <span style={{ fontWeight: 600, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>${fmt(amount)}</span>
          </div>
          {price > 0 && (
            <div style={S.reviewRow}>
              <span style={{ color: theme.color.textMuted }}>Est. shares</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(shares, 4)} @ ${fmt(price)}</span>
            </div>
          )}
          <div style={S.reviewRow}>
            <span style={{ color: theme.color.textMuted }}>Purchase type</span>
            <span>{purchaseType === 'recurring' ? `Recurring — ${freqLabel}` : 'One-time'}</span>
          </div>
          {purchaseType === 'recurring' && (
            <div style={{ ...S.reviewRow, borderBottom: 'none' }}>
              <span style={{ color: theme.color.textMuted }}>First future recurrence</span>
              <span style={{ color: theme.color.textMuted, fontSize: 13 }}>
                {new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          )}
          {purchaseType === 'onetime' && <div style={{ paddingBottom: 4 }} />}

          <div style={{
            marginTop: 16, padding: '12px 14px', background: theme.color.warningSoft,
            borderRadius: theme.radius.md, border: `1px solid ${theme.color.warningBorder}`,
            fontSize: 12, color: theme.color.warning, lineHeight: 1.5,
          }}>
            Prices are delayed. Final share count is determined at next NAV calculation at market close. Settlement T+1.
          </div>

          {submitError && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: theme.color.dangerSoft, borderRadius: theme.radius.md, fontSize: 13, color: theme.color.danger }}>
              {submitError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
            <button onClick={() => setStep(0)} style={S.btnGhost} disabled={submitting}>← Modify</button>
            <button
              onClick={handleConfirm}
              disabled={submitting}
              style={{ ...S.btnPrimary, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer', minWidth: 160 }}
            >
              {submitting ? 'Placing Order…' : 'Confirm Purchase'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Confirmation ─────────────────────────────────────────────────

  const freqLabel = freqOptions.find(f => f.value === frequency)?.label ?? frequency;

  return (
    <div style={S.page}>
      <div style={{ ...S.card, textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: theme.color.successSoft, border: `2px solid ${theme.color.successBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke={theme.color.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 600, color: theme.color.text, fontFamily: theme.font.serif, letterSpacing: '-0.01em' }}>
          Order Placed
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: theme.color.textMuted }}>
          {purchaseType === 'recurring'
            ? `Your purchase is confirmed and ${freqLabel.toLowerCase()} automatic investments have been scheduled.`
            : 'Your purchase has been recorded and will settle next business day.'}
        </p>

        <div style={{ background: theme.color.surfaceMuted, borderRadius: theme.radius.md, padding: '16px 20px', marginBottom: 24, textAlign: 'left' }}>
          <div style={S.reviewRow}>
            <span style={{ color: theme.color.textMuted }}>Fund</span>
            <span style={{ fontWeight: 500 }}>{fundDef.name} <TickerBadge ticker={fundDef.ticker} /></span>
          </div>
          <div style={S.reviewRow}>
            <span style={{ color: theme.color.textMuted }}>Account</span>
            <span>{selectedAccount?.type}</span>
          </div>
          <div style={S.reviewRow}>
            <span style={{ color: theme.color.textMuted }}>Amount</span>
            <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>${fmt(amount)}</span>
          </div>
          {purchaseType === 'recurring' && (
            <div style={{ ...S.reviewRow, borderBottom: 'none' }}>
              <span style={{ color: theme.color.textMuted }}>Schedule</span>
              <span>{freqLabel}</span>
            </div>
          )}
          {purchaseType === 'onetime' && (
            <div style={{ ...S.reviewRow, borderBottom: 'none' }}>
              <span style={{ color: theme.color.textMuted }}>Est. shares</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(shares, 4)}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to={`/research/fund/${fundDef.ticker}`} style={{ ...S.btnGhost, display: 'inline-block', textAlign: 'center' }}>
            View Fund Profile
          </Link>
          <Link to="/portfolio" style={{ ...S.btnPrimary, textDecoration: 'none', display: 'inline-block', textAlign: 'center' }}>
            Go to Portfolio
          </Link>
        </div>
      </div>
    </div>
  );
}
