/** כפתור מעקב דביק בפרופיל — מעל home indicator (ובטאבים: מעל הסרגל). */

export const PROFILE_FOLLOW_PILL_HEIGHT = 52;
/** capsule — חצי גובה (26) או full pill דרך overflow */
export const PROFILE_FOLLOW_PILL_RADIUS = PROFILE_FOLLOW_PILL_HEIGHT / 2;
export const PROFILE_FOLLOW_DOCK_GAP = 12;
export const PROFILE_FOLLOW_DOCK_HPAD = 16;

export function profileFollowDockBottom(opts: {
  safeBottom: number;
  tabBarHeight?: number;
}): number {
  return (opts.tabBarHeight ?? 0) + Math.max(opts.safeBottom, 10);
}

/** גובה ה-overlay הדביק (כפתור + safe / tab bar) — חייב להתאים ל-followDock במסך. */
export function profileFollowOverlayHeight(opts: {
  safeBottom: number;
  tabBarHeight?: number;
}): number {
  return PROFILE_FOLLOW_PILL_HEIGHT + profileFollowDockBottom(opts);
}

/** paddingBottom / footer לתוכן שגולל — שורות אחרונות גוללות מעל הכפתור. */
export function profileFollowContentPad(opts: {
  safeBottom: number;
  tabBarHeight?: number;
}): number {
  return profileFollowOverlayHeight(opts) + PROFILE_FOLLOW_DOCK_GAP + 16;
}
