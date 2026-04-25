import React, { useEffect, useState } from 'react';
import { ContactSlot } from '../types';
import { useAgentStore } from '../store/agentStore';

interface Props { slot: ContactSlot; }

const COIN_STYLE: React.CSSProperties = {
  position: 'absolute',
  fontSize: 20,
  animation: 'bobFloat 1.6s ease-in-out infinite',
  pointerEvents: 'none',
};

export function IncomingAlert({ slot }: Props) {
  const [countdown, setCountdown] = useState(10);
  const store = useAgentStore();

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(tick);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const accept = () => {
    window.dispatchEvent(new CustomEvent('bobs:acceptContact', { detail: { contactId: slot.contactId } }));
  };

  const skip = () => {
    store.clearSlot(slot.contactId);
    window.dispatchEvent(new CustomEvent('bobs:skipContact', { detail: { contactId: slot.contactId } }));
  };

  const timerColor = countdown > 6 ? '#10b981' : countdown > 3 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: 16, width: '100%',
      boxShadow: '0 4px 20px rgba(0,0,0,.12)', border: '2px solid #1a56db',
    }}>
      {/* Bonus badge */}
      {slot.bonusEligible && (
        <>
          <style>{`
            @keyframes bobFloat {
              0%,100% { transform: translateY(0) rotate(-10deg); }
              50%      { transform: translateY(-8px) rotate(10deg); }
            }
            @keyframes bonusPop {
              0%   { transform: scale(0.7); opacity: 0; }
              70%  { transform: scale(1.08); }
              100% { transform: scale(1); opacity: 1; }
            }
          `}</style>
          <div style={{
            position: 'relative', textAlign: 'center', marginBottom: 10,
            background: 'linear-gradient(135deg,#fef9c3,#fde68a)',
            border: '2px solid #f59e0b',
            borderRadius: 12, padding: '10px 8px 8px',
            animation: 'bonusPop .4s ease-out both',
            overflow: 'visible',
          }}>
            {/* Flying bills */}
            <span style={{ ...COIN_STYLE, top: -12, left: 8,  animationDelay: '0s'    }}>💵</span>
            <span style={{ ...COIN_STYLE, top: -14, right: 12, animationDelay: '0.4s' }}>💵</span>
            <span style={{ ...COIN_STYLE, top: -10, left: '40%', animationDelay: '0.8s' }}>🪙</span>

            <div style={{ fontSize: 38, fontWeight: 900, color: '#15803d', lineHeight: 1, fontFamily: 'Georgia, serif' }}>
              $50
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginTop: 2 }}>
              Bonus opportunity
            </div>
            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3, lineHeight: 1.3 }}>
              Complete this chat with no defects today
            </div>
          </div>
        </>
      )}

      {/* Countdown ring */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          border: `4px solid ${timerColor}`, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 800, color: timerColor,
          transition: 'border-color .3s, color .3s',
        }}>
          {countdown}
        </div>
      </div>

      {/* Client info */}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{slot.clientName}</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>{slot.intentSummary}</div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
          Roth IRA · Traditional IRA · Taxable Account
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={skip}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13,
            border: '1.5px solid #d1d5db', background: '#fff', color: '#374151',
            cursor: 'pointer', fontWeight: 500,
          }}
        >Skip</button>
        <button
          onClick={accept}
          style={{
            flex: 2, padding: '8px 0', borderRadius: 8, fontSize: 13,
            border: 'none', background: '#1a56db', color: '#fff',
            cursor: 'pointer', fontWeight: 600,
          }}
        >Accept</button>
      </div>
    </div>
  );
}
