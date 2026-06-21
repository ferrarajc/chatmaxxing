import React, { useState } from 'react';
import { useClientStore } from '../../../../store/clientStore';
import { PhoneEntry } from '../../../../data/personas';
import { applyMask, MASK_MAXLEN, MASK_PLACEHOLDER, phoneDigits } from '../../../../utils/mask';
import { theme } from '../../../../theme';
import {
  SectionCard, FieldRow, Field, TextInput, SelectInput, PrimaryButton, GhostButton,
  LinkButton, Chip, Toast, useSavedToast, inputStyle,
} from './ui';
import { VerifyCodeModal } from './VerifyCodeModal';

const PHONE_TYPES = ['mobile', 'home', 'work', 'other'];
const typeLabel = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

let tmpId = 0;
const newPhone = (): PhoneEntry => ({
  id: `ph-new-${Date.now()}-${tmpId++}`, type: 'mobile', number: '', displayNumber: '',
  verified: false, sms: { accountAlerts: false, marketing: false, status: 'none' },
});

interface VerifyState { channel: 'email' | 'sms'; target: string; displayTarget: string; }

export function ContactInfoSection() {
  const persona = useClientStore(s => s.activePersona);
  const save = useClientStore(s => s.saveAccountSettings);

  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(persona.email);
  const [phones, setPhones] = useState<PhoneEntry[]>(persona.phones ?? []);
  const [saved, flashSaved] = useSavedToast();
  const [verify, setVerify] = useState<VerifyState | null>(null);

  const startEdit = () => {
    setEmail(persona.email);
    setPhones((persona.phones ?? []).map(p => ({ ...p })));
    setEditing(true);
  };

  const setPhone = (id: string, updates: Partial<PhoneEntry>) =>
    setPhones(ps => ps.map(p => (p.id === id ? { ...p, ...updates } : p)));

  const onNumberChange = (id: string, raw: string) => {
    const display = applyMask(raw, 'phone');
    // Editing a number invalidates prior verification of that line.
    setPhone(id, { displayNumber: display, number: phoneDigits(display), verified: false });
  };

  const handleSave = async () => {
    const cleaned = phones
      .filter(p => phoneDigits(p.displayNumber || p.number).length === 10)
      .map(p => ({ ...p, number: phoneDigits(p.displayNumber || p.number), displayNumber: applyMask(p.number || p.displayNumber, 'phone') }));
    // Primary mobile mirrors into the legacy phone/displayPhone consumed elsewhere.
    const primary = cleaned.find(p => p.type === 'mobile') ?? cleaned[0];
    const emailChanged = email.trim() !== persona.email;
    await save({
      phones: cleaned,
      email: email.trim(),
      // Changing the email requires re-verification.
      ...(emailChanged ? { emailVerified: false } : {}),
      ...(primary ? { phone: primary.number, displayPhone: primary.displayNumber } : {}),
    });
    setEditing(false);
    flashSaved();
  };

  const headerRight = editing
    ? null
    : <LinkButton onClick={startEdit}>Edit</LinkButton>;

  return (
    <SectionCard title="Contact information" headerRight={headerRight} id="contact">
      <Toast show={saved}>Contact information saved.</Toast>

      {!editing && (
        <>
          <FieldRow label="Email">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              {persona.email}
              {persona.emailVerified
                ? <Chip tone="success">✓ Verified</Chip>
                : <>
                    <Chip tone="warning">⏳ Pending verification</Chip>
                    <LinkButton onClick={() => setVerify({ channel: 'email', target: persona.email, displayTarget: persona.email })}>Verify</LinkButton>
                  </>}
            </span>
          </FieldRow>

          {(persona.phones ?? []).map((p, i, arr) => (
            <FieldRow key={p.id} label={`${typeLabel(p.type)} phone`} last={i === arr.length - 1}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                {p.displayNumber}
                {p.verified
                  ? <Chip tone="success">✓ Verified</Chip>
                  : <>
                      <Chip tone="neutral">Unverified</Chip>
                      <LinkButton onClick={() => setVerify({ channel: 'sms', target: p.number, displayTarget: p.displayNumber })}>Verify</LinkButton>
                    </>}
              </span>
            </FieldRow>
          ))}

          {(persona.phones ?? []).length === 0 && (
            <p style={{ fontSize: 13, color: theme.color.textMuted, fontStyle: 'italic', margin: '8px 0 0' }}>No phone numbers on file.</p>
          )}
        </>
      )}

      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Email address">
            <TextInput type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </Field>

          <div>
            <div style={{ fontSize: 13, color: theme.color.text, marginBottom: 6 }}>Phone numbers</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {phones.map(p => (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 10, alignItems: 'center' }}>
                  <select value={p.type} onChange={e => setPhone(p.id, { type: e.target.value as PhoneEntry['type'] })} style={{ ...inputStyle, marginTop: 0 }}>
                    {PHONE_TYPES.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
                  </select>
                  <input
                    value={p.displayNumber}
                    inputMode="numeric"
                    placeholder={MASK_PLACEHOLDER.phone}
                    maxLength={MASK_MAXLEN.phone}
                    onChange={e => onNumberChange(p.id, e.target.value)}
                    style={{ ...inputStyle, marginTop: 0 }}
                  />
                  <button onClick={() => setPhones(ps => ps.filter(x => x.id !== p.id))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.color.danger, fontSize: 13, fontWeight: 600 }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => setPhones(ps => [...ps, newPhone()])}
              style={{ marginTop: 10, background: 'none', border: `1px dashed ${theme.color.borderStrong}`, borderRadius: theme.radius.md, padding: '7px 14px', cursor: 'pointer', color: theme.color.primary, fontSize: 13, fontWeight: 600 }}>
              + Add phone
            </button>
          </div>

          <p style={{ fontSize: 12, color: theme.color.textMuted, lineHeight: 1.5, margin: 0 }}>
            Changing your email or a phone number will require re-verification before it can be used for security alerts or text messages.
          </p>

          <div style={{ display: 'flex', gap: 10 }}>
            <PrimaryButton onClick={handleSave}>Save changes</PrimaryButton>
            <GhostButton onClick={() => setEditing(false)}>Cancel</GhostButton>
          </div>
        </div>
      )}

      {verify && (
        <VerifyCodeModal
          channel={verify.channel}
          target={verify.target}
          displayTarget={verify.displayTarget}
          onClose={() => setVerify(null)}
          onVerified={() => { /* store.refreshFromDb already ran; chip updates from DB */ }}
        />
      )}
    </SectionCard>
  );
}
