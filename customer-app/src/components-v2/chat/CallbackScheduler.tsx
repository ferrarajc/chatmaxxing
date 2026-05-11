import React, { useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import { post } from '../../api/client';
import { MOCK_CLIENT } from '../../data/mock-client';
import { CallbackConfirmation } from '../../types';
import { theme } from '../../theme';

interface Props {
  onScheduled: () => void;
  onCancel: () => void;
}

function toETISOString(localDateTime: string): string {
  return new Date(localDateTime).toISOString();
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px',
  border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md,
  fontSize: 14, boxSizing: 'border-box',
  fontFamily: theme.font.sans, color: theme.color.text,
  background: theme.color.surface, outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: theme.color.textMuted, marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '0.06em',
};

export function CallbackScheduler({ onScheduled, onCancel }: Props) {
  const { addMessage, transitionTo, setCallbackConfirmation } = useChatStore();
  const [phone, setPhone] = useState(MOCK_CLIENT.displayPhone);
  const [timeChoice, setTimeChoice] = useState<'ASAP' | 'scheduled'>('ASAP');
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const minDateTime = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16);

  const handleSubmit = async () => {
    setError('');
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) { setError('Please enter a valid 10-digit phone number.'); return; }
    if (timeChoice === 'scheduled' && !scheduledDateTime) { setError('Please select a date and time.'); return; }

    setIsSubmitting(true);
    try {
      const result = await post<CallbackConfirmation>('/schedule-callback', {
        clientId: MOCK_CLIENT.clientId,
        phoneNumber: cleanPhone,
        scheduledTime: timeChoice === 'ASAP' ? 'ASAP' : toETISOString(scheduledDateTime),
        intentSummary: 'Client requested callback via chat',
      });

      setCallbackConfirmation(result);
      addMessage({ role: 'BOT', content: `✅ ${result.message}` });
      transitionTo('CALLBACK_SCHEDULED');
      onScheduled();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule callback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      padding: '18px', overflowY: 'auto', flex: 1,
      display: 'flex', flexDirection: 'column', gap: 16,
      background: theme.color.surface,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={onCancel}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 18,
            padding: 0, color: theme.color.textMuted,
          }}
        >←</button>
        <h3 style={{
          margin: 0, fontSize: 17, fontFamily: theme.font.serif,
          fontWeight: 600, color: theme.color.text, letterSpacing: '-0.01em',
        }}>Schedule a callback</h3>
      </div>

      <div>
        <label style={labelStyle}>Callback number</label>
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
      </div>

      <div>
        <label style={labelStyle}>When should we call?</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['ASAP', 'scheduled'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setTimeChoice(opt)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: theme.radius.md,
                border: `1px solid ${timeChoice === opt ? theme.color.primary : theme.color.border}`,
                background: timeChoice === opt ? theme.color.primarySoft : theme.color.surface,
                color: timeChoice === opt ? theme.color.primary : theme.color.textMuted,
                fontWeight: timeChoice === opt ? 600 : 500,
                cursor: 'pointer', fontSize: 13,
                fontFamily: theme.font.sans, transition: 'all .15s',
              }}
            >
              {opt === 'ASAP' ? 'Right away' : 'Pick a time'}
            </button>
          ))}
        </div>
      </div>

      {timeChoice === 'scheduled' && (
        <div>
          <label style={labelStyle}>Date &amp; time (8 AM – 8 PM ET, Mon–Fri)</label>
          <input
            type="datetime-local"
            value={scheduledDateTime}
            min={minDateTime}
            onChange={e => setScheduledDateTime(e.target.value)}
            style={inputStyle}
          />
        </div>
      )}

      {error && <p style={{ color: theme.color.danger, fontSize: 13, margin: 0 }}>{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        style={{
          padding: '12px 16px', background: theme.color.primary, color: theme.color.textOnPrimary,
          border: 'none', borderRadius: theme.radius.md, fontSize: 14, fontWeight: 600,
          cursor: isSubmitting ? 'default' : 'pointer',
          opacity: isSubmitting ? 0.7 : 1,
          fontFamily: theme.font.sans, letterSpacing: '0.01em',
        }}
      >
        {isSubmitting ? 'Scheduling…' : 'Schedule callback'}
      </button>
    </div>
  );
}
