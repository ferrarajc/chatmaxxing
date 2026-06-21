import React, { useState } from 'react';
import { useClientStore } from '../../../../store/clientStore';
import { AuthorizedAgent, AuthorizationLevel } from '../../../../data/personas';
import { theme } from '../../../../theme';
import {
  SectionCard, Field, TextInput, SelectInput, PrimaryButton, GhostButton, LinkButton,
  Chip, ChipTone, Toast, useSavedToast, editGrid, ConfirmDialog,
} from './ui';

const LEVELS: AuthorizationLevel[] = ['View only', 'Limited', 'Full'];
const RELATIONSHIPS = ['Spouse', 'Partner', 'Child', 'Parent', 'Sibling', 'Financial advisor', 'Accountant', 'Attorney', 'Other'];

const levelTone = (l: AuthorizationLevel): ChipTone => (l === 'Full' ? 'primary' : l === 'Limited' ? 'warning' : 'neutral');
const LEVEL_HELP: Record<AuthorizationLevel, string> = {
  'View only': 'See balances, holdings, and statements. Cannot transact.',
  'Limited': 'Place trades and contributions. Cannot withdraw or change your profile.',
  'Full': 'Full authority, including withdrawals and distributions.',
};

export function AuthorizedAgentsSection() {
  const persona = useClientStore(s => s.activePersona);
  const save = useClientStore(s => s.saveAccountSettings);
  const agents = persona.authorizedAgents ?? [];

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', relationship: 'Spouse', email: '', level: 'View only' as AuthorizationLevel });
  const [error, setError] = useState('');
  const [saved, flashSaved] = useSavedToast();
  const [removeId, setRemoveId] = useState<string | null>(null);

  const persist = (updated: AuthorizedAgent[]) => { void save({ authorizedAgents: updated }); flashSaved(); };

  const setLevel = (id: string, level: AuthorizationLevel) => persist(agents.map(a => (a.id === id ? { ...a, level } : a)));

  const remove = (id: string) => { persist(agents.filter(a => a.id !== id)); setRemoveId(null); };

  const add = () => {
    if (!form.name.trim()) { setError('Enter the person\'s name.'); return; }
    const entry: AuthorizedAgent = {
      id: `aa-new-${Date.now()}`,
      name: form.name.trim(), relationship: form.relationship, email: form.email.trim(),
      level: form.level, addedAt: new Date().toISOString().slice(0, 10),
    };
    persist([...agents, entry]);
    setForm({ name: '', relationship: 'Spouse', email: '', level: 'View only' });
    setError(''); setAdding(false);
  };

  const removeTarget = agents.find(a => a.id === removeId) ?? null;

  return (
    <SectionCard
      title="Authorized agents"
      subtitle="People you've granted access to your account. Each has a defined authorization level."
      headerRight={!adding ? <LinkButton onClick={() => setAdding(true)}>+ Add person</LinkButton> : null}
      id="authorized-agents"
    >
      <Toast show={saved}>Authorized agents updated.</Toast>

      {agents.length === 0 && !adding && (
        <p style={{ fontSize: 13, color: theme.color.textMuted, fontStyle: 'italic', margin: 0 }}>No one else is authorized on this account.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {agents.map(a => (
          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, padding: '12px 14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</span>
                <Chip tone={levelTone(a.level)}>{a.level}</Chip>
              </div>
              <div style={{ fontSize: 13, color: theme.color.textMuted, marginTop: 2 }}>
                {a.relationship}{a.email ? ` · ${a.email}` : ''}
              </div>
              <div style={{ fontSize: 11.5, color: theme.color.textSubtle, marginTop: 3 }}>{LEVEL_HELP[a.level]}</div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <select value={a.level} onChange={e => setLevel(a.id, e.target.value as AuthorizationLevel)} title="Authorization level"
                style={{ padding: '6px 10px', border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.md, fontSize: 13, color: theme.color.text }}>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <button onClick={() => setRemoveId(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.color.danger, fontSize: 13, fontWeight: 600 }}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      {adding && (
        <div style={{ marginTop: 14, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, padding: 16 }}>
          <div style={editGrid(2)}>
            <Field label="Full name"><TextInput value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="Relationship"><SelectInput value={form.relationship} onChange={v => setForm(f => ({ ...f, relationship: v }))} options={RELATIONSHIPS} /></Field>
            <Field label="Email"><TextInput type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></Field>
            <Field label="Authorization level"><SelectInput value={form.level} onChange={v => setForm(f => ({ ...f, level: v as AuthorizationLevel }))} options={LEVELS} /></Field>
          </div>
          <p style={{ fontSize: 12, color: theme.color.textMuted, lineHeight: 1.5, margin: '0 0 12px' }}>{LEVEL_HELP[form.level]}</p>
          {error && <p style={{ fontSize: 13, color: theme.color.danger, margin: '0 0 10px' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <PrimaryButton onClick={add}>Add person</PrimaryButton>
            <GhostButton onClick={() => { setAdding(false); setError(''); }}>Cancel</GhostButton>
          </div>
        </div>
      )}

      {removeTarget && (
        <ConfirmDialog
          title="Remove this person's access?"
          message={<><strong>{removeTarget.name}</strong> ({removeTarget.relationship}) will immediately lose all access to your account. You can re-add them later.</>}
          confirmLabel="Remove access"
          danger
          onConfirm={() => remove(removeTarget.id)}
          onCancel={() => setRemoveId(null)}
        />
      )}
    </SectionCard>
  );
}
