import { createStory, uploadStoryImage, uploadStoryVideo } from '../services/storiesService';
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
  return url ? localByRemoteUrl.get(url) ?? null : null;
}
const listeners = new Set<() => void>();
const doneListeners = new Set<() => void>();

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
export function onPendingStoryPublished(fn: () => void): () => void {
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
      const { url, error } =
        item.mediaType === 'video'
          ? await uploadStoryVideo(item.localUri, item.userId)
          : await uploadStoryImage(item.localUri, item.userId);
      if (error || !url) throw new Error(error || 'ההעלאה נכשלה');
      mediaUrl = url;
      localByRemoteUrl.set(url, item.localUri);
    }
    await createStory(item.userId, {
      media_type: item.mediaType,
      ...(mediaUrl ? { media_url: mediaUrl } : {}),
      content: item.content,
      ...(item.backgroundColor ? { background_color: item.backgroundColor } : {}),
    });
    pending = pending.filter((p) => p.id !== item.id);
    emit();
    doneListeners.forEach((fn) => fn());
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
  void run(item);
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
