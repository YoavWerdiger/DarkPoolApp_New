/**
 * Pull-to-zoom לתמונת ה-hero בפרופיל.
 * offsetY < 0 (overscroll) → scale מ-1 מ-top-center + translate שסוגר את הפער.
 * לא מחשב שווי/כמויות — רק גיאומטריית UI.
 */

export type HeroPullZoomMode = 'scroll' | 'pinned';

export function heroPullZoom(
  offsetY: number,
  heroHeight: number,
  mode: HeroPullZoomMode = 'scroll'
): { scale: number; translateY: number } {
  if (!(heroHeight > 0) || !Number.isFinite(offsetY)) {
    return { scale: 1, translateY: 0 };
  }
  const pull = Math.max(0, -offsetY);
  const scale = (heroHeight + pull) / heroHeight;
  if (mode === 'pinned') {
    // כבר בראש המסך: לא לזוז ב-overscroll, לעקוב אחרי התוכן בגלילה למטה.
    return { scale, translateY: offsetY > 0 ? -offsetY : 0 };
  }
  // מבטל את ה-bounce של ה-ScrollView — ה-hero נשאר צמוד לראש ה-viewport.
  return { scale, translateY: pull > 0 ? -pull : 0 };
}

/**
 * מפצה על bounce של ScrollView בראש הרשימה: כש-offsetY שלילי, התוכן נמשך למטה —
 * translateY חיובי מחזיר את גוף המסך (שווי תיק וכו') למקום בלי לבטל pull-to-zoom על התמונה.
 */
export function heroScrollContentCompensateY(offsetY: number): number {
  if (!Number.isFinite(offsetY) || offsetY >= 0) return 0;
  return -offsetY;
}
