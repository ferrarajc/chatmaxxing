import type { CSSProperties } from 'react';
import { theme } from '../theme';
import type { OriginTranscript, TranscriptChannel, TranscriptMessage, TranscriptSpeaker } from '../types';

const chipStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap',
  fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: theme.radius.pill,
};

// The originating interaction — the chat / escalation / IVR call that precipitated the callback —
// shown as a flip-over panel so the agent can see exactly what was said before they pick up.

const CHANNEL_META: Record<TranscriptChannel, { icon: string; label: string; verb: string }> = {
  chatbot:   { icon: '💬', label: 'Web chat',           verb: 'View originating chat' },
  escalated: { icon: '💬', label: 'Escalated to a rep', verb: 'View originating chat' },
  ivr:       { icon: '☎️', label: 'Phone line (IVR)',   verb: 'View originating call' },
};

const SPEAKER_META: Record<TranscriptSpeaker, { name: string; side: 'l' | 'r' | 'c'; bg: string; fg: string }> = {
  client: { name: 'Client',          side: 'r', bg: theme.color.accentSoft,  fg: theme.color.accent },
  bob:    { name: 'Bob (assistant)', side: 'l', bg: theme.color.primarySoft, fg: theme.color.primary },
  agent:  { name: 'Licensed rep',    side: 'l', bg: theme.color.successSoft, fg: theme.color.success },
  ivr:    { name: 'Automated line',  side: 'l', bg: theme.color.surfaceMuted, fg: theme.color.textMuted },
  system: { name: '',                side: 'c', bg: '', fg: '' },
};

/** The small button that opens the flipper. */
export function TranscriptButton({ transcript, onClick }: { transcript: OriginTranscript; onClick: () => void }) {
  const m = CHANNEL_META[transcript.channel];
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, background: theme.color.surface,
      border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.pill,
      padding: '6px 13px', fontSize: 12.5, fontWeight: 700, color: theme.color.text, cursor: 'pointer',
    }}>
      <span aria-hidden>{m.icon}</span> {m.verb}
    </button>
  );
}

/**
 * The transcript itself. `fill` makes it a flex column that scrolls internally (for the call modal);
 * without it the panel flows naturally inside an already-scrolling pane (the dossier view).
 */
export function TranscriptPanel({ transcript, onBack, fill }: { transcript: OriginTranscript; onBack: () => void; fill?: boolean }) {
  const m = CHANNEL_META[transcript.channel];
  const outer = fill
    ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' as const }
    : {};
  const list = fill
    ? { flex: 1, minHeight: 0, overflowY: 'auto' as const, padding: '16px 20px' }
    : { padding: '4px 2px 0' };
  return (
    <div style={outer}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: fill ? '12px 20px' : '0 0 12px', borderBottom: `1px solid ${theme.color.border}` }}>
        <button onClick={onBack} style={{
          background: 'none', border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.md,
          padding: '5px 11px', fontSize: 12.5, fontWeight: 700, color: theme.color.textMuted, cursor: 'pointer',
        }}>‹ Back</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.color.textMuted }}>How this callback started</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: theme.color.text }}>{m.icon} {transcript.title}</div>
        </div>
        <span style={{ ...chipStyle, background: theme.color.surfaceMuted, color: theme.color.textMuted }}>{m.label}</span>
      </div>
      <div style={{ ...list, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {transcript.messages.map((msg, i) => <TxBubble key={i} msg={msg} />)}
      </div>
    </div>
  );
}

function TxBubble({ msg }: { msg: TranscriptMessage }) {
  const s = SPEAKER_META[msg.speaker] ?? SPEAKER_META.system;
  if (s.side === 'c') {
    return <div style={{ textAlign: 'center', fontSize: 12, color: theme.color.textSubtle, fontStyle: 'italic' }}>{msg.text}</div>;
  }
  return (
    <div style={{ display: 'flex', justifyContent: s.side === 'r' ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth: '82%', padding: '9px 13px', borderRadius: theme.radius.lg, background: s.bg, color: theme.color.text }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: s.fg, marginBottom: 2 }}>{s.name}</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.45 }}>{msg.text}</div>
      </div>
    </div>
  );
}
