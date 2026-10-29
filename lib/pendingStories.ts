import {
  createStory,
  getStoriesByUserId,
  uploadStoryImage,
  uploadStoryVideo,
  type UserStory,
} from '../services/storiesService';
import { logger } from '../utils/logger';

/**
 * העלאת סטורי אופטימית: המסך נסגר מיד, הסטורי מופיע בשורת הסטוריז עם מצב «עולה»,
 * וההעלאה רצה כאן ברקע (לא תלויה במסך שנסגר). כישלון → מצב «נכשל» עם ניסיון חוזר.
 */
export type PendingStoryStatus = 'uploading' | 'failed';

export type PendingStory = {
  id: string;
  userId: string;
  mediaType: 'image' | 'video' | 'text';
  /** URI מקומי לתצוגה בטבעת (תמונה / וידאו) */
  localUri: string | null;
  content?: string;
  backgroundColor?: string;
  status: PendingStoryStatus;
  createdAt: number;
};

let pending: PendingStory[] = [];
/** URL בשרת → הקובץ המקומי שממנו הועלה — הצופה מציג את הסטורי שלי מיד, בלי לחכות לרשת */
const localByRemoteUrl = new Map<string, string>();

export function localUriForStoryMedia(url: string | null | undefined): string | null {
  if (!url) return null;
  const direct = localByRemoteUrl.get(url);
  if (direct) return direct;
  // ההעלאה מחזירה נתיב אחסון (stories/<uid>/<ts>.jpg), והצופה מקבל URL חתום שמכיל אותו —
  // בלי ההתאמה הזו הסטורי הטרי שלי תמיד חיכה לרשת (מסך שחור בכניסה הראשונה)
  for (const [path, local] of localByRemoteUrl) {
    if (url.includes(path)) return local;
  }
  return null;
}
const listeners = new Set<() => void>();
const doneListeners = new Set<(story: UserStory) => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function getPendingStories(userId?: string | null): PendingStory[] {
  return userId ? pending.filter((p) => p.userId === userId) : pending;
}

export function subscribePendingStories(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** נקרא כשסטורי עלה בהצלחה — לרענון רשימת הסטוריז */
export function onPendingStoryPublished(fn: (story: UserStory) => void): () => void {
  doneListeners.add(fn);
  return () => {
    doneListeners.delete(fn);
  };
}

async function run(item: PendingStory) {
  try {
    let mediaUrl: string | undefined;
    if (item.mediaType !== 'text') {
      if (!item.localUri) throw new Error('אין קובץ להעלאה');
      const result: { url: string | null; error: string | null; displayUri?: string } =
        item.mediaType === 'video'
          ? await uploadStoryVideo(item.localUri, item.userId)
          : await uploadStoryImage(item.localUri, item.userId);
      const { url, error } = result;
      if (error || !url) throw new Error(error || 'ההעלאה נכשלה');
      mediaUrl = url;
      // תמונה: העותק המוקטן שהועלה (לא המקור ~24MP מהמצלמה — כמה עותקים שלו בצופה הקריסו את האפליקציה בזיכרון)
      localByRemoteUrl.set(url, result.displayUri ?? item.localUri);
    }
    const created = await createStory(item.userId, {
      media_type: item.mediaType,
      ...(mediaUrl ? { media_url: mediaUrl } : {}),
      content: item.content,
      ...(item.backgroundColor ? { background_color: item.backgroundColor } : {}),
    });
    // מרעננים את קאש הסטוריז שלי לפני שהטבעת מתעדכנת — אחרת הצופה נפתח מרשימה ישנה
    try {
      await getStoriesByUserId(item.userId);
    } catch {
      /* best effort — הצופה יטען מהרשת */
    }
    pending = pending.filter((p) => p.id !== item.id);
    if (__DEV__) {
      console.log('[story] published', created?.id?.slice(0, 8));
      // דופק: אם ממשיך להדפיס — JS חי והחסימה היא שכבה נייטיב; אם נעצר — JS תקוע
      let n = 0;
      const hb = setInterval(() => {
        n += 1;
        console.log('[story] heartbeat', n);
        if (n >= 6) clearInterval(hb);
      }, 1000);
    }
    emit();
    // הסטורי שנוצר — הרשימה מוסיפה את «שלי» מיד, בלי לחכות לטעינה מחדש (אחרת הלחיצה לא פותחת כלום)
    doneListeners.forEach((fn) => fn(created));
  } catch (error) {
    logger.error('pendingStories', 'story upload failed', error);
    pending = pending.map((p) => (p.id === item.id ? { ...p, status: 'failed' } : p));
    emit();
  }
}

export function publishStoryOptimistic(input: Omit<PendingStory, 'id' | 'status' | 'createdAt'>): void {
  const item: PendingStory = {
    ...input,
    id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    status: 'uploading',
    createdAt: Date.now(),
  };
  pending = [...pending, item];
  emit();
  // ההעלאה מתחילה אחרי שמסך היצירה נסגר (אנימציית סגירה ~0.5ש׳) — עיבוד התמונה ברגע הסגירה תקע את המסך
  setTimeout(() => void run(item), 700);
}

export function retryPendingStory(id: string): void {
  const item = pending.find((p) => p.id === id);
  if (!item) return;
  const next = { ...item, status: 'uploading' as const };
  pending = pending.map((p) => (p.id === id ? next : p));
  emit();
  void run(next);
}

export function discardPendingStory(id: string): void {
  pending = pending.filter((p) => p.id !== id);
  emit();
}
