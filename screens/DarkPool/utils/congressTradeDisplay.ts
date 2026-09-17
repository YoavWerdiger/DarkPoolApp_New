/**
 * congressTradeDisplay.ts
 * -----------------------------------------------------------------------------
 * תצוגת עסקאות קונגרס — רק מה שדיווח STOCK Act באמת מכיל.
 *
 * דיווח PTR מכיל: נכס, סוג עסקה, תאריך ביצוע, תאריך דיווח, וטווח סכום.
 * הוא **אינו** מכיל מספר מניות, מחיר למניה, שווי מדויק, מספר חוזים, strike
 * או תאריך פקיעה. הקובץ הזה לא מייצר אף אחד מהם.
 *
 * כשאין נתון — `null`, והתצוגה מראה "לא זמין". לעולם לא 0 ולא placeholder.
 *
 * הקובץ טהור (בלי React / supabase) כדי שאפשר לבדוק אותו ישירות ב-jest.
 */

export const DARK_POOL_UNAVAILABLE = 'לא זמין';

/* -------------------------------------------------------------------------- */
/* תאריך כפול — נחשף / בוצע                                                   */
/* -------------------------------------------------------------------------- */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function parseDayOrIso(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // תאריך יום בלבד (YYYY-MM-DD) — מעוגן לצהריים UTC כדי שאזור זמן לא יזיז יום
  const ts = /^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(`${s}T12:00:00Z`) : Date.parse(s);
  return Number.isFinite(ts) ? ts : null;
}

/**
 * "לפני 22 שעות" / "לפני 4 שבועות" — עברית עם צורת זוגי.
 * מחזיר null כשהתאריך לא ניתן לפענוח (ולא "לפני 0").
 */
export function formatHebrewAgo(
  raw: string | null | undefined,
  now: number = Date.now()
): string | null {
  const ts = parseDayOrIso(raw);
  if (ts == null) return null;

  const diff = now - ts;
  if (diff < 0) return 'היום';
  if (diff < MINUTE_MS) return 'הרגע';

  const minutes = Math.floor(diff / MINUTE_MS);
  if (minutes < 60) return plural(minutes, 'לפני דקה', 'לפני שתי דקות', 'דקות');

  const hours = Math.floor(diff / HOUR_MS);
  if (hours < 24) return plural(hours, 'לפני שעה', 'לפני שעתיים', 'שעות');

  const days = Math.floor(diff / DAY_MS);
  if (days < 7) return plural(days, 'אתמול', 'לפני יומיים', 'ימים');
  if (days < 30) return plural(Math.floor(days / 7), 'לפני שבוע', 'לפני שבועיים', 'שבועות');
  if (days < 365) {
    return plural(Math.floor(days / 30), 'לפני חודש', 'לפני חודשיים', 'חודשים');
  }
  return plural(Math.floor(days / 365), 'לפני שנה', 'לפני שנתיים', 'שנים');
}

function plural(n: number, one: string, two: string, many: string): string {
  if (n <= 1) return one;
  if (n === 2) return two;
  return `לפני ${n} ${many}`;
}

export interface DualDateLine {
  /** "נחשף לפני 22 שעות" */
  disclosed: string | null;
  /** "בוצע לפני 4 שבועות" */
  traded: string | null;
  /** שתי הצלעות מחוברות ב-" · " — או צלע אחת כשהשנייה חסרה */
  text: string | null;
}

/**
 * שורת התאריך הכפול של הפיד.
 * זה ההבדל המרכזי בין דיווח STOCK Act לעסקה רגילה: העיכוב בין הביצוע לדיווח.
 * שני השדות כבר קיימים ב-`dark_pool_congress_trades`.
 */
export function buildDualDateLine(input: {
  filedAt: string | null | undefined;
  transactionDate: string | null | undefined;
  now?: number;
}): DualDateLine {
  const now = input.now ?? Date.now();
  const disclosedAgo = formatHebrewAgo(input.filedAt, now);
  const tradedAgo = formatHebrewAgo(input.transactionDate, now);

  const disclosed = disclosedAgo ? `נחשף ${disclosedAgo}` : null;
  const traded = tradedAgo ? `בוצע ${tradedAgo}` : null;
  const parts = [disclosed, traded].filter(Boolean) as string[];

  return { disclosed, traded, text: parts.length ? parts.join(' · ') : null };
}

/** תאריך הדיווח פחות תאריך העסקה, בימים. null = חסר תאריך. */
export function disclosureDelayDays(
  filedAt: string | null | undefined,
  transactionDate: string | null | undefined
): number | null {
  const filed = parseDayOrIso(filedAt);
  const traded = parseDayOrIso(transactionDate);
  if (filed == null || traded == null) return null;
  const days = Math.round((filed - traded) / DAY_MS);
  return days >= 0 ? days : null;
}

/** "29 ימים" · null כשאין תאריך. יום 0 = "אותו יום". */
export function formatDisclosureDelay(
  filedAt: string | null | undefined,
  transactionDate: string | null | undefined
): string | null {
  const days = disclosureDelayDays(filedAt, transactionDate);
  if (days == null) return null;
  if (days === 0) return 'אותו יום';
  if (days === 1) return 'יום אחד';
  if (days === 2) return 'יומיים';
  return `${days} ימים`;
}

/** "23.06.2026" — נקרא כאי LTR בתוך טקסט עברי. */
export function formatTradeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const day = String(raw).slice(0, 10);
  const m = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

/* -------------------------------------------------------------------------- */
/* טווח הסכום המדווח                                                          */
/* -------------------------------------------------------------------------- */

/**
 * מדרגות STOCK Act. Quiver מחזיר לעיתים רצפה בלבד ("1001.0") —
 * המדרגה משחזרת את התקרה המדווחת, לא מנחשת סכום.
 */
const STOCK_ACT_BRACKETS: Array<{ low: number; high: number | null }> = [
  { low: 1_001, high: 15_000 },
  { low: 15_001, high: 50_000 },
  { low: 50_001, high: 100_000 },
  { low: 100_001, high: 250_000 },
  { low: 250_001, high: 500_000 },
  { low: 500_001, high: 1_000_000 },
  { low: 1_000_001, high: 5_000_000 },
  { low: 5_000_001, high: 25_000_000 },
  { low: 25_000_001, high: 50_000_000 },
  { low: 50_000_001, high: null },
];

export interface DisclosedAmountRange {
  low: number;
  /** null = מדרגה פתוחה למעלה ("מעל $50,000,000") */
  high: number | null;
  /**
   * `reported` — שני הגבולות הגיעו כפי שדווחו.
   * `bracket`  — הגיעה רצפה בלבד, והתקרה שוחזרה ממדרגת STOCK Act.
   */
  source: 'reported' | 'bracket';
}

/**
 * פירוק ה-`Range` של Quiver לטווח. מחזיר null כשאי אפשר לקבוע טווח —
 * ואז התצוגה מראה "לא זמין" במקום לנחש מספר.
 */
export function parseDisclosedAmountRange(
  raw: string | null | undefined
): DisclosedAmountRange | null {
  if (!raw?.trim()) return null;
  const text = raw.trim();

  // מזהי UUID / תוויות מניות — לא סכומים
  if (/^[0-9a-f-]{30,}$/i.test(text)) return null;
  if (/share/i.test(text) && !/\$|usd|dollar/i.test(text)) return null;

  const nums = (text.match(/[\d,]+(?:\.\d+)?/g) ?? [])
    .map((s) => Math.round(parseFloat(s.replace(/,/g, ''))))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!nums.length) return null;

  if (nums.length >= 2) {
    const low = Math.min(nums[0], nums[nums.length - 1]);
    const high = Math.max(nums[0], nums[nums.length - 1]);
    return { low, high: high > low ? high : null, source: 'reported' };
  }

  const only = nums[0];
  if (/over|above|מעל|\+\s*$/i.test(text)) {
    return { low: only, high: null, source: 'reported' };
  }

  const bracket = STOCK_ACT_BRACKETS.find((b) => b.low === only);
  if (bracket) return { low: bracket.low, high: bracket.high, source: 'bracket' };

  // מספר בודד שאינו רצפת מדרגה — לא ידוע אם הוא גבול או סכום. לא ממציאים.
  return null;
}

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function usdCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const m = Math.round((n / 1_000_000) * 10) / 10;
    return `$${Number.isInteger(m) ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return usd(n);
}

/** "$15,001–$50,000" · "מעל $50,000,000" · null כשאין טווח. */
export function formatDisclosedAmountRange(
  raw: string | null | undefined
): string | null {
  const range = parseDisclosedAmountRange(raw);
  if (!range) return null;
  if (range.high == null) return `מעל ${usd(range.low)}`;
  return `${usd(range.low)}–${usd(range.high)}`;
}

/** גרסה קצרה לשורת הפיד: "$15K–$50K". עיגול של המדרגה, לא של סכום בפועל. */
export function formatDisclosedAmountRangeCompact(
  raw: string | null | undefined
): string | null {
  const range = parseDisclosedAmountRange(raw);
  if (!range) return null;
  if (range.high == null) return `מעל ${usdCompact(range.low)}`;
  return `${usdCompact(range.low)}–${usdCompact(range.high)}`;
}

/* -------------------------------------------------------------------------- */
/* תשואה מאז העסקה — מ-Quiver, לא משוחזרת אצלנו                               */
/* -------------------------------------------------------------------------- */

/**
 * Quiver מחזיר אחוזים (24.11 = +24.11%).
 * 0 הוא ערך לגיטימי; רק null/NaN נחשבים "אין נתון".
 */
export function formatReturnPct(pct: number | null | undefined): string | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

export type ReturnTone = 'positive' | 'negative' | 'neutral';

export function returnTone(pct: number | null | undefined): ReturnTone {
  if (pct == null || !Number.isFinite(pct) || pct === 0) return 'neutral';
  return pct > 0 ? 'positive' : 'negative';
}

/* -------------------------------------------------------------------------- */
/* ערך או "לא זמין"                                                           */
/* -------------------------------------------------------------------------- */

/** כל שדה בטבלת פרטי העסקה עובר דרך כאן — אין 0 מתחזה לנתון. */
export function orUnavailable(value: string | null | undefined): string {
  const v = value?.trim();
  return v ? v : DARK_POOL_UNAVAILABLE;
}
