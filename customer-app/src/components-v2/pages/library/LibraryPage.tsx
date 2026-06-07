import React from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../../../theme';
import { GUIDES, OPINIONS, BOB_BYLINE, BOB_TITLE, Article } from '../../../data/library';
import { BOB_POD_EPISODES } from '../../../data/podcast';
import { PodcastPlayer } from './PodcastPlayer';

// ── Existing guides / help pages organized into the Reference Library ─────────
const REFERENCE = [
  {
    category: 'Retirement & Tax Planning',
    links: [
      { label: 'IRA Contribution Limits',         to: '/resources/ira-contribution-limits' },
      { label: 'Roth IRA Strategies',             to: '/resources/roth-ira' },
      { label: 'SEP-IRA',                         to: '/resources/sep-ira' },
      { label: 'SEP-IRA vs. Solo 401(k)',         to: '/resources/sep-ira-vs-solo' },
      { label: 'Self-Employed Retirement Options',to: '/resources/self-employed-retirement' },
      { label: 'Tax-Efficient Investing',         to: '/resources/tax-efficient-investing' },
      { label: 'Tax Deductions',                  to: '/resources/tax-deductions' },
      { label: 'Rollover Guide',                  to: '/resources/rollover' },
      { label: 'Retirement Calculator',           to: '/resources/retirement-calculator' },
    ],
  },
  {
    category: 'Estate & Legacy',
    links: [
      { label: 'Estate Planning',                 to: '/resources/estate-planning' },
      { label: 'Estate Planning Help',            to: '/help/estate-planning' },
      { label: 'Inheritance',                     to: '/help/inheritance' },
      { label: 'Beneficiaries',                   to: '/help/beneficiary' },
      { label: 'Ownership Forms',                 to: '/help/ownership-form' },
    ],
  },
  {
    category: 'Account Management',
    links: [
      { label: 'Open an Account',                 to: '/help/open-account' },
      { label: 'Account Access',                  to: '/help/account-access' },
      { label: 'Account Transfer',                to: '/help/account-transfer' },
      { label: 'DRIP (Dividend Reinvestment)',    to: '/help/drip' },
      { label: 'Systematic Investment Plan',      to: '/help/sip' },
      { label: 'Statements',                      to: '/help/statements' },
      { label: 'Tax Documents',                   to: '/help/tax-documents' },
      { label: 'Fees',                            to: '/help/fees' },
      { label: 'IRA Limits Reference',            to: '/help/ira-limits' },
    ],
  },
  {
    category: 'Trading & Research',
    links: [
      { label: 'Fund Performance',                to: '/help/fund-performance' },
      { label: 'How to Place a Trade',            to: '/help/place-trade' },
      { label: 'Trading',                         to: '/help/trading' },
      { label: 'How to Read a Prospectus',        to: '/help/prospectus' },
      { label: 'Cost Basis',                      to: '/help/cost-basis' },
      { label: 'Wire Transfer',                   to: '/help/wire-transfer' },
      { label: 'RMD Guide',                       to: '/help/rmd-guide' },
      { label: 'Rollover Guide',                  to: '/help/rollover-guide' },
      { label: 'Contact Us',                      to: '/help/contact' },
    ],
  },
];

// ── Small reusable elements ────────────────────────────────────────────────────

function SectionLabel({ text, color = theme.color.accent }: { text: string; color?: string }) {
  return (
    <div style={{
      display: 'inline-block',
      fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
      textTransform: 'uppercase', color,
      borderBottom: `2px solid ${color}`,
      paddingBottom: 2, marginBottom: 10,
    }}>
      {text}
    </div>
  );
}

function SectionHeader({ eyebrow, title, color = theme.color.accent }: { eyebrow: string; title: string; color?: string }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <SectionLabel text={eyebrow} color={color} />
      <h2 style={{
        margin: 0, fontSize: 30, fontWeight: 800,
        fontFamily: theme.font.serif, color: theme.color.text,
        letterSpacing: '-0.02em', lineHeight: 1.1,
      }}>{title}</h2>
    </div>
  );
}

function OpinionCard({ article }: { article: Article }) {
  return (
    <Link
      to={`/library/opinion/${article.slug}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <div style={{
        background: theme.color.surface,
        border: `1px solid ${theme.color.border}`,
        borderLeft: `4px solid ${theme.color.accent}`,
        borderRadius: `0 ${theme.radius.lg}px ${theme.radius.lg}px 0`,
        padding: '20px 22px',
        height: '100%',
        boxSizing: 'border-box',
        transition: 'box-shadow 0.15s, transform 0.15s',
      }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = theme.shadow.md;
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.color.accent, marginBottom: 10 }}>
          Opinion
        </div>
        <h3 style={{
          margin: '0 0 10px', fontSize: 16, fontWeight: 700,
          fontFamily: theme.font.serif, color: theme.color.text,
          lineHeight: 1.3, letterSpacing: '-0.01em',
        }}>
          {article.title}
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: theme.color.textMuted, lineHeight: 1.55 }}>
          {article.excerpt}
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: theme.color.textSubtle }}>
          <span style={{ fontWeight: 600, color: theme.color.accent }}>{BOB_BYLINE}</span>
          <span>{article.date} · {article.readTime} min</span>
        </div>
      </div>
    </Link>
  );
}

function GuideCard({ article, index }: { article: Article; index: number }) {
  return (
    <Link
      to={`/library/guide/${article.slug}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <div style={{
        background: theme.color.surface,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.lg,
        padding: '18px 20px',
        display: 'flex', gap: 16, alignItems: 'flex-start',
        height: '100%', boxSizing: 'border-box',
        transition: 'box-shadow 0.15s, transform 0.15s',
      }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = theme.shadow.md;
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        }}
      >
        <div style={{
          flexShrink: 0,
          width: 34, height: 34, borderRadius: '50%',
          background: theme.color.primary, color: theme.color.textOnPrimary,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, fontFamily: theme.font.serif,
          marginTop: 2,
        }}>
          {index + 1}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{
            margin: '0 0 6px', fontSize: 15, fontWeight: 700,
            fontFamily: theme.font.serif, color: theme.color.text,
            lineHeight: 1.3, letterSpacing: '-0.01em',
          }}>
            {article.title}
          </h3>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: theme.color.textMuted, lineHeight: 1.5 }}>
            {article.excerpt}
          </p>
          <div style={{ fontSize: 11, color: theme.color.textSubtle }}>
            {article.readTime} min read
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function LibraryPage() {
  const featured = OPINIONS[0]; // most recent opinion

  return (
    <div style={{ fontFamily: theme.font.sans }}>

      {/* ── Masthead ── */}
      <div style={{
        backgroundImage: `url('/chatmaxxing/images/Bookstacks.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderTop: `5px solid ${theme.color.accent}`,
        padding: '52px 48px 48px',
      }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: theme.color.accent,
            marginBottom: 14,
          }}>
            Bob's Mutual Funds
          </div>
          <h1 style={{
            margin: '0 0 18px', fontSize: 64, fontWeight: 800,
            fontFamily: theme.font.serif, color: theme.color.textOnPrimary,
            letterSpacing: '-0.03em', lineHeight: 1,
          }}>
            The Library
          </h1>
          <p style={{
            margin: 0, fontSize: 17, color: 'rgba(251,249,244,0.68)',
            maxWidth: 560, lineHeight: 1.6, fontWeight: 400,
          }}>
            Guides for every stage of your investing journey.<br />Opinion and perspective from our founder.<br />Reference for every question along the way.
          </p>
        </div>
      </div>

      {/* ── Featured Column ── */}
      <div style={{
        background: `linear-gradient(135deg, ${theme.color.primaryDeep} 0%, ${theme.color.primary} 100%)`,
        padding: '0 48px',
      }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <Link
            to={`/library/opinion/${featured.slug}`}
            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
          >
            <div style={{
              borderTop: `1px solid rgba(251,249,244,0.12)`,
              padding: '44px 0 52px',
              display: 'grid',
              gridTemplateColumns: '1fr 2fr',
              gap: 48,
              alignItems: 'center',
              cursor: 'pointer',
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.color.accent, marginBottom: 12 }}>
                  Featured Column
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: 'rgba(251,249,244,0.9)',
                  marginBottom: 6,
                }}>
                  {BOB_BYLINE}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(251,249,244,0.5)', marginBottom: 20 }}>
                  {BOB_TITLE}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(251,249,244,0.45)' }}>
                  {featured.date} · {featured.readTime} min read
                </div>
              </div>
              <div>
                <h2 style={{
                  margin: '0 0 18px', fontSize: 36, fontWeight: 800,
                  fontFamily: theme.font.serif, color: theme.color.textOnPrimary,
                  lineHeight: 1.15, letterSpacing: '-0.02em',
                }}>
                  {featured.title}
                </h2>
                <p style={{
                  margin: '0 0 24px', fontSize: 16, color: 'rgba(251,249,244,0.70)',
                  lineHeight: 1.65, fontStyle: 'italic',
                  borderLeft: `3px solid ${theme.color.accent}`,
                  paddingLeft: 18,
                }}>
                  "{featured.excerpt}"
                </p>
                <span style={{
                  display: 'inline-block',
                  background: theme.color.accent, color: '#fff',
                  borderRadius: 6, padding: '9px 20px',
                  fontSize: 13, fontWeight: 700, letterSpacing: '0.02em',
                }}>
                  Read the full column →
                </span>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* ── Podcast ── */}
      <div style={{ position: 'relative' }}>
        <PodcastPlayer episode={BOB_POD_EPISODES[0]} />
        <div style={{
          position: 'absolute', bottom: 16, right: 48,
          fontSize: 12, fontWeight: 600,
        }}>
          <Link
            to="/library/bob-pod"
            style={{ color: 'rgba(251,249,244,0.7)', textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(251,249,244,0.7)')}
          >
            All episodes →
          </Link>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '56px 48px 72px' }}>

        {/* ── Investor's Handbook ── */}
        <section style={{ marginBottom: 64 }}>
          <SectionHeader eyebrow="Education" title="The Investor's Handbook" color={theme.color.primary} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {GUIDES.map((a, i) => <GuideCard key={a.slug} article={a} index={i} />)}
          </div>
        </section>

        {/* ── Reference Library ── */}
        <section style={{ marginBottom: 64 }}>
          <SectionHeader eyebrow="Reference" title="Reference Library" color={theme.color.textMuted} />
          <div style={{
            background: theme.color.surfaceMuted,
            borderRadius: theme.radius.xl,
            padding: '32px 36px',
            border: `1px solid ${theme.color.border}`,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '32px 40px' }}>
              {REFERENCE.map(group => (
                <div key={group.category}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: theme.color.primary,
                    marginBottom: 14, paddingBottom: 8,
                    borderBottom: `2px solid ${theme.color.border}`,
                  }}>
                    {group.category}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {group.links.map(link => (
                      <Link
                        key={link.to}
                        to={link.to}
                        style={{
                          fontSize: 13, color: theme.color.text,
                          textDecoration: 'none', lineHeight: 1.45,
                          padding: '3px 0',
                          borderBottom: `1px solid transparent`,
                          transition: 'color 0.12s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = theme.color.primary)}
                        onMouseLeave={e => (e.currentTarget.style.color = theme.color.text)}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Bob's Views ── */}
        <section>
          <SectionHeader eyebrow="Opinion" title="Bob's Views" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {OPINIONS.map(a => <OpinionCard key={a.slug} article={a} />)}
          </div>
        </section>

      </div>
    </div>
  );
}
