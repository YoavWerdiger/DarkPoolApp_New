/**
 * dateKeys.ts
 *
 * פונקציות עזר ל-Date Keys — מבטיחות YYYY-MM-DD תמיד בשעון מקומי,
 * ולא ב-UTC (מניעת drift בגבול חצות).
 *
 * שימוש:
 *   import { toLocalDateKey, todayLocalKey } from '../utils/dateKeys';
 *   const key = toLocalDateKey(new Date()); // "2026-07-23"
 */

/**
 * ממיר Date (או מחרוזת ISO) ל-"YYYY-MM-DD" לפי שעון מקומי של המכשיר.
 * לעולם לא משתמש ב-toISOString() כי זו UTC ועלולה להיות יום שונה.
 */
export function toLocalDateKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** מחזיר את תאריך היום ב-YYYY-MM-DD לפי שעון מקומי */
export function todayLocalKey(): string {
  return toLocalDateKey(new Date());
}

/**
 * מחזיר תאריך של N ימים לפני היום ב-YYYY-MM-DD (שעון מקומי).
 * @param daysAgo מספר ימים בעבר (양수)
 */
export function daysAgoLocalKey(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return toLocalDateKey(d);
}
