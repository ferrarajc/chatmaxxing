import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../../../theme';
import { GUIDES, OPINIONS, BOB_BYLINE, BOB_TITLE, Article } from '../../../data/library';

// ── Podcast Player ─────────────────────────────────────────────────────────────
const AUDIO_SRC = `${import.meta.env.BASE_URL}podcast/From_zero_to_fully_invested.m4a`;

function fmtTime(s: number): string {
  if (!isFinite(s) || isNaN(s)) return '--:--';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function PodcastPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying]       = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]     = useState(0);
  const [loaded, setLoaded]         = useState(false);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else         { a.play().then(() => setPlaying(true)).catch(() => {}); }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect  = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const COGNAC = theme.color.accent;
  const IVORY  = '#FBF9F4';

  return (
    <div style={{
      background: `linear-gradient(135deg, #7A3A18 0%, ${COGNAC} 60%, #C47A40 100%)`,
      padding: '0 48px',
    }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '40px 0 44px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 48, alignItems: 'center',
        }}>

          {/* ── Branding ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'rgba(255,255,255,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, flexShrink: 0,
              }}>🎙</div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(251,249,244,0.6)', marginBottom: 2 }}>Podcast</div>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: theme.font.serif, color: IVORY, letterSpacing: '-0.01em' }}>The Bob Pod</div>
              </div>
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(251,249,244,0.55)', marginBottom: 8 }}>
              Episode 1
            </div>
            <div style={{ fontSize: 14, color: 'rgba(251,249,244,0.75)', lineHeight: 1.5 }}>
              Investing basics for financial newbies — from knowing nothing about markets to understanding what it takes to become a confident long-term investor.
            </div>
          </div>

          {/* ── Player ── */}
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: theme.font.serif, color: IVORY, marginBottom: 20, lineHeight: 1.2, letterSpacing: '-0.015em' }}>
              From Zero to Fully Invested
            </div>

            <audio
              ref={audioRef}
              src={AUDIO_SRC}
              preload="metadata"
              onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
              onLoadedMetadata={() => { setDuration(audioRef.current?.duration ?? 0); setLoaded(true); }}
              onEnded={() => { setPlaying(false); setCurrentTime(0); }}
            />

            {/* Controls row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>

              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                style={{
                  flexShrink: 0,
                  width: 48, height: 48, borderRadius: '50%',
                  background: IVORY, border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: 18,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                  transition: 'transform 0.12s, box-shadow 0.12s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.07)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                title={playing ? 'Pause' : 'Play'}
              >
                {playing ? '⏸' : '▶'}
              </button>

              {/* Progress bar + time */}
              <div style={{ flex: 1 }}>
                {/* Track */}
                <div
                  onClick={handleSeek}
                  style={{
                    height: 6, borderRadius: 999,
                    background: 'rgba(255,255,255,0.22)',
                    cursor: loaded ? 'pointer' : 'default',
                    position: 'relative', marginBottom: 8,
                  }}
                >
                  {/* Fill */}
                  <div style={{
                    position: 'absolute', left: 0, top: 0, height: '100%',
                    width: `${progress}%`, borderRadius: 999,
                    background: IVORY, transition: 'width 0.1s linear',
                  }} />
                  {/* Thumb */}
                  {loaded && (
                    <div style={{
                      position: 'absolute', top: '50%',
                      left: `${progress}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 14, height: 14, borderRadius: '50%',
                      background: IVORY,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                      pointerEvents: 'none',
                    }} />
                  )}
                </div>
                {/* Time */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(251,249,244,0.6)', fontVariantNumeric: 'tabular-nums' }}>
                  <span>{fmtTime(currentTime)}</span>
                  <span>{loaded ? fmtTime(duration) : 'Loading…'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
        background: theme.color.primary,
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
            Guides for every stage of your investing journey. Opinion and perspective from our founder. Reference for every question along the way.
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
      <PodcastPlayer />

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
