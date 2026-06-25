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
