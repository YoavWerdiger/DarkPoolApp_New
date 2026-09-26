/**
 * insiderTradeDisplay.ts
 * -----------------------------------------------------------------------------
 * תצוגת עסקאות בכירים (Form 4) — רק מה שהדיווח באמת מכיל.
 *
 * בניגוד לדיווחי STOCK Act, Form 4 מכיל כמות מניות ומחיר אמיתיים. אבל לפי
 * `docs/ROSTER_EXECUTIVES.md` §1.5 המקור שלנו (Quiver `/beta/live/insiders`)
 * **לא** מחזיר:
 *   • דגל 10b5-1 → אסור לכתוב "מכירה מתוכננת" על שום שורה
 *   • `security_title` → אי אפשר לדעת אם ה-`Shares` הן מניות רגילות או נגזר
 *   • `natureofownership` / CIK / `formtype`
 *
 * ועוד כלל מ-§4.1: ב-`A`/`G`/`C`/`J` ולרוב `M` המחיר הוא 0, ולכן
 * `shares × price = 0`. **אסור להציג "$0"** — 0 שם פירושו "אין מחיר בדיווח".
 *
 * `P` = «רכישה בשוק» רק כשיש אות Form 4 P. SEC מגדיר P כ-open market או
 * פרטית; Quiver לא מבדיל — לכן לא «בשוק הפתוח». A/M/F/G לעולם לא «בשוק».
 *
 * הקובץ טהור (בלי React / supabase) כדי שאפשר לבדוק אותו ישירות ב-jest.
 */

export type InsiderTradeTone = 'buy' | 'sell' | 'neutral';

export interface InsiderCodeMeaning {
  /** הקוד כפי שהוא מופיע ב-Form 4 — מוצג למשתמש כדי שיוכל לאמת מול SEC. */
  code: string;
  /** תיאור עברי של מה שהקוד אומר. בלי פרשנות לכוונה של האדם. */
  label: string;
  /**
   * `buy` שמור ל-`P` או לתווית «רכישה» בלי קוד.
   * `sell` שמור ל-`S`. הענקה / מימוש / מתנה / גריעת מס הם ניטרליים.
   */
  tone: InsiderTradeTone;
}

/**
 * טבלת הקודים. הסט נלקח מ-`docs/ROSTER_EXECUTIVES.md` §2.5 — 10 קודים שנצפו
 * בפועל ב-Quiver (`P S A M F G J C D X`) בתוספת `I` שנצפה ב-Form 4 אמיתי,
 * ו-`O` שמוצהר בטיפוס שלנו אך לא אומת.
 */
const INSIDER_CODES: Record<string, Omit<InsiderCodeMeaning, 'code'>> = {
  /** Form 4 TransactionCode P — Open market or private purchase. */
  P: { label: 'קנה', tone: 'buy' },
  S: { label: 'מכר', tone: 'sell' },
  A: { label: 'הענקה', tone: 'neutral' },
  M: { label: 'מימוש', tone: 'neutral' },
  F: { label: 'גריעת מס', tone: 'neutral' },
  G: { label: 'מתנה', tone: 'neutral' },
  D: { label: 'מסירת מניות לחברה', tone: 'neutral' },
  J: { label: 'עסקה אחרת שדווחה בקוד J', tone: 'neutral' },
  C: { label: 'המרה של נייר ערך נגזר', tone: 'neutral' },
  X: { label: 'מימוש אופציה', tone: 'neutral' },
  I: { label: 'עסקה שיקולית בתוכנית של החברה', tone: 'neutral' },
  O: { label: 'מימוש אופציה מחוץ לכסף', tone: 'neutral' },
};

/** תווית "רכישה" בלי קוד Form 4 — אסור להציג אותה כ-P / רכישה בשוק. */
const INFERRED_BUY_ALIASES = new Set(['BUY', 'PURCHASE', 'רכישה']);

/** אות בודדת של Form 4 — רק אז מציגים שורת «קוד עסקה». */
export function isForm4TransactionCode(raw: string | null | undefined): boolean {
  return /^[A-Z]$/.test((raw ?? '').trim().toUpperCase());
}

/**
 * פירוש קוד העסקה. קוד לא מוכר לא נזרק ולא מתורגם בכוח — הוא מוצג כפי שהוא,
 * כדי שלא נמציא משמעות לשורה שלא ראינו קודם.
 *
 * `P` בלבד = רכישה בשוק. תווית עברית «רכישה» בלי האות P לא מקבלת את המשפט הזה.
 */
export function describeInsiderCode(
  raw: string | null | undefined
): InsiderCodeMeaning {
  const code = (raw ?? '').trim().toUpperCase();
  if (!code) return { code: '', label: 'עסקה שדווחה ב-Form 4', tone: 'neutral' };
  if (INFERRED_BUY_ALIASES.has(code) || INFERRED_BUY_ALIASES.has(raw?.trim() ?? '')) {
    return { code: '', label: 'קנה', tone: 'buy' };
  }
  const known = INSIDER_CODES[code];
  if (known) return { code, label: known.label, tone: known.tone };
  return { code, label: `עסקה שדווחה בקוד ${code}`, tone: 'neutral' };
}

/**
 * כותרת פעולה ליד הטיקר.
 * `P`/`S` מקבלים «את $NVDA» כמו בפיד; הענקה/מימוש/מתנה — בלי «את» ובלי «בשוק».
 */
export function formatInsiderActionLead(meaning: InsiderCodeMeaning): string {
  if (meaning.code === 'P' || (meaning.tone === 'buy' && !meaning.code)) return 'קנה';
  if (meaning.code === 'S') return 'מכר';
  return meaning.label;
}

/* -------------------------------------------------------------------------- */
/* כמות, מחיר ושווי                                                           */
/* -------------------------------------------------------------------------- */

/**
 * `Shares` של Quiver יכול להיות שברי (`1523.944`). מציגים את הגודל כפי שדווח;
 * הכיוון (רכישה / מסירה) נקרא מקוד העסקה ולא מהסימן.
 */
export function formatInsiderShares(
  shares: number | null | undefined
): string | null {
  if (shares == null || !Number.isFinite(shares)) return null;
  const n = Math.abs(shares);
  if (n === 0) return null;
  const rounded = Math.abs(n - Math.round(n)) < 0.0005 ? Math.round(n) : n;
  return Number.isInteger(rounded)
    ? rounded.toLocaleString('en-US')
    : rounded.toLocaleString('en-US', { maximumFractionDigits: 3 });
}

/**
 * מחיר למניה. 0 בדיווח פירושו "אין מחיר" (הענקה / מתנה / המרה) —
 * מחזיר null ולא "$0.00".
 */
export function formatInsiderPrice(
  price: number | null | undefined
): string | null {
  if (price == null || !Number.isFinite(price) || price <= 0) return null;
  return `$${price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * שווי העסקה. מחושב רק כש**שני** הרכיבים אמיתיים; אחרת null.
 * `value` שהגיע כ-0 מהמיפוי נחשב חסר, לא אפס.
 */
export function insiderTradeValueUsd(input: {
  shares: number | null | undefined;
  price: number | null | undefined;
  value?: number | null | undefined;
}): number | null {
  const { shares, price, value } = input;
  if (value != null && Number.isFinite(value) && value > 0) return value;
  if (
    shares == null ||
    price == null ||
    !Number.isFinite(shares) ||
    !Number.isFinite(price) ||
    price <= 0
  ) {
    return null;
  }
  const computed = Math.abs(shares) * price;
  return computed > 0 ? computed : null;
}

/** "$9.48M" · "$231,400" · null כשאין מחיר בדיווח. */
export function formatInsiderValue(input: {
  shares: number | null | undefined;
  price: number | null | undefined;
  value?: number | null | undefined;
}): string | null {
  const usd = insiderTradeValueUsd(input);
  if (usd == null) return null;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(usd).toLocaleString('en-US')}`;
}

/**
 * תווית שורת השווי במסך פרטי עסקה. כשיש מספר אמיתי (מכפלת כמות×מחיר
 * מהדיווח, או שווי שדווח) — «שווי אחזקה». לא midpoint ולא «משוער».
 */
export function insiderValueFieldLabel(input: {
  shares: number | null | undefined;
  price: number | null | undefined;
  value?: number | null | undefined;
}): string | null {
  if (insiderTradeValueUsd(input) == null) return null;
  return 'שווי אחזקה';
}

/** "סמנכ״ל כספים" / null — `officerTitle` ריק ב-61% מהשורות (§3.3). */
export function formatInsiderRole(role: string | null | undefined): string | null {
  const r = role?.trim();
  return r ? r : null;
}
