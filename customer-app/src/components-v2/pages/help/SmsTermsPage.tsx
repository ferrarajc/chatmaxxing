import React from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};
const h2: React.CSSProperties = { margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif };
const p: React.CSSProperties = { margin: '0 0 10px', fontSize: 14, lineHeight: 1.6, color: theme.color.text };

export function SmsTermsPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Text Message (SMS) Program Terms</h1>
      <p style={{ margin: '0 0 28px', color: theme.color.textMuted, fontSize: 14 }}>
        These terms govern the Bob's Mutual Funds text messaging program. By providing a mobile number and
        opting in, you agree to them.
      </p>

      <div style={card}>
        <h2 style={h2}>Program description</h2>
        <p style={p}>
          Bob's Mutual Funds offers two types of text messages: <strong>account &amp; security alerts</strong> (such as
          sign-in verification codes, fraud alerts, trade confirmations, and required notices) and, separately and
          only with your additional consent, <strong>promotional &amp; educational messages</strong>. You choose which
          you receive, per number, in your account's Communication &amp; delivery settings.
        </p>
      </div>

      <div style={card}>
        <h2 style={h2}>Consent</h2>
        <p style={p}>
          By enabling text messages for a verified number, you consent to receive recurring automated text messages
          from Bob's Mutual Funds at that number, including messages sent using an automatic telephone dialing system.
          <strong> Consent is not a condition of purchasing any product or service.</strong> You may opt out at any time.
        </p>
        <p style={p}>
          Promotional texts require separate, explicit opt-in and can be turned off without affecting account or
          security alerts.
        </p>
      </div>

      <div style={card}>
        <h2 style={h2}>Message frequency &amp; cost</h2>
        <p style={p}>
          Message frequency varies based on your account activity and preferences. <strong>Message and data rates may
          apply</strong> according to your mobile carrier plan. Bob's Mutual Funds does not charge for the messages
          themselves.
        </p>
      </div>

      <div style={card}>
        <h2 style={h2}>Opting out &amp; help</h2>
        <p style={p}>
          Reply <strong>STOP</strong> to any message to unsubscribe that number from the corresponding program; you'll
          receive a single confirmation and no further messages of that type. Reply <strong>HELP</strong> for help, or
          contact us anytime. You can also manage every preference in your account settings.
        </p>
        <p style={p}>
          Supported carriers include the major U.S. carriers. Carriers are not liable for delayed or undelivered
          messages.
        </p>
      </div>

      <div style={card}>
        <h2 style={h2}>Privacy</h2>
        <p style={{ ...p, marginBottom: 0 }}>
          Mobile information is never shared or sold to third parties or affiliates for their marketing purposes.
          Information is used solely to operate this messaging program and your account, as described in our{' '}
          <NavLink to="/help/privacy" style={{ color: theme.color.primary }}>Privacy Policy</NavLink>.
        </p>
      </div>

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <NavLink to="/account" style={{ display: 'inline-block', padding: '10px 24px', background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: theme.radius.pill, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          Manage your text preferences →
        </NavLink>
      </div>
    </div>
  );
}
