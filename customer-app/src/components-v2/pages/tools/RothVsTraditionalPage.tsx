import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
import { theme } from '../../../theme';
import { ToolPage, ToolCard, ResultStat, StatList, Callout, CtaButton, chartTooltipStyle } from '../../tools/ui';
import { NumberInput, SliderInput } from '../../tools/inputs';
import { fmtCurrency, fmtMoney, fmtPct } from '../../tools/format';

// Future value of a fixed yearly contribution (end-of-year), annual compounding.
function fvAnnual(contribution: number, years: number, ratePct: number): number {
  const r = ratePct / 100;
  if (r === 0) return contribution * years;
  return contribution * ((Math.pow(1 + r, years) - 1) / r);
}

const AFTERTAX_COLOR = theme.color.success;
const TAX_COLOR = '#C98A8A';

export function RothVsTraditionalPage() {
  const [outOfPocket, setOutOfPocket] = useState(6_000);
  const [years,       setYears]       = useState(30);
  const [annual,      setAnnual]      = useState(7);
  const [taxNow,      setTaxNow]      = useState(24);
  const [taxRet,      setTaxRet]      = useState(22);

  const r = useMemo(() => {
    // Equal out-of-pocket cost: $outOfPocket of take-home pay per year.
    // Roth uses after-tax dollars, so the Roth contribution IS the out-of-pocket amount.
    // A Traditional contribution is pre-tax, so the same take-home cost funds a larger
    // contribution: out / (1 - taxNow). This is the fair, apples-to-apples comparison.
    const rothContribution = outOfPocket;
    const tradContribution = outOfPocket / (1 - taxNow / 100);

    const rothBalance = fvAnnual(rothContribution, years, annual);   // tax-free at withdrawal
    const tradBalance = fvAnnual(tradContribution, years, annual);   // taxed at withdrawal
    const tradTax = tradBalance * (taxRet / 100);
    const tradAfterTax = tradBalance - tradTax;

    const diff = rothBalance - tradAfterTax;
    return {
      rothContribution, tradContribution,
      rothBalance, tradBalance, tradTax, tradAfterTax,
      diff, rothWins: diff >= 0,
      totalOutOfPocket: outOfPocket * years,
      chart: [
        { name: 'Roth IRA',        afterTax: Math.round(rothBalance),  tax: 0 },
        { name: 'Traditional IRA', afterTax: Math.round(tradAfterTax), tax: Math.round(tradTax) },
      ],
    };
  }, [outOfPocket, years, annual, taxNow, taxRet]);

  const winnerName = r.rothWins ? 'Roth IRA' : 'Traditional IRA';

  return (
    <ToolPage
      eyebrow="Calculator"
      title="Roth vs. Traditional IRA"
      subtitle="Both are powerful retirement accounts — the difference is when you pay taxes. A Roth is funded with after-tax dollars and grows tax-free; a Traditional gives you a deduction now and is taxed later. Here's how they compare for the same cost out of your take-home pay."
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>

        {/* ── Inputs ── */}
        <ToolCard title="Your Situation">
          <NumberInput label="Yearly Investment (from take-home pay)" value={outOfPocket} step={500} prefix="$" maxDigits={6} onChange={setOutOfPocket} />
          <SliderInput label="Years Until Retirement" value={years} min={1} max={45} step={1} format={v => v + ' yrs'} onChange={setYears} />
          <SliderInput label="Assumed Annual Return" value={annual} min={1} max={12} step={0.5} format={v => fmtPct(v, 1)} onChange={setAnnual} />
          <SliderInput label="Your Tax Rate Now" value={taxNow} min={0} max={50} step={1} format={v => v + '%'} onChange={setTaxNow} />
          <SliderInput label="Your Tax Rate in Retirement" value={taxRet} min={0} max={50} step={1} format={v => v + '%'} onChange={setTaxRet} />
          <div style={{ fontSize: 14, color: theme.color.textSubtle, marginTop: 4, lineHeight: 1.5 }}>
            Because a Traditional contribution is pre-tax, the same {fmtMoney(outOfPocket)} of take-home pay
            funds a larger Traditional deposit ({fmtMoney(r.tradContribution)}) than Roth ({fmtMoney(r.rothContribution)}).
            Real IRAs have <Link to="/resources/ira-contribution-limits" style={{ color: theme.color.primary, fontWeight: 600 }}>annual limits</Link>.
          </div>
        </ToolCard>

        {/* ── Results ── */}
        <ToolCard title="After-Tax Outcome">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ResultStat
              tone={r.rothWins ? 'success' : 'primary'} big
              label={`${winnerName} comes out ahead`}
              value={fmtCurrency(Math.abs(r.diff))}
              sub={`more spendable money in retirement, for the same cost today.`}
            />
            <StatList rows={[
              { label: 'Roth — spendable (tax-free)', value: fmtMoney(r.rothBalance) },
              { label: 'Traditional — balance (pre-tax)', value: fmtMoney(r.tradBalance) },
              { label: 'Traditional — tax at withdrawal', value: '−' + fmtMoney(r.tradTax) },
              { label: 'Traditional — spendable', value: fmtMoney(r.tradAfterTax) },
            ]} />
            <Callout tone="primary">
              Same cost out of pocket, so it comes down to one thing: your tax rate <strong>now ({taxNow}%)</strong> vs.
              <strong> in retirement ({taxRet}%)</strong>. Expect a lower rate later → Traditional wins; a higher rate
              later → Roth wins; the same → it's a tie.
            </Callout>
          </div>
        </ToolCard>
      </div>

      {/* ── Bar comparison ── */}
      <ToolCard title="What you actually get to spend">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={r.chart} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.color.border} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 13, fill: theme.color.text }} stroke={theme.color.borderStrong} />
            <YAxis
              tick={{ fontSize: 12, fill: theme.color.textMuted }}
              tickFormatter={(v: number) => (v >= 1000 ? '$' + Math.round(v / 1000) + 'K' : '$' + v)}
              stroke={theme.color.borderStrong} width={56}
            />
            <Tooltip
              contentStyle={chartTooltipStyle}
              formatter={(v: unknown, name: unknown) => [fmtMoney(Number(v)), name === 'afterTax' ? 'Spendable (after tax)' : 'Tax owed at withdrawal']}
            />
            <Legend
              formatter={(name: string) => (name === 'afterTax' ? 'Spendable (after tax)' : 'Tax owed at withdrawal')}
              wrapperStyle={{ fontSize: 13 }}
            />
            <Bar dataKey="afterTax" stackId="a" fill={AFTERTAX_COLOR} radius={[0, 0, 0, 0]} />
            <Bar dataKey="tax" stackId="a" fill={TAX_COLOR} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <CtaButton to="/open-account">Open an IRA with Bob's →</CtaButton>
          <span style={{ fontSize: 14, color: theme.color.textSubtle }}>
            The Traditional bar is taller, but the red slice is the IRS's share.
          </span>
        </div>
      </ToolCard>
    </ToolPage>
  );
}
