import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { theme } from '../../../theme';
import { ToolPage, ToolCard, ResultStat, StatList, Callout, CtaButton, chartTooltipStyle } from '../../tools/ui';
import { NumberInput, SliderInput } from '../../tools/inputs';
import { fmtCurrency, fmtMoney, fmtPct } from '../../tools/format';

// Simulate monthly compounding with end-of-month contributions. A fund's expense ratio is
// modeled as a drag on the gross return (net = gross − fee), the standard approach for these
// calculators. Returns the ending balance and an end-of-year balance series for charting.
function simulate(initial: number, monthly: number, years: number, grossAnnualPct: number, feePct: number) {
  const months = Math.round(years * 12);
  const monthlyRate = (grossAnnualPct - feePct) / 100 / 12;
  let balance = initial;
  const yearly: number[] = [initial];
  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + monthlyRate) + monthly;
    if (m % 12 === 0) yearly.push(balance);
  }
  return { end: balance, yearly };
}

const BOBS_NAVY = theme.color.primary;
const OTHER_RED = theme.color.danger;

export function FeeCalculatorPage() {
  const [initial,   setInitial]   = useState(10_000);
  const [monthly,   setMonthly]   = useState(500);
  const [years,     setYears]     = useState(30);
  const [grossRet,  setGrossRet]  = useState(7);
  const [bobsFee,   setBobsFee]   = useState(0.03);
  const [otherFee,  setOtherFee]  = useState(0.50);

  const r = useMemo(() => {
    const bobs  = simulate(initial, monthly, years, grossRet, bobsFee);
    const other = simulate(initial, monthly, years, grossRet, otherFee);
    const noFee = simulate(initial, monthly, years, grossRet, 0);

    const totalContrib = initial + monthly * Math.round(years * 12);
    const chart = bobs.yearly.map((b, i) => ({
      year: i,
      bobs: Math.round(b),
      other: Math.round(other.yearly[i]),
    }));

    return {
      bobsEnd: bobs.end,
      otherEnd: other.end,
      youKeepExtra: bobs.end - other.end,
      bobsCost: noFee.end - bobs.end,     // dollars lost to Bob's fee vs. zero-fee
      otherCost: noFee.end - other.end,   // dollars lost to the other fee vs. zero-fee
      totalContrib,
      chart,
    };
  }, [initial, monthly, years, grossRet, bobsFee, otherFee]);

  const card: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 14 };

  return (
    <ToolPage
      eyebrow="Calculator"
      title="The Cost of Fees"
      subtitle="A fund's expense ratio is taken quietly from its assets every year — you never see a bill. Over decades, a fraction of a percent compounds into real money. See exactly how much."
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>

        {/* ── Inputs ── */}
        <ToolCard title="Your Investment">
          <NumberInput label="Starting Amount"       value={initial} step={1000} prefix="$" maxDigits={9} onChange={setInitial} />
          <NumberInput label="Monthly Contribution"  value={monthly} step={50}   prefix="$" maxDigits={7} onChange={setMonthly} />
          <SliderInput label="Time Horizon" value={years} min={1} max={40} step={1} format={v => v + ' yrs'} onChange={setYears} />
          <SliderInput label="Assumed Annual Return (before fees)" value={grossRet} min={1} max={12} step={0.5} format={v => fmtPct(v, 1)} onChange={setGrossRet} />
          <div style={{ height: 1, background: theme.color.border, margin: '6px 0 16px' }} />
          <SliderInput
            label="Bob's Expense Ratio"
            value={bobsFee} min={0} max={1.5} step={0.01}
            format={v => fmtPct(v, 2)} onChange={setBobsFee} accent={BOBS_NAVY}
            note="Bob's funds: 0.03%–0.13%"
          />
          <SliderInput
            label="A Typical Fund Elsewhere"
            value={otherFee} min={0} max={1.5} step={0.01}
            format={v => fmtPct(v, 2)} onChange={setOtherFee} accent={OTHER_RED}
            note="Active funds often exceed 0.50%"
          />
        </ToolCard>

        {/* ── Results ── */}
        <ToolCard title="What Fees Cost You">
          <div style={card}>
            <ResultStat
              tone="success" big
              label={`Extra you keep with a ${fmtPct(bobsFee, 2)} fund`}
              value={fmtCurrency(r.youKeepExtra)}
              sub={`over ${years} years vs. a ${fmtPct(otherFee, 2)} fund — same contributions, same ${fmtPct(grossRet, 1)} return.`}
            />
            <StatList rows={[
              { label: `Ending balance — Bob's (${fmtPct(bobsFee, 2)})`, value: fmtMoney(r.bobsEnd) },
              { label: `Ending balance — other (${fmtPct(otherFee, 2)})`, value: fmtMoney(r.otherEnd) },
              { label: 'Total you contributed', value: fmtMoney(r.totalContrib) },
              { label: 'Lost to the higher fee', value: fmtMoney(r.otherCost - r.bobsCost) },
            ]} />
            <Callout tone="primary">
              That gap isn't just the fees themselves — it's every dollar of fees <em>plus</em> all
              the growth those dollars would have earned if they'd stayed invested.
            </Callout>
          </div>
        </ToolCard>
      </div>

      {/* ── Divergence chart ── */}
      <ToolCard title="How the gap grows over time">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={r.chart} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
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
              formatter={(v: unknown, name: unknown) => [fmtMoney(Number(v)), name === 'bobs' ? `Bob's (${fmtPct(bobsFee, 2)})` : `Other (${fmtPct(otherFee, 2)})`]}
              labelFormatter={(y: unknown) => (Number(y) === 0 ? 'Today' : `Year ${y}`)}
            />
            <Legend
              formatter={(name: string) => (name === 'bobs' ? `Bob's (${fmtPct(bobsFee, 2)})` : `Typical fund (${fmtPct(otherFee, 2)})`)}
              wrapperStyle={{ fontSize: 13 }}
            />
            <Line type="monotone" dataKey="bobs"  stroke={BOBS_NAVY} strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="other" stroke={OTHER_RED} strokeWidth={3} dot={false} activeDot={{ r: 5 }} strokeDasharray="6 4" />
          </LineChart>
        </ResponsiveContainer>
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <CtaButton to="/research">Compare all 36 funds' expense ratios →</CtaButton>
          <span style={{ fontSize: 14, color: theme.color.textSubtle }}>
            Every Bob's fund is 0.13% or lower.
          </span>
        </div>
      </ToolCard>
    </ToolPage>
  );
}
