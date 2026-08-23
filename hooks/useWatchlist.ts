import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import { appQueryKeys } from '../lib/appQueryKeys';
import {
  addWatchlistItem,
  createWatchlist,
  deleteWatchlist,
  listWatchlistItems,
  listWatchlists,
  removeWatchlistItem,
  renameWatchlist,
  reorderWatchlistItems,
  updateWatchlistItem,
  updateWatchlistItemNotes,
} from '../services/watchlist/watchlistService';
import {
  computeVsEntry,
  computeVsTarget,
  dispatchWatchlistAlerts,
  evaluateWatchlistAlerts,
  loadWatchlistInsights,
} from '../services/watchlist/watchlistInsights';
import type {
  StockWatchlist,
  WatchlistDaySummary,
  WatchlistFilterMode,
  WatchlistItemPatch,
  WatchlistRowData,
  WatchlistSortMode,
} from '../services/watchlist/watchlistTypes';
import {
  clearPriceCaches,
  getQuotes,
  getSymbolsRangeStats,
  type SymbolRangeStats,
} from '../services/portfolios/portfolioPriceFeed';
import { realtimeQuotes } from '../services/portfolios/realtimeQuotes';
import type { PriceQuote } from '../screens/Portfolios/portfolioTypes';

const EMPTY_QUOTES: Record<string, PriceQuote> = Object.freeze({});
const EMPTY_RANGE_STATS: Record<string, SymbolRangeStats> = Object.freeze({});
const EMPTY_WATCHLISTS: StockWatchlist[] = Object.freeze([]) as StockWatchlist[];
const EMPTY_ITEMS: Awaited<ReturnType<typeof listWatchlistItems>> = Object.freeze(
  []
) as Awaited<ReturnType<typeof listWatchlistItems>>;

function computeChange(quote: PriceQuote | undefined): {
  change: number | null;
  changePct: number | null;
} {
  if (!quote || quote.previous_close == null || quote.previous_close === 0) {
    return { change: null, changePct: null };
  }
  const change = quote.price - quote.previous_close;
  const changePct = (change / quote.previous_close) * 100;
  return { change, changePct };
}

function summarize(rows: WatchlistRowData[]): WatchlistDaySummary {
  let up = 0;
  let down = 0;
  let flat = 0;
  let sumPct = 0;
  let pctCount = 0;
  for (const r of rows) {
    if (r.changePct == null) continue;
    if (r.changePct > 0.01) up += 1;
    else if (r.changePct < -0.01) down += 1;
    else flat += 1;
    sumPct += r.changePct;
    pctCount += 1;
  }
  return {
    total: rows.length,
    up,
    down,
    flat,
    avgChangePct: pctCount > 0 ? sumPct / pctCount : null,
  };
}

function sortRows(rows: WatchlistRowData[], mode: WatchlistSortMode): WatchlistRowData[] {
  const copy = [...rows];
  switch (mode) {
    case 'change_desc':
      return copy.sort((a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity));
    case 'change_asc':
      return copy.sort((a, b) => (a.changePct ?? Infinity) - (b.changePct ?? Infinity));
    case 'change_abs_desc':
      return copy.sort((a, b) => (b.change ?? -Infinity) - (a.change ?? -Infinity));
    case 'change_abs_asc':
      return copy.sort((a, b) => (a.change ?? Infinity) - (b.change ?? Infinity));
    case 'volume_desc':
      return copy.sort((a, b) => (b.volume ?? -Infinity) - (a.volume ?? -Infinity));
    case 'volume_asc':
      return copy.sort((a, b) => (a.volume ?? Infinity) - (b.volume ?? Infinity));
    case 'name':
      return copy.sort((a, b) => a.item.symbol.localeCompare(b.item.symbol));
    case 'price_desc':
      return copy.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
    case 'custom':
    default:
      return copy.sort((a, b) => a.item.sort_order - b.item.sort_order);
  }
}

function filterRows(
  rows: WatchlistRowData[],
  mode: WatchlistFilterMode
): WatchlistRowData[] {
  switch (mode) {
    case 'up':
      return rows.filter((r) => (r.changePct ?? 0) > 0.01);
    case 'down':
      return rows.filter((r) => (r.changePct ?? 0) < -0.01);
    case 'volume': {
      const vols = rows.map((r) => r.volume).filter((v): v is number => v != null);
      if (vols.length === 0) return rows;
      const sorted = [...vols].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
      return rows.filter((r) => (r.volume ?? 0) >= median * 1.5 && (r.volume ?? 0) > 0);
    }
    case 'events':
      return rows.filter((r) => !!r.earningsDate);
    case 'alerts':
      return rows.filter((r) => r.item.alerts_enabled);
    case 'all':
    default:
      return rows;
  }
}

export function useWatchlist() {
  const queryClient = useQueryClient();
  // עם detachInactiveScreens=false המסך נשאר mounted — polling/WS רק כשבאמת בפרונט
  const isFocused = useIsFocused();
  const [activeWatchlistId, setActiveWatchlistId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<WatchlistSortMode>('custom');
  const [filterMode, setFilterMode] = useState<WatchlistFilterMode>('all');
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [isStreaming, setIsStreaming] = useState(false);
  const [quotesRefreshing, setQuotesRefreshing] = useState(false);

  const listsQuery = useQuery({
    queryKey: appQueryKeys.watchlists,
    queryFn: listWatchlists,
    staleTime: 60_000,
  });

  const watchlists: StockWatchlist[] = listsQuery.data ?? EMPTY_WATCHLISTS;

  useEffect(() => {
    if (!activeWatchlistId && watchlists.length > 0) {
      const def = watchlists.find((w) => w.is_default) ?? watchlists[0];
      setActiveWatchlistId(def.id);
    }
  }, [activeWatchlistId, watchlists]);

  const itemsQuery = useQuery({
    queryKey: appQueryKeys.watchlistItems(activeWatchlistId ?? ''),
    queryFn: () => listWatchlistItems(activeWatchlistId!),
    enabled: !!activeWatchlistId,
    staleTime: 30_000,
  });

  const items = itemsQuery.data ?? EMPTY_ITEMS;
  const symbols = useMemo(() => items.map((i) => i.symbol), [items]);
  const symbolsKey = symbols.join('|');

  const quotesQuery = useQuery({
    queryKey: appQueryKeys.watchlistQuotes(symbolsKey),
    queryFn: async () => {
      if (symbols.length === 0) return {} as Record<string, PriceQuote>;
      const map = await getQuotes(symbols);
      const obj: Record<string, PriceQuote> = {};
      map.forEach((q, sym) => {
        obj[sym] = q;
      });
      return obj;
    },
    enabled: symbols.length > 0 && isFocused,
    staleTime: 60_000,
    refetchInterval: isFocused ? 60_000 : false,
  });

  const insightsQuery = useQuery({
    queryKey: appQueryKeys.watchlistInsights(symbolsKey),
    queryFn: () => loadWatchlistInsights(symbols),
    enabled: symbols.length > 0 && isFocused,
    staleTime: 5 * 60_000,
  });

  // אחרי מחירים — כדי לא לחסום את הטעינה הראשונית בבקשות Yahoo
  const rangeStatsQuery = useQuery({
    queryKey: appQueryKeys.watchlistRangeStats(symbolsKey),
    queryFn: () => getSymbolsRangeStats(symbols),
    enabled: symbols.length > 0 && isFocused && !!quotesQuery.data,
    staleTime: 15 * 60_000,
  });

  const quotes = quotesQuery.data ?? EMPTY_QUOTES;
  const insights = insightsQuery.data;
  const rangeStats = rangeStatsQuery.data ?? EMPTY_RANGE_STATS;

  const pendingRef = useRef<Record<string, number>>({});
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isFocused || symbols.length === 0) {
      setIsStreaming(false);
      if (!isFocused) setLivePrices({});
      return;
    }
    setIsStreaming(true);
    const release = realtimeQuotes.subscribeMany(symbols);
    const unsub = realtimeQuotes.on((symbol, price) => {
      pendingRef.current[symbol] = price;
      if (flushTimerRef.current) return;
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        const batch = pendingRef.current;
        pendingRef.current = {};
        setLivePrices((prev) => ({ ...prev, ...batch }));
      }, 250);
    });
    return () => {
      release();
      unsub();
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      setIsStreaming(false);
    };
  }, [isFocused, symbolsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const rowsAll: WatchlistRowData[] = useMemo(() => {
    const built = items.map((item) => {
      const base = quotes[item.symbol];
      const live = livePrices[item.symbol];
      const price = live ?? base?.price ?? null;
      const previousClose = base?.previous_close ?? null;
      let change: number | null = null;
      let changePct: number | null = null;
      if (price != null && previousClose != null && previousClose !== 0) {
        change = price - previousClose;
        changePct = (change / previousClose) * 100;
      } else if (base) {
        const c = computeChange(base);
        change = c.change;
        changePct = c.changePct;
      }
      const earn = insights?.earningsBySymbol[item.symbol];
      const range = rangeStats[item.symbol];
      return {
        item,
        price,
        previousClose,
        open: base?.open ?? null,
        dayHigh: base?.day_high ?? null,
        dayLow: base?.day_low ?? null,
        volume: base?.volume ?? null,
        change,
        changePct,
        currency: base?.currency ?? 'USD',
        asOf: base?.as_of ?? null,
        isLive: live != null,
        vsEntryPct: computeVsEntry(price, item.entry_price),
        vsTargetPct: computeVsTarget(price, item.target_price),
        earningsDate: earn?.date ?? null,
        earningsSession: earn?.session ?? null,
        weekHigh: range?.weekHigh ?? null,
        weekLow: range?.weekLow ?? null,
        high52: range?.high52 ?? null,
        low52: range?.low52 ?? null,
      };
    });
    return sortRows(built, sortMode);
  }, [items, quotes, livePrices, sortMode, insights, rangeStats]);

  // בדיקת התראות על שורות מלאות — רק כשבפוקוס (לא ברקע אחרי ניווט)
  useEffect(() => {
    if (!isFocused || rowsAll.length === 0) return;
    const fires = evaluateWatchlistAlerts(rowsAll);
    if (fires.length > 0) {
      void dispatchWatchlistAlerts(fires);
    }
  }, [isFocused, rowsAll]);

  const rows = useMemo(
    () => filterRows(rowsAll, filterMode),
    [rowsAll, filterMode]
  );

  const summary = useMemo(() => summarize(rowsAll), [rowsAll]);

  const refreshQuotes = useCallback(async () => {
    setQuotesRefreshing(true);
    try {
      clearPriceCaches();
      await queryClient.invalidateQueries({
        queryKey: appQueryKeys.watchlistQuotes(symbolsKey),
      });
      await quotesQuery.refetch();
    } finally {
      setQuotesRefreshing(false);
    }
  }, [queryClient, quotesQuery, symbolsKey]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      listsQuery.refetch(),
      itemsQuery.refetch(),
      refreshQuotes(),
      insightsQuery.refetch(),
      rangeStatsQuery.refetch(),
    ]);
  }, [listsQuery, itemsQuery, refreshQuotes, insightsQuery, rangeStatsQuery]);

  const invalidateItems = useCallback(async () => {
    if (!activeWatchlistId) return;
    await queryClient.invalidateQueries({
      queryKey: appQueryKeys.watchlistItems(activeWatchlistId),
    });
  }, [activeWatchlistId, queryClient]);

  const addSymbol = useCallback(
    async (symbol: string, companyName?: string | null) => {
      if (!activeWatchlistId) return;
      await addWatchlistItem({
        watchlistId: activeWatchlistId,
        symbol,
        companyName,
      });
      await invalidateItems();
      await queryClient.invalidateQueries({
        queryKey: appQueryKeys.watchlistInsights(symbolsKey),
      });
    },
    [activeWatchlistId, invalidateItems, queryClient, symbolsKey]
  );

  const removeSymbol = useCallback(
    async (symbol: string) => {
      if (!activeWatchlistId) return;
      await removeWatchlistItem(activeWatchlistId, symbol);
      await invalidateItems();
    },
    [activeWatchlistId, invalidateItems]
  );

  const setNotes = useCallback(
    async (itemId: string, notes: string | null) => {
      await updateWatchlistItemNotes(itemId, notes);
      await invalidateItems();
    },
    [invalidateItems]
  );

  const patchItem = useCallback(
    async (itemId: string, patch: WatchlistItemPatch) => {
      await updateWatchlistItem(itemId, patch);
      await invalidateItems();
    },
    [invalidateItems]
  );

  const reorderSymbols = useCallback(
    async (orderedSymbols: string[]) => {
      if (!activeWatchlistId) return;
      setSortMode('custom');
      await reorderWatchlistItems(activeWatchlistId, orderedSymbols);
      await invalidateItems();
    },
    [activeWatchlistId, invalidateItems]
  );

  const moveSymbol = useCallback(
    async (symbol: string, direction: -1 | 1) => {
      const ordered = [...rowsAll]
        .sort((a, b) => a.item.sort_order - b.item.sort_order)
        .map((r) => r.item.symbol);
      const idx = ordered.indexOf(symbol.toUpperCase());
      if (idx < 0) return;
      const next = idx + direction;
      if (next < 0 || next >= ordered.length) return;
      const copy = [...ordered];
      const [item] = copy.splice(idx, 1);
      copy.splice(next, 0, item);
      await reorderSymbols(copy);
    },
    [rowsAll, reorderSymbols]
  );

  const addList = useCallback(
    async (name: string) => {
      const created = await createWatchlist(name);
      await queryClient.invalidateQueries({ queryKey: appQueryKeys.watchlists });
      setActiveWatchlistId(created.id);
      return created;
    },
    [queryClient]
  );

  const renameList = useCallback(
    async (id: string, name: string) => {
      await renameWatchlist(id, name);
      await queryClient.invalidateQueries({ queryKey: appQueryKeys.watchlists });
    },
    [queryClient]
  );

  const removeList = useCallback(
    async (id: string) => {
      await deleteWatchlist(id);
      await queryClient.invalidateQueries({ queryKey: appQueryKeys.watchlists });
      if (activeWatchlistId === id) setActiveWatchlistId(null);
    },
    [activeWatchlistId, queryClient]
  );

  return {
    watchlists,
    activeWatchlistId,
    setActiveWatchlistId,
    rows,
    rowsAll,
    summary,
    sortMode,
    setSortMode,
    filterMode,
    setFilterMode,
    isStreaming,
    isLoading: listsQuery.isLoading || itemsQuery.isLoading,
    isFetchingQuotes: quotesQuery.isFetching || quotesRefreshing,
    isRefreshing:
      listsQuery.isFetching ||
      itemsQuery.isFetching ||
      quotesRefreshing ||
      insightsQuery.isFetching,
    error: listsQuery.error || itemsQuery.error,
    refreshAll,
    refreshQuotes,
    addSymbol,
    removeSymbol,
    setNotes,
    patchItem,
    reorderSymbols,
    moveSymbol,
    addList,
    renameList,
    removeList,
  };
}
