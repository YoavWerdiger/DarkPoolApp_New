/**
 * פלטת Soft UI — ללא React / ThemeContext (ניתן לייבוא מ-lib ו-appType באתחול).
 * docs/DARKPOOL_DESIGN_DIRECTION.md
 */
export const SoftUI = {
  /**
   * קנבס פחם חם (לא שחור) — המראה ההפוך של הלייט (#F4F2F1 / כרטיס לבן):
   * אותו גוון חם ואותו יחס «כרטיס מעל קנבס» (~1.1:1), בלי ניגודיות קשה של שחור מוחלט.
   */
  canvas: '#161514',
  /** כרטיס תוכן */
  surface1: '#222120',
  /** כרטיס פנימי / כרום */
  surface2: '#2D2B29',
  surface3: '#383532',
  surfaceHover: '#45423E',
  /** טקסט ראשי = קנבס הלייט (לבן חם, לא #FFF) */
  textPrimary: '#F4F2F1',
  textSecondary: '#A19D98',
  textMuted: '#6F6B66',
  positive: '#6EE7A0',
  /** Tailwind red-500 — אדום חזק לשלילי / סכנה */
  negative: '#EF4444',
  warning: '#E8B56A',
  brand: '#00C805',
  brandDark: '#00A004',
  brandLight: '#33D43B',
  accentBlue: '#7B96F2',
  borderSubtle: 'rgba(244, 242, 241, 0.07)',
} as const;
