// On-brand design tokens — copied from customer-app/src/theme.ts so the console matches
// Bob's visual language (deep navy + cognac, warm off-white surfaces, Source Serif headings).

export const theme = {
  color: {
    primary:        '#0F2340',
    primaryHover:   '#16315A',
    primarySoft:    '#E8ECF3',
    primarySoftBorder: '#C7D0E0',
    primaryDeep:    '#081429',

    accent:         '#A05A2C',
    accentSoft:     '#F4EAE0',

    bg:             '#FBF9F4',
    surface:        '#FFFFFF',
    surfaceMuted:   '#F4F1EA',
    surfaceWell:    '#F8F5EE',

    border:         '#E5DFD2',
    borderStrong:   '#D5CCB6',

    text:           '#1A1814',
    textMuted:      '#6B645A',
    textSubtle:     '#9A9286',
    textOnPrimary:  '#FBF9F4',

    success:        '#2F6B4F',
    successSoft:    '#E6EFE9',
    successBorder:  '#B8CFC1',
    warning:        '#A8741F',
    warningSoft:    '#FBF1DC',
    warningBorder:  '#E8C788',
    danger:         '#9A2B2B',
    dangerSoft:     '#F5E2E0',
  },

  font: {
    sans: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    serif: '"Source Serif 4", "Source Serif Pro", Georgia, "Times New Roman", serif',
    mono: 'ui-monospace, "SF Mono", Consolas, monospace',
  },

  radius: { sm: 4, md: 8, lg: 10, xl: 12, pill: 999 },

  shadow: {
    sm: '0 1px 2px rgba(15, 35, 64, 0.06)',
    md: '0 2px 8px rgba(15, 35, 64, 0.08)',
    lg: '0 8px 28px rgba(15, 35, 64, 0.12)',
    xl: '0 16px 48px rgba(15, 35, 64, 0.18)',
    fab: '0 6px 22px rgba(15, 35, 64, 0.28)',
  },
} as const;

export type Theme = typeof theme;

/** Categorical chart palette derived from the brand tokens. */
export const CHART_COLORS = [
  '#0F2340', '#A05A2C', '#537194', '#C89065', '#2F6B4F',
  '#8A9BB4', '#A8741F', '#9A2B2B', '#6B8F7C', '#D5CCB6',
];
