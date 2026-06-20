import React, { useEffect, useRef } from 'react';

// The animated voice orb ("BOrB"). A canvas + requestAnimationFrame loop that glows and
// gently pulses by phase: it reacts to the real mic amplitude while LISTENING, and uses a
// soft procedural pulse otherwise. All drawing stays well inside the canvas (safeMax) so the
// halo never reaches the square edges and clips — and the motion is smoothed + subtle.

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
    const coreR = size * 0.15;
    const safeMax = size * 0.46; // hard cap so nothing reaches the square canvas edge
    let raf = 0;
    let t = 0;
    let smooth = 0; // eased pulse for graceful, un-jittery motion

    const render = () => {
      t += 1;
      ctx.clearRect(0, 0, size, size);
      const amp = amplitudeRef.current;
      const ph = phaseRef.current;

      // Gentle target pulse (0..~0.4), eased toward — subtle, never balloons.
      let target: number;
      if (ph === 'listening') target = Math.min(1, amp) * 0.35;
      else if (ph === 'speaking') target = 0.10 + 0.06 * (0.5 + 0.5 * Math.sin(t * 0.16));
      else if (ph === 'thinking') target = 0.06 + 0.03 * (0.5 + 0.5 * Math.sin(t * 0.10));
      else target = 0.03 + 0.02 * (0.5 + 0.5 * Math.sin(t * 0.05));
      smooth += (target - smooth) * 0.12;
      const pulse = smooth;

      // soft halo rings (contained, fading outward)
      for (let i = 3; i >= 1; i--) {
        const r = Math.min(coreR * (1.35 + i * 0.42) * (1 + pulse * 0.12), safeMax);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201,130,78,${(0.045 - i * 0.01).toFixed(3)})`;
        ctx.fill();
      }

      // glowing body — fades fully to transparent before the edge
      const glowR = Math.min(coreR * 1.9 * (1 + pulse * 0.18), safeMax);
      const glow = ctx.createRadialGradient(cx, cy, coreR * 0.3, cx, cy, glowR);
      glow.addColorStop(0, CORE);
      glow.addColorStop(0.5, ACCENT);
      glow.addColorStop(1, 'rgba(201,130,78,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // bright core
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * (1 + pulse * 0.14), 0, Math.PI * 2);
      ctx.fillStyle = CORE;
      ctx.fill();

      raf = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(raf);
  }, [size, amplitudeRef]);

  return <canvas ref={canvasRef} style={{ width: size, height: size, display: 'block' }} />;
}
