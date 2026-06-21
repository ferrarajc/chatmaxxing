import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
import { theme } from '../../../theme';
import { ToolPage, ToolCard, Callout, CtaButton, chartTooltipStyle } from '../../tools/ui';
import { useClientStore } from '../../../store/clientStore';

interface Question {
  id: string;
  q: string;
  options: { label: string; score: number }[];
}

const QUESTIONS: Question[] = [
  {
    id: 'horizon',
    q: 'When will you start needing this money?',
    options: [
      { label: 'Within 3 years', score: 0 },
      { label: '3–7 years', score: 1 },
      { label: '8–15 years', score: 2 },
      { label: '16–25 years', score: 3 },
      { label: 'More than 25 years', score: 4 },
    ],
  },
  {
    id: 'drop',
    q: 'Your portfolio drops 20% over a few months. You…',
    options: [
      { label: 'Sell everything to stop the losses', score: 0 },
      { label: 'Sell some to feel safer', score: 1 },
      { label: 'Do nothing and wait it out', score: 3 },
      { label: 'Invest more while prices are low', score: 4 },
    ],
  },
  {
    id: 'goal',
    q: 'What matters most for this money?',
    options: [
      { label: 'Protecting what I have', score: 0 },
      { label: 'Steady income', score: 1 },
      { label: 'A balance of growth and safety', score: 2 },
      { label: 'Maximizing long-term growth', score: 4 },
    ],
  },
  {
    id: 'age',
    q: 'How old are you?',
    options: [
      { label: '60 or older', score: 0 },
      { label: '50–59', score: 1 },
      { label: '40–49', score: 2 },
      { label: '30–39', score: 3 },
      { label: 'Under 30', score: 4 },
    ],
  },
  {
    id: 'experience',
    q: 'How would you describe your investing experience?',
    options: [
      { label: 'New to it', score: 0 },
      { label: 'Some experience', score: 1 },
      { label: 'Comfortable', score: 2 },
      { label: 'Very experienced', score: 3 },
    ],
  },
  {
    id: 'cushion',
    q: 'If your income stopped, how long could other savings cover your expenses?',
    options: [
      { label: 'Less than 3 months', score: 0 },
      { label: '3–6 months', score: 1 },
      { label: '6–12 months', score: 2 },
      { label: 'More than a year', score: 3 },
    ],
  },
];

const MAX_SCORE = QUESTIONS.reduce((s, q) => s + Math.max(...q.options.map(o => o.score)), 0);

interface Allocation { usPct: number; intlPct: number; bondPct: number; cashPct: number; blurb: string; }

const PROFILES: { name: string; max: number; alloc: Allocation }[] = [
  { name: 'Conservative', max: 20, alloc: { usPct: 20, intlPct: 10, bondPct: 55, cashPct: 15, blurb: 'Capital preservation first, with a cash cushion and modest growth.' } },
  { name: 'Moderate',     max: 40, alloc: { usPct: 33, intlPct: 17, bondPct: 45, cashPct: 5,  blurb: 'Stability-leaning, but with enough stocks to outpace inflation.' } },
  { name: 'Balanced',     max: 60, alloc: { usPct: 43, intlPct: 22, bondPct: 35, cashPct: 0,  blurb: 'A classic middle-of-the-road mix of growth and ballast.' } },
  { name: 'Growth',       max: 80, alloc: { usPct: 53, intlPct: 27, bondPct: 20, cashPct: 0,  blurb: 'Mostly stocks for long-term growth, with a bond buffer.' } },
  { name: 'Aggressive',   max: 101, alloc: { usPct: 63, intlPct: 32, bondPct: 5, cashPct: 0,  blurb: 'Built for maximum long-term growth — expect a bumpy ride.' } },
];

const SLICE_META = {
  us:   { name: 'BobsFunds Total Market',          ticker: 'BFTM', color: theme.color.primary },
  intl: { name: 'BobsFunds International',          ticker: 'BFIN', color: theme.color.accent },
  bond: { name: 'BobsFunds Bond Income',           ticker: 'BFBI', color: theme.color.success },
  cash: { name: 'BobsFunds Short-Term Treasury',   ticker: 'BFST', color: '#4A6FA5' },
} as const;

export function RiskQuizPage() {
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const answeredCount = QUESTIONS.filter(q => answers[q.id] !== undefined).length;
  const complete = answeredCount === QUESTIONS.length;

  const result = useMemo(() => {
    if (!complete) return null;
    const raw = QUESTIONS.reduce((s, q) => s + (answers[q.id] ?? 0), 0);
    const pct = (raw / MAX_SCORE) * 100;
    const profile = PROFILES.find(p => pct < p.max) ?? PROFILES[PROFILES.length - 1];
    const a = profile.alloc;
    const slices = [
      { ...SLICE_META.us,   pct: a.usPct },
      { ...SLICE_META.intl, pct: a.intlPct },
      { ...SLICE_META.bond, pct: a.bondPct },
      { ...SLICE_META.cash, pct: a.cashPct },
    ].filter(s => s.pct > 0);
    return { profile: profile.name, blurb: a.blurb, scorePct: Math.round(pct), stocksPct: a.usPct + a.intlPct, bondPct: a.bondPct, cashPct: a.cashPct, slices };
  }, [answers, complete]);

  const persona = useClientStore(s => s.activePersona);
  const saveSettings = useClientStore(s => s.saveAccountSettings);
  const [savedToProfile, setSavedToProfile] = useState(false);

  const saveToProfile = async () => {
    if (!result) return;
    const existing = persona.investorProfile;
    await saveSettings({
      investorProfile: {
        riskProfile: result.profile,
        riskScorePct: result.scorePct,
        stocksPct: result.stocksPct,
        bondPct: result.bondPct,
        cashPct: result.cashPct,
        slices: result.slices.map(s => ({ name: s.name, ticker: s.ticker, pct: s.pct })),
        // Preserve goals/suitability the customer entered on the account page.
        goals: existing?.goals ?? [],
        timeHorizon: existing?.timeHorizon ?? '',
        annualIncomeRange: existing?.annualIncomeRange ?? '',
        netWorthRange: existing?.netWorthRange ?? '',
        investmentExperience: existing?.investmentExperience ?? '',
        updatedAt: new Date().toISOString().slice(0, 10),
      },
    });
    setSavedToProfile(true);
    setTimeout(() => setSavedToProfile(false), 2500);
  };

  return (
    <ToolPage
      eyebrow="Quiz"
      title="Find Your Risk Profile"
      subtitle="Six quick questions to gauge how much risk fits your timeline and temperament — and a starting portfolio built from Bob's core funds. It's a conversation starter, not a recommendation."
      disclaimer="This quiz produces a general, educational starting point — not personalized investment advice or a recommendation to buy any specific fund. Your ideal mix depends on your full financial picture; consider speaking with a qualified advisor."
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 24, alignItems: 'start' }}>

        {/* ── Quiz ── */}
        <ToolCard title="A Few Questions">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {QUESTIONS.map((question, qi) => (
              <div key={question.id}>
                <div style={{ fontSize: 16, fontWeight: 700, color: theme.color.text, marginBottom: 10 }}>
                  <span style={{ color: theme.color.accent, marginRight: 8 }}>{qi + 1}.</span>{question.q}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {question.options.map(opt => {
                    const selected = answers[question.id] === opt.score;
                    return (
                      <button
                        key={opt.label}
                        onClick={() => setAnswers(a => ({ ...a, [question.id]: opt.score }))}
                        style={{
                          textAlign: 'left', cursor: 'pointer',
                          padding: '11px 16px', borderRadius: theme.radius.md,
                          border: `1.5px solid ${selected ? theme.color.primary : theme.color.border}`,
                          background: selected ? theme.color.primarySoft : theme.color.surface,
                          color: selected ? theme.color.primary : theme.color.text,
                          fontSize: 14, fontWeight: selected ? 600 : 500,
                          fontFamily: theme.font.sans, transition: 'border-color .12s, background .12s',
                          display: 'flex', alignItems: 'center', gap: 12,
                        }}
                        onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = theme.color.borderStrong; }}
                        onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = theme.color.border; }}
                      >
                        <span style={{
                          width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                          border: `2px solid ${selected ? theme.color.primary : theme.color.borderStrong}`,
                          background: selected ? theme.color.primary : 'transparent',
                          boxShadow: selected ? `inset 0 0 0 2px ${theme.color.surface}` : 'none',
                        }} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ToolCard>

        {/* ── Result ── */}
        <div style={{ position: 'sticky', top: 88 }}>
          <ToolCard title="Your Starting Mix">
            {!result ? (
              <div style={{ padding: '30px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 15, color: theme.color.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
                  Answer all six questions to see a suggested portfolio.
                </div>
                <div style={{ height: 8, background: theme.color.surfaceMuted, borderRadius: 999, overflow: 'hidden', border: `1px solid ${theme.color.border}` }}>
                  <div style={{ height: '100%', width: `${(answeredCount / QUESTIONS.length) * 100}%`, background: theme.color.accent, transition: 'width .25s' }} />
                </div>
                <div style={{ fontSize: 13, color: theme.color.textSubtle, marginTop: 8 }}>
                  {answeredCount} of {QUESTIONS.length} answered
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.color.accent, marginBottom: 4 }}>
                    Your profile
                  </div>
                  <div style={{ fontSize: 34, fontWeight: 800, fontFamily: theme.font.serif, color: theme.color.primary, lineHeight: 1 }}>
                    {result.profile}
                  </div>
                  <div style={{ fontSize: 14, color: theme.color.textMuted, marginTop: 8, lineHeight: 1.5 }}>
                    {result.blurb}
                  </div>
                  <div style={{ fontSize: 14, color: theme.color.text, marginTop: 10, fontWeight: 600 }}>
                    {result.stocksPct}% stocks · {result.bondPct}% bonds{result.cashPct > 0 ? ` · ${result.cashPct}% cash` : ''}
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={result.slices} cx="50%" cy="50%" innerRadius={52} outerRadius={84} dataKey="pct" stroke={theme.color.surface} strokeWidth={2}>
                      {result.slices.map(s => <Cell key={s.ticker} fill={s.color} />)}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v: unknown, _n: unknown, item: unknown) => [`${v}%`, (item as { payload?: { name?: string } })?.payload?.name ?? '']} />
                  </PieChart>
                </ResponsiveContainer>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.slices.map(s => (
                    <Link
                      key={s.ticker}
                      to={`/research/fund/${s.ticker}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
                        padding: '8px 10px', borderRadius: theme.radius.md, border: `1px solid ${theme.color.border}`,
                        background: theme.color.surface,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = theme.color.surfaceMuted)}
                      onMouseLeave={e => (e.currentTarget.style.background = theme.color.surface)}
                    >
                      <span style={{ width: 12, height: 12, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: theme.color.text, flex: 1 }}>{s.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: theme.color.accent, fontFamily: theme.font.mono }}>{s.ticker}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: theme.color.primary, fontVariantNumeric: 'tabular-nums', minWidth: 38, textAlign: 'right' }}>{s.pct}%</span>
                    </Link>
                  ))}
                </div>

                <Callout tone="neutral" style={{ fontSize: 13 }}>
                  A simple three- or four-fund mix like this is a complete, diversified portfolio. International
                  is held at roughly a third of stocks, in line with common planning guidelines.
                </Callout>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    onClick={saveToProfile}
                    style={{
                      background: savedToProfile ? theme.color.success : theme.color.primary,
                      color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.md,
                      padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: theme.font.sans,
                    }}
                  >
                    {savedToProfile ? '✓ Saved to profile' : 'Save to my profile'}
                  </button>
                  <CtaButton to="/research">Explore these funds →</CtaButton>
                  <button
                    onClick={() => setAnswers({})}
                    style={{
                      background: 'none', border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md,
                      padding: '10px 16px', fontSize: 14, fontWeight: 600, color: theme.color.textMuted,
                      cursor: 'pointer', fontFamily: theme.font.sans,
                    }}
                  >
                    Retake
                  </button>
                </div>
                <div style={{ fontSize: 12.5, color: theme.color.textSubtle, textAlign: 'center' }}>
                  Saving updates the Investor profile on your <Link to="/account" style={{ color: theme.color.primary }}>My Account</Link> page.
                </div>
              </div>
            )}
          </ToolCard>
        </div>
      </div>
    </ToolPage>
  );
}
