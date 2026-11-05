import i18n from '../lib/i18n';
/** משתמש נחשב מחובר רק אם is_online=true ו-last_active בתוך החלון הזה */
export const USER_ONLINE_THRESHOLD_MS = 3 * 60 * 1000;

export function isUserPresenceOnline(
  isOnline?: boolean | null,
  lastActive?: string | null,
  nowMs: number = Date.now(),
): boolean {
  if (!isOnline || !lastActive) return false;
  const lastMs = new Date(lastActive).getTime();
  if (Number.isNaN(lastMs)) return false;
  return nowMs - lastMs <= USER_ONLINE_THRESHOLD_MS;
}

export function formatUserPresenceLabel(
  isOnline?: boolean | null,
  lastActive?: string | null,
  nowMs: number = Date.now(),
): string | null {
  if (isUserPresenceOnline(isOnline, lastActive, nowMs)) {
    return i18n.t('auto.utils__userPresence.s1');
  }
  if (!lastActive) return null;

  const lastMs = new Date(lastActive).getTime();
  if (Number.isNaN(lastMs)) return null;

  const diffSec = Math.floor((nowMs - lastMs) / 1000);
  if (diffSec < 60) return i18n.t('auto.utils__userPresence.s2');
  if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    return mins === 1 ? i18n.t('auto.utils__userPresence.s3') : i18n.t('auto.utils__userPresence.s4', { v0: mins });
  }
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return hours === 1 ? i18n.t('auto.utils__userPresence.s5') : i18n.t('auto.utils__userPresence.s6', { v0: hours });
  }
  const days = Math.floor(diffSec / 86400);
  if (days === 1) return i18n.t('auto.utils__userPresence.s7');
  if (days < 7) return i18n.t('auto.utils__userPresence.s8', { v0: days });
  return null;
}
