import React, { useEffect, useRef, useState } from 'react';
import { get, post } from '../../api/client';
import { useClientStore } from '../../store/clientStore';
import { ChatMessage } from '../../types';
import { downloadTranscript } from '../../utils/transcriptDownload';
import { theme } from '../../theme';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

interface TranscriptMeta {
  transcriptId: string;
  summary?: string;
  agentName?: string | null;
  startTime?: number;
  endTime?: number;
  durationMs?: number;
  savedAt?: number;
  pinned?: boolean;
}

interface TranscriptFull extends TranscriptMeta {
  clientName?: string;
  messages: Array<{ id: string; ts: number; role: ChatMessage['role']; content: string }>;
}

function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

// Total minutes:seconds — a 75-minute chat reads (75:30), per spec.
function fmtDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

// Historical messages can contain [label](/path) link markup that the live chat
// renders as navigation links; in the read-only transcript just show the label.
function stripLinkMarkup(content: string): string {
  return content.replace(/\[([^\]]+)\]\s*\(([^)]+)\)/g, '$1');
}

// Card description: the AI recap `summary` (a lowercase second-person "you …"
// clause, the same one the "Pick up where you left off" card uses). Chats
// without it (saved before the summary column shipped) are filtered out of the
// list entirely, so this only ever renders the real recap.
function cardSummary(t: TranscriptMeta): string {
  const s = (t.summary ?? '').trim();
  return s.charAt(0).toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? '' : '.');
}

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {filled ? (
        <path
          d="M9.5 1.5L14.5 6.5L11.5 9.5L11 13L8 10L4 14L3 13L7 9L4 6L7.5 5.5L9.5 1.5Z"
          fill={theme.color.accent}
          stroke={theme.color.accent}
          strokeWidth="1"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M9.5 1.5L14.5 6.5L11.5 9.5L11 13L8 10L4 14L3 13L7 9L4 6L7.5 5.5L9.5 1.5Z"
          stroke={theme.color.textMuted}
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export function ChatHistoryList({ onSelect }: { onSelect: (transcriptId: string) => void }) {
  const { activePersona } = useClientStore();
  const [items, setItems] = useState<TranscriptMeta[] | null>(null);
  const [error, setError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    get<{ transcripts: TranscriptMeta[] }>(`/get-transcripts?clientId=${encodeURIComponent(activePersona.clientId)}`)
      .then(res => {
        if (cancelled) return;
        const cutoff = Date.now() - NINETY_DAYS_MS;
        const filtered = res.transcripts.filter(t =>
          (t.savedAt ?? t.endTime ?? 0) >= cutoff && !!t.summary?.trim(),
        );
        // Pinned chats first; within each group preserve API order (newest first)
        filtered.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
        setItems(filtered);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [activePersona.clientId]);

  function handlePin(transcriptId: string, newPinned: boolean) {
    if (newPinned) scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    setItems(prev => {
      if (!prev) return prev;
      const updated = prev.map(t => t.transcriptId === transcriptId ? { ...t, pinned: newPinned } : t);
      updated.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
      return updated;
    });
    post('/pin-transcript', { transcriptId, pinned: newPinned }).catch(() => {
      // revert on failure
      setItems(prev => {
        if (!prev) return prev;
        const reverted = prev.map(t => t.transcriptId === transcriptId ? { ...t, pinned: !newPinned } : t);
        reverted.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
        return reverted;
      });
    });
  }

  return (
    <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, background: theme.color.bg }}>
      {items === null && !error && (
        <div style={{ textAlign: 'center', color: theme.color.textSubtle, fontSize: 13, padding: '24px 0' }}>
          Loading your chat history…
        </div>
      )}
      {error && (
        <div style={{ textAlign: 'center', color: theme.color.textSubtle, fontSize: 13, padding: '24px 0' }}>
          Couldn't load your chat history. Please try again later.
        </div>
      )}
      {items !== null && items.length === 0 && (
        <div style={{ textAlign: 'center', color: theme.color.textSubtle, fontSize: 13, padding: '24px 0' }}>
          No live-agent chats in the last 3 months.
        </div>
      )}
      {items && (() => {
        const pinned = items.filter(t => t.pinned);
        const unpinned = items.filter(t => !t.pinned);
        const renderCard = (t: TranscriptMeta) => (
          <div key={t.transcriptId} style={{ position: 'relative', marginBottom: 10 }}>
            <button
              onClick={() => onSelect(t.transcriptId)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: theme.color.surface, border: `1px solid ${theme.color.border}`,
                borderRadius: theme.radius.lg, padding: '12px 38px 12px 14px', marginBottom: 0,
                cursor: 'pointer', fontFamily: theme.font.sans,
                transition: 'border-color .15s, box-shadow .15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = theme.color.primary)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = theme.color.border)}
            >
              <div style={{ fontSize: 13, color: theme.color.text }}>
                <strong style={{ fontWeight: 700 }}>{fmtDateTime(t.startTime ?? t.savedAt ?? 0)}</strong>
                <span style={{ fontWeight: 400, color: theme.color.textMuted }}> ({fmtDuration(t.durationMs ?? 0)})</span>
              </div>
              <div style={{ fontSize: 13, color: theme.color.textMuted, lineHeight: 1.5, marginTop: 4 }}>
                {cardSummary(t)}
              </div>
            </button>
            <button
              onClick={() => handlePin(t.transcriptId, !t.pinned)}
              title={t.pinned ? 'Unpin chat' : 'Pin chat'}
              style={{
                position: 'absolute', top: 8, right: 8,
                width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: 'none', cursor: 'pointer', borderRadius: theme.radius.sm,
                opacity: t.pinned ? 1 : 0.45, transition: 'opacity .15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = t.pinned ? '1' : '0.45')}
            >
              <PinIcon filled={!!t.pinned} />
            </button>
          </div>
        );
        return <>
          {pinned.length > 0 && (
            <div style={{
              margin: '-14px -14px 0',
              padding: '14px 14px 0',
              background: theme.color.primarySoft,
            }}>
              {pinned.map(renderCard)}
              {unpinned.length > 0 && (
                <div style={{ margin: '0 -14px', borderBottom: `1px solid ${theme.color.border}` }} />
              )}
            </div>
          )}
          {pinned.length > 0 && unpinned.length > 0 && <div style={{ height: 10 }} />}
          {unpinned.map(renderCard)}
        </>;
      })()}
    </div>
  );
}

export function ChatTranscriptView({ transcriptId }: { transcriptId: string }) {
  const [transcript, setTranscript] = useState<TranscriptFull | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setTranscript(null);
    setError(false);
    get<{ transcript: TranscriptFull }>(`/get-transcripts?transcriptId=${encodeURIComponent(transcriptId)}`)
      .then(res => { if (!cancelled) setTranscript(res.transcript); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [transcriptId]);

  if (error) {
    return (
      <div style={{ flex: 1, padding: 24, textAlign: 'center', color: theme.color.textSubtle, fontSize: 13, background: theme.color.bg }}>
        Couldn't load this transcript. Please try again later.
      </div>
    );
  }
  if (!transcript) {
    return (
      <div style={{ flex: 1, padding: 24, textAlign: 'center', color: theme.color.textSubtle, fontSize: 13, background: theme.color.bg }}>
        Loading transcript…
      </div>
    );
  }

  const messages: ChatMessage[] = transcript.messages.map(m => ({
    id: m.id, role: m.role, content: m.content, timestamp: m.ts,
  }));

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: theme.color.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Meta header: date + download */}
      <div style={{
        padding: '10px 14px', borderBottom: `1px solid ${theme.color.border}`,
        background: theme.color.surface, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 8, position: 'sticky', top: 0,
      }}>
        <div style={{ fontSize: 12.5, color: theme.color.textMuted }}>
          <strong style={{ fontWeight: 700, color: theme.color.text }}>
            {fmtDateTime(transcript.startTime ?? 0)}
          </strong>
          {' '}({fmtDuration(transcript.durationMs ?? 0)})
          {transcript.agentName ? ` · ${transcript.agentName}` : ''}
        </div>
        <button
          onClick={() => downloadTranscript(messages, { clientName: transcript.clientName, agentName: transcript.agentName })}
          style={{
            background: 'none', border: 'none', color: theme.color.primary,
            fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: '4px 2px',
            fontFamily: theme.font.sans, textDecoration: 'underline', flexShrink: 0,
          }}
        >
          ⬇ Download
        </button>
      </div>

      {/* Read-only message list (self-contained styling — the live ChatMessage
          component derives agent initials from the active chat's store state,
          which would be wrong for a historical conversation) */}
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.map(m => {
          if (m.role === 'SYSTEM') {
            return (
              <div key={m.id} style={{ textAlign: 'center', fontSize: 12, color: theme.color.textSubtle, fontStyle: 'italic', padding: '2px 0' }}>
                {m.content}
              </div>
            );
          }
          const isCustomer = m.role === 'CUSTOMER';
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: isCustomer ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '82%', borderRadius: theme.radius.lg, padding: '9px 12px',
                fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                background: isCustomer ? theme.color.primary : theme.color.surfaceWell,
                color: isCustomer ? theme.color.textOnPrimary : theme.color.text,
                border: isCustomer ? 'none' : `1px solid ${theme.color.border}`,
              }}>
                {!isCustomer && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: theme.color.textMuted, marginBottom: 2 }}>
                    {m.role === 'AGENT' ? (transcript.agentName ?? 'Agent') : 'Virtual Assistant'}
                  </div>
                )}
                {stripLinkMarkup(m.content)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
