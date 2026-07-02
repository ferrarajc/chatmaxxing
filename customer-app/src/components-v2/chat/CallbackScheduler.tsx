import React, { useMemo, useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useClientStore } from '../../store/clientStore';
import { post } from '../../api/client';
import { CallbackConfirmation, ChatMessage } from '../../types';
import { theme } from '../../theme';

interface Props {
  onScheduled: () => void;
  onCancel: () => void;
}

// ── Eastern-Time slot model ──────────────────────────────────────────────────
// Callbacks run 8:00 AM–7:30 PM ET, Mon–Fri (enforced server-side). We present the
// client explicit ET slots so they never (a) pick an after-hours/past time that the
// server rejects, or (b) hit timezone ambiguity from a raw datetime-local. The chosen
// ET wall-clock is sent as `scheduledTimeET`; the server resolves it to UTC (DST-safe).
const ET_ZONE = 'America/New_York';
const SLOT_HOURS = Array.from({ length: 12 }, (_, i) => 8 + i); // 8 AM … 7 PM (last valid start before the 7:30 cutoff)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

function etParts(d: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ET_ZONE, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  return { weekday: g('weekday'), y: +g('year'), m: +g('month'), d: +g('day'), hour: +g('hour') % 24, min: +g('minute') };
}

function slotLabel(h: number) {
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:00 ${ampm}`;
}

interface DayOption { key: string; label: string; slots: number[] }

/** Next 5 business days in ET; today's past/imminent slots are filtered out. */
function buildDays(): DayOption[] {
  const now = new Date();
  const nowET = etParts(now);
  const todayKey = `${nowET.y}-${pad(nowET.m)}-${pad(nowET.d)}`;
  const tET = etParts(new Date(now.getTime() + 86_400_000));
  const tomorrowKey = `${tET.y}-${pad(tET.m)}-${pad(tET.d)}`;
  const days: DayOption[] = [];
  const seen = new Set<string>();
  for (let i = 0; days.length < 5 && i < 14; i++) {
    const c = etParts(new Date(now.getTime() + i * 86_400_000));
    const key = `${c.y}-${pad(c.m)}-${pad(c.d)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (c.weekday === 'Sat' || c.weekday === 'Sun') continue;
    let slots = SLOT_HOURS;
    if (key === todayKey) {
      const cutoff = nowET.hour * 60 + nowET.min + 20; // ≥20 min out
      slots = SLOT_HOURS.filter(h => h * 60 >= cutoff);
    }
    if (!slots.length) continue;
    const label = key === todayKey ? 'Today' : key === tomorrowKey ? 'Tomorrow' : `${c.weekday}, ${MONTHS[c.m - 1]} ${c.d}`;
    days.push({ key, label, slots });
  }
  return days;
}

/** A short, specific ask pulled from what the client actually said (skips nav/filler). */
function deriveIntent(messages: ChatMessage[], firstName: string): string {
  const NAV = /^(yes|yeah|yep|no|nope|ok|okay|sure|thanks|thank you|connect me|a? ?callback|schedule)/i;
  const ask = [...messages].reverse().find(
    m => m.role === 'CUSTOMER' && m.content.trim().length > 12 && !NAV.test(m.content.trim()),
  );
  return ask
    ? ask.content.trim().replace(/\s+/g, ' ').slice(0, 240)
    : `${firstName} requested a callback with a licensed advisor.`;
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: theme.color.textMuted, marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '0.06em',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px',
  border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md,
  fontSize: 14, boxSizing: 'border-box',
  fontFamily: theme.font.sans, color: theme.color.text,
  background: theme.color.surface, outline: 'none',
};

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 12px', borderRadius: theme.radius.md,
    border: `1px solid ${active ? theme.color.primary : theme.color.border}`,
    background: active ? theme.color.primarySoft : theme.color.surface,
    color: active ? theme.color.primary : theme.color.textMuted,
    fontWeight: active ? 600 : 500, cursor: 'pointer', fontSize: 13,
    fontFamily: theme.font.sans, transition: 'all .15s', whiteSpace: 'nowrap',
  };
}

export function CallbackScheduler({ onScheduled, onCancel }: Props) {
  const { addMessage, transitionTo, setCallbackConfirmation, messages, contactId } = useChatStore();
  const activePersona = useClientStore(s => s.activePersona);

  const days = useMemo(buildDays, []);
  const firstName = (activePersona.name || 'there').split(' ')[0];

  const [phone, setPhone] = useState(activePersona.displayPhone || '');
  const [timeChoice, setTimeChoice] = useState<'ASAP' | 'scheduled'>('ASAP');
  const [dayKey, setDayKey] = useState<string>(days[0]?.key ?? '');
  const [hour, setHour] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selectedDay = days.find(d => d.key === dayKey) ?? days[0];

  const handleSubmit = async () => {
    setError('');
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) { setError('Please enter a valid 10-digit phone number.'); return; }

    let scheduledTimeET: string | undefined;
    if (timeChoice === 'scheduled') {
      if (!selectedDay || hour == null) { setError('Please pick a day and time.'); return; }
      scheduledTimeET = `${selectedDay.key}T${pad(hour)}:00`;
    }

    setIsSubmitting(true);
    try {
      const result = await post<CallbackConfirmation>('/schedule-callback', {
        clientId: activePersona.clientId,
        clientName: activePersona.name,
        phoneNumber: cleanPhone,
        scheduledTime: timeChoice === 'ASAP' ? 'ASAP' : scheduledTimeET,
        scheduledTimeET,
        intentSummary: deriveIntent(messages, firstName),
        // Attach the conversation so the callback cockpit shows the REAL originating chat.
        originTranscriptId: contactId ?? undefined,
        originMessages: messages.map(m => ({ role: m.role, content: m.content })),
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
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 0, color: theme.color.textMuted }}
        >←</button>
        <h3 style={{ margin: 0, fontSize: 17, fontFamily: theme.font.serif, fontWeight: 600, color: theme.color.text, letterSpacing: '-0.01em' }}>
          Schedule a callback
        </h3>
      </div>

      <p style={{ margin: 0, fontSize: 13, color: theme.color.textMuted, lineHeight: 1.5 }}>
        A licensed advisor will call {firstName} to pick up where this chat left off.
      </p>

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
                cursor: 'pointer', fontSize: 13, fontFamily: theme.font.sans, transition: 'all .15s',
              }}
            >
              {opt === 'ASAP' ? 'Right away' : 'Pick a time'}
            </button>
          ))}
        </div>
        {timeChoice === 'ASAP' && (
          <p style={{ margin: '8px 0 0', fontSize: 12, color: theme.color.textMuted }}>
            An advisor will call in about 2 minutes.
          </p>
        )}
      </div>

      {timeChoice === 'scheduled' && (
        <>
          <div>
            <label style={labelStyle}>Day</label>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {days.map(d => (
                <button
                  key={d.key}
                  onClick={() => { setDayKey(d.key); if (hour != null && !d.slots.includes(hour)) setHour(null); }}
                  style={chipStyle(d.key === dayKey)}
                >{d.label}</button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Time <span style={{ textTransform: 'none', fontWeight: 500, letterSpacing: 0 }}>(Eastern, Mon–Fri 8 AM–7:30 PM)</span></label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(selectedDay?.slots ?? []).map(h => (
                <button
                  key={h}
                  onClick={() => setHour(h)}
                  style={{ ...chipStyle(h === hour), flex: '0 0 auto', minWidth: 78, textAlign: 'center' }}
                >{slotLabel(h)}</button>
              ))}
            </div>
          </div>
        </>
      )}

      {error && <p style={{ color: theme.color.danger, fontSize: 13, margin: 0 }}>{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        style={{
          padding: '12px 16px', background: theme.color.primary, color: theme.color.textOnPrimary,
          border: 'none', borderRadius: theme.radius.md, fontSize: 14, fontWeight: 600,
          cursor: isSubmitting ? 'default' : 'pointer', opacity: isSubmitting ? 0.7 : 1,
          fontFamily: theme.font.sans, letterSpacing: '0.01em',
        }}
      >
        {isSubmitting ? 'Scheduling…' : 'Schedule callback'}
      </button>
    </div>
  );
}
