export const colors = {
  background: "#0b1020",
  surface: "#151d33",
  primary: "#7c5cff",
  accent: "#2dd4bf",
  text: "#f8fafc",
  muted: "#94a3b8",
  danger: "#fb7185",
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 6, md: 12, lg: 20 } as const;

export type ThemeColors = typeof colors;
