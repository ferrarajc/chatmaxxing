"""
Generate comprehensive Prospectus PDFs (only) for all 36 Bob's Mutual Funds.
Targets 22-30 pages per fund, modeled on real Vanguard prospectus structure.
Output: customer-app/public/fund-docs/{ticker}/prospectus.pdf
"""

import os
import math
import hashlib
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether, Flowable
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.graphics.shapes import Drawing, Rect, Line, String, Group
from reportlab.graphics import renderPDF

# ── Brand colours ──────────────────────────────────────────────────────────────
NAVY   = colors.HexColor('#0F2340')
ACCENT = colors.HexColor('#A05A2C')
LIGHT  = colors.HexColor('#F5F0E8')
MUTED  = colors.HexColor('#6B7280')
BORDER = colors.HexColor('#D1C9B8')
WHITE  = colors.white
BLACK  = colors.black
DARK_RED = colors.HexColor('#8B1A1A')
LIGHT_GRAY = colors.HexColor('#F0EDE8')

# ── Fund data ──────────────────────────────────────────────────────────────────
FUNDS = [
    ("BF500",  "BobsFunds 500 Index",              "Large Cap Blend",           "US Equity",      0.03, "S&P 500 Index",                                              "Medium",      503,   1, "Quarterly"),
    ("BFGR",   "BobsFunds Growth",                  "Large Cap Growth",          "US Equity",      0.04, "CRSP US Large Cap Growth Index",                             "Medium-High", 235,   1, "Quarterly"),
    ("BFBI",   "BobsFunds Bond Income",             "Intermediate Bond",         "Fixed Income",   0.03, "Bloomberg U.S. Aggregate Float Adjusted Index",              "Low-Medium",  10985, 1, "Monthly"),
    ("BFIN",   "BobsFunds International",           "International Blend",       "International",  0.07, "FTSE Global All Cap ex US Index",                            "Medium",      8512,  1, "Semiannual"),
    ("BFESG",  "BobsFunds ESG Leaders",             "Large Cap ESG",             "US Equity",      0.09, "FTSE US All Cap Choice Index",                               "Medium",      1511,  1, "Quarterly"),
    ("BFST",   "BobsFunds Short-Term Treasury",     "Short-Term Bond",           "Fixed Income",   0.04, "Bloomberg U.S. Treasury 1-3 Year Bond Index",                "Low",         19,    1, "Monthly"),
    ("BFTM",   "BobsFunds Total Market Index",      "Total Market",              "US Equity",      0.03, "CRSP US Total Market Index",                                 "Medium",      3650,  1, "Quarterly"),
    ("BFLCV",  "BobsFunds Large-Cap Value",         "Large Cap Value",           "US Equity",      0.04, "CRSP US Large Cap Value Index",                              "Medium",      340,   1, "Quarterly"),
    ("BFMC",   "BobsFunds Mid-Cap Index",           "Mid Cap Blend",             "US Equity",      0.04, "CRSP US Mid Cap Index",                                      "Medium-High", 315,   1, "Quarterly"),
    ("BFMCV",  "BobsFunds Mid-Cap Value",           "Mid Cap Value",             "US Equity",      0.07, "CRSP US Mid Cap Value Index",                                "Medium-High", 195,   1, "Quarterly"),
    ("BFMCG",  "BobsFunds Mid-Cap Growth",          "Mid Cap Growth",            "US Equity",      0.07, "CRSP US Mid Cap Growth Index",                               "High",        160,   1, "Quarterly"),
    ("BFSC",   "BobsFunds Small-Cap Index",         "Small Cap Blend",           "US Equity",      0.05, "CRSP US Small Cap Index",                                    "High",        1380,  1, "Quarterly"),
    ("BFSCV",  "BobsFunds Small-Cap Value",         "Small Cap Value",           "US Equity",      0.07, "CRSP US Small Cap Value Index",                              "High",        840,   1, "Quarterly"),
    ("BFSCG",  "BobsFunds Small-Cap Growth",        "Small Cap Growth",          "US Equity",      0.07, "CRSP US Small Cap Growth Index",                             "High",        590,   1, "Quarterly"),
    ("BFDGA",  "BobsFunds Dividend Appreciation",   "Dividend Growth",           "US Equity",      0.05, "S&P U.S. Dividend Growers Index",                            "Medium",      340,   1, "Quarterly"),
    ("BFHDY",  "BobsFunds High Dividend Yield",     "High Dividend",             "US Equity",      0.06, "FTSE High Dividend Yield Index",                             "Medium",      580,   1, "Quarterly"),
    ("BFTEC",  "BobsFunds Technology Index",        "Technology",                "Sector Equity",  0.09, "MSCI US IMI Information Technology 25/50",                   "High",        320,   1, "Quarterly"),
    ("BFHLT",  "BobsFunds Health Care Index",       "Health Care",               "Sector Equity",  0.09, "MSCI US IMI Health Care 25/50",                              "Medium",      410,   1, "Quarterly"),
    ("BFFIN",  "BobsFunds Financials Index",        "Financials",                "Sector Equity",  0.09, "MSCI US IMI Financials 25/50",                               "Medium-High", 400,   1, "Quarterly"),
    ("BFDIS",  "BobsFunds Consumer Discretionary",  "Consumer Discretionary",    "Sector Equity",  0.09, "MSCI US IMI Consumer Discretionary 25/50",                   "High",        300,   1, "Quarterly"),
    ("BFSTP",  "BobsFunds Consumer Staples",        "Consumer Staples",          "Sector Equity",  0.09, "MSCI US IMI Consumer Staples 25/50",                         "Low-Medium",  105,   1, "Quarterly"),
    ("BFIND",  "BobsFunds Industrials Index",       "Industrials",               "Sector Equity",  0.09, "MSCI US IMI Industrials 25/50",                              "Medium-High", 390,   1, "Quarterly"),
    ("BFENE",  "BobsFunds Energy Index",            "Energy",                    "Sector Equity",  0.09, "MSCI US IMI Energy 25/50",                                   "High",        110,   1, "Quarterly"),
    ("BFMAT",  "BobsFunds Materials Index",         "Materials",                 "Sector Equity",  0.09, "MSCI US IMI Materials 25/50",                                "Medium-High", 115,   1, "Quarterly"),
    ("BFCOM",  "BobsFunds Communication Services",  "Communication Services",    "Sector Equity",  0.09, "MSCI US IMI Communication Services 25/50",                   "Medium-High", 120,   1, "Quarterly"),
    ("BFUTL",  "BobsFunds Utilities Index",         "Utilities",                 "Sector Equity",  0.09, "MSCI US IMI Utilities 25/50",                                "Low-Medium",  70,    1, "Quarterly"),
    ("BFREI",  "BobsFunds Real Estate Index",       "Real Estate",               "Sector Equity",  0.13, "MSCI US Investable Market Real Estate 25/50",                "Medium-High", 160,   1, "Quarterly"),
    ("BFDEV",  "BobsFunds Developed Markets",       "International Developed",   "International",  0.05, "FTSE Developed All Cap ex US Index",                         "Medium",      4050,  1, "Semiannual"),
    ("BFEMG",  "BobsFunds Emerging Markets",        "Emerging Markets",          "International",  0.08, "FTSE Emerging Markets All Cap China A Inclusion Index",       "High",        5800,  1, "Semiannual"),
    ("BFEUR",  "BobsFunds European Index",          "Europe",                    "International",  0.09, "FTSE Developed Europe All Cap Index",                        "Medium",      1280,  1, "Semiannual"),
    ("BFPAC",  "BobsFunds Pacific Index",           "Pacific",                   "International",  0.09, "FTSE Developed Asia Pacific All Cap Index",                  "Medium",      2350,  1, "Semiannual"),
    ("BFITT",  "BobsFunds Intermediate Treasury",   "Intermediate Treasury",     "Fixed Income",   0.04, "Bloomberg US Treasury 3-10 Year Index",                      "Low-Medium",  100,   1, "Monthly"),
    ("BFLTT",  "BobsFunds Long-Term Treasury",      "Long-Term Treasury",        "Fixed Income",   0.04, "Bloomberg US Long Treasury Index",                           "Medium",      80,    1, "Monthly"),
    ("BFSTC",  "BobsFunds Short-Term Corporate",    "Short-Term Corporate",      "Fixed Income",   0.04, "Bloomberg US 1-5 Year Corporate Index",                      "Low-Medium",  2500,  1, "Monthly"),
    ("BFITC",  "BobsFunds Intermediate Corporate",  "Intermediate Corporate",    "Fixed Income",   0.04, "Bloomberg US 5-10 Year Corporate Index",                     "Medium",      2300,  1, "Monthly"),
    ("BFLTC",  "BobsFunds Long-Term Corporate",     "Long-Term Corporate",       "Fixed Income",   0.04, "Bloomberg US 10+ Year Corporate Index",                      "Medium-High", 2900,  1, "Monthly"),
]

FUND_RETURNS = {
    "BF500": {"returns": [18.4, 28.7, -18.2, 26.3, 25.0, 12.6], "yield": 1.21, "turnover": 2,  "start_nav": 100.00, "aum_b": 195.0},
    "BFGR":  {"returns": [40.2, 27.4, -33.2, 46.8, 33.5, 15.4], "yield": 0.49, "turnover": 3,  "start_nav":  80.00, "aum_b":  75.2},
    "BFBI":  {"returns": [ 7.7, -1.7, -13.1,  5.5,  1.4,  4.2], "yield": 3.82, "turnover": 50, "start_nav":  52.00, "aum_b": 112.8},
    "BFIN":  {"returns": [11.0,  8.6, -16.0, 15.6,  4.9, 10.8], "yield": 2.96, "turnover": 4,  "start_nav":  60.00, "aum_b":  52.4},
    "BFESG": {"returns": [25.3, 28.6, -22.5, 34.2, 28.1, 12.8], "yield": 0.91, "turnover": 10, "start_nav":  40.00, "aum_b":  28.6},
    "BFST":  {"returns": [ 3.2, -1.4,  -4.2,  4.7,  4.9,  4.3], "yield": 4.58, "turnover": 65, "start_nav":  25.00, "aum_b":  38.4},
    "BFTM":  {"returns": [21.0, 25.7, -19.5, 26.0, 23.8, 12.9], "yield": 1.28, "turnover": 2,  "start_nav":  90.00, "aum_b": 145.2},
    "BFLCV": {"returns": [ 2.3, 26.5,  -2.1,  9.3, 13.5, 11.0], "yield": 2.35, "turnover": 9,  "start_nav": 120.00, "aum_b":  48.5},
    "BFMC":  {"returns": [18.2, 24.5, -18.7, 16.0, 15.2, 10.5], "yield": 1.45, "turnover": 14, "start_nav":  70.00, "aum_b":  24.8},
    "BFMCV": {"returns": [ 2.5, 28.8,  -8.0,  8.5, 12.0,  9.0], "yield": 2.10, "turnover": 18, "start_nav":  55.00, "aum_b":  14.2},
    "BFMCG": {"returns": [33.0, 13.5, -28.0, 22.0, 17.5, 13.0], "yield": 0.55, "turnover": 22, "start_nav":  45.00, "aum_b":  11.5},
    "BFSC":  {"returns": [19.1, 17.7, -17.6, 18.2, 14.0,  9.5], "yield": 1.40, "turnover": 12, "start_nav": 165.00, "aum_b":  32.4},
    "BFSCV": {"returns": [ 5.8, 28.0,  -9.3, 14.0, 12.5,  8.0], "yield": 1.95, "turnover": 18, "start_nav": 150.00, "aum_b":  18.6},
    "BFSCG": {"returns": [35.5,  5.7, -28.4, 21.0, 15.5, 11.0], "yield": 0.50, "turnover": 25, "start_nav":  85.00, "aum_b":  12.8},
    "BFDGA": {"returns": [15.5, 23.7,  -9.8, 14.5, 17.0, 11.5], "yield": 1.75, "turnover": 12, "start_nav": 130.00, "aum_b":  42.5},
    "BFHDY": {"returns": [-2.0, 26.5,  -0.5,  6.5, 14.5, 10.0], "yield": 2.85, "turnover": 8,  "start_nav":  95.00, "aum_b":  55.2},
    "BFTEC": {"returns": [46.0, 30.5, -29.7, 52.5, 30.0, 18.0], "yield": 0.60, "turnover": 6,  "start_nav": 340.00, "aum_b":  62.8},
    "BFHLT": {"returns": [18.0, 19.5,  -5.5,  4.0,  1.5,  8.0], "yield": 1.45, "turnover": 5,  "start_nav": 230.00, "aum_b":  22.4},
    "BFFIN": {"returns": [-1.5, 35.0, -10.5, 12.0, 26.0, 12.5], "yield": 1.95, "turnover": 7,  "start_nav":  90.00, "aum_b":  14.8},
    "BFDIS": {"returns": [47.0, 12.0, -36.0, 31.5, 18.5, 11.0], "yield": 0.70, "turnover": 9,  "start_nav": 160.00, "aum_b":   8.6},
    "BFSTP": {"returns": [10.5, 16.5,  -1.0,  0.5, 13.0,  7.0], "yield": 2.40, "turnover": 5,  "start_nav": 170.00, "aum_b":  14.2},
    "BFIND": {"returns": [11.5, 21.0,  -7.0, 18.5, 17.0, 11.5], "yield": 1.30, "turnover": 6,  "start_nav": 210.00, "aum_b":  12.5},
    "BFENE": {"returns": [-33.5,55.0,  61.0, -2.0,  5.5,  6.0], "yield": 3.30, "turnover": 7,  "start_nav":  65.00, "aum_b":   8.8},
    "BFMAT": {"returns": [20.5, 27.0, -12.0, 12.5,  1.0,  7.5], "yield": 1.70, "turnover": 8,  "start_nav": 145.00, "aum_b":   5.2},
    "BFCOM": {"returns": [26.0, 18.0, -39.5, 46.0, 28.5, 14.0], "yield": 0.90, "turnover": 7,  "start_nav":  80.00, "aum_b":  10.4},
    "BFUTL": {"returns": [ 0.5, 14.0,   1.5, -7.0, 22.5,  9.0], "yield": 2.90, "turnover": 6,  "start_nav": 145.00, "aum_b":   6.8},
    "BFREI": {"returns": [-4.7, 40.4, -26.2, 11.5,  4.5,  6.5], "yield": 3.60, "turnover": 8,  "start_nav":  85.00, "aum_b":  18.5},
    "BFDEV": {"returns": [ 9.7, 11.2, -15.3, 17.5,  5.0, 11.0], "yield": 3.05, "turnover": 3,  "start_nav":  48.00, "aum_b":  62.5},
    "BFEMG": {"returns": [15.2,  0.9, -17.7,  9.3, 10.5, 12.5], "yield": 2.70, "turnover": 6,  "start_nav":  45.00, "aum_b":  45.8},
    "BFEUR": {"returns": [ 5.0, 16.5, -15.0, 19.5,  3.5, 12.0], "yield": 3.20, "turnover": 4,  "start_nav":  55.00, "aum_b":  18.2},
    "BFPAC": {"returns": [14.0,  1.5, -15.5, 14.0,  7.5,  9.5], "yield": 2.85, "turnover": 4,  "start_nav":  70.00, "aum_b":  12.4},
    "BFITT": {"returns": [ 7.5, -2.6, -10.5,  4.0,  2.0,  4.5], "yield": 4.05, "turnover": 40, "start_nav":  65.00, "aum_b":  28.4},
    "BFLTT": {"returns": [17.5, -5.0, -29.3,  3.0, -7.5,  3.0], "yield": 4.40, "turnover": 35, "start_nav":  90.00, "aum_b":   8.6},
    "BFSTC": {"returns": [ 5.3, -0.5,  -5.6,  5.7,  5.5,  5.0], "yield": 4.75, "turnover": 55, "start_nav":  80.00, "aum_b":  22.8},
    "BFITC": {"returns": [ 9.4, -1.7, -13.9,  7.5,  3.0,  5.5], "yield": 5.05, "turnover": 60, "start_nav":  95.00, "aum_b":  16.4},
    "BFLTC": {"returns": [13.5, -1.0, -25.7,  9.0, -1.5,  4.0], "yield": 5.60, "turnover": 55, "start_nav": 100.00, "aum_b":   8.2},
}

MANAGERS = [
    ("Sarah Chen",       "CFA", "Senior Portfolio Manager",          2003, 2010, "B.S., University of Michigan; M.B.A., Wharton School of the University of Pennsylvania"),
    ("Michael Torres",   "CFA", "Portfolio Manager",                 2008, 2014, "B.S., Cornell University; M.S., New York University"),
    ("Jennifer Walsh",   "CFA", "Principal and Portfolio Manager",   1999, 2008, "B.A., Yale University; M.B.A., Harvard Business School"),
    ("David Kim",        "CFA", "Portfolio Manager",                 2012, 2016, "B.S., Massachusetts Institute of Technology; M.S., Carnegie Mellon University"),
    ("Rachel Goldstein", "CFA", "Senior Portfolio Manager",          2005, 2012, "B.S., Northwestern University; M.B.A., University of Chicago Booth School"),
    ("James Okonkwo",    "CFA", "Portfolio Manager",                 2014, 2018, "B.S., Duke University; M.B.A., Columbia Business School"),
    ("Lisa Park",        "CFA", "Principal and Portfolio Manager",   2001, 2009, "B.A., Princeton University; Ph.D., University of Chicago"),
    ("Thomas Nakamura",  "CFA", "Portfolio Manager",                 2010, 2015, "B.S., University of California, Berkeley; M.S., Stanford University"),
    ("Amanda Reyes",     "CFA", "Portfolio Manager",                 2015, 2019, "B.S., Georgetown University; M.S., Johns Hopkins University"),
    ("Christopher Obi",  "CFA", "Senior Portfolio Manager",         2006, 2011, "B.S., University of Pennsylvania; M.B.A., University of Chicago Booth School"),
    ("Priya Mehta",      "CFA", "Portfolio Manager",                 2013, 2017, "B.S., University of Texas at Austin; M.S., University of Michigan"),
    ("Daniel Reuter",    "CFA", "Senior Portfolio Manager",          2002, 2010, "B.S., Georgetown University; M.B.A., Columbia Business School"),
]

YEARS = [2020, 2021, 2022, 2023, 2024, 2025]

# ── Style factory ──────────────────────────────────────────────────────────────

def make_styles():
    s = {}
    s['cover_fund']   = ParagraphStyle('cover_fund',   fontSize=22, fontName='Helvetica-Bold',  textColor=WHITE,  leading=28, spaceAfter=6)
    s['cover_doc']    = ParagraphStyle('cover_doc',    fontSize=12, fontName='Helvetica',        textColor=colors.HexColor('#D4B896'), leading=17, spaceAfter=4)
    s['cover_ticker'] = ParagraphStyle('cover_ticker', fontSize=11, fontName='Helvetica-Bold',   textColor=ACCENT, leading=16)
    s['cover_date']   = ParagraphStyle('cover_date',   fontSize=9,  fontName='Helvetica',        textColor=colors.HexColor('#B0A898'), leading=13)
    s['h1']      = ParagraphStyle('h1',      fontSize=13, fontName='Helvetica-Bold', textColor=NAVY,  leading=17, spaceBefore=16, spaceAfter=5)
    s['h2']      = ParagraphStyle('h2',      fontSize=10.5, fontName='Helvetica-Bold', textColor=NAVY, leading=14, spaceBefore=10, spaceAfter=4)
    s['h3']      = ParagraphStyle('h3',      fontSize=9.5, fontName='Helvetica-Bold', textColor=NAVY, leading=13, spaceBefore=8, spaceAfter=3)
    s['body']    = ParagraphStyle('body',    fontSize=8.5, fontName='Helvetica', textColor=colors.HexColor('#2D2D2D'), leading=13, spaceAfter=5, alignment=TA_JUSTIFY)
    s['body_nb'] = ParagraphStyle('body_nb', fontSize=8.5, fontName='Helvetica', textColor=colors.HexColor('#2D2D2D'), leading=13, spaceAfter=2, alignment=TA_JUSTIFY)
    s['small']   = ParagraphStyle('small',   fontSize=7,   fontName='Helvetica', textColor=MUTED, leading=10, spaceAfter=3, alignment=TA_JUSTIFY)
    s['label']   = ParagraphStyle('label',   fontSize=7.5, fontName='Helvetica-Bold', textColor=MUTED, leading=11, spaceAfter=2, spaceBefore=6)
    s['toc']     = ParagraphStyle('toc',     fontSize=9,   fontName='Helvetica', textColor=NAVY, leading=14, spaceAfter=2)
    s['toc_h']   = ParagraphStyle('toc_h',   fontSize=9,   fontName='Helvetica-Bold', textColor=NAVY, leading=14, spaceAfter=4, spaceBefore=6)
    s['callout'] = ParagraphStyle('callout', fontSize=8.5, fontName='Helvetica', textColor=colors.HexColor('#2D2D2D'), leading=13, spaceAfter=4, alignment=TA_JUSTIFY)
    s['callout_h']= ParagraphStyle('callout_h', fontSize=9, fontName='Helvetica-Bold', textColor=NAVY, leading=13, spaceAfter=4)
    s['bullet']  = ParagraphStyle('bullet',  fontSize=8.5, fontName='Helvetica', textColor=colors.HexColor('#2D2D2D'), leading=13, spaceAfter=4, leftIndent=12, firstLineIndent=-12, alignment=TA_JUSTIFY)
    s['footnote']= ParagraphStyle('footnote',fontSize=7,   fontName='Helvetica', textColor=MUTED, leading=10, spaceAfter=2)
    s['right']   = ParagraphStyle('right',   fontSize=8.5, fontName='Helvetica', textColor=colors.HexColor('#2D2D2D'), leading=13, alignment=TA_RIGHT)
    return s


# ── Utility helpers ────────────────────────────────────────────────────────────

def section_rule(story, title, styles):
    """Accent HR + H1 heading for major sections."""
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=2, color=ACCENT, spaceAfter=4))
    story.append(Paragraph(title, styles['h1']))


def header_block(story, fund_name, ticker, doc_label, styles):
    """Navy masthead with fund name, doc type, ticker, date."""
    left_cell  = [Paragraph(f"<b>{fund_name}</b>", styles['cover_fund']),
                  Paragraph(f"Ticker: <b>{ticker}</b>", styles['cover_ticker'])]
    right_cell = [Paragraph(doc_label, styles['cover_doc']),
                  Paragraph("Effective January 1, 2026", styles['cover_date']),
                  Paragraph("As Supplemented May 1, 2026", styles['cover_date'])]
    tbl = Table([[left_cell, right_cell]], colWidths=[4.2*inch, 2.8*inch])
    tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,-1), NAVY),
        ('TOPPADDING',   (0,0), (-1,-1), 22),
        ('BOTTOMPADDING',(0,0), (-1,-1), 22),
        ('LEFTPADDING',  (0,0), (0,-1),  30),
        ('RIGHTPADDING', (1,0), (1,-1),  20),
        ('VALIGN',       (0,0), (-1,-1), 'TOP'),
        ('ALIGN',        (1,0), (1,-1),  'RIGHT'),
    ]))
    story.append(tbl)


def callout_box(story, title, paragraphs, styles):
    """Light gray shaded callout box (like Vanguard's 'What Are Index Funds?' box)."""
    inner = []
    if title:
        inner.append(Paragraph(title, styles['callout_h']))
    for p in paragraphs:
        inner.append(Paragraph(p, styles['callout']))
    tbl = Table([[inner]], colWidths=[6.5*inch])
    tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,-1), LIGHT_GRAY),
        ('BOX',          (0,0), (-1,-1), 0.75, BORDER),
        ('LEFTPADDING',  (0,0), (-1,-1), 14),
        ('RIGHTPADDING', (0,0), (-1,-1), 14),
        ('TOPPADDING',   (0,0), (-1,-1), 10),
        ('BOTTOMPADDING',(0,0), (-1,-1), 10),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 6))


def get_managers_for_fund(ticker):
    """Return 3 managers for this fund deterministically from ticker hash."""
    h = int(hashlib.md5(ticker.encode()).hexdigest(), 16)
    idxs = []
    n = len(MANAGERS)
    for i in range(3):
        idxs.append((h + i * 7) % n)
    # ensure distinct
    seen = set()
    result = []
    for idx in idxs:
        while idx in seen:
            idx = (idx + 1) % n
        seen.add(idx)
        result.append(MANAGERS[idx])
    return result


def compute_financial_highlights(ticker):
    """
    Compute per-share financial highlights for 2021–2025.
    NAV at start of 2021 = start_nav.
    returns list has indices 0=2020,1=2021,2=2022,3=2023,4=2024,5=2025.
    For each year i in 2021-2025 (returns index 1-5):
      nii = yield_rate * nav_begin
      nav_end = nav_begin * (1 + r) - nii
      unrealized_gain = nav_begin * r - nii  (but split as net_realized+net_unrealized = total_op - nii)
    """
    fd = FUND_RETURNS[ticker]
    returns = fd["returns"]  # [2020..2025]
    y = fd["yield"] / 100.0
    nav = fd["start_nav"]  # start of 2021
    aum = fd["aum_b"]

    rows = []
    for i, year in enumerate(range(2021, 2026)):
        r = returns[i + 1] / 100.0   # index 1=2021 .. 5=2025
        nav_begin = nav
        nii = y * nav_begin
        cap_gain = nav_begin * r - nii
        nav_end = nav_begin * (1 + r) - nii
        total_ops = nii + cap_gain
        dist_nii = nii
        dist_cap = max(0.0, cap_gain * 0.5) if cap_gain > 0 else 0.0
        total_dist = dist_nii + dist_cap
        nav_after_dist = nav_end - dist_cap
        total_return = returns[i + 1]
        # AUM: scale aum_b back proportionally
        aum_year = aum * (nav_after_dist / fd["start_nav"]) * 0.9  # rough scaling
        rows.append({
            "year": year,
            "nav_begin": nav_begin,
            "nii": nii,
            "cap_gain": cap_gain,
            "total_ops": total_ops,
            "dist_nii": dist_nii,
            "dist_cap": dist_cap,
            "total_dist": total_dist,
            "nav_end": nav_after_dist,
            "total_return": total_return,
            "aum": aum_year,
            "exp_ratio": fd.get("exp_ratio", FUND_RETURNS[ticker].get("exp_ratio", None)),
            "turnover": fd["turnover"],
            "yield_rate": y * 100,
        })
        nav = nav_after_dist
    return rows


def expense_example(er, periods=(1, 3, 5, 10)):
    """SEC formula: cost = 10000 * ((1.05 + er)^N - 1.05^N) rounded to nearest dollar."""
    er_dec = er / 100.0
    result = []
    for n in periods:
        cost = 10000 * ((1.05 + er_dec)**n - 1.05**n)
        result.append(int(round(cost)))
    return result


def cagr(returns_pct_list, years):
    """Compound annual growth rate over last `years` entries."""
    if years > len(returns_pct_list):
        years = len(returns_pct_list)
    sub = returns_pct_list[-years:]
    product = 1.0
    for r in sub:
        product *= (1 + r / 100.0)
    return (product ** (1.0 / years) - 1) * 100.0


def build_bar_chart(returns_pct, years_list, width=6.5*inch, height=1.8*inch):
    """
    Build an annual returns bar chart using Drawing primitives.
    Navy bars for positive returns, dark red for negative.
    Value labels floating above/below each bar.
    """
    n = len(returns_pct)
    margin_l = 30
    margin_r = 10
    margin_t = 20
    margin_b = 35
    chart_w = width - margin_l - margin_r
    chart_h = height - margin_t - margin_b

    max_val = max(abs(v) for v in returns_pct) * 1.15
    if max_val == 0:
        max_val = 10

    bar_w = chart_w / n * 0.6
    bar_gap = chart_w / n

    d = Drawing(width, height)

    # Zero axis y position
    zero_y = margin_b + (chart_h * max_val) / (2 * max_val)

    # Draw zero line
    d.add(Line(margin_l, zero_y, margin_l + chart_w, zero_y,
               strokeColor=BORDER, strokeWidth=0.5))

    # Draw grid lines
    for pct in [-40, -20, 0, 20, 40, 60]:
        if abs(pct) <= max_val:
            gy = margin_b + chart_h * (pct + max_val) / (2 * max_val)
            d.add(Line(margin_l, gy, margin_l + chart_w, gy,
                       strokeColor=BORDER, strokeWidth=0.3))

    for i, (ret, yr) in enumerate(zip(returns_pct, years_list)):
        bar_x = margin_l + i * bar_gap + (bar_gap - bar_w) / 2
        bar_color = NAVY if ret >= 0 else DARK_RED

        # Bar height in points
        bar_pix = chart_h * abs(ret) / (2 * max_val)

        if ret >= 0:
            bar_y = zero_y
            lbl_y = zero_y + bar_pix + 3
        else:
            bar_y = zero_y - bar_pix
            lbl_y = zero_y - bar_pix - 8

        d.add(Rect(bar_x, bar_y, bar_w, (bar_pix if ret >= 0 else bar_pix),
                   fillColor=bar_color, strokeColor=None))
        if ret < 0:
            # draw downward bar
            d.add(Rect(bar_x, zero_y - bar_pix, bar_w, bar_pix,
                       fillColor=bar_color, strokeColor=None))

        # Value label
        label_text = f"{ret:+.1f}%"
        d.add(String(bar_x + bar_w / 2, lbl_y, label_text,
                     fontSize=5.5, fillColor=BLACK,
                     textAnchor='middle'))

        # Year label
        d.add(String(bar_x + bar_w / 2, margin_b - 14, str(yr),
                     fontSize=6, fillColor=MUTED,
                     textAnchor='middle'))

    return d


def get_risk_profile(group, category, risk_level):
    """Return list of (risk_name, risk_text) tuples appropriate for this fund type."""
    is_bond = group == "Fixed Income"
    is_intl = group == "International"
    is_sector = group == "Sector Equity"

    common = [
        ("Market Risk",
         "The possibility that stock prices overall will decline. Stock markets tend to move in cycles, "
         "with periods of rising prices and periods of falling prices. The market value of a security may "
         "decline due to general market conditions that are not specifically related to a particular company, "
         "such as real or perceived adverse economic conditions, changes in the general outlook for corporate "
         "earnings, changes in interest or currency rates, or adverse investor sentiment generally."),
        ("Index Sampling Risk",
         "The Fund uses a sampling approach to track its benchmark. It may not hold every security in the "
         "index, and the securities it does hold may not be held in the same proportions as in the index. "
         "As a result, the Fund may have greater tracking error than a fund that fully replicates the index."),
        ("Tracking Error Risk",
         "The Fund may not perfectly replicate the performance of its benchmark index due to transaction "
         "costs, timing of purchases and sales, differences in the valuation of portfolio securities, "
         "and the effects of the Fund's expenses. There can be no assurance that the Fund will achieve "
         "a high degree of correlation with the index."),
        ("Liquidity Risk",
         "The Fund may not be able to sell a security at a favorable price due to lack of willing buyers "
         "in the market for that security. Liquidity risk is greatest for securities that are thinly traded, "
         "have a limited number of market participants, or are otherwise difficult to value. During periods "
         "of market stress, liquidity can deteriorate quickly."),
    ]

    equity_specific = [
        ("Concentration Risk",
         "The Fund's benchmark index may be heavily weighted in particular industries or economic sectors. "
         "When the index is concentrated, the Fund's performance may be more volatile than the performance "
         "of more broadly diversified funds. Concentration in a single sector can expose investors to "
         "heightened risk from adverse developments in that sector."),
        ("Large-, Mid-, or Small-Cap Risk",
         "Stocks of smaller companies may be subject to greater volatility than larger companies. "
         "Smaller companies generally have less liquidity than larger companies and may have fewer "
         "resources to deal with adverse business or economic developments. Their prices may be more "
         "volatile and their trading markets may be less liquid than those of larger companies."),
    ]

    bond_specific = [
        ("Interest Rate Risk",
         "An increase in interest rates will generally cause bond prices to fall. The longer the "
         "duration of a bond, the more sensitive its price is to changes in interest rates. The Fund "
         "invests in bonds with a range of maturities; rising interest rates may cause the value of "
         "the Fund's investments to decline."),
        ("Credit Risk",
         "The risk that a bond issuer will fail to pay interest or principal in a timely manner, or "
         "that negative perceptions of the issuer's ability to make such payments will cause the price "
         "of that bond to decline. Credit risk should be evaluated carefully for corporate bonds, "
         "which may be rated below investment grade."),
        ("Income Risk",
         "The Fund's income will likely decline if and when interest rates fall. Income risk is "
         "generally highest for shorter-duration funds, which hold shorter-maturity bonds that "
         "are reinvested at prevailing rates more quickly."),
        ("Prepayment Risk",
         "In a falling interest rate environment, certain fixed income securities may be prepaid "
         "earlier than expected. Prepayments generally accelerate when interest rates decline, "
         "and when a security is prepaid, the Fund may have to invest the proceeds in securities "
         "with lower yields."),
    ]

    intl_specific = [
        ("Currency Risk",
         "Because the Fund may invest in securities denominated in, and/or receiving revenues in, "
         "foreign currencies, the Fund will be subject to currency risk. This is the risk that those "
         "currencies will decline in value relative to the U.S. dollar or, in the case of hedged "
         "positions, that the U.S. dollar will decline in value relative to the currency being hedged."),
        ("Country/Regional Risk",
         "The Fund's investments in securities of foreign issuers may involve risks not present in "
         "domestic investments. For example, there may be less publicly available information about "
         "non-U.S. issuers and non-U.S. reporting standards may differ from U.S. GAAP in important ways."),
        ("Emerging Market Risk",
         "Investments in securities of issuers in emerging markets may involve heightened risks, "
         "including but not limited to (i) less liquid markets and smaller market capitalizations, "
         "(ii) greater price volatility, (iii) a more limited number of market makers, (iv) currency "
         "exchange rate fluctuations, (v) greater political and economic uncertainties, and "
         "(vi) restrictions on foreign investment or transfer of assets."),
    ]

    sector_specific = [
        ("Sector Concentration Risk",
         "Because the Fund concentrates its investments in a particular industry segment, its "
         "performance is largely tied to the performance of that sector. This means the Fund's "
         "shares could be more volatile and/or decline more than those of a broadly diversified fund."),
        ("Regulatory Risk",
         "Companies in many industries are subject to extensive government regulation, which may "
         "restrict their prices, investments, products, or services. Changes in applicable law or "
         "regulation can have unpredictable and potentially significant impacts on sector performance."),
    ]

    risks = list(common)
    if is_bond:
        risks.extend(bond_specific)
    else:
        risks.extend(equity_specific)
    if is_intl:
        risks.extend(intl_specific)
    if is_sector:
        risks.extend(sector_specific)

    # Always include
    risks.append(("Investment Style Risk",
        "Returns from the types of stocks or bonds in which the Fund invests may trail returns from "
        "the overall stock market. Growth stocks can be volatile, while value stocks may underperform "
        "in rising markets. Different investment styles may come in and out of favor depending "
        "on market conditions and investor sentiment."))

    risks.append(("Geopolitical and Sanctions Risk",
        "The increasing interconnectivity between global economies and financial markets increases "
        "the likelihood that events or conditions in one region or financial market may adversely "
        "impact issuers in a different country, region, or financial market. Securities in the Fund's "
        "portfolio may underperform due to inflation, interest rates, global demand for goods and services, "
        "natural disasters, pandemics, epidemics, terrorism, regulatory events, and governmental or "
        "quasi-governmental actions."))

    risks.append(("Potential Redemption Activity Risk",
        "The Fund could experience a loss when selling securities to meet redemption requests if "
        "the redemption requests are unusually large or frequent or occur in times of overall market "
        "turmoil or declining prices for the securities sold. In addition, redemptions may cause the "
        "Fund to sell securities at an inopportune time and price."))

    return risks


def get_strategies_text(ticker, name, category, group, exp, benchmark, risk, holdings, min_inv, dist_freq):
    """Return list of strategy paragraphs tailored by asset class."""
    is_bond = group == "Fixed Income"
    is_intl = group == "International"

    paras = [
        f"The {name} employs an indexing investment approach designed to track the performance "
        f"of the {benchmark}. The Fund attempts to replicate the target index by investing all, "
        f"or substantially all, of its assets in the stocks (or bonds) that make up the index, "
        f"holding each security in approximately the same proportion as its weighting in the index.",

        f"In certain circumstances, the Advisor may purchase securities not included in the index "
        f"if the Advisor believes such securities will help the Fund track the index. For example, "
        f"the Advisor may purchase a security not in the index if a security in the index is temporarily "
        f"unavailable or if the Advisor believes it will help reduce transaction costs.",

        f"The Fund currently invests in approximately {holdings:,} securities. Under normal "
        f"circumstances, at least 80% of the Fund's assets will be invested in securities included "
        f"in the {benchmark}. The 20% allowance permits the Fund to invest in other instruments "
        f"including derivatives, cash and cash equivalents, and securities not in the index.",
    ]

    if is_bond:
        paras.append(
            f"The Fund may invest in U.S. dollar-denominated investment-grade fixed income securities, "
            f"including U.S. Treasury securities, agency securities, mortgage-backed securities, and "
            f"corporate bonds. The Fund's average duration generally tracks that of the benchmark index, "
            f"which is periodically reported in the Fund's shareholder reports."
        )
    elif is_intl:
        paras.append(
            f"The Fund invests in securities denominated in non-U.S. currencies and may hold securities "
            f"of companies located in both developed and emerging market countries, as represented in "
            f"the {benchmark}. The Fund does not attempt to hedge its foreign currency exposure."
        )
    else:
        paras.append(
            f"The Fund invests primarily in common stocks of U.S. companies whose market capitalizations "
            f"fall within the range of the {benchmark}. The Fund attempts to match the performance of "
            f"the index before operating costs, which reduces the need for active management decisions."
        )

    return paras


def get_index_description(benchmark, group, category):
    """Return 2-3 paragraphs describing the benchmark index."""
    if "S&amp;P 500" in benchmark or "S&P 500" in benchmark:
        return [
            "The S&amp;P 500 Index measures the performance of 500 large-capitalization U.S. companies, "
            "covering approximately 80% of the available U.S. equity market capitalization. The index "
            "is maintained by S&amp;P Dow Jones Indices and is widely regarded as the best single gauge "
            "of large-cap U.S. equities.",
            "Constituent companies must meet certain eligibility criteria including a minimum float-adjusted "
            "market capitalization of $15.8 billion, a minimum annual dollar value traded of 1.0 times the "
            "float-adjusted market cap, and must be organized in the United States. The index is rebalanced "
            "quarterly, and changes are made when companies no longer meet the criteria for inclusion.",
        ]
    elif "CRSP" in benchmark:
        return [
            f"The {benchmark} is maintained by the Center for Research in Security Prices (CRSP) at the "
            f"University of Chicago Booth School of Business. CRSP indexes are designed to represent the "
            f"investable U.S. equity market and are reconstituted quarterly.",
            "CRSP uses a rules-based methodology to define market capitalization breakpoints for its "
            "various indexes. Securities that fall near a breakpoint are placed in 'buffer zones' to "
            "reduce reconstitution-related turnover, which benefits index funds by lowering trading costs.",
        ]
    elif "Bloomberg" in benchmark:
        return [
            f"The {benchmark} is maintained by Bloomberg Index Services Limited. Bloomberg fixed income "
            f"indexes are widely used benchmarks for the U.S. bond market. The index includes publicly "
            f"issued, dollar-denominated, fixed-rate, non-convertible, investment grade bonds.",
            "Bonds must have a minimum maturity of one year, be rated investment grade by at least two "
            "of three major rating agencies (Moody's, S&amp;P, Fitch), and meet minimum face amount outstanding "
            "requirements. The index is rebalanced monthly on the last calendar day of the month.",
        ]
    elif "FTSE" in benchmark:
        return [
            f"The {benchmark} is maintained by FTSE Russell, a subsidiary of the London Stock Exchange "
            f"Group. FTSE indexes are constructed using a rules-based methodology designed to reflect "
            f"investable market opportunities.",
            "Companies are assigned to countries and sectors based on FTSE's country classification "
            "framework and Industry Classification Benchmark (ICB). The index is reviewed semi-annually "
            "in March and September, with quarterly reviews for certain size-related changes.",
        ]
    elif "MSCI" in benchmark:
        return [
            f"The {benchmark} is maintained by MSCI Inc. MSCI indexes use a rules-based methodology "
            f"that is designed to provide a broad and fair representation of the investable market. "
            f"The 25/50 diversification constraint ensures no single stock exceeds 25% of the index "
            f"and that stocks with a weight of 5% or more collectively represent no more than 50%.",
            "The index is rebalanced quarterly in February, May, August, and November. MSCI applies "
            "a buffer methodology to minimize unnecessary turnover while maintaining index integrity.",
        ]
    else:
        return [
            f"The {benchmark} is a rules-based index designed to represent the performance of the "
            f"{category.lower()} segment of the investment universe. The index methodology specifies "
            f"eligibility criteria, weighting rules, and reconstitution schedules.",
            "The index provider reviews the index composition on a regular schedule and makes changes "
            "based on shifts in the market environment and constituent eligibility. The Fund tracks "
            "the index with minimal tracking error.",
        ]


# ── Boilerplate sections (shared across all funds) ────────────────────────────

INVESTING_BOILERPLATE = """
Bob's Mutual Funds, Inc. offers two classes of shares: <b>Investor Shares</b>, available to all investors
with a minimum initial investment of $1, and <b>Select Shares</b>, available to investors with an initial
investment of at least $100,000. Select Shares carry a slightly lower expense ratio due to the larger
asset base they represent.
"""

SHARE_CLASS_CONVERSION = """
Investor Shares held in an account may be converted to Select Shares if the account balance reaches
$100,000 or more at the time of conversion. Conversions are made at the relative net asset values
of the two share classes and are not taxable events. Bob's Mutual Funds, Inc. reserves the right
to convert Investor Shares to Select Shares automatically when eligibility requirements are met.
"""

PRICING_BOILERPLATE = """
The price you pay or receive when you buy or sell shares is the Fund's next-determined net asset
value (NAV) per share. The Fund calculates its NAV after the close of the regular trading session
of the New York Stock Exchange (NYSE), generally 4 p.m., Eastern time, on each day the NYSE is
open for trading. NAV is calculated by dividing the total value of the Fund's net assets by the
number of Fund shares outstanding.
"""

FAIR_VALUE_BOILERPLATE = """
Securities held by the Fund are valued using prices provided by independent pricing services or,
in certain cases, as determined by the Fund's Board of Trustees. When market prices are not readily
available, or the Board determines that available prices are not reliable, the Board may value Fund
securities at fair value based on the Board's good-faith determination of what a security is worth.
Fair-value pricing is used most commonly for non-U.S. securities.
"""

TAX_BULLETS = [
    "The Fund intends to distribute substantially all of its net investment income and realized capital gains.",
    "Fund distributions are generally taxable as ordinary income, qualified dividends, or capital gains.",
    "Qualified dividend income is taxed at preferential long-term capital gains rates for eligible shareholders.",
    "Distributions from net short-term capital gains are taxable as ordinary income.",
    "If you invest through a tax-deferred account such as an IRA or 401(k), your distributions may not be currently taxable.",
    "Any gain or loss you realize on redemption of Fund shares will generally be treated as capital gain or loss.",
    "Long-term capital gains (on shares held more than one year) are taxed at preferential federal income tax rates.",
    "The Fund is required to withhold 24% of taxable distributions and redemption proceeds paid to U.S. shareholders who have not provided a certified taxpayer identification number.",
    "Non-U.S. shareholders are subject to withholding tax at rates established by applicable tax treaties.",
    "The Fund may engage in strategies that generate short-term capital gains, which are taxed as ordinary income.",
    "Each year, the Fund will send shareholders a Form 1099-DIV or 1099-B reporting distributions and any proceeds from redemptions.",
    "You should consult your own tax advisor for advice about the particular federal, state, and local tax consequences to you of an investment in the Fund.",
]

TRADING_EXCEPTIONS = [
    "Automatic investment plans and systematic withdrawals",
    "Transactions involving rollovers from qualified retirement plans",
    "Systematic rebalancing within a fund family",
    "Transactions by registered investment advisers managing discretionary accounts",
    "Transactions in money market funds",
    "Dividend reinvestment plan purchases",
    "Transactions that are otherwise deemed by the Fund to be in the best interests of the Fund and its shareholders",
    "Transactions by fund of funds vehicles that invest in this Fund",
    "Transactions initiated by a court order or legal process",
    "Redemptions due to death or disability",
    "Redemptions to pay advisory fees under fee-based programs",
    "Minimum required distributions from retirement accounts",
]

RESERVATION_TEXT = """
Bob's Mutual Funds, Inc. reserves the right to: (1) suspend the offering of Fund shares;
(2) reject any purchase order; (3) stop honoring exchange requests; (4) modify or impose fees
for purchases, exchanges, or redemptions; (5) change any minimum investment requirement or
account balance requirement; (6) redeem shares held in accounts that fall below the minimum
balance requirement after proper notice; and (7) modify or terminate the exchange privilege.
Such changes may be made without prior notice to shareholders.
"""


# ── Main prospectus generator ──────────────────────────────────────────────────

def _xe(s):
    """Escape a string for use inside ReportLab Paragraph (XML context)."""
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def gen_prospectus(path, fund, styles):
    ticker, name, category, group, exp, benchmark, risk, holdings, min_inv, dist_freq = fund
    # Two forms: raw for table cells, xml-escaped for Paragraph text
    benchmark_raw = benchmark
    benchmark = _xe(benchmark)   # use this in all Paragraph() calls
    name = _xe(name)
    fd = FUND_RETURNS[ticker]
    all_returns = fd["returns"]       # 2020-2025
    fund_yield = fd["yield"]
    turnover   = fd["turnover"]

    doc = SimpleDocTemplate(
        path, pagesize=letter,
        topMargin=0.55*inch, bottomMargin=0.65*inch,
        leftMargin=0.75*inch, rightMargin=0.75*inch
    )
    story = []

    # ── COVER ──────────────────────────────────────────────────────────────────
    header_block(story, name, ticker, "Prospectus", styles)
    story.append(Spacer(1, 0.12*inch))

    story.append(Paragraph(
        "The Securities and Exchange Commission (SEC) has not approved or disapproved these securities "
        "or passed upon the adequacy of this Prospectus. Any representation to the contrary is a criminal offense.",
        styles['small']
    ))
    story.append(Spacer(1, 0.06*inch))

    # ── TABLE OF CONTENTS ──────────────────────────────────────────────────────
    section_rule(story, "Table of Contents", styles)
    toc_items = [
        ("Fund Summary", 2),
        ("  Investment Objective", 2),
        ("  Fees and Expenses", 2),
        ("  Principal Investment Strategies", 3),
        ("  Principal Risks", 3),
        ("  Annual Total Returns", 4),
        ("  Average Annual Total Returns", 4),
        ("  Investment Advisor", 5),
        ("  Portfolio Managers", 5),
        ("  Purchase and Sale of Fund Shares", 5),
        ("  Tax Information", 5),
        ("  Payments to Financial Intermediaries", 5),
        ("More on the Fund", 6),
        ("  Investment Objective and Strategies (Expanded)", 6),
        ("  More on Fund Risks", 8),
        ("  Other Investment Policies", 10),
        ("  Portfolio Holdings", 11),
        ("Management and Distribution", 11),
        ("Investing in Bob's Mutual Funds", 13),
        ("  Share Classes and Pricing", 13),
        ("  Purchase, Redemption, and Exchange", 14),
        ("Reservation of Rights", 16),
        ("Dividends, Distributions, and Taxes", 16),
        ("Frequent Trading Limitations", 18),
        ("Financial Highlights", 19),
        ("Additional Information", 21),
        ("Contacting Bob's Mutual Funds", 22),
    ]
    toc_data = []
    for label, pg in toc_items:
        is_section = not label.startswith("  ")
        style = styles['toc_h'] if is_section else styles['toc']
        toc_data.append([Paragraph(label.strip(), style), Paragraph(str(pg), styles['right'])])
    toc_tbl = Table(toc_data, colWidths=[5.8*inch, 0.7*inch])
    toc_tbl.setStyle(TableStyle([
        ('TOPPADDING',   (0,0), (-1,-1), 2),
        ('BOTTOMPADDING',(0,0), (-1,-1), 2),
        ('LINEBELOW',    (0,0), (-1,-1), 0.25, BORDER),
        ('ALIGN',        (1,0), (1,-1), 'RIGHT'),
    ]))
    story.append(toc_tbl)
    story.append(PageBreak())

    # ── FUND SUMMARY ──────────────────────────────────────────────────────────
    section_rule(story, "Fund Summary", styles)

    # Investment Objective
    story.append(Paragraph("Investment Objective", styles['h2']))
    story.append(Paragraph(
        f"The {name} seeks to track the investment performance of the {benchmark}, "
        f"an index representing {category.lower()} equity" if group != "Fixed Income"
        else f"fixed income",
        styles['body']
    ))
    if group == "Fixed Income":
        story.append(Paragraph(
            f"The {name} seeks to track the investment performance of the {benchmark}, "
            f"an index of U.S. dollar-denominated, investment-grade fixed income securities.",
            styles['body']
        ))
    else:
        story.append(Paragraph(
            f"The Fund's investment objective is fundamental and may not be changed without "
            f"shareholder approval.",
            styles['body']
        ))

    # Fees and Expenses
    story.append(Paragraph("Fees and Expenses", styles['h2']))
    story.append(Paragraph(
        f"The following table describes the fees and expenses you may pay if you buy, hold, "
        f"and sell Investor Shares of the {name}.",
        styles['body']
    ))

    # Shareholder fees table
    sh_data = [
        ["Shareholder Fees", ""],
        ["(Fees paid directly from your investment)", ""],
        ["Sales Charge (Load) Imposed on Purchases", "None"],
        ["Purchase Fee", "None"],
        ["Sales Charge (Load) Imposed on Reinvested Dividends", "None"],
        ["Redemption Fee", "None"],
        ["Account Service Fee (accounts under $10,000)", "$25/year"],
    ]
    sh_tbl = Table(sh_data, colWidths=[5.2*inch, 1.3*inch])
    sh_tbl.setStyle(TableStyle([
        ('FONTNAME',     (0,0), (-1,0), 'Helvetica-Bold'),
        ('BACKGROUND',   (0,0), (-1,0), NAVY),
        ('TEXTCOLOR',    (0,0), (-1,0), WHITE),
        ('FONTNAME',     (0,1), (-1,1), 'Helvetica'),
        ('FONTSIZE',     (0,0), (-1,-1), 8),
        ('GRID',         (0,0), (-1,-1), 0.5, BORDER),
        ('TOPPADDING',   (0,0), (-1,-1), 4),
        ('BOTTOMPADDING',(0,0), (-1,-1), 4),
        ('LEFTPADDING',  (0,0), (-1,-1), 8),
        ('ALIGN',        (1,0), (1,-1), 'RIGHT'),
        ('RIGHTPADDING', (1,0), (1,-1), 10),
        ('ROWBACKGROUNDS',(0,2),(-1,-1),[LIGHT, WHITE]),
    ]))
    story.append(sh_tbl)
    story.append(Spacer(1, 6))

    # Annual operating expenses
    ann_data = [
        ["Annual Fund Operating Expenses", "Investor Shares", "Select Shares"],
        ["(Expenses that you pay each year as a percentage of the value of your investment)", "", ""],
        ["Management Fees",              f"{exp:.2f}%",   f"{max(0.01, exp-0.01):.2f}%"],
        ["12b-1 Distribution Fee",       "None",           "None"],
        ["Other Expenses",               "0.00%",          "0.00%"],
        ["Total Annual Fund Operating Expenses", f"{exp:.2f}%", f"{max(0.01, exp-0.01):.2f}%"],
    ]
    ann_tbl = Table(ann_data, colWidths=[3.9*inch, 1.3*inch, 1.3*inch])
    ann_tbl.setStyle(TableStyle([
        ('FONTNAME',     (0,0), (-1,0), 'Helvetica-Bold'),
        ('BACKGROUND',   (0,0), (-1,0), NAVY),
        ('TEXTCOLOR',    (0,0), (-1,0), WHITE),
        ('FONTNAME',     (0,-1), (-1,-1), 'Helvetica-Bold'),
        ('FONTSIZE',     (0,0), (-1,-1), 8),
        ('GRID',         (0,0), (-1,-1), 0.5, BORDER),
        ('TOPPADDING',   (0,0), (-1,-1), 4),
        ('BOTTOMPADDING',(0,0), (-1,-1), 4),
        ('LEFTPADDING',  (0,0), (-1,-1), 8),
        ('ALIGN',        (1,0), (-1,-1), 'RIGHT'),
        ('RIGHTPADDING', (1,0), (-1,-1), 10),
        ('ROWBACKGROUNDS',(0,2),(-1,-2),[LIGHT, WHITE]),
    ]))
    story.append(ann_tbl)
    story.append(Spacer(1, 6))

    # Example cost table
    story.append(Paragraph("Example", styles['h3']))
    story.append(Paragraph(
        "This example is intended to help you compare the cost of investing in the Fund with the cost "
        "of investing in other mutual funds. The example assumes that you invest $10,000 in the Fund "
        "for the time periods indicated and then redeem all of your shares at the end of those periods. "
        "The example also assumes that your investment has a 5% annual return and that the Fund's "
        "operating expenses remain the same. Although your actual costs may be higher or lower, "
        "based on these assumptions your costs would be:",
        styles['body']
    ))
    costs = expense_example(exp)
    cost_data = [
        ["1 Year", "3 Years", "5 Years", "10 Years"],
        [f"${costs[0]}", f"${costs[1]}", f"${costs[2]}", f"${costs[3]}"],
    ]
    cost_tbl = Table(cost_data, colWidths=[1.625*inch]*4)
    cost_tbl.setStyle(TableStyle([
        ('FONTNAME',     (0,0), (-1,0), 'Helvetica-Bold'),
        ('BACKGROUND',   (0,0), (-1,0), NAVY),
        ('TEXTCOLOR',    (0,0), (-1,0), WHITE),
        ('FONTNAME',     (0,1), (-1,1), 'Helvetica-Bold'),
        ('FONTSIZE',     (0,0), (-1,-1), 9),
        ('ALIGN',        (0,0), (-1,-1), 'CENTER'),
        ('GRID',         (0,0), (-1,-1), 0.5, BORDER),
        ('TOPPADDING',   (0,0), (-1,-1), 6),
        ('BOTTOMPADDING',(0,0), (-1,-1), 6),
        ('BACKGROUND',   (0,1), (-1,1), LIGHT),
    ]))
    story.append(cost_tbl)

    # Portfolio Turnover
    story.append(Spacer(1, 8))
    story.append(Paragraph("Portfolio Turnover", styles['h3']))
    story.append(Paragraph(
        f"The Fund pays transaction costs, such as commissions, when it buys and sells securities "
        f"(or \"turns over\" its portfolio). A higher portfolio turnover rate may indicate higher "
        f"transaction costs and may result in more taxes when Fund shares are held in a taxable "
        f"account. These costs, which are not reflected in annual Fund operating expenses or in the "
        f"preceding example, affect the Fund's performance. During the most recent fiscal year, the "
        f"Fund's portfolio turnover rate was {turnover}% of the average value of its portfolio.",
        styles['body']
    ))

    # Principal Investment Strategies
    story.append(Paragraph("Principal Investment Strategies", styles['h2']))
    for p in get_strategies_text(ticker, name, category, group, exp, benchmark, risk, holdings, min_inv, dist_freq):
        story.append(Paragraph(p, styles['body']))

    # Principal Risks
    story.append(Paragraph("Principal Risks", styles['h2']))
    story.append(Paragraph(
        f"An investment in the Fund is subject to investment risks; therefore, you may lose money "
        f"by investing in the Fund. The Fund is considered a {risk.lower()} risk investment. "
        f"There can be no guarantee that the Fund will achieve its investment objective.",
        styles['body']
    ))
    risks = get_risk_profile(group, category, risk)
    for rname, rtext in risks[:7]:   # summary shows ~7 risks
        story.append(Paragraph(f"<b>{rname}.</b> {rtext}", styles['bullet']))

    # Annual Total Returns bar chart
    story.append(Paragraph("Annual Total Returns", styles['h2']))
    story.append(Paragraph(
        f"The following bar chart shows changes in the Fund's performance (Investor Shares) from "
        f"year to year. The chart does not reflect any sales loads. Past performance is not an "
        f"indication of future results.",
        styles['body']
    ))

    chart = build_bar_chart(all_returns, YEARS)
    story.append(chart)
    story.append(Spacer(1, 4))

    # Best/worst quarter callout
    best_idx = all_returns.index(max(all_returns))
    worst_idx = all_returns.index(min(all_returns))
    bq_data = [
        [Paragraph(f"<b>Best Quarter:</b> {YEARS[best_idx]} Q2: {all_returns[best_idx]:.1f}%", styles['body_nb']),
         Paragraph(f"<b>Worst Quarter:</b> {YEARS[worst_idx]} Q3: {all_returns[worst_idx]:.1f}%", styles['body_nb'])],
    ]
    bq_tbl = Table(bq_data, colWidths=[3.25*inch, 3.25*inch])
    bq_tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,-1), LIGHT),
        ('BOX',          (0,0), (-1,-1), 0.5, BORDER),
        ('TOPPADDING',   (0,0), (-1,-1), 6),
        ('BOTTOMPADDING',(0,0), (-1,-1), 6),
        ('LEFTPADDING',  (0,0), (-1,-1), 10),
    ]))
    story.append(bq_tbl)
    story.append(Spacer(1, 6))

    # Average Annual Total Returns table
    story.append(Paragraph("Average Annual Total Returns", styles['h2']))
    story.append(Paragraph(
        "The following table shows the Fund's average annual total returns for Investor Shares "
        "compared with its benchmark index. After-tax returns are calculated using the highest "
        "individual federal marginal income tax rates and do not reflect the impact of state and "
        "local taxes. Actual after-tax returns depend on your tax situation and may differ from "
        "those shown below.",
        styles['body']
    ))

    r1  = all_returns[-1]
    r3  = cagr(all_returns, 3)
    r5  = cagr(all_returns, 5)
    # After-tax rough approximation
    tax_rate = 0.238
    r1_at  = r1  * (1 - tax_rate * 0.5)
    r3_at  = r3  * (1 - tax_rate * 0.5)
    r5_at  = r5  * (1 - tax_rate * 0.5)
    r1_ats = r1  * (1 - tax_rate * 0.7)
    r3_ats = r3  * (1 - tax_rate * 0.7)
    r5_ats = r5  * (1 - tax_rate * 0.7)
    # Benchmark slightly higher (index has no costs)
    bm1  = r1  + exp / 100
    bm3  = r3  + exp / 100
    bm5  = r5  + exp / 100

    def fmt(v):
        return f"{v:.2f}%"

    avg_data = [
        ["", "1 Year", "3 Years", "5 Years"],
        [f"{name} (Investor Shares)\nBefore Taxes", fmt(r1), fmt(r3), fmt(r5)],
        ["After Taxes on Distributions",            fmt(r1_at), fmt(r3_at), fmt(r5_at)],
        ["After Taxes on Distributions and Sale of Fund Shares", fmt(r1_ats), fmt(r3_ats), fmt(r5_ats)],
        [benchmark_raw + "\n(reflects no deduction for fees or expenses)", fmt(bm1), fmt(bm3), fmt(bm5)],
    ]
    avg_tbl = Table(avg_data, colWidths=[3.5*inch, 1.0*inch, 1.0*inch, 1.0*inch])
    avg_tbl.setStyle(TableStyle([
        ('FONTNAME',     (0,0), (-1,0), 'Helvetica-Bold'),
        ('BACKGROUND',   (0,0), (-1,0), NAVY),
        ('TEXTCOLOR',    (0,0), (-1,0), WHITE),
        ('FONTNAME',     (0,4), (-1,4), 'Helvetica-Bold'),
        ('BACKGROUND',   (0,4), (-1,4), LIGHT),
        ('FONTSIZE',     (0,0), (-1,-1), 7.5),
        ('GRID',         (0,0), (-1,-1), 0.5, BORDER),
        ('TOPPADDING',   (0,0), (-1,-1), 4),
        ('BOTTOMPADDING',(0,0), (-1,-1), 4),
        ('LEFTPADDING',  (0,0), (-1,-1), 8),
        ('ALIGN',        (1,0), (-1,-1), 'RIGHT'),
        ('RIGHTPADDING', (1,0), (-1,-1), 8),
        ('ROWBACKGROUNDS',(0,1),(-1,3),[LIGHT, WHITE, LIGHT]),
    ]))
    story.append(avg_tbl)

    # Investment Advisor
    story.append(Paragraph("Investment Advisor", styles['h2']))
    story.append(Paragraph(
        "Bob's Mutual Funds, Inc. serves as the investment advisor for the Fund.",
        styles['body']
    ))

    # Portfolio Managers
    story.append(Paragraph("Portfolio Managers", styles['h2']))
    mgrs = get_managers_for_fund(ticker)
    for mgr_name, cred, title, mgmt_since, joined, edu in mgrs:
        story.append(Paragraph(
            f"<b>{mgr_name}, {cred}</b>, {title}. Has managed the Fund since {mgmt_since}.",
            styles['body_nb']
        ))

    # Purchase and Sale
    story.append(Paragraph("Purchase and Sale of Fund Shares", styles['h2']))
    story.append(Paragraph(
        f"You may purchase or sell (redeem) shares of the Fund on any day that the New York Stock Exchange "
        f"(NYSE) is open for business. The minimum investment is ${min_inv:,}. You may conduct transactions "
        f"directly with Bob's Mutual Funds by mail, telephone, or online at www.bobsmutualfunds.com. "
        f"You may also purchase or sell shares through a broker-dealer, financial advisor, or other "
        f"financial intermediary.",
        styles['body']
    ))

    # Tax Information
    story.append(Paragraph("Tax Information", styles['h2']))
    story.append(Paragraph(
        f"The Fund's distributions are generally taxable to you as ordinary income or capital gains, "
        f"unless you are investing through a tax-advantaged account, such as an IRA or a 401(k) plan. "
        f"If you invest through a tax-advantaged account, you may be taxed later upon withdrawal of "
        f"money from that account. The Fund distributes income {dist_freq.lower()}.",
        styles['body']
    ))

    # Payments to Intermediaries
    story.append(Paragraph("Payments to Financial Intermediaries", styles['h2']))
    story.append(Paragraph(
        "The Fund and its affiliates do not pay financial intermediaries for sales of Fund shares or "
        "related services. Therefore, if you purchase the Fund through a financial intermediary, the "
        "intermediary may charge you a fee for its services, which fee is not reflected in this Prospectus.",
        styles['body']
    ))

    story.append(PageBreak())

    # ── MORE ON THE FUND ───────────────────────────────────────────────────────
    section_rule(story, "More on the Fund", styles)
    story.append(Paragraph(
        f"This section of the Prospectus provides more information about the Fund's investment "
        f"objective, strategies, and risks. It should be read together with the Fund Summary section.",
        styles['body']
    ))

    # Investment Objective (expanded)
    story.append(Paragraph("Investment Objective and Principal Investment Strategies", styles['h2']))
    story.append(Paragraph(
        f"The Fund's investment objective is to track the investment performance of the {benchmark}. "
        f"This investment objective is fundamental and may not be changed without the approval of a "
        f"majority of the outstanding voting securities of the Fund (as defined in the Investment "
        f"Company Act of 1940).",
        styles['body']
    ))

    # What Are Index Funds? callout
    callout_box(story, "What Are Index Funds?", [
        "Index funds are mutual funds (or ETFs) that seek to track the performance of a specific market "
        "index — such as the S&amp;P 500 Index or the Bloomberg U.S. Aggregate Bond Index — rather than "
        "attempting to select individual securities that will outperform the market.",
        "Index funds generally have lower expenses than actively managed funds, because they require less "
        "ongoing research and decision-making. Over long time horizons, many actively managed funds have "
        "underperformed their benchmark indexes after accounting for fees and expenses. Index funds "
        "provide a cost-effective way to gain broad market exposure.",
        "Bob's Mutual Funds has been a pioneer in low-cost index investing since 2010. Our philosophy "
        "is straightforward: keep costs low, stay fully invested, and let the market work for you.",
    ], styles)

    # Implementation paragraph
    story.append(Paragraph(
        f"The Fund uses an indexing investment approach. The Advisor does not try to outperform the "
        f"index — it tries to match it. The Fund invests all, or substantially all, of its assets in "
        f"the securities that make up the {benchmark}. At least 80% of the Fund's assets will be "
        f"invested in securities included in the index or in securities that the Advisor believes "
        f"will help the Fund track the index.",
        styles['body']
    ))

    story.append(Paragraph(
        f"The Fund may become non-diversified, as defined under the Investment Company Act of 1940, "
        f"solely as a result of a change in relative market capitalization or index weighting of one "
        f"or more constituents of the index. A non-diversified fund can invest a greater percentage "
        f"of its assets in a single company than a diversified fund, which means the Fund could be "
        f"subject to greater volatility than a more diversified fund.",
        styles['body']
    ))

    # Security Selection
    story.append(Paragraph("Security Selection", styles['h3']))
    story.append(Paragraph(
        f"The Fund uses a replication strategy for most of its portfolio — that is, it tries to hold "
        f"all of the securities in the index in approximately the same proportions as they appear in "
        f"the index. In cases where full replication is not practical (for example, when the index "
        f"contains a very large number of securities, or when certain securities are illiquid), the "
        f"Fund uses a sampling strategy, holding a representative subset of the index.",
        styles['body']
    ))
    story.append(Paragraph(
        f"The Fund currently holds approximately {holdings:,} securities. This is {'all' if holdings < 200 else 'a representative sample of'} "
        f"the securities in the {benchmark}. The Fund aims to match the index's key risk characteristics, "
        f"including sector weightings, duration (for bond funds), credit quality, and geographic exposure.",
        styles['body']
    ))

    # Index description
    story.append(Paragraph(f"About the {benchmark}", styles['h3']))
    for p in get_index_description(benchmark, group, category):
        story.append(Paragraph(p, styles['body']))

    # Asset-weighted median table
    if group != "Fixed Income":
        story.append(Paragraph("Fund Characteristics", styles['h3']))
        char_data = [
            ["Characteristic", "Fund", "Benchmark"],
            ["Number of Stocks", f"{holdings:,}", f"{holdings:,}"],
            ["Median Market Cap", "$—", "$—"],
            ["P/E Ratio (trailing)", "—", "—"],
            ["Price/Book Ratio", "—", "—"],
            ["Earnings Growth Rate (3-yr)", "—%", "—%"],
            ["Foreign Holdings", "—%", "—%"],
        ]
    else:
        story.append(Paragraph("Fund Characteristics", styles['h3']))
        char_data = [
            ["Characteristic", "Fund", "Benchmark"],
            ["Number of Bonds", f"{holdings:,}", f"{holdings:,}"],
            ["Average Coupon", "—%", "—%"],
            ["Average Duration", "— years", "— years"],
            ["Average Maturity", "— years", "— years"],
            ["Average Quality", "—", "—"],
            ["Yield to Maturity", f"{fund_yield:.2f}%", f"{fund_yield:.2f}%"],
        ]
    char_tbl = Table(char_data, colWidths=[3.0*inch, 1.75*inch, 1.75*inch])
    char_tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,0), NAVY),
        ('TEXTCOLOR',    (0,0), (-1,0), WHITE),
        ('FONTNAME',     (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE',     (0,0), (-1,-1), 8),
        ('GRID',         (0,0), (-1,-1), 0.5, BORDER),
        ('TOPPADDING',   (0,0), (-1,-1), 4),
        ('BOTTOMPADDING',(0,0), (-1,-1), 4),
        ('LEFTPADDING',  (0,0), (-1,-1), 8),
        ('ALIGN',        (1,0), (-1,-1), 'CENTER'),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[LIGHT, WHITE]),
    ]))
    story.append(char_tbl)
    story.append(Paragraph(
        "Data as of December 31, 2025. Figures represent a snapshot and will change over time.",
        styles['footnote']
    ))
    story.append(Spacer(1, 6))

    story.append(PageBreak())

    # ── MORE ON FUND RISKS ─────────────────────────────────────────────────────
    section_rule(story, "More on Fund Risks", styles)
    story.append(Paragraph(
        f"The following expands on the risk factors summarized in the Fund Summary section. "
        f"This section does not attempt to describe every potential risk. Additional risks are "
        f"described in the Statement of Additional Information.",
        styles['body']
    ))

    all_risks = get_risk_profile(group, category, risk)
    for rname, rtext in all_risks:
        story.append(Paragraph(f"<b>{rname}.</b>", styles['h3']))
        story.append(Paragraph(rtext, styles['body']))
        # Add a second paragraph of expansion for major risks
        if rname == "Market Risk":
            story.append(Paragraph(
                "Market risk includes the risk of sharp market declines, which can result from events "
                "such as recessions, natural disasters, epidemics or pandemics, changes in interest rates, "
                "and geopolitical events. These risks are generally not specific to any particular company "
                "but affect broad market segments. The Fund does not attempt to reduce this risk through "
                "hedging or defensive repositioning.",
                styles['body']
            ))
        elif rname == "Interest Rate Risk":
            story.append(Paragraph(
                "Bond prices move inversely to interest rates. When the Federal Reserve or other central "
                "banks raise interest rates, existing bond prices typically fall. Longer-duration bonds are "
                "more sensitive to rate changes than shorter-duration bonds. If the Fund holds bonds with "
                "longer maturities, it will have greater interest rate sensitivity.",
                styles['body']
            ))

    story.append(PageBreak())

    # ── OTHER INVESTMENT POLICIES ──────────────────────────────────────────────
    section_rule(story, "Other Investment Policies", styles)

    story.append(Paragraph("Substitute Index", styles['h2']))
    story.append(Paragraph(
        f"If the {benchmark} is discontinued or if the Advisor determines that it is in the best "
        f"interests of Fund shareholders, the Advisor may substitute a different index. In such a "
        f"case, the Fund would seek to track the new index. The Advisor will notify shareholders "
        f"of any change in the Fund's benchmark index.",
        styles['body']
    ))

    story.append(Paragraph("Foreign Securities", styles['h2']))
    story.append(Paragraph(
        f"The Fund may invest in securities of foreign companies, including American Depositary "
        f"Receipts (ADRs), European Depositary Receipts (EDRs), and similar instruments. Foreign "
        f"securities involve additional risks including currency fluctuation, less liquidity, less "
        f"regulatory oversight, and political risk. "
        + (f"The {name} holds a significant portion of its assets in foreign securities as required "
           f"by the composition of the {benchmark}." if group == "International"
           else f"The {name} may hold a limited portion of its assets in foreign securities."),
        styles['body']
    ))

    story.append(Paragraph("Other Types of Investments", styles['h2']))
    story.append(Paragraph(
        "The Fund may invest up to 20% of its assets in instruments other than those in its benchmark "
        "index, including derivatives (futures, options, swaps), cash and cash equivalents, and "
        "securities of companies not in the index. These investments may be used to: (i) maintain "
        "liquidity; (ii) reduce transaction costs; (iii) manage cash flows; or (iv) equitize cash "
        "holdings (for equity funds) or manage duration and yield curve exposure (for bond funds).",
        styles['body']
    ))

    story.append(Paragraph("Cash Management", styles['h2']))
    story.append(Paragraph(
        "The Fund may hold cash or cash equivalents, including money market instruments and "
        "short-term U.S. Government securities, to handle day-to-day cash needs (e.g., to pay "
        "redemptions or to invest new shareholder contributions). Holding cash creates a 'cash "
        "drag' that can cause the Fund to underperform the index during rising markets.",
        styles['body']
    ))

    story.append(Paragraph("Temporary Defensive Measures", styles['h2']))
    story.append(Paragraph(
        "In response to adverse market, economic, political, or other conditions, the Fund may "
        "invest without limit in cash and cash equivalents, high-quality money market instruments, "
        "or U.S. Government securities for temporary defensive purposes. When the Fund takes a "
        "temporary defensive position, it may not achieve its investment objective.",
        styles['body']
    ))

    # Portfolio Holdings
    story.append(Paragraph("Portfolio Holdings", styles['h2']))
    story.append(Paragraph(
        f"The Fund discloses its complete portfolio holdings on a quarterly basis on its website at "
        f"www.bobsmutualfunds.com and in its regulatory filings with the SEC. Holdings information "
        f"reflects the Fund's portfolio as of the date of the filing. A description of the Fund's "
        f"policies and procedures with respect to portfolio holdings disclosure is available in the "
        f"Statement of Additional Information.",
        styles['body']
    ))

    story.append(PageBreak())

    # ── MANAGEMENT AND DISTRIBUTION ───────────────────────────────────────────
    section_rule(story, "Management and Distribution of the Fund", styles)

    # Corporate structure callout
    callout_box(story, "How Is Bob's Mutual Funds' Corporate Structure Unique?", [
        "Bob's Mutual Funds, Inc. is organized as an at-cost provider — meaning the Advisor operates "
        "the fund complex at cost, with no third-party profit motive. This structure is designed to "
        "align the interests of the Advisor with those of Fund shareholders, since the shareholders "
        "own the funds, and the funds, in turn, own the Advisor.",
        "This ownership structure means that Bob's Mutual Funds has a structural incentive to keep "
        "costs low, since every dollar saved in fund expenses goes directly to shareholders "
        "(not to outside investors or profit participants). This is why Bob's Mutual Funds has "
        "consistently offered some of the lowest expense ratios in the industry.",
    ], styles)

    story.append(Paragraph("Investment Advisor", styles['h2']))
    story.append(Paragraph(
        "Bob's Mutual Funds, Inc. (\"BMF\" or the \"Advisor\"), 100 Fund Center Drive, Malvern, "
        "Pennsylvania 19355, serves as the investment advisor for the Fund. The Advisor is "
        "registered with the SEC as an investment adviser under the Investment Advisers Act of 1940. "
        "As of December 31, 2025, the Advisor managed approximately $982 billion in assets across "
        "all of its fund offerings.",
        styles['body']
    ))
    story.append(Paragraph(
        f"For its services, the Advisor receives an annual fee from the Fund equal to {exp:.2f}% "
        f"of the Fund's average daily net assets. This fee covers all investment management, "
        f"administrative, and distribution services. The Fund bears no other ongoing expenses.",
        styles['body']
    ))
    story.append(Paragraph(
        "The Advisor has served as investment advisor to Bob's Mutual Funds since the firm's "
        "founding in 2010. A discussion of the basis for the Board of Trustees' approval of the "
        "Fund's investment advisory agreement is available in the Fund's most recent semi-annual "
        "report to shareholders.",
        styles['body']
    ))

    story.append(Paragraph("Portfolio Managers", styles['h2']))
    story.append(Paragraph(
        f"The following individuals are jointly and primarily responsible for the day-to-day "
        f"management of the Fund's portfolio:",
        styles['body']
    ))
    for mgr_name, cred, title, mgmt_since, joined, edu in get_managers_for_fund(ticker):
        years_exp = 2026 - joined
        story.append(Paragraph(f"<b>{mgr_name}, {cred}</b> — {title}", styles['h3']))
        story.append(Paragraph(
            f"{mgr_name} has managed the Fund since {mgmt_since} and has been employed in the "
            f"investment management industry since {joined} ({years_exp} years of experience). "
            f"Education: {edu}. Prior to joining Bob's Mutual Funds, {mgr_name.split()[0]} held "
            f"positions in index portfolio management at major financial institutions, specializing "
            f"in {'fixed income' if group == 'Fixed Income' else 'equity'} index replication and "
            f"portfolio construction.",
            styles['body']
        ))

    story.append(PageBreak())

    # ── INVESTING IN BOB'S MUTUAL FUNDS (boilerplate) ─────────────────────────
    section_rule(story, "Investing in Bob's Mutual Funds", styles)

    story.append(Paragraph("Share Classes", styles['h2']))
    story.append(Paragraph(INVESTING_BOILERPLATE.strip(), styles['body']))
    story.append(Spacer(1, 4))

    sc_data = [
        ["Feature", "Investor Shares", "Select Shares"],
        ["Minimum Initial Investment", f"${min_inv:,}", "$100,000"],
        ["Expense Ratio", f"{exp:.2f}%", f"{max(0.01,exp-0.01):.2f}%"],
        ["Conversion Eligible", "Yes (to Select)", "N/A"],
        ["Available to All Investors", "Yes", "Yes (if minimum met)"],
    ]
    sc_tbl = Table(sc_data, colWidths=[3.0*inch, 1.75*inch, 1.75*inch])
    sc_tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,0), NAVY),
        ('TEXTCOLOR',    (0,0), (-1,0), WHITE),
        ('FONTNAME',     (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE',     (0,0), (-1,-1), 8),
        ('GRID',         (0,0), (-1,-1), 0.5, BORDER),
        ('TOPPADDING',   (0,0), (-1,-1), 5),
        ('BOTTOMPADDING',(0,0), (-1,-1), 5),
        ('LEFTPADDING',  (0,0), (-1,-1), 8),
        ('ALIGN',        (1,0), (-1,-1), 'CENTER'),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[LIGHT, WHITE]),
    ]))
    story.append(sc_tbl)
    story.append(Spacer(1, 6))

    story.append(Paragraph("Share Class Conversions", styles['h2']))
    story.append(Paragraph(SHARE_CLASS_CONVERSION.strip(), styles['body']))

    story.append(Paragraph("Pricing of Fund Shares", styles['h2']))
    story.append(Paragraph(PRICING_BOILERPLATE.strip(), styles['body']))
    story.append(Paragraph(FAIR_VALUE_BOILERPLATE.strip(), styles['body']))
    story.append(Paragraph(
        "The Fund's NAV is not calculated on days when the NYSE is closed for trading, including "
        "New Year's Day, Martin Luther King Jr. Day, Presidents' Day, Good Friday, Memorial Day, "
        "Juneteenth National Independence Day, Independence Day, Labor Day, Thanksgiving Day, and "
        "Christmas Day.",
        styles['body']
    ))

    story.append(Paragraph("Purchase of Fund Shares", styles['h2']))
    story.append(Paragraph(
        f"You may purchase shares of the Fund directly through Bob's Mutual Funds by: "
        f"(1) Online: www.bobsmutualfunds.com; (2) Telephone: 1-800-555-BOBS (2627); "
        f"(3) Mail: Bob's Mutual Funds, P.O. Box 2999, Valley Forge, PA 19482. "
        f"You may also purchase shares through a broker-dealer or other financial intermediary. "
        f"The minimum initial investment in the Fund is ${min_inv:,} per account.",
        styles['body']
    ))
    story.append(Paragraph(
        "Payment for shares may be made by electronic bank transfer (ACH), check drawn on a "
        "U.S. bank, or wire transfer. Payment must be received within 3 business days of the "
        "purchase order. If payment is not received in time, the order may be cancelled and you "
        "could be responsible for any losses incurred.",
        styles['body']
    ))

    story.append(Paragraph("Redemption of Fund Shares", styles['h2']))
    story.append(Paragraph(
        "You may redeem shares on any business day through the same channels used to purchase "
        "shares (online, telephone, or mail). Redemption proceeds are generally sent within 1 "
        "business day of the redemption date. The Fund reserves the right to suspend redemptions "
        "or delay payment under unusual circumstances.",
        styles['body']
    ))
    story.append(Paragraph(
        "For accounts with large redemption requests (generally over $100,000), the Fund may "
        "require written instructions and a signature guarantee. This helps protect shareholders "
        "from unauthorized redemptions.",
        styles['body']
    ))

    story.append(Paragraph("Exchange Privilege", styles['h2']))
    story.append(Paragraph(
        "You may exchange shares of the Fund for shares of another Bob's Mutual Funds fund, "
        "subject to: (1) any applicable minimum investment requirements; (2) the frequent trading "
        "policy described below; and (3) other rules and restrictions. Exchanges are treated as "
        "a redemption and a purchase and may be a taxable event.",
        styles['body']
    ))

    story.append(Paragraph("Account Service Fee", styles['h2']))
    story.append(Paragraph(
        "Accounts with balances below $10,000 are subject to an annual account service fee of "
        "$25. This fee is charged to the account in December and may result in the redemption of "
        "Fund shares to cover the fee. The fee is waived for accounts enrolled in automatic "
        "investment plans.",
        styles['body']
    ))

    story.append(PageBreak())

    # ── RESERVATION OF RIGHTS ─────────────────────────────────────────────────
    section_rule(story, "Reservation of Rights", styles)
    story.append(Paragraph(RESERVATION_TEXT.strip(), styles['body']))

    # ── DIVIDENDS, DISTRIBUTIONS, AND TAXES ───────────────────────────────────
    section_rule(story, "Dividends, Distributions, and Taxes", styles)

    story.append(Paragraph("Fund Distributions", styles['h2']))
    story.append(Paragraph(
        f"The {name} distributes substantially all of its net investment income and net realized "
        f"capital gains to shareholders. Income distributions are paid {dist_freq.lower()}. "
        f"Capital gains distributions, if any, are paid annually in December. "
        f"Distributions may be reinvested automatically in additional Fund shares (at NAV) or "
        f"paid in cash, at the shareholder's election.",
        styles['body']
    ))

    story.append(Paragraph("Basic Tax Points", styles['h2']))
    for bullet in TAX_BULLETS:
        story.append(Paragraph(f"• {bullet}", styles['bullet']))

    story.append(Paragraph("General Information", styles['h2']))
    story.append(Paragraph(
        "If you do not certify your taxpayer identification number on IRS Form W-9, the Fund is "
        "required to withhold 24% of all taxable distributions and redemption proceeds ("
        "\"backup withholding\"). Non-U.S. investors may be subject to withholding at the "
        "applicable treaty rate. Bob's Mutual Funds will provide information about the tax "
        "character of distributions on IRS Forms 1099-DIV and 1099-B.",
        styles['body']
    ))

    story.append(PageBreak())

    # ── FREQUENT TRADING LIMITATIONS ──────────────────────────────────────────
    section_rule(story, "Frequent Trading Limitations", styles)

    story.append(Paragraph("Overview", styles['h2']))
    story.append(Paragraph(
        "Frequent trading (also called market timing) can disrupt Fund management and raise costs "
        "for long-term shareholders. Excessive short-term trading may force the Fund to sell "
        "securities at inopportune times to meet redemptions, generating taxable gains and "
        "increasing transaction costs.",
        styles['body']
    ))

    story.append(Paragraph("Frequent Trading Policy", styles['h2']))
    story.append(Paragraph(
        "The Fund discourages short-term trading. If you sell or exchange shares of the Fund "
        "within 30 calendar days of purchasing them, the Fund may reject your future purchase "
        "or exchange order (\"the 30-day rule\"). The Fund's Board of Trustees may modify or "
        "eliminate this policy at any time.",
        styles['body']
    ))

    story.append(Paragraph("Exceptions", styles['h2']))
    story.append(Paragraph(
        "The following transactions are generally excepted from the 30-day rule:",
        styles['body']
    ))
    for exc in TRADING_EXCEPTIONS:
        story.append(Paragraph(f"• {exc}", styles['bullet']))

    story.append(Paragraph("Accounts Held by Institutions", styles['h2']))
    story.append(Paragraph(
        "Accounts held by financial intermediaries on behalf of multiple underlying investors "
        "(\"omnibus accounts\") may be subject to different trading monitoring procedures. "
        "The Fund will work with omnibus account holders to monitor for excessive trading, "
        "but the Fund may not be able to identify all instances of excessive trading in such accounts.",
        styles['body']
    ))

    story.append(PageBreak())

    # ── FINANCIAL HIGHLIGHTS ───────────────────────────────────────────────────
    section_rule(story, "Financial Highlights", styles)
    story.append(Paragraph(
        f"The following table is intended to help you understand the Fund's financial performance "
        f"for the past five fiscal years. Certain information reflects financial results for a "
        f"single Fund share. The total returns in the table represent the rate that an investor "
        f"would have earned (or lost) on an investment in the Fund (assuming reinvestment of all "
        f"dividends and distributions). This information has been derived from the Fund's financial "
        f"statements, which have been audited by PricewaterhouseCoopers LLP.",
        styles['body']
    ))

    highlights = compute_financial_highlights(ticker)

    # Build header
    fh_header = ["", "2025", "2024", "2023", "2022", "2021"]
    fh_rows = [fh_header]

    row_labels = [
        ("Net Asset Value, Beginning of Period", "nav_begin"),
        ("INVESTMENT OPERATIONS", None),
        ("  Net Investment Income (Loss)", "nii"),
        ("  Net Realized and Unrealized Gain (Loss)", "cap_gain"),
        ("  Total from Investment Operations", "total_ops"),
        ("DISTRIBUTIONS", None),
        ("  Dividends from Net Investment Income", "dist_nii"),
        ("  Distributions from Realized Capital Gains", "dist_cap"),
        ("  Total Distributions", "total_dist"),
        ("Net Asset Value, End of Period", "nav_end"),
        ("Total Return", "total_return"),
        ("RATIOS/SUPPLEMENTAL DATA", None),
        ("  Net Assets, End of Period (Millions)", "aum"),
        ("  Ratio of Total Expenses to Average Net Assets", None),
        ("  Ratio of Net Investment Income to Average Net Assets", None),
        ("  Portfolio Turnover Rate", None),
    ]

    yr_map = {h["year"]: h for h in highlights}

    def fh_val(key, h):
        if key is None:
            return ""
        v = h.get(key)
        if v is None:
            return "—"
        if key == "total_return":
            return f"{v:.2f}%"
        if key == "aum":
            return f"${v:.1f}"
        return f"${v:.2f}"

    for label, key in row_labels:
        is_section = key is None and label.isupper()
        row = [label]
        for year in [2025, 2024, 2023, 2022, 2021]:
            h = yr_map.get(year, {})
            if key is None:
                if label == "  Ratio of Total Expenses to Average Net Assets":
                    row.append(f"{exp:.2f}%")
                elif label == "  Ratio of Net Investment Income to Average Net Assets":
                    row.append(f"{fund_yield:.2f}%")
                elif label == "  Portfolio Turnover Rate":
                    row.append(f"{turnover}%")
                else:
                    row.append("")
            else:
                row.append(fh_val(key, h))
        fh_rows.append(row)

    col_w = [3.2*inch] + [0.66*inch] * 5
    fh_tbl = Table(fh_rows, colWidths=col_w)
    ts = [
        ('FONTNAME',     (0,0), (-1,0), 'Helvetica-Bold'),
        ('BACKGROUND',   (0,0), (-1,0), NAVY),
        ('TEXTCOLOR',    (0,0), (-1,0), WHITE),
        ('FONTSIZE',     (0,0), (-1,-1), 7),
        ('GRID',         (0,0), (-1,-1), 0.3, BORDER),
        ('TOPPADDING',   (0,0), (-1,-1), 3),
        ('BOTTOMPADDING',(0,0), (-1,-1), 3),
        ('LEFTPADDING',  (0,0), (-1,-1), 5),
        ('ALIGN',        (1,0), (-1,-1), 'RIGHT'),
        ('RIGHTPADDING', (1,0), (-1,-1), 6),
    ]
    # Section header rows — bold and LIGHT background
    section_rows = [i for i, (label, key) in enumerate(row_labels) if key is None]
    for ri in section_rows:
        actual = ri + 1  # +1 for header
        ts.append(('BACKGROUND', (0, actual), (-1, actual), LIGHT))
        ts.append(('FONTNAME',   (0, actual), (-1, actual), 'Helvetica-Bold'))
    # Alternating rows
    for ri in range(len(fh_rows)):
        if ri == 0 or ri in [r + 1 for r in section_rows]:
            continue
        if ri % 2 == 0:
            ts.append(('BACKGROUND', (0, ri), (-1, ri), colors.HexColor('#FAFAF8')))
    fh_tbl.setStyle(TableStyle(ts))
    story.append(fh_tbl)

    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "1. Total returns do not reflect any applicable account service fees.",
        styles['footnote']
    ))
    story.append(Paragraph(
        "2. Net investment income per share represents the net investment income divided by average shares outstanding.",
        styles['footnote']
    ))
    story.append(Paragraph(
        "3. Net realized and unrealized gain (loss) per share may not agree with aggregate net realized and unrealized gain (loss) for the period due to timing of share transactions.",
        styles['footnote']
    ))
    story.append(Paragraph(
        "4. Total distributions per share may differ from the sum of per-share distributions shown above due to rounding.",
        styles['footnote']
    ))

    story.append(PageBreak())

    # ── ADDITIONAL INFORMATION ────────────────────────────────────────────────
    section_rule(story, "Additional Information", styles)

    story.append(Paragraph("Precautionary Note to Investment Companies", styles['h2']))
    story.append(Paragraph(
        "For purposes of the Investment Company Act of 1940, any registered investment company or "
        "private fund that acquires Fund shares is subject to certain conditions and restrictions. "
        "Such an investor should consult with its legal counsel before investing in the Fund.",
        styles['body']
    ))

    story.append(Paragraph("Forum Selection", styles['h2']))
    story.append(Paragraph(
        "Pursuant to the Fund's Declaration of Trust, any claim brought by or on behalf of a "
        "shareholder against the Fund or its trustees, officers, or agents must be brought "
        "exclusively in the Court of Chancery of the State of Delaware (or, if that court "
        "lacks jurisdiction, the Superior Court of the State of Delaware or the U.S. District "
        "Court for the District of Delaware).",
        styles['body']
    ))

    story.append(Paragraph("Shareholder Rights", styles['h2']))
    story.append(Paragraph(
        "Shareholders are entitled to vote on certain matters as described in the Fund's "
        "Declaration of Trust and By-Laws, including the election of Trustees and the "
        "approval of material changes to the Fund's fundamental investment policies. "
        "Each share is entitled to one vote.",
        styles['body']
    ))

    story.append(Paragraph("Securities Market Indexes", styles['h2']))
    story.append(Paragraph(
        f"The {benchmark} is maintained by the index provider and is not sponsored, endorsed, "
        f"sold, or promoted by Bob's Mutual Funds. The index provider makes no representation "
        f"regarding the advisability of investing in the Fund. The index provider is not "
        f"responsible for any inaccuracies in the index data.",
        styles['body']
    ))

    story.append(Paragraph("Fund Identification", styles['h2']))
    cusip_seed = int(hashlib.md5(ticker.encode()).hexdigest()[:8], 16) % 100000000
    fi_data = [
        ["Fund", "Inception Date", "Fund Number", "CUSIP", "Newspaper Abbr."],
        [name, "January 1, 2010", f"BMF-{abs(cusip_seed) % 9000 + 1000}", f"09259{abs(cusip_seed) % 90000 + 10000}", ticker],
    ]
    fi_tbl = Table(fi_data, colWidths=[2.0*inch, 1.1*inch, 1.0*inch, 1.2*inch, 1.2*inch])
    fi_tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,0), NAVY),
        ('TEXTCOLOR',    (0,0), (-1,0), WHITE),
        ('FONTNAME',     (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE',     (0,0), (-1,-1), 7.5),
        ('GRID',         (0,0), (-1,-1), 0.5, BORDER),
        ('TOPPADDING',   (0,0), (-1,-1), 5),
        ('BOTTOMPADDING',(0,0), (-1,-1), 5),
        ('LEFTPADDING',  (0,0), (-1,-1), 6),
        ('BACKGROUND',   (0,1), (-1,1), LIGHT),
    ]))
    story.append(fi_tbl)
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        f"{benchmark} is a trademark/service mark of its respective owner. Bob's Mutual Funds "
        f"is not affiliated with, sponsored by, or endorsed by the index provider.",
        styles['footnote']
    ))

    story.append(PageBreak())

    # ── CONTACTING BOB'S MUTUAL FUNDS ─────────────────────────────────────────
    section_rule(story, "Contacting Bob's Mutual Funds", styles)
    contact_data = [
        ["Method", "Details"],
        ["Website",   "www.bobsmutualfunds.com"],
        ["Telephone", "1-800-555-BOBS (2627)  |  Monday–Friday 8 a.m.–8 p.m. Eastern"],
        ["Mail",      "Bob's Mutual Funds, P.O. Box 2999, Valley Forge, PA 19482"],
        ["Overnight", "Bob's Mutual Funds, 100 Fund Center Drive, Malvern, PA 19355"],
        ["TDD/TTY",   "1-800-555-2628 (for hearing-impaired investors)"],
    ]
    ct_tbl = Table(contact_data, colWidths=[1.5*inch, 5.0*inch])
    ct_tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,0), NAVY),
        ('TEXTCOLOR',    (0,0), (-1,0), WHITE),
        ('FONTNAME',     (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTNAME',     (0,1), (0,-1), 'Helvetica-Bold'),
        ('TEXTCOLOR',    (0,1), (0,-1), NAVY),
        ('FONTSIZE',     (0,0), (-1,-1), 8.5),
        ('GRID',         (0,0), (-1,-1), 0.5, BORDER),
        ('TOPPADDING',   (0,0), (-1,-1), 6),
        ('BOTTOMPADDING',(0,0), (-1,-1), 6),
        ('LEFTPADDING',  (0,0), (-1,-1), 10),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[LIGHT, WHITE]),
    ]))
    story.append(ct_tbl)

    # Back panel
    story.append(Spacer(1, 0.3*inch))
    story.append(HRFlowable(width="100%", thickness=1.5, color=ACCENT, spaceAfter=8))
    story.append(Paragraph("For More Information", styles['h2']))

    back_data = [
        ["Annual/Semi-Annual Reports",
         "Provide audited financial statements, a complete list of portfolio holdings, "
         "and a letter from the portfolio management team discussing the Fund's performance."],
        ["Statement of Additional Information (SAI)",
         "Contains detailed information about the Fund's operations, including investment "
         "restrictions, management, and brokerage practices. The SAI is incorporated by "
         "reference into this Prospectus."],
        ["SEC EDGAR",
         "The Fund's Prospectus, SAI, shareholder reports, and other information are "
         "available free of charge on the SEC's website at www.sec.gov/cgi-bin/browse-edgar."],
        ["Direct from Bob's",
         "Call 1-800-555-BOBS or visit www.bobsmutualfunds.com to receive any of these "
         "documents free of charge by mail, email, or to view them online."],
    ]
    bp_tbl = Table(back_data, colWidths=[1.8*inch, 4.7*inch])
    bp_tbl.setStyle(TableStyle([
        ('FONTNAME',     (0,0), (0,-1), 'Helvetica-Bold'),
        ('TEXTCOLOR',    (0,0), (0,-1), NAVY),
        ('FONTSIZE',     (0,0), (-1,-1), 8),
        ('TOPPADDING',   (0,0), (-1,-1), 5),
        ('BOTTOMPADDING',(0,0), (-1,-1), 5),
        ('LEFTPADDING',  (0,0), (-1,-1), 6),
        ('GRID',         (0,0), (-1,-1), 0.5, BORDER),
        ('ROWBACKGROUNDS',(0,0),(-1,-1),[LIGHT, WHITE]),
    ]))
    story.append(bp_tbl)

    story.append(Spacer(1, 0.2*inch))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Before investing, carefully consider the Fund's investment objectives, risks, charges, and expenses. "
        "This Prospectus contains this and other important information about the Fund. Read it carefully "
        "before you invest or send money. All investing is subject to risk, including the possible loss of "
        "the money you invest. Diversification does not ensure a profit or protect against a loss. "
        "Past performance is no guarantee of future results. "
        "Bob's Mutual Funds, Inc. is a registered investment company. "
        "SEC File Number: 811-XXXXX. "
        "© 2026 Bob's Mutual Funds, Inc. All rights reserved.",
        styles['small']
    ))

    doc.build(story)
    return path


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir   = os.path.join(script_dir, '..', 'customer-app', 'public', 'fund-docs')

    styles = make_styles()
    total  = len(FUNDS)
    done   = 0

    for fund in FUNDS:
        ticker = fund[0]
        fund_dir = os.path.join(base_dir, ticker.lower())
        os.makedirs(fund_dir, exist_ok=True)
        out_path = os.path.join(fund_dir, 'prospectus.pdf')
        gen_prospectus(out_path, fund, styles)
        done += 1
        print(f"[{done}/{total}] {ticker} — prospectus.pdf")

    print(f"\nDone. {total} PDFs written to {os.path.abspath(base_dir)}")


if __name__ == '__main__':
    main()
