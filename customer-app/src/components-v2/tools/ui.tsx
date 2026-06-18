import React from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../../theme';

// Shared layout + result primitives for the Tools suite. Keeps every calculator visually
// consistent with the existing site (same card, gradient top-accent, serif headings,
// "not financial advice" disclaimer) without touching any existing page.

const tones = {
  primary: { text: theme.color.primary, bg: theme.color.primarySoft,  border: theme.color.primarySoftBorder },
  success: { text: theme.color.success, bg: theme.color.successSoft,   border: theme.color.successBorder },
  accent:  { text: theme.color.accent,  bg: theme.color.accentSoft,    border: '#E3C9AE' },
  danger:  { text: theme.color.danger,  bg: theme.color.dangerSoft,    border: '#DDA5A5' },
  warning: { text: theme.color.warning, bg: theme.color.warningSoft,   border: theme.color.warningBorder },
  neutral: { text: theme.color.text,    bg: theme.color.surfaceMuted,  border: theme.color.border },
} as const;

export type Tone = keyof typeof tones;

/** Full-page shell: back link, eyebrow, serif title, subtitle, body, and disclaimer. */
export function ToolPage({
  eyebrow = 'Tools', title, subtitle, children, disclaimer, maxWidth = 1060,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  disclaimer?: string;
  maxWidth?: number;
}) {
  return (
    <div style={{ maxWidth, margin: '0 auto', padding: '32px 28px 56px', fontFamily: theme.font.sans }}>
      <Link
        to="/tools"
        style={{ display: 'inline-block', marginBottom: 16, fontSize: 13, color: theme.color.textMuted, textDecoration: 'none', fontWeight: 500 }}
        onMouseEnter={e => (e.currentTarget.style.color = theme.color.primary)}
        onMouseLeave={e => (e.currentTarget.style.color = theme.color.textMuted)}
      >
        ← All Tools
      </Link>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.color.accent, marginBottom: 8 }}>
        {eyebrow}
      </div>
      <h1 style={{ margin: '0 0 10px', fontSize: 42, fontWeight: 800, fontFamily: theme.font.serif, letterSpacing: '-0.02em', color: theme.color.text }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 19, lineHeight: 1.55, maxWidth: 720 }}>
          {subtitle}
        </p>
      )}
      {children}
      <div style={{
        marginTop: 28, padding: '14px 18px', borderRadius: theme.radius.lg,
        background: theme.color.warningSoft, border: `1px solid ${theme.color.warningBorder}`,
        fontSize: 14, color: theme.color.warning, lineHeight: 1.55,
      }}>
        {disclaimer ?? 'This tool provides estimates for educational purposes only and is not financial, tax, or investment advice. Projections assume a constant rate of return; actual results will vary. Consider consulting a qualified professional for guidance specific to your situation.'}
      </div>
    </div>
  );
}

/** Surface card with the brand gradient top-accent used throughout the site. */
export function ToolCard({ title, children, accent = true, style }: {
  title?: string;
  children: React.ReactNode;
  accent?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{
      background: theme.color.surface, borderRadius: theme.radius.xl,
      padding: '26px 30px', boxShadow: theme.shadow.md,
      border: `1px solid ${theme.color.border}`, position: 'relative', overflow: 'hidden',
      ...style,
    }}>
      {accent && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, ${theme.color.primary}, ${theme.color.accent})`,
        }} />
      )}
      {title && (
        <h2 style={{ margin: '0 0 22px', fontSize: 25, fontWeight: 700, fontFamily: theme.font.serif, color: theme.color.text }}>
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}

/** Big highlighted result figure with a label and optional sub-line. */
export function ResultStat({ label, value, sub, tone = 'primary', big = false }: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: Tone;
  big?: boolean;
}) {
  const t = tones[tone];
  return (
    <div style={{ padding: '18px 20px', borderRadius: theme.radius.lg, background: t.bg, border: `1px solid ${t.border}` }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: theme.color.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: big ? 52 : 38, fontWeight: 800, fontFamily: theme.font.serif, color: t.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 15, color: t.text, marginTop: 8, fontWeight: 500, lineHeight: 1.45 }}>{sub}</div>}
    </div>
  );
}

/** A row of label/value pairs separated by hairlines (secondary stats block). */
export function StatList({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <div style={{ padding: '6px 20px', borderRadius: theme.radius.lg, background: theme.color.surfaceMuted, border: `1px solid ${theme.color.border}` }}>
      {rows.map((row, i) => (
        <div
          key={i}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            padding: '12px 0',
            borderBottom: i < rows.length - 1 ? `1px solid ${theme.color.border}` : 'none',
          }}
        >
          <div style={{ fontSize: 15, color: theme.color.textMuted, fontWeight: 500 }}>{row.label}</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: theme.color.text, fontVariantNumeric: 'tabular-nums' }}>{row.value}</div>
        </div>
      ))}
    </div>
  );
}

/** Colored callout / punchline box. */
export function Callout({ tone = 'primary', children, style }: { tone?: Tone; children: React.ReactNode; style?: React.CSSProperties }) {
  const t = tones[tone];
  return (
    <div style={{
      padding: '16px 20px', borderRadius: theme.radius.lg, background: t.bg,
      border: `1px solid ${t.border}`, color: t.text, fontSize: 16, lineHeight: 1.55, ...style,
    }}>
      {children}
    </div>
  );
}

/** Navy CTA button used to push toward a self-service page. */
export function CtaButton({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      style={{
        display: 'inline-block', background: theme.color.accent, color: '#FFFFFF',
        borderRadius: 8, padding: '11px 24px', fontSize: 16, fontWeight: 700,
        textDecoration: 'none', letterSpacing: '0.01em',
      }}
    >
      {children}
    </Link>
  );
}

/** Themed tooltip style for recharts, matching PortfolioPage. Colocated with the chart UI
 *  helpers; this single shared style constant doesn't warrant its own module. */
// eslint-disable-next-line react-refresh/only-export-components
export const chartTooltipStyle: React.CSSProperties = {
  background: theme.color.surface, border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md, fontSize: 13, fontFamily: theme.font.sans,
};
