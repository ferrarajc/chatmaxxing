import React, { useState } from 'react';
import { useClientStore } from '../../../../store/clientStore';
import { BankAccount } from '../../../../data/personas';
import { theme } from '../../../../theme';
import {
  SectionCard, Field, TextInput, PrimaryButton, GhostButton, LinkButton, Chip,
  Toast, useSavedToast, editGrid, inputStyle, ModalShell, ConfirmDialog,
} from './ui';

const isVerified = (b: BankAccount) => b.verified !== false; // seeded accounts (undefined) are established

// Two random trial-deposit amounts (in cents, 1–99) — the real micro-deposit pattern.
const randCents = () => Math.floor(Math.random() * 99) + 1;

export function BankingSection() {
  const persona = useClientStore(s => s.activePersona);
  const save = useClientStore(s => s.saveAccountSettings);
  const banks = persona.bankAccounts ?? [];

  const [adding, setAdding] = useState(false);
  const [bankName, setBankName] = useState('');
  const [routing, setRouting] = useState('');
  const [acctType, setAcctType] = useState<'Checking' | 'Savings'>('Checking');
  const [acctNumber, setAcctNumber] = useState('');
  const [error, setError] = useState('');
  const [saved, flashSaved] = useSavedToast();
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [verifyId, setVerifyId] = useState<string | null>(null);

  const persist = (updated: BankAccount[]) => { void save({ bankAccounts: updated }); flashSaved(); };

  const makePrimary = (id: string) => persist(banks.map(b => ({ ...b, primary: b.id === id })));

  const remove = (id: string) => {
    let updated = banks.filter(b => b.id !== id);
    if (updated.length > 0 && !updated.some(b => b.primary && isVerified(b))) {
      const firstVerified = updated.find(b => isVerified(b));
      if (firstVerified) updated = updated.map(b => ({ ...b, primary: b.id === firstVerified.id }));
    }
    persist(updated);
    setRemoveId(null);
  };

  const addAccount = () => {
    const acct = acctNumber.replace(/\D/g, '');
    if (!bankName.trim()) { setError('Enter the bank name.'); return; }
    if (routing.replace(/\D/g, '').length !== 9) { setError('Enter a valid 9-digit routing number.'); return; }
    if (acct.length < 4) { setError('Enter the account number.'); return; }
    const entry: BankAccount = {
      id: `bank-new-${Date.now()}`,
      bankName: bankName.trim(),
      accountType: acctType,
      maskedNumber: '••••' + acct.slice(-4),
      primary: false,                       // can't be primary until verified
      verified: false,
      pendingMicroDeposits: [randCents(), randCents()],
    };
    persist([...banks, entry]);
    setBankName(''); setRouting(''); setAcctNumber(''); setAcctType('Checking'); setError(''); setAdding(false);
  };

  const confirmVerified = (id: string) => {
    persist(banks.map(b => (b.id === id ? { ...b, verified: true, pendingMicroDeposits: undefined } : b)));
    setVerifyId(null);
  };

  const removeTarget = banks.find(b => b.id === removeId) ?? null;
  const verifyTarget = banks.find(b => b.id === verifyId) ?? null;

  return (
    <SectionCard
      title="Linked bank accounts"
      subtitle="Bank accounts used to fund purchases and receive withdrawals."
      headerRight={!adding ? <LinkButton onClick={() => setAdding(true)}>+ Add account</LinkButton> : null}
      id="banking"
    >
      <Toast show={saved}>Bank accounts updated.</Toast>

      {banks.length === 0 && !adding && (
        <p style={{ fontSize: 13, color: theme.color.textMuted, fontStyle: 'italic', margin: 0 }}>No bank accounts linked yet.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {banks.map(b => {
          const verified = isVerified(b);
          return (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, padding: '12px 14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{b.bankName}</span>
                  {b.primary && <Chip tone="primary">Primary</Chip>}
                  {verified ? <Chip tone="success">✓ Verified</Chip> : <Chip tone="warning">⏳ Pending verification</Chip>}
                </div>
                <div style={{ fontSize: 13, color: theme.color.textMuted, marginTop: 2 }}>{b.accountType} · {b.maskedNumber}</div>
              </div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                {!verified && <LinkButton onClick={() => setVerifyId(b.id)}>Verify</LinkButton>}
                {verified && !b.primary && <LinkButton onClick={() => makePrimary(b.id)}>Make primary</LinkButton>}
                <button onClick={() => setRemoveId(b.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.color.danger, fontSize: 13, fontWeight: 600 }}>Remove</button>
              </div>
            </div>
          );
        })}
      </div>

      {adding && (
        <div style={{ marginTop: 14, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, padding: 16 }}>
          <div style={editGrid(2)}>
            <Field label="Bank name"><TextInput value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. First National Bank" /></Field>
            <Field label="Account type">
              <select value={acctType} onChange={e => setAcctType(e.target.value as 'Checking' | 'Savings')} style={{ ...inputStyle }}>
                <option value="Checking">Checking</option>
                <option value="Savings">Savings</option>
              </select>
            </Field>
            <Field label="Routing number"><TextInput value={routing} inputMode="numeric" maxLength={9} onChange={e => setRouting(e.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="9 digits" /></Field>
            <Field label="Account number"><TextInput value={acctNumber} inputMode="numeric" onChange={e => setAcctNumber(e.target.value.replace(/\D/g, ''))} placeholder="Account number" /></Field>
          </div>
          {error && <p style={{ fontSize: 13, color: theme.color.danger, margin: '0 0 10px' }}>{error}</p>}
          <p style={{ fontSize: 12, color: theme.color.textMuted, lineHeight: 1.5, margin: '0 0 12px' }}>
            To confirm you own this account, we'll send <strong>two small trial deposits</strong> (a few cents each)
            that post in 1–2 business days. You'll then enter the amounts to verify it. We store only the last four digits.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <PrimaryButton onClick={addAccount}>Link account</PrimaryButton>
            <GhostButton onClick={() => { setAdding(false); setError(''); }}>Cancel</GhostButton>
          </div>
        </div>
      )}

      {removeTarget && (
        <ConfirmDialog
          title="Remove this bank account?"
          message={<>You're about to unlink <strong>{removeTarget.bankName}</strong> ({removeTarget.accountType} {removeTarget.maskedNumber}). Any scheduled transfers using it will need a new funding source. This can't be undone.</>}
          confirmLabel="Remove account"
          danger
          onConfirm={() => remove(removeTarget.id)}
          onCancel={() => setRemoveId(null)}
        />
      )}

      {verifyTarget && (
        <MicroDepositModal bank={verifyTarget} onClose={() => setVerifyId(null)} onVerified={() => confirmVerified(verifyTarget.id)} />
      )}
    </SectionCard>
  );
}

function MicroDepositModal({ bank, onClose, onVerified }: { bank: BankAccount; onClose: () => void; onVerified: () => void }) {
  const expected = bank.pendingMicroDeposits ?? [];
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    const ca = Math.round(parseFloat(a) * 100);
    const cb = Math.round(parseFloat(b) * 100);
    if (!ca || !cb) { setError('Enter both deposit amounts.'); return; }
    const got = [ca, cb].sort((x, y) => x - y).join(',');
    const want = [...expected].sort((x, y) => x - y).join(',');
    if (got !== want) { setError('Those amounts don\'t match the deposits. Check your bank and try again.'); return; }
    onVerified();
  };

  return (
    <ModalShell onClose={onClose}>
      <div style={{ fontWeight: 700, fontSize: 18, fontFamily: theme.font.serif, color: theme.color.text, marginBottom: 8 }}>Verify {bank.bankName}</div>
      <p style={{ fontSize: 14, color: theme.color.textMuted, lineHeight: 1.55, margin: '0 0 14px' }}>
        Enter the two trial-deposit amounts that posted to {bank.accountType.toLowerCase()} {bank.maskedNumber}.
      </p>
      <div style={{ background: theme.color.surfaceMuted, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, padding: '10px 12px', fontSize: 12, color: theme.color.textMuted, marginBottom: 14 }}>
        Demo: in production these arrive in your bank in 1–2 days. Here they are{' '}
        <strong>${(expected[0] / 100).toFixed(2)}</strong> and <strong>${(expected[1] / 100).toFixed(2)}</strong>.
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <Field label="Deposit 1"><TextInput value={a} inputMode="decimal" placeholder="0.00" onChange={e => setA(e.target.value)} /></Field>
        <Field label="Deposit 2"><TextInput value={b} inputMode="decimal" placeholder="0.00" onChange={e => setB(e.target.value)} /></Field>
      </div>
      {error && <p style={{ fontSize: 13, color: theme.color.danger, margin: '8px 0 0' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <PrimaryButton onClick={submit}>Verify account</PrimaryButton>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
      </div>
    </ModalShell>
  );
}
