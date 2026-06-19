// lib.dom (this TS version) ships the Web Speech *event* types (SpeechRecognitionEvent,
// SpeechRecognitionErrorEvent, …) but NOT the SpeechRecognition interface itself nor the
// window constructors. Declare only those missing pieces, reusing the lib.dom event types.
// Authored as a regular module (not a .d.ts, which this repo's .gitignore excludes); the
// export is erased at build time.
export {};

declare global {
  interface SpeechRecognition extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
    onend: ((this: SpeechRecognition, ev: Event) => void) | null;
    onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
    onspeechstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  }

  interface SpeechRecognitionStatic {
    new (): SpeechRecognition;
  }

  interface Window {
    SpeechRecognition?: SpeechRecognitionStatic;
    webkitSpeechRecognition?: SpeechRecognitionStatic;
  }
}
