import React, { useLayoutEffect, useRef } from 'react';

interface Props {
  /** Current text (controlled). */
  value: string;
  /** Fired on every edit with the new plain text. */
  onChange: (text: string) => void;
  /** Fired when the agent clicks into the text (used to pause autopilot / mark editing). */
  onFocus?: () => void;
  /** Fired when focus leaves the text (used to clear the editing visual state). */
  onBlur?: () => void;
  /** Text styling — matches the read-only div it replaces so appearance is unchanged. */
  style?: React.CSSProperties;
}

// In-place editable text for the AI reply boxes. A fully controlled, transparent,
// auto-growing <textarea> styled to look exactly like the read-only text it replaces
// (only a caret appears on click). A textarea is plain-text by nature — Enter inserts a
// real newline and the value round-trips faithfully (no contentEditable newline mangling)
// — and being controlled it always reflects the store, so a fresh AI suggestion on the
// next turn shows immediately.
export function EditableReply({ value, onChange, onFocus, onBlur, style }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow/shrink the box to fit its content. useLayoutEffect = resize before paint (no flash).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      onChange={e => onChange(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{
        display: 'block', width: '100%', boxSizing: 'border-box',
        margin: 0, padding: 0, border: 'none', outline: 'none',
        background: 'transparent', resize: 'none', overflow: 'hidden',
        fontFamily: 'inherit',
        ...style,
      }}
    />
  );
}
