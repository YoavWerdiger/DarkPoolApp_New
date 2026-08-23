import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.94.1'

export interface RawEarningsEvent {
  code?: string;
  report_date?: string;
  date?: string;
  date_confirmed?: string | null;
  time?: string | null;
  before_after_market?: string | null;
  currency?: string | null;
  exchange?: string | null;
  company_name?: string | null;
  period?: string | null;
  period_year?: number | string | null;
  // EPS fields
  actual?: number | string | null;
  estimate?: number | string | null;
  difference?: number | string | null;
  percent?: number | string | null;
  eps_prior?: number | string | null;
  eps_surprise?: number | string | null;
  eps_surprise_percent?: number | string | null;
  // Revenue fields
  revenue_actual?: number | string | null;
  revenue_estimate?: number | string | null;
  revenue_estimate_avg?: number | string | null;
  revenue_estimate_low?: number | string | null;
  revenue_estimate_high?: number | string | null;
  revenue_estimate_year_ago?: number | string | null;
  revenue_estimate_analysts_count?: number | string | null;
  revenue_estimate_growth?: number | string | null;
  revenue_surprise?: number | string | null;
  revenue_surprise_percent?: number | string | null;
  revenue_yoy?: number | string | null;
  // Metadata
  importance?: number | string | null;
  notes?: string | null;
  benzinga_updated?: number | string | null;
}

export interface EarningsRecord {
  id: string;
  code: string;
  report_date: string;
  date: string;
  date_confirmed: string | null;
  time: string | null;
  before_after_market: string | null;
  currency: string | null;
  exchange: string | null;
  company_name: string | null;
  period: string | null;
  period_year: number | null;
  // EPS fields
  actual: number | null;
  estimate: number | null;
  difference: number | null;
  percent: number | null;
  eps_prior: number | null;
  eps_surprise: number | null;
  eps_surprise_percent: number | null;
  // Revenue fields
  revenue_actual: number | null;
  revenue_estimate_avg: number | null;
  revenue_estimate_low: number | null;
  revenue_estimate_high: number | null;
  revenue_estimate_year_ago: number | null;
  revenue_estimate_analysts_count: number | null;
  revenue_estimate_growth: number | null;
  revenue_surprise: number | null;
  revenue_surprise_percent: number | null;
  revenue_yoy: number | null;
  // Metadata
  importance: number | null;
  notes: string | null;
  benzinga_updated: number | null;
  source: string;
  updated_at: string;
}

interface PrepareOptions {
  now?: Date;
  timeZone?: string;
  requireUSCode?: boolean;
  skipPreferredShares?: boolean;
  source?: string;
}

interface PreparedRecord {
  record: EarningsRecord;
  meta: {
    adjusted: boolean;
    adjustmentReason?: string;
  };
}

const DEFAULT_TIME_ZONE = 'Asia/Jerusalem';
const DEFAULT_SOURCE = 'Benzinga';

const numberOrNull = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const getDateFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

const getTimeFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });

const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

export const getDateInTimeZone = (date: Date, timeZone: string): string =>
  getDateFormatter(timeZone).format(date);

const sanitizeDateString = (value?: string | null, fallback?: string): string => {
  if (value && /\d{4}-\d{2}-\d{2}/.test(value)) {
    return value;
  }
  return fallback ?? getDateInTimeZone(new Date(), DEFAULT_TIME_ZONE);
};

/** ברירת מחדל לסינון push — דיווחי US רגילים */
export const DEFAULT_EARNINGS_IMPORTANCE = 3;

/**
 * המרת זמן קיר (YYYY-MM-DD + HH:MM:SS) באזור זמן נתון ל-UTC ISO.
 * חשוב ל-DST: לא לקודד offset קשיח כמו +00.
 */
export function zonedWallTimeToUtcIso(
  reportDate: string,
  wallTime: string,
  timeZone: string,
): string {
  const date = String(reportDate).slice(0, 10);
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute, second = 0] = wallTime.split(':').map(Number)
  const desiredAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, second || 0)

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })

  let utcMs = desiredAsUtcMs
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(utcMs))
        .filter((p) => p.type !== 'literal')
        .map((p) => [p.type, p.value]),
    ) as Record<string, string>
    const asUtcMs = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    )
    utcMs += desiredAsUtcMs - asUtcMs
  }

  return new Date(utcMs).toISOString()
}

/**
 * זמן דיווח משוער (UTC) ל-scheduling של push כשאין earnings_date_time מה-API.
 * מקור הנתונים (EarningsHub/Parse) נותן רק BMO/AMC — לא timestamp מדויק למניה.
 * BeforeMarket ≈ 07:00 America/New_York · AfterMarket ≈ 16:05 America/New_York
 *
 * היסטורית נשמר 12:00Z/21:00Z — זה יצר תזכורת קבועה ב-14:45 שעון ישראל
 * לכל דיווחי BMO (12:00 UTC = 15:00 IDT → 15 דק׳ לפני).
 */
export function deriveEarningsDateTimeIso(
  reportDate: string,
  beforeAfterMarket: string | null | undefined,
): string {
  const date = String(reportDate).slice(0, 10);
  const wallTime = beforeAfterMarket === 'BeforeMarket' ? '07:00:00' : '16:05:00'
  return zonedWallTimeToUtcIso(date, wallTime, 'America/New_York')
}

/** סוגי push דיווחים בטבלת הזיכרון העמיד */
export type EarningsDurableNotifType = 'reminder_15m' | 'results_available'

export function normalizeEarningsTicker(
  ticker?: string | null,
  code?: string | null,
): string {
  const fromTicker = (ticker ?? '').toString().trim().toUpperCase()
  if (fromTicker) return fromTicker
  const fromCode = (code ?? '').toString().trim().toUpperCase()
  if (!fromCode) return ''
  return fromCode.includes('.') ? fromCode.split('.')[0]! : fromCode
}

/**
 * טוען זיכרון dedup עמיד: האם כבר נשלח/נרשם push למשתמש+טיקר+תאריך+סוג.
 * מחזיר true אם התביעה הצליחה (מותר לשלוח), false אם כבר נשלח.
 */
export async function claimEarningsNotificationSlot(
  supabase: SupabaseClient,
  params: {
    userId: string
    ticker: string
    reportDate: string
    notificationType: EarningsDurableNotifType
    earningsReportId?: string | null
  },
): Promise<boolean> {
  const ticker = normalizeEarningsTicker(params.ticker)
  const reportDate = String(params.reportDate ?? '').slice(0, 10)
  if (!ticker || !/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
    console.warn('claimEarningsNotificationSlot: invalid ticker/reportDate', params)
    return false
  }

  const { error } = await supabase.from('earnings_notifications_sent').insert({
    user_id: params.userId,
    ticker,
    report_date: reportDate,
    notification_type: params.notificationType,
    earnings_report_id: params.earningsReportId ?? null,
  })

  if (error) {
    if ((error as { code?: string }).code === '23505') return false
    console.error('claimEarningsNotificationSlot insert failed:', error)
    // שגיאה תשתיתית — לא מסמנים כ"נשלח" וחוזרים בריצה הבאה
    throw error
  }
  return true
}

/** משתמשים עם device token פעיל + התראות דיווחים (ברירת מחדל: מופעל) */
export async function fetchEarningsNotificationUsers(
  supabase: SupabaseClient,
): Promise<{ user_id: string }[]> {
  const { data: tokens, error: tokensError } = await supabase
    .from('device_tokens')
    .select('user_id')
    .eq('is_active', true)
    .not('user_id', 'is', null)

  if (tokensError) throw tokensError

  const userIds = [...new Set((tokens ?? []).map((t) => t.user_id as string).filter(Boolean))]
  if (userIds.length === 0) return []

  const { data: settings, error: settingsError } = await supabase
    .from('user_notification_settings')
    .select('user_id, notifications_enabled, earnings_notifications')
    .in('user_id', userIds)

  if (settingsError) throw settingsError

  const settingsByUser = new Map(
    (settings ?? []).map((row) => [row.user_id as string, row]),
  )

  return userIds
    .filter((userId) => {
      const row = settingsByUser.get(userId)
      if (!row) return true
      if (row.notifications_enabled === false) return false
      if (row.earnings_notifications === false) return false
      return true
    })
    .map((user_id) => ({ user_id }))
}

/** חלון (ימים) לזיהוי תאריכי אומדן ישנים של אותו אירוע דיווח */
export const STALE_ESTIMATE_WINDOW_DAYS = 21

/** חיבור ימים לתאריך YYYY-MM-DD בלי הזזות timezone מקומיות */
export function addCalendarDays(dateStr: string, days: number): string {
  const d = new Date(`${String(dateStr).slice(0, 10)}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function calendarDaysBetween(a: string, b: string): number {
  const msA = Date.parse(`${String(a).slice(0, 10)}T12:00:00Z`)
  const msB = Date.parse(`${String(b).slice(0, 10)}T12:00:00Z`)
  return Math.abs(Math.round((msA - msB) / 86_400_000))
}

function tickerKeyFromParts(ticker?: string | null, code?: string | null): string {
  const fromTicker = (ticker ?? '').toString().trim().toUpperCase()
  if (fromTicker) return fromTicker
  const fromCode = (code ?? '').toString().trim().toUpperCase()
  if (!fromCode) return ''
  return fromCode.includes('.') ? fromCode.split('.')[0]! : fromCode
}

/**
 * מסיר מרשומות ה-batch אומדנים ליד דיווח עם actual (אותו טיקר).
 * מונע upsert חוזר של תאריכי אומדן ישנים כשה-API עדיין מחזיר אותם.
 */
export function dropEstimatesNearConfirmedActuals<T extends Record<string, unknown>>(
  records: T[],
  windowDays: number = STALE_ESTIMATE_WINDOW_DAYS,
): T[] {
  const confirmedByTicker = new Map<string, string[]>()
  for (const rec of records) {
    const hasActual = rec.actual != null || rec.revenue_actual != null
    if (!hasActual) continue
    const key = tickerKeyFromParts(rec.ticker as string | null, rec.code as string | null)
    const date = String(rec.report_date ?? '').slice(0, 10)
    if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const list = confirmedByTicker.get(key) ?? []
    list.push(date)
    confirmedByTicker.set(key, list)
  }
  if (confirmedByTicker.size === 0) return records

  return records.filter((rec) => {
    const hasActual = rec.actual != null || rec.revenue_actual != null
    if (hasActual) return true
    const key = tickerKeyFromParts(rec.ticker as string | null, rec.code as string | null)
    const date = String(rec.report_date ?? '').slice(0, 10)
    const confirmedDates = confirmedByTicker.get(key)
    if (!confirmedDates?.length) return true
    return !confirmedDates.some((cd) => calendarDaysBetween(cd, date) <= windowDays)
  })
}

/**
 * מוחק מ-DB שורות אומדן (ללא actual) בסביבת תאריכי דיווח מאושרים.
 * הסיבה: unique(ticker, report_date) משאיר תאריכי אומדן קודמים כשהתאריך מתעדכן.
 */
export async function purgeStaleEstimateRowsNearConfirmed(
  supabase: SupabaseClient,
  confirmed: Array<{ ticker: string; code?: string | null; reportDate: string }>,
  windowDays: number = STALE_ESTIMATE_WINDOW_DAYS,
): Promise<{ deleted: number }> {
  let deleted = 0

  for (const item of confirmed) {
    const ticker = tickerKeyFromParts(item.ticker, item.code)
    const reportDate = String(item.reportDate).slice(0, 10)
    if (!ticker || !/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) continue

    const code = (item.code || `${ticker}.US`).toString().toUpperCase()
    const from = addCalendarDays(reportDate, -windowDays)
    const to = addCalendarDays(reportDate, windowDays)

    const { data: candidates, error } = await supabase
      .from('earnings_calendar')
      .select('id, report_date, actual')
      .is('actual', null)
      .gte('report_date', from)
      .lte('report_date', to)
      .or(`ticker.eq.${ticker},code.eq.${code}`)

    if (error) {
      console.warn(`[purge-stale] select ${ticker}: ${error.message}`)
      continue
    }

    const ids = (candidates ?? [])
      .filter((row) => {
        const d = String(row.report_date).slice(0, 10)
        if (d === reportDate) return false
        return calendarDaysBetween(d, reportDate) <= windowDays
      })
      .map((row) => row.id as string)

    if (ids.length === 0) continue

    const { error: delError, count } = await supabase
      .from('earnings_calendar')
      .delete({ count: 'exact' })
      .in('id', ids)

    if (delError) {
      console.warn(`[purge-stale] delete ${ticker}: ${delError.message}`)
      continue
    }

    const n = count ?? ids.length
    deleted += n
    console.log(
      `🗑️ Purged ${n} stale estimate row(s) for ${ticker} near confirmed ${reportDate}`,
    )
  }

  return { deleted }
}

/**
 * אחרי sync: עבור כל טיקר שנגענו בו — מחק אומדנים ישנים ליד כל דיווח עם actual ב-DB.
 */
export async function purgeStaleEstimatesForTouchedTickers(
  supabase: SupabaseClient,
  tickers: string[],
  windowDays: number = STALE_ESTIMATE_WINDOW_DAYS,
): Promise<{ deleted: number }> {
  const unique = [...new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean))]
  if (unique.length === 0) return { deleted: 0 }

  let deleted = 0
  // עיבוד במנות כדי לא לפתוח יותר מדי שאילתות במקביל
  const chunkSize = 40
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const codes = chunk.map((t) => `${t}.US`)

    const { data: confirmedRows, error } = await supabase
      .from('earnings_calendar')
      .select('ticker, code, report_date, actual')
      .not('actual', 'is', null)
      .or(`ticker.in.(${chunk.join(',')}),code.in.(${codes.join(',')})`)

    if (error) {
      console.warn(`[purge-stale] confirmed lookup: ${error.message}`)
      continue
    }

    const confirmed = (confirmedRows ?? []).map((row) => ({
      ticker: tickerKeyFromParts(row.ticker as string | null, row.code as string | null),
      code: (row.code as string | null) ?? undefined,
      reportDate: String(row.report_date).slice(0, 10),
    })).filter((c) => c.ticker && c.reportDate)

    if (confirmed.length === 0) continue
    const result = await purgeStaleEstimateRowsNearConfirmed(supabase, confirmed, windowDays)
    deleted += result.deleted
  }

  return { deleted }
}

export const prepareEarningsRecord = (
  raw: RawEarningsEvent,
  options: PrepareOptions = {}
): PreparedRecord | null => {
  if (!raw?.code) return null;
  if (!raw.report_date) return null;

  if (options.requireUSCode && !raw.code.endsWith('.US')) return null;
  if (options.skipPreferredShares && (raw.code.includes('-P') || raw.code.includes('-W'))) {
    return null;
  }

  const now = options.now ?? new Date();
  const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;
  const today = getDateInTimeZone(now, timeZone);
  const tomorrow = getDateInTimeZone(addDays(now, 1), timeZone);

  let normalizedDate = sanitizeDateString(raw.report_date, today);
  let adjusted = false;
  let adjustmentReason: string | undefined;

  const actualValue = numberOrNull(raw.actual);

  // אם יש תוצאה בפועל אבל התאריך בעתיד - הדיווח כבר יצא, נעדכן לתאריך נוכחי
  if (actualValue !== null && normalizedDate > today) {
    normalizedDate = today;
    adjusted = true;
    adjustmentReason = 'actual_in_future';
  }

  // דיווחי AfterMarket שעדיין מסומנים כמחר (בזמן ישראל לפני 06:00) צריכים להופיע היום
  const timeParts = getTimeFormatter(timeZone).formatToParts(now);
  const hourPart = timeParts.find((part) => part.type === 'hour')?.value ?? '0';
  const israelHour = Number(hourPart);

  if (
    raw.before_after_market === 'AfterMarket' &&
    normalizedDate === tomorrow &&
    israelHour >= 0 &&
    israelHour < 6
  ) {
    normalizedDate = today;
    adjusted = true;
    adjustmentReason = adjustmentReason ?? 'after_market_timezone_shift';
  }

  const record: EarningsRecord = {
    id: `earnings_${raw.code}_${normalizedDate}`,
    code: raw.code,
    report_date: normalizedDate,
    date: sanitizeDateString(raw.date, normalizedDate),
    date_confirmed: raw.date_confirmed ? sanitizeDateString(raw.date_confirmed, null) : null,
    time: raw.time ?? null,
    before_after_market: raw.before_after_market ?? null,
    currency: raw.currency ?? 'USD',
    exchange: raw.exchange ?? null,
    company_name: raw.company_name ?? null,
    period: raw.period ?? null,
    period_year: raw.period_year ? Number(raw.period_year) : null,
    // EPS fields
    actual: actualValue,
    estimate: numberOrNull(raw.estimate),
    difference: numberOrNull(raw.difference),
    percent: numberOrNull(raw.percent),
    eps_prior: numberOrNull(raw.eps_prior),
    eps_surprise: numberOrNull(raw.eps_surprise),
    eps_surprise_percent: numberOrNull(raw.eps_surprise_percent),
    // Revenue fields
    revenue_actual: numberOrNull(raw.revenue_actual),
    revenue_estimate_avg: numberOrNull(raw.revenue_estimate_avg),
    revenue_estimate_low: numberOrNull(raw.revenue_estimate_low),
    revenue_estimate_high: numberOrNull(raw.revenue_estimate_high),
    revenue_estimate_year_ago: numberOrNull(raw.revenue_estimate_year_ago),
    revenue_estimate_analysts_count: raw.revenue_estimate_analysts_count ? Number(raw.revenue_estimate_analysts_count) : null,
    revenue_estimate_growth: numberOrNull(raw.revenue_estimate_growth),
    revenue_surprise: numberOrNull(raw.revenue_surprise),
    revenue_surprise_percent: numberOrNull(raw.revenue_surprise_percent),
    revenue_yoy: numberOrNull(raw.revenue_yoy),
    // Metadata
    importance: raw.importance ? Number(raw.importance) : null,
    notes: raw.notes ?? null,
    benzinga_updated: raw.benzinga_updated ? Number(raw.benzinga_updated) : null,
    source: options.source ?? DEFAULT_SOURCE,
    updated_at: now.toISOString()
  };

  return {
    record,
    meta: {
      adjusted,
      adjustmentReason
    }
  };
};

