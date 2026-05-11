import React from 'react';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function RolloverPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Rollover Options</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        How to move retirement assets from a former employer's 401(k) or other plan into a Bob's Mutual Funds IRA.
      </p>

      <div style={{ ...card, background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}` }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700, color: theme.color.success, fontFamily: theme.font.serif }}>Always Use a Direct Rollover</h2>
        <p style={{ margin: 0, fontSize: 14, color: theme.color.text, lineHeight: 1.6 }}>
          In a direct rollover, funds move directly from your old plan to Bob's Mutual Funds — you never receive a check. No withholding, no deadline, no risk. This is almost always the correct choice.
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Direct vs. Indirect Rollover</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            {
              title: 'Direct Rollover', color: theme.color.successSoft, border: theme.color.successBorder, textColor: theme.color.success,
              items: [
                'Funds go directly from old plan to new IRA',
                'No tax withholding',
                'No deadline to complete',
                'No risk of accidental taxes or penalties',
                'Recommended for 99% of rollovers',
              ],
            },
            {
              title: 'Indirect (60-Day) Rollover', color: theme.color.dangerSoft, border: theme.color.dangerSoft, textColor: theme.color.danger,
              items: [
                'Check made payable to you personally',
                '20% mandatory federal withholding',
                'Must re-deposit 100% (including withheld 20% from own funds) within 60 days',
                'Missing the 60-day window = taxes + 10% penalty on entire amount',
                'Only one indirect rollover per 12-month period allowed',
              ],
            },
          ].map(item => (
            <div key={item.title} style={{ background: item.color, border: `1px solid ${item.border}`, borderRadius: 10, padding: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: item.textColor, marginBottom: 10 }}>{item.title}</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: theme.color.text, lineHeight: 1.8 }}>
                {item.items.map(i => <li key={i}>{i}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Step-by-Step: Rolling Over a 401(k)</h2>
        {[
          { step: '1', title: 'Open a Traditional IRA at Bob\'s Mutual Funds', body: 'If you don\'t already have one. Takes about 10 minutes online.' },
          { step: '2', title: 'Contact your former employer\'s plan administrator', body: 'Request a "direct rollover" to Bob\'s Mutual Funds. Provide our mailing address and your account number.' },
          { step: '3', title: 'Receive check made payable to Bob\'s Mutual Funds FBO [Your Name]', body: '"FBO" means "For Benefit Of." This confirms it\'s a direct rollover — the check is not made to you personally.' },
          { step: '4', title: 'Deposit the check with Bob\'s Mutual Funds', body: 'Mail to our custodian address or call us and we\'ll provide deposit instructions. Funds should appear within 1–2 business days.' },
          { step: '5', title: 'Invest the rollover funds', body: 'Once credited to your IRA, allocate among BobsFunds mutual funds. Rollovers have no contribution limit — your entire 401(k) balance can be rolled at once.' },
        ].map(item => (
          <div key={item.step} style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{ background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>
              {item.step}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{item.title}</div>
              <div style={{ fontSize: 14, color: theme.color.textMuted, lineHeight: 1.5 }}>{item.body}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Tax Consequences</h2>
        {[
          { title: '401(k) → Traditional IRA', tax: 'No tax event — tax-deferred status preserved', color: theme.color.successSoft },
          { title: '401(k) → Roth IRA (Roth conversion)', tax: 'Taxable in year of rollover — entire amount added to ordinary income', color: theme.color.dangerSoft },
          { title: 'Roth 401(k) → Roth IRA', tax: 'No tax event — tax-free status preserved', color: theme.color.successSoft },
          { title: 'After-tax 401(k) → Roth IRA (mega backdoor)', tax: 'After-tax basis rolls tax-free; earnings portion is taxable', color: theme.color.warningSoft },
        ].map(item => (
          <div key={item.title} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: item.color, borderRadius: 8, marginBottom: 8 }}>
            <span style={{ fontWeight: 500, fontSize: 14 }}>{item.title}</span>
            <span style={{ fontSize: 13, color: theme.color.text }}>{item.tax}</span>
          </div>
        ))}
      </div>

      <div style={{ background: theme.color.warningSoft, border: `1px solid ${theme.color.warningBorder}`, borderRadius: 10, padding: '12px 16px', fontSize: 13, color: theme.color.warning }}>
        Ready to roll over a 401(k)? Call us or use the chat to connect with an advisor who can walk you through the process. Rollovers are free — no transfer fees at Bob's Mutual Funds.
      </div>
    </div>
  );
}
