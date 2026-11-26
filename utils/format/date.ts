/**
 * תאריכים ושעות — מקור אחד (פריט 35). ברירת המחדל: שעון ישראל.
 * שעון ניו יורק (ET) רק בפונקציות שמסומנות Et — ומציינים «ET» בטקסט.
 */
const IL = 'Asia/Jerusalem';
const NY = 'America/New_York';

type DateInput = Date | string | number | null | undefined;

function toDate(d: DateInput): Date | null {
  if (d == null || d === '') return null;
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? null : x;
}

function fmt(d: DateInput, tz: string, opts: Intl.DateTimeFormatOptions, locale = 'he-IL'): string {
  const x = toDate(d);
  if (!x) return '—';
  return new Intl.DateTimeFormat(locale, { timeZone: tz, ...opts }).format(x);
}

/** 16:30 */
export const formatTime = (d: DateInput) => fmt(d, IL, { hour: '2-digit', minute: '2-digit', hour12: false });
/** 26.11.2026 */
export const formatDate = (d: DateInput) => fmt(d, IL, { day: '2-digit', month: '2-digit', year: 'numeric' });
/** 26 בנוב׳ */
export const formatDateShort = (d: DateInput) => fmt(d, IL, { day: 'numeric', month: 'short' });
/** 26.11.2026, 16:30 */
export const formatDateTime = (d: DateInput) =>
  fmt(d, IL, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
/** יום חמישי, 26 בנובמבר */
export const formatDayLong = (d: DateInput) => fmt(d, IL, { weekday: 'long', day: 'numeric', month: 'long' });

/** 09:30 ET — רק כשמציינים במפורש שעון ניו יורק */
export const formatTimeEt = (d: DateInput) => `${fmt(d, NY, { hour: '2-digit', minute: '2-digit', hour12: false }, 'en-US')} ET`;

/** «לפני 5 דק׳» / «לפני 3 שע׳» / «אתמול» / תאריך */
export function formatRelative(d: DateInput, now: number = Date.now()): string {
  const x = toDate(d);
  if (!x) return '—';
  const diff = Math.round((now - x.getTime()) / 1000);
  if (diff < 60) return 'עכשיו';
  if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דק׳`;
  if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שע׳`;
  if (diff < 172800) return 'אתמול';
  return formatDateShort(x);
}
