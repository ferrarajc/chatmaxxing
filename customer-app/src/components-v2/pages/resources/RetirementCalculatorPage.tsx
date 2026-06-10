import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../../../theme';
import { useClientStore } from '../../../store/clientStore';

const INFLATION_RATE = 0.03;
const WITHDRAWAL_RATE = 0.04;

function fmtCurrency(v: number) {
  if (Math.abs(v) >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(v) >= 1_000) return '$' + (v / 1_000).toFixed(0) + 'K';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}

function fmtCurrencyFull(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}

function retirementSavings(persona: { accounts: { type: string; balance: number }[] }) {
  return persona.accounts
    .filter(a => !a.type.toLowerCase().includes('taxable'))
    .reduce((sum, a) => sum + a.balance, 0);
}

interface SliderInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  note?: string;
}

function SliderInput({ label, value, min, max, step, format, onChange, note }: SliderInputProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const startEdit = () => { setEditValue(String(value)); setEditing(true); };

  const commitEdit = () => {
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed)) onChange(Math.max(min, Math.min(max, parsed)));
    setEditing(false);
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: theme.color.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ width: 240, cursor: 'pointer', accentColor: theme.color.primary }}
        />
        {editing ? (
          <input
            type="number"
            value={editValue}
            min={min}
            max={max}
            step={step}
            autoFocus
            onChange={e => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => e.key === 'Enter' && commitEdit()}
            style={{
              width: 80, padding: '6px 10px', border: `2px solid ${theme.color.primary}`,
              borderRadius: theme.radius.md, fontSize: 20, fontWeight: 600,
              color: theme.color.primary, textAlign: 'center', fontFamily: theme.font.sans,
            }}
          />
        ) : (
          <div
            onClick={startEdit}
            title="Click to edit"
            style={{
              minWidth: 60, padding: '5px 10px', background: theme.color.surfaceMuted,
              border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md,
              fontSize: 20, fontWeight: 600, color: theme.color.primary,
              textAlign: 'center', cursor: 'pointer', userSelect: 'none',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = theme.color.primary)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = theme.color.border)}
          >
            {format(value)}
          </div>
        )}
        {note && <span style={{ fontSize: 18, color: theme.color.textSubtle }}>{note}</span>}
      </div>
    </div>
  );
}

interface NumberInputProps {
  label: string;
  value: number;
  min: number;
  step: number;
  prefix?: string;
  narrow?: boolean;
  maxDigits?: number;
  onChange: (v: number) => void;
}

function NumberInput({ label, value, min, step, prefix, narrow, maxDigits, onChange }: NumberInputProps) {
  // Raw text while the field is focused; null = not editing, display the committed value.
  // Sanitizing to digits here (instead of clamping to min on every keystroke) lets the
  // user replace a selected value naturally — "1" mid-typing must not snap to min.
  const [text, setText] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let digits = e.target.value.replace(/\D/g, '');
    if (maxDigits) digits = digits.slice(0, maxDigits);
    setText(digits);
    if (digits !== '') onChange(parseInt(digits, 10));
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: theme.color.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {prefix && (
          <span style={{
            padding: '9px 13px', background: theme.color.surfaceMuted, border: `1px solid ${theme.color.border}`,
            borderRight: 'none', borderRadius: `${theme.radius.md}px 0 0 ${theme.radius.md}px`,
            fontSize: 21, color: theme.color.textMuted, fontWeight: 500,
          }}>
            {prefix}
          </span>
        )}
        <input
          type="number"
          value={text ?? value}
          min={min}
          step={step}
          onChange={handleChange}
          onFocus={e => e.target.select()}
          onBlur={() => setText(null)}
          style={{
            width: narrow ? 112 : prefix ? 200 : 225, padding: '9px 13px',
            border: `1px solid ${theme.color.border}`,
            borderRadius: prefix ? `0 ${theme.radius.md}px ${theme.radius.md}px 0` : theme.radius.md,
            fontSize: 21, color: theme.color.text, fontFamily: theme.font.sans,
            background: theme.color.surface,
          }}
        />
      </div>
    </div>
  );
}

const STATUS_COLORS = {
  green:  { text: theme.color.success, bg: theme.color.successSoft,  border: theme.color.successBorder },
  yellow: { text: '#A8741F',           bg: theme.color.warningSoft,  border: theme.color.warningBorder },
  red:    { text: theme.color.danger,  bg: theme.color.dangerSoft,   border: '#DDA5A5' },
};

export function RetirementCalculatorPage() {
  const { activePersona: persona } = useClientStore();

  const [currentAge,     setCurrentAge]     = useState(() => persona.age);
  const [retirementAge,  setRetirementAge]  = useState(65);
  const [salary,         setSalary]         = useState(() => persona.salary);
  const [currentSavings, setCurrentSavings] = useState(() => retirementSavings(persona));
  const [savingRate,     setSavingRate]     = useState(10);
  const [nominalReturn,  setNominalReturn]  = useState(7);
  const [replacementRate,setReplacementRate]= useState(75);

  // Re-seed persona-driven fields when user switches clients
  useEffect(() => {
    setCurrentAge(persona.age);
    setSalary(persona.salary);
    setCurrentSavings(retirementSavings(persona));
    setRetirementAge(65);
  }, [persona.clientId]);

  const r = useMemo(() => {
    const n = Math.max(retirementAge - currentAge, 0);
    const savRate  = savingRate      / 100;
    const nomRate  = nominalReturn   / 100;
    const replRate = replacementRate / 100;
    const realReturn = (1 + nomRate) / (1 + INFLATION_RATE) - 1;
    const annualContribution = salary * savRate;

    let fvContributions = 0;
    if (n > 0) {
      fvContributions = realReturn !== 0
        ? annualContribution * ((Math.pow(1 + realReturn, n) - 1) / realReturn) * (1 + realReturn)
        : annualContribution * n;
    }

    const fvInitial = currentSavings * Math.pow(1 + realReturn, n);
    const nestEgg = fvInitial + fvContributions;
    const monthlyExpenses  = (replRate * salary) / 12;
    const neededNestEgg    = salary > 0 ? (monthlyExpenses * 12) / WITHDRAWAL_RATE : 0;
    const totalContributions = currentSavings + annualContribution * n;
    const investmentGrowth   = nestEgg - totalContributions;
    const monthlyIncome      = (WITHDRAWAL_RATE * nestEgg) / 12;
    const pct = neededNestEgg > 0 ? (nestEgg / neededNestEgg) * 100 : 100;

    return { n, nestEgg, neededNestEgg, annualContribution, monthlyIncome, monthlyExpenses, totalContributions, investmentGrowth, pct };
  }, [currentAge, retirementAge, salary, currentSavings, savingRate, nominalReturn, replacementRate]);

  const status: 'green' | 'yellow' | 'red' = r.pct >= 100 ? 'green' : r.pct >= 90 ? 'yellow' : 'red';
  const sc = STATUS_COLORS[status];

  const card: React.CSSProperties = {
    background: theme.color.surface,
    borderRadius: theme.radius.xl,
    padding: '28px 32px',
    boxShadow: theme.shadow.md,
    border: `1px solid ${theme.color.border}`,
    position: 'relative',
    overflow: 'hidden',
  };

  const topAccent: React.CSSProperties = {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
    background: `linear-gradient(90deg, ${theme.color.primary}, ${theme.color.accent})`,
  };

  return (
    <div style={{ maxWidth: 1060, margin: '0 auto', padding: '36px 28px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 8px', fontSize: 42, fontWeight: 800, fontFamily: theme.font.serif }}>
        Retirement Calculator
      </h1>
      <p style={{ margin: '0 0 36px', color: theme.color.textMuted, fontSize: 21 }}>
        Estimate how much you'll need to retire comfortably and see whether you're on track. All figures are in today's dollars (inflation-adjusted).
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* ── Inputs ── */}
        <div style={card}>
          <div style={topAccent} />
          <h2 style={{ margin: '0 0 28px', fontSize: 27, fontWeight: 700, fontFamily: theme.font.serif, color: theme.color.text }}>
            Your Information
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            <NumberInput label="Current Age"    value={currentAge}    min={0} step={1} narrow maxDigits={2} onChange={setCurrentAge} />
            <NumberInput label="Retirement Age" value={retirementAge} min={0} step={1} narrow maxDigits={2} onChange={setRetirementAge} />
          </div>

          <NumberInput label="Annual Salary"              value={salary}         min={0} step={1000} prefix="$" maxDigits={9} onChange={setSalary} />
          <NumberInput label="Current Retirement Savings" value={currentSavings} min={0} step={1000} prefix="$" maxDigits={9} onChange={setCurrentSavings} />

          <SliderInput
            label="Annual Savings Rate (% of salary)"
            value={savingRate} min={0} max={50} step={1}
            format={v => v + '%'}
            onChange={setSavingRate}
            note={fmtCurrencyFull(salary * savingRate / 100) + '/yr'}
          />
          <SliderInput
            label="Assumed Annual Return"
            value={nominalReturn} min={0} max={15} step={0.5}
            format={v => v + '%'}
            onChange={setNominalReturn}
          />
          <SliderInput
            label="% of Salary Needed in Retirement"
            value={replacementRate} min={0} max={100} step={5}
            format={v => v + '%'}
            onChange={setReplacementRate}
          />

          <div style={{ fontSize: 16, color: theme.color.textSubtle, marginTop: 4, lineHeight: 1.5 }}>
            Returns are adjusted for 3% inflation. The 4% rule estimates sustainable annual withdrawals.
          </div>
        </div>

        {/* ── Results ── */}
        <div style={card}>
          <div style={topAccent} />
          <h2 style={{ margin: '0 0 28px', fontSize: 27, fontWeight: 700, fontFamily: theme.font.serif, color: theme.color.text }}>
            Your Projection
          </h2>

          {/* Primary figures */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>
            <div style={{ padding: '18px 20px', borderRadius: theme.radius.lg, background: theme.color.primarySoft, border: `1px solid ${theme.color.primarySoftBorder}` }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: theme.color.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                How Much You'll Need
              </div>
              <div style={{ fontSize: 54, fontWeight: 800, fontFamily: theme.font.serif, color: theme.color.primary, lineHeight: 1 }}>
                {fmtCurrency(r.neededNestEgg)}
              </div>
            </div>

            <div style={{ padding: '18px 20px', borderRadius: theme.radius.lg, background: sc.bg, border: `1px solid ${sc.border}` }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: theme.color.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                You're Expected to Have
              </div>
              <div style={{ fontSize: 54, fontWeight: 800, fontFamily: theme.font.serif, color: sc.text, lineHeight: 1 }}>
                {fmtCurrency(r.nestEgg)}
              </div>
              <div style={{ fontSize: 18, color: sc.text, marginTop: 8, fontWeight: 500 }}>
                {r.pct >= 100
                  ? `${Math.round(r.pct)}% of goal — on track`
                  : `${Math.round(r.pct)}% of goal — ${fmtCurrency(r.neededNestEgg - r.nestEgg)} gap`}
              </div>
            </div>
          </div>

          {/* IRA CTA — only shown when on track */}
          {status === 'green' && (
            <div style={{ padding: '22px 24px', borderRadius: theme.radius.lg, background: theme.color.primary, marginBottom: 18 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#FFFFFF', marginBottom: 8 }}>
                You can do it!
              </div>
              <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.82)', lineHeight: 1.55, marginBottom: 16 }}>
                You're on track for a comfortable retirement. An IRA can help you keep more of what you've saved through tax-advantaged growth.
              </div>
              <Link
                to="/open-account?accountType=roth-ira"
                style={{ display: 'inline-block', background: theme.color.accent, color: '#FFFFFF', borderRadius: 8, padding: '11px 24px', fontSize: 20, fontWeight: 700, textDecoration: 'none', letterSpacing: '0.01em' }}
              >
                Open an IRA with Bob's →
              </Link>
            </div>
          )}

          {/* Secondary stats */}
          <div style={{ padding: '18px 20px', borderRadius: theme.radius.lg, background: theme.color.surfaceMuted, border: `1px solid ${theme.color.border}` }}>
            {[
              { label: 'Years to Retirement',                    value: r.n + ' years' },
              { label: 'Total Contributions',                    value: fmtCurrency(r.totalContributions) },
              { label: 'Investment Growth',                      value: fmtCurrency(r.investmentGrowth) },
              { label: 'Monthly Retirement Income',              value: fmtCurrencyFull(r.monthlyIncome) },
              { label: 'Target Monthly Expenses',               value: fmtCurrencyFull(r.monthlyExpenses) },
            ].map((item, i, arr) => (
              <div
                key={item.label}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  paddingTop: i > 0 ? 12 : 0,
                  paddingBottom: i < arr.length - 1 ? 12 : 0,
                  borderBottom: i < arr.length - 1 ? `1px solid ${theme.color.border}` : 'none',
                }}
              >
                <div style={{ fontSize: 18, color: theme.color.textMuted, fontWeight: 500 }}>{item.label}</div>
                <div style={{ fontSize: 21, fontWeight: 700, color: theme.color.text }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{ marginTop: 24, padding: '14px 18px', borderRadius: theme.radius.lg, background: theme.color.warningSoft, border: `1px solid ${theme.color.warningBorder}`, fontSize: 18, color: theme.color.warning, lineHeight: 1.5 }}>
        This calculator provides estimates for informational purposes only and does not constitute financial advice.
        Actual results will vary. Consider consulting a financial advisor for personalized guidance.
      </div>
    </div>
  );
}
