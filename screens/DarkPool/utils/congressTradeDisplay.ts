import i18n from '../../../lib/i18n';
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

export const DARK_POOL_UNAVAILABLE = i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s1');

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
 * compact=true → "לפני 22 ש׳" / "לפני 4 שב׳" כדי ששתי הצלעות ייכנסו בשורת הפיד.
 * מחזיר null כשהתאריך לא ניתן לפענוח (ולא "לפני 0").
 */
export function formatHebrewAgo(
  raw: string | null | undefined,
  now: number = Date.now(),
  opts?: { compact?: boolean }
): string | null {
  const ts = parseDayOrIso(raw);
  if (ts == null) return null;

  const diff = now - ts;
  if (diff < 0) return i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s2');
  if (diff < MINUTE_MS) return i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s3');

  const minutes = Math.floor(diff / MINUTE_MS);
  if (minutes < 60) {
    return opts?.compact
      ? compactAgo(minutes, i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s4'), i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s5'))
      : plural(minutes, i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s5'), i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s6'), i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s7'));
  }

  const hours = Math.floor(diff / HOUR_MS);
  if (hours < 24) {
    return opts?.compact
      ? compactAgo(hours, i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s8'), i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s9'))
      : plural(hours, i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s9'), i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s10'), i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s11'));
  }

  const days = Math.floor(diff / DAY_MS);
  if (days < 7) {
    return opts?.compact
      ? compactAgo(days, i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s12'), i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s13'), i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s14'))
      : plural(days, i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s13'), i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s14'), i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s15'));
  }
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return opts?.compact
      ? compactAgo(weeks, i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s16'), i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s17'), i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s18'))
      : plural(weeks, i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s17'), i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s18'), i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s19'));
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return opts?.compact
      ? compactAgo(months, i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s20'), i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s21'), i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s22'))
      : plural(months, i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s21'), i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s22'), i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s23'));
  }
  const years = Math.floor(days / 365);
  return opts?.compact
    ? compactAgo(years, i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s24'), i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s25'), i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s26'))
    : plural(years, i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s25'), i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s26'), i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s27'));
}

function compactAgo(
  n: number,
  unit: string,
  one: string,
  two?: string
): string {
  if (n <= 1) return one;
  if (n === 2 && two) return two;
  // רווח בין המספר ליחידה — בלי זה 20ש׳ נדבק וה-bidi מערבב אותיות.
  return i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s28', { v0: n, v1: unit });
}

function plural(n: number, one: string, two: string, many: string): string {
  if (n <= 1) return one;
  if (n === 2) return two;
  return i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s28', { v0: n, v1: many });
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
  /** שורת פיד קצרה — שתי הצלעות נשארות גלויות. */
  compact?: boolean;
}): DualDateLine {
  const now = input.now ?? Date.now();
  const agoOpts = input.compact ? { compact: true } : undefined;
  const disclosedAgo = formatHebrewAgo(input.filedAt, now, agoOpts);
  const tradedAgo = formatHebrewAgo(input.transactionDate, now, agoOpts);

  const filedDay = isoDayKey(input.filedAt);
  const tradedDay = isoDayKey(input.transactionDate);
  const sameDay =
    Boolean(filedDay && tradedDay && filedDay === tradedDay) &&
    Boolean(disclosedAgo);

  if (sameDay) {
    const line = i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s29', { v0: disclosedAgo });
    return { disclosed: line, traded: null, text: line };
  }

  const disclosed = disclosedAgo ? i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s30', { v0: disclosedAgo }) : null;
  const traded = tradedAgo ? i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s31', { v0: tradedAgo }) : null;
  const parts = [disclosed, traded].filter(Boolean) as string[];

  return { disclosed, traded, text: parts.length ? parts.join(' · ') : null };
}

/**
 * שורת תאריכים לכרטיס פיד: ISO כפול מנצח; אם יש רק צלע אחת משלימים מתווית מוכנה.
 * לא מוותרים על «נחשף» או «בוצע» כשהנתון קיים.
 */
export function resolveFeedDatesLine(input: {
  filedAt?: string | null;
  transactionDate?: string | null;
  datesText?: string | null;
  now?: number;
}): string | null {
  const dual = buildDualDateLine({
    filedAt: input.filedAt,
    transactionDate: input.transactionDate,
    now: input.now,
    compact: true,
  });
  const fallback = input.datesText?.trim() || null;
  if (dual.disclosed && dual.traded) return dual.text;
  if (fallback && /נחשף/.test(fallback) && /בוצע/.test(fallback)) return fallback;
  if (!dual.disclosed && dual.traded && fallback && /נחשף/.test(fallback)) {
    return `${fallback} · ${dual.traded}`;
  }
  if (dual.disclosed && !dual.traded && fallback && /בוצע/.test(fallback)) {
    return `${dual.disclosed} · ${fallback}`;
  }
  return dual.text || fallback;
}

function isoDayKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const ts = parseDayOrIso(s);
  if (ts == null) return null;
  return new Date(ts).toISOString().slice(0, 10);
}

/** קונגרס: קנה/מכר מ-transaction_type. אף פעם לא «רכישה בשוק». */
export function formatCongressTxnLabel(transactionType: string): string {
  const t = transactionType.trim().toLowerCase();
  if (
    t === 's' ||
    t === 'sell' ||
    t === 'sale' ||
    t === 'sold' ||
    t.includes('sell') ||
    t.includes('sale') ||
    t.includes('מכר') ||
    t.includes('מכיר')
  ) {
    return i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s32');
  }
  return i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s33');
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
  if (days === 0) return i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s34');
  if (days === 1) return i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s35');
  if (days === 2) return i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s36');
  return i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s37', { v0: days });
}

/** "23.06.2026" — נקרא כאי LTR בתוך טקסט עברי. */
export function formatTradeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const day = String(raw).slice(0, 10);
  const m = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

const HEBREW_MONTHS = [
  'בינואר',
  'בפברואר',
  'במרץ',
  'באפריל',
  'במאי',
  'ביוני',
  'ביולי',
  'באוגוסט',
  'בספטמבר',
  'באוקטובר',
  'בנובמבר',
  'בדצמבר',
] as const;

/**
 * "8 בספטמבר" — כמו InsiderWave "Sep 8". בלי שנה (הטבלה שומרת את היום המלא).
 * בלי אפס מוביל. null כשהתאריך לא YYYY-MM-DD.
 */
export function formatHebrewMonthDay(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const day = String(raw).slice(0, 10);
  const m = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const monthIdx = Number(m[2]) - 1;
  const d = Number(m[3]);
  if (!Number.isFinite(d) || d < 1 || d > 31) return null;
  const month = HEBREW_MONTHS[monthIdx];
  if (!month) return null;
  return `${d} ${month}`;
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
  if (range.high == null) return i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s38', { v0: usd(range.low) });
  return `${usd(range.low)}–${usd(range.high)}`;
}

/** גרסה קצרה לשורת הפיד: "$15K–$50K". עיגול של המדרגה, לא של סכום בפועל. */
export function formatDisclosedAmountRangeCompact(
  raw: string | null | undefined
): string | null {
  const range = parseDisclosedAmountRange(raw);
  if (!range) return null;
  if (range.high == null) return i18n.t('auto.screens__DarkPool__utils__congressTradeDisplay.s38', { v0: usdCompact(range.low) });
  return `${usdCompact(range.low)}–${usdCompact(range.high)}`;
}

/* -------------------------------------------------------------------------- */
/* תשואה מאז העסקה — % טיקר (Quiver PriceChange או פתיחה מול חי)              */
/* -------------------------------------------------------------------------- */

/**
 * Quiver מחזיר אחוזים (24.11 = +24.11%). Form 4 מחושב מול מחיר חי.
 * 0 הוא ערך לגיטימי; רק null/NaN נחשבים "אין נתון". שני ספרות כמו InsiderWave.
 */
export function formatReturnPct(pct: number | null | undefined): string | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
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
