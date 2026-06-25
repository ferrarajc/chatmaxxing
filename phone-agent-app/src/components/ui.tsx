import React from 'react';
import { theme } from '../theme';

export const card: React.CSSProperties = {
  background: theme.color.surface,
  borderRadius: theme.radius.lg,
  border: `1px solid ${theme.color.border}`,
  boxShadow: theme.shadow.sm,
};

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
      color: theme.color.textMuted, marginBottom: 8,
    }}>{children}</div>
  );
}

export type ChipTone = 'success' | 'warning' | 'neutral' | 'primary' | 'danger' | 'accent';

export function Chip({ tone, children }: { tone: ChipTone; children: React.ReactNode }) {
  const map: Record<ChipTone, { bg: string; fg: string }> = {
    success: { bg: theme.color.successSoft, fg: theme.color.success },
    warning: { bg: theme.color.warningSoft, fg: theme.color.warning },
    neutral: { bg: theme.color.surfaceMuted, fg: theme.color.textMuted },
    primary: { bg: theme.color.primarySoft, fg: theme.color.primary },
    danger:  { bg: theme.color.dangerSoft,  fg: theme.color.danger },
    accent:  { bg: theme.color.accentSoft,  fg: theme.color.accent },
  };
  const c = map[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
      fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: theme.radius.pill,
      background: c.bg, color: c.fg,
    }}>{children}</span>
  );
}

export function Button({ children, onClick, tone, big, disabled }: {
  children: React.ReactNode; onClick?: () => void; tone?: 'primary' | 'ghost' | 'success' | 'danger';
  big?: boolean; disabled?: boolean;
}) {
  const tones = {
    primary: { background: theme.color.primary, color: '#fff', border: 'none' },
    success: { background: theme.color.success, color: '#fff', border: 'none' },
    danger:  { background: theme.color.danger, color: '#fff', border: 'none' },
    ghost:   { background: theme.color.surface, color: theme.color.text, border: `1px solid ${theme.color.borderStrong}` },
  };
  const t = tones[tone ?? 'primary'];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...t, borderRadius: theme.radius.md, cursor: disabled ? 'default' : 'pointer',
      padding: big ? '12px 22px' : '8px 16px', fontSize: big ? 15 : 13, fontWeight: 700,
      fontFamily: theme.font.sans, opacity: disabled ? 0.5 : 1, transition: 'opacity .15s',
    }}>{children}</button>
  );
}

export function Avatar({ initials, size = 40, color }: { initials: string; size?: number; color?: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color ?? theme.color.accent, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.4, fontFamily: theme.font.serif, flexShrink: 0,
    }}>{initials}</div>
  );
}

export function h1Style(): React.CSSProperties {
  return { margin: 0, fontSize: 22, fontWeight: 700, fontFamily: theme.font.serif, color: theme.color.text, letterSpacing: '-0.01em' };
}
export function h2Style(): React.CSSProperties {
  return { margin: 0, fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif, color: theme.color.text };
}

export const panel: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.xl, boxShadow: theme.shadow.xl, padding: '26px 28px',
};

export function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(8, 20, 41, 0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>{children}</div>
  );
}
