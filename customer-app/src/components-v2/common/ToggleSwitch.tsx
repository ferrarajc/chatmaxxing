import React from 'react';

// Reusable on/off switch. Visual style mirrors the agent app's "On queue" toggle
// (agent-app/src/components/TopBar.tsx) — a 44×24 pill, green when on / gray when off,
// with a sliding white knob — which the product owner asked us to match.

interface ToggleSwitchProps {
  on: boolean;
  onChange: (on: boolean) => void;
  title?: string;
  disabled?: boolean;
}

export function ToggleSwitch({ on, onChange, title, disabled }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      title={title}
      onClick={() => onChange(!on)}
      style={{
        position: 'relative', width: 44, height: 24, borderRadius: 12,
        background: on ? '#10b981' : '#6b7280',
        border: 'none', cursor: disabled ? 'default' : 'pointer', padding: 0,
        flexShrink: 0, transition: 'background .2s', opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        style={{
          position: 'absolute', top: 3, left: on ? 23 : 3,
          width: 18, height: 18, borderRadius: '50%',
          background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          transition: 'left .2s', display: 'block',
        }}
      />
    </button>
  );
}
