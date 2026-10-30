// Generates one library page per fund from the canonical catalog
// (customer-app/src/data/funds.ts), in the same line markup as library-src/*.txt.
// Facts come only from the catalog so the library can never drift from what the
// portal and the task experts quote; the prose around them is per-group guidance.

const pct = n => `${n}%`;
const money = n => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const GROUP_NOTES = {
  'US Equity': [
    'This is a U.S. stock fund. Its value moves with the U.S. stock market and can fall significantly over short periods; the 2022 row in the return table shows what a difficult year looks like. Clients who ask "is it safe" should hear, factually, that stock funds carry market risk and that the fund\'s risk level is published as part of its profile. Do not characterize the fund as appropriate or inappropriate for the client.',
    'Because the fund holds stocks, most of its distributions are dividends paid by the underlying companies. Capital gain distributions are possible, usually in December, but index funds with low turnover rarely distribute large gains.',
  ],
  'Sector Equity': [
    'This is a sector fund: it concentrates on a single part of the U.S. economy. Sector funds can move very differently from the broad market, both up and down, and are typically used as a smaller tilt alongside a diversified core rather than as a complete portfolio. Say this as a description of how the product is designed, never as a recommendation.',
    'Clients sometimes pick a sector fund after reading news about that industry. You may explain what the fund holds and point to its risk level and return history, but you may not say whether now is a good time to buy or sell. See [[investment-advice-boundary]].',
  ],
  'International': [
    'This fund invests outside the United States, so its returns reflect both foreign stock prices and currency movements. When the U.S. dollar strengthens, the dollar value of foreign holdings falls, and vice versa. International funds may pay foreign taxes on their dividends; in a taxable account the client may be able to claim a foreign tax credit (see [[foreign-tax-credit]]).',
    'International funds in the lineup distribute semiannually (June and December) rather than quarterly. Clients who expect a quarterly dividend should be told this is normal for the fund.',
  ],
  'Fixed Income': [
    'This is a bond fund. Its price moves inversely with interest rates: when rates rise, existing bonds lose value, and the longer the fund\'s duration the larger the move. Duration is listed in the profile table; a duration of 6 years means roughly a 6% price decline for a 1 percentage-point rise in rates, all else equal. See [[bonds-and-interest-rates]] and [[duration]].',
    'Bond funds in the lineup pay income monthly. The fund\'s yield is not guaranteed and changes as the underlying bonds and market rates change. A bond fund is not a bank deposit and is not FDIC insured; it can lose value.',
  ],
};

function fundPage(f, all) {
  const body = [];
  const ret = f.annualReturns;
  const best = ret.reduce((a, b) => (b.pct > a.pct ? b : a));
  const worst = ret.reduce((a, b) => (b.pct < a.pct ? b : a));
  const peers = all.filter(o => o.group === f.group && o.ticker !== f.ticker).slice(0, 6);

  body.push(`## At a glance`);
  body.push(`| Field | Value |`);
  body.push(`| Ticker | ${f.ticker} |`);
  body.push(`| Full name | ${f.name} |`);
  body.push(`| Fund group | ${f.group} |`);
  body.push(`| Category | ${f.category} |`);
  body.push(`| Benchmark | ${f.benchmark} |`);
  body.push(`| Expense ratio | ${pct(f.expenseRatio)} per year |`);
  body.push(`| Minimum initial investment | ${money(f.minInvestment)} |`);
  body.push(`| Published risk level | ${f.riskLevel} |`);
  body.push(`| Number of holdings | ${f.numHoldings.toLocaleString()} |`);
  body.push(`| Turnover rate | ${pct(f.turnoverRate)} |`);
  body.push(`| Distribution frequency | ${f.distributionFrequency} |`);
  body.push(`| Trailing 12-month distribution yield | ${pct(f.yield)} |`);
  if (f.beta !== null) body.push(`| Beta (vs. S&P 500) | ${f.beta} |`);
  if (f.stdDev !== null) body.push(`| Standard deviation (3-year, annualized) | ${pct(f.stdDev)} |`);
  if (f.peRatio !== null) body.push(`| Portfolio P/E ratio | ${f.peRatio} |`);
  if (f.pbRatio !== null) body.push(`| Portfolio P/B ratio | ${f.pbRatio} |`);
  if (f.medianMarketCapB !== null) body.push(`| Median market cap | $${f.medianMarketCapB} billion |`);
  if (f.avgDuration !== null) body.push(`| Average duration | ${f.avgDuration} years |`);
  if (f.styleBox) body.push(`| Style box | ${f.styleBox.size} ${f.styleBox.style} |`);
  body.push('');
  body.push(`Figures on this page come from the fund catalog that also drives the client portal's Research pages and the chat assistants, so what you read here matches what the client sees. The NAV (price per share) changes every business day and is not listed here; quote the current NAV from the fund's Research page in the portal. Expense ratios here are the current prospectus figures. If a client cites a different expense ratio from an older document, the current prospectus figure governs.`);
  body.push('');

  body.push(`## What the fund does`);
  body.push(f.description);
  body.push('');
  body.push(f.longDescription);
  body.push('');
  body.push(`In plain terms for a client: ${f.name} (${f.ticker}) is a ${f.category.toLowerCase()} fund in our ${f.group} lineup. It ${f.turnoverRate <= 15 ? 'is managed to track its benchmark, the ' + f.benchmark + ', and trades relatively little (turnover of ' + f.turnoverRate + '%)' : 'tracks the ' + f.benchmark + '; its turnover of ' + f.turnoverRate + '% is typical for a bond index fund because bonds mature and are replaced'}, holds about ${f.numHoldings.toLocaleString()} securities, and costs ${pct(f.expenseRatio)} a year, which is $${(f.expenseRatio * 100).toFixed(0)} per year on every $10,000 invested.`);
  body.push('');

  body.push(`## ${f.allocationLabel}`);
  body.push(`| Segment | Share of fund |`);
  for (const s of f.sectorAllocation) body.push(`| ${s.name} | ${pct(s.pct)} |`);
  body.push('');
  body.push(`Allocations shift over time as markets move and the benchmark rebalances. Treat these weights as approximate and current as of the most recent catalog update.`);
  body.push('');

  body.push(`## Calendar-year total returns`);
  body.push(`| Year | Total return |`);
  for (const r of ret) body.push(`| ${r.year} | ${r.pct > 0 ? '+' : ''}${pct(r.pct)} |`);
  body.push('');
  body.push(`Over the years shown, the best calendar year was ${best.year} (${best.pct > 0 ? '+' : ''}${pct(best.pct)}) and the weakest was ${worst.year} (${pct(worst.pct)}). Total return includes reinvested distributions. Always pair any performance figure with the reminder that past performance does not guarantee future results. For year-to-date and trailing returns, use the fund's Research page in the portal, which is refreshed nightly. See [[performance-reporting]].`);
  body.push('');

  body.push(`## Recent distributions`);
  body.push(`| Date | Type | Amount per share |`);
  for (const d of f.distributions) body.push(`| ${d.date} | ${d.type} | $${d.amount.toFixed(3)} |`);
  body.push('');
  body.push(`${f.name} pays distributions ${f.distributionFrequency.toLowerCase()}. With dividend reinvestment (DRIP) on, which is the default, each distribution buys additional shares at that day's NAV. With DRIP off, the cash goes to the account's cash balance or the client's bank, depending on their dividend preference. See [[drip]] and [[distribution-calendar]].`);
  body.push('');

  body.push(`## Servicing notes`);
  for (const n of GROUP_NOTES[f.group]) body.push(n, '');
  body.push(`- Buying, selling, and exchanging ${f.ticker} follow the standard rules: orders in good order before 4:00 PM Eastern receive that day's NAV. See [[trade-cutoff-nav]].`);
  body.push(`- There is no purchase fee, redemption fee, or sales load on ${f.ticker}. The only cost is the ${pct(f.expenseRatio)} expense ratio, which is deducted inside the fund and reflected in the NAV, never billed to the account.`);
  body.push(`- ${f.ticker} can be held in every account type we offer: individual, joint, custodial, trust, Traditional IRA, Roth IRA, SEP-IRA, and inherited IRA.`);
  body.push(`- Automatic investment plans into ${f.ticker} require at least $50 per investment. See [[automatic-investing-overview]].`);
  body.push(`- The prospectus, SAI, and shareholder reports for ${f.ticker} are in the fund document library. See [[prospectus]].`);
  body.push('');

  body.push(`## Questions clients ask about ${f.ticker}`);
  body.push(`### "Is ${f.ticker} a good investment?" / "Should I buy it?"`);
  body.push(`You cannot answer this. It is a request for a recommendation. Describe the fund factually (objective, risk level, cost, history) and offer a referral to a licensed financial advisor if the client wants guidance. Use the language in [[advice-decline-scripts]].`);
  body.push(`### "How much does ${f.ticker} cost?"`);
  body.push(`${pct(f.expenseRatio)} a year, with no transaction fees. On a $25,000 balance that is about $${(25000 * f.expenseRatio / 100).toFixed(2)} a year, taken gradually inside the fund rather than charged to the account.`);
  body.push(`### "Why did ${f.ticker} go down?"`);
  body.push(`Explain the fund's market exposure in neutral terms (for this fund: ${f.group === 'Fixed Income' ? 'interest-rate and credit movements' : f.group === 'International' ? 'foreign stock markets and currency movements' : f.group === 'Sector Equity' ? 'the ' + f.category.toLowerCase() + ' sector' : 'the U.S. stock market'}). If the drop coincides with a distribution date, the NAV falls by the amount distributed; the client has not lost value if they reinvested. See [[fund-value-dropped]].`);
  body.push(`### "What's in it?"`);
  body.push(`Quote the allocation table above and the holdings count (${f.numHoldings.toLocaleString()}). The client portal's Research page lists top holdings.`);
  body.push('');

  body.push(`## Related funds in the ${f.group} group`);
  for (const o of peers) body.push(`- [[fund-${o.ticker.toLowerCase()}|${o.name} (${o.ticker})]]: ${o.category}, expense ratio ${pct(o.expenseRatio)}, risk ${o.riskLevel}`);
  body.push('');
  body.push(`For the full lineup, see [[fund-lineup-overview]]. To compare funds side by side with a client, see [[fund-comparison-guide]].`);

  return {
    slug: `fund-${f.ticker.toLowerCase()}`,
    title: `${f.name} (${f.ticker})`,
    summary: `Fund profile: ${f.category}, ${f.group}. Expense ratio ${pct(f.expenseRatio)}, risk level ${f.riskLevel}, ${f.distributionFrequency.toLowerCase()} distributions.`,
    body,
  };
}

export function fundSection(funds) {
  return funds.map(f => fundPage(f, funds));
}
