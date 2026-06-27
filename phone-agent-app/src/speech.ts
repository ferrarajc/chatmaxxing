// Thin wrapper over the browser Web Speech API (SpeechRecognition) so the simulated call can
// wait for the agent to actually speak on the "client" turns and show what was heard. Chrome /
// Edge support this (as webkitSpeechRecognition); elsewhere it degrades to "not supported" and
// the caller falls back to the scripted timing.

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ListenResult { transcript: string; heard: boolean }

function getSR(): any {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function speechSupported(): boolean {
  return !!getSR();
}

let activeRec: any = null;

/** Stop an in-flight listen (e.g. a "Skip" tap or the call ending). Resolves the pending promise. */
export function stopListening(): void {
  if (activeRec) { try { activeRec.stop(); } catch { /* ignore */ } activeRec = null; }
}

/**
 * Listen until the speaker finishes a phrase (or `maxMs` elapses). Resolves with the recognized
 * transcript and whether anything was heard. Triggers the browser mic-permission prompt on first use.
 */
export function listenForSpeech(maxMs = 12000): Promise<ListenResult> {
  return new Promise(resolve => {
    const SR = getSR();
    if (!SR) { resolve({ transcript: '', heard: false }); return; }
    let rec: any;
    try { rec = new SR(); } catch { resolve({ transcript: '', heard: false }); return; }
    activeRec = rec;
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    let transcript = '';
    let done = false;
    const finish = (heard: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (activeRec === rec) activeRec = null;
      try { rec.stop(); } catch { /* ignore */ }
      resolve({ transcript: transcript.trim(), heard });
    };
    const timer = setTimeout(() => finish(transcript.trim().length > 0), maxMs);

    rec.onresult = (e: any) => {
      transcript = '';
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      if (e.results[e.results.length - 1]?.isFinal) finish(true);
    };
    rec.onerror = () => finish(false);
    rec.onend = () => finish(transcript.trim().length > 0);
    try { rec.start(); } catch { finish(false); }
  });
}

/**
 * Continuous, free (browser Web Speech API) transcription for the live call. Calls `onFinal` for
 * each finalized utterance and `onInterim` with the in-progress text. Auto-restarts when the engine
 * stops on a pause. Returns a stop function. No-op (and reports unsupported) where SR is unavailable.
 */
export function startLiveTranscription(
  onFinal: (text: string) => void,
  onInterim?: (text: string) => void,
): () => void {
  const SR = getSR();
  if (!SR) return () => { /* unsupported */ };
  let stopped = false;
  let rec: any = null;

  const begin = () => {
    if (stopped) return;
    try { rec = new SR(); } catch { return; }
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = (r[0]?.transcript ?? '').trim();
        if (r.isFinal) { if (text) onFinal(text); }
        else interim += r[0]?.transcript ?? '';
      }
      onInterim?.(interim.trim());
    };
    rec.onerror = () => { /* keep going; onend will restart */ };
    rec.onend = () => { if (!stopped) { try { rec.start(); } catch { setTimeout(begin, 400); } } };
    try { rec.start(); } catch { /* will retry via onend */ }
  };
  begin();

  return () => { stopped = true; try { rec?.stop(); } catch { /* ignore */ } rec = null; };
}
