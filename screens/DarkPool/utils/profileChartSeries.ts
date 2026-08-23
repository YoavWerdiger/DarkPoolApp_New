import { PERIOD_TO_DAYS } from '../../Portfolios/portfolioConstants';
import type { PerformancePeriod } from '../../Portfolios/portfolioTypes';

export interface ChartPoint {
  date: string;
  value: number;
  /** הפקדות − משיכות ביום זה (לחישוב TWR עקבי עם מדדים) */
  external_flow?: number;
}

function sortSeries(series: ChartPoint[]): ChartPoint[] {
  return [...series].sort((a, b) => a.date.localeCompare(b.date));
}

/** מסנן סדרת שווי לפי תקופה — זהה ללוגיקת OverviewTab / PERIOD_TO_DAYS */
export function filterChartSeriesByPeriod(
  series: ChartPoint[],
  period: PerformancePeriod
): ChartPoint[] {
  if (!series.length) return [];
  const sorted = sortSeries(series);
  if (period === 'All') return sorted;

  const days = PERIOD_TO_DAYS[period];
  if (days == null) return sorted;

  if (days === -1) {
    const anchor = sorted[sorted.length - 1].date;
    const yearStart = `${anchor.slice(0, 4)}-01-01`;
    const sliced = sorted.filter((p) => p.date >= yearStart);
    return sliced.length >= 2 ? sliced : sorted;
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  const sliced = sorted.filter((p) => p.date >= cutoffIso);
  return sliced.length >= 2 ? sliced : sorted;
}

/**
 * תשואה % לתקופה המוצגת.
 * אם יש external_flow — TWR (עקבי עם מדד "תשואה נטו"); אחרת פשוט first→last.
 */
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
    return Math.round((cumulative - 1) * 10000) / 100;
  }

  const first = series[0].value;
  const last = series[series.length - 1].value;
  if (first <= 0) return null;
  return Math.round((((last - first) / first) * 100) * 100) / 100;
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

/** האם יש מספיק היסטוריה לתקופה */
export function isChartPeriodAvailable(
  fullSeries: ChartPoint[],
  period: PerformancePeriod
): boolean {
  if (!fullSeries.length) return false;
  if (period === 'All') return fullSeries.length >= 2;
  const filtered = filterChartSeriesByPeriod(fullSeries, period);
  if (filtered.length < 2) return false;
  const days = PERIOD_TO_DAYS[period];
  if (days == null || days === -1) return true;
  const spanMs =
    Date.parse(filtered[filtered.length - 1].date) - Date.parse(filtered[0].date);
  const spanDays = spanMs / 86400000;
  return spanDays >= Math.min(days * 0.25, 3);
}

/** ברירת מחדל לתקופה לפי אורך הסדרה */
export function pickDefaultChartPeriod(fullSeries: ChartPoint[]): PerformancePeriod {
  if (fullSeries.length < 2) return 'All';
  const sorted = sortSeries(fullSeries);
  const spanDays =
    (Date.parse(sorted[sorted.length - 1].date) - Date.parse(sorted[0].date)) /
    86400000;
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

export function formatChartDateRange(series: ChartPoint[]): string | null {
  if (series.length < 2) return null;
  const first = series[0].date;
  const last = series[series.length - 1].date;
  if (first === last) return first;
  return `${first} – ${last}`;
}
