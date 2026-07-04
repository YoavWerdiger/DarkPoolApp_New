import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  PortfolioHolding,
  PortfolioSummary,
} from '../portfolioTypes';
import { realtimeQuotes } from '../../../services/portfolios/realtimeQuotes';
import { computeWinRatePct } from '../../../services/portfolios/portfolioCalc';

interface Args {
  baseHoldings: PortfolioHolding[] | null;
  baseSummary: PortfolioSummary | null;
  enabled?: boolean;
}

interface Result {
  holdings: PortfolioHolding[];
  summary: PortfolioSummary | null;
  isStreaming: boolean;
  lastTickAt: number | null;
}

/**
 * מחבר את התיק ל-zerm trades של Finnhub.
 * מקבל holdings/summary בסיסיים (טעינה מקובץ + REST), ומחזיר גרסה
 * שמתעדכנת בזמן אמת עם מחירים שמגיעים מ-WebSocket.
 *
 * החישוב נשאר עקבי עם ה-REST: שומרים previous_close המקורי, ומחשבים
 * מחדש value, unrealized_gain, daily_gain, allocation לפי המחיר החדש.
 */
export function useRealtimeHoldings({
  baseHoldings,
  baseSummary,
  enabled = true,
}: Args): Result {
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [lastTickAt, setLastTickAt] = useState<number | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  // איזה סימבולים אנחנו רוצים לעקוב? רק פתוחים (לא נמכרו במלואם)
  const symbols = useMemo(() => {
    if (!baseHoldings) return [];
    return baseHoldings
      .filter((h) => !h.is_closed && h.quantity > 0)
      .map((h) => h.symbol);
  }, [baseHoldings]);

  const subKey = symbols.join('|');
  const releaseRef = useRef<(() => void) | null>(null);
  const pendingPricesRef = useRef<Record<string, number>>({});
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || symbols.length === 0) {
      setIsStreaming(false);
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      pendingPricesRef.current = {};
      return;
    }
    setIsStreaming(true);
    const release = realtimeQuotes.subscribeMany(symbols);
    releaseRef.current = release;

    const flushPending = () => {
      flushTimerRef.current = null;
      const batch = pendingPricesRef.current;
      pendingPricesRef.current = {};
      const keys = Object.keys(batch);
      if (keys.length === 0) return;
      setLivePrices((prev) => {
        let next = prev;
        let changed = false;
        for (const sym of keys) {
          const pr = batch[sym];
          if (prev[sym] === pr) continue;
          if (!changed) {
            next = { ...prev };
            changed = true;
          }
          next[sym] = pr;
        }
        return changed ? next : prev;
      });
      setLastTickAt(Date.now());
    };

    const offListener = realtimeQuotes.on((symbol, price) => {
      pendingPricesRef.current[symbol] = price;
      if (flushTimerRef.current == null) {
        flushTimerRef.current = setTimeout(flushPending, 150);
      }
    });
    // הזרקת last-known prices מהסינגלטון (אם כבר ראינו בעבר)
    setLivePrices((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const s of symbols) {
        const cached = realtimeQuotes.getLastPrice(s);
        if (cached && next[s] !== cached.price) {
          next[s] = cached.price;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      pendingPricesRef.current = {};
      offListener();
      release();
      releaseRef.current = null;
      setIsStreaming(false);
    };
  }, [subKey, enabled]);

  // Purge stale prices for symbols that are no longer in the portfolio.
  // Without this, livePrices grows indefinitely as holdings are sold/removed.
  useEffect(() => {
    if (!enabled) return;
    const symbolSet = new Set(symbols);
    setLivePrices(prev => {
      const staleKeys = Object.keys(prev).filter(k => !symbolSet.has(k));
      if (staleKeys.length === 0) return prev;
      const next = { ...prev };
      for (const k of staleKeys) delete next[k];
      return next;
    });
  }, [subKey, enabled]);

  // --- חישוב holdings + summary מעודכנים ---
  const liveHoldings = useMemo<PortfolioHolding[]>(() => {
    if (!baseHoldings) return [];
    if (Object.keys(livePrices).length === 0) return baseHoldings;
    return baseHoldings.map((h) => {
      const p = livePrices[h.symbol];
      if (p == null || p <= 0) return h;
      const value = h.quantity * p;
      const unrealized_gain = value - h.invested;
      const unrealized_gain_pct =
        h.invested > 0 ? (unrealized_gain / h.invested) * 100 : 0;
      const dailyBase = h.previous_close ?? h.last_price;
      const daily_gain =
        dailyBase != null ? (p - dailyBase) * h.quantity : h.daily_gain;
      const daily_gain_pct =
        dailyBase != null && dailyBase > 0
          ? ((p - dailyBase) / dailyBase) * 100
          : h.daily_gain_pct;
      const total_gain = unrealized_gain + h.realized_gain + h.total_dividends;
      const total_gain_pct =
        h.invested > 0 ? (total_gain / h.invested) * 100 : 0;
      return {
        ...h,
        last_price: p,
        value,
        unrealized_gain,
        unrealized_gain_pct,
        daily_gain,
        daily_gain_pct,
        total_gain,
        total_gain_pct,
      };
    });
  }, [baseHoldings, livePrices]);

  // עדכון allocation אחרי השינויים (סכום ערך החזקות חדש)
  const liveHoldingsWithAllocation = useMemo<PortfolioHolding[]>(() => {
    if (liveHoldings.length === 0) return liveHoldings;
    const totalValue = liveHoldings.reduce(
      (acc, h) => acc + (h.is_closed ? 0 : h.value),
      0
    );
    if (totalValue <= 0) return liveHoldings;
    return liveHoldings.map((h) =>
      h.is_closed
        ? h
        : { ...h, allocation: (h.value / totalValue) * 100 }
    );
  }, [liveHoldings]);

  const liveSummary = useMemo<PortfolioSummary | null>(() => {
    if (!baseSummary) return null;
    if (liveHoldingsWithAllocation.length === 0) return baseSummary;
    const value = liveHoldingsWithAllocation.reduce(
      (acc, h) => acc + (h.is_closed ? 0 : h.value),
      0
    );
    const unrealized_gain = liveHoldingsWithAllocation.reduce(
      (acc, h) => acc + (h.is_closed ? 0 : h.unrealized_gain),
      0
    );
    const daily_gain = liveHoldingsWithAllocation.reduce(
      (acc, h) => acc + (h.is_closed ? 0 : h.daily_gain),
      0
    );
    const total_value = baseSummary.cash + value;
    const total_gain =
      unrealized_gain + baseSummary.realized_gain + baseSummary.total_dividends;
    const total_gain_pct =
      baseSummary.invested > 0
        ? (total_gain / baseSummary.invested) * 100
        : 0;
    const totalValueYesterday = total_value - daily_gain;
    const daily_gain_pct =
      totalValueYesterday > 0 ? (daily_gain / totalValueYesterday) * 100 : 0;

    return {
      ...baseSummary,
      value,
      total_value,
      unrealized_gain,
      daily_gain,
      daily_gain_pct,
      total_gain,
      total_gain_pct,
      win_rate_pct: computeWinRatePct(liveHoldingsWithAllocation),
    };
  }, [baseSummary, liveHoldingsWithAllocation]);

  return {
    holdings: liveHoldingsWithAllocation,
    summary: liveSummary,
    isStreaming,
    lastTickAt,
  };
}
