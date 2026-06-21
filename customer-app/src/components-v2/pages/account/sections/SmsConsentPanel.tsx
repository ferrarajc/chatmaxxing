import React from 'react';
import { Link } from 'react-router-dom';
import { useClientStore } from '../../../../store/clientStore';
import { PhoneEntry, SMS_DISCLOSURE_VERSION } from '../../../../data/personas';
import { ToggleSwitch } from '../../../common/ToggleSwitch';
import { theme } from '../../../../theme';
import { Chip } from './ui';

// TCPA / CTIA-compliant text-messaging preferences. Consent is per phone number and
// split into transactional (account/security) vs. marketing — marketing requires
// separate, explicit opt-in and is never a condition of any purchase. Each opt-in
// records the disclosure version the customer agreed to (see the persona's
// phones[].sms consent record). Numbers must be verified before texts can be enabled.

const typeLabel = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function SmsConsentPanel() {
  const persona = useClientStore(s => s.activePersona);
  const save = useClientStore(s => s.saveAccountSettings);
  const phones = persona.phones ?? [];

  const setConsent = (phoneId: string, key: 'accountAlerts' | 'marketing', val: boolean) => {
    const updated: PhoneEntry[] = phones.map(p => {
      if (p.id !== phoneId) return p;
      const sms = { ...p.sms, [key]: val };
      const anyOn = sms.accountAlerts || sms.marketing;
      return {
        ...p,
        sms: {
          ...sms,
          status: anyOn ? 'opted-in' : 'opted-out',
          ...(anyOn ? {
            consentedAt: new Date().toISOString().slice(0, 10),
            disclosureVersion: SMS_DISCLOSURE_VERSION,
            method: 'web',
          } : {}),
        },
      };
    });
    void save({ phones: updated });
  };

  return (
    <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${theme.color.border}` }}>
      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: theme.font.serif, color: theme.color.text, marginBottom: 4 }}>
        Text message (SMS) preferences
      </div>
      <p style={{ fontSize: 13, color: theme.color.textMuted, lineHeight: 1.5, margin: '0 0 12px' }}>
        Choose which text messages you'd like to receive at each verified number. You can turn these
        off at any time here or by replying <strong>STOP</strong> to any message.
      </p>

      {/* Required legal disclosure */}
      <div style={{ background: theme.color.surfaceMuted, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, padding: '12px 14px', fontSize: 12, color: theme.color.textMuted, lineHeight: 1.55, marginBottom: 16 }}>
        By enabling text messages you agree to receive recurring automated account and, if selected,
        promotional text messages from Bob's Mutual Funds at the verified number(s) below.
        <strong> Consent is not a condition of any purchase.</strong> Message frequency varies.
        Message &amp; data rates may apply. Reply <strong>STOP</strong> to cancel or <strong>HELP</strong> for help.
        See our <Link to="/help/sms-terms" style={{ color: theme.color.primary }}>SMS Terms</Link> and{' '}
        <Link to="/help/privacy" style={{ color: theme.color.primary }}>Privacy Policy</Link>.
      </div>

      {phones.length === 0 && (
        <p style={{ fontSize: 13, color: theme.color.textMuted, fontStyle: 'italic', margin: 0 }}>
          Add a phone number in Contact information to enable text messaging.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {phones.map(p => (
          <div key={p.id} style={{ border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: p.verified ? 12 : 0 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{p.displayNumber}</span>
              <span style={{ fontSize: 12, color: theme.color.textMuted }}>{typeLabel(p.type)}</span>
              {p.verified
                ? <Chip tone="success">✓ Verified</Chip>
                : <Chip tone="warning">Verify to enable texts</Chip>}
              {p.sms.status === 'opted-in' && <Chip tone="primary">Opted in</Chip>}
            </div>

            {p.verified ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <ConsentRow
                  label="Account & security alerts"
                  hint="Sign-in alerts, trade confirmations, and required notices."
                  on={p.sms.accountAlerts}
                  onChange={v => setConsent(p.id, 'accountAlerts', v)}
                />
                <ConsentRow
                  label="Promotional & educational texts"
                  hint="Product news and offers. Separate, optional consent."
                  on={p.sms.marketing}
                  onChange={v => setConsent(p.id, 'marketing', v)}
                />
                {p.sms.status === 'opted-in' && p.sms.consentedAt && (
                  <div style={{ fontSize: 11, color: theme.color.textSubtle, marginTop: 2 }}>
                    Consent recorded {p.sms.consentedAt} · disclosure {p.sms.disclosureVersion}
                  </div>
                )}
              </div>
            ) : (
              <p style={{ fontSize: 12.5, color: theme.color.textMuted, margin: '6px 0 0', lineHeight: 1.5 }}>
                Verify this number in Contact information to turn on text messages.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ConsentRow({ label, hint, on, onChange }: {
  label: string; hint: string; on: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: theme.color.text }}>{label}</div>
        <div style={{ fontSize: 12, color: theme.color.textMuted }}>{hint}</div>
      </div>
      <ToggleSwitch on={on} onChange={onChange} title={label} />
    </div>
  );
}
