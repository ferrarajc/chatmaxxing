import React, { useEffect, useRef } from 'react';

// The animated voice orb. A canvas + requestAnimationFrame loop that glows and pulses by
// phase: it reacts to the real mic amplitude while LISTENING, and uses a procedural pulse
// while speaking/thinking/idle (the browser can't expose TTS output as an audio signal).

export type VoicePhase = 'idle' | 'listening' | 'thinking' | 'speaking' | 'unsupported' | 'denied';

const ACCENT = '#C9824E'; // lightened cognac, reads well as a glow on the navy backdrop
const CORE = '#FBF9F4';   // warm cream

export function VoiceOrb({ amplitudeRef, phase, size = 220 }: {
  amplitudeRef: React.MutableRefObject<number>;
  phase: VoicePhase;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<VoicePhase>(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    const cx = size / 2;
    const cy = size / 2;
    const baseR = size * 0.17;
    let raf = 0;
    let t = 0;

    const render = () => {
      t += 1;
      ctx.clearRect(0, 0, size, size);
      const amp = amplitudeRef.current;
      const ph = phaseRef.current;

      let pulse: number;
      if (ph === 'listening') pulse = Math.min(0.9, amp * 0.9);
      else if (ph === 'speaking') pulse = 0.14 + 0.09 * Math.sin(t * 0.20);
      else if (ph === 'thinking') pulse = 0.07 + 0.05 * Math.sin(t * 0.09);
      else pulse = 0.04 + 0.03 * Math.sin(t * 0.04); // idle / unsupported / denied: gentle breathing

      // outer halo rings
      for (let i = 3; i >= 1; i--) {
        const r = baseR * (1 + i * 0.55 + pulse * i);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201,130,78,${(0.06 * i).toFixed(3)})`;
        ctx.fill();
      }

      // glowing body
      const outer = baseR * (1.25 + pulse);
      const glow = ctx.createRadialGradient(cx, cy, baseR * 0.2, cx, cy, outer);
      glow.addColorStop(0, CORE);
      glow.addColorStop(0.55, ACCENT);
      glow.addColorStop(1, 'rgba(201,130,78,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, outer, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // bright core
      ctx.beginPath();
      ctx.arc(cx, cy, baseR * (0.78 + pulse * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = CORE;
      ctx.fill();

      raf = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(raf);
  }, [size, amplitudeRef]);

  return <canvas ref={canvasRef} style={{ width: size, height: size, display: 'block' }} />;
}
