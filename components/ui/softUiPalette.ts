/**
 * פלטת Soft UI — ללא React / ThemeContext (ניתן לייבוא מ-lib ו-appType באתחול).
 * docs/DARKPOOL_DESIGN_DIRECTION.md
 */
export const SoftUI = {
  /** קנבס שחור — כמו מסכי התוכן בצילום הייחוס */
  canvas: '#000000',
  /** כרטיס תוכן */
  surface1: '#1C1C1E',
  /** כרטיס פנימי / כרום */
  surface2: '#2C2C2E',
  surface3: '#3A3A3C',
  surfaceHover: '#48484A',
  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
  textMuted: '#636366',
  positive: '#6EE7A0',
  /** Tailwind red-500 — אדום חזק לשלילי / סכנה */
  negative: '#EF4444',
  warning: '#E8B56A',
  brand: '#00C805',
  brandDark: '#00A004',
  brandLight: '#33D43B',
  accentBlue: '#7B96F2',
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
} as const;
