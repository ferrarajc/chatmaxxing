import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { theme } from '../../../theme';
import { GUIDES, OPINIONS, BOB_BYLINE, BOB_TITLE, Article } from '../../../data/library';

interface Props {
  category: 'guide' | 'opinion';
}

function RelatedCard({ article, category }: { article: Article; category: 'guide' | 'opinion' }) {
  return (
    <Link
      to={`/library/${category}/${article.slug}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div style={{
        padding: '14px 16px', background: theme.color.surface,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.lg,
        transition: 'box-shadow 0.15s',
      }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.boxShadow = theme.shadow.sm)}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.boxShadow = 'none')}
      >
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.color.accent, marginBottom: 6 }}>
          {category === 'opinion' ? 'Opinion' : 'Guide'}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: theme.font.serif, color: theme.color.text, lineHeight: 1.35 }}>
          {article.title}
        </div>
        <div style={{ fontSize: 11, color: theme.color.textSubtle, marginTop: 6 }}>
          {article.readTime} min read
        </div>
      </div>
    </Link>
  );
}

export function ArticlePage({ category }: Props) {
  const { slug } = useParams<{ slug: string }>();
  const pool = category === 'guide' ? GUIDES : OPINIONS;
  const article = pool.find(a => a.slug === slug);

  if (!article) {
    return (
      <div style={{ maxWidth: 720, margin: '60px auto', padding: '0 24px', textAlign: 'center', fontFamily: theme.font.sans }}>
        <h1 style={{ fontSize: 28, fontFamily: theme.font.serif, color: theme.color.text }}>Article not found</h1>
        <Link to="/library" style={{ color: theme.color.primary }}>← Back to the Library</Link>
      </div>
    );
  }

  const others = pool.filter(a => a.slug !== slug).slice(0, 3);
  const isOpinion = category === 'opinion';

  return (
    <div style={{ fontFamily: theme.font.sans, background: theme.color.bg, minHeight: '100vh' }}>

      {/* ── Article header band ── */}
      <div style={{
        background: isOpinion ? theme.color.primary : theme.color.primarySoft,
        borderTop: `4px solid ${theme.color.accent}`,
        padding: '44px 48px 40px',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <Link
            to="/library"
            style={{
              display: 'inline-block', marginBottom: 20,
              fontSize: 12, color: isOpinion ? 'rgba(251,249,244,0.6)' : theme.color.textMuted,
              textDecoration: 'none', fontWeight: 500,
              transition: 'color 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = isOpinion ? '#fff' : theme.color.primary)}
            onMouseLeave={e => (e.currentTarget.style.color = isOpinion ? 'rgba(251,249,244,0.6)' : theme.color.textMuted)}
          >
            ← The Library
          </Link>

          <div style={{
            display: 'inline-block', marginBottom: 16,
            fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: theme.color.accent,
            background: isOpinion ? 'rgba(160,90,44,0.18)' : theme.color.accentSoft,
            borderRadius: 4, padding: '4px 10px',
          }}>
            {isOpinion ? 'Opinion' : 'Investor\'s Handbook'}
          </div>

          <h1 style={{
            margin: '0 0 14px', fontSize: 42, fontWeight: 800,
            fontFamily: theme.font.serif,
            color: isOpinion ? theme.color.textOnPrimary : theme.color.text,
            lineHeight: 1.12, letterSpacing: '-0.025em',
          }}>
            {article.title}
          </h1>
          <p style={{
            margin: '0 0 24px', fontSize: 18,
            color: isOpinion ? 'rgba(251,249,244,0.68)' : theme.color.textMuted,
            lineHeight: 1.55, fontStyle: 'italic',
          }}>
            {article.subtitle}
          </p>

          {/* Byline row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16,
            paddingTop: 20,
            borderTop: `1px solid ${isOpinion ? 'rgba(251,249,244,0.14)' : theme.color.border}`,
          }}>
            {isOpinion && (
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: theme.color.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif,
                color: '#fff', flexShrink: 0,
              }}>B</div>
            )}
            <div>
              <div style={{
                fontSize: 14, fontWeight: 700,
                color: isOpinion ? theme.color.textOnPrimary : theme.color.text,
              }}>
                {isOpinion ? BOB_BYLINE : 'Bob\'s Mutual Funds'}
              </div>
              <div style={{ fontSize: 12, color: isOpinion ? 'rgba(251,249,244,0.5)' : theme.color.textSubtle }}>
                {isOpinion ? BOB_TITLE : 'Education'} · {article.date} · {article.readTime} min read
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Article body ── */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '52px 48px 80px' }}>

        {article.sections.map((section, i) => (
          <div key={i} style={{ marginBottom: 44 }}>
            {section.heading && (
              <h2 style={{
                margin: '0 0 18px',
                fontSize: 22, fontWeight: 700,
                fontFamily: theme.font.serif, color: theme.color.text,
                lineHeight: 1.2, letterSpacing: '-0.015em',
                paddingLeft: 14,
                borderLeft: `3px solid ${theme.color.accent}`,
              }}>
                {section.heading}
              </h2>
            )}
            {section.body.split('\n\n').map((para, j) => (
              <p key={j} style={{
                margin: '0 0 18px', fontSize: 16, color: theme.color.text,
                lineHeight: 1.75, fontWeight: 400,
              }}>
                {para}
              </p>
            ))}
            {section.bullets && section.bullets.length > 0 && (
              <ul style={{ margin: '0 0 8px', padding: 0, listStyle: 'none' }}>
                {section.bullets.map((b, k) => (
                  <li key={k} style={{
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    padding: '10px 14px',
                    background: k % 2 === 0 ? theme.color.surfaceMuted : theme.color.surface,
                    borderRadius: theme.radius.md, marginBottom: 4,
                    fontSize: 14, color: theme.color.text, lineHeight: 1.55,
                  }}>
                    <span style={{ color: theme.color.accent, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>◆</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

        {/* ── Disclaimer for opinions ── */}
        {isOpinion && (
          <div style={{
            marginTop: 32, padding: '14px 18px',
            background: theme.color.surfaceMuted,
            border: `1px solid ${theme.color.border}`,
            borderRadius: theme.radius.lg,
            fontSize: 13, color: theme.color.textMuted,
            lineHeight: 1.5,
          }}>
            The views expressed in this column are those of {BOB_BYLINE} in his personal capacity as founder and do not constitute investment advice. Past performance is not indicative of future results.
          </div>
        )}

        {/* ── More to read ── */}
        {others.length > 0 && (
          <div style={{ marginTop: 56, paddingTop: 40, borderTop: `1px solid ${theme.color.border}` }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: theme.color.accent,
              marginBottom: 18,
            }}>
              More to Read
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {others.map(a => <RelatedCard key={a.slug} article={a} category={category} />)}
            </div>
          </div>
        )}

        <div style={{ marginTop: 40 }}>
          <Link
            to="/library"
            style={{
              fontSize: 14, color: theme.color.primary,
              textDecoration: 'none', fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            ← Back to the Library
          </Link>
        </div>
      </div>
    </div>
  );
}
