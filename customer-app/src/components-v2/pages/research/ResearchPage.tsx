import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FundDef, FundGroup } from '../../../data/funds';
import { useFunds } from '../../../hooks/useFunds';
import { useMarketData } from '../../../hooks/useMarketData';
import { theme } from '../../../theme';

// ── Family filter (top-level asset classes) ─────────────────────────────────

const GROUP_ORDER: FundGroup[] = ['US Equity', 'Sector Equity', 'International', 'Fixed Income'];

const GROUP_BLURB: Record<FundGroup, string> = {
  'US Equity':     'Broad-market, style-box, and dividend funds covering the U.S. stock market.',
  'Sector Equity': 'Targeted exposure to each of the eleven sectors of the U.S. economy.',
  'International':  'Developed, emerging, and regional markets outside the United States.',
  'Fixed Income':  'Treasury and corporate bond funds across the maturity spectrum.',
};

type FamilyFilter = 'All' | FundGroup;
const FAMILY_FILTERS: FamilyFilter[] = ['All', ...GROUP_ORDER];

// ── Sorting ─────────────────────────────────────────────────────────────────

type SortKey = 'name' | 'ytd' | 'oneYear' | 'threeYear' | 'fiveYear' | 'expenseRatio';
type SortDir = 'asc' | 'desc';

// ── Live-data shape we read per fund ────────────────────────────────────────

interface FundRow {
  fund: FundDef;
  ytd: number | null;
  oneYear: number | null;
  threeYear: number | null;
  fiveYear: number | null;
  expenseRatio: number;
}

// ── Small presentational helpers ────────────────────────────────────────────

function PerfValue({ value }: { value: number | null }) {
  if (value === null) {
    return <span style={{ color: theme.color.textSubtle, fontVariantNumeric: 'tabular-nums' }}>—</span>;
  }
  const color = value > 0 ? theme.color.success : value < 0 ? theme.color.danger : theme.color.textMuted;
  const txt = value > 0 ? `▲ ${value}%` : value < 0 ? `▼ ${Math.abs(value)}%` : `${value}%`;
  return <span style={{ color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{txt}</span>;
}

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span style={{ fontSize: 9, marginLeft: 4, opacity: active ? 1 : 0.25 }}>
      {active ? (dir === 'asc' ? '▲' : '▼') : '▽'}
    </span>
  );
}

// ── Column config ───────────────────────────────────────────────────────────

interface Column {
  key: SortKey;
  label: string;
  align: 'left' | 'right';
  // default sort direction when a user first clicks the column
  defaultDir: SortDir;
}

const COLUMNS: Column[] = [
  { key: 'name',         label: 'Fund',    align: 'left',  defaultDir: 'asc'  },
  { key: 'ytd',          label: 'YTD',     align: 'right', defaultDir: 'desc' },
  { key: 'oneYear',      label: '1-Year',  align: 'right', defaultDir: 'desc' },
  { key: 'threeYear',    label: '3-Year',  align: 'right', defaultDir: 'desc' },
  { key: 'fiveYear',     label: '5-Year',  align: 'right', defaultDir: 'desc' },
  { key: 'expenseRatio', label: 'Expense', align: 'right', defaultDir: 'asc'  },
];

const th: React.CSSProperties = {
  padding: '10px 14px', fontSize: 11, fontWeight: 700, color: theme.color.textSubtle,
  textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', userSelect: 'none',
  borderBottom: `1px solid ${theme.color.border}`, background: theme.color.surfaceMuted,
};
const td: React.CSSProperties = {
  padding: '12px 14px', fontSize: 13, borderBottom: `1px solid ${theme.color.border}`,
  fontVariantNumeric: 'tabular-nums',
};

// ── Fund row ────────────────────────────────────────────────────────────────

function FundTableRow({ row }: { row: FundRow }) {
  const { fund } = row;
  const [nameHover, setNameHover] = useState(false);
  return (
    <tr>
      <td
        style={{ ...td, textAlign: 'left', cursor: 'pointer', background: nameHover ? theme.color.surfaceMuted : 'transparent', transition: 'background .12s' }}
        onMouseEnter={() => setNameHover(true)}
        onMouseLeave={() => setNameHover(false)}
      >
        <Link
          to={`/research/fund/${fund.ticker}`}
          style={{ textDecoration: 'none', display: 'block' }}
        >
          <span style={{
            fontWeight: 600, fontSize: 14, color: nameHover ? theme.color.primary : theme.color.text,
            fontFamily: theme.font.serif, letterSpacing: '-0.01em',
          }}>
            {fund.name}
          </span>
          <span style={{ display: 'block', fontSize: 11, color: theme.color.textMuted, marginTop: 2 }}>
            {fund.category}
          </span>
        </Link>
      </td>
      <td style={{ ...td, textAlign: 'left', width: 1, whiteSpace: 'nowrap' }}>
        <Link
          to={`/research/fund/${fund.ticker}`}
          style={{
            fontWeight: 700, fontSize: 12, color: theme.color.accent, fontFamily: theme.font.mono,
            letterSpacing: '0.04em', background: theme.color.accentSoft, padding: '3px 8px',
            borderRadius: theme.radius.sm, textDecoration: 'none',
          }}
        >
          {fund.ticker}
        </Link>
      </td>
      <td style={{ ...td, textAlign: 'right' }}><PerfValue value={row.ytd} /></td>
      <td style={{ ...td, textAlign: 'right' }}><PerfValue value={row.oneYear} /></td>
      <td style={{ ...td, textAlign: 'right' }}><PerfValue value={row.threeYear} /></td>
      <td style={{ ...td, textAlign: 'right' }}><PerfValue value={row.fiveYear} /></td>
      <td style={{ ...td, textAlign: 'right', color: theme.color.text, fontWeight: 600 }}>
        {row.expenseRatio}%
      </td>
      <td style={{ ...td, textAlign: 'right', width: 1, whiteSpace: 'nowrap' }}>
        <Link
          to={`/research/fund/${fund.ticker}/buy`}
          style={{
            fontSize: 12, fontWeight: 600, color: theme.color.primary,
            border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.sm,
            padding: '5px 12px', textDecoration: 'none', whiteSpace: 'nowrap',
            background: 'transparent',
          }}
        >
          Buy →
        </Link>
      </td>
    </tr>
  );
}

// ── Table head (shared, sortable) ───────────────────────────────────────────

function TableHead({
  sortKey, sortDir, onSort,
}: { sortKey: SortKey | null; sortDir: SortDir; onSort: (c: Column) => void }) {
  // Body rows have 8 cells: Fund · Ticker · YTD · 1Y · 3Y · 5Y · Expense · Buy.
  // The Ticker and Buy cells have no sortable header, so we render empty <th>
  // placeholders for them to keep column counts aligned.
  const [nameCol, ...rest] = COLUMNS; // nameCol === Fund; rest === perf + expense
  const headerCell = (col: Column) => (
    <th
      key={col.key}
      onClick={() => onSort(col)}
      style={{ ...th, textAlign: col.align, cursor: 'pointer' }}
    >
      {col.label}
      <SortArrow active={sortKey === col.key} dir={sortKey === col.key ? sortDir : col.defaultDir} />
    </th>
  );
  return (
    <thead>
      <tr>
        {headerCell(nameCol)}
        <th style={th} aria-hidden="true" />{/* Ticker */}
        {rest.map(headerCell)}
        <th style={th} aria-hidden="true" />{/* Buy */}
      </tr>
    </thead>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export function ResearchPage() {
  const { funds } = useFunds();
  const { data: marketData } = useMarketData();
  const [family, setFamily] = useState<FamilyFilter>('All');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Build a row (fund + live data) for every fund.
  const rows: FundRow[] = useMemo(() => funds.map(fund => {
    const live = marketData?.funds.find(f => f.ticker === fund.ticker);
    return {
      fund,
      ytd:       live?.ytd       ?? null,
      oneYear:   live?.oneYear   ?? null,
      threeYear: live?.threeYear ?? null,
      fiveYear:  live?.fiveYear  ?? null,
      expenseRatio: live?.expenseRatio ?? fund.expenseRatio,
    };
  }), [funds, marketData]);

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => rows.filter(r => {
    if (family !== 'All' && r.fund.group !== family) return false;
    if (!q) return true;
    return (
      r.fund.name.toLowerCase().includes(q) ||
      r.fund.ticker.toLowerCase().includes(q) ||
      r.fund.category.toLowerCase().includes(q)
    );
  }), [rows, family, q]);

  function sortRows(list: FundRow[]): FundRow[] {
    if (!sortKey) return list;
    const dir = sortDir === 'asc' ? 1 : -1;
    const val = (r: FundRow): number | string => {
      switch (sortKey) {
        case 'name':         return r.fund.name.toLowerCase();
        case 'expenseRatio': return r.expenseRatio;
        // null perf values always sink to the bottom regardless of direction
        case 'ytd':       return r.ytd       ?? (sortDir === 'asc' ?  Infinity : -Infinity);
        case 'oneYear':   return r.oneYear   ?? (sortDir === 'asc' ?  Infinity : -Infinity);
        case 'threeYear': return r.threeYear ?? (sortDir === 'asc' ?  Infinity : -Infinity);
        case 'fiveYear':  return r.fiveYear  ?? (sortDir === 'asc' ?  Infinity : -Infinity);
      }
    };
    return [...list].sort((a, b) => {
      const av = val(a), bv = val(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return  1 * dir;
      return a.fund.name.localeCompare(b.fund.name);
    });
  }

  function handleSort(col: Column) {
    if (sortKey === col.key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col.key);
      setSortDir(col.defaultDir);
    }
  }

  // Grouped view only when nothing is narrowing/reordering the list.
  const grouped = sortKey === null && family === 'All' && q === '';

  const tableWrap: React.CSSProperties = {
    background: theme.color.surface, borderRadius: theme.radius.lg,
    border: `1px solid ${theme.color.border}`, boxShadow: theme.shadow.sm,
    overflow: 'hidden',
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ margin: '0 0 10px', fontSize: 32, fontWeight: 600, color: theme.color.text, fontFamily: theme.font.serif, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        Fund Research
      </h1>
      <p style={{ margin: '0 0 28px', color: theme.color.textMuted, fontSize: 15, lineHeight: 1.55 }}>
        Explore our full lineup of {funds.length} low-cost mutual funds — index, sector, international, and bond strategies.
      </p>

      {/* Controls: search + family filter */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: '1 1 280px', minWidth: 220 }}>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.color.textMuted}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, ticker, or category…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 14px 10px 36px', fontSize: 14,
              border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.pill,
              background: theme.color.surface, color: theme.color.text, fontFamily: theme.font.sans,
              outline: 'none',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {FAMILY_FILTERS.map(f => {
          const count = f === 'All' ? funds.length : funds.filter(x => x.group === f).length;
          const active = family === f;
          return (
            <button
              key={f}
              onClick={() => setFamily(f)}
              style={{
                padding: '6px 14px', borderRadius: theme.radius.pill, fontSize: 13, fontWeight: 500,
                border: '1px solid',
                borderColor: active ? theme.color.primary : theme.color.borderStrong,
                background: active ? theme.color.primary : theme.color.surface,
                color: active ? theme.color.textOnPrimary : theme.color.textMuted,
                cursor: 'pointer', transition: 'all .15s', fontFamily: theme.font.sans, letterSpacing: '0.01em',
              }}
            >
              {f} <span style={{ opacity: 0.6, fontWeight: 600 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div style={{ ...tableWrap, padding: '48px 24px', textAlign: 'center', color: theme.color.textMuted, fontSize: 14 }}>
          No funds match “{query}”.
        </div>
      ) : grouped ? (
        // ── Grouped by family ──
        GROUP_ORDER.map(group => {
          const groupRows = sortRows(filtered.filter(r => r.fund.group === group));
          if (groupRows.length === 0) return null;
          return (
            <section key={group} style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: theme.color.text, fontFamily: theme.font.serif, letterSpacing: '-0.01em' }}>
                  {group}
                </h2>
                <span style={{ fontSize: 12, color: theme.color.textSubtle, fontWeight: 600 }}>{groupRows.length} funds</span>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: theme.color.textMuted, lineHeight: 1.5 }}>
                {GROUP_BLURB[group]}
              </p>
              <div style={{ ...tableWrap, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                  <TableHead sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <tbody>
                    {groupRows.map(r => <FundTableRow key={r.fund.ticker} row={r} />)}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      ) : (
        // ── Flat sorted/filtered list ──
        <>
          <div style={{ fontSize: 12, color: theme.color.textSubtle, marginBottom: 10, fontWeight: 600 }}>
            {filtered.length} {filtered.length === 1 ? 'fund' : 'funds'}
          </div>
          <div style={{ ...tableWrap, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <TableHead sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <tbody>
                {sortRows(filtered).map(r => <FundTableRow key={r.fund.ticker} row={r} />)}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
