export interface AllocationSlice { name: string; pct: number; }
export interface Distribution { date: string; type: 'Dividend' | 'Capital Gain'; amount: number; }

export interface FundDef {
  ticker: string;
  realSymbol: string;
  name: string;
  category: string;
  description: string;
  longDescription: string;
  expenseRatio: number;
  minInvestment: number;
  benchmark: string;
  riskLevel: 'Low' | 'Low–Medium' | 'Medium' | 'Medium–High' | 'High';
  numHoldings: number;
  turnoverRate: number;
  distributionFrequency: string;
  allocationLabel: string;
  sectorAllocation: AllocationSlice[];
  distributions: Distribution[];
}

export const FUNDS: FundDef[] = [
  {
    ticker: 'BF500',
    realSymbol: 'VOO',
    name: 'BobsFunds 500 Index',
    category: 'Large Cap Blend',
    description: 'Tracks the performance of 500 large-cap US companies.',
    longDescription:
      'Provides broad exposure to the 500 largest U.S. companies by market capitalization. Passively managed to track the S&P 500 Index, this fund is the cornerstone of a well-diversified portfolio, offering extremely low cost and consistent long-term market returns.',
    expenseRatio: 0.03,
    minInvestment: 1,
    benchmark: 'S&P 500 Index',
    riskLevel: 'Medium',
    numHoldings: 503,
    turnoverRate: 2,
    distributionFrequency: 'Quarterly',
    allocationLabel: 'Sector Allocation',
    sectorAllocation: [
      { name: 'Information Technology', pct: 32.4 },
      { name: 'Financials',             pct: 13.2 },
      { name: 'Healthcare',             pct: 11.5 },
      { name: 'Consumer Discretionary', pct: 10.1 },
      { name: 'Communication Services', pct: 8.8  },
      { name: 'Industrials',            pct: 8.5  },
      { name: 'Other',                  pct: 15.5 },
    ],
    distributions: [
      { date: '2026-03-25', type: 'Dividend',     amount: 1.636 },
      { date: '2025-12-23', type: 'Dividend',     amount: 1.587 },
      { date: '2025-12-23', type: 'Capital Gain', amount: 0.291 },
      { date: '2025-09-25', type: 'Dividend',     amount: 1.484 },
      { date: '2025-06-25', type: 'Dividend',     amount: 1.499 },
    ],
  },
  {
    ticker: 'BFGR',
    realSymbol: 'VUG',
    name: 'BobsFunds Growth',
    category: 'Large Cap Growth',
    description: 'High-growth US companies with strong earnings momentum.',
    longDescription:
      'Focuses on large-capitalization U.S. companies that exhibit growth characteristics, including above-average earnings expansion, sales growth, and return on equity. Designed to capture outperformance during bull markets while maintaining broad diversification across sectors.',
    expenseRatio: 0.04,
    minInvestment: 1,
    benchmark: 'CRSP US Large Cap Growth Index',
    riskLevel: 'Medium–High',
    numHoldings: 235,
    turnoverRate: 3,
    distributionFrequency: 'Quarterly',
    allocationLabel: 'Sector Allocation',
    sectorAllocation: [
      { name: 'Information Technology', pct: 54.5 },
      { name: 'Consumer Discretionary', pct: 13.8 },
      { name: 'Communication Services', pct: 10.2 },
      { name: 'Industrials',            pct: 8.9  },
      { name: 'Healthcare',             pct: 7.4  },
      { name: 'Other',                  pct: 5.2  },
    ],
    distributions: [
      { date: '2026-03-25', type: 'Dividend', amount: 0.293 },
      { date: '2025-12-23', type: 'Dividend', amount: 0.281 },
      { date: '2025-09-25', type: 'Dividend', amount: 0.242 },
      { date: '2025-06-25', type: 'Dividend', amount: 0.251 },
    ],
  },
  {
    ticker: 'BFBI',
    realSymbol: 'BND',
    name: 'BobsFunds Bond Income',
    category: 'Intermediate Bond',
    description: 'Investment-grade corporate and government bonds.',
    longDescription:
      'Tracks the investment performance of the U.S. investment-grade bond market, providing balanced exposure to U.S. government bonds, corporate bonds, and mortgage-backed securities. An effective volatility buffer and income source within a diversified portfolio.',
    expenseRatio: 0.03,
    minInvestment: 1,
    benchmark: 'Bloomberg U.S. Aggregate Float Adjusted Index',
    riskLevel: 'Low–Medium',
    numHoldings: 10985,
    turnoverRate: 50,
    distributionFrequency: 'Monthly',
    allocationLabel: 'Asset Type',
    sectorAllocation: [
      { name: 'U.S. Treasuries',           pct: 44.8 },
      { name: 'Mortgage-Backed',           pct: 25.3 },
      { name: 'Investment-Grade Corp.',    pct: 19.6 },
      { name: 'Government Agency',         pct: 6.2  },
      { name: 'Other',                     pct: 4.1  },
    ],
    distributions: [
      { date: '2026-04-07', type: 'Dividend', amount: 0.176 },
      { date: '2026-03-07', type: 'Dividend', amount: 0.179 },
      { date: '2026-02-07', type: 'Dividend', amount: 0.172 },
      { date: '2026-01-07', type: 'Dividend', amount: 0.175 },
      { date: '2025-12-07', type: 'Dividend', amount: 0.181 },
      { date: '2025-11-07', type: 'Dividend', amount: 0.178 },
    ],
  },
  {
    ticker: 'BFIN',
    realSymbol: 'VXUS',
    name: 'BobsFunds International',
    category: 'International Blend',
    description: 'Diversified exposure to developed international markets.',
    longDescription:
      'Provides cost-effective access to stocks of companies located in developed and emerging markets outside of the United States, spanning more than 40 countries. Ideal for investors seeking geographic diversification beyond U.S. equities.',
    expenseRatio: 0.07,
    minInvestment: 1,
    benchmark: 'FTSE Global All Cap ex US Index',
    riskLevel: 'Medium',
    numHoldings: 8512,
    turnoverRate: 4,
    distributionFrequency: 'Semiannual',
    allocationLabel: 'Sector Allocation',
    sectorAllocation: [
      { name: 'Financials',             pct: 20.4 },
      { name: 'Industrials',            pct: 14.1 },
      { name: 'Information Technology', pct: 12.8 },
      { name: 'Consumer Discretionary', pct: 10.3 },
      { name: 'Healthcare',             pct: 8.9  },
      { name: 'Other',                  pct: 33.5 },
    ],
    distributions: [
      { date: '2025-12-15', type: 'Dividend', amount: 0.617 },
      { date: '2025-06-15', type: 'Dividend', amount: 0.584 },
      { date: '2024-12-15', type: 'Dividend', amount: 0.552 },
    ],
  },
  {
    ticker: 'BFESG',
    realSymbol: 'ESGV',
    name: 'BobsFunds ESG Leaders',
    category: 'Large Cap ESG',
    description: 'Companies with top environmental, social & governance scores.',
    longDescription:
      'Tracks a broad U.S. stock index screened for environmental, social, and governance (ESG) criteria. Excludes companies involved in weapons, tobacco, alcohol, gambling, adult entertainment, and fossil fuels. Designed for investors who want broad market exposure aligned with their values.',
    expenseRatio: 0.09,
    minInvestment: 1,
    benchmark: 'FTSE US All Cap Choice Index',
    riskLevel: 'Medium',
    numHoldings: 1511,
    turnoverRate: 10,
    distributionFrequency: 'Quarterly',
    allocationLabel: 'Sector Allocation',
    sectorAllocation: [
      { name: 'Information Technology', pct: 29.2 },
      { name: 'Healthcare',             pct: 14.3 },
      { name: 'Consumer Discretionary', pct: 10.8 },
      { name: 'Industrials',            pct: 10.6 },
      { name: 'Financials',             pct: 8.4  },
      { name: 'Other',                  pct: 26.7 },
    ],
    distributions: [
      { date: '2026-03-25', type: 'Dividend', amount: 0.220 },
      { date: '2025-12-23', type: 'Dividend', amount: 0.214 },
      { date: '2025-09-25', type: 'Dividend', amount: 0.198 },
      { date: '2025-06-25', type: 'Dividend', amount: 0.187 },
    ],
  },
  {
    ticker: 'BFST',
    realSymbol: 'VGSH',
    name: 'BobsFunds Short-Term Treasury',
    category: 'Short-Term Bond',
    description: 'US Treasury securities with maturities of 1–3 years.',
    longDescription:
      'Provides low-risk, short-duration fixed income exposure by tracking an index of U.S. Treasury bonds with remaining maturities between 1 and 3 years. Suitable as a capital-preservation vehicle or cash alternative within a diversified portfolio.',
    expenseRatio: 0.04,
    minInvestment: 1,
    benchmark: 'Bloomberg U.S. Treasury 1-3 Year Bond Index',
    riskLevel: 'Low',
    numHoldings: 19,
    turnoverRate: 65,
    distributionFrequency: 'Monthly',
    allocationLabel: 'Maturity Bucket',
    sectorAllocation: [
      { name: '1–2 Year Maturity', pct: 45.8 },
      { name: '2–3 Year Maturity', pct: 54.2 },
    ],
    distributions: [
      { date: '2026-04-07', type: 'Dividend', amount: 0.223 },
      { date: '2026-03-07', type: 'Dividend', amount: 0.226 },
      { date: '2026-02-07', type: 'Dividend', amount: 0.221 },
      { date: '2026-01-07', type: 'Dividend', amount: 0.224 },
      { date: '2025-12-07', type: 'Dividend', amount: 0.229 },
      { date: '2025-11-07', type: 'Dividend', amount: 0.225 },
    ],
  },
];

export const FUND_BY_TICKER = new Map<string, FundDef>(FUNDS.map(f => [f.ticker, f]));
