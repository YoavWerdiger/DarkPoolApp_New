/**
 * רכישת קורס בודד (קורס הלוויתנים) — הגישה נקבעת רק בשרת:
 * rapid-responder מאמת את התשלום מול CardCom (GetLpResult + סכום) ורק אז כותב ל-course_purchases.
 * הלקוח רק שואל את השרת (has_course_access) — לא מסיק גישה מ-redirect של דף התשלום.
 */
import { supabase } from './supabase';

/** קורסים שנמכרים ברכישה בודדת (courses.access = 'purchase') */
export const PURCHASE_COURSE_IDS = new Set(['whales-course-1', 'whales-course']);

export function isPurchaseCourse(courseId?: string | null): boolean {
  return !!courseId && PURCHASE_COURSE_IDS.has(courseId);
}

/** מזהה הקורס במסד (whales-course → whales-course-1) */
export function purchaseCourseDbId(courseId: string): string {
  return courseId === 'whales-course' ? 'whales-course-1' : courseId;
}

/** האם למשתמש המחובר יש גישה לקורס (רכישה מאושרת / אדמין / קורס חינמי) — לפי השרת */
export async function fetchCourseAccess(courseId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_course_access', { p_course_id: purchaseCourseDbId(courseId) });
  if (error) throw error;
  return data === true;
}

/**
 * אחרי חזרה מדף התשלום: מחכים שהשרת יאשר (ה-webhook של CardCom מגיע תוך שניות).
 * מחזיר true ברגע שהגישה נפתחה, false אם לא אושר בזמן הנתון.
 */
export async function waitForCourseAccess(
  courseId: string,
  { timeoutMs = 90_000, intervalMs = 2_500, signal }: { timeoutMs?: number; intervalMs?: number; signal?: { cancelled: boolean } } = {},
): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (signal?.cancelled) return false;
    try {
      if (await fetchCourseAccess(courseId)) return true;
    } catch {
      /* רשת — ננסה שוב */
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}
