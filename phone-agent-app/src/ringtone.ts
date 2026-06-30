// A synthesized US-style ringback tone (440 + 480 Hz, 2s on / 4s off) via the Web Audio API,
// so the simulated outbound call audibly rings until answered — no audio asset to bundle.

let ctx: AudioContext | null = null;
let osc1: OscillatorNode | null = null;
let osc2: OscillatorNode | null = null;
let gain: GainNode | null = null;
let timer: number | null = null;

export function startRinging(): void {
  if (ctx) return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    void ctx.resume();
    gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(ctx.destination);
    osc1 = ctx.createOscillator(); osc1.frequency.value = 440; osc1.connect(gain); osc1.start();
    osc2 = ctx.createOscillator(); osc2.frequency.value = 480; osc2.connect(gain); osc2.start();

    const pulse = () => {
      if (!ctx || !gain) return;
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.04); // ring on
      gain.gain.setValueAtTime(0.12, t + 2);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.04); // ring off
    };
    pulse();
    timer = window.setInterval(pulse, 6000);
  } catch { stopRinging(); }
}

export function stopRinging(): void {
  if (timer !== null) { clearInterval(timer); timer = null; }
  try { osc1?.stop(); } catch { /* ignore */ }
  try { osc2?.stop(); } catch { /* ignore */ }
  try { void ctx?.close(); } catch { /* ignore */ }
  ctx = null; osc1 = null; osc2 = null; gain = null;
}
