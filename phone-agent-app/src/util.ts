import { useEffect, useState } from 'react';

/** Re-renders on an interval so live countdowns tick. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** "4m 12s" / "now" / "1h 3m" until the target ISO time. */
export function fmtCountdown(targetIso: string, now: number): string {
  const ms = new Date(targetIso).getTime() - now;
  if (isNaN(ms)) return '—';
  if (ms <= 0) return 'now';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (m >= 60) { const h = Math.floor(m / 60); return `${h}h ${m % 60}m`; }
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

/** "Tue 2:30 PM" in Eastern time. */
export function fmtScheduled(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: '2-digit',
  });
}

export function fmtMoney(n: number): string {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function initials(name: string): string {
  return name.split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase();
}
