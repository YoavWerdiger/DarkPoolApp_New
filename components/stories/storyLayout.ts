import { Dimensions } from 'react-native';

/** מידות המסך — הצופה תמיד במסך מלא */
export const STORY_SCREEN_WIDTH = Dimensions.get('window').width;
export const STORY_SCREEN_HEIGHT = Dimensions.get('window').height;

/** משך סטורי תמונה / טקסט */
export const STORY_DURATION_MS = 10000;
/** וידאו בלי משך ידוע */
export const STORY_VIDEO_MAX_MS = 60000;
/** אם המדיה לא נטענה עד אז — מתחילים את הספירה (הספינר נשאר עד שהיא מגיעה) */
export const STORY_MEDIA_STALL_MS = 6000;

export const STORY_REACTION_EMOJIS = ['❤️', '🔥', '😂', '😮', '😢', '👏'];

/**
 * סטורי עם טקסט/ציור נערך בתוך מסגרת המצלמה (canvasWidth×canvasHeight).
 * מציגים את המדיה באותה מסגרת ובאותו אופן כמו בעורך — מה שראו בעריכה זה מה שרואים בצפייה.
 */
export function storyAuthoredFrame(content?: string | null): { top: number; height: number } | null {
  if (!content || content.trim()[0] !== '{') return null;
  try {
    const parsed = JSON.parse(content) as { canvasWidth?: number; canvasHeight?: number };
    if (typeof parsed.canvasWidth !== 'number' || typeof parsed.canvasHeight !== 'number' || parsed.canvasWidth <= 0) {
      return null;
    }
    const height = parsed.canvasHeight * (STORY_SCREEN_WIDTH / parsed.canvasWidth);
    return { top: (STORY_SCREEN_HEIGHT - height) / 2, height };
  } catch {
    return null;
  }
}

/** file:// / content:// / http(s) וכו׳ */
export function isPlayableMediaUri(uri: string | null | undefined): uri is string {
  if (!uri || typeof uri !== 'string') return false;
  const t = uri.trim();
  if (!t) return false;
  return (
    t.startsWith('http://') ||
    t.startsWith('https://') ||
    t.startsWith('file://') ||
    t.startsWith('content://') ||
    t.startsWith('ph://') ||
    t.startsWith('assets-library://') ||
    t.startsWith('data:')
  );
}

export function formatStoryTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'עכשיו';
  if (diffMin < 60) return `לפני ${diffMin} דק׳`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `לפני ${diffHrs} שע׳`;
  return `לפני ${Math.floor(diffHrs / 24)} ימים`;
}

/** אינדקס הסטורי בפועל: 'last' → האחרון, מספר → בגבולות */
export function resolveStoryIndex(length: number, wanted: number | 'last'): number {
  if (length <= 0) return 0;
  if (wanted === 'last') return length - 1;
  return Math.max(0, Math.min(wanted, length - 1));
}
