import { DISTRIBUTION_PALETTE } from '../../Portfolios/portfolioConstants';
import type { DistributionSlice } from '../../Portfolios/portfolioTypes';

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
  const otherPct = rest.reduce((s, h) => s + (h.allocation_pct ?? 0), 0);

  const slices: DistributionSlice[] = top.map((h, i) => ({
    key: h.ticker.toUpperCase(),
    label: h.ticker.toUpperCase(),
    value: h.market_value ?? h.value_usd ?? h.allocation_pct ?? 0,
    percentage: Math.round((h.allocation_pct ?? 0) * 10) / 10,
    color: DISTRIBUTION_PALETTE[i % DISTRIBUTION_PALETTE.length],
  }));

  if (otherPct > 0.05) {
    slices.push({
      key: '__other__',
      label: 'אחר',
      value: otherPct,
      percentage: Math.round(otherPct * 10) / 10,
      color: 'rgba(255,255,255,0.22)',
    });
  }

  return slices;
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
