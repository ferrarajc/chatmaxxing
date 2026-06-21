import React, { useState } from 'react';
import { useClientStore } from '../../../../store/clientStore';
import { SecuritySettings } from '../../../../data/personas';
import { ToggleSwitch } from '../../../common/ToggleSwitch';
import { theme } from '../../../../theme';
import {
  SectionCard, FieldRow, Field, TextInput, PrimaryButton, GhostButton, LinkButton,
  Chip, Toast, useSavedToast,
} from './ui';

const METHOD_LABEL: Record<SecuritySettings['twoFactorMethod'], string> = {
  sms: 'Text message (SMS)', email: 'Email', app: 'Authenticator app',
};
const METHODS: SecuritySettings['twoFactorMethod'][] = ['sms', 'email', 'app'];

const fmtDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export function SecuritySection() {
  const persona = useClientStore(s => s.activePersona);
  const save = useClientStore(s => s.saveAccountSettings);
  const s = persona.security;

  const [saved, flashSaved] = useSavedToast();
  const [pwOpen, setPwOpen] = useState(false);

  // Toggles save immediately (real settings behavior).
  const patchSecurity = (updates: Partial<SecuritySettings>) => {
    void save({ security: { ...s, ...updates } });
    flashSaved();
  };

  return (
    <SectionCard title="Security center" id="security">
      <Toast show={saved}>Security settings updated.</Toast>

      <FieldRow label="Two-factor authentication">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          {s.twoFactorEnabled ? <Chip tone="success">On</Chip> : <Chip tone="neutral">Off</Chip>}
          <ToggleSwitch on={s.twoFactorEnabled} onChange={v => patchSecurity({ twoFactorEnabled: v })} title="Two-factor authentication" />
        </span>
      </FieldRow>

      {s.twoFactorEnabled && (
        <FieldRow label="Verification method">
          <select
            value={s.twoFactorMethod}
            onChange={e => patchSecurity({ twoFactorMethod: e.target.value as SecuritySettings['twoFactorMethod'] })}
            style={{ padding: '6px 10px', border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.md, fontSize: 13, color: theme.color.text }}
          >
            {METHODS.map(m => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
          </select>
        </FieldRow>
      )}

      <FieldRow label="Login & security alerts">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          {s.loginAlerts ? <Chip tone="success">On</Chip> : <Chip tone="neutral">Off</Chip>}
          <ToggleSwitch on={s.loginAlerts} onChange={v => patchSecurity({ loginAlerts: v })} title="Login alerts" />
        </span>
      </FieldRow>

      <FieldRow label="Password" last>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: theme.color.textMuted, fontSize: 13 }}>Last changed {fmtDate(s.lastPasswordChange)}</span>
          <LinkButton onClick={() => setPwOpen(true)}>Change password</LinkButton>
        </span>
      </FieldRow>

      {pwOpen && (
        <ChangePasswordModal
          onClose={() => setPwOpen(false)}
          onChanged={() => {
            patchSecurity({ lastPasswordChange: new Date().toISOString().slice(0, 10) });
            setPwOpen(false);
          }}
        />
      )}
    </SectionCard>
  );
}

function ChangePasswordModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    if (!current || !next) { setError('Please fill in all fields.'); return; }
    if (next.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (next !== confirm) { setError('New password and confirmation do not match.'); return; }
    onChanged();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15, 35, 64, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: theme.color.surface, borderRadius: theme.radius.lg, boxShadow: theme.shadow.xl, padding: '24px 26px', width: '100%', maxWidth: 420, fontFamily: theme.font.sans }}>
        <div style={{ fontWeight: 700, fontSize: 18, fontFamily: theme.font.serif, color: theme.color.text, marginBottom: 14 }}>Change password</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Current password"><TextInput type="password" value={current} onChange={e => setCurrent(e.target.value)} /></Field>
          <Field label="New password"><TextInput type="password" value={next} onChange={e => setNext(e.target.value)} /></Field>
          <Field label="Confirm new password"><TextInput type="password" value={confirm} onChange={e => setConfirm(e.target.value)} /></Field>
          {error && <p style={{ fontSize: 13, color: theme.color.danger, margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <PrimaryButton onClick={submit}>Update password</PrimaryButton>
            <GhostButton onClick={onClose}>Cancel</GhostButton>
          </div>
        </div>
      </div>
    </div>
  );
}
