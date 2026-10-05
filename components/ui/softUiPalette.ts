/**
 * פלטת Soft UI — ללא React / ThemeContext (ניתן לייבוא מ-lib ו-appType באתחול).
 * docs/DARKPOOL_DESIGN_DIRECTION.md
 */
export const SoftUI = {
  /**
   * קנבס גרפיט ניטרלי (לא שחור, בלי גוון צהבהב) — אותו יחס «כרטיס מעל קנבס» (~1.1:1) כמו בלייט,
   * בלי הניגודיות הקשה של שחור מוחלט.
   */
  canvas: '#111111',
  /** כרטיס תוכן + כפתורי כותרת — מדרגה ברורה מעל הקנבס (כמו לבן על #F4F2F1 בלייט) */
  surface1: '#242424',
  /** כרטיס פנימי / כרום */
  surface2: '#2F2F2F',
  surface3: '#3A3A3A',
  surfaceHover: '#474747',
  /** טקסט ראשי — לבן רך (לא #FFF) */
  textPrimary: '#F2F2F2',
  textSecondary: '#A0A0A0',
  textMuted: '#6B6B6B',
  positive: '#6EE7A0',
  /** Tailwind red-500 — אדום חזק לשלילי / סכנה */
  negative: '#EF4444',
  warning: '#E8B56A',
  brand: '#00C805',
  brandDark: '#00A004',
  brandLight: '#33D43B',
  accentBlue: '#7B96F2',
  borderSubtle: 'rgba(255, 255, 255, 0.07)',
} as const;
