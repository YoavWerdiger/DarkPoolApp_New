/**
 * עזרי כיוון טקסט (BiDi) להתראות Push בעברית.
 * עוטפים קטעים לטיניים/מספריים ב-LRI כדי שלא יתהפכו בסביבת RTL.
 */
import { formatEconomicDisplayValue } from './economicNumberFormat.ts';
import { translateEconomicEventNameSmart } from './economicEventTranslations.ts';

const LRI = '\u2066' // Left-to-Right Isolate
const PDI = '\u2069' // Pop Directional Isolate
const RLM = '\u200F' // Right-to-Left Mark — הקשר RTL לשורה
export const PUSH_SEP = ' · '

/** מסיר סימני BiDi שהוכנסו בטריגר DB לפני תרגום/עיבוד */
export function stripPushBidiMarkers(text: string | null | undefined): string {
  return String(text ?? '').replace(/[\u200F\u2066\u2069]/g, '').trim()
}

/** רצף לטיני/מספרי בתוך שורה מעורבת */
const LTR_RUN = /[A-Za-z0-9$](?:[A-Za-z0-9$%.,+\-/'":]*)?/g

/** קטע LTR (שם חברה, $, EPS, אחוזים) */
export function ltr(fragment: string | null | undefined): string {
  const t = String(fragment ?? '').trim()
  if (!t) return ''
  return `${LRI}${t}${PDI}`
}

/**
 * עטיפת BiDi לטקסט דינמי (חדשות, כותרת משנה, שורות שלא עברו פורמט ייעודי).
 * idempotent — לא נוגע בטקסט שכבר מכיל LRI.
 */
export function ensurePushBidi(text: string | null | undefined): string {
  const raw = String(text ?? '')
  if (!raw.trim()) return ''
  if (raw.includes(LRI)) return raw

  const wrapped = raw.replace(LTR_RUN, (match) => `${LRI}${match}${PDI}`)
  return `${RLM}${wrapped}`
}

/** BiDi לכל שורה בנפרד (גוף התראה מרובה שורות) */
export function formatPushMultiline(text: string | null | undefined): string {
  const raw = String(text ?? '')
  if (!raw.trim()) return ''
  return raw
    .split('\n')
    .map((line) => ensurePushBidi(line))
    .join('\n')
}

export function economicReportTitle(): string {
  return ensurePushBidi('פורסם דו"ח חדש!')
}

/** $TICKER — קצר וקריא יותר משם החברה המלא */
function tickerTag(ticker: string): string {
  const t = String(ticker ?? '').trim().toUpperCase()
  return ltr(t.startsWith('$') ? t : `$${t}`)
}

export function earningsUpcomingTitle(ticker: string): string {
  return `${tickerTag(ticker)} מדווחת בקרוב!`
}

export function earningsResultsTitle(ticker: string): string {
  return `${tickerTag(ticker)} פרסמה דוח רבעוני!`
}

/** «בקו הצפי» / «מעל ב-1.8%» / «מתחת ב-1.8%» — קצר, בתוך הסוגריים של הצפי */
export function surpriseVerdict(pct: number | null | undefined): string {
  if (pct == null || isNaN(pct)) return ''
  if (Math.abs(pct) < 0.05) return 'בקו הצפי'
  const mag = ltr(`${Math.abs(pct).toFixed(1)}%`)
  if (pct > 0) return `מעל ב-${mag}`
  return `מתחת ב-${mag}`
}

/** «רווחיות: $0.79 (צפי $0.79 · בקו הצפי)» — בלי תוויות לטיניות, הצפי והפער בסוגריים */
export function buildEarningsMetricLine(
  hebrewLabel: string,
  _latinLabel: string,
  actual: string,
  estimate: string | null,
  surprisePct: number | null | undefined,
): string {
  let line = `${hebrewLabel}: ${ltr(actual)}`
  const parts: string[] = []
  if (estimate && estimate !== 'N/A' && estimate !== '—') parts.push(`צפי ${ltr(estimate)}`)
  const verdict = surpriseVerdict(surprisePct)
  if (verdict) parts.push(verdict)
  if (parts.length) line += ` (${parts.join(PUSH_SEP)})`
  return line
}

export function buildEarningsForecastLine(
  hebrewLabel: string,
  latinLabel: string,
  estimate: string,
): string {
  return `${hebrewLabel} (${ltr(latinLabel)}): צפי ${ltr(estimate)}`
}

export function buildEarningsUpcomingBody(
  timeDisplay: string,
  minutesDiff: number,
  epsEstimate: string | null,
  revenueEstimate: string | null,
): string {
  const lines = [
    `דיווח ${timeDisplay}${PUSH_SEP}בעוד ${ltr(String(minutesDiff))} דקות`,
  ]
  if (epsEstimate) {
    lines.push(buildEarningsForecastLine('רווחיות', 'EPS', epsEstimate))
  }
  if (revenueEstimate) {
    lines.push(`הכנסות: צפי ${ltr(revenueEstimate)}`)
  }
  return lines.join('\n')
}

export function buildEconomicResultBody(actual: string, forecast: string): string {
  const f = forecast && forecast !== '—' ? forecast : '—'
  return `תוצאה: ${ltr(actual)}${PUSH_SEP}צפי: ${ltr(f)}`
}

/** שם דוח בעברית + גוף עם פסיקים — כמו בממשק היומן הכלכלי */
export function buildEconomicPushContent(data: {
  title?: string | null
  actual?: string | null
  forecast?: string | null
}): { eventName: string; body: string; androidBody: string } {
  const rawTitle = stripPushBidiMarkers(data.title)
  const hebrewTitle = translateEconomicEventNameSmart(rawTitle)
  const eventName = ensurePushBidi(hebrewTitle)

  const actualRaw = stripPushBidiMarkers(data.actual)
  const forecastRaw = stripPushBidiMarkers(data.forecast)
  // לפי כותרת הדוח: שיעורים/ריבית עם '%', CPI וכד' בלי
  const actual =
    formatEconomicDisplayValue(actualRaw, rawTitle) ||
    actualRaw.replace(/[%٪]/g, '').trim()
  const forecast =
    formatEconomicDisplayValue(forecastRaw, rawTitle) ||
    forecastRaw.replace(/[%٪]/g, '').trim() ||
    '—'

  const resultLine = buildEconomicResultBody(actual, forecast)
  const body = formatPushMultiline(resultLine)
  const androidBody = formatPushMultiline(`${hebrewTitle}\n${resultLine}`)
  return { eventName, body, androidBody }
}
