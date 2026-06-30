import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { post } from '../api/client';
import { theme } from '../theme';
import { card, Chip, Button, Avatar, SectionLabel, h2Style } from './ui';
import { initials } from '../util';

interface AcwResult {
  wrapUpCode: string;
  coaching: { positive: string; bullets: string[] };
  summary: string;
  wrapUpCodes: string[];
}

const FALLBACK_CODES = ['General Information', 'Account Inquiry', 'Retirement Planning', 'RMD Calculation', 'Portfolio Review', 'Beneficiary Change', 'Technical Issue'];

/**
 * After-call work, shown in the dossier (right column) once a call has ended — the phone analog of
 * the chat agent's ACW. The wrap-up code + summary are auto-drafted from the call transcript (via
 * the shared generate-acw model), the agent edits them, and completing saves the reviewed transcript
 * and clears the call back to the board.
 */
export function AfterCallWork() {
  const call = useStore(s => s.call);
  const outcome = useStore(s => s.callOutcome);
  const saveCallTranscript = useStore(s => s.saveCallTranscript);
  const dismissCall = useStore(s => s.dismissCall);

  const [acw, setAcw] = useState<AcwResult | null>(null);
  const [code, setCode] = useState('');
  const [summary, setSummary] = useState('');
  const [closing, setClosing] = useState(false);
  const ranRef = useRef(false);

  const name = call?.item.clientName || 'the client';
  const connected = outcome.startsWith('✅');

  useEffect(() => {
    if (ranRef.current || !call) return;
    ranRef.current = true;
    const log = useStore.getState().transcriptLog;
    const transcript = log.map(m => ({ role: m.role, content: m.content, timestamp: m.ts }));
    // Nothing to summarize (e.g. a no-answer / opt-out before any conversation) → prefill from outcome.
    if (transcript.filter(m => m.role !== 'SYSTEM').length < 2) {
      setAcw({ wrapUpCode: 'General Information', coaching: { positive: '', bullets: [] }, summary: outcome || 'Call ended.', wrapUpCodes: FALLBACK_CODES });
      setCode('General Information');
      setSummary(outcome || 'Call ended.');
      return;
    }
    (async () => {
      try {
        const res = await post<AcwResult>('/generate-acw', {
          transcript,
          // The lambda summarizes profile.accounts, so the profile must be shaped (accounts array).
          clientProfile: { clientId: call.item.clientId, name, accounts: [], totalBalance: 0, recentChatHistory: [] },
        });
        setAcw(res);
        setCode(res.wrapUpCode);
        setSummary(res.summary);
      } catch {
        setAcw({ wrapUpCode: 'General Information', coaching: { positive: '', bullets: [] }, summary: '', wrapUpCodes: FALLBACK_CODES });
        setCode('General Information');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loading = acw === null;
  const codes = acw?.wrapUpCodes?.length ? acw.wrapUpCodes : FALLBACK_CODES;

  const complete = async () => {
    setClosing(true);
    await saveCallTranscript({ wrapUpCode: code, summary });
    dismissCall();
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingRight: 6 }}>
      <div style={{ ...card, padding: '18px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <Avatar initials={initials(name)} size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...h2Style(), fontSize: 20 }}>{name}</div>
            <div style={{ fontSize: 12.5, color: theme.color.textMuted, marginTop: 2 }}>After-call work</div>
          </div>
          {outcome && <Chip tone={connected ? 'success' : 'neutral'}>{outcome}</Chip>}
        </div>
      </div>

      <div style={{ ...card, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Wrap-up code */}
        <div>
          <SectionLabel>Wrap-up code</SectionLabel>
          {loading ? <Skeleton h={36} /> : (
            <select value={code} onChange={e => setCode(e.target.value)} style={{
              width: '100%', padding: '9px 11px', borderRadius: theme.radius.md, border: `1px solid ${theme.color.borderStrong}`,
              fontSize: 14, background: theme.color.surface, color: theme.color.text, cursor: 'pointer', outline: 'none',
            }}>
              {codes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>

        {/* Coaching */}
        {(loading || acw?.coaching?.positive || (acw?.coaching?.bullets?.length ?? 0) > 0) && (
          <div>
            <SectionLabel>Coaching</SectionLabel>
            {loading ? <Skeleton h={34} /> : (
              <div style={{ fontSize: 13.5, color: theme.color.text, lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {acw!.coaching.positive && (
                  <div style={{ display: 'flex', gap: 7 }}><span style={{ color: theme.color.success, fontWeight: 700 }}>✓</span><span>{acw!.coaching.positive}</span></div>
                )}
                {acw!.coaching.bullets.map((b, i) => (
                  <div key={i} style={{ display: 'flex', gap: 7 }}><span style={{ color: theme.color.warning, fontWeight: 700 }}>•</span><span>{b}</span></div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Editable call summary */}
        <div>
          <SectionLabel>Call summary</SectionLabel>
          {loading ? <Skeleton h={120} /> : (
            <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={6} style={{
              width: '100%', resize: 'vertical', border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.md,
              padding: '9px 11px', fontSize: 14, lineHeight: 1.6, outline: 'none', fontFamily: 'inherit', color: theme.color.text,
            }} />
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button big onClick={() => void complete()} disabled={loading || closing}>
            {closing ? 'Saving…' : '✓ Complete & close'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Skeleton({ h }: { h: number }) {
  return <div className="pa-speaking" style={{ height: h, borderRadius: theme.radius.md, background: theme.color.surfaceMuted }} />;
}
