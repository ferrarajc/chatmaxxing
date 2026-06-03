import React from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../../../theme';
import { BOB_POD_EPISODES } from '../../../data/podcast';
import { PodcastPlayer } from './PodcastPlayer';

export function BobPodPage() {
  return (
    <div style={{ fontFamily: theme.font.sans, background: theme.color.bg, minHeight: '100vh' }}>

      {/* ── Header ── */}
      <div style={{
        background: theme.color.primary,
        borderTop: `5px solid ${theme.color.accent}`,
        padding: '52px 48px 48px',
      }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <Link
            to="/library"
            style={{ display: 'inline-block', marginBottom: 20, fontSize: 12, color: 'rgba(251,249,244,0.6)', textDecoration: 'none', fontWeight: 500 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(251,249,244,0.6)')}
          >
            ← The Library
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, flexShrink: 0,
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            }}>🎙</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: theme.color.accent, marginBottom: 6 }}>
                Podcast
              </div>
              <h1 style={{
                margin: 0, fontSize: 52, fontWeight: 800,
                fontFamily: theme.font.serif, color: theme.color.textOnPrimary,
                letterSpacing: '-0.03em', lineHeight: 1,
              }}>
                The Bob Pod
              </h1>
            </div>
          </div>
          <p style={{
            margin: 0, fontSize: 17, color: 'rgba(251,249,244,0.68)',
            maxWidth: 560, lineHeight: 1.6, fontWeight: 400,
          }}>
            Conversations about investing, markets, and building long-term wealth — from the team at Bob's Mutual Funds.
          </p>
        </div>
      </div>

      {/* ── Episode list ── */}
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '56px 48px 80px' }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: theme.color.accent,
          borderBottom: `2px solid ${theme.color.accent}`,
          paddingBottom: 2, marginBottom: 36, display: 'inline-block',
        }}>
          All Episodes
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {BOB_POD_EPISODES.map(episode => (
            <div key={episode.number} style={{
              border: `1px solid ${theme.color.border}`,
              borderRadius: theme.radius.xl,
              overflow: 'hidden',
              boxShadow: theme.shadow.sm,
            }}>
              <PodcastPlayer episode={episode} compact />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
