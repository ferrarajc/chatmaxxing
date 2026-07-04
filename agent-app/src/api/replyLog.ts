import { post } from './client';

/**
 * One agent-response telemetry record — how the agent arrived at a message they sent.
 * See `lambda/log-reply` + the `bobs-reply-events` table.
 */
export interface ReplyEvent {
  contactId: string;
  clientId: string;
  agentUsername?: string;
  agentName?: string;
  /** How the message was produced. */
  path: 'suggested-send' | 'composer-send' | 'autopilot-send';
  /** Provenance of the suggestion involved (when applicable). */
  source?: 'greeting' | 'nbr' | 'change-to';
  changeDirection?: string;
  /** The AI-authored text. */
  originalText?: string;
  /** For a freehand composer send: the suggestion that was on screen but ignored. */
  suggestionShownText?: string;
  /** What actually went to the client. */
  sentText: string;
  wasEdited?: boolean;
}

/** Fire-and-forget agent-response telemetry — never blocks the UI or surfaces a failure. */
export function logReplyEvent(event: ReplyEvent): void {
  post('/log-reply', event).catch(() => {});
}
