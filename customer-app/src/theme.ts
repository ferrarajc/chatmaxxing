/**
 * Direction A — Editorial Trust
 *
 * Single source of truth for color, type, radius, and shadow.
 * Aesthetic-only — no behavior or layout values live here.
 */

export const theme = {
  color: {
    // ── Brand ──────────────────────────────────────────────
    primary:        '#0F2340', // deep navy — buttons, accents, customer bubbles
    primaryHover:   '#16315A',
    primarySoft:    '#E8ECF3', // tinted-navy fill — pill bg, callout bg
    primarySoftBorder: '#C7D0E0',
    primaryDeep:    '#081429', // hero gradient anchor

    accent:         '#A05A2C', // cognac — secondary highlights, ticker symbol
    accentSoft:     '#F4EAE0',

    // ── Surfaces ───────────────────────────────────────────
    bg:             '#FBF9F4', // warm off-white page bg
    surface:        '#FFFFFF',
    surfaceMuted:   '#F4F1EA', // subtle band (table headers, inactive pills)
    surfaceWell:    '#F8F5EE', // chat greeting well, suggested-reply well

    // ── Lines ──────────────────────────────────────────────
    border:         '#E5DFD2', // warm hairline
    borderStrong:   '#D5CCB6',

    // ── Text ───────────────────────────────────────────────
    text:           '#1A1814',
    textMuted:      '#6B645A',
    textSubtle:     '#9A9286',
    textOnPrimary:  '#FBF9F4',

    // ── Semantic ───────────────────────────────────────────
    success:        '#2F6B4F',
    successSoft:    '#E6EFE9',
    successBorder:  '#B8CFC1',
    warning:        '#A8741F',
    warningSoft:    '#FBF1DC',
    warningBorder:  '#E8C788',
    danger:         '#9A2B2B',
    dangerSoft:     '#F5E2E0',

    // ── Chat bubbles ───────────────────────────────────────
    botBubble:      '#F4F1EA',
    agentBubble:    '#E8ECF3',
    customerBubble: '#0F2340', // matches primary for customer-side messages
  },

  font: {
    sans: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    serif: '"Source Serif 4", "Source Serif Pro", Georgia, "Times New Roman", serif',
    mono: 'ui-monospace, "SF Mono", Consolas, monospace',
  },

  radius: {
    sm: 4,
    md: 8,
    lg: 10,
    xl: 12,
    pill: 999,
  },

  shadow: {
    sm: '0 1px 2px rgba(15, 35, 64, 0.06)',
    md: '0 2px 8px rgba(15, 35, 64, 0.08)',
    lg: '0 8px 28px rgba(15, 35, 64, 0.12)',
    xl: '0 16px 48px rgba(15, 35, 64, 0.18)',
    fab: '0 6px 22px rgba(15, 35, 64, 0.28)',
  },
} as const;

export type Theme = typeof theme;
