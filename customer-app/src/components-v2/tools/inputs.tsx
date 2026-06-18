import React, { useState } from 'react';
import { theme } from '../../theme';

// Shared inputs for the Tools suite. These mirror the field components used in
// RetirementCalculatorPage so every calculator feels identical, but they live here
// (rather than importing from that page) so the suite is fully self-contained and
// the existing page stays untouched.

const labelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: theme.color.textMuted,
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
};

interface SliderInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  note?: string;
  accent?: string;
}

/** Range slider with a click-to-edit numeric chip. */
export function SliderInput({ label, value, min, max, step, format, onChange, note, accent }: SliderInputProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const color = accent ?? theme.color.primary;

  const startEdit = () => { setEditValue(String(value)); setEditing(true); };
  const commitEdit = () => {
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed)) onChange(Math.max(min, Math.min(max, parsed)));
    setEditing(false);
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <input
          type="range"
          min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ width: 220, cursor: 'pointer', accentColor: color }}
        />
        {editing ? (
          <input
            type="number"
            value={editValue} min={min} max={max} step={step} autoFocus
            onChange={e => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => e.key === 'Enter' && commitEdit()}
            style={{
              width: 84, padding: '6px 10px', border: `2px solid ${color}`,
              borderRadius: theme.radius.md, fontSize: 18, fontWeight: 700,
              color, textAlign: 'center', fontFamily: theme.font.sans,
            }}
          />
        ) : (
          <div
            onClick={startEdit}
            title="Click to edit"
            style={{
              minWidth: 64, padding: '5px 12px', background: theme.color.surfaceMuted,
              border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md,
              fontSize: 18, fontWeight: 700, color, textAlign: 'center',
              cursor: 'pointer', userSelect: 'none', transition: 'border-color 0.15s',
              fontVariantNumeric: 'tabular-nums',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = theme.color.border)}
          >
            {format(value)}
          </div>
        )}
        {note && <span style={{ fontSize: 14, color: theme.color.textSubtle }}>{note}</span>}
      </div>
    </div>
  );
}

interface NumberInputProps {
  label: string;
  value: number;
  min?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  narrow?: boolean;
  maxDigits?: number;
  onChange: (v: number) => void;
}

/**
 * Digits-only number field. Keeps raw text while focused (instead of clamping to min
 * on every keystroke) so selecting-all and retyping works naturally — see the note in
 * RetirementCalculatorPage for why this matters.
 */
export function NumberInput({ label, value, min = 0, step = 1, prefix, suffix, narrow, maxDigits, onChange }: NumberInputProps) {
  const [text, setText] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let digits = e.target.value.replace(/\D/g, '');
    if (maxDigits) digits = digits.slice(0, maxDigits);
    setText(digits);
    if (digits !== '') onChange(Math.max(min, parseInt(digits, 10)));
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {prefix && (
          <span style={{
            padding: '9px 13px', background: theme.color.surfaceMuted,
            border: `1px solid ${theme.color.border}`, borderRight: 'none',
            borderRadius: `${theme.radius.md}px 0 0 ${theme.radius.md}px`,
            fontSize: 19, color: theme.color.textMuted, fontWeight: 500,
          }}>{prefix}</span>
        )}
        <input
          type="number"
          value={text ?? value} min={min} step={step}
          onChange={handleChange}
          onFocus={e => e.target.select()}
          onBlur={() => setText(null)}
          style={{
            width: narrow ? 104 : prefix ? 180 : 210, padding: '9px 13px',
            border: `1px solid ${theme.color.border}`,
            borderRadius: prefix && !suffix ? `0 ${theme.radius.md}px ${theme.radius.md}px 0`
              : suffix && !prefix ? `${theme.radius.md}px 0 0 ${theme.radius.md}px`
              : prefix && suffix ? '0'
              : theme.radius.md,
            fontSize: 19, color: theme.color.text, fontFamily: theme.font.sans,
            background: theme.color.surface, fontVariantNumeric: 'tabular-nums',
          }}
        />
        {suffix && (
          <span style={{
            padding: '9px 13px', background: theme.color.surfaceMuted,
            border: `1px solid ${theme.color.border}`, borderLeft: 'none',
            borderRadius: `0 ${theme.radius.md}px ${theme.radius.md}px 0`,
            fontSize: 19, color: theme.color.textMuted, fontWeight: 500,
          }}>{suffix}</span>
        )}
      </div>
    </div>
  );
}

interface SegmentedProps<T extends string> {
  label?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

/** Pill-style segmented toggle for a small set of mutually exclusive choices. */
export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div style={{ marginBottom: 20 }}>
      {label && <div style={labelStyle}>{label}</div>}
      <div style={{
        display: 'inline-flex', background: theme.color.surfaceMuted,
        border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.pill, padding: 4, gap: 4,
      }}>
        {options.map(opt => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              style={{
                border: 'none', cursor: 'pointer',
                background: active ? theme.color.primary : 'transparent',
                color: active ? theme.color.textOnPrimary : theme.color.textMuted,
                borderRadius: theme.radius.pill, padding: '7px 16px',
                fontSize: 13, fontWeight: 600, fontFamily: theme.font.sans,
                transition: 'background .15s, color .15s', whiteSpace: 'nowrap',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
