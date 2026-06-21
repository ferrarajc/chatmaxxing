import React, { useState } from 'react';
import { useClientStore } from '../../../../store/clientStore';
import { PersonalDetails } from '../../../../data/personas';
import {
  SectionCard, FieldRow, Field, TextInput, SelectInput, PrimaryButton, GhostButton,
  LinkButton, Toast, useSavedToast, editGrid,
} from './ui';

const MARITAL = ['Single', 'Married', 'Domestic partnership', 'Divorced', 'Widowed'];
const EMPLOYMENT = ['Employed', 'Self-employed', 'Retired', 'Student', 'Homemaker', 'Not employed'];

const fmtDob = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};
const fmtYear = (iso: string) => (iso ? iso.slice(0, 4) : '—');

export function PersonalDetailsSection() {
  const persona = useClientStore(s => s.activePersona);
  const save = useClientStore(s => s.saveAccountSettings);
  const p = persona.personal;

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PersonalDetails>(p);
  const [saved, flashSaved] = useSavedToast();

  const startEdit = () => { setForm({ ...p }); setEditing(true); };
  const set = (k: keyof PersonalDetails, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    await save({ personal: form });
    setEditing(false);
    flashSaved();
  };

  return (
    <SectionCard
      title="Profile & personal details"
      headerRight={editing ? null : <LinkButton onClick={startEdit}>Edit</LinkButton>}
    >
      <Toast show={saved}>Personal details saved.</Toast>

      {!editing && (
        <>
          <FieldRow label="Date of birth">{fmtDob(p.dateOfBirth)}</FieldRow>
          <FieldRow label="Marital status">{p.maritalStatus || '—'}</FieldRow>
          <FieldRow label="Employment status">{p.employmentStatus || '—'}</FieldRow>
          <FieldRow label="Employer">{p.employer || '—'}</FieldRow>
          <FieldRow label="Occupation">{p.occupation || '—'}</FieldRow>
          <FieldRow label="Citizenship / tax residency">{p.citizenship || '—'}</FieldRow>
          <FieldRow label="Member since" last>{fmtYear(p.memberSince)}</FieldRow>
        </>
      )}

      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={editGrid(2)}>
            <Field label="Marital status"><SelectInput value={form.maritalStatus} onChange={v => set('maritalStatus', v)} options={MARITAL} /></Field>
            <Field label="Employment status"><SelectInput value={form.employmentStatus} onChange={v => set('employmentStatus', v)} options={EMPLOYMENT} /></Field>
            <Field label="Employer"><TextInput value={form.employer} onChange={e => set('employer', e.target.value)} /></Field>
            <Field label="Occupation"><TextInput value={form.occupation} onChange={e => set('occupation', e.target.value)} /></Field>
          </div>
          <p style={{ fontSize: 12, color: '#6B645A', margin: 0, lineHeight: 1.5 }}>
            Date of birth and citizenship are on file from your application. Contact us to correct them.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <PrimaryButton onClick={handleSave}>Save changes</PrimaryButton>
            <GhostButton onClick={() => setEditing(false)}>Cancel</GhostButton>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
