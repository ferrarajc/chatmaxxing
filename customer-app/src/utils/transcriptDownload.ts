import { ChatMessage } from '../types';

function fmtClock(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

function senderLabel(role: ChatMessage['role'], clientName: string | undefined, agentName: string | null | undefined): string {
  switch (role) {
    case 'CUSTOMER': return clientName ?? 'You';
    case 'AGENT': return agentName ?? 'Agent';
    case 'BOT': return 'Virtual Assistant';
    default: return '—';
  }
}

export function formatTranscriptText(
  messages: ChatMessage[],
  opts: { clientName?: string; agentName?: string | null } = {},
): string {
  const dated = messages.filter(m => m.timestamp);
  const first = dated[0]?.timestamp;
  const last = dated[dated.length - 1]?.timestamp;

  const header = [
    "Bob's Mutual Funds — Chat Transcript",
    first ? `Date: ${new Date(first).toLocaleDateString('en-US', { dateStyle: 'long' })}` : null,
    opts.agentName ? `Agent: ${opts.agentName}` : null,
    first && last ? `Duration: ${fmtDuration(last - first)}` : null,
  ].filter(Boolean).join('\n');

  const lines = messages.map(m =>
    m.role === 'SYSTEM'
      ? `— ${m.content} —`
      : `[${fmtClock(m.timestamp)}] ${senderLabel(m.role, opts.clientName, opts.agentName)}: ${m.content}`,
  );

  return `${header}\n\n${lines.join('\n')}\n`;
}

export function downloadTranscript(
  messages: ChatMessage[],
  opts: { clientName?: string; agentName?: string | null } = {},
): void {
  const text = formatTranscriptText(messages, opts);
  const first = messages.find(m => m.timestamp)?.timestamp ?? Date.now();
  const d = new Date(first);
  // Local date, not toISOString() (UTC) — keep the filename consistent with the header date.
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bobs-chat-${date}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
