import React, { useState } from 'react';
import { theme } from '../../../../theme';

// Shared primitives for the My Account hub sections. They mirror the card/heading/
// table styling already used by AccountDetailPage / PortfolioPage so the hub reads
// as one consistent surface, and keep each section file small.

export const card: React.CSSProperties = {
  background: theme.color.surface,
  borderRadius: theme.radius.lg,
  padding: 24,
  boxShadow: theme.shadow.sm,
  border: `1px solid ${theme.color.border}`,
  marginBottom: 20,
};

const h2: React.CSSProperties = {
  margin: 0, fontSize: 18, fontWeight: 600, color: theme.color.text,
  fontFamily: theme.font.serif, letterSpacing: '-0.01em',
};

export function SectionCard({
  title, subtitle, headerRight, children, id,
}: {
  title: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <div style={card} id={id}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: subtitle ? 6 : 16 }}>
        <h2 style={h2}>{title}</h2>
        {headerRight}
      </div>
      {subtitle && <p style={{ margin: '0 0 16px', fontSize: 13, color: theme.color.textMuted, lineHeight: 1.5 }}>{subtitle}</p>}
      {children}
    </div>
  );
}

/** label-left / value-right read row */
export function FieldRow({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
      padding: '11px 0', borderBottom: last ? 'none' : `1px solid ${theme.color.border}`, fontSize: 14,
    }}>
      <span style={{ color: theme.color.textMuted }}>{label}</span>
      <span style={{ fontWeight: 500, color: theme.color.text, textAlign: 'right' }}>{children}</span>
    </div>
  );
}

export const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', marginTop: 4, padding: '8px 11px', boxSizing: 'border-box',
  border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.md,
  fontSize: 14, color: theme.color.text, fontFamily: theme.font.sans, background: theme.color.surface,
};

const labelStyle: React.CSSProperties = { fontSize: 13, color: theme.color.text, display: 'block' };

/** stacked label + control for edit forms */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={labelStyle}>{label}{children}</label>;
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputStyle, ...(props.style ?? {}) }} />;
}

export function SelectInput({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, color: theme.color.text }}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

const btnBase: React.CSSProperties = {
  border: 'none', borderRadius: theme.radius.md, padding: '8px 16px',
  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: theme.font.sans,
};

export function PrimaryButton({ children, onClick, disabled, type }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit';
}) {
  return (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled}
      style={{ ...btnBase, background: theme.color.primary, color: theme.color.textOnPrimary, opacity: disabled ? 0.55 : 1, cursor: disabled ? 'default' : 'pointer' }}>
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick, tone }: {
  children: React.ReactNode; onClick?: () => void; tone?: 'default' | 'danger';
}) {
  return (
    <button onClick={onClick}
      style={{ ...btnBase, background: theme.color.surfaceMuted, color: tone === 'danger' ? theme.color.danger : theme.color.text }}>
      {children}
    </button>
  );
}

/** small text button used as a card-header action ("Edit", "Add", "Manage →") */
export function LinkButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: theme.color.primary, fontSize: 13, fontWeight: 600, fontFamily: theme.font.sans }}>
      {children}
    </button>
  );
}

export type ChipTone = 'success' | 'warning' | 'neutral' | 'primary' | 'danger';

export function Chip({ tone, children }: { tone: ChipTone; children: React.ReactNode }) {
  const map: Record<ChipTone, { bg: string; fg: string }> = {
    success: { bg: theme.color.successSoft, fg: theme.color.success },
    warning: { bg: theme.color.warningSoft, fg: theme.color.warning },
    neutral: { bg: theme.color.surfaceMuted, fg: theme.color.textMuted },
    primary: { bg: theme.color.primarySoft, fg: theme.color.primary },
    danger:  { bg: theme.color.dangerSoft,  fg: theme.color.danger },
  };
  const c = map[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
      fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: theme.radius.pill,
      background: c.bg, color: c.fg,
    }}>{children}</span>
  );
}

export function Toast({ show, children, tone }: { show: boolean; children: React.ReactNode; tone?: 'success' | 'danger' }) {
  if (!show) return null;
  const danger = tone === 'danger';
  return (
    <div style={{
      background: danger ? theme.color.dangerSoft : theme.color.successSoft,
      border: `1px solid ${danger ? theme.color.danger : theme.color.successBorder}`,
      borderRadius: theme.radius.md, padding: '9px 14px', marginBottom: 14,
      fontSize: 13, color: danger ? theme.color.danger : theme.color.success,
    }}>{children}</div>
  );
}

/** [shown, flash] — flash() shows a transient confirmation for ~2.5s */
export function useSavedToast(): [boolean, () => void] {
  const [shown, setShown] = useState(false);
  const flash = () => { setShown(true); setTimeout(() => setShown(false), 2500); };
  return [shown, flash];
}

export const editGrid = (cols: number): React.CSSProperties => ({
  display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12, marginBottom: 14,
});

/** Centered modal shell (backdrop + card). Click-outside / Cancel dismiss. */
export function ModalShell({ children, onClose, maxWidth }: { children: React.ReactNode; onClose: () => void; maxWidth?: number }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15, 35, 64, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: theme.color.surface, borderRadius: theme.radius.lg, boxShadow: theme.shadow.xl, padding: '24px 26px', width: '100%', maxWidth: maxWidth ?? 420, fontFamily: theme.font.sans }}>
        {children}
      </div>
    </div>
  );
}

/** Confirmation interceptor for drastic actions (remove bank, revoke agent, …). */
export function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onCancel }: {
  title: string; message: React.ReactNode; confirmLabel?: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <ModalShell onClose={onCancel}>
      <div style={{ fontWeight: 700, fontSize: 18, fontFamily: theme.font.serif, color: theme.color.text, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: theme.color.textMuted, lineHeight: 1.55, marginBottom: 20 }}>{message}</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onConfirm} style={{ border: 'none', borderRadius: theme.radius.md, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: theme.font.sans, background: danger ? theme.color.danger : theme.color.primary, color: '#fff' }}>
          {confirmLabel ?? 'Confirm'}
        </button>
        <GhostButton onClick={onCancel}>Cancel</GhostButton>
      </div>
    </ModalShell>
  );
}
