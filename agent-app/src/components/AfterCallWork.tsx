import React, { useEffect, useState } from 'react';
import { ContactSlot } from '../types';
import { WRAP_UP_CODES } from '../data/wrapUpCodes';

interface Props { slot: ContactSlot; }

export function AfterCallWork({ slot }: Props) {
  const acw = slot.acwData;
  const loading = acw === null;

  const [selectedCode, setSelectedCode] = useState('');
  const [summaryText, setSummaryText] = useState('');

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
      padding: '12px 16px', minHeight: 0, overflow: 'hidden', gap: 10,
    }}>
      {/* Wrap-up code */}
      <div>
        <label style={labelStyle}>Wrap-up code</label>
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

      {/* Coaching */}
      <div>
        <div style={labelStyle}>Coaching</div>
        {loading ? (
          <>
            <div style={skeletonStyle(13, 0)} />
            <div style={skeletonStyle(13, 4)} />
          </>
        ) : (
          <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.55 }}>
            {acw.coaching.positive && (
              <div style={{ display: 'flex', gap: 6, marginBottom: acw.coaching.bullets.length ? 4 : 0 }}>
                <span style={{ color: '#10b981', fontWeight: 700, flexShrink: 0 }}>✓</span>
                <span>{acw.coaching.positive}</span>
              </div>
            )}
            {acw.coaching.bullets.slice(0, 2).map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginTop: i === 0 ? 0 : 3 }}>
                <span style={{ color: '#f59e0b', fontWeight: 700, flexShrink: 0 }}>•</span>
                <span>{b}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Call summary — grows to fill remaining space */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 80 }}>
        <div style={labelStyle}>Call summary</div>
        {loading ? (
          <div style={{ flex: 1, ...skeletonStyle(0, 0) }} />
        ) : (
          <textarea
            value={summaryText}
            onChange={e => setSummaryText(e.target.value)}
            style={{
              flex: 1, resize: 'none', border: '1.5px solid #d1d5db',
              borderRadius: 7, padding: '7px 10px', fontSize: 12,
              lineHeight: 1.6, outline: 'none', fontFamily: 'inherit', color: '#111',
            }}
          />
        )}
      </div>

      {/* Close contact — sits below textarea, never overlaps */}
      <div style={{ paddingBottom: 8, flexShrink: 0 }}>
        <button
          onClick={handleClose}
          style={{
            width: '100%', padding: '10px 0', borderRadius: 8,
            background: '#1a56db', color: '#fff', fontWeight: 700,
            fontSize: 13, border: 'none', cursor: 'pointer',
          }}
        >
          Close contact
        </button>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: '#374151',
  textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5,
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
