import React from 'react';
import { useClientStore } from '../../../../store/clientStore';
import { CommunicationPreferences } from '../../../../data/personas';
import { ToggleSwitch } from '../../../common/ToggleSwitch';
import { theme } from '../../../../theme';
import { SectionCard, FieldRow, Chip, Toast, useSavedToast } from './ui';
import { SmsConsentPanel } from './SmsConsentPanel';

const LANGUAGES = ['English', 'Spanish', 'Chinese', 'French'];
type DeliveryKey = 'taxDocDelivery' | 'tradeConfirms' | 'prospectusDelivery' | 'proxyDelivery';

export function CommunicationSection() {
  const persona = useClientStore(s => s.activePersona);
  const save = useClientStore(s => s.saveAccountSettings);
  const prefs = persona.preferences;
  const [saved, flashSaved] = useSavedToast();

  const patch = (updates: Partial<CommunicationPreferences>) => {
    void save({ preferences: { ...prefs, ...updates } });
    flashSaved();
  };

  const toggleRow = (label: string, on: boolean, onChange: (v: boolean) => void, last?: boolean) => (
    <FieldRow label={label} last={last}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        {on ? <Chip tone="success">On</Chip> : <Chip tone="neutral">Off</Chip>}
        <ToggleSwitch on={on} onChange={onChange} title={label} />
      </span>
    </FieldRow>
  );

  const deliverySelect = (value: 'electronic' | 'mail', onChange: (v: 'electronic' | 'mail') => void) => (
    <select
      value={value}
      onChange={e => onChange(e.target.value as 'electronic' | 'mail')}
      style={{ padding: '6px 10px', border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.md, fontSize: 13, color: theme.color.text }}
    >
      <option value="electronic">Email (e-delivery)</option>
      <option value="mail">Paper by mail</option>
    </select>
  );

  const deliveryRow = (label: string, key: DeliveryKey) => (
    <FieldRow label={label}>
      {deliverySelect(prefs[key], v => patch({ [key]: v } as Partial<CommunicationPreferences>))}
    </FieldRow>
  );

  return (
    <SectionCard title="Communication & delivery" id="communication">
      <Toast show={saved}>Preferences saved.</Toast>

      <div style={{ fontSize: 13, fontWeight: 600, color: theme.color.text, margin: '0 0 4px' }}>Document delivery</div>
      <p style={{ fontSize: 12, color: theme.color.textMuted, lineHeight: 1.5, margin: '0 0 6px' }}>
        <strong>Email (e-delivery)</strong> sends each document to your email as a secure PDF; copies are
        always available to download here on the site. <strong>Paper by mail</strong> sends printed copies.
      </p>
      <FieldRow label="Statements">
        {deliverySelect(prefs.paperlessStatements ? 'electronic' : 'mail', v => patch({ paperlessStatements: v === 'electronic' }))}
      </FieldRow>
      {deliveryRow('Tax documents', 'taxDocDelivery')}
      {deliveryRow('Trade confirmations', 'tradeConfirms')}
      {deliveryRow('Prospectuses & reports', 'prospectusDelivery')}
      {deliveryRow('Proxy materials', 'proxyDelivery')}

      <div style={{ fontSize: 13, fontWeight: 600, color: theme.color.text, margin: '18px 0 4px' }}>Notifications & language</div>
      {toggleRow('Email alerts', prefs.notifyEmail, v => patch({ notifyEmail: v }))}
      {toggleRow('Push notifications', prefs.notifyPush, v => patch({ notifyPush: v }))}
      <FieldRow label="Language">
        <select
          value={prefs.language}
          onChange={e => patch({ language: e.target.value })}
          style={{ padding: '6px 10px', border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.md, fontSize: 13, color: theme.color.text }}
        >
          {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </FieldRow>
      {toggleRow('Marketing communications', prefs.marketing, v => patch({ marketing: v }), true)}

      {/* TCPA/CTIA-compliant text messaging consent */}
      <SmsConsentPanel />
    </SectionCard>
  );
}
