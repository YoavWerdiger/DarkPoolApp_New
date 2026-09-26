/**
 * Store משותף להשתקת קבוצה — הגדרות + פרטי קבוצה קוראים וכותבים כאן.
 * ה-persist לשרת (toggle_group_mute) מוזרק כדי שהטסטים לא ייגעו ב-Supabase.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const GROUP_MUTE_STORAGE_KEY = 'notificationGroupMutes';

export type GroupMuteMap = Record<string, boolean>;

export type GroupMutePersist = (
  groupId: string,
  muted: boolean,
) => Promise<{ success: boolean }>;

let memory: GroupMuteMap = {};
const listeners = new Set<(groupId: string, muted: boolean, map: GroupMuteMap) => void>();

export function getCachedGroupMuteMap(): GroupMuteMap {
  return { ...memory };
}

export function getGroupMuted(groupId: string, fallback = false): boolean {
  if (Object.prototype.hasOwnProperty.call(memory, groupId)) {
    return memory[groupId] === true;
  }
  return fallback;
}

export function hydrateGroupMute(
  groupId: string,
  muted: boolean,
  opts?: { overwrite?: boolean },
): void {
  if (!opts?.overwrite && Object.prototype.hasOwnProperty.call(memory, groupId)) {
    return;
  }
  memory[groupId] = muted;
}

export function hydrateGroupMutes(
  entries: Array<{ id: string; muted: boolean }>,
  opts?: { overwrite?: boolean },
): void {
  for (const entry of entries) {
    hydrateGroupMute(entry.id, entry.muted, opts);
  }
}

export function subscribeGroupMutes(
  fn: (groupId: string, muted: boolean, map: GroupMuteMap) => void,
): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emit(groupId: string, muted: boolean) {
  const snapshot = { ...memory };
  for (const fn of listeners) fn(groupId, muted, snapshot);
}

async function persistLocal(): Promise<void> {
  await AsyncStorage.setItem(GROUP_MUTE_STORAGE_KEY, JSON.stringify(memory));
}

export async function loadGroupMuteMap(): Promise<GroupMuteMap> {
  try {
    const raw = await AsyncStorage.getItem(GROUP_MUTE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object') {
        memory = { ...(parsed as GroupMuteMap) };
      }
    }
  } catch {
    /* keep memory */
  }
  return getCachedGroupMuteMap();
}

export async function setGroupMuted(
  groupId: string,
  muted: boolean,
  persist: GroupMutePersist,
): Promise<{ success: boolean }> {
  const prev = Object.prototype.hasOwnProperty.call(memory, groupId)
    ? memory[groupId]
    : undefined;
  memory[groupId] = muted;
  emit(groupId, muted);
  await persistLocal();

  const result = await persist(groupId, muted);
  if (!result.success) {
    if (prev === undefined) {
      delete memory[groupId];
    } else {
      memory[groupId] = prev;
    }
    emit(groupId, getGroupMuted(groupId, false));
    await persistLocal();
  }
  return result;
}

export function resetGroupMuteStore() {
  memory = {};
}
