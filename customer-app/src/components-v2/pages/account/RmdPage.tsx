import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useClientStore } from '../../../store/clientStore';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface,
  borderRadius: theme.radius.lg,
  padding: '20px 24px',
  boxShadow: theme.shadow.sm,
  border: `1px solid ${theme.color.border}`,
  marginBottom: 20,
};

const DELIVERY_OPTIONS = [
  'Direct deposit (ACH)',
  'Check by mail',
];

const FREQUENCY_OPTIONS = ['Annual (December)', 'Monthly', 'Quarterly'];

export function RmdPage() {
  const { activePersona, fetchRmd, saveRmdPreferences } = useClientStore();
  const rmd = activePersona.rmd;

  const [deliveryMethod, setDeliveryMethod] = useState(
    rmd.deliveryMethod ?? DELIVERY_OPTIONS[0],
  );
  const [frequency, setFrequency] = useState(rmd.frequency ?? FREQUENCY_OPTIONS[0]);
  const [withholding, setWithholding] = useState(rmd.taxWithholding ?? 10);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchRmd();
  }, []);

  // Sync local state when DB fetch updates the store
  useEffect(() => {
    if (rmd.deliveryMethod) setDeliveryMethod(rmd.deliveryMethod);
    if (rmd.frequency) setFrequency(rmd.frequency);
    if (rmd.taxWithholding != null) setWithholding(rmd.taxWithholding);
  }, [rmd.deliveryMethod, rmd.frequency, rmd.taxWithholding]);

  const handleSave = async () => {
    await saveRmdPreferences({ deliveryMethod, frequency, taxWithholding: withholding });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (!rmd.eligible) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <Link to="/account" style={{ color: theme.color.textMuted, fontSize: 13, textDecoration: 'none' }}>← Account</Link>
        </div>
        <h1 style={{ margin: '0 0 24px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Required Minimum Distributions</h1>
        <div style={{ ...card, background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}` }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: theme.color.success, fontFamily: theme.font.serif }}>Not Yet Required</h2>
          <p style={{ margin: 0, fontSize: 14, color: theme.color.text }}>
            {rmd.projectedEligibilityYear
              ? `RMDs from Traditional IRAs begin at age 73. You are projected to reach RMD age around ${rmd.projectedEligibilityYear}. No action needed at this time.`
              : 'Your accounts are not subject to required minimum distributions at this time. Roth IRAs have no RMD requirement during your lifetime.'}
          </p>
        </div>
        <div style={card}>
          <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, fontFamily: theme.font.serif }}>What are RMDs?</h2>
          <p style={{ margin: '0 0 8px', fontSize: 14, color: theme.color.text, lineHeight: 1.6 }}>
            Required Minimum Distributions (RMDs) are mandatory annual withdrawals from tax-deferred retirement accounts (Traditional IRA, SEP-IRA) beginning at age 73 under SECURE 2.0. The amount is based on your account balance and IRS life expectancy factors.
          </p>
          <p style={{ margin: 0, fontSize: 14, color: theme.color.text, lineHeight: 1.6 }}>
            Roth IRAs are <strong>not</strong> subject to RMDs during your lifetime — one of their key advantages for estate planning.
          </p>
        </div>
      </div>
    );
  }

  const progressPct = rmd.annualRmd ? Math.round(((rmd.takenThisYear ?? 0) / rmd.annualRmd) * 100) : 0;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Link to="/account" style={{ color: theme.color.textMuted, fontSize: 13, textDecoration: 'none' }}>← Account</Link>
      </div>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Required Minimum Distributions</h1>
      <p style={{ margin: '0 0 28px', color: theme.color.textMuted, fontSize: 14 }}>
        Traditional IRA · Age {rmd.age} · Deadline: {rmd.nextDeadline}
      </p>

      {saved && (
        <div style={{ background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 14, color: theme.color.success }}>
          RMD preferences saved.
        </div>
      )}

      {/* RMD Status Summary */}
      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>2025 RMD Status</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          {[
            { label: '2025 RMD Required', value: `$${rmd.annualRmd?.toLocaleString()}` },
            { label: 'Taken This Year', value: `$${rmd.takenThisYear?.toLocaleString()}` },
            { label: 'Remaining', value: `$${rmd.remainingThisYear?.toLocaleString()}`, highlight: (rmd.remainingThisYear ?? 0) > 0 },
          ].map(item => (
            <div key={item.label} style={{ background: theme.color.surfaceMuted, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, color: theme.color.textMuted, marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: item.highlight ? theme.color.danger : theme.color.text }}>{item.value}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, background: theme.color.border, borderRadius: 99, height: 8 }}>
            <div style={{ width: `${progressPct}%`, background: progressPct === 100 ? theme.color.success : theme.color.primary, borderRadius: 99, height: '100%', transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: theme.color.text, minWidth: 36 }}>{progressPct}%</span>
        </div>
        <div style={{ fontSize: 12, color: theme.color.textMuted, marginTop: 6 }}>
          Prior year balance: ${rmd.priorYearBalance?.toLocaleString()} · Life expectancy factor: {rmd.lifeExpectancyFactor}
        </div>
      </div>

      {/* Distribution Preferences */}
      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Distribution Preferences</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: theme.color.text }}>
            Delivery method
            <select
              value={deliveryMethod}
              onChange={e => setDeliveryMethod(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '7px 10px', border: `1px solid ${theme.color.borderStrong}`, borderRadius: 6, fontSize: 13 }}
            >
              {DELIVERY_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 13, color: theme.color.text }}>
            Frequency
            <select
              value={frequency}
              onChange={e => setFrequency(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '7px 10px', border: `1px solid ${theme.color.borderStrong}`, borderRadius: 6, fontSize: 13 }}
            >
              {FREQUENCY_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 13, color: theme.color.text }}>
            Federal withholding (%)
            <input
              type="number"
              min={0}
              max={99}
              value={withholding}
              onChange={e => setWithholding(Number(e.target.value))}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '7px 10px', border: `1px solid ${theme.color.borderStrong}`, borderRadius: 6, fontSize: 13 }}
            />
          </label>
        </div>
        <button
          onClick={handleSave}
          style={{ background: theme.color.primary, color: theme.color.textOnPrimary, border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Save preferences
        </button>
      </div>

      {/* Distribution History */}
      {rmd.distributions && rmd.distributions.length > 0 && (
        <div style={card}>
          <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Distribution History</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${theme.color.border}` }}>
                <th style={{ textAlign: 'left', padding: '6px 0 10px', color: theme.color.textMuted, fontWeight: 600, fontSize: 12 }}>Date</th>
                <th style={{ textAlign: 'right', padding: '6px 0 10px', color: theme.color.textMuted, fontWeight: 600, fontSize: 12 }}>Amount</th>
                <th style={{ textAlign: 'left', padding: '6px 0 10px', color: theme.color.textMuted, fontWeight: 600, fontSize: 12 }}>Method</th>
                <th style={{ textAlign: 'right', padding: '6px 0 10px', color: theme.color.textMuted, fontWeight: 600, fontSize: 12 }}>Withheld</th>
              </tr>
            </thead>
            <tbody>
              {rmd.distributions.map((d, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${theme.color.border}` }}>
                  <td style={{ padding: '10px 0', color: theme.color.textMuted }}>{d.date}</td>
                  <td style={{ padding: '10px 0', fontWeight: 600, textAlign: 'right' }}>${d.amount.toLocaleString()}</td>
                  <td style={{ padding: '10px 0', color: theme.color.textMuted }}>{d.method}</td>
                  <td style={{ padding: '10px 0', textAlign: 'right' }}>${d.withheld.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ background: theme.color.warningSoft, border: `1px solid ${theme.color.warningBorder}`, borderRadius: 10, padding: '12px 16px', fontSize: 13, color: theme.color.warning }}>
        Missing your RMD deadline triggers a 25% IRS excise tax on the shortfall. Bob's Mutual Funds sends reminders in December, but you are responsible for taking the distribution on time.
      </div>
    </div>
  );
}
