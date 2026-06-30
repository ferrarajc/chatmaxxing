import { useState } from 'react';
import { useVoiceSettings, OPENAI_VOICES, ELEVEN_VOICES, DEFAULT_OPENAI_INSTRUCTIONS } from '../voiceSettings';
import { speak, stopSpeaking, type SpeakResult } from '../voiceTts';
import { theme } from '../theme';
import { Overlay, panel, Button, SectionLabel } from './ui';

const SAMPLE = "Hi, this is a scheduled callback from Bob's Mutual Funds. To confirm your identity, please repeat: At Bob's, my voice is my password.";

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: `1px solid ${theme.color.borderStrong}`,
  borderRadius: theme.radius.md, fontSize: 13, fontFamily: theme.font.sans, boxSizing: 'border-box',
};

export function VoicePanel() {
  const vs = useVoiceSettings();
  const [previewing, setPreviewing] = useState(false);
  const [result, setResult] = useState<SpeakResult | null>(null);

  if (!vs.panelOpen) return null;

  const preview = async () => {
    setPreviewing(true); setResult(null);
    const r = await speak(SAMPLE);
    setResult(r); setPreviewing(false);
  };
  const close = () => { stopSpeaking(); vs.openPanel(false); };

  return (
    <Overlay>
      <div style={{ ...panel, width: '100%', maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontFamily: theme.font.serif, fontSize: 18, fontWeight: 700 }}>Voice settings</div>
          <button onClick={close} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: theme.color.textMuted, lineHeight: 1 }}>×</button>
        </div>

        <SectionLabel>Engine</SectionLabel>
        <div style={{ display: 'inline-flex', background: theme.color.surfaceMuted, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.pill, padding: 4, gap: 4, marginBottom: 18 }}>
          {(['openai', 'elevenlabs'] as const).map(p => (
            <button key={p} onClick={() => vs.set({ provider: p })} style={{
              border: 'none', cursor: 'pointer', borderRadius: theme.radius.pill, padding: '7px 18px', fontSize: 13, fontWeight: 700,
              background: vs.provider === p ? theme.color.primary : 'transparent',
              color: vs.provider === p ? '#fff' : theme.color.textMuted,
            }}>{p === 'openai' ? 'OpenAI' : 'ElevenLabs'}</button>
          ))}
        </div>

        {vs.provider === 'openai' ? (
          <>
            <SectionLabel>Voice</SectionLabel>
            <select value={vs.openaiVoice} onChange={e => vs.set({ openaiVoice: e.target.value })} style={{ ...inputStyle, marginBottom: 14 }}>
              {OPENAI_VOICES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <SectionLabel>Instructions — steers tone, pace, energy</SectionLabel>
            <textarea value={vs.openaiInstructions} onChange={e => vs.set({ openaiInstructions: e.target.value })} rows={5} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.45 }} />
            <button onClick={() => vs.set({ openaiInstructions: DEFAULT_OPENAI_INSTRUCTIONS })} style={{ marginTop: 6, background: 'none', border: 'none', color: theme.color.primary, fontSize: 12, cursor: 'pointer', padding: 0 }}>Reset to default</button>
          </>
        ) : (
          <>
            <SectionLabel>Voice</SectionLabel>
            <select value={vs.elevenVoiceId} onChange={e => vs.set({ elevenVoiceId: e.target.value })} style={{ ...inputStyle, marginBottom: 12 }}>
              {ELEVEN_VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <div style={{ fontSize: 12, color: theme.color.textMuted, lineHeight: 1.5, background: theme.color.surfaceMuted, borderRadius: theme.radius.md, padding: '10px 12px' }}>
              Uses Bob's ElevenLabs key (free tier), kept server-side. If Preview falls back to the browser voice, the key isn't set on the backend yet.
            </div>
          </>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
          <Button onClick={preview} disabled={previewing}>{previewing ? 'Playing…' : '▶ Preview'}</Button>
          {result && (
            <span style={{ fontSize: 12, color: result.source === 'browser' ? theme.color.danger : theme.color.success }}>
              {result.source === 'browser'
                ? `Fell back to browser voice${result.error ? ` — ${result.error}` : ''}`
                : `Played via ${result.source}`}
            </span>
          )}
        </div>
      </div>
    </Overlay>
  );
}
