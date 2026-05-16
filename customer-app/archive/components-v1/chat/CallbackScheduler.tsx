import React, { useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import { post } from '../../api/client';
import { MOCK_CLIENT } from '../../data/mock-client';
import { CallbackConfirmation } from '../../types';

interface Props {
  onScheduled: () => void;
  onCancel: () => void;
}

function toETISOString(localDateTime: string): string {
  // The datetime-local input gives local time; we store as-is and let Lambda handle TZ
  return new Date(localDateTime).toISOString();
}

export function CallbackScheduler({ onScheduled, onCancel }: Props) {
  const { addMessage, transitionTo, setCallbackConfirmation } = useChatStore();
  const [phone, setPhone] = useState(MOCK_CLIENT.displayPhone);
  const [timeChoice, setTimeChoice] = useState<'ASAP' | 'scheduled'>('ASAP');
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Min datetime: now+5min; business hours enforced server-side
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
    <div style={{ padding: '16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 0 }}>←</button>
        <h3 style={{ margin: 0, fontSize: 16 }}>Schedule a callback</h3>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Callback number</label>
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>When should we call?</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['ASAP', 'scheduled'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setTimeChoice(opt)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8,
                border: `1.5px solid ${timeChoice === opt ? '#1a56db' : '#d1d5db'}`,
                background: timeChoice === opt ? '#eff6ff' : '#fff',
                color: timeChoice === opt ? '#1a56db' : '#374151',
                fontWeight: timeChoice === opt ? 600 : 400,
                cursor: 'pointer', fontSize: 13,
              }}
            >
              {opt === 'ASAP' ? '⚡ Right away' : '🗓 Pick a time'}
            </button>
          ))}
        </div>
      </div>

      {timeChoice === 'scheduled' && (
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            Date &amp; time (8 AM – 8 PM ET, Mon–Fri)
          </label>
          <input
            type="datetime-local"
            value={scheduledDateTime}
            min={minDateTime}
            onChange={e => setScheduledDateTime(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
          />
        </div>
      )}

      {error && <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        style={{
          padding: '11px 16px', background: '#1a56db', color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
          cursor: isSubmitting ? 'default' : 'pointer',
          opacity: isSubmitting ? 0.7 : 1,
        }}
      >
        {isSubmitting ? 'Scheduling…' : 'Schedule callback'}
      </button>
    </div>
  );
}
