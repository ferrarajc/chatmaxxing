import React, { useEffect, useState } from 'react';
import { ContactSlot } from '../types';
import { WRAP_UP_CODES } from '../data/wrapUpCodes';

interface Props { slot: ContactSlot; }

export function AfterCallWork({ slot }: Props) {
  const acw = slot.acwData;
  const loading = acw === null;

  const [selectedCode, setSelectedCode] = useState('');
  const [summaryText, setSummaryText] = useState('');

  // Populate fields when ACW data arrives
  useEffect(() => {
    if (!acw) return;
    setSelectedCode(acw.wrapUpCode);
    setSummaryText(acw.summary);
  }, [acw?.wrapUpCode, acw?.summary]);

  const handleClose = () => {
    window.dispatchEvent(
      new CustomEvent('bobs:closeContact', { detail: { contactId: slot.contactId } }),
    );
  };

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      padding: '0 16px', minHeight: 0, overflow: 'hidden',
      background: '#fff',
    }}>
      {/* ── Wrap-up code — 10% from top ──────────────────────────────────── */}
      <div style={{ paddingTop: '10%' }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 4 }}>
          Wrap-up code
        </label>
        {loading ? (
          <div style={skeletonStyle(28)} />
        ) : (
          <select
            value={selectedCode}
            onChange={e => setSelectedCode(e.target.value)}
            style={{
              width: '100%', padding: '6px 10px', borderRadius: 7,
              border: '1.5px solid #d1d5db', fontSize: 13, background: '#fff',
              color: '#111', cursor: 'pointer', outline: 'none',
            }}
          >
            {WRAP_UP_CODES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── Coaching ─────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 14 }}>
        <div style={sectionLabelStyle}>Coaching</div>
        {loading ? (
          <>
            <div style={skeletonStyle(14, 8)} />
            <div style={skeletonStyle(12, 4)} />
            <div style={skeletonStyle(12, 4)} />
          </>
        ) : (
          <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.55 }}>
            {acw.coaching.positive && (
              <div style={{ display: 'flex', gap: 6, marginBottom: acw.coaching.bullets.length ? 5 : 0 }}>
                <span style={{ color: '#10b981', fontWeight: 700, flexShrink: 0 }}>✓</span>
                <span>{acw.coaching.positive}</span>
              </div>
            )}
            {acw.coaching.bullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: i < acw.coaching.bullets.length - 1 ? 4 : 0 }}>
                <span style={{ color: '#f59e0b', fontWeight: 700, flexShrink: 0 }}>•</span>
                <span>{b}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Call summary ─────────────────────────────────────────────────── */}
      <div style={{ marginTop: 14, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={sectionLabelStyle}>Call summary</div>
        {loading ? (
          <div style={{ flex: 1, ...skeletonStyle(0, 0), minHeight: 80 }} />
        ) : (
          <textarea
            value={summaryText}
            onChange={e => setSummaryText(e.target.value)}
            style={{
              flex: 1, resize: 'none', border: '1.5px solid #d1d5db',
              borderRadius: 7, padding: '7px 10px', fontSize: 12,
              lineHeight: 1.6, outline: 'none', fontFamily: 'inherit',
              color: '#111', minHeight: 80,
            }}
          />
        )}
      </div>

      {/* ── Close contact — 10% from bottom ──────────────────────────────── */}
      <div style={{ paddingBottom: '10%', paddingTop: 12 }}>
        <button
          onClick={handleClose}
          style={{
            width: '100%', padding: '10px 0', borderRadius: 8,
            background: '#1a56db', color: '#fff', fontWeight: 700,
            fontSize: 13, border: 'none', cursor: 'pointer',
            letterSpacing: '.2px',
          }}
        >
          Close contact
        </button>
      </div>
    </div>
  );
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#374151',
  textTransform: 'uppercase', letterSpacing: '.5px',
  marginBottom: 6,
};

function skeletonStyle(height: number, marginTop = 0): React.CSSProperties {
  return {
    height: height || '100%',
    background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
    borderRadius: 6,
    marginTop,
  };
}
