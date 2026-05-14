import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface,
  borderRadius: theme.radius.lg,
  padding: '24px',
  boxShadow: theme.shadow.sm,
  border: `1px solid ${theme.color.border}`,
  marginBottom: 20,
};

const ACCOUNT_TYPES = [
  {
    id: 'roth-ira',
    name: 'Roth IRA',
    desc: 'After-tax contributions; tax-free growth and withdrawals in retirement. No RMDs.',
    limit: '$7,000/year ($8,000 if 50+)',
    best: 'Best for: younger investors, those expecting higher future taxes',
    color: theme.color.primarySoft,
    border: theme.color.primarySoftBorder,
  },
  {
    id: 'traditional-ira',
    name: 'Traditional IRA',
    desc: 'Pre-tax (deductible) contributions; tax-deferred growth; taxed on withdrawal.',
    limit: '$7,000/year ($8,000 if 50+)',
    best: 'Best for: those in a high tax bracket today, expecting lower taxes in retirement',
    color: theme.color.successSoft,
    border: theme.color.successBorder,
  },
  {
    id: 'sep-ira',
    name: 'SEP-IRA',
    desc: 'For self-employed individuals. Very high contribution limits; fully deductible.',
    limit: 'Up to $70,000/year (25% of compensation)',
    best: 'Best for: sole proprietors, freelancers, small business owners',
    color: theme.color.warningSoft,
    border: theme.color.warningBorder,
  },
  {
    id: 'taxable',
    name: 'Taxable Account',
    desc: 'No contribution limits, no restrictions on withdrawals. Taxed on dividends and capital gains.',
    limit: 'No limit',
    best: 'Best for: investing beyond IRA limits, short-term goals, flexibility',
    color: theme.color.surfaceMuted,
    border: theme.color.border,
  },
];

export function OpenAccountPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '60px 24px', textAlign: 'center', fontFamily: theme.font.sans }}>
        <div style={{ fontSize: 48, marginBottom: 16, color: theme.color.success }}>✓</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 12, fontFamily: theme.font.serif }}>Application Received</h1>
        <p style={{ fontSize: 15, color: theme.color.textMuted, marginBottom: 24 }}>
          Your new account application is under review. You'll receive a confirmation at the email address you provided within 1–3 business days. Once approved, you can begin investing immediately.
        </p>
        <Link to="/" style={{ display: 'inline-block', background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: 8, padding: '10px 24px', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
          Return to Home
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Open a New Account</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Takes about 10 minutes. You'll need your SSN, a government-issued ID, and bank account info.
      </p>

      {step === 1 && (
        <>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, fontFamily: theme.font.serif }}>Step 1 — Choose account type</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            {ACCOUNT_TYPES.map(t => (
              <div
                key={t.id}
                onClick={() => setSelected(t.id)}
                style={{
                  ...card,
                  marginBottom: 0,
                  cursor: 'pointer',
                  border: `2px solid ${selected === t.id ? theme.color.primary : t.border}`,
                  background: selected === t.id ? theme.color.primarySoft : t.color,
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, fontFamily: theme.font.serif }}>{t.name}</h3>
                  {selected === t.id && <span style={{ fontSize: 16, color: theme.color.primary }}>✓</span>}
                </div>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: theme.color.text, lineHeight: 1.5 }}>{t.desc}</p>
                <div style={{ fontSize: 12, fontWeight: 600, color: theme.color.primary, marginBottom: 4 }}>Limit: {t.limit}</div>
                <div style={{ fontSize: 12, color: theme.color.textMuted }}>{t.best}</div>
              </div>
            ))}
          </div>
          <button
            disabled={!selected}
            onClick={() => setStep(2)}
            style={{
              background: selected ? theme.color.primary : theme.color.border,
              color: selected ? theme.color.textOnPrimary : theme.color.textMuted,
              border: 'none', borderRadius: 8, padding: '10px 24px',
              fontSize: 14, fontWeight: 600, cursor: selected ? 'pointer' : 'not-allowed',
            }}
          >
            Continue →
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, fontFamily: theme.font.serif }}>
            Step 2 — Your information
            <button
              onClick={() => setStep(1)}
              style={{ marginLeft: 12, background: 'none', border: 'none', fontSize: 13, color: theme.color.primary, cursor: 'pointer', fontWeight: 400 }}
            >
              ← Back
            </button>
          </h2>
          <div style={card}>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: theme.color.textMuted }}>
              Opening: <strong>{ACCOUNT_TYPES.find(t => t.id === selected)?.name}</strong>
            </p>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                {[
                  { id: 'fname', label: 'First name', type: 'text', required: true },
                  { id: 'lname', label: 'Last name', type: 'text', required: true },
                  { id: 'dob', label: 'Date of birth', type: 'date', required: true },
                  { id: 'ssn', label: 'Social Security Number', type: 'text', placeholder: 'XXX-XX-XXXX', required: true },
                  { id: 'email', label: 'Email address', type: 'email', required: true },
                  { id: 'phone', label: 'Phone number', type: 'tel', required: true },
                ].map(f => (
                  <label key={f.id} style={{ fontSize: 13, color: theme.color.text }}>
                    {f.label}
                    <input
                      type={f.type}
                      placeholder={f.placeholder}
                      required={f.required}
                      style={{ display: 'block', width: '100%', marginTop: 4, padding: '7px 10px', border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.md, fontSize: 14 }}
                    />
                  </label>
                ))}
              </div>
              <label style={{ fontSize: 13, color: theme.color.text, display: 'block', marginBottom: 16 }}>
                Mailing address
                <input
                  type="text"
                  required
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '7px 10px', border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.md, fontSize: 14 }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: theme.color.text, marginBottom: 20, cursor: 'pointer' }}>
                <input type="checkbox" required style={{ marginTop: 2 }} />
                I agree to the Bob's Mutual Funds Customer Agreement and certify that all information provided is accurate.
              </label>
              <button
                type="submit"
                style={{ background: theme.color.primary, color: theme.color.textOnPrimary, border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Submit Application
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
