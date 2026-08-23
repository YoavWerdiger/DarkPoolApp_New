import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type {
  Portfolio,
  PortfolioSummary,
  PortfolioHolding,
  DistributionGroupBy,
  Trade,
} from '../portfolioTypes';
import {
  buildDistribution,
  getDailyGainersLosers,
} from '../../../services/portfolios/portfolioAggregator';
import { toLocalDateKey } from '../../../utils/dateKeys';
import { DistributionDonut } from '../components/DistributionDonut';
import { formatCurrency, formatPercent, gainColor } from '../utils/format';
import {
  getValueHistory,
  buildHistoricalPortfolioSeries,
  buildHistoricalPortfolioSeriesFromSnapshots,
  computePortfolioAnalytics,
  clearHistoricalSeriesCache,
  getQuotes,
} from '../../../services/portfolios';
import type { PortfolioAnalyticsResult } from '../../../services/portfolios';
import { loadTrades } from '../../../services/portfolios/portfolioTradeDerive';
import UICard from '../../../components/ui/UICard';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import { darkPoolTextRtl } from '../../DarkPool/darkPoolLayout';

interface Props {
  portfolio: Portfolio;
  summary: PortfolioSummary | null;
  holdings: PortfolioHolding[];
  avatarUrl?: string | null;
  userInitial?: string;
  /** מפתח שמשתנה בכל פעם שנסגרת פוזיציה — מאלץ רענון גרף */
  chartRefreshKey?: number;
  /** עדכון header חי: שווי + שינוי יומי מפוזיציות פתוחות */
  onLiveSummaryUpdate?: (patch: Partial<PortfolioSummary>) => void;
}

const GROUP_BY_OPTIONS: { id: DistributionGroupBy; label: string }[] = [
  { id: 'symbol', label: 'נכסים' },
  { id: 'asset_type', label: 'סוג נכס' },
  { id: 'sector', label: 'סקטור' },
  { id: 'currency', label: 'מטבע' },
];

interface TradeStats {
  totalPnl: number;
  winRate: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  count: number;
}

type LiveQuote = { price: number; previousClose: number | null };

export default function OverviewTab({
  portfolio,
  summary,
  holdings,
  avatarUrl,
  userInitial,
  chartRefreshKey,
  onLiveSummaryUpdate,
}: Props) {
  const tokens = useDesignTokens();
  const [groupBy, setGroupBy] = useState<DistributionGroupBy>('symbol');
  /** סדרת שווי לחישוב מדדי ביצוע (ללא גרף במסך זה) */
  const [valueSeries, setValueSeries] = useState<{ date: string; value: number; external_flow: number }[]>([]);
  const [tradeStats, setTradeStats] = useState<TradeStats>({
    totalPnl: 0,
    winRate: null,
    avgWin: null,
    avgLoss: null,
    count: 0,
  });
  /** פוזיציות פתוחות — למחשב ערך תיק חי */
  const [openTrades, setOpenTrades] = useState<Trade[]>([]);
  /** מחירים חיים + previous_close עבור סימבולי הפוזיציות הפתוחות */
  const [openTradeQuotes, setOpenTradeQuotes] = useState<Map<string, LiveQuote>>(new Map());

  useEffect(() => {
    let cancel = false;
    if (chartRefreshKey) {
      clearHistoricalSeriesCache(portfolio.id);
    }
    const load = async () => {
      try {
        // Primary: snapshots + unrealized. Colmex/All צריך היסטוריה ארוכה (לא רק 1Y)
        const rangeDays = portfolio.source === 'colmex_pro' ? 2000 : 365;
        const snapshots = await buildHistoricalPortfolioSeriesFromSnapshots(portfolio.id, rangeDays);
        if (cancel) return;
        if (snapshots.length >= 1) {
          setValueSeries(snapshots);
          return;
        }
        // Fallback ליומנים ידניים בלבד — Colmex נשען על snapshots/trades אחרי sync
        if (portfolio.source === 'colmex_pro') {
          setValueSeries([]);
          return;
        }
        const series = await buildHistoricalPortfolioSeries(portfolio.id, 365);
        if (!cancel) setValueSeries(series);
      } catch {
        if (cancel || portfolio.source === 'colmex_pro') {
          if (!cancel) setValueSeries([]);
          return;
        }
        try {
          const hist = await getValueHistory(portfolio.id, 365);
          const series = hist.length >= 2
            ? hist.map((p) => ({ date: p.date, value: p.total_value, external_flow: 0 }))
            : [];
          if (!cancel) setValueSeries(series);
        } catch {
          if (!cancel) setValueSeries([]);
        }
      }
    };
    void load();
    return () => { cancel = true; };
  }, [portfolio.id, portfolio.source, chartRefreshKey]);

  // טוען סטטיסטיקות מסחר (סגורות) + פוזיציות פתוחות (לחישוב ערך תיק חי)
  // chartRefreshKey מאלץ רענון גם אחרי סגירת פוזיציה
  useEffect(() => {
    let cancel = false;
    let priceInterval: ReturnType<typeof setInterval> | null = null;

    const load = async () => {
      try {
        const [closed, open] = await Promise.all([
          loadTrades(portfolio.id, 'CLOSED'),
          loadTrades(portfolio.id, 'OPEN'),
        ]);
        if (cancel) return;

        const withPnl = closed.filter((t) => t.profit_loss != null);
        if (withPnl.length > 0) {
          const totalPnl = withPnl.reduce((s, t) => s + (t.profit_loss ?? 0), 0);
          const wins = withPnl.filter((t) => (t.profit_loss ?? 0) > 0);
          const losses = withPnl.filter((t) => (t.profit_loss ?? 0) < 0);
          setTradeStats({
            totalPnl,
            winRate: (wins.length / withPnl.length) * 100,
            avgWin: wins.length > 0
              ? wins.reduce((s, t) => s + (t.profit_loss ?? 0), 0) / wins.length
              : null,
            avgLoss: losses.length > 0
              ? losses.reduce((s, t) => s + (t.profit_loss ?? 0), 0) / losses.length
              : null,
            count: withPnl.length,
          });
        } else {
          setTradeStats({ totalPnl: 0, winRate: null, avgWin: null, avgLoss: null, count: 0 });
        }

        setOpenTrades(open);
        if (open.length > 0) {
          const symbols = [...new Set(open.map((t) => t.symbol))];
          const fetchPrices = () => {
            void getQuotes(symbols).then((quotesMap) => {
              if (cancel) return;
              const next = new Map<string, LiveQuote>();
              for (const [sym, q] of quotesMap) {
                if (q.price > 0) {
                  next.set(sym, {
                    price: q.price,
                    previousClose:
                      q.previous_close != null && q.previous_close > 0
                        ? q.previous_close
                        : null,
                  });
                }
              }
              setOpenTradeQuotes(next);
            });
          };
          fetchPrices();
          priceInterval = setInterval(fetchPrices, 30_000);
        } else {
          setOpenTradeQuotes(new Map());
        }
      } catch (err) {
        console.error('OverviewTab loadTrades:', err);
      }
    };

    void load();
    return () => {
      cancel = true;
      if (priceInterval) clearInterval(priceInterval);
    };
  }, [portfolio.id, portfolio.source, chartRefreshKey]);

  const isColmex = portfolio.source === 'colmex_pro';

  /** holdings סינתטיים מפוזיציות פתוחות + quotes (גם ל-Colmex וגם לחישוב movers) */
  const openTradeHoldings = useMemo((): PortfolioHolding[] => {
    if (openTrades.length === 0) return [];
    const todayStr = toLocalDateKey(new Date());
    return openTrades.map((t) => {
      const q = openTradeQuotes.get(t.symbol);
      const livePrice = q?.price ?? t.entry_price;
      const prevClose = q?.previousClose ?? null;
      const invested = t.entry_price * t.quantity;
      const lev = t.leverage ?? 1;
      const openedToday = t.entry_date.slice(0, 10) >= todayStr;
      const unrealized =
        t.direction === 'long'
          ? (livePrice - t.entry_price) * t.quantity * lev
          : (t.entry_price - livePrice) * t.quantity * lev;
      // קודם previous_close; "נפתח היום" רק בלי prevClose (מונע -64% מזויף כש-entry_date=היום בטעות)
      let dailyGain = 0;
      let dailyGainPct = 0;
      if (prevClose != null) {
        dailyGain =
          t.direction === 'long'
            ? (livePrice - prevClose) * t.quantity * lev
            : (prevClose - livePrice) * t.quantity * lev;
        dailyGainPct =
          prevClose > 0
            ? ((livePrice - prevClose) / prevClose) * 100 * (t.direction === 'short' ? -1 : 1)
            : 0;
      } else if (openedToday) {
        dailyGain = unrealized;
        dailyGainPct = invested > 0 ? (unrealized / invested) * 100 : 0;
      }
      return {
        symbol: t.symbol,
        asset_type: t.asset_type,
        exchange: t.exchange,
        currency: t.currency,
        sector: null,
        quantity: t.quantity,
        avg_price: t.entry_price,
        invested,
        last_price: livePrice,
        previous_close: prevClose != null ? prevClose : openedToday ? t.entry_price : null,
        value: livePrice * t.quantity,
        unrealized_gain: unrealized,
        unrealized_gain_pct: invested > 0 ? (unrealized / invested) * 100 : 0,
        daily_gain: dailyGain,
        daily_gain_pct: dailyGainPct,
        realized_gain: 0,
        total_gain: unrealized,
        total_gain_pct: invested > 0 ? (unrealized / invested) * 100 : 0,
        total_dividends: 0,
        annualized_yield: 0,
        allocation: 0,
        is_closed: false,
      };
    });
  }, [openTrades, openTradeQuotes]);

  // תיק Colmex: פילוח מפוזיציות פתוחות (trades) בלבד — לעולם לא holdings ישנים
  const distribution = useMemo(() => {
    if (isColmex) {
      if (openTradeHoldings.length === 0) return [];
      return buildDistribution(openTradeHoldings, groupBy);
    }
    return buildDistribution(holdings, groupBy);
  }, [isColmex, openTradeHoldings, holdings, groupBy]);

  const distributionTotal = useMemo(
    () => distribution.reduce((sum, s) => sum + s.value, 0),
    [distribution]
  );

  const { gainers, losers } = useMemo(() => {
    const source = isColmex ? openTradeHoldings : holdings;
    const result = getDailyGainersLosers(source);
    // אם אין עליות/ירידות אבל יש פוזיציות — הצג אותן (גם בשינוי 0)
    if (
      result.gainers.length === 0 &&
      result.losers.length === 0 &&
      source.some((h) => !h.is_closed)
    ) {
      const open = [...source.filter((h) => !h.is_closed)].sort(
        (a, b) => Math.abs(b.daily_gain) - Math.abs(a.daily_gain)
      );
      return {
        gainers: open.filter((h) => h.daily_gain >= 0).slice(0, 5),
        losers: open.filter((h) => h.daily_gain < 0).slice(0, 5),
      };
    }
    return result;
  }, [isColmex, openTradeHoldings, holdings]);

  // שווי חי של היום — נוסחה אחידה: cash + open (entry ± unrealized×leverage).
  // Colmex: available_cash מהברוקר; ידני: available_cash / summary.cash.
  const livePortfolioValue = useMemo(() => {
    const cash = Number(portfolio.available_cash ?? summary?.cash ?? 0);

    if (openTrades.length > 0) {
      const openValue = openTrades.reduce((sum, t) => {
        const livePrice = openTradeQuotes.get(t.symbol)?.price ?? t.entry_price;
        const lev = t.leverage ?? 1;
        const entryCost = t.entry_price * t.quantity;
        const unrealized =
          t.direction === 'long'
            ? (livePrice - t.entry_price) * t.quantity * lev
            : (t.entry_price - livePrice) * t.quantity * lev;
        return sum + entryCost + unrealized;
      }, 0);
      const total = cash + openValue;
      return total > 0 ? total : null;
    }

    if (portfolio.available_cash != null || isColmex) {
      return cash > 0 ? cash : null;
    }

    const holdingsValue = holdings
      .filter((h) => !h.is_closed)
      .reduce((s, h) => s + h.value, 0);
    return holdingsValue + cash > 0 ? holdingsValue + cash : null;
  }, [isColmex, portfolio.available_cash, summary?.cash, openTrades, openTradeQuotes, holdings]);

  /** שווי תיק לחישוב השפעת נכס בודד על התיק (לא % המניה) */
  const portfolioValueForImpact =
    livePortfolioValue ?? summary?.total_value ?? 0;

  // שינוי יומי חי מפוזיציות + עדכון header
  const liveDailyGain = useMemo(() => {
    if (openTradeHoldings.length === 0) return null;
    if (!openTradeHoldings.some((h) => h.previous_close != null)) return null;
    return openTradeHoldings.reduce((s, h) => s + h.daily_gain, 0);
  }, [openTradeHoldings]);

  useEffect(() => {
    if (!onLiveSummaryUpdate || livePortfolioValue == null) return;
    const daily = liveDailyGain ?? 0;
    const yesterday = livePortfolioValue - daily;
    onLiveSummaryUpdate({
      total_value: livePortfolioValue,
      value: Math.max(
        0,
        livePortfolioValue - Number(portfolio.available_cash ?? 0)
      ),
      daily_gain: daily,
      daily_gain_pct: yesterday > 0 ? (daily / yesterday) * 100 : 0,
      unrealized_gain: openTradeHoldings.reduce((s, h) => s + h.unrealized_gain, 0),
    });
  }, [
    livePortfolioValue,
    liveDailyGain,
    openTradeHoldings,
    onLiveSummaryUpdate,
    portfolio.available_cash,
  ]);

  // אחיד לכל סוגי התיקים: overlay של נקודת היום + fallback ל-2 נקודות (למדדים)
  const filteredSeries = useMemo(() => {
    let base = valueSeries;
    if (base.length === 0 && livePortfolioValue != null && livePortfolioValue > 0) {
      const todayStr = toLocalDateKey(new Date());
      base = [{ date: todayStr, value: livePortfolioValue, external_flow: 0 }];
    }
    if (base.length === 0) return [];
    if (livePortfolioValue != null && base.length >= 1) {
      const todayStr = toLocalDateKey(new Date());
      const last = base[base.length - 1];
      if (last.date === todayStr) {
        base = [...base.slice(0, -1), { ...last, value: livePortfolioValue }];
      } else if (last.date < todayStr) {
        base = [
          ...base,
          { date: todayStr, value: livePortfolioValue, external_flow: 0 },
        ];
      }
    }
    // מדדים דורשים ≥2 נקודות — שכפל ליום קודם אם יש רק אחת
    if (base.length === 1) {
      const only = base[0];
      const d = new Date(`${only.date}T12:00:00`);
      d.setDate(d.getDate() - 1);
      const prev = toLocalDateKey(d);
      base = [
        { date: prev, value: only.value, external_flow: 0 },
        only,
      ];
    }
    return base;
  }, [valueSeries, livePortfolioValue]);

  const analytics = useMemo((): PortfolioAnalyticsResult | null => {
    if (filteredSeries.length < 2) return null;
    return computePortfolioAnalytics(filteredSeries);
  }, [filteredSeries]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          direction: 'rtl',
        },
        section: {
          marginBottom: 16,
          overflow: 'hidden',
        },
        sectionTitle: {
          fontSize: 15,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          ...darkPoolTextRtl,
          marginBottom: 12,
        },
        tipsBanner: {
          // עץ RTL — row (לא row-reverse)
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: 12,
          backgroundColor: 'rgba(255, 184, 0, 0.10)',
          borderColor: 'rgba(255, 184, 0, 0.30)',
          borderWidth: 1,
          borderRadius: 14,
          marginBottom: 16,
        },
        tipsText: {
          flex: 1,
          fontSize: 13,
          color: tokens.colors.text.warning,
          lineHeight: 18,
          ...darkPoolTextRtl,
        },
        groupChips: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 6,
          marginBottom: 14,
        },
        groupChip: {
          paddingVertical: 7,
          paddingHorizontal: 12,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
          backgroundColor: 'rgba(255,255,255,0.04)',
        },
        groupChipActive: {
          borderColor: `${tokens.colors.primary.main}66`,
          backgroundColor: `${tokens.colors.primary.main}1F`,
        },
        groupChipText: {
          fontSize: 12,
          color: tokens.colors.text.secondary,
          fontWeight: '600',
        },
        groupChipTextActive: {
          color: tokens.colors.primary.main,
          fontWeight: '700',
        },
        donutWrap: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
        },
        legend: {
          flex: 1,
          gap: 8,
        },
        legendRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        legendDot: {
          width: 10,
          height: 10,
          borderRadius: 5,
        },
        legendLabel: {
          flex: 1,
          fontSize: 12,
          color: tokens.colors.text.primary,
          ...darkPoolTextRtl,
          fontWeight: '600',
        },
        legendPct: {
          fontSize: 12,
          fontWeight: '700',
          color: tokens.colors.text.secondary,
        },
        totalRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: 12,
          paddingHorizontal: 4,
        },
        totalLabel: {
          fontSize: 13,
          color: tokens.colors.text.tertiary,
          ...darkPoolTextRtl,
        },
        totalValue: {
          fontSize: 15,
          fontWeight: '700',
          color: tokens.colors.text.primary,
        },
        moversWrap: {
          gap: 14,
        },
        moverGroup: {
          gap: 4,
        },
        moverGroupHeaderText: {
          fontSize: 12,
          fontWeight: '700',
          ...darkPoolTextRtl,
          marginBottom: 8,
        },
        moverRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 9,
          paddingHorizontal: 10,
          gap: 8,
          borderRadius: 12,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(255,255,255,0.08)',
          marginBottom: 6,
        },
        moverSymbol: {
          flex: 1,
          fontSize: 13,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          ...darkPoolTextRtl,
        },
        moverValues: {
          alignItems: 'flex-start',
          gap: 2,
        },
        moverPct: {
          fontSize: 13,
          fontWeight: '700',
          writingDirection: 'ltr',
          textAlign: 'left',
        },
        moverDollar: {
          fontSize: 12,
          fontWeight: '600',
          writingDirection: 'ltr',
          textAlign: 'left',
        },
        moverStockPct: {
          fontSize: 10,
          fontWeight: '500',
          writingDirection: 'ltr',
          textAlign: 'left',
          opacity: 0.75,
        },
        emptyText: {
          fontSize: 13,
          color: tokens.colors.text.tertiary,
          textAlign: 'center',
          paddingVertical: 24,
        },
        emptyTextSmall: {
          fontSize: 12,
          color: tokens.colors.text.tertiary,
          textAlign: 'center',
          paddingVertical: 10,
        },
        cashGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 10,
        },
        cashCell: {
          width: '48%',
          flexGrow: 1,
          padding: 12,
          borderRadius: 14,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(255,255,255,0.08)',
          gap: 6,
        },
        cashCellLabel: {
          fontSize: 11,
          fontWeight: '600',
          color: tokens.colors.text.tertiary,
          ...darkPoolTextRtl,
        },
        cashCellValue: {
          fontSize: 15,
          fontWeight: '700',
          ...darkPoolTextRtl,
          writingDirection: 'ltr',
        },
        analyticsGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 10,
        },
        analyticsCell: {
          width: '48%',
          flexGrow: 1,
          padding: 12,
          borderRadius: 14,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(255,255,255,0.08)',
          gap: 4,
        },
        analyticsCellLabel: {
          fontSize: 10,
          fontWeight: '600',
          color: tokens.colors.text.tertiary,
          ...darkPoolTextRtl,
        },
        analyticsCellValue: {
          fontSize: 16,
          fontWeight: '800',
          ...darkPoolTextRtl,
          writingDirection: 'ltr',
        },
      }),
    [tokens]
  );

  const showTip = (summary?.holdings_count ?? 0) === 0;

  return (
    <View style={styles.root}>
      {showTip && !isColmex ? (
        <View style={styles.tipsBanner}>
          <Ionicons name="bulb" size={20} color={tokens.colors.text.warning} />
          <Text style={styles.tipsText}>
            התיק עוד ריק – הוסף הפקדה ראשונה ועסקאות buy כדי לראות חישובים מדויקים.
          </Text>
        </View>
      ) : null}

      {/* Analytics metrics */}
      {(analytics != null || tradeStats.count > 0) && (
        <UICard variant="glass" glassIntensity="light" padding="md" style={styles.section}>
          <Text style={styles.sectionTitle}>מדדי ביצוע</Text>
          <View style={styles.analyticsGrid}>
            {/* TWR — תשואה מנורמלת שמבודדת הפקדות/משיכות */}
            <AnalyticsCell
              label="תשואה נטו (TWR)"
              value={
                analytics?.twrReturn != null
                  ? formatPercent(analytics.twrReturn * 100)
                  : analytics?.totalReturn != null
                  ? formatPercent(analytics.totalReturn * 100)
                  : '—'
              }
              valueColor={
                (analytics?.twrReturn ?? analytics?.totalReturn) == null
                  ? tokens.colors.text.secondary
                  : (analytics?.twrReturn ?? analytics?.totalReturn ?? 0) >= 0
                  ? tokens.colors.primary.main
                  : tokens.colors.text.danger
              }
              hint={analytics?.twrReturn != null ? 'מנורמל להפקדות' : undefined}
              styles={styles}
            />
            <AnalyticsCell
              label="תנודתיות שנתית"
              value={analytics?.volatility != null ? formatPercent(analytics.volatility * 100, 1) : '—'}
              valueColor={tokens.colors.text.primary}
              styles={styles}
            />
            <AnalyticsCell
              label="Sharpe Ratio"
              value={analytics?.sharpe != null ? analytics.sharpe.toFixed(2) : '—'}
              valueColor={
                analytics?.sharpe == null
                  ? tokens.colors.text.secondary
                  : analytics.sharpe >= 1
                  ? tokens.colors.primary.main
                  : analytics.sharpe >= 0
                  ? tokens.colors.text.primary
                  : tokens.colors.text.danger
              }
              styles={styles}
            />
            <AnalyticsCell
              label="Max Drawdown"
              value={analytics?.maxDrawdown != null ? formatPercent(analytics.maxDrawdown * 100, 1) : '—'}
              valueColor={
                analytics?.maxDrawdown == null
                  ? tokens.colors.text.secondary
                  : analytics.maxDrawdown > 0.2
                  ? tokens.colors.text.danger
                  : tokens.colors.text.primary
              }
              styles={styles}
            />
            {/* P&L מסחרי בלבד (ללא דיבידנדים) */}
            <AnalyticsCell
              label="P&L מסחרי"
              value={
                tradeStats.count > 0
                  ? `${tradeStats.totalPnl >= 0 ? '+' : ''}${formatCurrency(tradeStats.totalPnl, portfolio.currency)}`
                  : '—'
              }
              valueColor={
                tradeStats.count === 0
                  ? tokens.colors.text.secondary
                  : tradeStats.totalPnl > 0
                  ? tokens.colors.primary.main
                  : tradeStats.totalPnl < 0
                  ? tokens.colors.text.danger
                  : tokens.colors.text.secondary
              }
              hint="trades בלבד"
              styles={styles}
            />
            {/* P&L נטו = מסחרי + דיבידנדים − עמלות */}
            <AnalyticsCell
              label="P&L נטו (כולל דיב׳)"
              value={(() => {
                const netPnl =
                  tradeStats.totalPnl +
                  (summary?.total_dividends ?? 0) -
                  (summary?.total_fees ?? 0);
                return tradeStats.count > 0 || (summary?.total_dividends ?? 0) > 0
                  ? `${netPnl >= 0 ? '+' : ''}${formatCurrency(netPnl, portfolio.currency)}`
                  : '—';
              })()}
              valueColor={(() => {
                const netPnl =
                  tradeStats.totalPnl +
                  (summary?.total_dividends ?? 0) -
                  (summary?.total_fees ?? 0);
                return netPnl > 0
                  ? tokens.colors.primary.main
                  : netPnl < 0
                  ? tokens.colors.text.danger
                  : tokens.colors.text.secondary;
              })()}
              hint="+דיבידנדים −עמלות"
              styles={styles}
            />
            <AnalyticsCell
              label="Win Rate"
              value={tradeStats.winRate != null ? `${tradeStats.winRate.toFixed(0)}%` : '—'}
              valueColor={
                tradeStats.winRate == null
                  ? tokens.colors.text.secondary
                  : tradeStats.winRate >= 50
                  ? tokens.colors.primary.main
                  : tokens.colors.text.primary
              }
              styles={styles}
            />
            <AnalyticsCell
              label="ממוצע רווח"
              value={
                tradeStats.avgWin != null
                  ? `+${formatCurrency(tradeStats.avgWin, portfolio.currency)}`
                  : '—'
              }
              valueColor={
                tradeStats.avgWin != null
                  ? tokens.colors.primary.main
                  : tokens.colors.text.secondary
              }
              styles={styles}
            />
            <AnalyticsCell
              label="ממוצע הפסד"
              value={
                tradeStats.avgLoss != null
                  ? formatCurrency(tradeStats.avgLoss, portfolio.currency)
                  : '—'
              }
              valueColor={
                tradeStats.avgLoss != null
                  ? tokens.colors.text.danger
                  : tokens.colors.text.secondary
              }
              styles={styles}
            />
          </View>
        </UICard>
      )}

      {/* Distribution */}
      <UICard variant="glass" glassIntensity="light" padding="md" style={styles.section}>
        <Text style={styles.sectionTitle}>חלוקת נכסים</Text>
        <View style={styles.groupChips}>
          {GROUP_BY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              onPress={() => {
                if (groupBy !== opt.id) void HapticFeedback.selection();
                setGroupBy(opt.id);
              }}
              style={[
                styles.groupChip,
                groupBy === opt.id && styles.groupChipActive,
              ]}
            >
              <Text
                style={[
                  styles.groupChipText,
                  groupBy === opt.id && styles.groupChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {distribution.length === 0 ? (
          <Text style={styles.emptyText}>הוסף נכסים כדי לראות פילוח</Text>
        ) : (
          <>
            <View style={styles.donutWrap}>
              <DistributionDonut
                slices={distribution}
                size={140}
                strokeWidth={20}
                avatarUrl={avatarUrl}
                userInitial={userInitial}
              />
              <View style={styles.legend}>
                {distribution.slice(0, 6).map((s) => (
                  <View key={s.key} style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                    <Text style={styles.legendLabel} numberOfLines={1}>
                      {s.label}
                    </Text>
                    <Text style={styles.legendPct}>{formatPercent(s.percentage, 1, false)}</Text>
                  </View>
                ))}
                {distribution.length > 6 ? (
                  <Text
                    style={[styles.legendLabel, { color: tokens.colors.text.tertiary }]}
                  >
                    ועוד {distribution.length - 6} נכסים נוספים
                  </Text>
                ) : null}
              </View>
            </View>
            {distribution.length > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>סה"כ נכסים</Text>
                <Text style={styles.totalValue}>
                  {formatCurrency(distributionTotal, portfolio.currency)}
                </Text>
              </View>
            )}
          </>
        )}
      </UICard>

      {/* Daily gainers/losers — השפעה על התיק (לא % המניה) */}
      <UICard variant="glass" glassIntensity="light" padding="md" style={styles.section}>
        <Text style={styles.sectionTitle}>השפעה על התיק היום</Text>
        {(isColmex ? openTradeHoldings.length === 0 : holdings.length === 0) ? (
          <Text style={styles.emptyText}>
            {isColmex ? 'אין פוזיציות פתוחות' : 'אין נכסים בתיק'}
          </Text>
        ) : (
          <View style={styles.moversWrap}>
            <View style={styles.moverGroup}>
              <Text
                style={[
                  styles.moverGroupHeaderText,
                  { color: tokens.colors.primary.main },
                ]}
              >
                תרומה חיובית
              </Text>
              {gainers.length === 0 ? (
                <Text style={styles.emptyTextSmall}>
                  אין עליות היום בנכסים הפתוחים
                </Text>
              ) : (
                gainers.map((h) => (
                  <MoverImpactRow
                    key={h.symbol}
                    holding={h}
                    portfolioValue={portfolioValueForImpact}
                    currency={portfolio.currency}
                    tokens={tokens}
                    styles={styles}
                  />
                ))
              )}
            </View>
            <View style={styles.moverGroup}>
              <Text
                style={[
                  styles.moverGroupHeaderText,
                  { color: tokens.colors.text.danger },
                ]}
              >
                תרומה שלילית
              </Text>
              {losers.length === 0 ? (
                <Text style={styles.emptyTextSmall}>
                  אין ירידות היום בנכסים הפתוחים
                </Text>
              ) : (
                losers.map((h) => (
                  <MoverImpactRow
                    key={h.symbol}
                    holding={h}
                    portfolioValue={portfolioValueForImpact}
                    currency={portfolio.currency}
                    tokens={tokens}
                    styles={styles}
                  />
                ))
              )}
            </View>
          </View>
        )}
      </UICard>

      {/* Cash flow summary */}
      <UICard variant="glass" glassIntensity="light" padding="md" style={styles.section}>
        <Text style={styles.sectionTitle}>תזרים מזומנים</Text>
        <View style={styles.cashGrid}>
          <CashFlowCard
            label="הפקדות"
            value={summary ? formatCurrency(summary.total_deposits, portfolio.currency) : '—'}
            tokens={tokens}
            styles={styles}
          />
          <CashFlowCard
            label="משיכות"
            value={summary ? formatCurrency(summary.total_withdrawals, portfolio.currency) : '—'}
            tokens={tokens}
            styles={styles}
          />
          <CashFlowCard
            label="עמלות / מסים"
            value={summary ? formatCurrency(summary.total_fees, portfolio.currency) : '—'}
            tokens={tokens}
            styles={styles}
          />
          <CashFlowCard
            label="דיבידנדים"
            value={
              summary ? formatCurrency(summary.total_dividends, portfolio.currency) : '—'
            }
            tokens={tokens}
            styles={styles}
          />
        </View>
      </UICard>
    </View>
  );
}

interface MoverImpactRowProps {
  holding: PortfolioHolding;
  portfolioValue: number;
  currency: string;
  tokens: ReturnType<typeof useDesignTokens>;
  styles: {
    moverRow: any;
    moverSymbol: any;
    moverValues: any;
    moverPct: any;
    moverDollar: any;
    moverStockPct: any;
  };
}

/** שורת נכס: השפעה על התיק (בולט) + שינוי $ + % מניה במשני */
function MoverImpactRow({
  holding,
  portfolioValue,
  currency,
  tokens,
  styles,
}: MoverImpactRowProps) {
  const impactPct =
    portfolioValue > 0 ? (holding.daily_gain / portfolioValue) * 100 : 0;
  const color = gainColor(
    holding.daily_gain,
    tokens.colors.primary.main,
    tokens.colors.text.danger,
    tokens.colors.text.secondary
  );
  return (
    <View style={styles.moverRow}>
      <Text style={styles.moverSymbol}>{holding.symbol}</Text>
      <View style={styles.moverValues}>
        <Text style={[styles.moverPct, { color }]}>
          {formatPercent(impactPct)}
        </Text>
        <Text style={[styles.moverDollar, { color }]}>
          {formatCurrency(holding.daily_gain, currency)}
        </Text>
        {holding.daily_gain_pct !== 0 || holding.previous_close != null ? (
          <Text style={[styles.moverStockPct, { color: tokens.colors.text.tertiary }]}>
            מניה {formatPercent(holding.daily_gain_pct)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

interface CashFlowCardProps {
  label: string;
  value: string;
  tokens: ReturnType<typeof useDesignTokens>;
  styles: {
    cashCell: any;
    cashCellLabel: any;
    cashCellValue: any;
  };
}

function CashFlowCard({ label, value, tokens, styles }: CashFlowCardProps) {
  return (
    <View style={styles.cashCell}>
      <Text style={styles.cashCellLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.cashCellValue, { color: tokens.colors.text.primary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {value}
      </Text>
    </View>
  );
}

interface AnalyticsCellProps {
  label: string;
  value: string;
  valueColor: string;
  /** רמז קצר מתחת לערך (אופציונלי) */
  hint?: string;
  styles: {
    analyticsCell: any;
    analyticsCellLabel: any;
    analyticsCellValue: any;
    analyticsCellHint?: any;
  };
}

function AnalyticsCell({ label, value, valueColor, hint, styles }: AnalyticsCellProps) {
  return (
    <View style={styles.analyticsCell}>
      <Text style={styles.analyticsCellLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[styles.analyticsCellValue, { color: valueColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {value}
      </Text>
      {hint != null ? (
        <Text
          style={[
            styles.analyticsCellHint ?? {},
            { fontSize: 9, color: '#666', ...darkPoolTextRtl, marginTop: 2 },
          ]}
          numberOfLines={1}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
