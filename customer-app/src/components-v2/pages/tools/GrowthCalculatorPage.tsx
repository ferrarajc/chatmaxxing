import React, { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { theme } from '../../../theme';
import { ToolPage, ToolCard, ResultStat, StatList, Callout, CtaButton, chartTooltipStyle } from '../../tools/ui';
import { NumberInput, SliderInput } from '../../tools/inputs';
import { fmtCurrency, fmtMoney, fmtPct } from '../../tools/format';

// Monthly compounding with end-of-month contributions. Tracks how much of the ending
// balance is your own money (contributions) vs. investment growth, for a stacked area chart.
function project(initial: number, monthly: number, years: number, annualPct: number) {
  const months = Math.round(years * 12);
  const monthlyRate = annualPct / 100 / 12;
  let balance = initial;
  let contrib = initial;
  const yearly = [{ year: 0, contrib: initial, growth: 0, balance: initial }];
  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + monthlyRate) + monthly;
    contrib += monthly;
    if (m % 12 === 0) {
      yearly.push({
        year: m / 12,
        contrib: Math.round(contrib),
        growth: Math.round(Math.max(balance - contrib, 0)),
        balance: Math.round(balance),
      });
    }
  }
  return { end: balance, totalContrib: contrib, yearly };
}

const CONTRIB_COLOR = theme.color.primary;
const GROWTH_COLOR = theme.color.success;

export function GrowthCalculatorPage() {
  const [initial,  setInitial]  = useState(10_000);
  const [monthly,  setMonthly]  = useState(500);
  const [years,    setYears]    = useState(30);
  const [annual,   setAnnual]   = useState(7);

  const r = useMemo(() => {
    const p = project(initial, monthly, years, annual);
    const growth = p.end - p.totalContrib;
    return {
      end: p.end,
      totalContrib: p.totalContrib,
      growth,
      growthShare: p.end > 0 ? (growth / p.end) * 100 : 0,
      multiple: p.totalContrib > 0 ? p.end / p.totalContrib : 0,
      chart: p.yearly,
    };
  }, [initial, monthly, years, annual]);

  return (
    <ToolPage
      eyebrow="Calculator"
      title="Growth Projector"
      subtitle="Compounding is the quiet engine of long-term investing: your returns earn returns of their own. See how a starting balance plus steady contributions can grow over time."
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>

        {/* ── Inputs ── */}
        <ToolCard title="Your Plan">
          <NumberInput label="Starting Amount"      value={initial} step={1000} prefix="$" maxDigits={9} onChange={setInitial} />
          <NumberInput label="Monthly Contribution" value={monthly} step={50}   prefix="$" maxDigits={7} onChange={setMonthly} />
          <SliderInput label="Years Invested" value={years} min={1} max={45} step={1} format={v => v + ' yrs'} onChange={setYears} />
          <SliderInput label="Assumed Annual Return" value={annual} min={1} max={12} step={0.5} format={v => fmtPct(v, 1)} onChange={setAnnual} />
          <div style={{ fontSize: 14, color: theme.color.textSubtle, marginTop: 4, lineHeight: 1.5 }}>
            For reference, a broad U.S. stock index has historically returned roughly 7% per year after inflation over long periods — though any given year can be far higher or lower.
          </div>
        </ToolCard>

        {/* ── Results ── */}
        <ToolCard title="Your Projection">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ResultStat
              tone="success" big
              label={`Projected balance in ${years} years`}
              value={fmtCurrency(r.end)}
              sub={`That's ${r.multiple.toFixed(1)}× what you put in.`}
            />
            <StatList rows={[
              { label: 'Total you contribute', value: fmtMoney(r.totalContrib) },
              { label: 'Investment growth', value: fmtMoney(r.growth) },
              { label: 'Growth as share of balance', value: fmtPct(r.growthShare, 0) },
            ]} />
            <Callout tone="primary">
              About <strong>{fmtPct(r.growthShare, 0)}</strong> of your ending balance is growth you never
              had to contribute — that's compounding doing the work.
            </Callout>
          </div>
        </ToolCard>
      </div>

      {/* ── Stacked area: contributions vs growth ── */}
      <ToolCard title="Contributions vs. growth over time">
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={r.chart} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
            <defs>
              <linearGradient id="contribFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CONTRIB_COLOR} stopOpacity={0.85} />
                <stop offset="100%" stopColor={CONTRIB_COLOR} stopOpacity={0.55} />
              </linearGradient>
              <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GROWTH_COLOR} stopOpacity={0.8} />
                <stop offset="100%" stopColor={GROWTH_COLOR} stopOpacity={0.45} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.color.border} vertical={false} />
            <XAxis
              dataKey="year" tick={{ fontSize: 12, fill: theme.color.textMuted }}
              tickFormatter={(y: number) => (y === 0 ? 'Now' : `Yr ${y}`)}
              stroke={theme.color.borderStrong} interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 12, fill: theme.color.textMuted }}
              tickFormatter={(v: number) => (v >= 1000 ? '$' + Math.round(v / 1000) + 'K' : '$' + v)}
              stroke={theme.color.borderStrong} width={56}
            />
            <Tooltip
              contentStyle={chartTooltipStyle}
              formatter={(v: unknown, name: unknown) => [fmtMoney(Number(v)), name === 'contrib' ? 'Your contributions' : 'Investment growth']}
              labelFormatter={(y: unknown) => (Number(y) === 0 ? 'Today' : `Year ${y}`)}
            />
            <Legend
              formatter={(name: string) => (name === 'contrib' ? 'Your contributions' : 'Investment growth')}
              wrapperStyle={{ fontSize: 13 }}
            />
            <Area type="monotone" dataKey="contrib" stackId="a" stroke={CONTRIB_COLOR} strokeWidth={2} fill="url(#contribFill)" />
            <Area type="monotone" dataKey="growth"  stackId="a" stroke={GROWTH_COLOR}  strokeWidth={2} fill="url(#growthFill)" />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <CtaButton to="/account/auto-invest">Automate contributions with Auto-Invest →</CtaButton>
          <span style={{ fontSize: 14, color: theme.color.textSubtle }}>
            Steady, automatic investing is how compounding compounds.
          </span>
        </div>
      </ToolCard>
    </ToolPage>
  );
}
