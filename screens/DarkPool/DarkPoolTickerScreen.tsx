/**
 * מסך טיקר — InsiderWave IA: הדר זהות / מחיר+שווי שוק / גרף / מחזיקים|פיד.
 * עברית RTL. בלי כוכב. מחזיקים = CurrentHolding / Allocation.
 * קירוב מניות מתחת לשווי = CurrentHolding ÷ מחיר חי בלבד.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import UICard from '../../components/ui/UICard';
import { DayDividerPill, SlidingPillGroup } from '../../components/ui/DayDividerPill';
import { SignedChangePair } from '../../components/ui/ChangeDot';
import { MotionNumber } from '../../components/ui/MotionNumber';
import { settingsButtonLabelStyle } from '../../components/profile/settingsType';
import { DayNavBlurButton, HEADER_BACK_BTN_SIZE } from '../../components/ui/DayNavBlurButton';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { TickerLogo } from '../Portfolios/components/TickerLogo';
import { PortfolioValueChart } from '../Portfolios/components/PortfolioValueChart';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { prefetchPersonPortfolio } from '../../services/darkpool/prefetchPersonPortfolio';
import { useUwTickerInsights } from '../../hooks/useUwTickerInsights';
import { appQueryKeys } from '../../lib/appQueryKeys';
import { HapticFeedback } from '../../utils/hapticFeedback';
import type { DarkPoolStackParamList } from '../../navigation/DarkPoolStack';
import { InvestorPortrait } from './components/InvestorPortrait';
import { CongressTradeCard } from './components/CongressTradeCard';
import { InsiderTradeCard } from './components/InsiderTradeCard';
import {
  listCongressHoldingsByTicker,
  listCongressTradesByTicker,
} from '../../services/darkpool/darkPoolDbCacheService';
import { getTickerInsiderBuys } from '../../services/darkpool/darkPoolService';
import { getHistoricalPrices, getQuote } from '../../services/portfolios/portfolioPriceFeed';
import { fetchDailyBarsForTickers } from './utils/congressTradeOpens';
import { ltrNameText, toDataIsland } from './utils/bidi';
import {
  buildTickerChartSeries,
  formatTickerAbsChange,
  formatTickerLivePrice,
  formatTickerPctChange,
  TICKER_CHART_RANGES,
  tickerChangeTone,
  tickerDisplayedChange,
  tickerHistoryStaleMs,
  yahooFallbackDailyFor1D,
  yahooRequestForTickerRange,
  tickerRangeToSamplePeriod,
  type TickerChartRange,
  type TickerClosePoint,
} from './utils/tickerChart';
import { sampleChartSeriesForPeriod } from './utils/profileChartSeries';
import {
  tickerHolderRowCopy,
  tickerHoldersEmptyCopy,
  tickerHoldersErrorCopy,
  type TickerCongressHolder,
} from './utils/tickerCongressHolders';
import {
  formatTickerMarketCap,
  resolveTickerScreenTab,
  tickerFeedEmptyCopy,
  tickerMarketCapLabel,
  tickerScreenFeedTabLabel,
  tickerScreenHoldersTabLabel,
  type TickerScreenTab,
} from './utils/tickerScreenIa';
import { buildCongressFeedItem } from './utils/congressFeedCalc';
import { buildFeedItem } from './utils/insiderFeedCalc';
import { congressTradeDetailParams, insiderTradeDetailParams } from './utils/tradeDetailParams';
import type { PriceQuote } from '../Portfolios/portfolioTypes';
import {
  DARK_POOL_TYPE,
  darkPoolPhysicalLeftText,
  darkPoolPhysicalRightText,
  darkPoolRtlContent,
  darkPoolTransparentFill,
} from './darkPoolLayout';

type Nav = NativeStackNavigationProp<DarkPoolStackParamList, 'DarkPoolTicker'>;
type RP = RouteProp<DarkPoolStackParamList, 'DarkPoolTicker'>;

type TickerFeedRow =
  | {
      kind: 'congress';
      key: string;
      sortAt: number;
      item: ReturnType<typeof buildCongressFeedItem>;
    }
  | {
      kind: 'insider';
      key: string;
      sortAt: number;
      item: ReturnType<typeof buildFeedItem>;
    };

export default function DarkPoolTickerScreen() {
  const tokens = useDesignTokens();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RP>();
  const mainTabsHeight = useMainTabsHeight();
  const ticker = (route.params?.ticker || '').toUpperCase().replace(/^\$/, '');
  const [range, setRange] = useState<TickerChartRange>('1Y');
  const [tab, setTab] = useState<TickerScreenTab>(() => resolveTickerScreenTab(route.params?.tab));
  // טאבים מחזיקים/פיד — כמו בורר «לפי הבחירה שלי / הכול» בהגדרות ההתראות:
  // מיקום כל טאב נמדד (onLayout) והרקע מחליק אליו; צבע התווית מתחלף ברכות
  const tabXs = useSharedValue<Record<string, number>>({});
  const thumbX = useSharedValue(0);
  const tabEmphasis = useSharedValue(tab === 'holders' ? 0 : 1);
  const [thumbWidth, setThumbWidth] = useState(0);
  const tabsReadyRef = React.useRef(false);
  const TAB_SLIDE = { duration: 280, easing: Easing.out(Easing.cubic) };
  useEffect(() => {
    tabEmphasis.value = withTiming(tab === 'holders' ? 0 : 1, TAB_SLIDE);
    const x = tabXs.value[tab];
    if (tabsReadyRef.current && x != null) thumbX.value = withTiming(x, TAB_SLIDE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  const onTabLayout = (id: TickerScreenTab) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    if (width <= 0) return;
    tabXs.value = { ...tabXs.value, [id]: x };
    setThumbWidth((prev) => (Math.abs(prev - width) < 0.5 ? prev : width));
    if (id === tab) {
      thumbX.value = x;
      tabsReadyRef.current = true;
    }
  };
  const tabThumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: thumbX.value }] }));
  const holdersLabelStyle = useAnimatedStyle(
    () => ({ color: interpolateColor(tabEmphasis.value, [0, 1], [tokens.colors.text.primary, tokens.colors.text.secondary]) }),
    [tokens.colors.text.primary, tokens.colors.text.secondary]
  );
  const feedLabelStyle = useAnimatedStyle(
    () => ({ color: interpolateColor(tabEmphasis.value, [0, 1], [tokens.colors.text.secondary, tokens.colors.text.primary]) }),
    [tokens.colors.text.primary, tokens.colors.text.secondary]
  );
  // ערך הגרירה ב-UI thread — למחיר המתגלגל
  const scrubValueSV = useSharedValue(0);
  const scrubActiveSV = useSharedValue(0);
  const [scrubPoint, setScrubPoint] = useState<{
    date: string;
    value: number;
  } | null>(null);

  const { data: insights } = useUwTickerInsights(ticker);

  const quoteQuery = useQuery({
    queryKey: appQueryKeys.tickerQuote(ticker),
    queryFn: () => getQuote(ticker),
    enabled: ticker.length > 0,
    staleTime: 60_000,
  });

  const historySpec = useMemo(() => {
    if (range === '1D') return yahooFallbackDailyFor1D();
    return yahooRequestForTickerRange(range);
  }, [range]);
  const historyQuery = useQuery({
    queryKey: appQueryKeys.tickerHistory(ticker, historySpec.yahooRange, historySpec.interval),
    queryFn: () =>
      getHistoricalPrices(ticker, historySpec.yahooRange, {
        interval: historySpec.interval,
      }),
    enabled: ticker.length > 0 && range !== '1D',
    staleTime: tickerHistoryStaleMs(historySpec.interval),
    gcTime: 24 * 60 * 60_000,
  });

  const needsSessionBars = historySpec.interval === '1d' || range === '1D';
  const sessionQuery = useQuery({
    queryKey: appQueryKeys.tickerHistory(ticker, '1d', '1h'),
    queryFn: () => getHistoricalPrices(ticker, '1d', { interval: '1h' }),
    enabled: ticker.length > 0 && needsSessionBars,
    staleTime: tickerHistoryStaleMs('1h'),
    gcTime: 30 * 60_000,
  });

  const intraSpec = yahooRequestForTickerRange('1D');
  const intradayQuery = useQuery({
    queryKey: appQueryKeys.tickerHistory(ticker, intraSpec.yahooRange, intraSpec.interval),
    queryFn: () =>
      getHistoricalPrices(ticker, intraSpec.yahooRange, {
        interval: intraSpec.interval,
      }),
    enabled: ticker.length > 0 && range === '1D',
    staleTime: tickerHistoryStaleMs('5m'),
    gcTime: 30 * 60_000,
  });

  const holdersQuery = useQuery({
    queryKey: appQueryKeys.congressHoldingsByTicker(ticker),
    queryFn: () => listCongressHoldingsByTicker(ticker),
    enabled: ticker.length > 0,
    staleTime: 10 * 60_000,
  });

  const congressTradesQuery = useQuery({
    queryKey: appQueryKeys.congressTradesByTicker(ticker),
    queryFn: () => listCongressTradesByTicker(ticker, 40),
    enabled: ticker.length > 0 && tab === 'feed',
    staleTime: 5 * 60_000,
  });

  const congressDailyBarsQuery = useQuery({
    queryKey: appQueryKeys.congressTickerDailyBars(ticker),
    queryFn: async () => {
      const map = await fetchDailyBarsForTickers([ticker], '5y');
      return map.get(ticker) ?? [];
    },
    enabled: ticker.length > 0 && tab === 'feed' && (congressTradesQuery.data?.length ?? 0) > 0,
    staleTime: 60 * 60_000,
  });

  const insiderBuysQuery = useQuery({
    queryKey: appQueryKeys.tickerInsiderBuys(ticker),
    queryFn: () => getTickerInsiderBuys(ticker, 90),
    enabled: ticker.length > 0,
    staleTime: 5 * 60_000,
  });

  const daily: TickerClosePoint[] = useMemo(
    () =>
      (historyQuery.data ?? []).map((p) => ({
        date: p.date,
        close: p.close,
      })),
    [historyQuery.data],
  );
  const intraday: TickerClosePoint[] = useMemo(
    () =>
      (intradayQuery.data ?? []).map((p) => ({
        date: p.date,
        close: p.close,
      })),
    [intradayQuery.data],
  );
  const sessionBars: TickerClosePoint[] = useMemo(
    () =>
      (sessionQuery.data ?? []).map((p) => ({
        date: p.date,
        close: p.close,
      })),
    [sessionQuery.data],
  );

  const livePrice = quoteQuery.data?.price ?? null;
  const previousClose = quoteQuery.data?.previous_close ?? null;
  const marketCapText = formatTickerMarketCap(
    quoteQuery.data?.market_cap ?? insiderBuysQuery.data?.[0]?.marketcap ?? null,
  );

  const visibleRanges = TICKER_CHART_RANGES;

  useEffect(() => {
    setTab(resolveTickerScreenTab(route.params?.tab));
  }, [route.params?.tab]);

  useEffect(() => {
    setScrubPoint(null);
  }, [range, ticker]);

  const chartSeries = useMemo(() => {
    const built = buildTickerChartSeries({
      daily,
      range,
      livePrice,
      previousClose,
      intraday,
      sessionBars,
    });
    return sampleChartSeriesForPeriod(
      built.map((p) => ({ date: p.date, value: p.value })),
      tickerRangeToSamplePeriod(range),
    );
  }, [daily, range, livePrice, previousClose, intraday, sessionBars]);

  const displayPrice = scrubPoint?.value ?? livePrice;
  const rangeChange = useMemo(
    () =>
      tickerDisplayedChange({
        range,
        endPrice: displayPrice,
        previousClose,
        daily,
      }),
    [range, displayPrice, previousClose, daily],
  );
  const priceText = formatTickerLivePrice(displayPrice) ?? '—';

  const holders = useMemo(
    () => (holdersQuery.data ?? []).filter((holder) => tickerHolderRowCopy(holder)),
    [holdersQuery.data],
  );
  const holdersEmpty = useMemo(() => tickerHoldersEmptyCopy(ticker), [ticker]);
  const holdersError = tickerHoldersErrorCopy();
  const feedEmpty = useMemo(() => tickerFeedEmptyCopy(ticker), [ticker]);

  const quoteMap = useMemo(() => {
    const map = new Map<string, PriceQuote>();
    if (quoteQuery.data) map.set(ticker, quoteQuery.data);
    return map;
  }, [quoteQuery.data, ticker]);

  const congressDailyBars = useMemo(() => {
    const bars = congressDailyBarsQuery.data;
    if (!bars?.length) return undefined;
    return new Map([[ticker, bars]]);
  }, [congressDailyBarsQuery.data, ticker]);

  const feedRows = useMemo((): TickerFeedRow[] => {
    const rows: TickerFeedRow[] = [];
    (congressTradesQuery.data ?? []).forEach((trade, index) => {
      rows.push({
        kind: 'congress',
        key: `c:${trade.id}:${trade.filed_at}:${index}`,
        sortAt: Date.parse(trade.filed_at || trade.transaction_date || '') || 0,
        item: buildCongressFeedItem(trade, quoteMap, congressDailyBars),
      });
    });
    (insiderBuysQuery.data ?? []).forEach((trade) => {
      rows.push({
        kind: 'insider',
        key: `i:${trade.source}-${trade.id}`,
        sortAt: Date.parse(trade.filed_at || trade.transaction_date || '') || 0,
        item: buildFeedItem(trade, quoteMap),
      });
    });
    rows.sort((a, b) => b.sortAt - a.sortAt);
    return rows;
  }, [congressTradesQuery.data, insiderBuysQuery.data, quoteMap, congressDailyBars]);

  const styles = useMemo(() => createStyles(tokens, mainTabsHeight), [tokens, mainTabsHeight]);

  const companyName =
    insights?.form4_company?.name?.trim() ||
    insiderBuysQuery.data?.find((b) => b.company_name?.trim())?.company_name?.trim() ||
    congressTradesQuery.data?.find((t) => t.company_name?.trim())?.company_name?.trim() ||
    null;

  const changeTone = tickerChangeTone(rangeChange.pct);

  const openHolder = useCallback(
    (holder: TickerCongressHolder) => {
      void HapticFeedback.impactLight();
      prefetchPersonPortfolio({
        id: holder.bioguideId,
        kind: 'politician',
        ticker,
        nameHint: holder.name,
      });
      navigation.navigate('DarkPoolInvestor', {
        id: holder.bioguideId,
        kind: 'politician',
        ticker,
        nameHint: holder.name,
        imageHint: holder.imageUrl,
      });
    },
    [navigation, ticker],
  );

  const openPolitician = useCallback(
    (politicianId: string, name?: string, image?: string | null) => {
      prefetchPersonPortfolio({
        id: politicianId,
        kind: 'politician',
        ticker,
        nameHint: name,
      });
      navigation.navigate('DarkPoolInvestor', {
        id: politicianId,
        kind: 'politician',
        ticker,
        nameHint: name,
        imageHint: image,
      });
    },
    [navigation, ticker],
  );

  const openInsider = useCallback(
    (personId: string, name: string) => {
      prefetchPersonPortfolio({
        id: personId,
        kind: 'insider',
        ticker,
        nameHint: name,
      });
      navigation.navigate('DarkPoolInvestor', {
        id: personId,
        kind: 'insider',
        ticker,
        nameHint: name,
      });
    },
    [navigation, ticker],
  );

  const feedLoading =
    tab === 'feed' &&
    ((congressTradesQuery.isLoading && !congressTradesQuery.data) ||
      (insiderBuysQuery.isLoading && !insiderBuysQuery.data));

  return (
    <ScreenChrome rtl>
      <SafeAreaView style={[darkPoolTransparentFill, darkPoolRtlContent]} edges={['top']}>
        <View style={styles.topBar}>
          <DayNavBlurButton
            onPress={() => {
              navigation.goBack();
            }}
            glassIntensity="subtle"
            size={HEADER_BACK_BTN_SIZE}
            accessibilityLabel="חזרה"
          >
            <Ionicons name="chevron-forward" size={22} color={tokens.colors.text.primary} />
          </DayNavBlurButton>
        </View>

        <ScrollView
          style={darkPoolTransparentFill}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroBlock}>
            <View style={styles.priceRow}>
              <View style={styles.priceCol}>
                {/* אותו מספר מתגלגל כמו בפרופיל (MotionNumber): ב-UI thread, ספרה מסיימת מעבר
                    ורק אז ממשיכה לערך העדכני של הסמן — בלי רינדור React בכל נקודה */}
                {livePrice != null ? (
                  <MotionNumber
                    scrubValue={scrubValueSV}
                    scrubActive={scrubActiveSV}
                    value={livePrice}
                    decimals={2}
                    style={styles.livePrice}
                    upColor={tokens.colors.primary.main}
                    downColor={tokens.colors.text.danger}
                  />
                ) : (
                  <Text style={styles.livePrice}>{toDataIsland(priceText)}</Text>
                )}
                {rangeChange.abs != null && rangeChange.pct != null ? (
                  <SignedChangePair
                    tone={changeTone}
                    style={styles.liveChangeRow}
                    textStyle={styles.liveChange}
                    isolate={toDataIsland}
                    absText={formatTickerAbsChange(rangeChange.abs)}
                    pctText={formatTickerPctChange(rangeChange.pct)}
                  />
                ) : (
                  <Text style={[styles.liveChange, { color: tokens.colors.text.secondary }]}>
                    —
                  </Text>
                )}
              </View>
              <View style={styles.identityRow}>
                <TickerLogo symbol={ticker} size={48} borderRadius={24} />
                <View style={styles.identityText}>
                  <Text style={styles.identityTicker} numberOfLines={1}>
                    {toDataIsland(ticker)}
                  </Text>
                  {companyName ? (
                    <Text style={styles.companyName} numberOfLines={1}>
                      {companyName}
                    </Text>
                  ) : null}
                  {marketCapText ? (
                    <Text style={styles.marketCapLine} numberOfLines={1}>
                      {`${tickerMarketCapLabel()} `}
                      <Text style={styles.marketCapValue}>{toDataIsland(marketCapText)}</Text>
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          </View>

          {chartSeries.length >= 2 ? (
            <View style={styles.chartWrap}>
              <PortfolioValueChart
                series={chartSeries}
                height={200}
                currency="USD"
                selectedPeriod="All"
                showHeader={false}
                showIntervalSelector={false}
                formatValue={(value) => formatTickerLivePrice(value) ?? '—'}
                onScrubPoint={setScrubPoint}
                scrubValue={scrubValueSV}
                scrubActive={scrubActiveSV}
              />
            </View>
          ) : historyQuery.isLoading ? (
            <View style={styles.chartPlaceholder}>
              <ActivityIndicator color={tokens.colors.primary.main} />
            </View>
          ) : null}

          {visibleRanges.length > 0 ? (
            <SlidingPillGroup
              scroll
              options={visibleRanges.map((id) => ({ id, label: id }))}
              value={range}
              onChange={setRange}
              contentContainerStyle={styles.chipRow}
              accessibilityLabelFor={(o) => `טווח ${o.label}`}
            />
          ) : null}

          <View style={styles.tablist} accessibilityRole="tablist">
            <View style={styles.tabInner}>
              <Animated.View
                pointerEvents="none"
                style={[styles.tabThumb, { width: thumbWidth, opacity: thumbWidth > 0 ? 1 : 0 }, tabThumbStyle]}
              />
              {(
                [
                  { id: 'holders' as const, label: tickerScreenHoldersTabLabel(holders.length), labelStyle: holdersLabelStyle },
                  { id: 'feed' as const, label: tickerScreenFeedTabLabel(), labelStyle: feedLabelStyle },
                ] as const
              ).map((item) => {
                const active = tab === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onLayout={onTabLayout(item.id)}
                    onPress={() => {
                      if (active) return;
                      void HapticFeedback.selection();
                      setTab(item.id);
                    }}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={item.label}
                    style={styles.tabBtn}
                  >
                    <Animated.Text numberOfLines={1} style={[styles.tabLabel, item.labelStyle]}>
                      {item.label}
                    </Animated.Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {tab === 'holders' ? (
            <View style={styles.holdersSection}>
              {holdersQuery.isLoading ? (
                <View style={styles.listLoading}>
                  <ActivityIndicator color={tokens.colors.primary.main} />
                </View>
              ) : holdersQuery.isError ? (
                <UICard variant="soft" glassIntensity="light" padding="md">
                  <Text style={styles.emptyTitle}>{holdersError.title}</Text>
                  <Text style={styles.emptyBody}>{holdersError.body}</Text>
                </UICard>
              ) : holders.length > 0 ? (
                <UICard
                  variant="soft"
                  glassIntensity="light"
                  padding="none"
                  style={styles.holdersCard}
                >
                  {holders.map((holder, index) => {
                    const row = tickerHolderRowCopy(holder, livePrice);
                    if (!row) return null;
                    return (
                      <React.Fragment key={holder.bioguideId}>
                        {index > 0 ? <View style={styles.holderDivider} /> : null}
                        <Pressable
                          onPress={() => openHolder(holder)}
                          // ריפוד על ה-View הפנימי — סטייל-פונקציה של Pressable לא תמיד מוחל
                          style={({ pressed }) => (pressed ? styles.holderPressed : undefined)}
                          accessibilityRole="button"
                          accessibilityLabel={
                            row.sharesLabel
                              ? `${holder.name} ${row.metric.text} ${row.sharesLabel}`
                              : `${holder.name} ${row.metric.text}`
                          }
                        >
                          <View style={[styles.holderRow, styles.holderPad]}>
                            <InvestorPortrait
                              name={holder.name}
                              imageUrl={holder.imageUrl}
                              kind="politician"
                              personId={holder.bioguideId}
                              layout="circle"
                              size={36}
                            />
                            <View style={styles.holderText}>
                              <Text style={styles.holderName} numberOfLines={1}>
                                {holder.name}
                              </Text>
                              {row.subtitle ? (
                                <Text style={styles.holderSubtitle}>
                                  {toDataIsland(row.subtitle)}
                                </Text>
                              ) : null}
                            </View>
                            <View style={styles.holderMetricCol}>
                              <Text style={styles.holderMetric}>
                                {toDataIsland(row.metric.text)}
                              </Text>
                              {row.sharesLabel ? (
                                <Text style={styles.holderShares}>
                                  {toDataIsland(row.sharesLabel)}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        </Pressable>
                      </React.Fragment>
                    );
                  })}
                </UICard>
              ) : (
                <UICard variant="soft" glassIntensity="light" padding="md">
                  <Text style={styles.emptyTitle}>{holdersEmpty.title}</Text>
                  <Text style={styles.emptyBody}>{holdersEmpty.body}</Text>
                </UICard>
              )}
            </View>
          ) : feedLoading ? (
            <View style={styles.listLoading}>
              <ActivityIndicator color={tokens.colors.primary.main} />
            </View>
          ) : feedRows.length > 0 ? (
            <View style={styles.feedSection}>
              {feedRows.map((row) =>
                row.kind === 'congress' ? (
                  <CongressTradeCard
                    key={row.key}
                    item={row.item}
                    onPersonPress={(pid) => {
                      const t = row.item.trade;
                      openPolitician(pid, t.politician_name, t.politician_image_url);
                    }}
                    onDetailPress={() =>
                      navigation.navigate(
                        'DarkPoolTradeDetail',
                        congressTradeDetailParams(row.item.trade),
                      )
                    }
                  />
                ) : (
                  <InsiderTradeCard
                    key={row.key}
                    item={row.item}
                    onPersonPress={(personId, name) => openInsider(personId, name)}
                    onDetailPress={() =>
                      navigation.navigate(
                        'DarkPoolTradeDetail',
                        insiderTradeDetailParams(row.item.trade),
                      )
                    }
                  />
                ),
              )}
            </View>
          ) : (
            <UICard variant="soft" glassIntensity="light" padding="md">
              <Text style={styles.emptyTitle}>{feedEmpty.title}</Text>
              <Text style={styles.emptyBody}>{feedEmpty.body}</Text>
            </UICard>
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenChrome>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>, bottomPadding: number) {
  return StyleSheet.create({
    topBar: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      gap: APP_LAYOUT.cardTitleToBodyGap,
      paddingHorizontal: tokens.layout.screenPadding,
      paddingTop: 10,
      paddingBottom: APP_LAYOUT.stackGapSmall,
    },
    identityRow: {
      flex: 1,
      minWidth: 0,
      direction: 'ltr',
      flexDirection: 'row',
      alignItems: 'center',
      gap: APP_LAYOUT.cardTitleToBodyGap,
    },
    identityText: {
      flex: 1,
      minWidth: 0,
      alignItems: 'flex-start',
    },
    identityTicker: {
      fontSize: DARK_POOL_TYPE.sectionTitle.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.sectionTitle.lineHeight,
      fontWeight: DARK_POOL_TYPE.sectionTitle.fontWeight,
      letterSpacing: DARK_POOL_TYPE.sectionTitle.letterSpacing,
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
      textAlign: 'left',
    },
    companyName: {
      ...darkPoolPhysicalLeftText,
      marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
      fontSize: DARK_POOL_TYPE.cardSubtitle.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.cardSubtitle.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardSubtitle.fontWeight,
      color: tokens.colors.text.secondary,
    },
    heroBlock: {
      marginBottom: APP_LAYOUT.componentGap,
    },
    priceRow: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: APP_LAYOUT.componentGap,
    },
    priceCol: {
      flexShrink: 0,
      alignItems: 'flex-start',
    },
    livePrice: {
      ...darkPoolPhysicalRightText,
      fontSize: DARK_POOL_TYPE.pageTitle.fontSize,
      lineHeight: DARK_POOL_TYPE.pageTitle.lineHeight,
      fontWeight: DARK_POOL_TYPE.pageTitle.fontWeight,
      letterSpacing: DARK_POOL_TYPE.pageTitle.letterSpacing,
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
      fontVariant: ['tabular-nums'],
    },
    liveChangeRow: {
      marginTop: APP_LAYOUT.cardMetricLabelToValueGap,
      alignSelf: 'flex-start',
    },
    liveChange: {
      ...darkPoolPhysicalRightText,
      fontSize: DARK_POOL_TYPE.cardBody.fontSize,
      lineHeight: DARK_POOL_TYPE.cardBody.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      writingDirection: 'ltr',
      fontVariant: ['tabular-nums'],
    },
    scrubDate: {
      ...darkPoolPhysicalRightText,
      marginTop: APP_LAYOUT.cardMetricLabelToValueGap,
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.caption.lineHeight,
      fontWeight: DARK_POOL_TYPE.caption.fontWeight,
      color: tokens.colors.text.secondary,
    },
    marketCapLine: {
      ...darkPoolPhysicalLeftText,
      writingDirection: 'rtl',
      marginTop: APP_LAYOUT.cardMetricLabelToValueGap,
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.caption.lineHeight,
      fontWeight: DARK_POOL_TYPE.caption.fontWeight,
      color: tokens.colors.text.secondary,
    },
    marketCapValue: {
      fontWeight: DARK_POOL_TYPE.cardMetricLabel.fontWeight,
      color: tokens.colors.text.primary,
      fontVariant: ['tabular-nums'],
    },
    chartWrap: {
      marginTop: APP_LAYOUT.stackGapSmall,
      marginHorizontal: -4,
    },
    chartPlaceholder: {
      height: 200,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipRow: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      gap: APP_LAYOUT.stackGapSmall,
      paddingVertical: APP_LAYOUT.cardTitleToBodyGap,
    },
    // כמו SettingsScopeChoice (הגדרות התראות): מסילה tertiary, רקע פעיל cardSolid, עיגול מלא
    tablist: {
      borderRadius: tokens.borderRadius.full,
      padding: 3,
      overflow: 'hidden',
      backgroundColor: tokens.colors.background.tertiary,
      marginTop: APP_LAYOUT.stackGapSmall,
      marginBottom: APP_LAYOUT.componentGap,
    },
    tabInner: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    tabBtn: {
      flex: 1,
      zIndex: 1,
      paddingVertical: 8,
      paddingHorizontal: APP_LAYOUT.stackGapSmall,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabThumb: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      borderRadius: tokens.borderRadius.full,
      backgroundColor: tokens.colors.background.cardSolid,
    },
    tabLabel: {
      ...settingsButtonLabelStyle,
      fontVariant: ['tabular-nums'],
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    holdersSection: {
      marginBottom: APP_LAYOUT.componentGap,
    },
    holdersCard: {
      overflow: 'hidden',
    },
    // שורת רשימה לפי הטופו — 15 אנכי, ריפוד כרטיס אופקי
    holderPad: {
      paddingVertical: 15,
      paddingHorizontal: APP_LAYOUT.cardPadding,
    },
    holderPressed: {
      opacity: 0.7,
    },
    holderDivider: {
      height: 1,
      marginHorizontal: APP_LAYOUT.cardPadding,
      backgroundColor: tokens.colors.border.divider,
    },
    holderRow: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      gap: APP_LAYOUT.cardTitleToBodyGap,
    },
    holderText: {
      flex: 1,
      minWidth: 0,
    },
    holderName: {
      ...ltrNameText,
      fontSize: DARK_POOL_TYPE.cardBody.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.cardBody.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
    },
    holderSubtitle: {
      ...darkPoolPhysicalRightText,
      marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
      fontSize: DARK_POOL_TYPE.cardSubtitle.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.cardSubtitle.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardSubtitle.fontWeight,
      color: tokens.colors.text.secondary,
    },
    holderMetricCol: {
      alignItems: 'flex-end',
    },
    holderMetric: {
      ...darkPoolPhysicalLeftText,
      fontSize: DARK_POOL_TYPE.cardBody.fontSize,
      lineHeight: DARK_POOL_TYPE.cardBody.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
      fontVariant: ['tabular-nums'],
    },
    holderShares: {
      ...darkPoolPhysicalLeftText,
      marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.caption.lineHeight,
      fontWeight: DARK_POOL_TYPE.caption.fontWeight,
      color: tokens.colors.text.secondary,
    },
    feedSection: {
      marginBottom: APP_LAYOUT.componentGap,
    },
    emptyTitle: {
      ...darkPoolPhysicalRightText,
      fontSize: DARK_POOL_TYPE.cardTitle.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.cardTitle.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
      marginBottom: APP_LAYOUT.cardTitleToSubtitleGap,
    },
    emptyBody: {
      ...darkPoolPhysicalRightText,
      fontSize: DARK_POOL_TYPE.cardSubtitle.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.cardSubtitle.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardSubtitle.fontWeight,
      color: tokens.colors.text.secondary,
    },
    listLoading: {
      paddingVertical: 20,
      alignItems: 'center',
    },
    scrollContent: {
      direction: 'rtl',
      paddingHorizontal: tokens.layout.screenPadding,
      paddingTop: APP_LAYOUT.stackGapSmall,
      paddingBottom: bottomPadding + 32,
    },
  });
}
