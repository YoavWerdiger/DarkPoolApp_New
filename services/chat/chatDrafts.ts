/**
 * chatDrafts.ts
 * --------------------------------------------------------------------------
 * Per-group draft persistence. Users should NEVER lose text they've typed
 * but haven't sent — closing the screen, locking the device, or having the
 * OS evict the process must all preserve the in-progress message.
 *
 * Layout:
 *   - One AsyncStorage key per group → keeps writes small even when a user
 *     drafts in many groups simultaneously.
 *   - We don't store anything other than the text. Mentions / reply targets
 *     can be re-derived from the text by the caller.
 *   - Reads are best-effort and never throw. A failed read just returns ''.
 *
 * Used via the `useDraft` hook in `hooks/useChatDraft.ts`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../utils/logger';

const TAG = 'ChatDrafts';
const KEY_PREFIX = '@darkpool:chat:draft:v1:';

function key(groupId: string): string {
  return `${KEY_PREFIX}${groupId}`;
}

export async function loadDraft(groupId: string): Promise<string> {
  if (!groupId) return '';
  try {
    const v = await AsyncStorage.getItem(key(groupId));
    return v ?? '';
  } catch (err) {
    logger.error(TAG, 'loadDraft failed', err);
    return '';
  }
}

export async function saveDraft(groupId: string, text: string): Promise<void> {
  if (!groupId) return;
  try {
    if (!text || text.length === 0) {
      await AsyncStorage.removeItem(key(groupId));
      return;
    }
    await AsyncStorage.setItem(key(groupId), text);
  } catch (err) {
    logger.error(TAG, 'saveDraft failed', err);
  }
}

export async function clearDraft(groupId: string): Promise<void> {
  if (!groupId) return;
  try {
    await AsyncStorage.removeItem(key(groupId));
  } catch (err) {
    logger.error(TAG, 'clearDraft failed', err);
  }
}

/**
 * Bulk wipe all drafts across all groups. Used on logout / account switch.
 * Walks the AsyncStorage keyspace once and removes anything under our prefix.
 */
export async function clearAllDrafts(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(KEY_PREFIX));
    if (ours.length > 0) {
      await AsyncStorage.multiRemove(ours);
    }
  } catch (err) {
    logger.error(TAG, 'clearAllDrafts failed', err);
  }
}
