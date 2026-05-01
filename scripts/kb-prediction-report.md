# KB Prediction Quality Report

Generated: 2026-05-01T22:03:18.563Z
Region: us-east-1 | Intent fn: bobs-predict-intent | Questions fn: bobs-predict-questions
Topic trials per scenario: 5 | Question trials per topic: 3

## Summary

| Metric | Score | Target | Result |
|---|---|---|---|
| Topic selection (avg overlap) | 92.2% | ≥90% | ✅ PASS |
| Question delivery (valid responses) | 100.0% | ≥90% | ✅ PASS |

## Topic Selection — Per Scenario

| Client | Page | Score | Missed topics |
|---|---|---|---|
| demo-client-001 | portfolio | 100% | — |
| demo-client-001 | research | 95% | — |
| demo-client-001 | account | 85% | — |
| demo-client-001 | home | 95% | — |
| demo-client-002 | portfolio | 100% | — |
| demo-client-002 | research | 75% | Expense ratios explained |
| demo-client-002 | account | 95% | — |
| demo-client-002 | home | 100% | — |
| demo-client-003 | portfolio | 100% | — |
| demo-client-003 | research | 85% | Expense ratios explained |
| demo-client-003 | account | 100% | — |
| demo-client-003 | home | 100% | — |
| demo-client-004 | portfolio | 100% | — |
| demo-client-004 | research | 80% | Bond fund options |
| demo-client-004 | account | 80% | Update contact info |
| demo-client-004 | home | 85% | Auto-invest setup |

## Question Selection — Sample (first 2 scenarios per client)

| Client | Page | Topic | Score |
|---|---|---|---|
| demo-client-001 | portfolio | Fund performance | 100% |
| demo-client-001 | portfolio | Check my balance | 100% |
| demo-client-002 | portfolio | Check my balance | 100% |
| demo-client-002 | portfolio | Recent transactions | 100% |
| demo-client-003 | portfolio | Check my balance | 100% |
| demo-client-003 | portfolio | Fund performance | 100% |
| demo-client-004 | portfolio | Check my balance | 100% |
| demo-client-004 | portfolio | Recent transactions | 100% |

## Trial Detail — Topics

### demo-client-001 / portfolio (avg 100%)
Intended: Fund performance, Check my balance, Recent transactions, Required minimum distributions
Trial 1 (4/4): Check my balance, Recent transactions, Fund performance, Required minimum distributions
Trial 2 (4/4): Check my balance, Recent transactions, Fund performance, Required minimum distributions
Trial 3 (4/4): Check my balance, Recent transactions, Fund performance, Required minimum distributions
Trial 4 (4/4): Check my balance, Recent transactions, Required minimum distributions, Fund performance
Trial 5 (4/4): Check my balance, Recent transactions, Fund performance, Required minimum distributions

### demo-client-001 / research (avg 95%)
Intended: Compare BobsFunds funds, Expense ratios explained, Roth IRA strategies, Rollover options
Trial 1 (3/4): Compare BobsFunds funds, Expense ratios explained, Roth IRA strategies, Rebalancing strategies
Trial 2 (4/4): Compare BobsFunds funds, Expense ratios explained, Roth IRA strategies, Rollover options
Trial 3 (4/4): Compare BobsFunds funds, Expense ratios explained, Roth IRA strategies, Rollover options
Trial 4 (4/4): Compare BobsFunds funds, Expense ratios explained, Roth IRA strategies, Rollover options
Trial 5 (4/4): Compare BobsFunds funds, Expense ratios explained, Roth IRA strategies, Rollover options

### demo-client-001 / account (avg 85%)
Intended: Change beneficiary, Security settings, Required minimum distributions, Tax documents
Trial 1 (4/4): Change beneficiary, Security settings, Required minimum distributions, Tax documents
Trial 2 (4/4): Change beneficiary, Security settings, Required minimum distributions, Tax documents
Trial 3 (2/4): Update contact info, Change beneficiary, Required minimum distributions, RMD distribution setup
Trial 4 (3/4): Change beneficiary, Security settings, Required minimum distributions, IRA contribution limits
Trial 5 (4/4): Change beneficiary, Security settings, Required minimum distributions, Tax documents

### demo-client-001 / home (avg 95%)
Intended: Fund performance, Required minimum distributions, Roth IRA strategies, Schedule a callback
Trial 1 (4/4): Fund performance, Required minimum distributions, Roth IRA strategies, Schedule a callback
Trial 2 (4/4): Fund performance, Required minimum distributions, Roth IRA strategies, Schedule a callback
Trial 3 (4/4): Fund performance, Required minimum distributions, Roth IRA strategies, Schedule a callback
Trial 4 (4/4): Fund performance, Required minimum distributions, Roth IRA strategies, Schedule a callback
Trial 5 (3/4): Fund performance, Required minimum distributions, IRA contribution limits, Schedule a callback

### demo-client-002 / portfolio (avg 100%)
Intended: Check my balance, Recent transactions, Required minimum distributions, Fund performance
Trial 1 (4/4): Check my balance, Recent transactions, Required minimum distributions, Fund performance
Trial 2 (4/4): Check my balance, Recent transactions, Required minimum distributions, Fund performance
Trial 3 (4/4): Check my balance, Recent transactions, Required minimum distributions, Fund performance
Trial 4 (4/4): Check my balance, Recent transactions, Required minimum distributions, Fund performance
Trial 5 (4/4): Check my balance, Recent transactions, Required minimum distributions, Fund performance

### demo-client-002 / research (avg 75%)
Intended: Compare BobsFunds funds, Expense ratios explained, Bond fund options, Tax-efficient investing
Trial 1 (3/4): Compare BobsFunds funds, Expense ratios explained, Tax-efficient investing, Rollover options
Trial 2 (3/4): Compare BobsFunds funds, Bond fund options, Tax-efficient investing, Rollover options
Trial 3 (3/4): Compare BobsFunds funds, Bond fund options, Tax-efficient investing, Rollover options
Trial 4 (3/4): Compare BobsFunds funds, Bond fund options, Tax-efficient investing, Rollover options
Trial 5 (3/4): Compare BobsFunds funds, Bond fund options, Tax-efficient investing, Rollover options

### demo-client-002 / account (avg 95%)
Intended: Change beneficiary, Tax documents, Required minimum distributions, RMD distribution setup
Trial 1 (4/4): Required minimum distributions, RMD distribution setup, Change beneficiary, Tax documents
Trial 2 (3/4): Change beneficiary, Security settings, Required minimum distributions, RMD distribution setup
Trial 3 (4/4): Required minimum distributions, RMD distribution setup, Change beneficiary, Tax documents
Trial 4 (4/4): Required minimum distributions, RMD distribution setup, Change beneficiary, Tax documents
Trial 5 (4/4): Required minimum distributions, RMD distribution setup, Change beneficiary, Tax documents

### demo-client-002 / home (avg 100%)
Intended: Fund performance, Required minimum distributions, IRA contribution limits, Schedule a callback
Trial 1 (4/4): Required minimum distributions, Fund performance, Schedule a callback, IRA contribution limits
Trial 2 (4/4): Required minimum distributions, Fund performance, Schedule a callback, IRA contribution limits
Trial 3 (4/4): Required minimum distributions, Fund performance, Schedule a callback, IRA contribution limits
Trial 4 (4/4): Required minimum distributions, Fund performance, Schedule a callback, IRA contribution limits
Trial 5 (4/4): Required minimum distributions, Fund performance, Schedule a callback, IRA contribution limits

### demo-client-003 / portfolio (avg 100%)
Intended: Check my balance, Fund performance, Recent transactions, Rebalancing strategies
Trial 1 (4/4): Check my balance, Recent transactions, Fund performance, Rebalancing strategies
Trial 2 (4/4): Check my balance, Recent transactions, Fund performance, Rebalancing strategies
Trial 3 (4/4): Check my balance, Recent transactions, Fund performance, Rebalancing strategies
Trial 4 (4/4): Check my balance, Recent transactions, Fund performance, Rebalancing strategies
Trial 5 (4/4): Check my balance, Recent transactions, Fund performance, Rebalancing strategies

### demo-client-003 / research (avg 85%)
Intended: Compare BobsFunds funds, Expense ratios explained, Roth IRA strategies, ESG fund options
Trial 1 (3/4): Compare BobsFunds funds, Roth IRA strategies, ESG fund options, Tax-efficient investing
Trial 2 (3/4): Compare BobsFunds funds, Roth IRA strategies, ESG fund options, Tax-efficient investing
Trial 3 (4/4): Compare BobsFunds funds, Expense ratios explained, Roth IRA strategies, ESG fund options
Trial 4 (3/4): Compare BobsFunds funds, Roth IRA strategies, ESG fund options, Tax-efficient investing
Trial 5 (4/4): Compare BobsFunds funds, Expense ratios explained, Roth IRA strategies, ESG fund options

### demo-client-003 / account (avg 100%)
Intended: Update contact info, Change beneficiary, Tax documents, IRA contribution limits
Trial 1 (4/4): Update contact info, Change beneficiary, Tax documents, IRA contribution limits
Trial 2 (4/4): Update contact info, Change beneficiary, Tax documents, IRA contribution limits
Trial 3 (4/4): Update contact info, Change beneficiary, Tax documents, IRA contribution limits
Trial 4 (4/4): Update contact info, Change beneficiary, Tax documents, IRA contribution limits
Trial 5 (4/4): Update contact info, Change beneficiary, Tax documents, IRA contribution limits

### demo-client-003 / home (avg 100%)
Intended: Fund performance, IRA contribution limits, Roth IRA strategies, Schedule a callback
Trial 1 (4/4): Fund performance, IRA contribution limits, Roth IRA strategies, Schedule a callback
Trial 2 (4/4): Fund performance, IRA contribution limits, Roth IRA strategies, Schedule a callback
Trial 3 (4/4): Fund performance, IRA contribution limits, Roth IRA strategies, Schedule a callback
Trial 4 (4/4): Fund performance, IRA contribution limits, Roth IRA strategies, Schedule a callback
Trial 5 (4/4): Fund performance, IRA contribution limits, Roth IRA strategies, Schedule a callback

### demo-client-004 / portfolio (avg 100%)
Intended: Check my balance, Recent transactions, SEP-IRA contribution limits, Bond fund options
Trial 1 (4/4): Check my balance, Recent transactions, SEP-IRA contribution limits, Bond fund options
Trial 2 (4/4): Check my balance, Recent transactions, SEP-IRA contribution limits, Bond fund options
Trial 3 (4/4): Check my balance, Recent transactions, SEP-IRA contribution limits, Bond fund options
Trial 4 (4/4): Check my balance, Recent transactions, SEP-IRA contribution limits, Bond fund options
Trial 5 (4/4): Check my balance, Recent transactions, SEP-IRA contribution limits, Bond fund options

### demo-client-004 / research (avg 80%)
Intended: Compare BobsFunds funds, Expense ratios explained, SEP-IRA vs. solo 401(k), Bond fund options
Trial 1 (3/4): Compare BobsFunds funds, Expense ratios explained, Tax-efficient investing, SEP-IRA vs. solo 401(k)
Trial 2 (3/4): Compare BobsFunds funds, Expense ratios explained, Roth IRA strategies, SEP-IRA vs. solo 401(k)
Trial 3 (3/4): Compare BobsFunds funds, Expense ratios explained, Tax-efficient investing, SEP-IRA vs. solo 401(k)
Trial 4 (4/4): Compare BobsFunds funds, Expense ratios explained, Bond fund options, SEP-IRA vs. solo 401(k)
Trial 5 (3/4): Compare BobsFunds funds, Expense ratios explained, SEP-IRA vs. solo 401(k), Rebalancing strategies

### demo-client-004 / account (avg 80%)
Intended: Update contact info, Change beneficiary, SEP-IRA contribution limits, Security settings
Trial 1 (3/4): Update contact info, Change beneficiary, SEP-IRA contribution limits, Tax documents
Trial 2 (4/4): Update contact info, Change beneficiary, SEP-IRA contribution limits, Security settings
Trial 3 (3/4): Change beneficiary, Security settings, SEP-IRA contribution limits, Tax documents
Trial 4 (3/4): Change beneficiary, Security settings, SEP-IRA contribution limits, Tax documents
Trial 5 (3/4): Change beneficiary, Security settings, SEP-IRA contribution limits, Tax documents

### demo-client-004 / home (avg 85%)
Intended: Fund performance, SEP-IRA contribution limits, Schedule a callback, Auto-invest setup
Trial 1 (3/4): SEP-IRA contribution limits, Fund performance, Schedule a callback, Roth IRA strategies
Trial 2 (3/4): SEP-IRA contribution limits, Fund performance, Schedule a callback, Roth IRA strategies
Trial 3 (4/4): SEP-IRA contribution limits, Fund performance, Schedule a callback, Auto-invest setup
Trial 4 (4/4): SEP-IRA contribution limits, Fund performance, Schedule a callback, Auto-invest setup
Trial 5 (3/4): SEP-IRA contribution limits, Fund performance, Schedule a callback, Roth IRA strategies
