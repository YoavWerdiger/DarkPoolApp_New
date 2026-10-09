import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type {
  Portfolio,
  PortfolioSummary,
  PortfolioHolding,
  DistributionGroupBy,
  PerformancePeriod,
  Trade,
} from '../portfolioTypes';
import { buildDistribution } from '../../../services/portfolios/portfolioAggregator';
import { toLocalDateKey } from '../../../utils/dateKeys';
import { DistributionDonut } from '../components/DistributionDonut';
import { PortfolioValueChart } from '../components/PortfolioValueChart';
import { formatCurrency, formatPercent, gainColor } from '../utils/format';
import {
  getValueHistory,
  buildHistoricalPortfolioSeries,
  buildHistoricalPortfolioSeriesFromSnapshots,
  computePortfolioAnalytics,
  expandingSharpeSeries,
  clearHistoricalSeriesCache,
  getQuotes,
} from '../../../services/portfolios';
import type { PortfolioAnalyticsResult } from '../../../services/portfolios';
import { loadTrades } from '../../../services/portfolios/portfolioTradeDerive';
import UICard from '../../../components/ui/UICard';
import { DayDividerPill } from '../../../components/ui/DayDividerPill';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import {
  JOURNAL_LAYOUT,
  JOURNAL_TYPE,
  journalCardMetricLabelStyle,
  journalCardMetricValueSecondaryStyle,
  journalCardTitleStyle,
  journalPhysicalRightText,
} from '../../Journal/journalLayout';
import {
  computeChartPeriodReturn,
  filterChartSeriesByPeriod,
} from '../../DarkPool/utils/profileChartSeries';
import {
  CHANGE_DOT_SIZE,
  changeToneColor,
  changeToneFromSigned,
  formatSignedChangePct,
} from '../../../components/ui/ChangeDot';
import { formatCongressDeltaUsd } from '../../DarkPool/utils/investorHoldings';
import { toDataIsland } from '../../DarkPool/utils/bidi';
import { AnimatedNumber } from '../../../components/ui/AnimatedNumber';
import { APP_LAYOUT } from '../../../components/ui/appLayout';
import { appendOpenPositionSession } from '../../DarkPool/utils/sessionSnapshots';
import { getHistoricalPrices } from '../../../services/portfolios/portfolioPriceFeed';

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
  /** סכום רווחים חיוביים מעסקאות סגורות */
  grossWin: number;
  /** סכום הפסדים בערך מוחלט */
  grossLossAbs: number;
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
  const [period, setPeriod] = useState<PerformancePeriod>('3M');
  /** נקודה בגרירה על הגרף — הסכום בכותרת מתעדכן אליה (כמו באינסיידרים) */
  const [scrubPoint, setScrubPoint] = useState<{ date: string; value: number } | null>(null);
  /** סדרת שווי לגרף + מדדי ביצוע */
  const [chartSeries, setChartSeries] = useState<
    { date: string; value: number; external_flow: number }[]
  >([]);
  const [sessionSeries, setSessionSeries] = useState<
    { date: string; value: number; external_flow: number }[] | null
  >(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [tradeStats, setTradeStats] = useState<TradeStats>({
    totalPnl: 0,
    winRate: null,
    avgWin: null,
    avgLoss: null,
    count: 0,
    grossWin: 0,
    grossLossAbs: 0,
  });
  /** פוזיציות פתוחות — למחשב ערך תיק חי */
  const [openTrades, setOpenTrades] = useState<Trade[]>([]);
  /** מחירים חיים + previous_close עבור סימבולי הפוזיציות הפתוחות */
  const [openTradeQuotes, setOpenTradeQuotes] = useState<Map<string, LiveQuote>>(new Map());

  useEffect(() => {
    let cancel = false;
    setChartLoading(true);
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
          setChartSeries(snapshots);
          return;
        }
        // Fallback ליומנים ידניים בלבד — Colmex נשען על snapshots/trades אחרי sync
        if (portfolio.source === 'colmex_pro') {
          setChartSeries([]);
          return;
        }
        const series = await buildHistoricalPortfolioSeries(portfolio.id, 365);
        if (!cancel) setChartSeries(series);
      } catch {
        if (cancel || portfolio.source === 'colmex_pro') {
          if (!cancel) setChartSeries([]);
          return;
        }
        try {
          const hist = await getValueHistory(portfolio.id, 365);
          const series = hist.length >= 2
            ? hist.map((p) => ({ date: p.date, value: p.total_value, external_flow: 0 }))
            : [];
          if (!cancel) setChartSeries(series);
        } catch {
          if (!cancel) setChartSeries([]);
        }
      } finally {
        if (!cancel) setChartLoading(false);
      }
    };
    void load();
    return () => { cancel = true; };
  }, [portfolio.id, portfolio.source, chartRefreshKey]);

  useEffect(() => {
    if (!chartSeries.length || !openTrades.length) {
      setSessionSeries(null);
      return;
    }
    let cancel = false;
    const symbols = Array.from(new Set(openTrades.map((t) => t.symbol.toUpperCase()))).slice(0, 20);
    void (async () => {
      const hourly: Record<string, { date: string; close: number }[]> = {};
      await Promise.all(
        symbols.map(async (sym) => {
          const points = await getHistoricalPrices(sym, '1d', { interval: '1h' });
          hourly[sym] = points
            .filter((p) => p.close > 0 && /T\d{2}:/.test(p.date))
            .map((p) => ({ date: p.date, close: p.close }));
        })
      );
      if (cancel) return;
      const next = appendOpenPositionSession(
        chartSeries,
        openTrades.map((t) => ({
          symbol: t.symbol,
          direction: t.direction,
          entryPrice: t.entry_price,
          quantity: t.quantity,
          leverage: t.leverage ?? null,
          previousClose: openTradeQuotes.get(t.symbol)?.previousClose ?? null,
        })),
        hourly
      );
      setSessionSeries(next.length > chartSeries.length ? next : null);
    })();
    return () => {
      cancel = true;
    };
  }, [chartSeries, openTrades, openTradeQuotes]);

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
          const grossWin = wins.reduce((s, t) => s + (t.profit_loss ?? 0), 0);
          const grossLossAbs = Math.abs(losses.reduce((s, t) => s + (t.profit_loss ?? 0), 0));
          setTradeStats({
            totalPnl,
            winRate: (wins.length / withPnl.length) * 100,
            avgWin: wins.length > 0 ? grossWin / wins.length : null,
            avgLoss: losses.length > 0 ? -grossLossAbs / losses.length : null,
            count: withPnl.length,
            grossWin,
            grossLossAbs,
          });
        } else {
          setTradeStats({
            totalPnl: 0,
            winRate: null,
            avgWin: null,
            avgLoss: null,
            count: 0,
            grossWin: 0,
            grossLossAbs: 0,
          });
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

  // פילוח מפוזיציות OPEN (trades) — גם ידני וגם Colmex; fallback ל-holdings מ-TX ישן
  const distribution = useMemo(() => {
    if (openTradeHoldings.length > 0) {
      return buildDistribution(openTradeHoldings, groupBy);
    }
    if (isColmex) return [];
    return buildDistribution(holdings, groupBy);
  }, [isColmex, openTradeHoldings, holdings, groupBy]);

  const distributionTotal = useMemo(
    () => distribution.reduce((sum, s) => sum + s.value, 0),
    [distribution]
  );

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

  // אחיד לכל סוגי התיקים: overlay של נקודת היום + fallback ל-2 נקודות (לגרף + מדדים)
  const filteredSeries = useMemo(() => {
    let base = sessionSeries ?? chartSeries;
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
    // גרף/מדדים דורשים ≥2 נקודות — שכפל ליום קודם אם יש רק אחת
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
  }, [chartSeries, sessionSeries, livePortfolioValue]);

  // מדדים וגרפים קטנים על אותה תקופה כמו בורר התקופה בגרף הגדול
  const periodSeries = useMemo(
    () => filterChartSeriesByPeriod(filteredSeries, period),
    [filteredSeries, period]
  );

  /**
   * רווח + תשואה לתקופה — כמו בפרופיל אינסיידר, אבל בלי לספור הפקדות/משיכות כרווח.
   * כשהסדרה לא אמינה (הפקדה בלי external_flow) — נופלים לרווח/תשואה הכוללים של התיק.
   */
  const periodDelta = useMemo(() => {
    if (periodSeries.length >= 2) {
      const first = periodSeries[0].value;
      const last = periodSeries[periodSeries.length - 1].value;
      const flows = periodSeries
        .slice(1)
        .reduce((sum, p) => sum + (p.external_flow ?? 0), 0);
      const pct = computeChartPeriodReturn(periodSeries);
      if (pct != null && Number.isFinite(last - first - flows)) {
        return { usd: last - first - flows, pct };
      }
    }
    if (summary && Number.isFinite(summary.total_gain_pct)) {
      return { usd: summary.total_gain, pct: summary.total_gain_pct };
    }
    return null;
  }, [periodSeries, summary]);

  const analytics = useMemo((): PortfolioAnalyticsResult | null => {
    if (periodSeries.length < 2) return null;
    return computePortfolioAnalytics(periodSeries);
  }, [periodSeries]);

  const sharpePath = useMemo(
    () => expandingSharpeSeries(periodSeries),
    [periodSeries]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        /** עץ RTL מקומי — App הוא LTR; כאן row (לא row-reverse) כדי לא להפוך פעמיים */
        root: {
          direction: 'rtl',
        },
        section: {
          marginBottom: JOURNAL_LAYOUT.cardStackGap,
          overflow: 'hidden',
          direction: 'rtl',
        },
        sectionTitle: {
          ...journalCardTitleStyle,
          color: tokens.colors.text.primary,
          marginBottom: JOURNAL_LAYOUT.cardTitleToBodyGap,
        },
        /** כמו פרופיל אינסיידר: תווית → סכום (cardMetricValue) → רווח · תשואה */
        valueLabel: {
          ...journalCardTitleStyle,
          color: tokens.colors.text.primary,
        },
        heroValue: {
          direction: 'ltr',
          writingDirection: 'ltr',
          textAlign: 'right',
          marginTop: APP_LAYOUT.cardMetricLabelToValueGap,
          fontSize: JOURNAL_TYPE.cardMetricValue.fontSize,
          lineHeight: JOURNAL_TYPE.cardMetricValue.lineHeight,
          fontWeight: JOURNAL_TYPE.cardMetricValue.fontWeight,
          letterSpacing: JOURNAL_TYPE.cardMetricValue.letterSpacing,
          color: tokens.colors.text.primary,
        },
        deltaRow: {
          marginTop: APP_LAYOUT.titleSubtitleGap,
          marginBottom: APP_LAYOUT.cardTitleToBodyGap,
          // קצה ימין פיזי — alignSelf:flex-end מתהפך לשמאל בתוך עץ RTL
          alignSelf: 'stretch',
          direction: 'ltr',
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          textAlign: 'right',
          gap: 6,
        },
        deltaFigure: {
          fontSize: JOURNAL_TYPE.cardBody.fontSize,
          lineHeight: JOURNAL_TYPE.cardBody.lineHeight,
          fontWeight: JOURNAL_TYPE.cardTitle.fontWeight,
          writingDirection: 'ltr',
          fontVariant: ['tabular-nums'],
        },
        deltaDot: {
          width: CHANGE_DOT_SIZE,
          height: CHANGE_DOT_SIZE,
          borderRadius: CHANGE_DOT_SIZE / 2,
        },
        tipsBanner: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: 12,
          backgroundColor: 'rgba(255, 184, 0, 0.10)',
          borderColor: 'rgba(255, 184, 0, 0.30)',
          borderWidth: 0,
          borderRadius: 14,
          marginBottom: 16,
        },
        tipsText: {
          flex: 1,
          fontSize: 13,
          color: tokens.colors.text.warning,
          lineHeight: 18,
          ...journalPhysicalRightText,
        },
        groupChips: {
          direction: 'rtl',
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'flex-start',
          gap: 6,
          marginBottom: 14,
          width: '100%',
        },
        groupChip: {
          borderRadius: 999,
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
          ...journalPhysicalRightText,
          fontWeight: '600',
        },
        legendPct: {
          fontSize: 12,
          fontWeight: '700',
          color: tokens.colors.text.secondary,
          writingDirection: 'ltr',
          textAlign: 'right',
        },
        totalRow: {
          flexDirection: 'row',
          justifyContent: 'flex-start',
          alignItems: 'center',
          gap: 10,
          marginTop: 12,
          paddingHorizontal: 4,
        },
        totalLabel: {
          fontSize: 13,
          color: tokens.colors.text.tertiary,
          ...journalPhysicalRightText,
        },
        totalValue: {
          fontSize: 15,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          writingDirection: 'ltr',
          textAlign: 'right',
        },
        emptyText: {
          width: '100%',
          alignSelf: 'stretch',
          fontSize: 13,
          color: tokens.colors.text.tertiary,
          ...journalPhysicalRightText,
          paddingVertical: 24,
        },
        cashList: {
          width: '100%',
        },
        cashLine: {
          direction: 'ltr',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: tokens.colors.border.divider,
        },
        cashLineLast: {
          borderBottomWidth: 0,
          paddingBottom: 0,
        },
        cashLabel: {
          ...journalPhysicalRightText,
          flexShrink: 1,
          fontSize: JOURNAL_TYPE.cardSubtitle.fontSize,
          fontWeight: JOURNAL_TYPE.cardSubtitle.fontWeight,
          lineHeight: JOURNAL_TYPE.cardSubtitle.lineHeight,
          color: tokens.colors.text.secondary,
        },
        cashValue: {
          flexShrink: 0,
          direction: 'ltr',
          writingDirection: 'ltr',
          textAlign: 'left',
          fontSize: JOURNAL_TYPE.cardSubtitle.fontSize,
          fontWeight: '600',
          lineHeight: JOURNAL_TYPE.cardSubtitle.lineHeight,
          color: tokens.colors.text.primary,
          fontVariant: ['tabular-nums'],
        },
        metricSection: {
          marginBottom: JOURNAL_LAYOUT.cardStackGap,
        },
        metricSectionLabel: {
          width: '100%',
          alignSelf: 'stretch',
          ...journalPhysicalRightText,
          fontSize: JOURNAL_TYPE.groupLabel.fontSize,
          fontWeight: JOURNAL_TYPE.groupLabel.fontWeight,
          lineHeight: JOURNAL_TYPE.groupLabel.lineHeight,
          color: tokens.colors.text.secondary,
          marginBottom: JOURNAL_LAYOUT.groupLabelToContent,
        },
        metricRow: {
          direction: 'rtl',
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: JOURNAL_LAYOUT.cardStackGap,
        },
        metricCard: {
          width: 220,
        },
        metricCardInner: {
          direction: 'ltr',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          minHeight: 76,
        },
        metricVisual: {
          width: 68,
          alignItems: 'center',
          justifyContent: 'center',
        },
        metricText: {
          flex: 1,
          alignItems: 'flex-end',
        },
        metricLabel: {
          width: '100%',
          ...journalCardMetricLabelStyle,
          textAlign: 'right',
          color: tokens.colors.text.secondary,
        },
        metricValue: {
          width: '100%',
          ...journalCardMetricValueSecondaryStyle,
          textAlign: 'right',
          marginTop: JOURNAL_LAYOUT.cardMetricLabelToValueGap,
        },
        metricHint: {
          width: '100%',
          ...journalPhysicalRightText,
          fontSize: JOURNAL_TYPE.caption2.fontSize,
          fontWeight: JOURNAL_TYPE.caption2.fontWeight,
          lineHeight: JOURNAL_TYPE.caption2.lineHeight,
          color: tokens.colors.text.tertiary,
          marginTop: 2,
        },
      }),
    [tokens]
  );

  const showTip =
    openTrades.length === 0 &&
    holdings.filter((h) => !h.is_closed).length === 0 &&
    (summary?.holdings_count ?? 0) === 0;
  const netPnl =
    tradeStats.totalPnl + (summary?.total_dividends ?? 0) - (summary?.total_fees ?? 0);
  const profitFactor =
    tradeStats.grossLossAbs > 0 ? tradeStats.grossWin / tradeStats.grossLossAbs : null;
  const profitShare =
    tradeStats.grossWin + tradeStats.grossLossAbs > 0
      ? tradeStats.grossWin / (tradeStats.grossWin + tradeStats.grossLossAbs)
      : null;
  const periodReturn = analytics?.twrReturn ?? analytics?.totalReturn ?? null;
  const sparkValues = periodSeries.map((point) => point.value);
  const heroValue =
    scrubPoint?.value ??
    (filteredSeries.length > 0 ? filteredSeries[filteredSeries.length - 1].value : null);
  const deltaTone =
    changeToneFromSigned(periodDelta?.usd) !== 'neutral'
      ? changeToneFromSigned(periodDelta?.usd)
      : changeToneFromSigned(periodDelta?.pct);
  const deltaColor = changeToneColor(deltaTone, tokens);
  const positive = tokens.colors.primary.main;
  const negative = tokens.colors.text.danger;
  const neutral = tokens.colors.text.secondary;

  return (
    <View style={styles.root}>
      {showTip && !isColmex ? (
        <View style={styles.tipsBanner}>
          <Ionicons name="bulb" size={20} color={tokens.colors.text.warning} />
          <Text style={styles.tipsText}>
            התיק עוד ריק – הוסף הפקדה ופתח פוזיציה ראשונה כדי לראות שווי ופילוח.
          </Text>
        </View>
      ) : null}

      {/* Performance chart — כותרת סקשן זהה בטעינה/טעון; בגרף רק amount→delta */}
      <UICard variant="soft" padding="md" style={styles.section}>
        <Text style={styles.valueLabel}>שווי תיק:</Text>
        {heroValue != null ? (
          <AnimatedNumber
            text={toDataIsland(formatCurrency(heroValue, portfolio.currency))}
            value={heroValue}
            flash
            animate={!scrubPoint}
            style={styles.heroValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          />
        ) : null}
        {scrubPoint ? (
          <Text style={[styles.deltaFigure, styles.deltaRow, { color: tokens.colors.text.secondary }]}>
            {toDataIsland(scrubPoint.date.split('-').reverse().join('.'))}
          </Text>
        ) : periodDelta ? (
          <View style={styles.deltaRow}>
            <AnimatedNumber
              text={toDataIsland(formatCongressDeltaUsd(periodDelta.usd))}
              value={periodDelta.usd}
              style={[styles.deltaFigure, { color: deltaColor }]}
              numberOfLines={1}
            />
            <View style={[styles.deltaDot, { backgroundColor: deltaColor }]} />
            <AnimatedNumber
              text={toDataIsland(formatSignedChangePct(periodDelta.pct))}
              value={periodDelta.pct}
              style={[styles.deltaFigure, { color: deltaColor }]}
              numberOfLines={1}
            />
          </View>
        ) : null}
        {chartLoading ? (
          <Text style={styles.emptyText}>טוען נתונים…</Text>
        ) : filteredSeries.length === 0 ? (
          <Text style={styles.emptyText}>
            {isColmex
              ? 'אין נקודת שווי עדיין — משוך לסנכרון מהברוקר'
              : openTrades.length > 0
                ? 'טוען שווי תיק…'
                : 'אין נתונים היסטוריים עדיין — פתח פוזיציה או הוסף הפקדה'}
          </Text>
        ) : (
          <PortfolioValueChart
            series={filteredSeries}
            currency={portfolio.currency}
            selectedPeriod={period}
            onPeriodChange={setPeriod}
            showHeader={false}
            onScrubPoint={setScrubPoint}
          />
        )}
      </UICard>

      {/* Distribution */}
      <UICard variant="soft" padding="md" style={styles.section}>
        <Text style={styles.sectionTitle}>חלוקת נכסים</Text>
        <View style={styles.groupChips}>
          {GROUP_BY_OPTIONS.map((opt) => (
            <DayDividerPill
              key={opt.id}
              selected={groupBy === opt.id}
              onPress={() => {
                if (groupBy !== opt.id) void HapticFeedback.selection();
                setGroupBy(opt.id);
              }}
              style={styles.groupChip}
              accessibilityLabel={opt.label}
            >
              {opt.label}
            </DayDividerPill>
          ))}
        </View>
        {distribution.length === 0 ? (
          <Text style={styles.emptyText}>
            {openTrades.length > 0
              ? 'טוען פילוח…'
              : 'פתח פוזיציה כדי לראות פילוח נכסים'}
          </Text>
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

      {(analytics != null || tradeStats.count > 0) && (
        <View style={styles.metricSection}>
          <Text style={styles.metricSectionLabel}>מדדי ביצוע</Text>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.metricRow}
          >
            {tradeStats.count > 0 ? (
              <PerformanceMetricCard
                label="P&L נטו"
                value={`${netPnl >= 0 ? '+' : ''}${formatCurrency(netPnl, portfolio.currency)}`}
                valueColor={gainColor(netPnl, positive, negative, neutral)}
                hint={
                  tradeStats.count === 1
                    ? 'עסקה סגורה אחת'
                    : `${tradeStats.count} עסקאות סגורות`
                }
                styles={styles}
              />
            ) : null}
            {tradeStats.count > 0 ? (
              <PerformanceMetricCard
                label="פקטור רווח"
                value={
                  profitFactor != null
                    ? profitFactor.toFixed(2)
                    : tradeStats.grossWin > 0
                    ? '∞'
                    : '—'
                }
                valueColor={
                  profitFactor == null
                    ? tradeStats.grossWin > 0
                      ? positive
                      : neutral
                    : profitFactor >= 1
                    ? positive
                    : negative
                }
                hint="רווח גולמי ÷ הפסד גולמי"
                visual={
                  profitShare != null ? (
                    <SplitRing greenShare={profitShare} green={positive} red={negative} track={tokens.colors.border.divider} />
                  ) : null
                }
                styles={styles}
              />
            ) : null}
            {tradeStats.winRate != null ? (
              <PerformanceMetricCard
                label="אחוז הצלחה"
                value={`${tradeStats.winRate.toFixed(1)}%`}
                valueColor={tradeStats.winRate >= 50 ? positive : tokens.colors.text.primary}
                hint={
                  tradeStats.avgWin != null && tradeStats.avgLoss != null
                    ? `ממוצע ${formatCurrency(tradeStats.avgWin, portfolio.currency)} / ${formatCurrency(tradeStats.avgLoss, portfolio.currency)}`
                    : undefined
                }
                visual={
                  <WinGauge
                    winRatio={tradeStats.winRate / 100}
                    green={positive}
                    red={negative}
                    track={tokens.colors.border.divider}
                  />
                }
                styles={styles}
              />
            ) : null}
            {periodReturn != null ? (
              <PerformanceMetricCard
                label="תשואה"
                value={formatPercent(periodReturn * 100)}
                valueColor={gainColor(periodReturn, positive, negative, neutral)}
                hint={analytics?.twrReturn != null ? 'מנורמל להפקדות' : undefined}
                visual={
                  sparkValues.length >= 2 ? (
                    <Sparkline values={sparkValues} color={gainColor(periodReturn, positive, negative, neutral)} />
                  ) : null
                }
                styles={styles}
              />
            ) : null}
            {analytics?.maxDrawdown != null ? (
              <PerformanceMetricCard
                label="ירידה מקסימלית"
                value={formatPercent(analytics.maxDrawdown * 100, 1, false)}
                valueColor={analytics.maxDrawdown > 0.2 ? negative : tokens.colors.text.primary}
                styles={styles}
              />
            ) : null}
            {analytics?.sharpe != null ? (
              <PerformanceMetricCard
                label="Sharpe"
                value={analytics.sharpe.toFixed(2)}
                valueColor={
                  analytics.sharpe >= 1 ? positive : analytics.sharpe >= 0 ? tokens.colors.text.primary : negative
                }
                hint="מצטבר על התקופה"
                visual={
                  sharpePath.length >= 2 ? (
                    <Sparkline
                      values={sharpePath}
                      color={
                        analytics.sharpe >= 1
                          ? positive
                          : analytics.sharpe >= 0
                            ? tokens.colors.text.primary
                            : negative
                      }
                      baseline={0}
                      baselineColor={tokens.colors.border.divider}
                    />
                  ) : null
                }
                styles={styles}
              />
            ) : null}
            {analytics?.volatility != null ? (
              <PerformanceMetricCard
                label="תנודתיות שנתית"
                value={formatPercent(analytics.volatility * 100, 1)}
                valueColor={tokens.colors.text.primary}
                styles={styles}
              />
            ) : null}
          </ScrollView>
        </View>
      )}

      {/* Cash flow summary */}
      <UICard variant="soft" padding="md" style={styles.section}>
        <Text style={styles.sectionTitle}>תזרים</Text>
        <View style={styles.cashList}>
          {(
            [
              ['הפקדות', summary ? formatCurrency(summary.total_deposits, portfolio.currency) : '—'],
              ['משיכות', summary ? formatCurrency(summary.total_withdrawals, portfolio.currency) : '—'],
              ['עמלות', summary ? formatCurrency(summary.total_fees, portfolio.currency) : '—'],
              ['דיבידנדים', summary ? formatCurrency(summary.total_dividends, portfolio.currency) : '—'],
            ] as const
          ).map(([label, value], index, lines) => (
            <View
              key={label}
              style={[styles.cashLine, index === lines.length - 1 && styles.cashLineLast]}
            >
              <Text style={styles.cashValue} numberOfLines={1}>
                {value}
              </Text>
              <Text style={styles.cashLabel} numberOfLines={1}>
                {label}
              </Text>
            </View>
          ))}
        </View>
      </UICard>
    </View>
  );
}

function SplitRing({
  greenShare,
  green,
  red,
  track,
}: {
  greenShare: number;
  green: string;
  red: string;
  track: string;
}) {
  const size = 54;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const clamped = Math.min(1, Math.max(0, greenShare));
  const gap = clamped > 0.04 && clamped < 0.96 ? 0.06 : 0;
  const greenFrac = Math.max(0, clamped - gap / 2);
  const redFrac = Math.max(0, 1 - clamped - gap / 2);
  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cx} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      {greenFrac > 0 ? (
        <Circle
          cx={cx}
          cy={cx}
          r={r}
          stroke={green}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${greenFrac * c} ${c}`}
          transform={`rotate(-90 ${cx} ${cx})`}
        />
      ) : null}
      {redFrac > 0 ? (
        <Circle
          cx={cx}
          cy={cx}
          r={r}
          stroke={red}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${redFrac * c} ${c}`}
          strokeDashoffset={-((greenFrac + gap) * c)}
          transform={`rotate(-90 ${cx} ${cx})`}
        />
      ) : null}
    </Svg>
  );
}

function WinGauge({
  winRatio,
  green,
  red,
  track,
}: {
  winRatio: number;
  green: string;
  red: string;
  track: string;
}) {
  const width = 68;
  const stroke = 6;
  const r = (width - stroke) / 2;
  const cx = width / 2;
  const cy = r + stroke / 2;
  const height = cy + stroke / 2;
  const semi = Math.PI * r;
  const full = semi * 2;
  const clamped = Math.min(1, Math.max(0, winRatio));
  const gap = clamped > 0.04 && clamped < 0.96 ? 3 : 0;
  const lossLen = Math.max(0, semi * (1 - clamped) - gap / 2);
  const winLen = Math.max(0, semi * clamped - gap / 2);
  const lossSweep = (1 - clamped) * 180;
  return (
    <Svg width={width} height={height}>
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        stroke={track}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={`${semi} ${full}`}
        strokeLinecap="round"
        transform={`rotate(180 ${cx} ${cy})`}
      />
      {lossLen > 0 ? (
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={red}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${lossLen} ${full}`}
          strokeLinecap="round"
          transform={`rotate(180 ${cx} ${cy})`}
        />
      ) : null}
      {winLen > 0 ? (
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={green}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${winLen} ${full}`}
          strokeLinecap="round"
          transform={`rotate(${180 + lossSweep} ${cx} ${cy})`}
        />
      ) : null}
    </Svg>
  );
}

function Sparkline({
  values,
  color,
  baseline,
  baselineColor,
}: {
  values: number[];
  color: string;
  baseline?: number;
  baselineColor?: string;
}) {
  const width = 64;
  const height = 36;
  const nums = values.filter((v) => Number.isFinite(v));
  if (nums.length < 2) return null;
  const plotted = nums.length > 32 ? sampleSeries(nums, 32) : nums;
  let min = Math.min(...plotted);
  let max = Math.max(...plotted);
  if (baseline != null && Number.isFinite(baseline)) {
    min = Math.min(min, baseline);
    max = Math.max(max, baseline);
  }
  const span = max - min || 1;
  const yOf = (v: number) => height - 2 - ((v - min) / span) * (height - 4);
  const d = plotted
    .map((v, i) => {
      const x = (i / (plotted.length - 1)) * width;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${yOf(v).toFixed(1)}`;
    })
    .join(' ');
  const baseY = baseline != null && Number.isFinite(baseline) ? yOf(baseline) : null;
  return (
    <Svg width={width} height={height}>
      {baseY != null && baselineColor ? (
        <Line
          x1={0}
          y1={baseY}
          x2={width}
          y2={baseY}
          stroke={baselineColor}
          strokeWidth={1}
        />
      ) : null}
      <Path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

/** שומר את הנקודה האחרונה — היא שווה למספר שמוצג בכרטיס. */
function sampleSeries(values: number[], max: number): number[] {
  if (values.length <= max) return values;
  const out: number[] = [];
  const step = (values.length - 1) / (max - 1);
  for (let i = 0; i < max - 1; i++) out.push(values[Math.round(i * step)]);
  out.push(values[values.length - 1]);
  return out;
}

function PerformanceMetricCard({
  label,
  value,
  valueColor,
  hint,
  visual,
  styles,
}: {
  label: string;
  value: string;
  valueColor: string;
  hint?: string;
  visual?: React.ReactNode;
  styles: {
    metricCard: object;
    metricCardInner: object;
    metricVisual: object;
    metricText: object;
    metricLabel: object;
    metricValue: object;
    metricHint: object;
  };
}) {
  return (
    <UICard variant="soft" padding="md" style={styles.metricCard}>
      <View style={styles.metricCardInner}>
        {visual ? <View style={styles.metricVisual}>{visual}</View> : null}
        <View style={styles.metricText}>
          <Text style={styles.metricLabel} numberOfLines={2}>
            {label}
          </Text>
          <Text
            style={[styles.metricValue, { color: valueColor }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {value}
          </Text>
          {hint ? (
            <Text style={styles.metricHint} numberOfLines={2}>
              {hint}
            </Text>
          ) : null}
        </View>
      </View>
    </UICard>
  );
}
