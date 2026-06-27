import React, { useState } from 'react';
import { theme } from '../theme';
import { SectionLabel, card } from './ui';
import { AGENT_NAME } from '../dossier';
import type { GuidedScript as GS, IntentBrief, ScriptStep } from '../types';

/** The client's objective, large at the top of the column — the one thing to read if you read nothing else. */
export function IntentHeader({ intent }: { intent: IntentBrief }) {
  const detail = (intent.detail ?? []).filter(Boolean);
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontFamily: theme.font.serif, fontSize: 23, fontWeight: 800, lineHeight: 1.28, color: theme.color.text, letterSpacing: '-0.01em' }}>
        {intent.headline}
      </div>
      {detail.length === 1 && (
        <p style={{ margin: '10px 0 0', fontSize: 13.5, lineHeight: 1.55, color: theme.color.textMuted }}>{detail[0]}</p>
      )}
      {detail.length > 1 && (
        <ul style={{ margin: '10px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {detail.map((d, i) => <li key={i} style={{ fontSize: 13.5, lineHeight: 1.5, color: theme.color.textMuted }}>{d}</li>)}
        </ul>
      )}
    </div>
  );
}

/** The agent's guided, branchable script: a fixed opening, then a walked tree of say/ask steps. */
export function GuidedScript({ gs }: { gs: GS }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setDone(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

  return (
    <div>
      <SectionLabel>Your script</SectionLabel>
      <GreetingCard confirmAsk={gs.confirmAsk} />
      {gs.steps.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          <StepList steps={gs.steps} path="s" done={done} toggle={toggle} />
        </div>
      )}
      {gs.points && gs.points.length > 0 && <PointsCard points={gs.points} />}
    </div>
  );
}

function GreetingCard({ confirmAsk }: { confirmAsk: string }) {
  return (
    <div style={{ ...card, padding: '14px 16px', background: theme.color.primarySoft, border: 'none' }}>
      <Tag color={theme.color.primary}>Open the call</Tag>
      <div style={{ fontSize: 14.5, lineHeight: 1.55, color: theme.color.text, marginTop: 6 }}>
        “This is <b>{AGENT_NAME}</b> at Bob's Mutual Funds, speaking on a recorded line — and I understand
        that you want <b>{confirmAsk}</b>. Is that correct?”
      </div>
    </div>
  );
}

function StepList({ steps, path, done, toggle }: {
  steps: ScriptStep[]; path: string; done: Set<string>; toggle: (k: string) => void;
}) {
  return (
    <>
      {steps.map((step, i) => {
        const key = `${path}.${i}`;
        return step.kind === 'ask'
          ? <AskStep key={key} step={step} path={key} done={done} toggle={toggle} />
          : <SayLine key={key} text={step.text} checked={done.has(key)} onToggle={() => toggle(key)} />;
      })}
    </>
  );
}

function SayLine({ text, checked, onToggle }: { text: string; checked: boolean; onToggle: () => void }) {
  return (
    <label style={{ ...card, display: 'flex', gap: 11, alignItems: 'flex-start', padding: '11px 14px', cursor: 'pointer', opacity: checked ? 0.55 : 1 }}>
      <input type="checkbox" checked={checked} onChange={onToggle} style={{ marginTop: 3 }} />
      <span style={{ fontSize: 14, lineHeight: 1.5, color: theme.color.text, textDecoration: checked ? 'line-through' : 'none' }}>{text}</span>
    </label>
  );
}

function AskStep({ step, path, done, toggle }: {
  step: Extract<ScriptStep, { kind: 'ask' }>; path: string; done: Set<string>; toggle: (k: string) => void;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const chosen = sel !== null ? step.options[sel] : null;
  return (
    <div style={{ ...card, padding: '12px 14px', borderLeft: `3px solid ${theme.color.accent}` }}>
      <Tag color={theme.color.accent}>Ask</Tag>
      <div style={{ fontSize: 14, lineHeight: 1.5, color: theme.color.text, margin: '6px 0 10px' }}>{step.text}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {step.options.map((op, i) => (
          <button key={i} onClick={() => setSel(i)} style={selBtn(sel === i)}>{op.label}</button>
        ))}
      </div>
      {chosen && (
        <div style={{ marginTop: 12, paddingLeft: 12, borderLeft: `2px solid ${theme.color.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <StepList steps={chosen.then} path={`${path}.${sel}`} done={done} toggle={toggle} />
        </div>
      )}
    </div>
  );
}

function PointsCard({ points }: { points: string[] }) {
  return (
    <div style={{ ...card, padding: '12px 14px', marginTop: 10, background: theme.color.surfaceMuted, border: 'none' }}>
      <Tag color={theme.color.textMuted}>If it opens up — cover</Tag>
      <ul style={{ margin: '6px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {points.map((p, i) => <li key={i} style={{ fontSize: 13.5, lineHeight: 1.5, color: theme.color.text }}>{p}</li>)}
      </ul>
    </div>
  );
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color }}>{children}</div>
  );
}

function selBtn(active: boolean): React.CSSProperties {
  return {
    background: active ? theme.color.accent : theme.color.surface,
    color: active ? '#fff' : theme.color.text,
    border: `1px solid ${active ? theme.color.accent : theme.color.borderStrong}`,
    borderRadius: theme.radius.md, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  };
}
