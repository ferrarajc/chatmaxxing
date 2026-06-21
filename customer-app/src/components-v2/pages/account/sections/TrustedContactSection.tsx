import React, { useState } from 'react';
import { useClientStore } from '../../../../store/clientStore';
import { TrustedContact } from '../../../../data/personas';
import { applyMask, MASK_MAXLEN, MASK_PLACEHOLDER } from '../../../../utils/mask';
import { theme } from '../../../../theme';
import {
  SectionCard, FieldRow, Field, TextInput, SelectInput, PrimaryButton, GhostButton,
  LinkButton, Toast, useSavedToast, editGrid, inputStyle,
} from './ui';

const RELATIONSHIPS = ['Spouse', 'Partner', 'Child', 'Parent', 'Sibling', 'Friend', 'Attorney', 'Other'];
const EMPTY: TrustedContact = { name: '', relationship: 'Spouse', phone: '', email: '' };

export function TrustedContactSection() {
  const persona = useClientStore(s => s.activePersona);
  const save = useClientStore(s => s.saveAccountSettings);
  const tc = persona.trustedContact;

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<TrustedContact>(tc ?? EMPTY);
  const [saved, flashSaved] = useSavedToast();

  const startEdit = () => { setForm(tc ?? EMPTY); setEditing(true); };
  const set = (k: keyof TrustedContact, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    await save({ trustedContact: form.name.trim() ? form : null });
    setEditing(false);
    flashSaved();
  };

  const handleRemove = async () => {
    await save({ trustedContact: null });
    setEditing(false);
    flashSaved();
  };

  const headerRight = editing
    ? null
    : <LinkButton onClick={startEdit}>{tc ? 'Edit' : '+ Add'}</LinkButton>;

  return (
    <SectionCard
      title="Trusted contact"
      subtitle="A person we may contact about your account if we can't reach you or suspect financial exploitation. They have no authority to transact."
      headerRight={headerRight}
      id="trusted-contact"
    >
      <Toast show={saved}>Trusted contact saved.</Toast>

      {!editing && (tc
        ? (
          <>
            <FieldRow label="Name">{tc.name}</FieldRow>
            <FieldRow label="Relationship">{tc.relationship}</FieldRow>
            <FieldRow label="Phone">{tc.phone || '—'}</FieldRow>
            <FieldRow label="Email" last>{tc.email || '—'}</FieldRow>
          </>
        )
        : <p style={{ fontSize: 13, color: theme.color.textMuted, fontStyle: 'italic', margin: 0 }}>No trusted contact on file.</p>
      )}

      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={editGrid(2)}>
            <Field label="Full name"><TextInput value={form.name} onChange={e => set('name', e.target.value)} /></Field>
            <Field label="Relationship"><SelectInput value={form.relationship} onChange={v => set('relationship', v)} options={RELATIONSHIPS} /></Field>
            <Field label="Phone">
              <input value={form.phone} inputMode="numeric" placeholder={MASK_PLACEHOLDER.phone} maxLength={MASK_MAXLEN.phone}
                onChange={e => set('phone', applyMask(e.target.value, 'phone'))} style={{ ...inputStyle }} />
            </Field>
            <Field label="Email"><TextInput type="email" value={form.email} onChange={e => set('email', e.target.value)} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <PrimaryButton onClick={handleSave}>Save</PrimaryButton>
            <GhostButton onClick={() => setEditing(false)}>Cancel</GhostButton>
            {tc && <button onClick={handleRemove} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: theme.color.danger, fontSize: 13, fontWeight: 600 }}>Remove contact</button>}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
