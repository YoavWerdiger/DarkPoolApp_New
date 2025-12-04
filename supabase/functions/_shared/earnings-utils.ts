export interface RawEarningsEvent {
  code?: string;
  report_date?: string;
  date?: string;
  before_after_market?: string | null;
  currency?: string | null;
  actual?: number | string | null;
  estimate?: number | string | null;
  difference?: number | string | null;
  percent?: number | string | null;
}

export interface EarningsRecord {
  id: string;
  code: string;
  report_date: string;
  date: string;
  before_after_market: string | null;
  currency: string | null;
  actual: number | null;
  estimate: number | null;
  difference: number | null;
  percent: number | null;
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
    before_after_market: raw.before_after_market ?? null,
    currency: raw.currency ?? 'USD',
    actual: actualValue,
    estimate: numberOrNull(raw.estimate),
    difference: numberOrNull(raw.difference),
    percent: numberOrNull(raw.percent),
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

