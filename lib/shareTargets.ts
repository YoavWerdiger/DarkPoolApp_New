import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import ShareTargets from '../modules/share-targets';
import { chatGroupDisplayName, groupChatIcon } from '../assets/chatGroups/groupChatIcons';
import { canPostInGroup } from '../utils/canSendInAdminOnlyChat';
import { logger } from '../utils/logger';
import type { ChatGroup } from '../types/chat.types';

/** כמה קבוצות לזרוע בהצעות של גיליון השיתוף */
export const SHARE_TARGET_SEED_COUNT = 6;
const DONATE_THROTTLE_MS = 5 * 60_000;
const CHAT_LINK_PREFIX = 'com.darkpool.app://chat/';

type TargetGroup = Pick<ChatGroup, 'id' | 'name' | 'avatar_url' | 'my_role' | 'settings' | 'last_message_at'>;

const lastDonatedAt = new Map<string, number>();
let seededForUser: string | null = null;

export function chatShortcutUrl(groupId: string): string {
  return `${CHAT_LINK_PREFIX}${encodeURIComponent(groupId)}`;
}

/** Android: לחיצה על קיצור הקבוצה מהמשגר (long-press על האייקון). */
export function groupIdFromChatShortcutUrl(url: string | null | undefined): string | null {
  if (!url || !url.startsWith(CHAT_LINK_PREFIX)) return null;
  const id = decodeURIComponent(url.slice(CHAT_LINK_PREFIX.length).split(/[?#/]/)[0] || '');
  return id || null;
}

/** iOS: ה-Share Extension מצרף target=<groupId> כשנבחרה הצעה. */
export function groupIdFromShareUrl(url: string | null | undefined): string | null {
  if (!url || !url.includes('dataUrl=')) return null;
  const match = url.match(/[?&]target=([^&#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function consumeShareTargetGroupId(url: string | null | undefined): string | null {
  return groupIdFromShareUrl(url) ?? ShareTargets?.consumeShareTargetId() ?? null;
}

async function iconFileUri(group: TargetGroup, isDark: boolean): Promise<string | null> {
  try {
    const bundled = groupChatIcon(group.name, isDark);
    if (typeof bundled === 'number') {
      const asset = Asset.fromModule(bundled);
      await asset.downloadAsync();
      return asset.localUri ?? null;
    }
    if (group.avatar_url && FileSystem.cacheDirectory) {
      const dir = `${FileSystem.cacheDirectory}share-targets/`;
      const dest = `${dir}${group.id}.img`;
      const info = await FileSystem.getInfoAsync(dest);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
        await FileSystem.downloadAsync(group.avatar_url, dest);
      }
      return dest;
    }
  } catch (error) {
    logger.warn('shareTargets', 'icon unavailable', error);
  }
  return null;
}

async function donate(group: TargetGroup, isDark: boolean) {
  if (!ShareTargets) return;
  lastDonatedAt.set(group.id, Date.now());
  const icon = await iconFileUri(group, isDark);
  await ShareTargets.donate(group.id, chatGroupDisplayName(group.name), icon, chatShortcutUrl(group.id));
}

/** אחרי שליחה / פתיחה של קבוצה — מקדם אותה בהצעות. */
export function donateShareTarget(group: TargetGroup | null | undefined, isDark: boolean, isAppAdmin?: boolean) {
  if (!ShareTargets || !group?.id || !canPostInGroup(group, isAppAdmin)) return;
  const last = lastDonatedAt.get(group.id) ?? 0;
  if (Date.now() - last < DONATE_THROTTLE_MS) return;
  void donate(group, isDark).catch((error) => logger.warn('shareTargets', 'donate failed', error));
}

/** פעם בסשן: הקבוצות הפעילות האחרונות. הישנה קודם — iOS מדרג לפי התרומה האחרונה. */
export function seedShareTargets(userId: string, groups: TargetGroup[], isDark: boolean, isAppAdmin?: boolean) {
  if (!ShareTargets || !userId || groups.length === 0 || seededForUser === userId) return;
  seededForUser = userId;
  const top = groups
    .filter((g) => canPostInGroup(g, isAppAdmin))
    .sort((a, b) => (b.last_message_at || '').localeCompare(a.last_message_at || ''))
    .slice(0, SHARE_TARGET_SEED_COUNT)
    .reverse();
  void (async () => {
    for (const group of top) {
      await donate(group, isDark).catch((error) => logger.warn('shareTargets', 'seed failed', error));
    }
  })();
}

export function removeShareTarget(groupId: string) {
  lastDonatedAt.delete(groupId);
  void ShareTargets?.remove(groupId).catch(() => {});
}

/** התנתקות — לא להשאיר קבוצות של משתמש קודם בגיליון השיתוף. */
export function clearShareTargets() {
  seededForUser = null;
  lastDonatedAt.clear();
  void ShareTargets?.removeAll().catch(() => {});
}
