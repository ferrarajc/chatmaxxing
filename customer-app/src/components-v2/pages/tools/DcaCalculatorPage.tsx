import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { theme } from '../../../theme';
import { ToolPage, ToolCard, ResultStat, StatList, Callout, CtaButton, chartTooltipStyle } from '../../tools/ui';
import { NumberInput, SliderInput, Segmented } from '../../tools/inputs';
import { fmtCurrency, fmtMoney, fmtMoneyCents, fmtNum } from '../../tools/format';

type Scenario = 'dip' | 'volatile' | 'rising' | 'falling';

const SCENARIOS: { value: Scenario; label: string; note: string }[] = [
  { value: 'dip',      label: 'Dip & recover', note: 'Prices fall, then climb back above where they started.' },
  { value: 'volatile', label: 'Choppy',        note: 'Big swings up and down with a slight upward drift.' },
  { value: 'rising',   label: 'Steady climb',  note: 'Prices rise fairly steadily the whole way.' },
  { value: 'falling',  label: 'Long slump',    note: 'Prices trend downward over the whole period.' },
];

// Deterministic, illustrative price path normalized to start at $100. Not a prediction —
// just four shapes that show how dollar-cost averaging behaves in different markets.
function pricePath(scenario: Scenario, months: number): number[] {
  const p: number[] = [];
  for (let t = 0; t <= months; t++) {
    const x = months === 0 ? 0 : t / months;
    let price: number;
    switch (scenario) {
      case 'rising':   price = 100 * (1 + 0.40 * x) + 4 * Math.sin(8 * Math.PI * x); break;
      case 'dip':      price = 100 * (1 - 0.35 * Math.sin(Math.PI * x)) + 18 * x;    break;
      case 'volatile': price = 100 + 16 * Math.sin(5 * Math.PI * x) + 10 * x;        break;
      case 'falling':  price = 100 * (1 - 0.45 * x) + 6 * Math.sin(4 * Math.PI * x); break;
    }
    p.push(Math.max(price, 5));
  }
  return p;
}

const DCA_COLOR = theme.color.primary;
const LUMP_COLOR = theme.color.accent;

export function DcaCalculatorPage() {
  const [monthly,  setMonthly]  = useState(500);
  const [months,   setMonths]   = useState(24);
  const [scenario, setScenario] = useState<Scenario>('dip');

  const r = useMemo(() => {
    const price = pricePath(scenario, months);
    const total = monthly * months;
    const lumpShares = total / price[0];

    let shares = 0, invested = 0;
    const series: { month: number; dca: number; lump: number; price: number }[] = [];
    for (let t = 0; t <= months; t++) {
      if (t < months) { shares += monthly / price[t]; invested += monthly; }
      series.push({
        month: t,
        dca: Math.round(shares * price[t]),
        lump: Math.round(lumpShares * price[t]),
        price: Math.round(price[t] * 100) / 100,
      });
    }
    const finalPrice = price[months];
    const dcaFinal = shares * finalPrice;
    const lumpFinal = lumpShares * finalPrice;
    return {
      total, shares, avgCost: invested / shares, finalPrice,
      dcaFinal, lumpFinal, dcaWins: dcaFinal >= lumpFinal,
      series,
      priceSeries: price.map((pr, t) => ({ month: t, price: Math.round(pr * 100) / 100 })),
    };
  }, [monthly, months, scenario]);

  const activeScenario = SCENARIOS.find(s => s.value === scenario)!;

  return (
    <ToolPage
      eyebrow="Calculator"
      title="Dollar-Cost Averaging"
      subtitle="Dollar-cost averaging means investing a fixed amount on a regular schedule, no matter what the market is doing. See how it plays out against investing the same total all at once."
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>

        {/* ── Inputs ── */}
        <ToolCard title="Your Plan">
          <NumberInput label="Monthly Investment" value={monthly} step={50} prefix="$" maxDigits={7} onChange={setMonthly} />
          <SliderInput label="Months Invested" value={months} min={6} max={60} step={1} format={v => v + ' mo'} onChange={setMonths} />
          <Segmented<Scenario>
            label="Illustrative Market Scenario"
            value={scenario}
            options={SCENARIOS.map(s => ({ value: s.value, label: s.label }))}
            onChange={setScenario}
          />
          <Callout tone="neutral" style={{ fontSize: 14 }}>
            <strong>{activeScenario.label}:</strong> {activeScenario.note} You invest{' '}
            <strong>{fmtMoney(monthly)}</strong>/month for <strong>{months} months</strong> —{' '}
            <strong>{fmtMoney(r.total)}</strong> total either way.
          </Callout>
          {/* price preview */}
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: theme.color.textSubtle, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Share price over the period
            </div>
            <ResponsiveContainer width="100%" height={110}>
              <LineChart data={r.priceSeries} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
                <XAxis dataKey="month" hide />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(v: unknown) => [fmtMoneyCents(Number(v)), 'Price']}
                  labelFormatter={(m: unknown) => `Month ${m}`}
                />
                <Line type="monotone" dataKey="price" stroke={theme.color.textMuted} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ToolCard>

        {/* ── Results ── */}
        <ToolCard title="How It Turned Out">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <ResultStat tone={r.dcaWins ? 'success' : 'neutral'} label="Dollar-cost averaging" value={fmtCurrency(r.dcaFinal)} />
              <ResultStat tone={!r.dcaWins ? 'success' : 'neutral'} label="All at once (lump sum)" value={fmtCurrency(r.lumpFinal)} />
            </div>
            <StatList rows={[
              { label: 'Total invested', value: fmtMoney(r.total) },
              { label: 'Shares bought (DCA)', value: fmtNum(r.shares, 1) },
              { label: 'Your average cost / share', value: fmtMoneyCents(r.avgCost) },
              { label: 'Ending price / share', value: fmtMoneyCents(r.finalPrice) },
            ]} />
            <Callout tone={r.dcaWins ? 'success' : 'primary'}>
              {r.dcaWins ? (
                <>In this scenario, <strong>dollar-cost averaging came out ahead</strong> — your fixed
                payments bought more shares while prices were low, pulling your average cost down to{' '}
                {fmtMoneyCents(r.avgCost)}.</>
              ) : (
                <>Here, <strong>investing all at once came out ahead</strong> — more time in the market
                helped. DCA's real win in this case was removing the risk of putting everything in right
                before a fall, and never having to guess the timing.</>
              )}
            </Callout>
          </div>
        </ToolCard>
      </div>

      {/* ── Value over time ── */}
      <ToolCard title="Portfolio value over time">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={r.series} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.color.border} vertical={false} />
            <XAxis
              dataKey="month" tick={{ fontSize: 12, fill: theme.color.textMuted }}
              tickFormatter={(m: number) => (m === 0 ? 'Start' : `Mo ${m}`)}
              stroke={theme.color.borderStrong} interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 12, fill: theme.color.textMuted }}
              tickFormatter={(v: number) => (v >= 1000 ? '$' + Math.round(v / 1000) + 'K' : '$' + v)}
              stroke={theme.color.borderStrong} width={56}
            />
            <Tooltip
              contentStyle={chartTooltipStyle}
              formatter={(v: unknown, name: unknown) => [fmtMoney(Number(v)), name === 'dca' ? 'Dollar-cost averaging' : 'Lump sum']}
              labelFormatter={(m: unknown) => (Number(m) === 0 ? 'Start' : `Month ${m}`)}
            />
            <Legend
              formatter={(name: string) => (name === 'dca' ? 'Dollar-cost averaging' : 'Lump sum')}
              wrapperStyle={{ fontSize: 13 }}
            />
            <Line type="monotone" dataKey="dca"  stroke={DCA_COLOR}  strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="lump" stroke={LUMP_COLOR} strokeWidth={3} dot={false} activeDot={{ r: 5 }} strokeDasharray="6 4" />
          </LineChart>
        </ResponsiveContainer>
        <div style={{ marginTop: 8, marginBottom: 18, fontSize: 14, color: theme.color.textSubtle, lineHeight: 1.5 }}>
          Early on, the lump sum has all its money working from day one, while dollar-cost averaging is still
          ramping up — that's the trade-off. By the end, both have invested the same total.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <CtaButton to="/account/auto-invest">Set up automatic investing →</CtaButton>
          <span style={{ fontSize: 14, color: theme.color.textSubtle }}>
            Auto-Invest puts dollar-cost averaging on autopilot.
          </span>
        </div>
      </ToolCard>
    </ToolPage>
  );
}
