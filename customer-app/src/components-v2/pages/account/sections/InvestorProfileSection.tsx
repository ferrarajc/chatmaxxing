import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useClientStore } from '../../../../store/clientStore';
import { InvestorProfile } from '../../../../data/personas';
import { theme } from '../../../../theme';
import {
  SectionCard, Field, TextInput, SelectInput, PrimaryButton, GhostButton, LinkButton,
  Chip, Toast, useSavedToast, editGrid, inputStyle,
} from './ui';

const HORIZONS = ['Income now', '1–3 years', '3–5 years', '5–10 years', '10+ years'];
const INCOME = ['Under $50,000', '$50,000–$75,000', '$75,000–$150,000', '$150,000+'];
const NET_WORTH = ['Under $100,000', '$100,000–$250,000', '$250,000–$500,000', '$500,000–$750,000', '$750,000–$1,000,000', '$1,000,000+'];
const EXPERIENCE = ['None', 'Some', 'Good', 'Extensive'];

const optionsWith = (current: string, base: string[]) => (current && !base.includes(current) ? [current, ...base] : base);

export function InvestorProfileSection() {
  const persona = useClientStore(s => s.activePersona);
  const save = useClientStore(s => s.saveAccountSettings);
  const ip = persona.investorProfile;

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<InvestorProfile | null>(ip);
  const [saved, flashSaved] = useSavedToast();

  const startEdit = () => { setForm(ip); setEditing(true); };
  const set = (k: keyof InvestorProfile, v: string | string[]) => setForm(f => (f ? { ...f, [k]: v } : f));

  const handleSave = async () => {
    if (!form) return;
    await save({ investorProfile: { ...form, goals: form.goals.filter(g => g.trim()), updatedAt: new Date().toISOString().slice(0, 10) } });
    setEditing(false);
    flashSaved();
  };

  if (!ip) {
    return (
      <SectionCard title="Investor profile" subtitle="Your risk tolerance and goals guide our suitability and recommendations.">
        <Toast show={saved}>Investor profile saved.</Toast>
        <p style={{ fontSize: 14, color: theme.color.text, margin: '0 0 14px', lineHeight: 1.55 }}>
          You haven't set an investor profile yet. Take our quick risk-tolerance quiz to establish your recommended allocation.
        </p>
        <Link to="/tools/risk-profile" style={{ textDecoration: 'none' }}>
          <PrimaryButton>Take the risk quiz</PrimaryButton>
        </Link>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Investor profile"
      headerRight={editing ? null : <LinkButton onClick={startEdit}>Edit goals</LinkButton>}
      id="investor-profile"
    >
      <Toast show={saved}>Investor profile saved.</Toast>

      {/* Risk profile + allocation (from the risk quiz) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700, fontFamily: theme.font.serif }}>Risk profile:</span>
        <Chip tone="primary">{ip.riskProfile}</Chip>
        <span style={{ fontSize: 12, color: theme.color.textSubtle }}>updated {ip.updatedAt}</span>
      </div>

      <div style={{ display: 'flex', height: 12, borderRadius: theme.radius.pill, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ width: `${ip.stocksPct}%`, background: theme.color.primary }} />
        <div style={{ width: `${ip.bondPct}%`, background: theme.color.success }} />
        <div style={{ width: `${ip.cashPct}%`, background: theme.color.accent }} />
      </div>
      <div style={{ display: 'flex', gap: 18, fontSize: 12, color: theme.color.textMuted, marginBottom: 16 }}>
        <LegendDot color={theme.color.primary} label={`Stocks ${ip.stocksPct}%`} />
        <LegendDot color={theme.color.success} label={`Bonds ${ip.bondPct}%`} />
        <LegendDot color={theme.color.accent} label={`Cash ${ip.cashPct}%`} />
      </div>

      {ip.slices && ip.slices.length > 0 && (
        <div style={{ fontSize: 13, color: theme.color.textMuted, marginBottom: 16 }}>
          Suggested funds:{' '}
          {ip.slices.filter(s => s.pct > 0).map((s, i, arr) => (
            <React.Fragment key={s.ticker}>
              <Link to={`/research/fund/${s.ticker}`} style={{ color: theme.color.primary, textDecoration: 'none' }}>{s.ticker} {s.pct}%</Link>
              {i < arr.length - 1 ? ' · ' : ''}
            </React.Fragment>
          ))}
        </div>
      )}

      {!editing && (
        <div style={{ borderTop: `1px solid ${theme.color.border}`, paddingTop: 14 }}>
          <Row label="Goals">{ip.goals.length ? ip.goals.join(' · ') : '—'}</Row>
          <Row label="Time horizon">{ip.timeHorizon}</Row>
          <Row label="Annual income">{ip.annualIncomeRange}</Row>
          <Row label="Net worth">{ip.netWorthRange}</Row>
          <Row label="Investment experience" last>{ip.investmentExperience}</Row>
          <div style={{ marginTop: 14 }}>
            <Link to="/tools/risk-profile" style={{ color: theme.color.primary, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>Retake risk quiz →</Link>
          </div>
        </div>
      )}

      {editing && form && (
        <div style={{ borderTop: `1px solid ${theme.color.border}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 13, color: theme.color.text, marginBottom: 6 }}>Goals</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {form.goals.map((g, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input value={g} onChange={e => set('goals', form.goals.map((x, j) => (j === i ? e.target.value : x)))} style={{ ...inputStyle, marginTop: 0 }} />
                  <button onClick={() => set('goals', form.goals.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.color.danger, fontSize: 13, fontWeight: 600 }}>Remove</button>
                </div>
              ))}
            </div>
            <button onClick={() => set('goals', [...form.goals, ''])} style={{ marginTop: 8, background: 'none', border: `1px dashed ${theme.color.borderStrong}`, borderRadius: theme.radius.md, padding: '6px 12px', cursor: 'pointer', color: theme.color.primary, fontSize: 13, fontWeight: 600 }}>+ Add goal</button>
          </div>
          <div style={editGrid(2)}>
            <Field label="Time horizon"><SelectInput value={form.timeHorizon} onChange={v => set('timeHorizon', v)} options={optionsWith(form.timeHorizon, HORIZONS)} /></Field>
            <Field label="Investment experience"><SelectInput value={form.investmentExperience} onChange={v => set('investmentExperience', v)} options={optionsWith(form.investmentExperience, EXPERIENCE)} /></Field>
            <Field label="Annual income"><SelectInput value={form.annualIncomeRange} onChange={v => set('annualIncomeRange', v)} options={optionsWith(form.annualIncomeRange, INCOME)} /></Field>
            <Field label="Net worth"><SelectInput value={form.netWorthRange} onChange={v => set('netWorthRange', v)} options={optionsWith(form.netWorthRange, NET_WORTH)} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <PrimaryButton onClick={handleSave}>Save</PrimaryButton>
            <GhostButton onClick={() => setEditing(false)}>Cancel</GhostButton>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function Row({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '9px 0', borderBottom: last ? 'none' : `1px solid ${theme.color.border}`, fontSize: 14 }}>
      <span style={{ color: theme.color.textMuted }}>{label}</span>
      <span style={{ fontWeight: 500, color: theme.color.text, textAlign: 'right' }}>{children}</span>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: color, display: 'inline-block' }} />{label}
    </span>
  );
}
