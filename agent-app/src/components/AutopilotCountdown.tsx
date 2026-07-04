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

// Live countdown shown after the "Autopilot sending…" ellipsis. Counts down to the send
// deadline, freezes when paused, and flashes red in the final 10 seconds to pull the
// agent's eye. Purely presentational — the real send timing lives in ChatColumn.
export function AutopilotCountdown({ sendAt, pausedRemainingMs, paused, fontSize = 13 }: Props) {
  const [now, setNow] = useState(() => Date.now());

  // Tick 4×/second: fine enough for a smooth flash without a second interval.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const fromDeadline = sendAt != null ? Math.max(0, sendAt - now) : null;
  const remainingMs = paused ? (pausedRemainingMs ?? fromDeadline) : fromDeadline;
  if (remainingMs == null) return null;

  const secs = Math.ceil(remainingMs / 1000);
  const urgent = remainingMs <= 10000;
  // Flash on/off at ~2 Hz derived straight from the clock (no extra interval needed).
  const flashOn = Math.floor(now / 500) % 2 === 0;

  let color = '#15803d';   // steady green, matches the "sending…" label
  let opacity = 1;
  if (paused) {
    color = '#6b7280';     // frozen — steady gray
  } else if (urgent) {
    color = '#dc2626';     // final 10 s — flashing red
    opacity = flashOn ? 1 : 0.15;
  }

  return (
    <span style={{
      marginLeft: 6, fontSize, fontWeight: 700, color, opacity,
      fontVariantNumeric: 'tabular-nums',
      transition: 'opacity .15s, color .2s',
    }}>
      {paused ? `⏸ ${secs}s` : `${secs}s`}
    </span>
  );
}
