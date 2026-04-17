import React, { useEffect, useState } from 'react';
import { ContactSlot } from '../types';
import { useAgentStore } from '../store/agentStore';

interface Props { slot: ContactSlot; }

export function IncomingAlert({ slot }: Props) {
  const [countdown, setCountdown] = useState(10);
  const store = useAgentStore();

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(tick);
          // Auto-accept fires via the Streams timeout set in useConnectStreams
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
