import type { ShareIntent } from 'expo-share-intent';
import type { PickedRecentMedia } from './mediaRecentsCache';

/** תוכן שהגיע מגיליון השיתוף של המערכת, עד שבוחרים קבוצה ו-ChatInput צורך אותו. */
export type PendingShare = {
  text: string | null;
  media: PickedRecentMedia[];
};

type Slot = { share: PendingShare; groupId: string | null };

let slot: Slot | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function fileUri(path: string): string {
  return path.startsWith('/') ? `file://${path}` : path;
}

export function pendingShareFromIntent(intent: ShareIntent | null | undefined): PendingShare | null {
  if (!intent) return null;
  const stamp = Date.now();
  const media: PickedRecentMedia[] = [];
  (intent.files ?? []).forEach((file, index) => {
    const mime = (file.mimeType || '').toLowerCase();
    const type = mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : null;
    if (!type || !file.path) return;
    const uri = fileUri(file.path);
    media.push({
      id: `share-${stamp}-${index}`,
      uri,
      thumbnailUri: uri,
      type,
      name: file.fileName || (type === 'video' ? `video_${stamp}_${index}.mp4` : `photo_${stamp}_${index}.jpg`),
      width: file.width ?? undefined,
      height: file.height ?? undefined,
    });
  });
  const text = (intent.text || intent.webUrl || '').trim() || null;
  if (!text && media.length === 0) return null;
  return { text, media };
}

export function setIncomingShare(share: PendingShare) {
  slot = { share, groupId: null };
  emit();
}

export function hasIncomingShare(): boolean {
  return slot != null;
}

export function peekIncomingShare(): PendingShare | null {
  return slot?.share ?? null;
}

export function assignIncomingShareToGroup(groupId: string) {
  if (!slot) return;
  slot = { ...slot, groupId };
  emit();
}

/** מחזיר את השיתוף רק אם שויך לקבוצה הזו, ומנקה אותו. */
export function consumeShareForGroup(groupId: string): PendingShare | null {
  if (!slot || !groupId || slot.groupId !== groupId) return null;
  const { share } = slot;
  slot = null;
  emit();
  return share;
}

export function clearIncomingShare() {
  if (!slot) return;
  slot = null;
  emit();
}

export function subscribePendingShare(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
