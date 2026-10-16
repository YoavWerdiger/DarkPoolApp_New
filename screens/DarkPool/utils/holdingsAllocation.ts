import { DISTRIBUTION_PALETTE } from '../../Portfolios/portfolioConstants';
import type { DistributionSlice } from '../../Portfolios/portfolioTypes';

export type HoldingWeightStyle = 'congress' | 'form4' | 'filing';

export interface HoldingAllocationInput {
  ticker: string;
  allocation_pct?: number | null;
  market_value?: number | null;
  value_usd?: number | null;
  trade_count?: number;
}

export function holdingsToDistributionSlices(
  holdings: HoldingAllocationInput[],
  maxSlices = 8
): DistributionSlice[] {
  const normalized = normalizeAllocationPercentages(holdings);
  const ranked = normalized
    .filter((h) => (h.allocation_pct ?? 0) > 0)
    .sort((a, b) => (b.allocation_pct ?? 0) - (a.allocation_pct ?? 0));

  if (!ranked.length) return [];

  const top = ranked.slice(0, Math.max(1, maxSlices - 1));
  const rest = ranked.slice(top.length);
  const topPct = top.reduce((s, h) => s + (h.allocation_pct ?? 0), 0);
  const restPct = rest.reduce((s, h) => s + (h.allocation_pct ?? 0), 0);
  // allocation_pct הוא משקל בכל התיק, אבל לעיתים מגיעות רק N האחזקות הגדולות (טראמפ: 16 מתוך מאות).
  // «אחר» = כל מה שלא מוצג (100 − המוצגים), לא רק סכום מה שהגיע — אחרת העוגה חסרה ו«אחר» לא תואם לנתח.
  const otherPct = topPct + restPct <= 100.5 ? Math.max(restPct, 100 - topPct) : restPct;

  const slices: DistributionSlice[] = top.map((h, i) => ({
    key: h.ticker.toUpperCase(),
    label: h.ticker.toUpperCase(),
    value: h.market_value ?? h.value_usd ?? h.allocation_pct ?? 0,
    percentage: Math.round((h.allocation_pct ?? 0) * 10) / 10,
    color: distributionColor(i),
  }));

  if (otherPct > 0.05) {
    slices.push({
      key: '__other__',
      label: 'אחר',
      value: otherPct,
      percentage: Math.round(otherPct * 10) / 10,
      // אפור ניטרלי שנראה גם על רקע בהיר וגם על כהה (לבן שקוף נעלם על כרטיס בהיר)
      color: '#8E8E93',
    });
  }

  return slices;
}

/** צבע לנתח i — הפלטה, ואחריה גוונים שנוצרים (זווית הזהב) כדי שלא יחזרו צבעים */
export function distributionColor(i: number): string {
  if (i < DISTRIBUTION_PALETTE.length) return DISTRIBUTION_PALETTE[i];
  const hue = Math.round((i * 137.508) % 360);
  return `hsl(${hue}, 62%, 56%)`;
}

export function sliceColorByTicker(slices: DistributionSlice[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const s of slices) {
    if (s.key !== '__other__' && s.color) {
      map.set(s.key, s.color);
    }
  }
  return map;
}

function normalizeAllocationPercentages(
  holdings: HoldingAllocationInput[]
): HoldingAllocationInput[] {
  if (!holdings.length) return [];
  const hasPct = holdings.some((h) => (h.allocation_pct ?? 0) > 0);
  if (hasPct) return holdings;

  const weights = holdings.map((h) => ({
    h,
    w: Math.max(0, h.market_value ?? h.value_usd ?? h.trade_count ?? 0),
  }));
  const total = weights.reduce((s, x) => s + x.w, 0);
  if (total <= 0) {
    const even = 100 / holdings.length;
    return holdings.map((h) => ({ ...h, allocation_pct: even }));
  }

  return weights.map(({ h, w }) => ({
    ...h,
    allocation_pct: (w / total) * 100,
  }));
}
