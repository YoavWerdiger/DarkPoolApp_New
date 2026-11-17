/**
 * באדג' אחיד לכל הפושים: הודעות צ'אט שלא נקראו + פושים אחרים שלא נראו (push_badge_counts).
 * bump > 0 — מוסיף את הפושים שנשלחים עכשיו למונה (חדשות / דוחות / יומן כלכלי / דארקפול...).
 * צ'אט לא מוסיף (נספר דרך unread_count). בשגיאה (למשל מיגרציה שלא הורצה) — מפה ריקה.
 */
import type { createClient } from 'npm:@supabase/supabase-js@2.94.1';

export async function pushBadges(
  supabase: ReturnType<typeof createClient>,
  userIds: string[],
  bump = 0,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (!ids.length) return out;
  try {
    const { data, error } = await supabase.rpc('push_badges_for', { p_user_ids: ids, p_bump: bump });
    if (error) return out;
    for (const row of (data ?? []) as Array<{ user_id: string; badge: number }>) {
      out.set(String(row.user_id), Math.max(0, Number(row.badge) || 0));
    }
  } catch {
    /* בלי באדג' — הפוש עדיין נשלח */
  }
  return out;
}
