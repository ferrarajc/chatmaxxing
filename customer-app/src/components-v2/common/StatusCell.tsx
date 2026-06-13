import React, { useEffect, useRef, useState } from 'react';
import { theme } from '../../theme';
import { statusMeta } from '../../data/transactionStatus';

/**
 * A transaction status label with a subtle dotted underline. Clicking it opens a
 * small popover defining the status (and, for in-progress statuses, what to expect
 * next). Click-outside / Escape closes it — same pattern as the TopNavV2 menu.
 */
export function StatusCell({ status }: { status?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const meta = statusMeta(status);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        title="What does this mean?"
        style={{
          appearance: 'none', background: 'none', border: 'none', padding: 0, margin: 0,
          font: 'inherit', cursor: 'help',
          color: meta.color, fontWeight: 600, fontSize: 13,
          borderBottom: `1px dotted ${meta.color}`, lineHeight: 1.4,
        }}
      >
        {meta.label}
      </button>

      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 40,
            width: 240, textAlign: 'left',
            background: theme.color.surface, color: theme.color.text,
            border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md,
            boxShadow: theme.shadow.lg, padding: '12px 14px',
            fontFamily: theme.font.sans, fontWeight: 400, whiteSpace: 'normal',
          }}
        >
          <span style={{
            display: 'block', fontSize: 12, fontWeight: 700, color: meta.color,
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
          }}>
            {meta.label}
          </span>
          <span style={{ display: 'block', fontSize: 12.5, lineHeight: 1.5, color: theme.color.text }}>
            {meta.definition}
          </span>
          {meta.whatToExpect && (
            <span style={{ display: 'block', marginTop: 8 }}>
              <span style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: theme.color.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                What to expect
              </span>
              <span style={{ display: 'block', fontSize: 12.5, lineHeight: 1.5, color: theme.color.textMuted }}>
                {meta.whatToExpect}
              </span>
            </span>
          )}
        </span>
      )}
    </span>
  );
}
