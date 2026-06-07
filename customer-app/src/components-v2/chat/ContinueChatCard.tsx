import React, { useRef, useState } from 'react';
import { LastAgentChat } from '../../types';
import { post } from '../../api/client';
import { theme } from '../../theme';

interface Props {
  continuation: LastAgentChat;
  /** preferredAgentUsername = the agent to wait for, or null for "first available". */
  onContinue: (preferredAgentUsername: string | null) => void;
}

type Phase = 'idle' | 'checking' | 'choose' | 'connecting';

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function fmtDate(ts: number): string {
  if (!ts) return 'recently';
  return new Date(ts).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

export function ContinueChatCard({ continuation, onContinue }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [steps, setSteps] = useState<string[]>([]);
  const mounted = useRef(true);
  React.useEffect(() => () => { mounted.current = false; }, []);

  const agentFull = continuation.agentName?.trim() ?? '';
  const agentFirst = agentFull ? agentFull.split(/\s+/)[0] : '';
  const waitLabel = agentFirst || 'them';

  async function handleContinue() {
    setPhase('checking');
    setSteps(['Pulling up your previous conversation…']);
    await sleep(650);
    if (!mounted.current) return;
    setSteps(s => [...s, `Checking whether ${agentFirst || 'your previous agent'} is online…`]);

    let available = false;
    try {
      const res = await post<{ available: boolean }>('/agent-availability', {
        agentUsername: continuation.agentUsername,
        agentName: continuation.agentName,
      });
      available = !!res.available;
    } catch {
      available = false;
    }
    await sleep(700);
    if (!mounted.current) return;

    if (available) {
      setPhase('choose');
    } else {
      setPhase('connecting');
      setSteps(s => [...s, `${agentFull || 'Your previous agent'} isn't online right now — connecting you with the first available agent…`]);
      await sleep(1100);
      if (!mounted.current) return;
      onContinue(null);
    }
  }

  const pillBase: React.CSSProperties = {
    padding: '7px 14px', borderRadius: theme.radius.pill, fontSize: 13,
    fontWeight: 600, cursor: 'pointer', fontFamily: theme.font.sans,
    transition: 'all .15s', border: `1px solid ${theme.color.primary}`,
  };
  const pillFilled: React.CSSProperties = {
    ...pillBase, background: theme.color.primary, color: theme.color.textOnPrimary,
  };
  const pillOutline: React.CSSProperties = {
    ...pillBase, background: theme.color.surface, color: theme.color.primary,
  };

  return (
    <div style={{
      background: '#FFFFE6', borderRadius: theme.radius.lg,
      border: `1px solid ${theme.color.border}`, borderLeft: `3px solid ${theme.color.accent}`,
      padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <style>{`@keyframes contDot { 0%,100% { opacity:.3 } 50% { opacity:1 } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 15 }} aria-hidden>↩</span>
        <span style={{
          fontFamily: theme.font.serif, fontWeight: 600, fontSize: 14,
          color: theme.color.text, letterSpacing: '-0.01em',
        }}>Pick up where you left off</span>
      </div>

      {/* Summary line — retrospective, second person, past tense */}
      <div style={{ fontSize: 13, lineHeight: 1.5, color: theme.color.textMuted }}>
        In your last chat on <strong style={{ color: theme.color.text, fontWeight: 600 }}>{fmtDate(continuation.endedAt)}</strong>, {continuation.summary}.
      </div>

      {/* Idle — the call to action */}
      {phase === 'idle' && (
        <div>
          <button onClick={handleContinue} style={pillFilled}>Continue this chat</button>
        </div>
      )}

      {/* Checking / connecting — loading annotations */}
      {(phase === 'checking' || phase === 'connecting') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {steps.map((line, i) => {
            const isLast = i === steps.length - 1;
            const active = phase === 'checking' && isLast;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: theme.color.textMuted }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: active ? theme.color.accent : theme.color.success,
                  animation: active ? 'contDot 1s ease-in-out infinite' : 'none',
                  flexShrink: 0,
                }} />
                <span>{line}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Choose — previous agent is online */}
      {phase === 'choose' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: theme.color.text }}>
            Good news — the agent who worked with you last time
            {agentFull ? <>, <strong style={{ fontWeight: 600 }}>{agentFull}</strong>,</> : ' '}
            {' '}is online. Would you prefer to wait for them, or connect with the first available agent?
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button onClick={() => onContinue(continuation.agentUsername)} style={pillFilled}>
              Wait for {waitLabel}
            </button>
            <button onClick={() => onContinue(null)} style={pillOutline}>
              First available agent
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
