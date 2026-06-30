import React, { useState } from 'react';
import { theme } from '../theme';
import { SectionLabel, card } from './ui';
import { AGENT_NAME } from '../dossier';
import { useStore } from '../store';
import type { GuidedScript as GS, IntentBrief, ScriptStep, ScriptBranch } from '../types';

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

/**
 * Editable preview of the guided call script. The agent can tweak any pre-written line in place,
 * add or remove plain lines, and the conditional ask-branches are laid out as annotated notes
 * ("If 'No' → …") with their lines editable too. Edits persist to the store keyed by callbackId so
 * the live teleprompter executes the agent's exact wording.
 */
export function ScriptPreview({ callbackId, gs }: { callbackId: string; gs: GS }) {
  const draft = useStore(s => s.scriptDrafts[callbackId]);
  const setScriptDraft = useStore(s => s.setScriptDraft);
  const script = draft ?? gs;
  const [editing, setEditing] = useState(false);

  const patch = (next: Partial<GS>) => setScriptDraft(callbackId, { ...script, ...next });
  const reset = () => setScriptDraft(callbackId, gs);
  const edited = !!draft;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <SectionLabel>Script preview</SectionLabel>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {edited && !editing && <span style={{ fontSize: 11, color: theme.color.accent, fontWeight: 700 }}>✎ edited</span>}
          {editing && edited && <button onClick={reset} style={linkBtn}>Reset</button>}
          <button onClick={() => setEditing(e => !e)} style={editBtn(editing)}>{editing ? 'Done' : '✎ Edit'}</button>
        </div>
      </div>

      <GreetingCard confirmAsk={script.confirmAsk} editing={editing} onChange={t => patch({ confirmAsk: t })} />

      {(script.steps.length > 0 || editing) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          <StepsEditor steps={script.steps} editing={editing} setSteps={s => patch({ steps: s })} />
          {editing && (
            <button onClick={() => patch({ steps: [...script.steps, { kind: 'say', text: '' }] })} style={addBtn}>+ Add line</button>
          )}
        </div>
      )}

      {script.points && script.points.length > 0 && (
        <PointsCard points={script.points} editing={editing} onChange={p => patch({ points: p })} />
      )}
    </div>
  );
}

function GreetingCard({ confirmAsk, editing, onChange }: { confirmAsk: string; editing: boolean; onChange: (t: string) => void }) {
  return (
    <div style={{ ...card, padding: '14px 16px', background: theme.color.primarySoft, border: 'none' }}>
      <Tag color={theme.color.primary}>Open the call</Tag>
      <div style={{ fontSize: 14.5, lineHeight: 1.55, color: theme.color.text, marginTop: 6 }}>
        “This is <b>{AGENT_NAME}</b> at Bob's Mutual Funds, speaking on a recorded line — and I understand
        that you want{' '}
        {editing
          ? <InlineEdit value={confirmAsk} onChange={onChange} />
          : <b>{confirmAsk}</b>}. Is that correct?”
      </div>
    </div>
  );
}

function StepsEditor({ steps, editing, setSteps }: { steps: ScriptStep[]; editing: boolean; setSteps: (s: ScriptStep[]) => void }) {
  const replace = (i: number, step: ScriptStep) => setSteps(steps.map((s, j) => (j === i ? step : s)));
  const remove = (i: number) => setSteps(steps.filter((_, j) => j !== i));
  return (
    <>
      {steps.map((step, i) =>
        step.kind === 'ask' ? (
          <AskEditor
            key={i}
            step={step}
            editing={editing}
            onChangeText={t => replace(i, { ...step, text: t })}
            onChangeOptionThen={(oi, then) => replace(i, { ...step, options: step.options.map((o, k) => (k === oi ? { ...o, then } : o)) })}
          />
        ) : (
          <SayLine key={i} text={step.text} editing={editing} onChange={t => replace(i, { kind: 'say', text: t })} onDelete={() => remove(i)} />
        ),
      )}
    </>
  );
}

function SayLine({ text, editing, onChange, onDelete }: { text: string; editing: boolean; onChange: (t: string) => void; onDelete?: () => void }) {
  if (editing) {
    return (
      <div style={{ ...card, display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px' }}>
        <span style={{ color: theme.color.success, fontSize: 13, marginTop: 7 }}>●</span>
        <BlockEdit value={text} onChange={onChange} />
        {onDelete && <button onClick={onDelete} title="Remove line" style={delBtn}>✕</button>}
      </div>
    );
  }
  return (
    <div style={{ ...card, display: 'flex', gap: 10, alignItems: 'flex-start', padding: '11px 14px' }}>
      <span style={{ color: theme.color.success, fontSize: 13, lineHeight: 1.5 }}>●</span>
      <span style={{ fontSize: 14, lineHeight: 1.5, color: theme.color.text }}>{text || <em style={{ color: theme.color.textSubtle }}>(empty line)</em>}</span>
    </div>
  );
}

function AskEditor({ step, editing, onChangeText, onChangeOptionThen }: {
  step: Extract<ScriptStep, { kind: 'ask' }>; editing: boolean;
  onChangeText: (t: string) => void; onChangeOptionThen: (oi: number, then: ScriptStep[]) => void;
}) {
  return (
    <div style={{ ...card, padding: '12px 14px', borderLeft: `3px solid ${theme.color.accent}` }}>
      <Tag color={theme.color.accent}>Ask · then branch on the answer</Tag>
      <div style={{ margin: '6px 0 10px' }}>
        {editing
          ? <BlockEdit value={step.text} onChange={onChangeText} />
          : <span style={{ fontSize: 14, lineHeight: 1.5, color: theme.color.text }}>{step.text}</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {step.options.map((op, oi) => (
          <div key={oi} style={{ paddingLeft: 12, borderLeft: `2px solid ${theme.color.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: theme.color.accent, marginBottom: 6 }}>If “{op.label}” →</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <StepsEditor steps={op.then} editing={editing} setSteps={then => onChangeOptionThen(oi, then)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PointsCard({ points, editing, onChange }: { points: string[]; editing: boolean; onChange: (p: string[]) => void }) {
  return (
    <div style={{ ...card, padding: '12px 14px', marginTop: 10, background: theme.color.surfaceMuted, border: 'none' }}>
      <Tag color={theme.color.textMuted}>If it opens up — cover</Tag>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
        {points.map((p, i) =>
          editing ? (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <BlockEdit value={p} onChange={t => onChange(points.map((q, j) => (j === i ? t : q)))} />
              <button onClick={() => onChange(points.filter((_, j) => j !== i))} title="Remove" style={delBtn}>✕</button>
            </div>
          ) : (
            <div key={i} style={{ fontSize: 13.5, lineHeight: 1.5, color: theme.color.text, paddingLeft: 14, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0 }}>•</span>{p}
            </div>
          ),
        )}
      </div>
    </div>
  );
}

/** A compact inline-growing input used inside the greeting sentence. */
function InlineEdit({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        font: 'inherit', fontWeight: 700, color: theme.color.primary, background: theme.color.surface,
        border: `1px solid ${theme.color.primarySoftBorder}`, borderRadius: theme.radius.sm,
        padding: '1px 6px', minWidth: 220, width: `${Math.min(90, Math.max(28, value.length + 2))}ch`, maxWidth: '100%',
      }}
    />
  );
}

/** A full-width auto-sizing textarea for editing a script line. */
function BlockEdit({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={Math.max(1, Math.ceil((value.length || 1) / 60))}
      style={{
        flex: 1, font: 'inherit', fontSize: 14, lineHeight: 1.5, color: theme.color.text, resize: 'vertical',
        background: theme.color.surface, border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.md,
        padding: '7px 10px', width: '100%',
      }}
    />
  );
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color }}>{children}</div>
  );
}

const editBtn = (active: boolean): React.CSSProperties => ({
  background: active ? theme.color.primary : theme.color.surface, color: active ? '#fff' : theme.color.text,
  border: `1px solid ${active ? theme.color.primary : theme.color.borderStrong}`, borderRadius: theme.radius.md,
  padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
});
const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: theme.color.textMuted, fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline',
};
const addBtn: React.CSSProperties = {
  alignSelf: 'flex-start', background: 'none', border: `1px dashed ${theme.color.borderStrong}`, color: theme.color.textMuted,
  borderRadius: theme.radius.md, padding: '6px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
};
const delBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: theme.color.textSubtle, fontSize: 13, cursor: 'pointer', padding: '4px 6px', flexShrink: 0,
};
