import type { StoryWithUser } from '../services/storiesService';
import { rootNavigationRef } from '../navigation/rootNavigationRef';

/**
 * פתיחת צופה הסטוריז (מסך StoryViewer בסטאק הראשי).
 * ב-params רק מזהים; פרטי המשתמשים (שם / תמונה לכותרת) נשמרים כאן בזיכרון —
 * אובייקטים גדולים לא עוברים ב-params של הניווט.
 */
export type StoryViewerUser = {
  user_id: string;
  user?: {
    display_name?: string | null;
    full_name?: string | null;
    profile_picture?: string | null;
  } | null;
};

export type StoryViewerParams = {
  /** סדר המשתמשים כמו בשורת הסטוריז: [ישן … «שלי»]. «קדימה» = אינדקס נמוך יותר */
  userIds: string[];
  startUserId: string;
  startStoryIndex?: number | 'last';
};

export const STORY_VIEWER_ROUTE = 'StoryViewer' as const;

const usersById = new Map<string, StoryViewerUser>();

export function rememberStoryViewerUsers(users: ReadonlyArray<StoryWithUser | StoryViewerUser>): void {
  for (const u of users) {
    if (!u?.user_id) continue;
    usersById.set(u.user_id, { user_id: u.user_id, user: u.user ?? null });
  }
}

export function getStoryViewerUser(userId: string): StoryViewerUser {
  return usersById.get(userId) ?? { user_id: userId, user: null };
}

/** בונה params לפתיחה — מחזיר null כשאין מה לפתוח */
export function buildStoryViewerParams(
  users: ReadonlyArray<StoryWithUser | StoryViewerUser>,
  startUserId: string,
  startStoryIndex?: number | 'last',
): StoryViewerParams | null {
  const userIds = users.map((u) => u.user_id).filter(Boolean);
  if (!userIds.includes(startUserId)) return null;
  return { userIds, startUserId, ...(startStoryIndex !== undefined ? { startStoryIndex } : {}) };
}

/** פותח את הצופה מכל מקום באפליקציה */
export function openStoryViewer(
  users: ReadonlyArray<StoryWithUser | StoryViewerUser>,
  startUserId: string,
  startStoryIndex?: number | 'last',
): boolean {
  const params = buildStoryViewerParams(users, startUserId, startStoryIndex);
  if (!params || !rootNavigationRef.isReady()) return false;
  rememberStoryViewerUsers(users);
  (rootNavigationRef.navigate as (name: string, params?: object) => void)(STORY_VIEWER_ROUTE, params);
  return true;
}
