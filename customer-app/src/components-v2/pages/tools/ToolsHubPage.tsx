import React from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../../../theme';

// The Tools hub: a single discovery point for every interactive calculator. Cards link
// out to each tool (including the pre-existing Retirement Calculator, so this page becomes
// the canonical home for all of them without moving anything).

interface ToolEntry {
  to: string;
  icon: string;
  title: string;
  blurb: string;
  tag: string;
}

const TOOLS: ToolEntry[] = [
  {
    to: '/tools/fees',
    icon: '💸',
    title: 'The Cost of Fees',
    blurb: 'See how a fund’s expense ratio quietly compounds over decades — and what Bob’s low fees keep in your pocket.',
    tag: 'Most popular',
  },
  {
    to: '/tools/growth',
    icon: '📈',
    title: 'Growth Projector',
    blurb: 'Project how a starting balance plus regular contributions can grow with the power of compounding.',
    tag: 'Compounding',
  },
  {
    to: '/tools/dollar-cost-averaging',
    icon: '📊',
    title: 'Dollar-Cost Averaging',
    blurb: 'Compare investing steadily over time against trying to time the market with one lump sum.',
    tag: 'Staying invested',
  },
  {
    to: '/tools/roth-vs-traditional',
    icon: '⚖️',
    title: 'Roth vs. Traditional IRA',
    blurb: 'Tax-free withdrawals later, or a deduction now? Compare the after-tax outcome of each account.',
    tag: 'Accounts & taxes',
  },
  {
    to: '/tools/risk-profile',
    icon: '🧭',
    title: 'Risk Profile',
    blurb: 'Answer a few quick questions to get a starting stock/bond/international mix built from Bob’s funds.',
    tag: 'Build a portfolio',
  },
  {
    to: '/resources/retirement-calculator',
    icon: '🎯',
    title: 'Retirement Calculator',
    blurb: 'Estimate what you’ll need to retire comfortably and see whether you’re currently on track.',
    tag: 'Planning',
  },
];

function ToolCard({ tool }: { tool: ToolEntry }) {
  return (
    <Link to={tool.to} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <div
        style={{
          background: theme.color.surface,
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.xl,
          padding: '26px 26px 22px',
          height: '100%', boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column',
          boxShadow: theme.shadow.sm,
          transition: 'box-shadow 0.15s, transform 0.15s, border-color 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = theme.shadow.lg;
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
          (e.currentTarget as HTMLElement).style.borderColor = theme.color.borderStrong;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = theme.shadow.sm;
          (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
          (e.currentTarget as HTMLElement).style.borderColor = theme.color.border;
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, background: theme.color.primarySoft,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
          }}>{tool.icon}</div>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: theme.color.accent, background: theme.color.accentSoft,
            padding: '4px 10px', borderRadius: theme.radius.pill,
          }}>{tool.tag}</span>
        </div>
        <h3 style={{
          margin: '0 0 8px', fontSize: 21, fontWeight: 700,
          fontFamily: theme.font.serif, color: theme.color.text, letterSpacing: '-0.01em',
        }}>{tool.title}</h3>
        <p style={{ margin: '0 0 18px', fontSize: 14, color: theme.color.textMuted, lineHeight: 1.55, flex: 1 }}>
          {tool.blurb}
        </p>
        <span style={{ fontSize: 14, fontWeight: 700, color: theme.color.primary }}>
          Open the tool →
        </span>
      </div>
    </Link>
  );
}

export function ToolsHubPage() {
  return (
    <div style={{ fontFamily: theme.font.sans, background: theme.color.bg, minHeight: '100vh' }}>

      {/* ── Header ── */}
      <div style={{
        background: `linear-gradient(135deg, ${theme.color.primaryDeep} 0%, ${theme.color.primary} 100%)`,
        borderTop: `5px solid ${theme.color.accent}`,
        padding: '52px 48px 48px',
      }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: theme.color.accent, marginBottom: 14,
          }}>
            Bob's Mutual Funds
          </div>
          <h1 style={{
            margin: '0 0 18px', fontSize: 60, fontWeight: 800,
            fontFamily: theme.font.serif, color: theme.color.textOnPrimary,
            letterSpacing: '-0.03em', lineHeight: 1,
          }}>
            Tools &amp; Calculators
          </h1>
          <p style={{
            margin: 0, fontSize: 18, color: 'rgba(251,249,244,0.70)',
            maxWidth: 580, lineHeight: 1.6,
          }}>
            Simple, interactive tools to help you make sense of fees, growth, taxes, and risk —
            and see the numbers behind every decision.
          </p>
        </div>
      </div>

      {/* ── Tool grid ── */}
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '48px 48px 80px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 22,
        }}>
          {TOOLS.map(tool => <ToolCard key={tool.to} tool={tool} />)}
        </div>
      </div>
    </div>
  );
}
