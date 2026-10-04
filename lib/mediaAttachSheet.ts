import type { ViewStyle } from 'react-native';

/** גלריה מורחבת — snap קבוע, בלי fitContent. */
export const MEDIA_ATTACH_EXPANDED_SNAP = 0.9;
/**
 * Peek fallback בלבד. הגובה האמיתי מגיע מ-`mediaAttachPeekPlan`
 * (תפריט פעולות ± שורת recents אם כבר ב-cache).
 */
export const MEDIA_ATTACH_PEEK_SNAP = 0.32;
export const MEDIA_ATTACH_SNAP_POINTS: readonly [number, number] = [
  MEDIA_ATTACH_PEEK_SNAP,
  MEDIA_ATTACH_EXPANDED_SNAP,
];

/** כמה תמונות אחרונות בסטריפ הגלילה של ה-peek — רק אם כבר ב-cache. */
export const MEDIA_ATTACH_PEEK_THUMBS = 12;
/** תמונה בסטריפ ה-peek — קבועה, לא תלויה ברוחב הגריד. */
export const MEDIA_ATTACH_PEEK_THUMB_PX = 96;
export const MEDIA_ATTACH_PEEK_THUMB_GAP = 8;
export const MEDIA_ATTACH_PEEK_THUMB_RADIUS = 12;

export const MEDIA_ATTACH_GRID_COLS = 3;
export const MEDIA_ATTACH_GRID_GAP = 2;
/** עמוד ראשון קטן — מספיק ל-peek + גריד, בלי לפענח את כל האלבום. */
export const MEDIA_ATTACH_FIRST_PAGE = 30;
export const MEDIA_ATTACH_SKELETON_CELLS = 9;

export const MEDIA_ATTACH_PERMISSION_CTA = 'אפשר גישה לתמונות';

/** handle ב-edgeToEdge (כולל buffer) — תואם BOTTOM_SHEET_EDGE_HANDLE_HEIGHT. */
export const MEDIA_ATTACH_HANDLE_PX = 36;
/** עיגול כלי בשורה המשנית (מסמך, אודיו, סקר...). */
export const MEDIA_ATTACH_ACTION_BTN_PX = 56;
/** שורה ראשונה: גלריה | מצלמה — שני כפתורי גלולה, חצי רוחב כל אחד. */
export const MEDIA_ATTACH_PRIMARY_ROW_PX = 56;
/** שורת כלים: עיגול + תווית. */
export const MEDIA_ATTACH_SECONDARY_ROW_PX = 80;
export const MEDIA_ATTACH_SECONDARY_COLS = 4;
export const MEDIA_ATTACH_ACTION_ROW_GAP = 16;
/** @deprecated — השתמשו ב-mediaAttachActionsBlockHeightPx */
export const MEDIA_ATTACH_ACTION_ROW_PX = MEDIA_ATTACH_SECONDARY_ROW_PX;
export const MEDIA_ATTACH_ACTION_ROWS = 2;
/** peek paddingTop + actionRow paddingTop */
export const MEDIA_ATTACH_PEEK_CHROME_PX = 12;
export const MEDIA_ATTACH_PEEK_STRIP_GAP = 16;
/** כותרת «אחרונים» + «הכל» מעל שורת ה-thumbnails. */
export const MEDIA_ATTACH_PEEK_RECENTS_HEADER_PX = 28;
export const MEDIA_ATTACH_PEEK_BUFFER_PX = 8;
export const MEDIA_ATTACH_PEEK_MIN = 0.24;
export const MEDIA_ATTACH_PEEK_MAX = 0.56;

/**
 * שורת גריד בתוך עץ RTL: `row` בלבד.
 * `direction:'rtl' + row-reverse` הופך פעמיים ושובר את סדר התמונות.
 */
export const MEDIA_ATTACH_GRID_ROW: ViewStyle = {
  direction: 'rtl',
  flexDirection: 'row',
};

export type MediaAttachPermission = 'unknown' | 'granted' | 'denied';

export type MediaAttachPresentation = {
  /** השיט תמיד יכול להיפתח — גם בלי הרשאה. */
  canPresent: true;
  showPermissionCta: boolean;
  showSkeleton: boolean;
  showGrid: boolean;
};

export type MediaAttachPeekPlan = {
  peekSnap: number;
  showPeekRecents: boolean;
};

export function mediaAttachSecondaryRowCount(secondaryCount: number): number {
  if (secondaryCount <= 0) return 0;
  return Math.ceil(secondaryCount / MEDIA_ATTACH_SECONDARY_COLS);
}

/** עמודות בשורת הכלים — 3 כלים = 3 עמודות, לא 4 עם חור. */
export function mediaAttachActionColumns(count: number): number {
  return Math.max(1, Math.min(MEDIA_ATTACH_SECONDARY_COLS, count));
}

/** גובה בלוק הפעולות ב-peek — שורת גלריה/מצלמה + שורות כלים. */
export function mediaAttachActionsBlockHeightPx(
  secondaryCount: number,
  primaryCount = 2,
): number {
  const primary = primaryCount > 0 ? MEDIA_ATTACH_PRIMARY_ROW_PX : 0;
  const rows = mediaAttachSecondaryRowCount(secondaryCount);
  const secondary =
    rows * MEDIA_ATTACH_SECONDARY_ROW_PX + Math.max(0, rows - 1) * MEDIA_ATTACH_ACTION_ROW_GAP;
  const gap = primary > 0 && rows > 0 ? MEDIA_ATTACH_ACTION_ROW_GAP : 0;
  return primary + gap + secondary;
}

export function mediaAttachPeekHeightPx(input: {
  hasCachedThumbs: boolean;
  thumbSize: number;
  bottomPad: number;
  secondaryCount?: number;
  primaryCount?: number;
}): number {
  const strip = input.hasCachedThumbs
    ? MEDIA_ATTACH_PEEK_RECENTS_HEADER_PX +
      Math.max(0, input.thumbSize) +
      MEDIA_ATTACH_PEEK_STRIP_GAP
    : 0;
  const actions = mediaAttachActionsBlockHeightPx(
    input.secondaryCount ?? 0,
    input.primaryCount ?? 2,
  );
  return (
    MEDIA_ATTACH_HANDLE_PX +
    MEDIA_ATTACH_PEEK_CHROME_PX +
    strip +
    actions +
    Math.max(0, input.bottomPad) +
    MEDIA_ATTACH_PEEK_BUFFER_PX
  );
}

/**
 * Snap peek יציב לפי תוכן הפתיחה — לא מדידה אחרי mount, לא קפיצה.
 * שורת recents נכנסת לחישוב רק אם כבר יש cache והגובה לא חורג מהמקסימום.
 */
export function mediaAttachPeekPlan(input: {
  screenHeight: number;
  thumbSize: number;
  bottomPad: number;
  cachedCount: number;
  secondaryCount?: number;
  primaryCount?: number;
}): MediaAttachPeekPlan {
  const screenH = Math.max(1, input.screenHeight);
  const wantsThumbs = input.cachedCount > 0;
  const withThumbs =
    mediaAttachPeekHeightPx({
      hasCachedThumbs: true,
      thumbSize: input.thumbSize,
      bottomPad: input.bottomPad,
      secondaryCount: input.secondaryCount,
      primaryCount: input.primaryCount,
    }) / screenH;
  const menuOnly =
    mediaAttachPeekHeightPx({
      hasCachedThumbs: false,
      thumbSize: input.thumbSize,
      bottomPad: input.bottomPad,
      secondaryCount: input.secondaryCount,
      primaryCount: input.primaryCount,
    }) / screenH;
  const showPeekRecents = wantsThumbs && withThumbs <= MEDIA_ATTACH_PEEK_MAX;
  const raw = showPeekRecents ? withThumbs : menuOnly;
  return {
    peekSnap: Math.max(MEDIA_ATTACH_PEEK_MIN, Math.min(MEDIA_ATTACH_PEEK_MAX, raw)),
    showPeekRecents,
  };
}

/** הרשאת גלריה / טעינת recents — רק אחרי «גלריה», לא ב-peek. */
export function mediaAttachShouldQueryLibrary(expanded: boolean): boolean {
  return expanded === true;
}

export function mediaAttachPresentation(input: {
  permission: MediaAttachPermission;
  cachedCount: number;
  loading: boolean;
  expanded?: boolean;
}): MediaAttachPresentation {
  const hasCache = input.cachedCount > 0;
  const expanded = input.expanded === true;
  const showPermissionCta = expanded && input.permission === 'denied' && !hasCache;
  const showSkeleton =
    expanded &&
    !hasCache &&
    !showPermissionCta &&
    (input.loading || input.permission === 'unknown');
  return {
    canPresent: true,
    showPermissionCta,
    showSkeleton,
    showGrid: expanded && (hasCache || (!showPermissionCta && !showSkeleton)),
  };
}

/** ברירת מחדל: הסנאפ הגבוה ביותר (התנהגות השיטים הקיימים). */
export function resolveSheetOpenSnapIndex(
  snapPoints: readonly number[],
  openSnapIndex?: number,
): number {
  if (snapPoints.length === 0) return 0;
  if (openSnapIndex != null) {
    return Math.max(0, Math.min(openSnapIndex, snapPoints.length - 1));
  }
  let tallest = 0;
  for (let i = 1; i < snapPoints.length; i += 1) {
    if (snapPoints[i] > snapPoints[tallest]) tallest = i;
  }
  return tallest;
}

export function toggleMediaSelection(
  selectedIds: readonly string[],
  id: string,
  limit: number,
): string[] {
  if (selectedIds.includes(id)) return selectedIds.filter((item) => item !== id);
  if (selectedIds.length >= limit) return selectedIds.slice();
  return [...selectedIds, id];
}

export function formatMediaDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function mediaAttachCellSize(screenWidth: number, cols = MEDIA_ATTACH_GRID_COLS): number {
  const gaps = MEDIA_ATTACH_GRID_GAP * Math.max(0, cols - 1);
  return Math.floor((screenWidth - gaps) / cols);
}
