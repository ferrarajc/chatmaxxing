import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSpeechUrl } from '../components-v2/voice/voiceTts';

// Browser voice primitive for the "Talk to Bob" feature: speech-to-text (Web Speech
// recognition), a mic-amplitude feed for the visualizer, and text-to-speech that prefers
// OpenAI audio and falls back to the browser's speechSynthesis. All resources are torn
// down on unmount/reset — nothing here runs unless the overlay (gated by the feature flag)
// mounts it.

export type VoiceStatus = 'unsupported' | 'denied' | 'idle' | 'listening' | 'speaking';
export type VoiceErrorKind = 'no-speech' | 'audio' | 'network' | 'aborted' | 'denied' | 'other';

export interface UseVoiceOptions {
  onFinalTranscript?: (text: string) => void;
  onError?: (e: { kind: VoiceErrorKind; message?: string }) => void;
  lang?: string;
  ttsVoice?: string;        // OpenAI voice name; server default applies if omitted
  ttsInstructions?: string; // OpenAI delivery instructions; server default applies if omitted
}

export interface SpeakOptions {
  onBoundary?: (charIndex: number) => void;
  onEnd?: () => void;
}

export interface UseVoice {
  status: VoiceStatus;
  supported: boolean;
  ttsSupported: boolean;
  permission: 'unknown' | 'granted' | 'denied';
  interim: string;
  amplitudeRef: React.MutableRefObject<number>;
  startListening: () => Promise<void>;
  stopListening: () => void;
  abortListening: () => void;
  speak: (text: string, opts?: SpeakOptions) => Promise<void>;
  cancelSpeak: () => void;
  reset: () => void;
}

const SR: SpeechRecognitionStatic | undefined =
  typeof window !== 'undefined' ? (window.SpeechRecognition ?? window.webkitSpeechRecognition) : undefined;

export function useVoice(options: UseVoiceOptions = {}): UseVoice {
  const supported = !!SR;
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const [status, setStatus] = useState<VoiceStatus>(supported ? 'idle' : 'unsupported');
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [interim, setInterim] = useState('');
  const amplitudeRef = useRef(0);

  const optsRef = useRef(options);
  useEffect(() => { optsRef.current = options; });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const intentionalStopRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const speakRafRef = useRef<number | null>(null);

  const stopAnalyser = useCallback(() => {
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    mediaStreamRef.current = null;
    amplitudeRef.current = 0;
  }, []);

  // getUserMedia + AnalyserNode → smoothed RMS amplitude for the orb. Decorative: if the
  // mic can't be opened, listening may still work; we just don't animate to the voice.
  const startAnalyser = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setPermission('granted');
      let ctx = audioCtxRef.current;
      if (!ctx) { ctx = new AudioContext(); audioCtxRef.current = ctx; }
      if (ctx.state === 'suspended') await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / data.length);
        amplitudeRef.current = amplitudeRef.current * 0.8 + Math.min(1, rms * 3) * 0.2;
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') setPermission('denied');
      // Decorative only — don't block listening.
    }
  }, []);

  const startListening = useCallback(async () => {
    if (!SR) { setStatus('unsupported'); return; }
    intentionalStopRef.current = false;
    let rec = recognitionRef.current;
    if (!rec) {
      rec = new SR();
      rec.lang = optsRef.current.lang ?? 'en-US';
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      rec.onresult = (ev: SpeechRecognitionEvent) => {
        let interimText = '';
        let finalText = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          const txt = r[0]?.transcript ?? '';
          if (r.isFinal) finalText += txt; else interimText += txt;
        }
        if (interimText) setInterim(interimText);
        if (finalText) {
          setInterim('');
          optsRef.current.onFinalTranscript?.(finalText.trim());
        }
      };
      rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
        const e = ev.error;
        if (e === 'not-allowed' || e === 'service-not-allowed') {
          setPermission('denied'); setStatus('denied');
          optsRef.current.onError?.({ kind: 'denied' });
        } else if (e === 'no-speech') {
          optsRef.current.onError?.({ kind: 'no-speech' });
        } else if (e === 'aborted') {
          /* intentional stop — ignore */
        } else if (e === 'network') {
          optsRef.current.onError?.({ kind: 'network' });
        } else {
          optsRef.current.onError?.({ kind: 'other', message: e });
        }
      };
      rec.onend = () => {
        stopAnalyser();
        setInterim('');
        setStatus(s => (s === 'denied' || s === 'unsupported' || s === 'speaking') ? s : 'idle');
      };
      recognitionRef.current = rec;
    }
    setStatus('listening');
    setInterim('');
    void startAnalyser();
    try { rec.start(); } catch { /* already started — ignore */ }
  }, [startAnalyser, stopAnalyser]);

  const stopListening = useCallback(() => {
    intentionalStopRef.current = true;
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    stopAnalyser();
  }, [stopAnalyser]);

  const abortListening = useCallback(() => {
    intentionalStopRef.current = true;
    try { recognitionRef.current?.abort(); } catch { /* ignore */ }
    stopAnalyser();
    setInterim('');
    setStatus(s => (s === 'denied' || s === 'unsupported') ? s : 'idle');
  }, [stopAnalyser]);

  const stopSpeakAnalyser = useCallback(() => {
    if (speakRafRef.current != null) { cancelAnimationFrame(speakRafRef.current); speakRafRef.current = null; }
    amplitudeRef.current = 0;
  }, []);

  const cancelSpeak = useCallback(() => {
    stopSpeakAnalyser();
    if (audioElRef.current) {
      try { audioElRef.current.pause(); } catch { /* ignore */ }
      audioElRef.current.src = '';
      audioElRef.current = null;
    }
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    if (ttsSupported) { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } }
  }, [ttsSupported, stopSpeakAnalyser]);

  const speakBrowser = useCallback((text: string, opts?: SpeakOptions) => {
    if (!ttsSupported) { setStatus('idle'); opts?.onEnd?.(); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    // Browser-TTS fallback (rare — only if the OpenAI audio fails): a slightly deep, slow read so it
    // at least leans toward Bob's older character.
    u.pitch = 0.85;
    u.rate = 0.92;
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find(v => /en-US/i.test(v.lang) && /natural|google|samantha|aaron|zoe/i.test(v.name))
      ?? voices.find(v => /en-US/i.test(v.lang)) ?? voices[0];
    if (preferred) u.voice = preferred;
    u.onboundary = (e) => opts?.onBoundary?.(e.charIndex);
    u.onend = () => { setStatus('idle'); opts?.onEnd?.(); };
    u.onerror = () => { setStatus('idle'); opts?.onEnd?.(); };
    window.speechSynthesis.speak(u);
  }, [ttsSupported]);

  const speak = useCallback(async (text: string, opts?: SpeakOptions) => {
    cancelSpeak();
    const clean = text.trim();
    if (!clean) { opts?.onEnd?.(); return; }
    setStatus('speaking');

    let url: string;
    try {
      url = await fetchSpeechUrl(clean, optsRef.current.ttsVoice, optsRef.current.ttsInstructions);
    } catch {
      speakBrowser(clean, opts); // OpenAI TTS unavailable/slow/blocked → browser voice
      return;
    }

    blobUrlRef.current = url;
    const audio = new Audio(url);
    audioElRef.current = audio;
    const cleanup = () => {
      stopSpeakAnalyser();
      if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
      audioElRef.current = null;
    };
    audio.onended = () => { cleanup(); setStatus('idle'); opts?.onEnd?.(); };
    audio.onerror = () => { cleanup(); speakBrowser(clean, opts); };

    // Route the mp3 through an AnalyserNode so the orb pulses on each syllable of Bob's real
    // speech. createMediaElementSource re-routes the element into the graph, so we must also
    // connect it to the destination or playback would be silent.
    try {
      let ctx = audioCtxRef.current;
      if (!ctx) { ctx = new AudioContext(); audioCtxRef.current = ctx; }
      if (ctx.state === 'suspended') await ctx.resume();
      const srcNode = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      srcNode.connect(analyser);
      analyser.connect(ctx.destination);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / data.length);
        amplitudeRef.current = amplitudeRef.current * 0.5 + Math.min(1, rms * 4) * 0.5;
        speakRafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch { /* analysis optional; if createMediaElementSource threw, the element plays normally */ }

    try {
      await audio.play();
    } catch {
      cleanup();
      speakBrowser(clean, opts);
    }
  }, [cancelSpeak, speakBrowser, stopSpeakAnalyser]);

  const reset = useCallback(() => {
    intentionalStopRef.current = true;
    try { recognitionRef.current?.abort(); } catch { /* ignore */ }
    recognitionRef.current = null;
    stopAnalyser();
    cancelSpeak();
    if (audioCtxRef.current) { try { void audioCtxRef.current.close(); } catch { /* ignore */ } audioCtxRef.current = null; }
    setInterim('');
    setStatus(supported ? 'idle' : 'unsupported');
  }, [stopAnalyser, cancelSpeak, supported]);

  useEffect(() => () => { reset(); }, [reset]);

  return {
    status, supported, ttsSupported, permission, interim, amplitudeRef,
    startListening, stopListening, abortListening, speak, cancelSpeak, reset,
  };
}
