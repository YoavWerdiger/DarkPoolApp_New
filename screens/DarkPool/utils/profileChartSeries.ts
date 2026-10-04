import { PERIOD_TO_DAYS } from '../../Portfolios/portfolioConstants';
import type { PerformancePeriod } from '../../Portfolios/portfolioTypes';

export interface ChartPoint {
  date: string;
  value: number;
  /** הפקדות − משיכות ביום זה (לחישוב TWR עקבי עם מדדים) */
  external_flow?: number;
}

/** סדרה מ־uw-investor-profile / snapshot (JSON) → נקודות גרף. */
export function chartPointsFromMetricSeries(series: unknown): ChartPoint[] {
  if (!Array.isArray(series)) return [];
  const out: ChartPoint[] = [];
  for (const raw of series) {
    if (!raw || typeof raw !== 'object') continue;
    const date = String((raw as { date?: string }).date ?? '').slice(0, 10);
    const value = Number((raw as { value?: number }).value);
    const flow = (raw as { external_flow?: number }).external_flow;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !(value > 0)) continue;
    out.push({
      date,
      value,
      ...(flow != null && flow !== 0 ? { external_flow: flow } : {}),
    });
  }
  return sortSeries(out);
}

function sortSeries(series: ChartPoint[]): ChartPoint[] {
  return [...series].sort((a, b) => a.date.localeCompare(b.date));
}

function addUtcDays(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function takeLastSessions(sorted: ChartPoint[], count: number): ChartPoint[] {
  if (sorted.length <= count) return sorted;
  return sorted.slice(-count);
}

/**
 * חותך לפי נקודת הסיום של הסדרה — לא לפי שעון מקומי.
 * אף פעם לא מחזיר את כל ההיסטוריה כשאין 2 נקודות בחלון (זה מה שהשאיר את הצ'יפים מתים).
 */
function sliceFromCutoff(sorted: ChartPoint[], cutoffIso: string): ChartPoint[] {
  const sliced = sorted.filter((p) => p.date >= cutoffIso);
  if (sliced.length >= 2) return sliced;
  const before = sorted.filter((p) => p.date < cutoffIso);
  if (before.length && sliced.length) {
    return [before[before.length - 1], ...sliced];
  }
  return takeLastSessions(sorted, 2);
}

/** מסנן סדרת שווי לפי תקופה — חלון מעוגן ליום האחרון בסדרה היומית */
export function filterChartSeriesByPeriod(
  series: ChartPoint[],
  period: PerformancePeriod
): ChartPoint[] {
  if (!series.length) return [];
  const sorted = sortSeries(series);
  if (period === 'All') return sorted;

  // 1D יומי = סשן קודם → אחרון. סדרה עם שעה (סנאפשוט תוך-יום) נשמרת ~36 שעות.
  if (period === '1D') {
    if (!sorted.some((p) => /T\d{2}:/.test(p.date))) return takeLastSessions(sorted, 2);
    const lastMs = chartPointMs(sorted[sorted.length - 1].date);
    const sliced = sorted.filter((p) => chartPointMs(p.date) >= lastMs - 36 * MS.hour);
    return sliced.length >= 2 ? sliced : takeLastSessions(sorted, 2);
  }

  const days = PERIOD_TO_DAYS[period];
  if (days == null) return sorted;

  const anchor = sorted[sorted.length - 1].date;
  if (days === -1) {
    return sliceFromCutoff(sorted, `${anchor.slice(0, 4)}-01-01`);
  }
  return sliceFromCutoff(sorted, addUtcDays(anchor, -days));
}

/**
 * תשואה % לתקופה המוצגת.
 * אם יש external_flow — TWR (לא סופר הכנסת הון כתשואה).
 * מעל ±250% — null (לא אמין לתצוגה בתיקי STOCK Act משוערים).
 */
const MAX_CHART_RETURN_PCT = 250;

export function computeChartPeriodReturn(series: ChartPoint[]): number | null {
  if (series.length < 2) return null;

  const hasFlow = series.some((p) => (p.external_flow ?? 0) !== 0);
  if (hasFlow) {
    let cumulative = 1;
    for (let i = 1; i < series.length; i++) {
      const prev = series[i - 1].value;
      const curr = series[i].value;
      const flow = series[i].external_flow ?? 0;
      const denom = prev + flow;
      if (denom > 1e-9 && curr >= 0) cumulative *= curr / denom;
    }
    const pct = Math.round((cumulative - 1) * 10000) / 100;
    if (!Number.isFinite(pct) || Math.abs(pct) > MAX_CHART_RETURN_PCT) return null;
    return pct;
  }

  const first = series[0].value;
  const last = series[series.length - 1].value;
  if (first <= 0) return null;
  const pct = Math.round((((last - first) / first) * 100) * 100) / 100;
  if (!Number.isFinite(pct) || Math.abs(pct) > MAX_CHART_RETURN_PCT) return null;
  return pct;
}

/** דגימה לגרף — מונע אלפי נקודות ב-SVG */
export function downsampleChartSeries(
  series: ChartPoint[],
  maxPoints = 120
): ChartPoint[] {
  if (series.length <= maxPoints) return series;
  const out: ChartPoint[] = [];
  const step = (series.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(series.length - 1, Math.round(i * step));
    out.push(series[idx]);
  }
  return out;
}

const MS = {
  min5: 5 * 60_000,
  hour: 60 * 60_000,
  day: 24 * 60 * 60_000,
  week: 7 * 24 * 60 * 60_000,
};

/** מרווח מקסימלי בסשן האחרון — נקודה לפחות כל שעתיים, לא סגירה יומית אחת. */
export const SESSION_SNAPSHOT_MAX_GAP_MS = 2 * 60 * 60_000;

/** מרווח מינימלי בין נקודות מוצגות — תיק + טיקר (אחיד). */
export function chartSampleGapMs(period: PerformancePeriod): number {
  switch (period) {
    case '1D':
      return MS.min5;
    case '1W':
    case '1M':
      return MS.hour;
    case '3M':
    case 'YTD':
    case '1Y':
      return MS.day;
    case '5Y':
      return MS.week;
    case 'All':
      return MS.week;
    default:
      return MS.day;
  }
}

function chartPointMs(date: string): number {
  if (/T\d/.test(date)) return Date.parse(date);
  return Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
}

/**
 * דגימה לתצוגה: 1D→5ד, 1W/1M→שעה, 3M/YTD/1Y→יום, 5Y/All→שבוע.
 * תמיד שומר קצוות + ימים עם external_flow.
 */
/** תקרה ל-SVG — מספיק לצורה, לא אלפי נקודות. */
export const CHART_DISPLAY_MAX_POINTS = 180;

export function sampleChartSeriesForPeriod(
  series: ChartPoint[],
  period: PerformancePeriod,
  maxPoints = CHART_DISPLAY_MAX_POINTS
): ChartPoint[] {
  const sorted = sortSeries(series);
  if (sorted.length <= 2) return sorted;

  let gapMs = chartSampleGapMs(period);
  if (period === 'All') {
    const spanMs =
      chartPointMs(sorted[sorted.length - 1].date) - chartPointMs(sorted[0].date);
    if (spanMs < 120 * MS.day) gapMs = MS.day;
  }

  const out: ChartPoint[] = [];
  let lastKept = -Infinity;
  const lastMs = chartPointMs(sorted[sorted.length - 1].date);
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const t = chartPointMs(p.date);
    const isEdge = i === 0 || i === sorted.length - 1;
    const hasFlow = (p.external_flow ?? 0) !== 0;
    const inSession = /T\d{2}:/.test(p.date) && lastMs - t <= 16 * MS.hour;
    const gap = inSession ? Math.min(gapMs, SESSION_SNAPSHOT_MAX_GAP_MS) : gapMs;
    if (isEdge || hasFlow || t - lastKept >= gap) {
      out.push(p);
      lastKept = t;
    }
  }
  const sampled = out.length >= 2 ? out : sorted.slice(0, 2);
  return sampled.length > maxPoints
    ? downsampleChartSeries(sampled, maxPoints)
    : sampled;
}

/** האם יש מספיק היסטוריה לתקופה */
export function isChartPeriodAvailable(
  fullSeries: ChartPoint[],
  period: PerformancePeriod
): boolean {
  if (!fullSeries.length) return false;
  if (period === 'All' || period === '1D') return fullSeries.length >= 2;
  const filtered = filterChartSeriesByPeriod(fullSeries, period);
  if (filtered.length < 2) return false;
  const days = PERIOD_TO_DAYS[period];
  if (days == null || days === -1) return true;
  const spanMs =
    Date.parse(filtered[filtered.length - 1].date) - Date.parse(filtered[0].date);
  const spanDays = spanMs / 86400000;
  return spanDays >= Math.min(days * 0.25, 3);
}

/** שבבי טווח לגרף snapshots כנים — כמו גרף תיק אמיתי (ימי מסחר). */
export const SNAPSHOT_CHART_PERIODS: PerformancePeriod[] = [
  '1D',
  '1W',
  '1M',
  '3M',
  'YTD',
  '1Y',
  '5Y',
  'All',
];

/** כיתוב ריק כנה — לא גרף שבור ובלי מספר מומצא. */
export function snapshotChartEmptyCopy(args: {
  kind: 'politician' | 'insider' | 'fund_manager';
  holdingsEngine: 'congress' | 'form4' | 'trump' | 'filing' | null;
  hasHoldings: boolean;
}): string {
  if (args.kind === 'fund_manager' || args.holdingsEngine === 'filing') {
    return 'עדיין אין מספיק דיווחי 13F לבניית גרף שווי.';
  }
  if (args.holdingsEngine === 'congress') {
    return args.hasHoldings
      ? 'אין מספיק מחירי שוק לסל האחזקות המדווח.'
      : 'אין אחזקות מדווחות לגרף.';
  }
  if (args.holdingsEngine === 'form4') {
    return 'אין מספיק דיווחי Form 4 לבניית גרף שווי.';
  }
  if (args.holdingsEngine === 'trump') {
    return args.hasHoldings
      ? 'אין מספיק מחירי Yahoo לסל העסקאות.'
      : 'אין עסקאות trumpstocktrades לגרף.';
  }
  if (args.kind === 'politician' && !args.hasHoldings) {
    return 'אין אחזקות מדווחות לגרף.';
  }
  return 'אין מספיק נתונים כנים לבניית גרף שווי.';
}

/**
 * סדרת גרף בפרופיל: Quiver MTM / Form 4 × close / טראמפ נומינל × יחס close / 13F.
 * בלי שחזור מטווחי STOCK Act ובלי fallback «trades_only».
 */
export function selectProfileSnapshotSeries(args: {
  kind: 'politician' | 'insider' | 'fund_manager';
  holdingsEngine: 'congress' | 'form4' | 'trump' | 'filing' | null;
  congressMtm: ChartPoint[];
  form4Mtm: ChartPoint[];
  trumpMtm?: ChartPoint[];
  fundSeries: ChartPoint[];
}): ChartPoint[] {
  if (args.kind === 'politician') {
    if (args.holdingsEngine === 'congress' && args.congressMtm.length >= 2) {
      return args.congressMtm;
    }
    if (args.holdingsEngine === 'trump' && (args.trumpMtm?.length ?? 0) >= 2) {
      return args.trumpMtm ?? [];
    }
    return [];
  }
  if (args.kind === 'insider') {
    return args.holdingsEngine === 'form4' && args.form4Mtm.length >= 2
      ? args.form4Mtm
      : [];
  }
  return args.fundSeries.length >= 2 ? args.fundSeries : [];
}

export function pickDefaultSnapshotChartPeriod(
  fullSeries: ChartPoint[]
): PerformancePeriod {
  const allowed = SNAPSHOT_CHART_PERIODS.filter((p) =>
    isChartPeriodAvailable(fullSeries, p)
  );
  if (!allowed.length) return '1M';
  const picked = pickDefaultChartPeriod(fullSeries);
  if ((allowed as PerformancePeriod[]).includes(picked)) return picked;
  if (picked === '1D' && allowed.includes('1W')) return '1W';
  if (picked === '1W' && allowed.includes('1M')) return '1M';
  if (picked === '3M' && allowed.includes('1M')) return '1M';
  if ((picked === '5Y' || picked === 'All') && allowed.includes('1Y')) return '1Y';
  return allowed[allowed.length - 1];
}

/** ברירת מחדל לתקופה לפי אורך הסדרה */
export function pickDefaultChartPeriod(fullSeries: ChartPoint[]): PerformancePeriod {
  if (fullSeries.length < 2) return 'All';
  const sorted = sortSeries(fullSeries);
  const spanDays =
    (Date.parse(sorted[sorted.length - 1].date) - Date.parse(sorted[0].date)) /
    86400000;
  if (spanDays <= 3) return '1D';
  if (spanDays <= 10) return '1W';
  if (spanDays <= 45) return '1M';
  if (spanDays <= 120) return '3M';
  if (spanDays <= 400) return '1Y';
  if (spanDays <= 365 * 5) return '5Y';
  return 'All';
}

/** נקודת שווי עדכנית — מיישר את סוף הגרף לשווי נוכחי */
export function appendLivePortfolioPoint(
  series: ChartPoint[],
  liveValue: number | null | undefined
): ChartPoint[] {
  if (liveValue == null || liveValue <= 0 || !series.length) return series;
  const sorted = sortSeries(series);
  const today = new Date().toISOString().slice(0, 10);
  const last = sorted[sorted.length - 1];
  if (last.date === today) {
    return [...sorted.slice(0, -1), { date: today, value: liveValue }];
  }
  if (last.date < today) {
    return [...sorted, { date: today, value: liveValue }];
  }
  return sorted;
}

/** האם יש שינוי בגרף — סף נמוך כדי לא להסתיר תיקים משוערים */
export function chartSeriesHasVariation(series: ChartPoint[]): boolean {
  if (series.length < 2) return false;
  const vals = series.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (max - min > 1) return true;
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  if (avg <= 0) return max - min > 1e-6;
  return (max - min) / avg > 0.0001;
}

/**
 * דילול סדרה צפופה (snapshots ישנים) — ימי מסחר + דגימה לפי maxGapDays.
 */
export function sparsifyChartSeriesByGap(
  series: ChartPoint[],
  maxGapDays = 7
): ChartPoint[] {
  if (series.length <= 3) return series;
  const sorted = sortSeries(series);
  const out: ChartPoint[] = [];
  let lastKept: string | null = null;
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const isEdge = i === 0 || i === sorted.length - 1;
    const hasFlow = (p.external_flow ?? 0) !== 0;
    const gapDays =
      lastKept != null
        ? (Date.parse(p.date) - Date.parse(lastKept)) / 86400000
        : Infinity;
    if (isEdge || hasFlow || gapDays >= maxGapDays) {
      out.push({ ...p });
      lastKept = p.date;
    }
  }
  return out;
}

/**
 * מנטרל קפיצות מקנייה/מכירה (external_flow) — עקומת ביצועים בסגנון TWR.
 * משנה קנה־מידה כך שנקודת הסיום = השווי האחרון (כותרת הגרף נשארת ב־$).
 */
export function toFlowNeutralChartSeries(series: ChartPoint[]): ChartPoint[] {
  if (series.length < 2) return series;
  const sorted = sortSeries(series);
  const indexed: ChartPoint[] = [{ date: sorted[0].date, value: sorted[0].value }];
  let idx = sorted[0].value;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].value;
    const curr = sorted[i].value;
    const flow = sorted[i].external_flow ?? 0;
    const denom = prev + flow;
    if (denom > 1e-9 && curr >= 0) {
      idx *= curr / denom;
    }
    if (!Number.isFinite(idx) || idx < 0) idx = Math.max(0, curr);
    indexed.push({ date: sorted[i].date, value: idx });
  }
  const lastAbs = sorted[sorted.length - 1].value;
  const lastIdx = indexed[indexed.length - 1].value;
  if (!(lastIdx > 1e-9) || !(lastAbs > 0)) return indexed;
  const scale = lastAbs / lastIdx;
  return indexed.map((p) => ({ date: p.date, value: p.value * scale }));
}

/** האם שחזור גרף Dark Pool אמין מספיק לתצוגה */
export function isReconstructedChartReliable(
  series: ChartPoint[],
  opts?: { tradeCount?: number; minSpanDays?: number }
): boolean {
  const tradeCount = opts?.tradeCount ?? 99;
  const minSpanDays = opts?.minSpanDays ?? 21;
  if (tradeCount < 3) return false;
  if (series.length < 2) return false;
  const sorted = sortSeries(series);
  const spanDays =
    (Date.parse(sorted[sorted.length - 1].date) - Date.parse(sorted[0].date)) /
    86400000;
  if (spanDays < minSpanDays) return false;
  return chartSeriesHasVariation(sorted);
}

/**
 * הכנת סדרת גרף לפרופיל משוחזר: דילול + נטרול הפקדות.
 * לא מוסיפים live $ בסוף — זה שובר את הנטרול.
 */
export function prepareReconstructedChartSeries(
  series: ChartPoint[],
  opts?: { tradeCount?: number; chartReliable?: boolean | null }
): ChartPoint[] {
  if (opts?.chartReliable === false) return [];
  const sparse = sparsifyChartSeriesByGap(series, 7);
  if (
    !isReconstructedChartReliable(sparse, {
      tradeCount: opts?.tradeCount,
    })
  ) {
    return [];
  }
  return toFlowNeutralChartSeries(sparse);
}

export function formatChartDateRange(series: ChartPoint[]): string | null {
  if (series.length < 2) return null;
  const first = series[0].date;
  const last = series[series.length - 1].date;
  if (first === last) return first;
  return `${first} – ${last}`;
}
