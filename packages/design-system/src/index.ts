/**
 * The shared visual language: a high-contrast "manga print" look — paper
 * background, thick ink outlines, hard offset shadows with no blur, and skewed
 * cards.
 *
 * Both apps consume these values. React Native reads them directly; Web maps
 * them to CSS custom properties during startup with `webThemeVariables`.
 */
export const palette = {
  /** Outline and body text. Every border in the design is this colour. */
  ink: "#1f2235",
  inkMuted: "#555b70",
  inkFaint: "#6c7488",

  /** Page background, and the slightly deeper tone it gradients into. */
  paper: "#f2f4f7",
  paperDeep: "#eef1f6",
  /** Card fill. Cards are white on paper, never paper on paper. */
  card: "#ffffff",

  /** Hairlines inside a card, where a full ink border would be too loud. */
  rule: "#dfe3eb",
  ruleStrong: "#ccd1dc",
  /** The soft drop shadow used by list rows, as opposed to the ink one. */
  shadowSoft: "#d9dde6",
  /** Unfilled portion of a stat bar. */
  track: "#e4e7ed",

  cyan: "#009bd6",
  cyanBright: "#00e5ff",
  blue: "#009dff",
  purple: "#8e2dff",

  danger: "#e53935",
  warning: "#ffea00",
  positive: "#00b37e",
} as const;

/** Semantic aliases, so screens name a role rather than a colour. */
export const colors = {
  background: palette.paper,
  surface: palette.card,
  primary: palette.purple,
  accent: palette.cyan,
  text: palette.ink,
  muted: palette.inkMuted,
  danger: palette.danger,
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

/** Corners stay nearly square — the look is printed, not glassy. */
export const radius = { sm: 2, md: 4, lg: 8, pill: 999 } as const;

export const border = { hairline: 1, thin: 2, thick: 3 } as const;

/**
 * Offset shadows are drawn with zero blur, which is what makes them read as
 * ink rather than as depth. `dx` is negative because the light in this design
 * comes from the upper right.
 */
export const shadow = {
  /** Resting card. */
  hard: { dx: -6, dy: 6, color: palette.ink },
  /** Raised or selected card. */
  hardLifted: { dx: -10, dy: 10, color: palette.ink },
  /** Panels. */
  hardPanel: { dx: -8, dy: 8, color: palette.ink },
  /** List rows, where the ink shadow would be too heavy. */
  soft: { dx: 3, dy: 3, color: palette.shadowSoft },
} as const;

/** Cards lean; their contents lean back by the same amount to stay readable. */
export const skew = {
  card: "-5deg",
  cardContent: "5deg",
  button: "-8deg",
  buttonContent: "8deg",
} as const;

export const gradients = {
  /** Primary action buttons. */
  primary: [palette.blue, palette.purple],
  /** Stat bar fill. */
  stat: [palette.cyan, palette.purple],
} as const;

/**
 * The label above a heading: small, black-weight, widely tracked, cyan.
 * Tracking is in points because React Native has no `em`.
 */
export const type = {
  eyebrow: { fontSize: 11, fontWeight: "900", letterSpacing: 3 },
  title: { fontSize: 38, fontWeight: "900", letterSpacing: -1 },
  heading: { fontSize: 20, fontWeight: "900", letterSpacing: 0 },
  body: { fontSize: 14, fontWeight: "500", letterSpacing: 0 },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  mono: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
} as const;

export type ThemeColors = typeof colors;
export type Palette = typeof palette;

/** Canonical CSS custom properties used by the Web non-battle UI. */
export function webThemeVariables(): Readonly<Record<string, string>> {
  return {
    "--cb-ink": palette.ink,
    "--cb-ink-muted": palette.inkMuted,
    "--cb-ink-faint": palette.inkFaint,
    "--cb-paper": palette.paper,
    "--cb-paper-deep": palette.paperDeep,
    "--cb-card": palette.card,
    "--cb-rule": palette.rule,
    "--cb-track": palette.track,
    "--cb-cyan": palette.cyan,
    "--cb-cyan-bright": palette.cyanBright,
    "--cb-blue": palette.blue,
    "--cb-purple": palette.purple,
    "--cb-danger": palette.danger,
    "--cb-warning": palette.warning,
    "--cb-positive": palette.positive,
  };
}
