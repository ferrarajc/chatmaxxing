import { theme } from './theme';

// One universal colour scheme for every actor, used everywhere a conversational turn is shown
// (the live transcription, the original transcript, and the teleprompter). Each actor has ONE
// colour and ONE side, so beige always means the client, green always the agent, blue always Bob.

export type Actor = 'client' | 'agent' | 'bot' | 'system';

export const ACTOR: Record<Actor, { bg: string; fg: string; side: 'left' | 'right' | 'center' }> = {
  client: { bg: theme.color.accentSoft,   fg: theme.color.accent,    side: 'right'  },
  agent:  { bg: theme.color.successSoft,   fg: theme.color.success,   side: 'left'   },
  bot:    { bg: theme.color.primarySoft,   fg: theme.color.primary,   side: 'left'   },
  system: { bg: theme.color.surfaceMuted,  fg: theme.color.textMuted, side: 'center' },
};

/** Map an original-transcript speaker (chat/escalation/IVR) onto a universal actor. */
export function actorOf(speaker: 'client' | 'bob' | 'agent' | 'ivr' | 'system'): Actor {
  if (speaker === 'bob' || speaker === 'ivr') return 'bot';
  if (speaker === 'agent') return 'agent';
  if (speaker === 'system') return 'system';
  return 'client';
}
