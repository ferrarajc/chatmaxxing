import React from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../../../theme';
import { ContributionSummary, ContributionYear, SepBucket } from '../../../hooks/useContributions';

// Contributions card for an IRA account page.
//
// The headline number is deliberately NOT this account's contributions — the IRS applies
// the annual limit across ALL of a person's Traditional and Roth IRAs combined, so the
// figure is portfolio-wide and the per-account breakdown below it shows where it came
// from. That is the whole point of the card, and why the numbers are computed once on
// the server (lambda/shared/contributions.ts) rather than derived here: the chatbot and
// the phone cockpit quote the same values from the same place.
//
// A SEP-IRA is a separate bucket with its own, much larger limit, and its remaining room
// depends on compensation we do not hold — so it shows what was contributed and says
// plainly that the remaining amount cannot be computed, rather than inventing one.

const cardStyle: React.CSSProperties = {
  background: theme.color.surface,
  borderRadius: theme.radius.lg,
  padding: 24,
  marginBottom: 24,
  boxShadow: theme.shadow.sm,
  border: `1px solid ${theme.color.border}`,
};

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "2027-04-15" -> "April 15, 2027" */
function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[m - 1]} ${d}, ${y}`;
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' }) {
  return (
    <div style={{ background: theme.color.surfaceMuted, borderRadius: 8, padding: '12px 16px' }}>
      <div style={{ fontSize: 11, color: theme.color.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{
        fontSize: 20, fontWeight: 700,
        color: tone === 'good' ? theme.color.success : tone === 'warn' ? theme.color.danger : theme.color.text,
      }}>{value}</div>
    </div>
  );
}

function ContributeButton({ accountId }: { accountId: string }) {
  // Sends the client to the fund lineup with the destination account attached, rather
  // than picking a fund for them — choosing an investment is an advisor's job, not ours.
  // ResearchPage and FundProfilePage carry `?account=` through to the buy screen, where
  // it lands preselected.
  return (
    <Link
      to={`/research?account=${encodeURIComponent(accountId)}`}
      style={{
        display: 'inline-block', padding: '8px 18px', background: theme.color.primary,
        color: theme.color.textOnPrimary, borderRadius: theme.radius.md,
        textDecoration: 'none', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >
      Contribute →
    </Link>
  );
}

function YearBlock({ year, accountId, showDivider }: {
  year: ContributionYear;
  accountId: string;
  showDivider: boolean;
}) {
  const pct = year.limit > 0
    ? Math.min(100, Math.round((year.contributed / year.limit) * 100))
    : 0;
  const canContribute = year.stillOpen && year.remaining > 0 && !year.overLimit;

  return (
    <div style={showDivider ? { marginTop: 24, paddingTop: 24, borderTop: `1px solid ${theme.color.border}` } : undefined}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{year.taxYear} tax year</div>
          <div style={{ fontSize: 12, color: theme.color.textMuted, marginTop: 2 }}>
            All your Traditional and Roth IRAs combined
            {year.catchUp > 0 && ` · includes the ${money(year.catchUp)} catch-up (age ${year.ageAtYearEnd})`}
          </div>
        </div>
        {canContribute && <ContributeButton accountId={accountId} />}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
        <Tile label="Contributed" value={money(year.contributed)} />
        <Tile label="Annual limit" value={money(year.limit)} />
        <Tile
          label={year.overLimit ? 'Over by' : 'Remaining'}
          value={year.overLimit ? money(year.contributed - year.limit) : money(year.remaining)}
          tone={year.overLimit ? 'warn' : year.remaining > 0 ? 'good' : undefined}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, background: theme.color.border, borderRadius: 99, height: 8 }}>
          <div style={{
            width: `${pct}%`, height: '100%', borderRadius: 99, transition: 'width 0.3s',
            background: year.overLimit ? theme.color.danger : pct === 100 ? theme.color.success : theme.color.primary,
          }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, minWidth: 36 }}>{pct}%</span>
      </div>

      {/* Only informative with more than one contributing account — otherwise it just
          restates the Contributed tile. With two it is the proof that the limit is
          shared across accounts, which is the point of the card. */}
      {year.byAccount.length > 1 && (
        <div style={{ fontSize: 13, color: theme.color.textMuted, marginBottom: 6 }}>
          {year.byAccount.map(a => `${a.type} ${money(a.amount)}`).join(' · ')}
        </div>
      )}

      {year.scheduled > 0 && (
        <div style={{ fontSize: 13, color: theme.color.textMuted, marginBottom: 6 }}>
          A further {money(year.scheduled)} is already scheduled from your automatic investments.
        </div>
      )}

      {year.overLimit && (
        <div style={{
          fontSize: 13, color: theme.color.warning, background: theme.color.warningSoft,
          border: `1px solid ${theme.color.warningBorder}`, borderRadius: 8, padding: '8px 12px', marginTop: 8,
        }}>
          You have contributed more than the {year.taxYear} limit. An excess contribution is taxed at
          6% for each year it stays in the account — it is fixed by withdrawing the excess plus any
          earnings before your filing deadline.{' '}
          <Link to="/resources/ira-contribution-limits" style={{ color: theme.color.warning, fontWeight: 600 }}>
            What to do →
          </Link>
        </div>
      )}

      <div style={{ fontSize: 12, color: theme.color.textSubtle, marginTop: 8 }}>
        {year.stillOpen
          ? `You can contribute for ${year.taxYear} until ${longDate(year.deadline)}.`
          : `The deadline to contribute for ${year.taxYear} passed on ${longDate(year.deadline)}.`}
        {year.limitEstimated && ' The IRS has not published this year’s figures yet, so the most recent published limit is shown.'}
      </div>
    </div>
  );
}

function SepBlock({ bucket, accountId, showDivider }: {
  bucket: SepBucket;
  accountId: string;
  showDivider: boolean;
}) {
  return (
    <div style={showDivider ? { marginTop: 24, paddingTop: 24, borderTop: `1px solid ${theme.color.border}` } : undefined}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{bucket.taxYear} SEP-IRA</div>
          <div style={{ fontSize: 12, color: theme.color.textMuted, marginTop: 2 }}>
            A separate limit — SEP contributions do not count against your Traditional/Roth limit
          </div>
        </div>
        {bucket.stillOpen && <ContributeButton accountId={accountId} />}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 12 }}>
        <Tile label="Contributed" value={money(bucket.contributed)} />
        <Tile label="IRS maximum" value={money(bucket.dcCap)} />
      </div>

      {bucket.byAccount.length > 1 && (
        <div style={{ fontSize: 13, color: theme.color.textMuted, marginBottom: 6 }}>
          {bucket.byAccount.map(a => `${a.type} ${money(a.amount)}`).join(' · ')}
        </div>
      )}

      {bucket.scheduled > 0 && (
        <div style={{ fontSize: 13, color: theme.color.textMuted, marginBottom: 6 }}>
          A further {money(bucket.scheduled)} is already scheduled from your automatic investments.
        </div>
      )}

      <div style={{ fontSize: 13, color: theme.color.textMuted, lineHeight: 1.5 }}>
        Your SEP limit is 25% of your compensation, up to {money(bucket.dcCap)}. We do not hold your
        compensation, so we cannot show your exact remaining amount — your accountant can compute it.{' '}
        <Link to="/resources/sep-ira-vs-solo" style={{ color: theme.color.primary, fontWeight: 500 }}>
          How SEP limits work →
        </Link>
      </div>

      <div style={{ fontSize: 12, color: theme.color.textSubtle, marginTop: 8 }}>
        {bucket.stillOpen
          ? `You can contribute for ${bucket.taxYear} until ${longDate(bucket.deadline)} — your filing deadline including extensions.`
          : `The deadline to contribute for ${bucket.taxYear} passed on ${longDate(bucket.deadline)}.`}
      </div>
    </div>
  );
}

export function ContributionsCard({ summary, loading, error, accountId, isSepAccount }: {
  summary: ContributionSummary | null;
  loading: boolean;
  error: string | null;
  accountId: string;
  isSepAccount: boolean;
}) {
  // A SEP page shows its own bucket first, then the personal Traditional/Roth bucket
  // underneath — that limit is cross-account, so it belongs there too when the client
  // also holds a Roth or Traditional IRA.
  const blocks: React.ReactNode[] = [];
  if (summary) {
    const years = summary.years.map((y, i) => (
      <YearBlock key={`y-${y.taxYear}`} year={y} accountId={accountId} showDivider={isSepAccount || i > 0} />
    ));
    const seps = summary.sep.map((b, i) => (
      <SepBlock key={`s-${b.taxYear}`} bucket={b} accountId={accountId} showDivider={i > 0} />
    ));
    blocks.push(...(isSepAccount ? [...seps, ...years] : [...years, ...seps]));
  }

  return (
    <div style={cardStyle}>
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{
          margin: 0, fontSize: 18, position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          fontFamily: theme.font.serif, whiteSpace: 'nowrap',
        }}>
          Contributions
        </h2>
        <Link to="/resources/ira-contribution-limits" style={{ fontSize: 13, color: theme.color.primary, textDecoration: 'none', fontWeight: 500 }}>
          Contribution rules →
        </Link>
      </div>

      {loading && <div style={{ fontSize: 13, color: theme.color.textMuted }}>Loading…</div>}
      {error && <div style={{ fontSize: 13, color: theme.color.danger }}>Could not load contributions — {error}</div>}

      {!loading && !error && summary && blocks.length === 0 && (
        <div style={{ fontSize: 13, color: theme.color.textMuted, fontStyle: 'italic', padding: '8px 0' }}>
          No contribution limit applies to this account.
        </div>
      )}

      {blocks}

      {!loading && !error && summary && blocks.length > 0 && (
        <div style={{
          fontSize: 11, color: theme.color.textSubtle, lineHeight: 1.55,
          marginTop: 20, paddingTop: 14, borderTop: `1px solid ${theme.color.border}`,
        }}>
          {summary.assumptions.map((a, i) => <div key={i} style={{ marginBottom: 3 }}>{a}</div>)}
        </div>
      )}
    </div>
  );
}
