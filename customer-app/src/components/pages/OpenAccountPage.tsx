import React, { useState } from 'react';

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: '24px',
  boxShadow: '0 1px 6px rgba(0,0,0,.07)', border: '1px solid #e5e7eb', marginBottom: 20,
};

const ACCOUNT_TYPES = [
  {
    id: 'roth-ira',
    name: 'Roth IRA',
    desc: 'After-tax contributions; tax-free growth and withdrawals in retirement. No RMDs.',
    limit: '$7,000/year ($8,000 if 50+)',
    best: 'Best for: younger investors, those expecting higher future taxes',
    color: '#eff6ff',
    border: '#bfdbfe',
  },
  {
    id: 'traditional-ira',
    name: 'Traditional IRA',
    desc: 'Pre-tax (deductible) contributions; tax-deferred growth; taxed on withdrawal.',
    limit: '$7,000/year ($8,000 if 50+)',
    best: 'Best for: those in a high tax bracket today, expecting lower taxes in retirement',
    color: '#f0fdf4',
    border: '#bbf7d0',
  },
  {
    id: 'sep-ira',
    name: 'SEP-IRA',
    desc: 'For self-employed individuals. Very high contribution limits; fully deductible.',
    limit: 'Up to $70,000/year (25% of compensation)',
    best: 'Best for: sole proprietors, freelancers, small business owners',
    color: '#fefce8',
    border: '#fde68a',
  },
  {
    id: 'taxable',
    name: 'Taxable Account',
    desc: 'No contribution limits, no restrictions on withdrawals. Taxed on dividends and capital gains.',
    limit: 'No limit',
    best: 'Best for: investing beyond IRA limits, short-term goals, flexibility',
    color: '#fdf2f8',
    border: '#f0abfc',
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
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 12 }}>Application Received</h1>
        <p style={{ fontSize: 15, color: '#6b7280', marginBottom: 24 }}>
          Your new account application is under review. You'll receive a confirmation at the email address you provided within 1–3 business days. Once approved, you can begin investing immediately.
        </p>
        <a href="/" style={{ display: 'inline-block', background: '#1a56db', color: '#fff', borderRadius: 8, padding: '10px 24px', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
          Return to Home
        </a>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800 }}>Open a New Account</h1>
      <p style={{ margin: '0 0 32px', color: '#6b7280', fontSize: 14 }}>
        Takes about 10 minutes. You'll need your SSN, a government-issued ID, and bank account info.
      </p>

      {step === 1 && (
        <>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>Step 1 — Choose account type</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            {ACCOUNT_TYPES.map(t => (
              <div
                key={t.id}
                onClick={() => setSelected(t.id)}
                style={{
                  ...card,
                  marginBottom: 0,
                  cursor: 'pointer',
                  border: `2px solid ${selected === t.id ? '#1a56db' : t.border}`,
                  background: selected === t.id ? '#eff6ff' : t.color,
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>{t.name}</h3>
                  {selected === t.id && <span style={{ fontSize: 16, color: '#1a56db' }}>✓</span>}
                </div>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{t.desc}</p>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1a56db', marginBottom: 4 }}>Limit: {t.limit}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{t.best}</div>
              </div>
            ))}
          </div>
          <button
            disabled={!selected}
            onClick={() => setStep(2)}
            style={{
              background: selected ? '#1a56db' : '#e5e7eb',
              color: selected ? '#fff' : '#9ca3af',
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
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>
            Step 2 — Your information
            <button
              onClick={() => setStep(1)}
              style={{ marginLeft: 12, background: 'none', border: 'none', fontSize: 13, color: '#1a56db', cursor: 'pointer', fontWeight: 400 }}
            >
              ← Back
            </button>
          </h2>
          <div style={card}>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
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
                  <label key={f.id} style={{ fontSize: 13, color: '#374151' }}>
                    {f.label}
                    <input
                      type={f.type}
                      placeholder={f.placeholder}
                      required={f.required}
                      style={{ display: 'block', width: '100%', marginTop: 4, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                    />
                  </label>
                ))}
              </div>
              <label style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 16 }}>
                Mailing address
                <input
                  type="text"
                  required
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#374151', marginBottom: 20, cursor: 'pointer' }}>
                <input type="checkbox" required style={{ marginTop: 2 }} />
                I agree to the Bob's Mutual Funds Customer Agreement and certify that all information provided is accurate.
              </label>
              <button
                type="submit"
                style={{ background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
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
