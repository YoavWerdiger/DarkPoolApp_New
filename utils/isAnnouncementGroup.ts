/** Official announcements channel id (from create_default_chat_groups.sql). */
export const ANNOUNCEMENTS_GROUP_ID = '00000000-0000-0000-0000-000000000001';

const ANNOUNCEMENTS_EXACT_NAMES = new Set(['הכרזות', '🔔 הכרזות']);

/**
 * True only for the announcements room — never other official / mute / penny rooms.
 * Prefer exact id; fall back to exact display name (not substring includes).
 */
export function isAnnouncementGroup(name?: string | null, id?: string | null): boolean {
  if (id && id.toLowerCase() === ANNOUNCEMENTS_GROUP_ID) return true;
  if (!name) return false;
  const trimmed = name.trim();
  return ANNOUNCEMENTS_EXACT_NAMES.has(trimmed);
}
