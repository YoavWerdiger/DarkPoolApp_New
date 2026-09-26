import type { TextStyle, ViewStyle } from 'react-native';
import { formatFeedTickerDisplay } from './feedTradeDisplay';

const LRI = '\u2066';
const PDI = '\u2069';

/**
 * משפט/כותרת עברית ב-Dark Pool.
 *
 * רק `writingDirection` + `textAlign` — בלי `direction:'ltr'` על ה-Text.
 * `direction:'ltr'` שייך ל-View העוטף (תיבת יישור לימין הפיזי). על ה-Text עצמו
 * הצירוף direction:ltr + writingDirection:rtl הופך אותיות ב-web («עסקפאות»).
 *
 * כותרת מסך בהדר היא center — לא כאן.
 * נתונים ($NVDA, 1,000, +1.2%) מבודדים ב-isolateData / isolateNumericRuns.
 */
export const hebrewText: TextStyle = {
  writingDirection: 'rtl',
  textAlign: 'right',
};

export const dataText: TextStyle = {
  writingDirection: 'ltr',
  textAlign: 'left',
  fontVariant: ['tabular-nums'],
};

/**
 * שם אדם/חברה באנגלית בתוך עץ RTL.
 * LRI על שם מלא הופך את סדר המילים ב-RN — לכן רק `writingDirection: ltr`.
 * textAlign right מצמיד את השם לאווטאר בימין, לא לקצה השמאלי של הכרטיס.
 */
export const ltrNameText: TextStyle = {
  direction: 'ltr',
  writingDirection: 'ltr',
  textAlign: 'right',
};

export const rowMixed: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
};

export function toDataIsland(value: string | number | null | undefined): string {
  if (value == null) return '';
  const text = String(value).trim();
  if (!text) return '';
  return `${LRI}${text}${PDI}`;
}

const HEBREW_RE = /[\u0590-\u05FF]/;

/**
 * טיקר / סכום / תאריך / אחוז / קוד Form 4 — לא שם אדם ולא משפט מעורב.
 * LRI על "Michael C. Bucella" (או על משפט שלם) הופך את הסדר במסך.
 */
export function isPureDataSegment(text: string): boolean {
  const t = text.trim();
  if (!t || HEBREW_RE.test(t)) return false;
  if (/^\d{1,4}[./-]\d{1,2}([./-]\d{1,4})?$/.test(t)) return true;
  if (/\d/.test(t) && /^[$\d+\-–.,%KMBT:/\s]+$/i.test(t)) return true;
  if (/^\$?[A-Z]{1,6}([.\-][A-Z]{1,3})?$/.test(t)) return true;
  if (/^[A-Z]$/.test(t)) return true;
  return false;
}

/**
 * אי LTR רק למקטע שכולו נתון (טיקר / סכום / תאריך / אחוז).
 *
 * מחרוזת מעורבת כמו "בשווי: $15K–$50K" חייבת להישאר בלי isolate: עטיפה שלה
 * הופכת את כל המקטע ל-LTR ומזיזה את המילה העברית לצד הלא נכון. הפיסוק שמפריד
 * בין המקטעים נשאר ניטרלי ולכן יורש את כיוון הפסקה (rtl) — בלי נקודה תועה בקצה.
 */
export function isolateData(part: string | number | null | undefined): string {
  if (part == null) return '';
  const text = String(part);
  if (!text.trim()) return '';
  return isPureDataSegment(text) ? toDataIsland(text) : text;
}

const NUMERIC_RUN_RE = /\d+(?:[.,]\d+)*%?/g;

/**
 * מבודד רק ריצות מספר בתוך משפט עברי — לא את המשפט, לא שמות.
 * «נחשף לפני 20 ש׳» → המספר ב-LRI, העברית נשארת פסקת RTL.
 */
export function isolateNumericRuns(text: string | null | undefined): string {
  if (text == null) return '';
  if (!text) return '';
  return text.replace(NUMERIC_RUN_RE, (run) => toDataIsland(run));
}

export type TradeActivitySubtitleParts = {
  lead: string;
  name: string;
  mid: string;
  tickerDisplay: string;
  tickerIsolated: string;
  /** סדר קריאה לטסטים/a11y — לא לרנדר כ-Text יחיד. */
  sentence: string;
};

/**
 * «עסקאות נוספות של NAME ב-$TICKER»
 * השם בלי isolate; הטיקר מבודד רק אם הוא נתון טהור. המשפט כולו לעולם לא ב-LRI.
 */
export function tradeActivitySubtitleParts(
  personName: string,
  ticker: string
): TradeActivitySubtitleParts {
  const name = personName.trim();
  const tickerDisplay = formatFeedTickerDisplay(ticker);
  return {
    lead: 'עסקאות נוספות של ',
    name,
    mid: ' ב-',
    tickerDisplay,
    tickerIsolated: isolateData(tickerDisplay),
    sentence: `עסקאות נוספות של ${name} ב-${tickerDisplay}`,
  };
}
