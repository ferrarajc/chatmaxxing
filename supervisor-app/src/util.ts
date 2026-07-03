import { API_BASE } from './api/client';

/** "6m 12s" (or "42s") from milliseconds. */
export function fmtDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '—';
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
}

export function fmtDate(ms: number | null | undefined): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export function fmtNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/** Deep link into the existing Transcript Review tool (reuse, don't rebuild). */
export function transcriptUrl(transcriptId: string): string {
  const dev = API_BASE.includes('1cppcq9q57'); // dev API id → review tool needs ?env=dev
  return `https://ferrarajc.github.io/chatmaxxing/transcripts/?id=${encodeURIComponent(transcriptId)}${dev ? '&env=dev' : ''}`;
}

export function tenure(hireDate: string): string {
  const years = (Date.now() - Date.parse(hireDate)) / (365.25 * 24 * 3600 * 1000);
  if (years < 1) return `${Math.max(1, Math.round(years * 12))} mo`;
  return `${Math.floor(years)} yr${Math.floor(years) === 1 ? '' : 's'}`;
}
