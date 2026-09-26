/**
 * פלטת Soft UI — ללא React / ThemeContext (ניתן לייבוא מ-lib ו-appType באתחול).
 * docs/DARKPOOL_DESIGN_DIRECTION.md
 */
export const SoftUI = {
  canvas: '#0E0D0D',
  surface1: '#161514',
  surface2: '#1C1B1A',
  surface3: '#222120',
  surfaceHover: '#282726',
  textPrimary: '#F4F1ED',
  textSecondary: '#AAA5A0',
  textMuted: '#716D69',
  positive: '#6EE7A0',
  /** Tailwind red-400 — אדום ברור לטקסט/ירידות */
  negative: '#F87171',
  warning: '#E8B56A',
  brand: '#00C805',
  brandDark: '#00A004',
  brandLight: '#33D43B',
  accentBlue: '#7B96F2',
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
} as const;
