import React from 'react';

// Amber mark with explicit dark text — agent bubbles in focusing mode are
// navy/white, so the highlight must set its own foreground color.
const MARK_STYLE: React.CSSProperties = {
  background: '#fde68a',
  color: '#78350f',
  borderRadius: 3,
  padding: '0 1px',
};

interface Range { start: number; end: number }

/** Clamp ranges to the content, drop empties, sort, and merge overlaps. */
function normalizeRanges(content: string, ranges: Range[]): Range[] {
  const clamped = ranges
    .map(r => ({ start: Math.max(0, r.start), end: Math.min(content.length, r.end) }))
    .filter(r => r.end > r.start)
    .sort((a, b) => a.start - b.start);
  const merged: Range[] = [];
  for (const r of clamped) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }
  return merged;
}

/** Message content with evidence spans wrapped in amber highlight marks.
 *  With no valid ranges, returns the plain string untouched. */
export function renderHighlighted(content: string, ranges: Range[] | undefined): React.ReactNode {
  if (!ranges || ranges.length === 0) return content;
  const merged = normalizeRanges(content, ranges);
  if (merged.length === 0) return content;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  merged.forEach((r, i) => {
    if (r.start > cursor) parts.push(content.slice(cursor, r.start));
    parts.push(<span key={i} style={MARK_STYLE}>{content.slice(r.start, r.end)}</span>);
    cursor = r.end;
  });
  if (cursor < content.length) parts.push(content.slice(cursor));
  return parts;
}
