import React from 'react';

/**
 * Renders an intent label string that may contain **word** markers.
 * Marked words are rendered bold and in the primary brand colour so they
 * stand out at a glance.  Degrades silently to plain text if no markers
 * are present.
 */
export function IntentLabel({ text, style }: { text: string; style?: React.CSSProperties }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span style={style}>
      {parts.map((part, i) => {
        const m = part.match(/^\*\*([^*]+)\*\*$/);
        return m
          ? <strong key={i} style={{ color: '#0f2d5e', fontWeight: 700 }}>{m[1]}</strong>
          : part;
      })}
    </span>
  );
}

/** Strip **markers** and return plain text — used where the label is truncated. */
export function stripIntentMarkers(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1');
}
