import React, { useCallback, useEffect, useRef, useState } from 'react';
import { theme } from '../../theme';
import { post } from '../../api/client';
import { useVoice } from '../../hooks/useVoice';
import { useClientStore } from '../../store/clientStore';
import { useChatStore } from '../../store/chatStore';
import { VoiceOrb, VoicePhase } from './VoiceOrb';
import { toSpeakable } from './voiceText';
import { deriveCard, VoiceCard } from './voiceCards';
import { VoiceAnswerCard } from './VoiceAnswerCard';
import { useVoiceSettings, OPENAI_VOICES, VOICE_PRESETS } from '../../store/voiceSettingsStore';

interface BrainResult { response: string; shouldExitAutopilot: boolean; toolsUsed?: string[] }

const STARTERS = [
  "What's my balance?",
  "How's my portfolio doing?",
  "What's a Roth IRA?",
  'Tell me about my biggest holding.',
];

const CREAM = theme.color.textOnPrimary;       // #FBF9F4
const CREAM_DIM = 'rgba(251,249,244,0.62)';

const STATE_LABEL: Record<VoicePhase, string> = {
  idle: 'Click the BOrB and ask away!',
  listening: 'The BOrB is listening…',
  thinking: 'The BOrB is thinking…',
  speaking: 'The BOrB is speaking!',
  unsupported: 'Voice input isn’t supported in this browser',
  denied: 'Microphone access is blocked',
};

const panelField: React.CSSProperties = {
  display: 'block', marginTop: 4, width: '100%', padding: '8px 10px', borderRadius: 8,
  background: 'rgba(251,249,244,0.08)', color: CREAM, border: '1px solid rgba(251,249,244,0.25)',
  fontSize: 14, fontFamily: theme.font.sans, boxSizing: 'border-box',
};
const panelChip: React.CSSProperties = {
  background: 'rgba(251,249,244,0.08)', color: CREAM, border: '1px solid rgba(251,249,244,0.25)',
  borderRadius: theme.radius.pill, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontFamily: theme.font.sans,
};

export function TalkToBobOverlay({ currentPage, onClose }: { currentPage: string; onClose: () => void }) {
  const activePersona = useClientStore(s => s.activePersona);
  // activePhase is the explicitly-driven phase (idle/listening/thinking/speaking). The hard
  // browser-limitation phases are derived from the hook below, so we never sync them via an effect.
  const [activePhase, setActivePhase] = useState<VoicePhase>('idle');
  const [displayText, setDisplayText] = useState('');
  const [advisorBadge, setAdvisorBadge] = useState(false);
  const [typed, setTyped] = useState('');
  const [card, setCard] = useState<VoiceCard | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const voiceSettings = useVoiceSettings();

  // Break the cycle: useVoice needs an onFinalTranscript handler, but the handler needs the
  // voice object. Route the callback through a ref that we point at the real handler below.
  const handleUtteranceRef = useRef<(t: string) => void>(() => {});

  const voice = useVoice({
    ttsVoice: voiceSettings.voice || undefined,
    ttsInstructions: voiceSettings.instructions || undefined,
    onFinalTranscript: (t) => handleUtteranceRef.current(t),
    onError: (e) => { if (e.kind === 'no-speech') setActivePhase(p => (p === 'listening' ? 'idle' : p)); },
  });

  const phase: VoicePhase =
    voice.status === 'unsupported' ? 'unsupported'
    : voice.status === 'denied' ? 'denied'
    : activePhase;
  const phaseRef = useRef<VoicePhase>(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Warm the brain Lambda on open so the first real answer is fast (mirrors openChat()).
  useEffect(() => {
    post('/autopilot-turn', {
      transcript: [{ role: 'CUSTOMER', content: 'hello' }],
      clientProfile: activePersona, scope: 'customer-bot', currentIntent: 'general inquiry', currentPage,
    }).catch(() => { /* warmup only */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUtterance = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setAdvisorBadge(false);
    setTyped('');
    useChatStore.getState().addMessage({ role: 'CUSTOMER', content: clean });
    setCard(deriveCard(clean, activePersona));
    voice.cancelSpeak();
    setDisplayText('');
    setActivePhase('thinking');
    try {
      const transcript = useChatStore.getState().messages.filter(m => m.role !== 'SYSTEM').slice(-12);
      const result = await post<BrainResult>('/autopilot-turn', {
        transcript, clientProfile: activePersona, scope: 'customer-bot',
        currentIntent: 'general inquiry', currentPage,
      });
      const reply = (result.response ?? '').trim();
      if (!reply) { setActivePhase('idle'); return; }
      useChatStore.getState().addMessage({ role: 'BOT', content: reply, toolsUsed: result.toolsUsed ?? [] });
      setDisplayText(reply);
      if (result.shouldExitAutopilot) setAdvisorBadge(true);
      setActivePhase('speaking');
      await voice.speak(toSpeakable(reply), { onEnd: () => setActivePhase(p => (p === 'speaking' ? 'idle' : p)) });
    } catch {
      const msg = 'I’m having trouble right now. Please try again in a moment.';
      setDisplayText(msg);
      setActivePhase('speaking');
      await voice.speak(msg, { onEnd: () => setActivePhase(p => (p === 'speaking' ? 'idle' : p)) });
    }
  }, [activePersona, currentPage, voice]);

  useEffect(() => { handleUtteranceRef.current = handleUtterance; }, [handleUtterance]);

  // Orb tap: start/stop listening, or barge-in while Bob is speaking.
  const onOrbTap = useCallback(() => {
    const ph = phaseRef.current;
    if (ph === 'unsupported' || ph === 'denied' || ph === 'thinking') return;
    if (ph === 'speaking') { voice.cancelSpeak(); setActivePhase('listening'); void voice.startListening(); return; }
    if (ph === 'listening') { voice.stopListening(); setActivePhase('idle'); return; }
    setActivePhase('listening');
    void voice.startListening();
  }, [voice]);

  const handleClose = useCallback(() => { voice.reset(); onClose(); }, [voice, onClose]);

  const previewVoice = useCallback(() => {
    setActivePhase('speaking');
    void voice.speak("Well, howdy there, partner! This is how I sound. How can I help ya today?",
      { onEnd: () => setActivePhase(p => (p === 'speaking' ? 'idle' : p)) });
  }, [voice]);

  const submitTyped = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (typed.trim()) void handleUtterance(typed);
  }, [typed, handleUtterance]);

  const showStarters = phase === 'idle' && !displayText;
  const blocked = phase === 'unsupported' || phase === 'denied';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: `radial-gradient(circle at 50% 38%, ${theme.color.primary} 0%, ${theme.color.primaryDeep} 70%)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      fontFamily: theme.font.sans, color: CREAM, padding: '24px',
    }}>
      {/* Header */}
      <div style={{ width: '100%', maxWidth: 720, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.color.accent }}>
          Bob's Mutual Funds · Talk to Bob
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setSettingsOpen(o => !o)}
            title="Voice settings"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: settingsOpen ? theme.color.accent : 'rgba(251,249,244,0.1)', color: CREAM,
              border: 'none', borderRadius: theme.radius.pill, padding: '7px 14px', fontSize: 13,
              fontWeight: 600, cursor: 'pointer', fontFamily: theme.font.sans,
            }}
          >⚙ Voice</button>
          <button
            onClick={handleClose}
            title="Close"
            style={{ background: 'rgba(251,249,244,0.1)', color: CREAM, border: 'none', borderRadius: '50%', width: 36, height: 36, fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
          >×</button>
        </div>
      </div>

      {/* Voice settings panel */}
      {settingsOpen && (
        <div style={{
          width: '100%', maxWidth: 560, marginTop: 12, padding: 16,
          background: 'rgba(8,20,41,0.92)', border: '1px solid rgba(251,249,244,0.2)',
          borderRadius: theme.radius.xl, display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: theme.color.accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Voice settings
          </div>

          <div>
            <div style={{ fontSize: 12, color: CREAM_DIM, marginBottom: 8 }}>Quick presets</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {VOICE_PRESETS.map(p => {
                const active = voiceSettings.voice === p.voice && voiceSettings.instructions === p.instructions;
                return (
                  <button
                    key={p.label}
                    onClick={() => voiceSettings.applyPreset(p)}
                    style={{ ...panelChip, ...(active ? { background: theme.color.accent, borderColor: theme.color.accent } : {}) }}
                  >{p.label}</button>
                );
              })}
            </div>
          </div>

          <label style={{ fontSize: 12, color: CREAM_DIM }}>
            Base voice
            <select value={voiceSettings.voice} onChange={e => voiceSettings.setVoice(e.target.value)} style={panelField}>
              {OPENAI_VOICES.map(v => <option key={v} value={v} style={{ color: '#1A1814' }}>{v}</option>)}
            </select>
          </label>

          <label style={{ fontSize: 12, color: CREAM_DIM }}>
            Character / delivery
            <textarea
              value={voiceSettings.instructions}
              onChange={e => voiceSettings.setInstructions(e.target.value)}
              placeholder="e.g. a grizzled old Texas cowboy with a slow, gravelly drawl"
              rows={3}
              style={{ ...panelField, resize: 'vertical', lineHeight: 1.45 }}
            />
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={previewVoice}
              style={{ background: theme.color.accent, color: '#fff', border: 'none', borderRadius: theme.radius.pill, padding: '9px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: theme.font.sans }}
            >▶ Preview voice</button>
            <span style={{ fontSize: 12, color: CREAM_DIM }}>Applies to Bob's next reply, and saves automatically.</span>
          </div>
        </div>
      )}

      {/* Orb + state */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 720, gap: 18 }}>
        <div
          onClick={onOrbTap}
          role="button"
          title={phase === 'listening' ? 'Stop' : phase === 'speaking' ? 'Interrupt and ask' : 'Click the BOrB'}
          style={{ cursor: blocked || phase === 'thinking' ? 'default' : 'pointer', borderRadius: '50%', outline: 'none' }}
        >
          <VoiceOrb amplitudeRef={voice.amplitudeRef} phase={phase} size={240} />
        </div>

        <div style={{ fontSize: 20, fontWeight: 600, fontFamily: theme.font.serif, minHeight: 28, textAlign: 'center' }}>
          {STATE_LABEL[phase]}
        </div>

        {card && <VoiceAnswerCard card={card} />}

        {/* Live interim transcript while listening */}
        {phase === 'listening' && voice.interim && (
          <div style={{ fontSize: 16, color: CREAM_DIM, fontStyle: 'italic', maxWidth: 560, textAlign: 'center' }}>
            “{voice.interim}”
          </div>
        )}

        {/* Bob's reply (captions) */}
        {displayText && phase !== 'listening' && (
          <div style={{ maxWidth: 600, textAlign: 'center', fontSize: 18, lineHeight: 1.55, color: CREAM }}>
            {displayText}
          </div>
        )}

        {/* Compliance highlight */}
        {advisorBadge && (
          <div style={{ fontSize: 13, color: theme.color.accent, background: 'rgba(160,90,44,0.18)', border: `1px solid ${theme.color.accent}`, borderRadius: theme.radius.pill, padding: '6px 14px' }}>
            A licensed advisor can help with this
          </div>
        )}

        {/* Starter chips */}
        {showStarters && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 560, marginTop: 4 }}>
            {STARTERS.map(s => (
              <button
                key={s}
                onClick={() => void handleUtterance(s)}
                style={{
                  background: 'rgba(251,249,244,0.08)', color: CREAM,
                  border: '1px solid rgba(251,249,244,0.25)', borderRadius: theme.radius.pill,
                  padding: '9px 16px', fontSize: 14, cursor: 'pointer', fontFamily: theme.font.sans,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(251,249,244,0.18)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(251,249,244,0.08)')}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {blocked && (
          <div style={{ fontSize: 14, color: CREAM_DIM, maxWidth: 460, textAlign: 'center', lineHeight: 1.5 }}>
            {phase === 'unsupported'
              ? 'Try Chrome for voice input — or just type your question below. Bob will still answer out loud.'
              : 'Allow microphone access in your browser, or type your question below.'}
          </div>
        )}
      </div>

      {/* Text fallback (always available) */}
      <form onSubmit={submitTyped} style={{ width: '100%', maxWidth: 560, display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder="Or type your question…"
          style={{
            flex: 1, padding: '12px 16px', borderRadius: theme.radius.pill,
            border: '1px solid rgba(251,249,244,0.25)', background: 'rgba(251,249,244,0.08)',
            color: CREAM, fontSize: 15, fontFamily: theme.font.sans, outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={!typed.trim()}
          style={{
            background: theme.color.accent, color: '#fff', border: 'none', borderRadius: theme.radius.pill,
            padding: '12px 20px', fontSize: 15, fontWeight: 700, cursor: typed.trim() ? 'pointer' : 'default',
            opacity: typed.trim() ? 1 : 0.5, fontFamily: theme.font.sans,
          }}
        >Ask</button>
      </form>
    </div>
  );
}
