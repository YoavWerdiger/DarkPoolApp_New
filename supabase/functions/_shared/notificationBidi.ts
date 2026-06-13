/**
 * עזרי כיוון טקסט (BiDi) להתראות Push בעברית.
 * עוטפים קטעים לטיניים/מספריים ב-LRI כדי שלא יתהפכו בסביבת RTL.
 */
const LRI = '\u2066' // Left-to-Right Isolate
const PDI = '\u2069' // Pop Directional Isolate
const RLM = '\u200F' // Right-to-Left Mark — הקשר RTL לשורה
export const PUSH_SEP = ' · '

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

export function earningsUpcomingTitle(companyName: string): string {
  return `${ltr(companyName)} מדווחת בקרוב!`
}

export function earningsResultsTitle(companyName: string): string {
  return `${ltr(companyName)} פרסמה דוח רבעוני!`
}

export function surpriseVerdict(pct: number | null | undefined): string {
  if (pct == null || isNaN(pct)) return ''
  if (Math.abs(pct) < 0.05) return 'בקו הצפי'
  const mag = ltr(`${Math.abs(pct).toFixed(1)}%`)
  if (pct > 0) return `מעל הצפי ב-${mag}`
  return `מתחת לצפי ב-${mag}`
}

export function buildEarningsMetricLine(
  hebrewLabel: string,
  latinLabel: string,
  actual: string,
  estimate: string | null,
  surprisePct: number | null | undefined,
): string {
  const label = `${hebrewLabel} (${ltr(latinLabel)})`
  let line = `${label}: ${ltr(actual)}`
  if (estimate && estimate !== 'N/A' && estimate !== '—') {
    line += `${PUSH_SEP}צפי ${ltr(estimate)}`
  }
  const verdict = surpriseVerdict(surprisePct)
  if (verdict) line += `${PUSH_SEP}${verdict}`
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
