/**
 * חיפוש — כניסה ישירה לדף מניה (מחזיקים · פיד) בלי לעבור דרך עסקה.
 * שדה חיפוש (Finnhub, אותו מנוע כמו בתיקים) · חיפושים אחרונים · הכי פעילות השבוע · מהווצ׳ליסט.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import { MainDrawerScreenHeader } from '../../components/ui/MainDrawerScreenHeader';
import UICard from '../../components/ui/UICard';
import { CHROME_UICARD } from '../../components/ui/chromeControl';
import { DayDividerPill } from '../../components/ui/DayDividerPill';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { LIGHT_CANVAS } from '../../components/ui/designTokensStatic';
import { formFieldShellStyle } from '../../components/ui/formControl';
import { ListItemSkeleton } from '../../components/ui/SkeletonLoader';
import { useDarkPoolTabBarHeight } from '../../hooks/useDarkPoolTabBarHeight';
import { useCongressFeed } from '../../hooks/useCongressFeed';
import { useDarkPoolInsiderFeed } from '../../hooks/useDarkPoolInsiderFeed';
import { appQueryKeys } from '../../lib/appQueryKeys';
import { listWatchlistItems, listWatchlists } from '../../services/watchlist/watchlistService';
import {
  searchSymbols,
  type SymbolSearchResult,
} from '../../services/portfolios/portfolioPriceFeed';
import type { PriceQuote } from '../Portfolios/portfolioTypes';
import { TickerLogo } from '../Portfolios/components/TickerLogo';
import { DARK_POOL_FEED_LIMIT } from '../../types/darkpool.types';
import {
  dispatchOpenMainDrawer,
  type DrawerParentNavigation,
} from '../../navigation/mainDrawerNav';
import { HapticFeedback, triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';
import { useDarkPoolStackNav } from './hooks/useDarkPoolStackNav';
import {
  DARK_POOL_TYPE,
  darkPoolPhysicalLeftText,
  darkPoolPhysicalRightText,
  darkPoolRtlContent,
  darkPoolTransparentFill,
} from './darkPoolLayout';
import { DarkPoolSectionHeader } from './components/DarkPoolSectionHeader';
import { toDataIsland } from './utils/bidi';

const RECENTS_KEY = 'darkpool:recent_tickers';
const RECENTS_MAX = 10;
const ACTIVE_DAYS = 7;
const ACTIVE_MAX = 8;

type ActiveTicker = {
  ticker: string;
  company: string | null;
  trades: number;
  buys: number;
  sells: number;
  quote: PriceQuote | null;
};

async function loadRecents(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENTS_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function dayChangePct(q: PriceQuote | null): number | null {
  if (!q || !q.previous_close || !isFinite(q.price)) return null;
  return ((q.price - q.previous_close) / q.previous_close) * 100;
}

export default function DarkPoolSearchScreen() {
  const tokens = useDesignTokens();
  const drawerNav = useNavigation();
  const stackNav = useDarkPoolStackNav();
  const bottomPad = useDarkPoolTabBarHeight();

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // אותם קאשים כמו בפיד — בלי בקשות כפולות
  const congress = useCongressFeed(DARK_POOL_FEED_LIMIT, true);
  const insiders = useDarkPoolInsiderFeed({ tab: 'all', limit: DARK_POOL_FEED_LIMIT, enabled: true });

  const listsQuery = useQuery({
    queryKey: appQueryKeys.watchlists,
    queryFn: listWatchlists,
    staleTime: 60_000,
  });
  const defaultListId = useMemo(() => {
    const lists = listsQuery.data ?? [];
    return (lists.find((w) => w.is_default) ?? lists[0])?.id ?? null;
  }, [listsQuery.data]);
  const watchItemsQuery = useQuery({
    queryKey: appQueryKeys.watchlistItems(defaultListId ?? ''),
    queryFn: () => listWatchlistItems(defaultListId!),
    enabled: !!defaultListId,
    staleTime: 30_000,
  });
  const watchSymbols = useMemo(
    () => Array.from(new Set((watchItemsQuery.data ?? []).map((i) => i.symbol))).slice(0, 20),
    [watchItemsQuery.data],
  );

  useEffect(() => {
    void loadRecents().then(setRecents);
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try {
        setResults(await searchSymbols(q));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  const activeTickers = useMemo<ActiveTicker[]>(() => {
    const cutoff = Date.now() - ACTIVE_DAYS * 86_400_000;
    const map = new Map<string, ActiveTicker>();
    const bump = (
      ticker: string | null | undefined,
      company: string | null | undefined,
      side: 'buy' | 'sell' | null,
      at: string | null | undefined,
      quote: PriceQuote | null,
    ) => {
      const t = (ticker ?? '').trim().toUpperCase();
      if (!t) return;
      const ts = at ? Date.parse(at) : NaN;
      if (isFinite(ts) && ts < cutoff) return;
      const row = map.get(t) ?? { ticker: t, company: company ?? null, trades: 0, buys: 0, sells: 0, quote: null };
      row.trades += 1;
      if (side === 'buy') row.buys += 1;
      if (side === 'sell') row.sells += 1;
      if (!row.company && company) row.company = company;
      if (!row.quote && quote) row.quote = quote;
      map.set(t, row);
    };
    for (const it of congress.trades) {
      bump(it.trade.ticker, it.trade.company_name, it.trade.transaction_type, it.trade.filed_at, it.quote);
    }
    for (const it of insiders.trades) {
      const tt = it.trade.transaction_type;
      bump(it.trade.ticker, it.trade.company_name, tt === 'P' ? 'buy' : tt === 'S' ? 'sell' : null, it.trade.filed_at, it.quote);
    }
    return Array.from(map.values())
      .sort((a, b) => b.trades - a.trades || b.buys - a.buys)
      .slice(0, ACTIVE_MAX);
  }, [congress.trades, insiders.trades]);

  const feedLoading =
    (congress.loading && congress.trades.length === 0) ||
    (insiders.loading && insiders.trades.length === 0);

  const openTicker = useCallback(
    (raw: string) => {
      const ticker = raw.trim().toUpperCase();
      if (!ticker) return;
      void HapticFeedback.selection();
      Keyboard.dismiss();
      setRecents((prev) => {
        const next = [ticker, ...prev.filter((t) => t !== ticker)].slice(0, RECENTS_MAX);
        void AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next)).catch(() => undefined);
        return next;
      });
      stackNav.navigate('DarkPoolTicker', { ticker, tab: 'holders' });
    },
    [stackNav],
  );

  const clearRecents = useCallback(() => {
    void HapticFeedback.selection();
    setRecents([]);
    void AsyncStorage.removeItem(RECENTS_KEY).catch(() => undefined);
  }, []);

  const openDrawer = useCallback(() => {
    void triggerDrawerMenuHaptic();
    try {
      dispatchOpenMainDrawer(drawerNav as unknown as DrawerParentNavigation);
    } catch {
      /* noop */
    }
  }, [drawerNav]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: {
          direction: 'rtl',
          paddingBottom: bottomPad,
          paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
        },
        // בתוך עץ rtl — row (לא row-reverse): הילד הראשון בימין
        searchInner: {
          direction: 'rtl',
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 52,
          paddingHorizontal: 16,
          gap: APP_LAYOUT.stackGapSmall,
          borderRadius: tokens.borderRadius.search,
          marginBottom: APP_LAYOUT.sectionGap,
          ...formFieldShellStyle({ tokens, focused, multiline: false }),
        },
        searchInput: {
          ...DARK_POOL_TYPE.body,
          ...darkPoolPhysicalRightText,
          flex: 1,
          color: tokens.colors.text.primary,
          padding: 0,
        },
        section: {
          marginBottom: APP_LAYOUT.sectionGap,
        },
        pills: {
          direction: 'rtl',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        card: {
          borderRadius: UI_CARD_RADIUS,
          overflow: 'hidden',
          backgroundColor: tokens.colors.background.cardSolid,
          borderWidth: 0,
          ...tokens.shadows.none,
        },
        row: {
          direction: 'rtl',
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: APP_LAYOUT.cardTitleToBodyGap,
          paddingHorizontal: APP_LAYOUT.cardPadding,
        },
        iconTextGap: {
          width: APP_LAYOUT.cardTitleToBodyGap,
          flexShrink: 0,
        },
        divider: {
          height: 1,
          backgroundColor: tokens.colors.border.divider,
          marginHorizontal: APP_LAYOUT.cardPadding,
          alignSelf: 'stretch',
        },
        textCol: { flex: 1, minWidth: 0, alignItems: 'stretch' },
        title: {
          ...darkPoolPhysicalRightText,
          width: '100%',
          fontSize: DARK_POOL_TYPE.cardTitle.fontSize,
          lineHeight: DARK_POOL_TYPE.cardTitle.lineHeight,
          fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
          color: tokens.colors.text.primary,
        },
        sub: {
          ...darkPoolPhysicalRightText,
          width: '100%',
          marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
          fontSize: DARK_POOL_TYPE.cardSubtitle.fontSize,
          lineHeight: DARK_POOL_TYPE.cardSubtitle.lineHeight,
          fontWeight: DARK_POOL_TYPE.cardSubtitle.fontWeight,
          color: tokens.colors.text.secondary,
        },
        side: {
          alignItems: 'flex-end',
          marginStart: APP_LAYOUT.cardTitleToBodyGap,
        },
        price: {
          ...darkPoolPhysicalLeftText,
          fontSize: DARK_POOL_TYPE.cardTitle.fontSize,
          lineHeight: DARK_POOL_TYPE.cardTitle.lineHeight,
          fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
          color: tokens.colors.text.primary,
          fontVariant: ['tabular-nums'],
        },
        change: {
          ...darkPoolPhysicalLeftText,
          marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
          fontSize: DARK_POOL_TYPE.caption.fontSize,
          lineHeight: DARK_POOL_TYPE.caption.lineHeight,
          fontWeight: DARK_POOL_TYPE.caption.fontWeight,
          fontVariant: ['tabular-nums'],
        },
        emptyText: {
          ...darkPoolPhysicalRightText,
          fontSize: DARK_POOL_TYPE.body.fontSize,
          lineHeight: DARK_POOL_TYPE.body.lineHeight,
          color: tokens.colors.text.secondary,
        },
      }),
    [tokens, focused, bottomPad],
  );

  const showResults = query.trim().length > 0;

  return (
    <ScreenChrome rtl>
      <SafeAreaView style={[darkPoolTransparentFill, darkPoolRtlContent]} edges={['top']}>
        <MainDrawerScreenHeader
          inRtlTree
          title="חיפוש"
          subtitle="מחזיקים ועסקאות לפי מניה"
          onMenuPress={openDrawer}
        />
        <ScrollView
          style={darkPoolTransparentFill}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.searchInner}>
            <Ionicons name="search" size={18} color={tokens.colors.text.secondary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSubmitEditing={() => openTicker(results[0]?.symbol ?? query)}
              placeholder="טיקר או שם חברה"
              placeholderTextColor={tokens.colors.text.tertiary}
              keyboardAppearance={(tokens.colors.background.primary as string) === LIGHT_CANVAS ? 'light' : 'dark'}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="חיפוש מניה"
            />
            {query ? (
              <Pressable
                onPress={() => {
                  void HapticFeedback.selection();
                  setQuery('');
                }}
                hitSlop={10}
                accessibilityLabel="נקה חיפוש"
              >
                <Ionicons name="close-circle" size={18} color={tokens.colors.text.secondary} />
              </Pressable>
            ) : null}
          </View>

          {showResults ? (
            searching && results.length === 0 ? (
              <UICard {...CHROME_UICARD} style={styles.card}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <ListItemSkeleton key={i} showAvatar />
                ))}
              </UICard>
            ) : results.length === 0 ? (
              <Text style={styles.emptyText}>
                לא נמצאו מניות. נסו סימבול אמריקאי (AAPL) או שם באנגלית.
              </Text>
            ) : (
              <UICard {...CHROME_UICARD} style={styles.card}>
                {results.map((r, i) => (
                  <View key={r.symbol}>
                    <Pressable onPress={() => openTicker(r.symbol)} style={styles.row}>
                      <TickerLogo symbol={r.symbol} size={40} borderRadius={20} />
                      <View style={styles.iconTextGap} />
                      <View style={styles.textCol}>
                        <Text style={styles.title} numberOfLines={1}>
                          {toDataIsland(r.display_symbol || r.symbol)}
                        </Text>
                        <Text style={styles.sub} numberOfLines={1}>
                          {toDataIsland(r.description)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-back" size={18} color={tokens.colors.text.tertiary} />
                    </Pressable>
                    {i < results.length - 1 ? <View style={styles.divider} /> : null}
                  </View>
                ))}
              </UICard>
            )
          ) : (
            <>
              {recents.length > 0 ? (
                <View style={styles.section}>
                  <DarkPoolSectionHeader
                    title="חיפושים אחרונים"
                    actionLabel="נקה"
                    onActionPress={clearRecents}
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
                    {recents.map((t) => (
                      <DayDividerPill key={t} onPress={() => openTicker(t)} accessibilityLabel={t}>
                        {toDataIsland(t)}
                      </DayDividerPill>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              <View style={styles.section}>
                <DarkPoolSectionHeader
                  title="הכי פעילות השבוע"
                  subtitle="מניות עם הכי הרבה עסקאות של פוליטיקאים ובכירים"
                />
                {feedLoading ? (
                  <UICard {...CHROME_UICARD} style={styles.card}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <ListItemSkeleton key={i} showAvatar />
                    ))}
                  </UICard>
                ) : activeTickers.length === 0 ? (
                  <Text style={styles.emptyText}>אין עדיין פעילות השבוע.</Text>
                ) : (
                  <UICard {...CHROME_UICARD} style={styles.card}>
                    {activeTickers.map((row, i) => {
                      const pct = dayChangePct(row.quote);
                      const pctColor =
                        pct == null
                          ? tokens.colors.text.secondary
                          : pct >= 0
                            ? tokens.colors.primary.main
                            : tokens.colors.danger.main;
                      const parts = [`${row.trades} עסקאות`];
                      if (row.buys) parts.push(`${row.buys} קניות`);
                      if (row.sells) parts.push(`${row.sells} מכירות`);
                      return (
                        <View key={row.ticker}>
                          <Pressable onPress={() => openTicker(row.ticker)} style={styles.row}>
                            <TickerLogo symbol={row.ticker} size={40} borderRadius={20} />
                            <View style={styles.iconTextGap} />
                            <View style={styles.textCol}>
                              <Text style={styles.title} numberOfLines={1}>
                                {toDataIsland(row.ticker)}
                              </Text>
                              <Text style={styles.sub} numberOfLines={1}>
                                {parts.join(' · ')}
                              </Text>
                            </View>
                            {row.quote ? (
                              <View style={styles.side}>
                                <Text style={styles.price}>{toDataIsland(`$${row.quote.price.toFixed(2)}`)}</Text>
                                {pct != null ? (
                                  <Text style={[styles.change, { color: pctColor }]}>
                                    {toDataIsland(`${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`)}
                                  </Text>
                                ) : null}
                              </View>
                            ) : null}
                          </Pressable>
                          {i < activeTickers.length - 1 ? <View style={styles.divider} /> : null}
                        </View>
                      );
                    })}
                  </UICard>
                )}
              </View>

              {watchSymbols.length > 0 ? (
                <View style={styles.section}>
                  <DarkPoolSectionHeader title="מהווצ׳ליסט שלך" />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
                    {watchSymbols.map((t) => (
                      <DayDividerPill key={t} onPress={() => openTicker(t)} accessibilityLabel={t}>
                        {toDataIsland(t)}
                      </DayDividerPill>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenChrome>
  );
}
