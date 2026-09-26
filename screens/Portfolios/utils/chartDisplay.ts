import { SoftUI } from '../../../components/ui/softUiPalette';

/** Red 400 — שלילי בכותרת גרף / KPI (עקבי עם SoftUI.negative) */
export const PORTFOLIO_NEGATIVE_AMOUNT_COLOR = SoftUI.negative;

/**
 * כותרת גרף שווי — כשיש פחות מ-2 נקודות ל-SVG, ranges.lastValue נשאר 0 (placeholder).
 * אסור להשתמש ב-?? על 0 — אחרת מוצג $0 למרות snapshot תקין.
 */
export function resolvePortfolioChartHeaderValue(input: {
  activeValue?: number;
  plottedCount: number;
  rangesLast: number;
  seriesLast: number;
}): number {
  if (input.activeValue != null && Number.isFinite(input.activeValue)) {
    return input.activeValue;
  }
  if (input.plottedCount >= 2) return input.rangesLast;
  return input.seriesLast;
}

/** שווי שלילי → Red 400; אחרת primary */
export function portfolioAmountDisplayColor(
  value: number,
  primaryColor: string,
  negativeColor: string = PORTFOLIO_NEGATIVE_AMOUNT_COLOR,
): string {
  if (Number.isFinite(value) && value < 0) return negativeColor;
  return primaryColor;
}
