import React, { useEffect, useState } from 'react';

interface Props {
  /** Absolute epoch-ms deadline to count down to; null when no send is pending. */
  sendAt: number | null;
  /** Frozen remaining ms while paused; null while running. */
  pausedRemainingMs: number | null;
  /** True while the send countdown is frozen (paused). */
  paused: boolean;
  /** Font size to match the host "sending…" label (default 13). */
  fontSize?: number;
}

// Countdown for the "Autopilot sending…" box, shown top-right (right-aligned with the
// heading). Format is m:ss so the digit width stays steady (0:04 / 0:53 / 1:30). In the
// final 10 seconds the ⏳ hourglass flashes on/off — via opacity, so the digits never
// shift — and the time turns bold, bright red. Purely presentational; timing lives in
// ChatColumn.
export function AutopilotCountdown({ sendAt, pausedRemainingMs, paused, fontSize = 13 }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const fromDeadline = sendAt != null ? Math.max(0, sendAt - now) : null;
  const remainingMs = paused ? (pausedRemainingMs ?? fromDeadline) : fromDeadline;
  if (remainingMs == null) return null;

  const totalSecs = Math.ceil(remainingMs / 1000);
  const label = `${Math.floor(totalSecs / 60)}:${String(totalSecs % 60).padStart(2, '0')}`; // m:ss

  const urgent = !paused && remainingMs <= 10000;
  // Flash on/off at ~2 Hz derived straight from the clock (no extra interval needed).
  const flashOn = Math.floor(now / 500) % 2 === 0;

  const textColor = paused ? '#6b7280' : urgent ? '#f31111' : '#15803d';

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize, flexShrink: 0 }}>
      {/* ⏳ blinks only when urgent; opacity (not display) so the time never shifts. */}
      <span style={{ opacity: urgent && !flashOn ? 0 : 1, transition: 'opacity .1s' }} aria-hidden="true">⏳</span>
      <span style={{
        color: textColor, fontWeight: urgent ? 800 : 600,
        fontVariantNumeric: 'tabular-nums', transition: 'color .2s',
      }}>{label}</span>
    </span>
  );
}
