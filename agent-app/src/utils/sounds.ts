/** Play a coin "cha-ching" sound using the Web Audio API. */
export function playChaChingSound(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();

    const tone = (freq: number, startSec: number, durSec: number, vol: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime + startSec);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startSec + durSec);
      osc.start(ctx.currentTime + startSec);
      osc.stop(ctx.currentTime + startSec + durSec);
    };

    // Ascending metallic coin tones
    tone(1046, 0.00, 0.12, 0.35);   // C6 — "cha"
    tone(1318, 0.06, 0.15, 0.35);   // E6
    tone(1568, 0.12, 0.18, 0.35);   // G6
    tone(2093, 0.18, 0.40, 0.45);   // C7 — "ching" (sustain)

    setTimeout(() => ctx.close(), 1200);
  } catch {
    // Audio unavailable — fail silently
  }
}
