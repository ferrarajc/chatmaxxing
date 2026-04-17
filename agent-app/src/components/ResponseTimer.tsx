import React, { useEffect, useState } from 'react';

interface Props { lastAgentMessageAt: number | null; }

export function ResponseTimer({ lastAgentMessageAt }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!lastAgentMessageAt) { setElapsed(0); return; }
    const tick = setInterval(() => {
      setElapsed(Math.floor((Date.now() - lastAgentMessageAt) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastAgentMessageAt]);

  if (!lastAgentMessageAt) return null;

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const label = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const color = elapsed < 60 ? '#10b981' : elapsed < 120 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{
      fontSize: 13, fontWeight: 700, color,
      fontVariantNumeric: 'tabular-nums',
      transition: 'color .3s',
    }}>
      {label}
    </div>
  );
}
