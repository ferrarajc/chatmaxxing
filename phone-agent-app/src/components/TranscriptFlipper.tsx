import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { theme } from '../theme';
import { ACTOR, actorOf } from '../actors';
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

const SPEAKER_LABEL: Record<TranscriptSpeaker, string> = {
  client: 'Client',
  bob:    'Bob (assistant)',
  agent:  'Licensed rep',
  ivr:    'Automated line',
  system: '',
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
  const a = ACTOR[actorOf(msg.speaker)];
  if (a.side === 'center') {
    return <div style={{ textAlign: 'center', fontSize: 12, color: theme.color.textSubtle, fontStyle: 'italic' }}>{msg.text}</div>;
  }
  return (
    <div style={{ display: 'flex', justifyContent: a.side === 'right' ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth: '82%', padding: '9px 13px', borderRadius: theme.radius.lg, background: a.bg, color: theme.color.text }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: a.fg, marginBottom: 2 }}>{SPEAKER_LABEL[msg.speaker]}</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.45 }}>{highlightText(msg.text, msg.highlights)}</div>
      </div>
    </div>
  );
}

/** Wrap each significant substring in a yellow <mark> so the agent's eye lands on the meaning. */
function highlightText(text: string, highlights?: string[]): ReactNode {
  const spans = (highlights ?? []).filter(Boolean);
  if (!spans.length) return text;
  let nodes: ReactNode[] = [text];
  spans.forEach((span, hi) => {
    const needle = span.toLowerCase();
    nodes = nodes.flatMap((node, ni) => {
      if (typeof node !== 'string') return [node];
      const out: ReactNode[] = [];
      const lower = node.toLowerCase();
      let from = 0, idx: number;
      while ((idx = lower.indexOf(needle, from)) !== -1) {
        if (idx > from) out.push(node.slice(from, idx));
        out.push(
          <mark key={`${hi}-${ni}-${idx}`} style={{ background: '#fde68a', color: 'inherit', padding: '0 2px', borderRadius: 3 }}>
            {node.slice(idx, idx + span.length)}
          </mark>,
        );
        from = idx + span.length;
      }
      if (from < node.length) out.push(node.slice(from));
      return out.length ? out : [node];
    });
  });
  return nodes;
}

/** A flip triangle drawn with CSS borders so it reads clearly at any size (right → down on open). */
function Triangle({ open, color }: { open: boolean; color: string }) {
  return (
    <span style={{ width: 15, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={open
        ? { width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: `11px solid ${color}` }
        : { width: 0, height: 0, borderTop: '11px solid transparent', borderBottom: '11px solid transparent', borderLeft: `12px solid ${color}` }} />
    </span>
  );
}

/**
 * A reusable collapsible "flipper" row — the global pattern for show/hide sections (Original
 * transcript, Client snapshot, …). Closed by default; the label stays visible. A large flip
 * triangle and a hover highlight give it a clear (but quiet) clickable affordance, distinct from
 * the static SectionLabel headers. `embedded` drops the own-card chrome so it can sit inside a
 * parent card.
 */
export function FlipperRow({ label, right, embedded, defaultOpen, bodyPad, children }: {
  label: string; right?: ReactNode; embedded?: boolean; defaultOpen?: boolean; bodyPad?: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [hover, setHover] = useState(false);
  const outer: CSSProperties = embedded
    ? {}
    : { flexShrink: 0, background: theme.color.surface, borderRadius: theme.radius.lg, border: `1px solid ${theme.color.border}`, boxShadow: theme.shadow.sm, overflow: 'hidden' };
  const triColor = hover || open ? theme.color.primary : theme.color.textMuted;
  return (
    <div style={outer}>
      <button
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left',
          padding: embedded ? '8px 8px' : '10px 12px', margin: embedded ? '0 -8px' : 0, borderRadius: theme.radius.md,
          background: hover ? theme.color.surfaceWell : 'transparent', border: 'none', cursor: 'pointer',
          transition: 'background .12s',
        }}
      >
        <Triangle open={open} color={triColor} />
        <span style={{ flex: 1, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: hover || open ? theme.color.primary : theme.color.text }}>
          {label}
        </span>
        {right}
      </button>
      {open && <div style={{ padding: bodyPad ?? (embedded ? '6px 0 2px' : '4px 14px 12px') }}>{children}</div>}
    </div>
  );
}

/** Collapsible "Original transcript" flipper — its body scrolls internally within a capped height. */
export function OriginalTranscriptCard({ transcript, embedded }: { transcript: OriginTranscript; embedded?: boolean }) {
  const m = CHANNEL_META[transcript.channel];
  return (
    <FlipperRow
      label="Original transcript"
      embedded={embedded}
      bodyPad={embedded ? '4px 0 2px' : '0 14px 12px'}
      right={<span style={{ ...chipStyle, background: theme.color.surfaceMuted, color: theme.color.textMuted }}>{m.icon} {m.label}</span>}
    >
      <div style={{ fontSize: 12, color: theme.color.textSubtle, marginBottom: 4 }}>{transcript.title}</div>
      <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {transcript.messages.map((msg, i) => <TxBubble key={i} msg={msg} />)}
      </div>
    </FlipperRow>
  );
}
