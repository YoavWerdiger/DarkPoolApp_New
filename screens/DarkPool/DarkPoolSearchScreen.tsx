/**
 * טיקרים — כניסה ישירה לדף מניה (מחזיקים · פיד) בלי לעבור דרך עסקה.
 * שדה חיפוש (Finnhub, אותו מנוע כמו בתיקים) · מסילת «חם אצל אינסיידרים» · אחרונים.
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
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { LIGHT_CANVAS } from '../../components/ui/designTokensStatic';
import { formFieldShellStyle } from '../../components/ui/formControl';
import { ListItemSkeleton } from '../../components/ui/SkeletonLoader';
import { useDarkPoolTabBarHeight } from '../../hooks/useDarkPoolTabBarHeight';
import { useCongressFeed } from '../../hooks/useCongressFeed';
import { useDarkPoolInsiderFeed } from '../../hooks/useDarkPoolInsiderFeed';
import {
  getQuotes,
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
import { EXPLORE_RAIL_GAP } from './utils/exploreGrid';
import { toDataIsland } from './utils/bidi';

const RECENTS_KEY = 'darkpool:recent_tickers';
const RECENTS_MAX = 8;
const HOT_DAYS = 7;
const HOT_MAX = 12;
const HOT_CARD_W = 128;

type Recent = { ticker: string; name: string | null };
type HotTicker = { ticker: string; trades: number; quote: PriceQuote | null };

async function loadRecents(): Promise<Recent[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENTS_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(list)) return [];
    // תאימות לאחור: גרסה קודמת שמרה מחרוזות בלבד
    return list
      .map((x): Recent | null =>
        typeof x === 'string'
          ? { ticker: x, name: null }
          : x && typeof x.ticker === 'string'
            ? { ticker: x.ticker, name: typeof x.name === 'string' ? x.name : null }
            : null,
      )
      .filter((x): x is Recent => !!x);
  } catch {
    return [];
  }
}

function dayChangePct(q: PriceQuote | null | undefined): number | null {
  if (!q || !q.previous_close || !isFinite(q.price)) return null;
  return ((q.price - q.previous_close) / q.previous_close) * 100;
}

function fmtPct(pct: number): string {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
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
  const [recents, setRecents] = useState<Recent[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // אותם קאשים כמו בפיד — בלי בקשות כפולות
  const congress = useCongressFeed(DARK_POOL_FEED_LIMIT, true);
  const insiders = useDarkPoolInsiderFeed({ tab: 'all', limit: DARK_POOL_FEED_LIMIT, enabled: true });

  useEffect(() => {
    void loadRecents().then(setRecents);
  }, []);

  const recentSymbols = useMemo(() => recents.map((r) => r.ticker), [recents]);
  const recentQuotes = useQuery({
    queryKey: ['darkpool-recent-quotes', recentSymbols.join('|')],
    queryFn: () => getQuotes(recentSymbols),
    enabled: recentSymbols.length > 0,
    staleTime: 30_000,
  });

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

  const hot = useMemo<HotTicker[]>(() => {
    const cutoff = Date.now() - HOT_DAYS * 86_400_000;
    const map = new Map<string, HotTicker>();
    const bump = (ticker: string | null | undefined, at: string | null | undefined, quote: PriceQuote | null) => {
      const t = (ticker ?? '').trim().toUpperCase();
      if (!t) return;
      const ts = at ? Date.parse(at) : NaN;
      if (isFinite(ts) && ts < cutoff) return;
      const row = map.get(t) ?? { ticker: t, trades: 0, quote: null };
      row.trades += 1;
      if (!row.quote && quote) row.quote = quote;
      map.set(t, row);
    };
    for (const it of congress.trades) bump(it.trade.ticker, it.trade.filed_at, it.quote);
    for (const it of insiders.trades) bump(it.trade.ticker, it.trade.filed_at, it.quote);
    return Array.from(map.values())
      .sort((a, b) => b.trades - a.trades)
      .slice(0, HOT_MAX);
  }, [congress.trades, insiders.trades]);

  const hotLoading =
    (congress.loading && congress.trades.length === 0) ||
    (insiders.loading && insiders.trades.length === 0);

  const openTicker = useCallback(
    (raw: string, name?: string | null) => {
      const ticker = raw.trim().toUpperCase();
      if (!ticker) return;
      void HapticFeedback.selection();
      Keyboard.dismiss();
      setRecents((prev) => {
        const keepName = name ?? prev.find((r) => r.ticker === ticker)?.name ?? null;
        const next = [{ ticker, name: keepName }, ...prev.filter((r) => r.ticker !== ticker)].slice(0, RECENTS_MAX);
        void AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next)).catch(() => undefined);
        return next;
      });
      stackNav.navigate('DarkPoolTicker', { ticker, tab: 'holders' });
    },
    [stackNav],
  );

  const clearRecents = useCallback(() => {
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
        // מסילה ברוחב מלא — הכרטיסים נכנסים מקצה המסך
        rail: {
          marginHorizontal: -APP_LAYOUT.screenPaddingHorizontal,
        },
        railRow: {
          direction: 'rtl',
          flexDirection: 'row',
          gap: EXPLORE_RAIL_GAP,
          paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
        },
        hotCard: {
          width: HOT_CARD_W,
          borderRadius: UI_CARD_RADIUS,
          backgroundColor: tokens.colors.background.cardSolid,
          padding: APP_LAYOUT.cardPadding,
          alignItems: 'flex-start',
        },
        hotTicker: {
          ...darkPoolPhysicalRightText,
          alignSelf: 'stretch',
          marginTop: APP_LAYOUT.cardTitleToBodyGap,
          fontSize: DARK_POOL_TYPE.cardTitle.fontSize,
          lineHeight: DARK_POOL_TYPE.cardTitle.lineHeight,
          fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
          color: tokens.colors.text.primary,
        },
        hotChange: {
          ...darkPoolPhysicalRightText,
          alignSelf: 'stretch',
          marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
          fontSize: DARK_POOL_TYPE.cardSubtitle.fontSize,
          lineHeight: DARK_POOL_TYPE.cardSubtitle.lineHeight,
          fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
          fontVariant: ['tabular-nums'],
        },
        hotCount: {
          ...darkPoolPhysicalRightText,
          alignSelf: 'stretch',
          marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
          fontSize: DARK_POOL_TYPE.caption.fontSize,
          lineHeight: DARK_POOL_TYPE.caption.lineHeight,
          fontWeight: DARK_POOL_TYPE.caption.fontWeight,
          color: tokens.colors.text.secondary,
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
          fontSize: DARK_POOL_TYPE.cardSubtitle.fontSize,
          lineHeight: DARK_POOL_TYPE.cardSubtitle.lineHeight,
          fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
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

  const changeColor = (pct: number | null) =>
    pct == null
      ? tokens.colors.text.secondary
      : pct >= 0
        ? tokens.colors.primary.main
        : tokens.colors.danger.main;

  const renderTickerRow = (
    key: string,
    ticker: string,
    subtitle: string | null,
    quote: PriceQuote | null | undefined,
    onPress: () => void,
    last: boolean,
  ) => {
    const pct = dayChangePct(quote);
    return (
      <View key={key}>
        <Pressable onPress={onPress} style={styles.row}>
          <TickerLogo symbol={ticker} size={40} borderRadius={20} />
          <View style={styles.iconTextGap} />
          <View style={styles.textCol}>
            <Text style={styles.title} numberOfLines={1}>
              {toDataIsland(ticker)}
            </Text>
            {subtitle ? (
              <Text style={styles.sub} numberOfLines={1}>
                {toDataIsland(subtitle)}
              </Text>
            ) : null}
          </View>
          {quote ? (
            <View style={styles.side}>
              <Text style={styles.price}>{toDataIsland(`$${quote.price.toFixed(2)}`)}</Text>
              {pct != null ? (
                <Text style={[styles.change, { color: changeColor(pct) }]}>{toDataIsland(fmtPct(pct))}</Text>
              ) : null}
            </View>
          ) : (
            <Ionicons name="chevron-back" size={18} color={tokens.colors.text.tertiary} />
          )}
        </Pressable>
        {!last ? <View style={styles.divider} /> : null}
      </View>
    );
  };

  const showResults = query.trim().length > 0;

  return (
    <ScreenChrome rtl>
      <SafeAreaView style={[darkPoolTransparentFill, darkPoolRtlContent]} edges={['top']}>
        <MainDrawerScreenHeader inRtlTree title="טיקרים" onMenuPress={openDrawer} />
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
              onSubmitEditing={() => openTicker(results[0]?.symbol ?? query, results[0]?.description)}
              placeholder="חפש מניה: NVDA, Apple…"
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
                {results.map((r, i) =>
                  renderTickerRow(
                    r.symbol,
                    r.display_symbol || r.symbol,
                    r.description,
                    null,
                    () => openTicker(r.symbol, r.description),
                    i === results.length - 1,
                  ),
                )}
              </UICard>
            )
          ) : (
            <>
              <View style={styles.section}>
                <DarkPoolSectionHeader title="חם אצל אינסיידרים" />
                {hotLoading ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rail} contentContainerStyle={styles.railRow}>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <View key={i} style={[styles.hotCard, { height: 148, opacity: 0.6 }]} />
                    ))}
                  </ScrollView>
                ) : hot.length === 0 ? (
                  <Text style={styles.emptyText}>אין עדיין פעילות השבוע.</Text>
                ) : (
                  <ScrollView
                    horizontal
                    nestedScrollEnabled
                    directionalLockEnabled
                    showsHorizontalScrollIndicator={false}
                    style={styles.rail}
                    contentContainerStyle={styles.railRow}
                  >
                    {hot.map((h) => {
                      const pct = dayChangePct(h.quote);
                      return (
                        <Pressable
                          key={h.ticker}
                          onPress={() => openTicker(h.ticker)}
                          style={styles.hotCard}
                          accessibilityLabel={`${h.ticker}, ${h.trades} עסקאות השבוע`}
                        >
                          <TickerLogo symbol={h.ticker} size={40} borderRadius={20} />
                          <Text style={styles.hotTicker} numberOfLines={1}>
                            {toDataIsland(h.ticker)}
                          </Text>
                          {pct != null ? (
                            <Text style={[styles.hotChange, { color: changeColor(pct) }]}>
                              {toDataIsland(fmtPct(pct))}
                            </Text>
                          ) : null}
                          <Text style={styles.hotCount}>
                            {h.trades === 1 ? 'עסקה אחת' : `${h.trades} עסקאות`}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              {recents.length > 0 ? (
                <View style={styles.section}>
                  <DarkPoolSectionHeader title="אחרונים" actionLabel="נקה" onActionPress={clearRecents} />
                  <UICard {...CHROME_UICARD} style={styles.card}>
                    {recents.map((r, i) =>
                      renderTickerRow(
                        r.ticker,
                        r.ticker,
                        r.name,
                        recentQuotes.data?.get(r.ticker) ?? null,
                        () => openTicker(r.ticker, r.name),
                        i === recents.length - 1,
                      ),
                    )}
                  </UICard>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenChrome>
  );
}
