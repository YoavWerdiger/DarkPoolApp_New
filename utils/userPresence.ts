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
    return 'מחובר/ת';
  }
  if (!lastActive) return null;

  const lastMs = new Date(lastActive).getTime();
  if (Number.isNaN(lastMs)) return null;

  const diffSec = Math.floor((nowMs - lastMs) / 1000);
  if (diffSec < 60) return 'נראה/תה לפני רגע';
  if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    return mins === 1 ? 'נראה/תה לפני דקה' : `נראה/תה לפני ${mins} דקות`;
  }
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return hours === 1 ? 'נראה/תה לפני שעה' : `נראה/תה לפני ${hours} שעות`;
  }
  const days = Math.floor(diffSec / 86400);
  if (days === 1) return 'נראה/תה אתמול';
  if (days < 7) return `נראה/תה לפני ${days} ימים`;
  return null;
}
