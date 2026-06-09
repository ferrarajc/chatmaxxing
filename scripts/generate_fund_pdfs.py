"""
Generate 180 fund PDFs (36 funds × 5 document types) for Bob's Mutual Funds.
Output: customer-app/public/fund-docs/{ticker}/
"""

import os
import textwrap
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY

# ── Brand colours ─────────────────────────────────────────────────────────────
NAVY   = colors.HexColor('#0F2340')
ACCENT = colors.HexColor('#A05A2C')
LIGHT  = colors.HexColor('#F5F0E8')
MUTED  = colors.HexColor('#6B7280')
BORDER = colors.HexColor('#D1C9B8')
WHITE  = colors.white
BLACK  = colors.black

# ── Fund data (matches customer-app/src/data/funds.ts) ───────────────────────
FUNDS = [
    # ticker, name, category, group, expRatio, benchmark, riskLevel, numHoldings, minInv, distFreq
    ("BF500",  "BobsFunds 500 Index",              "Large Cap Blend",           "US Equity",      0.03, "S&P 500 Index",                                             "Medium",      503,   1, "Quarterly"),
    ("BFGR",   "BobsFunds Growth",                  "Large Cap Growth",          "US Equity",      0.04, "CRSP US Large Cap Growth Index",                            "Medium–High", 235,   1, "Quarterly"),
    ("BFBI",   "BobsFunds Bond Income",             "Intermediate Bond",         "Fixed Income",   0.03, "Bloomberg U.S. Aggregate Float Adjusted Index",             "Low–Medium",  10985, 1, "Monthly"),
    ("BFIN",   "BobsFunds International",           "International Blend",       "International",  0.07, "FTSE Global All Cap ex US Index",                           "Medium",      8512,  1, "Semiannual"),
    ("BFESG",  "BobsFunds ESG Leaders",             "Large Cap ESG",             "US Equity",      0.09, "FTSE US All Cap Choice Index",                              "Medium",      1511,  1, "Quarterly"),
    ("BFST",   "BobsFunds Short-Term Treasury",     "Short-Term Bond",           "Fixed Income",   0.04, "Bloomberg U.S. Treasury 1-3 Year Bond Index",               "Low",         19,    1, "Monthly"),
    ("BFTM",   "BobsFunds Total Market Index",      "Total Market",              "US Equity",      0.03, "CRSP US Total Market Index",                                "Medium",      3650,  1, "Quarterly"),
    ("BFLCV",  "BobsFunds Large-Cap Value",         "Large Cap Value",           "US Equity",      0.04, "CRSP US Large Cap Value Index",                             "Medium",      340,   1, "Quarterly"),
    ("BFMC",   "BobsFunds Mid-Cap Index",           "Mid Cap Blend",             "US Equity",      0.04, "CRSP US Mid Cap Index",                                     "Medium–High", 315,   1, "Quarterly"),
    ("BFMCV",  "BobsFunds Mid-Cap Value",           "Mid Cap Value",             "US Equity",      0.07, "CRSP US Mid Cap Value Index",                               "Medium–High", 195,   1, "Quarterly"),
    ("BFMCG",  "BobsFunds Mid-Cap Growth",          "Mid Cap Growth",            "US Equity",      0.07, "CRSP US Mid Cap Growth Index",                              "High",        160,   1, "Quarterly"),
    ("BFSC",   "BobsFunds Small-Cap Index",         "Small Cap Blend",           "US Equity",      0.05, "CRSP US Small Cap Index",                                   "High",        1380,  1, "Quarterly"),
    ("BFSCV",  "BobsFunds Small-Cap Value",         "Small Cap Value",           "US Equity",      0.07, "CRSP US Small Cap Value Index",                             "High",        840,   1, "Quarterly"),
    ("BFSCG",  "BobsFunds Small-Cap Growth",        "Small Cap Growth",          "US Equity",      0.07, "CRSP US Small Cap Growth Index",                            "High",        590,   1, "Quarterly"),
    ("BFDGA",  "BobsFunds Dividend Appreciation",   "Dividend Growth",           "US Equity",      0.05, "S&P U.S. Dividend Growers Index",                           "Medium",      340,   1, "Quarterly"),
    ("BFHDY",  "BobsFunds High Dividend Yield",     "High Dividend",             "US Equity",      0.06, "FTSE High Dividend Yield Index",                            "Medium",      580,   1, "Quarterly"),
    ("BFTEC",  "BobsFunds Technology Index",        "Technology",                "Sector Equity",  0.09, "MSCI US IMI Information Technology 25/50",                  "High",        320,   1, "Quarterly"),
    ("BFHLT",  "BobsFunds Health Care Index",       "Health Care",               "Sector Equity",  0.09, "MSCI US IMI Health Care 25/50",                             "Medium",      410,   1, "Quarterly"),
    ("BFFIN",  "BobsFunds Financials Index",        "Financials",                "Sector Equity",  0.09, "MSCI US IMI Financials 25/50",                              "Medium–High", 400,   1, "Quarterly"),
    ("BFDIS",  "BobsFunds Consumer Discretionary",  "Consumer Discretionary",    "Sector Equity",  0.09, "MSCI US IMI Consumer Discretionary 25/50",                  "High",        300,   1, "Quarterly"),
    ("BFSTP",  "BobsFunds Consumer Staples",        "Consumer Staples",          "Sector Equity",  0.09, "MSCI US IMI Consumer Staples 25/50",                        "Low–Medium",  105,   1, "Quarterly"),
    ("BFIND",  "BobsFunds Industrials Index",       "Industrials",               "Sector Equity",  0.09, "MSCI US IMI Industrials 25/50",                             "Medium–High", 390,   1, "Quarterly"),
    ("BFENE",  "BobsFunds Energy Index",            "Energy",                    "Sector Equity",  0.09, "MSCI US IMI Energy 25/50",                                  "High",        110,   1, "Quarterly"),
    ("BFMAT",  "BobsFunds Materials Index",         "Materials",                 "Sector Equity",  0.09, "MSCI US IMI Materials 25/50",                               "Medium–High", 115,   1, "Quarterly"),
    ("BFCOM",  "BobsFunds Communication Services",  "Communication Services",    "Sector Equity",  0.09, "MSCI US IMI Communication Services 25/50",                  "Medium–High", 120,   1, "Quarterly"),
    ("BFUTL",  "BobsFunds Utilities Index",         "Utilities",                 "Sector Equity",  0.09, "MSCI US IMI Utilities 25/50",                               "Low–Medium",  70,    1, "Quarterly"),
    ("BFREI",  "BobsFunds Real Estate Index",       "Real Estate",               "Sector Equity",  0.13, "MSCI US Investable Market Real Estate 25/50",               "Medium–High", 160,   1, "Quarterly"),
    ("BFDEV",  "BobsFunds Developed Markets",       "International Developed",   "International",  0.05, "FTSE Developed All Cap ex US Index",                        "Medium",      4050,  1, "Semiannual"),
    ("BFEMG",  "BobsFunds Emerging Markets",        "Emerging Markets",          "International",  0.08, "FTSE Emerging Markets All Cap China A Inclusion Index",      "High",        5800,  1, "Semiannual"),
    ("BFEUR",  "BobsFunds European Index",          "Europe",                    "International",  0.09, "FTSE Developed Europe All Cap Index",                       "Medium",      1280,  1, "Semiannual"),
    ("BFPAC",  "BobsFunds Pacific Index",           "Pacific",                   "International",  0.09, "FTSE Developed Asia Pacific All Cap Index",                 "Medium",      2350,  1, "Semiannual"),
    ("BFITT",  "BobsFunds Intermediate Treasury",   "Intermediate Treasury",     "Fixed Income",   0.04, "Bloomberg US Treasury 3-10 Year Index",                     "Low–Medium",  100,   1, "Monthly"),
    ("BFLTT",  "BobsFunds Long-Term Treasury",      "Long-Term Treasury",        "Fixed Income",   0.04, "Bloomberg US Long Treasury Index",                          "Medium",      80,    1, "Monthly"),
    ("BFSTC",  "BobsFunds Short-Term Corporate",    "Short-Term Corporate",      "Fixed Income",   0.04, "Bloomberg US 1-5 Year Corporate Index",                     "Low–Medium",  2500,  1, "Monthly"),
    ("BFITC",  "BobsFunds Intermediate Corporate",  "Intermediate Corporate",    "Fixed Income",   0.04, "Bloomberg US 5-10 Year Corporate Index",                    "Medium",      2300,  1, "Monthly"),
    ("BFLTC",  "BobsFunds Long-Term Corporate",     "Long-Term Corporate",       "Fixed Income",   0.04, "Bloomberg US 10+ Year Corporate Index",                     "Medium–High", 2900,  1, "Monthly"),
]

DOC_TYPES = [
    ("prospectus",       "Prospectus"),
    ("summary-prospectus", "Summary Prospectus"),
    ("annual-report",    "Annual Report"),
    ("semi-annual-report", "Semi-Annual Report"),
    ("sai",              "Statement of Additional Information"),
]

# ── Style helpers ─────────────────────────────────────────────────────────────

def make_styles():
    base = getSampleStyleSheet()
    s = {}

    s['cover_fund'] = ParagraphStyle('cover_fund', fontSize=22, fontName='Helvetica-Bold',
        textColor=WHITE, leading=28, spaceAfter=6)
    s['cover_doc'] = ParagraphStyle('cover_doc', fontSize=13, fontName='Helvetica',
        textColor=colors.HexColor('#D4B896'), leading=18, spaceAfter=4)
    s['cover_ticker'] = ParagraphStyle('cover_ticker', fontSize=11, fontName='Helvetica-Bold',
        textColor=colors.HexColor('#A05A2C'), leading=16)

    s['h1'] = ParagraphStyle('h1', fontSize=14, fontName='Helvetica-Bold',
        textColor=NAVY, leading=18, spaceBefore=18, spaceAfter=6,
        borderPadding=(0,0,3,0))
    s['h2'] = ParagraphStyle('h2', fontSize=11, fontName='Helvetica-Bold',
        textColor=NAVY, leading=15, spaceBefore=12, spaceAfter=4)
    s['body'] = ParagraphStyle('body', fontSize=9, fontName='Helvetica',
        textColor=colors.HexColor('#2D2D2D'), leading=14, spaceAfter=6, alignment=TA_JUSTIFY)
    s['small'] = ParagraphStyle('small', fontSize=7.5, fontName='Helvetica',
        textColor=MUTED, leading=11, spaceAfter=4, alignment=TA_JUSTIFY)
    s['label'] = ParagraphStyle('label', fontSize=8, fontName='Helvetica-Bold',
        textColor=MUTED, leading=11, spaceAfter=2, spaceBefore=8)
    s['footer'] = ParagraphStyle('footer', fontSize=7, fontName='Helvetica',
        textColor=MUTED, leading=10, alignment=TA_CENTER)
    s['important'] = ParagraphStyle('important', fontSize=9, fontName='Helvetica-Bold',
        textColor=NAVY, leading=13, spaceAfter=4, spaceBefore=8,
        borderPadding=6, borderColor=BORDER, borderWidth=1)

    return s


def header_block(story, fund_name, ticker, doc_label, styles):
    """Navy masthead band with fund name, doc type, ticker."""
    tbl = Table(
        [[Paragraph(f"<b>{fund_name}</b>", styles['cover_fund']),
          Paragraph(f"{doc_label}<br/>{ticker}", styles['cover_doc'])]],
        colWidths=[4.5*inch, 2.5*inch]
    )
    tbl.setStyle(TableStyle([
        ('BACKGROUND',  (0,0), (-1,-1), NAVY),
        ('TOPPADDING',  (0,0), (-1,-1), 20),
        ('BOTTOMPADDING',(0,0),(-1,-1), 20),
        ('LEFTPADDING', (0,0), (0,-1), 30),
        ('RIGHTPADDING',(-1,0),(-1,-1), 20),
        ('VALIGN',      (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN',       (1,0), (1,-1), 'RIGHT'),
    ]))
    story.append(tbl)


def key_facts_table(fund, styles):
    """Two-column key-facts grid."""
    ticker, name, category, group, exp, benchmark, risk, holdings, min_inv, dist_freq = fund
    rows = [
        ["Ticker Symbol",       ticker,           "Fund Category",        category],
        ["Asset Class",         group,            "Benchmark Index",      benchmark[:40]+"…" if len(benchmark)>40 else benchmark],
        ["Expense Ratio",       f"{exp:.2f}%",    "Risk Level",           risk],
        ["Number of Holdings",  f"{holdings:,}",  "Min. Investment",      f"${min_inv:,}"],
        ["Distribution Freq.",  dist_freq,        "Inception Date",       "January 2010"],
    ]
    data = [["Detail", "Value", "Detail", "Value"]]
    for r in rows:
        data.append(r)

    tbl = Table(data, colWidths=[1.5*inch, 1.8*inch, 1.5*inch, 1.8*inch])
    tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,0), NAVY),
        ('TEXTCOLOR',    (0,0), (-1,0), WHITE),
        ('FONTNAME',     (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE',     (0,0), (-1,-1), 8),
        ('FONTNAME',     (0,1), (0,-1), 'Helvetica-Bold'),
        ('FONTNAME',     (2,1), (2,-1), 'Helvetica-Bold'),
        ('TEXTCOLOR',    (0,1), (0,-1), NAVY),
        ('TEXTCOLOR',    (2,1), (2,-1), NAVY),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[LIGHT, WHITE]),
        ('GRID',         (0,0), (-1,-1), 0.5, BORDER),
        ('TOPPADDING',   (0,0), (-1,-1), 5),
        ('BOTTOMPADDING',(0,0), (-1,-1), 5),
        ('LEFTPADDING',  (0,0), (-1,-1), 8),
    ]))
    return tbl


def section(story, title, body_paras, styles):
    story.append(HRFlowable(width="100%", thickness=1.5, color=ACCENT, spaceAfter=2))
    story.append(Paragraph(title, styles['h1']))
    for p in body_paras:
        story.append(Paragraph(p, styles['body']))


def disclaimer(story, styles):
    story.append(Spacer(1, 0.3*inch))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Before investing, carefully consider the fund's investment objectives, risks, charges, and expenses. "
        "This document contains important information about the fund and should be read carefully before investing. "
        "Prospectuses and other fund documents are available through Bob's Mutual Funds, Inc. "
        "All investing is subject to risk, including possible loss of principal. Past performance is no guarantee "
        "of future results. Bob's Mutual Funds, Inc. is a registered investment company. "
        "© 2026 Bob's Mutual Funds, Inc. All rights reserved.",
        styles['small']
    ))


# ── Per-document generators ───────────────────────────────────────────────────

def gen_prospectus(path, fund, styles):
    ticker, name, category, group, exp, benchmark, risk, holdings, min_inv, dist_freq = fund
    doc = SimpleDocTemplate(path, pagesize=letter, topMargin=0.5*inch,
                            bottomMargin=0.7*inch, leftMargin=0.75*inch, rightMargin=0.75*inch)
    story = []

    header_block(story, name, ticker, "Prospectus", styles)
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph("Effective Date: January 1, 2026 | As Supplemented Through May 1, 2026", styles['label']))
    story.append(Spacer(1, 0.1*inch))

    story.append(Paragraph(
        f"IMPORTANT: Before you invest, read this Prospectus carefully. It contains important information "
        f"about the {name} (the \"Fund\") that you should know before investing.",
        styles['important']
    ))
    story.append(Spacer(1, 0.1*inch))

    story.append(Paragraph("Fund Summary", styles['h1']))
    story.append(key_facts_table(fund, styles))
    story.append(Spacer(1, 0.2*inch))

    section(story, "Investment Objective", [
        f"The {name} seeks to provide long-term capital appreciation and income by tracking the performance of "
        f"its benchmark index, the {benchmark}.",
        f"The Fund is designed for investors who seek broad exposure to the {category.lower()} segment of the "
        f"market and are willing to accept the risks associated with {risk.lower()} investments.",
    ], styles)

    section(story, "Principal Investment Strategies", [
        f"The Fund employs an indexing investment approach designed to track the performance of the {benchmark}. "
        f"The Fund invests by sampling the index, meaning that it holds a broadly diversified collection of "
        f"securities that, in the aggregate, approximates the full index in terms of key risk factors and other "
        f"characteristics.",
        f"The Fund currently holds approximately {holdings:,} securities and seeks to maintain a portfolio that "
        f"substantially replicates the composition and performance of the {benchmark}.",
        f"Under normal circumstances, the Fund will invest at least 80% of its assets in securities included in "
        f"its target index. The Fund typically maintains a low portfolio turnover rate consistent with its "
        f"indexing strategy.",
    ], styles)

    section(story, "Principal Risks", [
        f"An investment in the {name} is subject to investment risks; therefore, you may lose money by investing "
        f"in the Fund. The Fund is rated {risk} risk. There can be no guarantee that the Fund will achieve its "
        f"investment objective.",
        "<b>Market Risk.</b> The Fund is subject to market risk — the possibility that the market values of "
        "securities owned by the Fund will decline. Market prices of securities generally move with the overall "
        "economy, and may fall due to factors such as adverse issuer, political, regulatory, market, economic, "
        "or other developments.",
        "<b>Index Tracking Risk.</b> The Fund may not perfectly track its benchmark index due to transaction "
        "costs, timing differences, and the use of sampling techniques. Tracking error may cause the Fund to "
        "underperform the index it is designed to replicate.",
        "<b>Concentration Risk.</b> To the extent the Fund's benchmark index is concentrated in particular "
        "sectors, industries, or geographic regions, the Fund will be subject to greater volatility than a "
        "fund that is not so concentrated.",
    ], styles)

    section(story, "Fees and Expenses", [
        f"The following table describes the fees and expenses you may pay if you buy, hold, and sell shares of "
        f"the {name}.",
    ], styles)

    fee_data = [
        ["Shareholder Fees", ""],
        ["Sales Load (Front-End)", "None"],
        ["Deferred Sales Load", "None"],
        ["Redemption Fee", "None"],
        ["Annual Fund Operating Expenses", ""],
        ["Management Fee", f"{exp:.2f}%"],
        ["12b-1 Distribution Fee", "None"],
        ["Other Expenses", "0.00%"],
        ["Total Annual Fund Operating Expenses", f"{exp:.2f}%"],
    ]
    fee_tbl = Table(fee_data, colWidths=[5.0*inch, 1.5*inch])
    fee_tbl.setStyle(TableStyle([
        ('FONTNAME',     (0,0), (-1,-1), 'Helvetica'),
        ('FONTNAME',     (0,0), (0,0),   'Helvetica-Bold'),
        ('FONTNAME',     (0,5), (0,5),   'Helvetica-Bold'),
        ('FONTNAME',     (0,8), (-1,8),  'Helvetica-Bold'),
        ('BACKGROUND',   (0,0), (-1,0),  LIGHT),
        ('BACKGROUND',   (0,5), (-1,5),  LIGHT),
        ('FONTSIZE',     (0,0), (-1,-1), 8.5),
        ('GRID',         (0,0), (-1,-1), 0.5, BORDER),
        ('TOPPADDING',   (0,0), (-1,-1), 5),
        ('BOTTOMPADDING',(0,0), (-1,-1), 5),
        ('LEFTPADDING',  (0,0), (-1,-1), 8),
        ('ALIGN',        (1,0), (1,-1),  'RIGHT'),
        ('RIGHTPADDING', (1,0), (1,-1),  10),
    ]))
    story.append(fee_tbl)

    section(story, "Past Performance", [
        "The bar chart and table below provide some indication of the risks of investing in the Fund by showing "
        "changes in the Fund's performance from year to year and by showing how the Fund's average annual returns "
        "for certain periods compare with those of the Fund's benchmark index.",
        "The Fund's past performance (before and after taxes) is not necessarily an indication of how the Fund "
        "will perform in the future. Updated performance information is available on the Fund's website at "
        "www.bobsmutualfunds.com.",
    ], styles)

    section(story, "Management", [
        "The Fund is managed by Bob's Mutual Funds, Inc. (the \"Advisor\"), a registered investment adviser. "
        "The Advisor has managed index funds since 2010 and currently oversees more than $50 billion in assets "
        "under management across its fund family.",
        "Portfolio management decisions for the Fund are made by the Advisor's Index Portfolio Management team, "
        "which uses a disciplined quantitative approach to construct and maintain the Fund's portfolio.",
    ], styles)

    section(story, "Purchase and Sale of Fund Shares", [
        f"The minimum initial investment in the {name} is ${min_inv:,}. There is no minimum for subsequent "
        f"investments. Shares may be purchased or redeemed on any day that the New York Stock Exchange is "
        f"open for business.",
        "You may buy and sell shares through a financial advisor, an online brokerage account, or directly "
        "through Bob's Mutual Funds, Inc. Transactions are processed at the Fund's net asset value (NAV) "
        "computed at the close of regular trading on each business day.",
    ], styles)

    section(story, "Tax Information", [
        f"The Fund's distributions are generally taxable to you as ordinary income or capital gains, unless "
        f"you are investing through a tax-deferred account such as an IRA or 401(k). The Fund distributes "
        f"income {dist_freq.lower()}.",
        "You should consult your tax advisor regarding the tax consequences of an investment in the Fund.",
    ], styles)

    disclaimer(story, styles)
    doc.build(story)


def gen_summary_prospectus(path, fund, styles):
    ticker, name, category, group, exp, benchmark, risk, holdings, min_inv, dist_freq = fund
    doc = SimpleDocTemplate(path, pagesize=letter, topMargin=0.5*inch,
                            bottomMargin=0.7*inch, leftMargin=0.75*inch, rightMargin=0.75*inch)
    story = []

    header_block(story, name, ticker, "Summary Prospectus", styles)
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph("Effective Date: January 1, 2026", styles['label']))
    story.append(Spacer(1, 0.1*inch))

    story.append(Paragraph(
        "This Summary Prospectus is designed to provide investors with key information about the Fund in a "
        "clear and concise format. Before you invest, you may want to review the Fund's full Prospectus and "
        "Statement of Additional Information.",
        styles['body']
    ))
    story.append(Spacer(1, 0.1*inch))

    story.append(Paragraph("Key Facts at a Glance", styles['h1']))
    story.append(key_facts_table(fund, styles))
    story.append(Spacer(1, 0.2*inch))

    section(story, "Investment Objective", [
        f"The {name} seeks to track the performance of the {benchmark}, providing cost-effective exposure "
        f"to the {category.lower()} segment of the market.",
    ], styles)

    section(story, "Fees and Expenses", [
        f"The Fund's annual expense ratio is {exp:.2f}%, one of the lowest in its category. There are no "
        f"sales loads, redemption fees, or 12b-1 distribution fees.",
    ], styles)

    section(story, "Principal Risks", [
        f"Risk level: {risk}. An investment in this Fund involves market risk, index tracking risk, and — for "
        f"equity funds — the possibility of losing money. See the full Prospectus for a complete description "
        f"of risks.",
    ], styles)

    section(story, "How to Buy and Sell", [
        f"Minimum investment: ${min_inv:,}. Shares are purchased and redeemed at daily NAV. No transaction "
        f"fees when purchased directly through Bob's Mutual Funds.",
    ], styles)

    section(story, "Tax Information", [
        f"Distributions are generally taxable as ordinary income or capital gains. The Fund distributes income "
        f"{dist_freq.lower()}. Consider using a tax-advantaged account (IRA, 401(k)) to defer taxes.",
    ], styles)

    disclaimer(story, styles)
    doc.build(story)


def gen_annual_report(path, fund, styles):
    ticker, name, category, group, exp, benchmark, risk, holdings, min_inv, dist_freq = fund
    doc = SimpleDocTemplate(path, pagesize=letter, topMargin=0.5*inch,
                            bottomMargin=0.7*inch, leftMargin=0.75*inch, rightMargin=0.75*inch)
    story = []

    header_block(story, name, ticker, "Annual Report — Year Ended December 31, 2025", styles)
    story.append(Spacer(1, 0.15*inch))

    section(story, "Letter to Shareholders", [
        "Dear Shareholder,",
        f"We are pleased to present the Annual Report for the {name} for the fiscal year ended December 31, 2025. "
        f"The Fund continued to fulfill its mandate of providing broad, low-cost exposure to the {category.lower()} "
        f"segment of the market, while maintaining its characteristic low expense ratio of {exp:.2f}%.",
        "Markets in 2025 were characterized by resilient corporate earnings, moderating inflation, and gradual "
        "monetary policy easing by major central banks. Against this backdrop, the Fund delivered results "
        "consistent with its benchmark, net of its minimal fees.",
        "We remain committed to our indexing philosophy: low costs, broad diversification, and disciplined "
        "portfolio management. We thank you for your continued trust.",
        "Sincerely,<br/>The Portfolio Management Team<br/>Bob's Mutual Funds, Inc.",
    ], styles)

    section(story, "Performance Review", [
        f"For the year ended December 31, 2025, the {name} delivered performance in line with its benchmark, "
        f"the {benchmark}. The Fund's tracking error remained within acceptable parameters, and the expense "
        f"ratio was maintained at {exp:.2f}%, consistent with the prior year.",
        "Equity markets continued to benefit from strong corporate earnings and improving economic conditions. "
        "The Federal Reserve's gradual easing cycle provided a supportive backdrop for risk assets. "
        "Volatility, while present in certain periods, remained manageable relative to long-term averages.",
    ], styles)

    section(story, "Portfolio Highlights", [
        f"The Fund held approximately {holdings:,} securities as of December 31, 2025, providing diversified "
        f"exposure across the {category.lower()} universe. Portfolio turnover remained low, consistent with "
        f"the Fund's passive management approach.",
        "The Fund distributed income to shareholders on a " + dist_freq.lower() + " basis throughout the year, "
        "returning capital efficiently while maintaining portfolio integrity.",
    ], styles)

    section(story, "Financial Statements (Summary)", [], styles)
    fin_data = [
        ["", "2025", "2024"],
        ["Net Assets (end of period)", "$—", "$—"],
        ["NAV per Share (end of period)", "$—", "$—"],
        ["Total Return (before taxes)", "—%", "—%"],
        ["Total Return (after taxes on distributions)", "—%", "—%"],
        ["Expense Ratio", f"{exp:.2f}%", f"{exp:.2f}%"],
        ["Portfolio Turnover Rate", "—%", "—%"],
    ]
    fin_tbl = Table(fin_data, colWidths=[4.0*inch, 1.25*inch, 1.25*inch])
    fin_tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,0), NAVY),
        ('TEXTCOLOR',    (0,0), (-1,0), WHITE),
        ('FONTNAME',     (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTNAME',     (0,1), (0,-1), 'Helvetica'),
        ('FONTSIZE',     (0,0), (-1,-1), 8.5),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[LIGHT, WHITE]),
        ('GRID',         (0,0), (-1,-1), 0.5, BORDER),
        ('TOPPADDING',   (0,0), (-1,-1), 5),
        ('BOTTOMPADDING',(0,0), (-1,-1), 5),
        ('LEFTPADDING',  (0,0), (-1,-1), 8),
        ('ALIGN',        (1,0), (-1,-1), 'RIGHT'),
        ('RIGHTPADDING', (1,0), (-1,-1), 10),
    ]))
    story.append(fin_tbl)

    section(story, "Management's Discussion", [
        "The Fund's investment results for 2025 reflected the performance of securities in the underlying "
        f"index. The {benchmark} advanced during the fiscal year, driven by broad-based strength across "
        "constituent sectors.",
        "The Fund maintained its commitment to full investment in index securities, with minimal cash drag. "
        "Securities lending revenue partially offset fund expenses, benefiting shareholders. The Fund's "
        f"annualized tracking difference for 2025 was within the expected range given the {exp:.2f}% expense ratio.",
    ], styles)

    section(story, "Notes to Financial Statements", [
        f"The {name} is a series of Bob's Mutual Funds, Inc., a registered open-end management investment "
        "company organized as a Delaware statutory trust. The Fund commenced operations in January 2010.",
        "The Fund's fiscal year ends December 31. The financial highlights in this report have been prepared "
        "in accordance with U.S. generally accepted accounting principles (GAAP). The Fund's independent "
        "registered public accounting firm is [Auditor Name], LLP.",
    ], styles)

    disclaimer(story, styles)
    doc.build(story)


def gen_semi_annual_report(path, fund, styles):
    ticker, name, category, group, exp, benchmark, risk, holdings, min_inv, dist_freq = fund
    doc = SimpleDocTemplate(path, pagesize=letter, topMargin=0.5*inch,
                            bottomMargin=0.7*inch, leftMargin=0.75*inch, rightMargin=0.75*inch)
    story = []

    header_block(story, name, ticker, "Semi-Annual Report — Six Months Ended June 30, 2025", styles)
    story.append(Spacer(1, 0.15*inch))

    section(story, "Management Discussion (Unaudited)", [
        f"This semi-annual report covers the six-month period ended June 30, 2025 for the {name}.",
        "The first half of 2025 saw equities continue their advance from the prior year, supported by "
        "easing financial conditions and improving corporate earnings. The Fund tracked its benchmark "
        f"index, the {benchmark}, closely during the period.",
        "Distribution payments were made on schedule throughout the semi-annual period. The Fund's expense "
        f"ratio remained {exp:.2f}% on an annualized basis.",
    ], styles)

    section(story, "Portfolio Statistics (Unaudited)", [], styles)
    stats_data = [
        ["Statistic", "June 30, 2025", "December 31, 2024"],
        ["Number of Holdings",   f"{holdings:,}",  f"{holdings:,}"],
        ["Expense Ratio (ann.)", f"{exp:.2f}%",     f"{exp:.2f}%"],
        ["Net Assets",           "$—",             "$—"],
        ["NAV per Share",        "$—",             "$—"],
    ]
    s_tbl = Table(stats_data, colWidths=[3.0*inch, 1.7*inch, 1.8*inch])
    s_tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,0), NAVY),
        ('TEXTCOLOR',    (0,0), (-1,0), WHITE),
        ('FONTNAME',     (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE',     (0,0), (-1,-1), 8.5),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[LIGHT, WHITE]),
        ('GRID',         (0,0), (-1,-1), 0.5, BORDER),
        ('TOPPADDING',   (0,0), (-1,-1), 5),
        ('BOTTOMPADDING',(0,0), (-1,-1), 5),
        ('LEFTPADDING',  (0,0), (-1,-1), 8),
        ('ALIGN',        (1,0), (-1,-1), 'RIGHT'),
        ('RIGHTPADDING', (1,0), (-1,-1), 10),
    ]))
    story.append(s_tbl)

    section(story, "Distribution Schedule (Unaudited)", [
        f"The Fund distributes income on a {dist_freq.lower()} basis. Distributions paid during the "
        "six months ended June 30, 2025 were consistent with prior periods.",
    ], styles)

    section(story, "Notes (Unaudited)", [
        "The financial information in this Semi-Annual Report is unaudited. The Fund's audited Annual Report "
        "for the fiscal year ended December 31, 2025 will be available to shareholders in March 2026.",
        f"This report is for informational purposes only and should not be considered an offer to buy or sell "
        f"shares of the {name}.",
    ], styles)

    disclaimer(story, styles)
    doc.build(story)


def gen_sai(path, fund, styles):
    ticker, name, category, group, exp, benchmark, risk, holdings, min_inv, dist_freq = fund
    doc = SimpleDocTemplate(path, pagesize=letter, topMargin=0.5*inch,
                            bottomMargin=0.7*inch, leftMargin=0.75*inch, rightMargin=0.75*inch)
    story = []

    header_block(story, name, ticker, "Statement of Additional Information", styles)
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph("Effective Date: January 1, 2026 | This SAI is not a Prospectus.", styles['label']))
    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph(
        "This Statement of Additional Information supplements the information contained in the Fund's Prospectus. "
        "This SAI should be read in conjunction with the Prospectus. A copy of the Prospectus may be obtained "
        "free of charge by contacting Bob's Mutual Funds, Inc.",
        styles['body']
    ))
    story.append(Spacer(1, 0.1*inch))

    section(story, "Fund Organization", [
        f"The {name} (the \"Fund\") is a series of Bob's Mutual Funds Trust (the \"Trust\"), a Delaware statutory "
        f"trust organized on March 1, 2008. The Trust is registered with the Securities and Exchange Commission "
        f"(\"SEC\") as an open-end management investment company under the Investment Company Act of 1940, "
        f"as amended (the \"1940 Act\"). The Fund commenced operations in January 2010.",
        f"The Fund offers a single class of shares. Each share represents an equal, proportionate interest in "
        f"the assets of the Fund, subject to the liabilities of the Fund.",
    ], styles)

    section(story, "Investment Policies and Restrictions", [
        "The following investment restrictions are fundamental policies of the Fund, which may not be changed "
        "without a vote of a majority of the outstanding voting securities of the Fund (as defined in the "
        "1940 Act):",
        "1. The Fund may not purchase securities of any issuer (other than U.S. Government obligations) if, "
        "as a result, more than 5% of the Fund's total assets would be invested in the securities of that issuer.",
        "2. The Fund may not borrow money, except from banks for temporary purposes in an amount not to exceed "
        "10% of the Fund's total net assets.",
        "3. The Fund may not underwrite securities of other issuers except to the extent that in connection "
        "with the sale or disposition of portfolio securities, it may be deemed to be an underwriter.",
        "4. The Fund may not invest in real estate directly, although it may invest in securities issued by "
        "companies that invest in real estate or real estate interests (except as otherwise restricted).",
        "5. The Fund may not issue senior securities (as defined in the 1940 Act), except as permitted by "
        "the 1940 Act, any rules thereunder, or any orders of the SEC.",
    ], styles)

    section(story, "Management of the Fund", [
        "The Board of Trustees of the Trust (the \"Board\") oversees the management and affairs of the Fund. "
        "The Board has overall responsibility for the Trust, including establishing general policies of the "
        "Trust and supervising and reviewing the actions of the Trust's officers.",
        "The Advisor is Bob's Mutual Funds, Inc., a Delaware corporation registered as an investment adviser "
        "under the Investment Advisers Act of 1940. The Advisor provides investment advisory services to the "
        "Fund pursuant to an Investment Advisory Agreement with the Trust.",
        f"For its services, the Advisor receives a fee from the Fund at the annual rate of {exp:.2f}% of "
        "the Fund's average daily net assets. This fee covers all investment management expenses and the "
        "majority of operating expenses; the Fund bears no other ongoing expenses except as described herein.",
    ], styles)

    section(story, "Distribution of Fund Shares", [
        "Bob's Mutual Funds Distributors, Inc. (the \"Distributor\"), a wholly-owned subsidiary of the Advisor, "
        "serves as the principal underwriter and distributor of the Fund's shares. The Fund has not adopted "
        "a distribution plan under Rule 12b-1 of the 1940 Act and pays no 12b-1 fees.",
        f"Shares are sold at NAV with no sales load. The minimum initial investment is ${min_inv:,}. Shares "
        "may be redeemed at NAV on any business day.",
    ], styles)

    section(story, "Tax Information", [
        "The Fund intends to qualify each year as a regulated investment company under Subchapter M of the "
        "Internal Revenue Code of 1986, as amended (the \"Code\"). As a regulated investment company, the Fund "
        "generally will not be subject to U.S. federal income tax on income and gains that it distributes to "
        "shareholders, provided that it distributes at least 90% of its investment company taxable income.",
        f"The Fund distributes income to shareholders on a {dist_freq.lower()} basis. Capital gains, if any, "
        "are distributed annually. Distributions may be in the form of additional shares or cash, at the "
        "shareholder's election.",
    ], styles)

    section(story, "Securities Lending", [
        "The Fund may lend portfolio securities to broker-dealers and other financial institutions. Securities "
        "lending allows the Fund to receive income from the temporary loan of securities. The Fund will receive "
        "collateral equal to at least 102% of the market value of loaned securities (105% for non-U.S. "
        "securities). The income earned from securities lending will partially offset the Fund's expenses.",
    ], styles)

    section(story, "Financial Statements", [
        "The Fund's financial statements, including the Schedule of Investments, are incorporated herein by "
        "reference from the Fund's Annual Report for the fiscal year ended December 31, 2025. A copy of "
        "the Annual Report accompanies this SAI and is available free of charge upon request.",
    ], styles)

    disclaimer(story, styles)
    doc.build(story)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    # Output directory relative to this script location
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.join(script_dir, '..', 'customer-app', 'public', 'fund-docs')

    styles = make_styles()

    generators = {
        "prospectus":          gen_prospectus,
        "summary-prospectus":  gen_summary_prospectus,
        "annual-report":       gen_annual_report,
        "semi-annual-report":  gen_semi_annual_report,
        "sai":                 gen_sai,
    }

    total = len(FUNDS) * len(generators)
    done  = 0

    for fund in FUNDS:
        ticker = fund[0]
        fund_dir = os.path.join(base_dir, ticker.lower())
        os.makedirs(fund_dir, exist_ok=True)

        for slug, _label in DOC_TYPES:
            out_path = os.path.join(fund_dir, f"{slug}.pdf")
            generators[slug](out_path, fund, styles)
            done += 1
            print(f"[{done}/{total}] {ticker} — {slug}")

    print(f"\nDone. {total} PDFs written to {os.path.abspath(base_dir)}")


if __name__ == '__main__':
    main()
