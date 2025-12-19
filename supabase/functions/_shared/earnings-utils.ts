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

