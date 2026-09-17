/**
 * פרטי עסקת קונגרס.
 *
 * מה שמוצג כאן מוגבל למה שדיווח STOCK Act באמת מכיל: נכס, סוג עסקה,
 * שני תאריכים, וטווח סכום. אין מספר חוזים, אין strike, אין תאריך פקיעה,
 * אין מחיר לחוזה, אין שווי מדויק ואין משקל בתיק — הדיווח לא מכיל אותם,
 * וכל מספר כזה היה נגזרת שלנו שמוצגת כעובדה.
 *
 * "תשואה מאז העסקה" מגיעה מ-Quiver (`ExcessReturn` / `PriceChange` / `SPYChange`)
 * ולא משחזור מקומי. כשאין ערך — לא מוצג דבר, ולא 0.
 */

import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { appQueryKeys } from '../../lib/appQueryKeys';
import { listCongressTradesForPersonTicker } from '../../services/darkpool/darkPoolDbCacheService';
import type { CongressFeedTrade } from '../../services/darkpool/uwCongressFeedService';
import { getQuotes } from '../../services/portfolios/portfolioPriceFeed';
import type { DarkPoolStackParamList } from '../../navigation/DarkPoolStack';
import { InsiderAvatar } from './components/InsiderAvatar';
import { TickerLogo } from '../Portfolios/components/TickerLogo';
import { DarkPoolSectionHeader } from './components/DarkPoolSectionHeader';
import { QuiverAttribution } from './components/QuiverAttribution';
import { hebrewText, toDataIsland } from './utils/bidi';
import {
  DARK_POOL_UNAVAILABLE,
  buildDualDateLine,
  formatDisclosedAmountRange,
  formatDisclosureDelay,
  formatReturnPct,
  formatTradeDate,
  orUnavailable,
  returnTone,
} from './utils/congressTradeDisplay';
import {
  formatFeedTickerDisplay,
  getFeedTradeSide,
  getFeedTradeVerb,
} from './utils/feedTradeDisplay';

type Nav = NativeStackNavigationProp<DarkPoolStackParamList, 'DarkPoolTradeDetail'>;
type RP = RouteProp<DarkPoolStackParamList, 'DarkPoolTradeDetail'>;

export default function DarkPoolTradeDetailScreen() {
  const tokens = useDesignTokens();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RP>();
  const bottomPad = useMainTabsHeight();
  const styles = useMemo(() => createStyles(tokens, bottomPad), [tokens, bottomPad]);

  const trade = route.params?.trade;
  const ticker = (trade?.ticker ?? '').toUpperCase();

  const side = getFeedTradeSide(trade?.transaction_type ?? 'buy');
  const verb = getFeedTradeVerb(side);
  const sideColor =
    side === 'buy' ? tokens.colors.primary.main : tokens.colors.text.danger;
  const tickerSym = formatFeedTickerDisplay(ticker);

  const dates = useMemo(
    () =>
      buildDualDateLine({
        filedAt: trade?.filed_at,
        transactionDate: trade?.transaction_date,
      }),
    [trade?.filed_at, trade?.transaction_date]
  );

  const quoteQuery = useQuery({
    queryKey: ['darkpool', 'trade-detail-quote', ticker],
    queryFn: async () => (await getQuotes([ticker])).get(ticker) ?? null,
    enabled: ticker.length > 0,
    staleTime: 60_000,
  });

  const historyQuery = useQuery({
    queryKey: appQueryKeys.congressPersonTickerTrades(
      trade?.politician_id ?? '',
      ticker
    ),
    queryFn: () => listCongressTradesForPersonTicker(trade!.politician_id, ticker),
    enabled: Boolean(trade?.politician_id) && ticker.length > 0,
    staleTime: 5 * 60_000,
  });

  const openPerson = useCallback(() => {
    if (!trade?.politician_id) return;
    void HapticFeedback.impactLight();
    navigation.navigate('DarkPoolInvestor', {
      id: trade.politician_id,
      kind: 'politician',
      nameHint: trade.politician_name,
      imageHint: trade.politician_image_url,
    });
  }, [navigation, trade]);

  if (!trade) {
    return (
      <ScreenChrome rtl>
        <StatusBar style="light" />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>העסקה לא נמצאה</Text>
          </View>
        </SafeAreaView>
      </ScreenChrome>
    );
  }

  const currentPrice = quoteQuery.data?.price ?? null;
  const priceText =
    currentPrice != null && Number.isFinite(currentPrice) && currentPrice > 0
      ? `$${currentPrice.toFixed(2)}`
      : null;

  const amountRange = formatDisclosedAmountRange(trade.amount_label);
  const delay = formatDisclosureDelay(trade.filed_at, trade.transaction_date);

  const otherTrades = (historyQuery.data ?? []).filter((t) => t.id !== trade.id);

  return (
    <ScreenChrome rtl>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => {
              void HapticFeedback.impactLight();
              navigation.goBack();
            }}
            style={styles.iconBtn}
            hitSlop={12}
            accessibilityLabel="חזרה"
          >
            <Ionicons
              name="chevron-forward"
              size={22}
              color={tokens.colors.text.primary}
            />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* כותרת — אדם, פעולה, טיקר, שני התאריכים */}
          <UICard variant="glass" glassIntensity="medium" padding="lg" style={styles.card}>
            <Pressable
              onPress={openPerson}
              style={styles.personRow}
              accessibilityRole="button"
              accessibilityLabel={`פרופיל ${trade.politician_name}`}
            >
              <InsiderAvatar
                name={trade.politician_name}
                logoUrl={trade.politician_image_url}
                size={52}
              />
              <View style={styles.personText}>
                <Text style={styles.personName} numberOfLines={2} ellipsizeMode="tail">
                  {trade.politician_name}
                </Text>
                <Text style={styles.personHint} numberOfLines={1}>
                  קונגרס · לצפייה בפרופיל
                </Text>
              </View>
              <Ionicons
                name="chevron-back"
                size={18}
                color={tokens.colors.text.tertiary}
              />
            </Pressable>

            <Text style={styles.action} numberOfLines={3} ellipsizeMode="tail">
              <Text style={{ color: sideColor, fontWeight: '800' }}>{verb} את </Text>
              <Text style={styles.actionTicker}>{toDataIsland(tickerSym)}</Text>
            </Text>
            {trade.company_name ? (
              <Text style={styles.company} numberOfLines={2} ellipsizeMode="tail">
                {trade.company_name}
              </Text>
            ) : null}

            {dates.text ? (
              <View style={styles.dateChips}>
                {dates.disclosed ? (
                  <Text style={styles.dateChip}>{dates.disclosed}</Text>
                ) : null}
                {dates.traded ? (
                  <Text style={styles.dateChip}>{dates.traded}</Text>
                ) : null}
              </View>
            ) : null}
          </UICard>

          {/* מחיר נוכחי + שינוי מאז יום העסקה */}
          <UICard variant="glass" glassIntensity="light" padding="md" style={styles.card}>
            <View style={styles.priceRow}>
              <View style={styles.priceStart}>
                <TickerLogo symbol={ticker} size={34} borderRadius={17} />
                <View style={styles.priceTexts}>
                  <Text style={styles.priceTicker}>{toDataIsland(tickerSym)}</Text>
                  <Text style={styles.priceCaption}>מחיר נוכחי</Text>
                </View>
              </View>
              <View style={styles.priceEnd}>
                {quoteQuery.isLoading && !priceText ? (
                  <ActivityIndicator
                    size="small"
                    color={tokens.colors.text.tertiary}
                  />
                ) : (
                  <Text style={styles.priceValue}>
                    {priceText ? toDataIsland(priceText) : DARK_POOL_UNAVAILABLE}
                  </Text>
                )}
                <ReturnLine
                  label="מאז העסקה"
                  pct={trade.price_change_pct}
                  compact
                />
              </View>
            </View>
          </UICard>

          {/* טבלת פרטי העסקה — שדות מדווחים בלבד */}
          <View style={styles.section}>
            <DarkPoolSectionHeader
              title="פרטי העסקה"
              subtitle="כפי שדווח לפי חוק STOCK Act"
              icon="document-text-outline"
            />
            <UICard variant="glass" glassIntensity="light" padding="md">
              <DetailRow label="פעולה" value={trade.txn_label} tone={side} />
              <DetailRow label="נייר ערך" value={tickerSym} ltr />
              <DetailRow
                label="סכום מדווח"
                value={amountRange}
                ltr={Boolean(amountRange && amountRange.startsWith('$'))}
              />
              <DetailRow
                label="תאריך ביצוע"
                value={formatTradeDate(trade.transaction_date)}
                ltr
              />
              <DetailRow label="תאריך דיווח" value={formatTradeDate(trade.filed_at)} ltr />
              <DetailRow label="עיכוב דיווח" value={delay} last />
            </UICard>
            <Text style={styles.footnote}>
              דיווחי STOCK Act מכילים טווח סכום בלבד — לא מספר מניות, לא מחיר למניה
              ולא שווי מדויק. מספר חוזים, strike ותאריך פקיעה אינם חלק מהדיווח ולכן
              אינם מוצגים כאן.
            </Text>
          </View>

          {/* תשואה מאז העסקה — מ-Quiver */}
          {hasAnyReturn(trade) ? (
            <View style={styles.section}>
              <DarkPoolSectionHeader
                title="תשואה מאז העסקה"
                subtitle="מחושב על ידי Quiver מיום ביצוע העסקה"
                icon="trending-up-outline"
              />
              <UICard variant="glass" glassIntensity="light" padding="md">
                <ReturnRow label="מחיר המניה" pct={trade.price_change_pct} />
                <ReturnRow label="S&P 500" pct={trade.spy_change_pct} />
                <ReturnRow
                  label="עודף תשואה מול המדד"
                  pct={trade.excess_return_pct}
                  last
                />
              </UICard>
            </View>
          ) : null}

          {/* פעילות אחרונה — אותו אדם, אותו טיקר */}
          <View style={styles.section}>
            <DarkPoolSectionHeader
              title="פעילות אחרונה"
              subtitle={`עסקאות נוספות של ${trade.politician_name} ב-${ticker}`}
              icon="time-outline"
            />
            {historyQuery.isLoading ? (
              <UICard variant="glass" glassIntensity="light" padding="lg">
                <ActivityIndicator color={tokens.colors.primary.main} />
              </UICard>
            ) : otherTrades.length > 0 ? (
              <UICard variant="glass" glassIntensity="light" padding="md">
                {otherTrades.map((t, i) => (
                  <HistoryRow
                    key={t.id}
                    trade={t}
                    last={i === otherTrades.length - 1}
                  />
                ))}
              </UICard>
            ) : (
              <UICard variant="glass" glassIntensity="light" padding="md">
                <Text style={styles.emptyBody}>
                  זו העסקה היחידה שדווחה ב-{ticker} עבור {trade.politician_name}.
                </Text>
              </UICard>
            )}
          </View>

          <QuiverAttribution scope="congress" />
        </ScrollView>
      </SafeAreaView>
    </ScreenChrome>
  );
}

function hasAnyReturn(trade: CongressFeedTrade): boolean {
  return (
    trade.price_change_pct != null ||
    trade.spy_change_pct != null ||
    trade.excess_return_pct != null
  );
}

/* -------------------------------------------------------------------------- */

function DetailRow({
  label,
  value,
  ltr = false,
  last = false,
  tone,
}: {
  label: string;
  value: string | null | undefined;
  ltr?: boolean;
  last?: boolean;
  tone?: 'buy' | 'sell';
}) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => rowStyles(tokens), [tokens]);
  const text = orUnavailable(value);
  const missing = text === DARK_POOL_UNAVAILABLE;
  const color = missing
    ? tokens.colors.text.tertiary
    : tone === 'buy'
      ? tokens.colors.primary.main
      : tone === 'sell'
        ? tokens.colors.text.danger
        : tokens.colors.text.primary;

  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[styles.value, { color }, ltr && !missing ? styles.valueLtr : null]}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {ltr && !missing ? toDataIsland(text) : text}
      </Text>
    </View>
  );
}

function ReturnRow({
  label,
  pct,
  last = false,
}: {
  label: string;
  pct: number | null | undefined;
  last?: boolean;
}) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => rowStyles(tokens), [tokens]);
  const text = formatReturnPct(pct);
  const tone = returnTone(pct);
  const color = !text
    ? tokens.colors.text.tertiary
    : tone === 'positive'
      ? tokens.colors.primary.main
      : tone === 'negative'
        ? tokens.colors.text.danger
        : tokens.colors.text.secondary;

  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.value, styles.valueLtr, { color }]} numberOfLines={1}>
        {text ? toDataIsland(text) : DARK_POOL_UNAVAILABLE}
      </Text>
    </View>
  );
}

function ReturnLine({
  label,
  pct,
  compact = false,
}: {
  label: string;
  pct: number | null | undefined;
  compact?: boolean;
}) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => rowStyles(tokens), [tokens]);
  const text = formatReturnPct(pct);
  if (!text) return null;
  const tone = returnTone(pct);
  const color =
    tone === 'positive'
      ? tokens.colors.primary.main
      : tone === 'negative'
        ? tokens.colors.text.danger
        : tokens.colors.text.secondary;

  return (
    <Text style={[styles.inlineReturn, { color }]} numberOfLines={1}>
      {`${label} `}
      <Text style={compact ? styles.inlineReturnValue : undefined}>
        {toDataIsland(text)}
      </Text>
    </Text>
  );
}

function HistoryRow({ trade, last }: { trade: CongressFeedTrade; last: boolean }) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => rowStyles(tokens), [tokens]);
  const side = getFeedTradeSide(trade.transaction_type);
  const color =
    side === 'buy' ? tokens.colors.primary.main : tokens.colors.text.danger;
  const amount = formatDisclosedAmountRange(trade.amount_label);
  const date = formatTradeDate(trade.transaction_date);

  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={styles.historyStart}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.historyVerb, { color }]} numberOfLines={1}>
          {getFeedTradeVerb(side)}
        </Text>
        <Text style={styles.historyDate} numberOfLines={1}>
          {date ? toDataIsland(date) : DARK_POOL_UNAVAILABLE}
        </Text>
      </View>
      <Text style={styles.historyAmount} numberOfLines={1} ellipsizeMode="tail">
        {amount ? toDataIsland(amount) : DARK_POOL_UNAVAILABLE}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */

function rowStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.colors.border.subtle,
    },
    rowLast: { borderBottomWidth: 0, paddingBottom: 0 },
    label: {
      ...hebrewText,
      fontSize: tokens.typography.footnote.size,
      fontWeight: tokens.typography.fontWeight.medium,
      color: tokens.colors.text.tertiary,
      flexShrink: 0,
    },
    value: {
      fontSize: tokens.typography.footnote.size,
      fontWeight: tokens.typography.fontWeight.bold,
      color: tokens.colors.text.primary,
      textAlign: 'left',
      writingDirection: 'rtl',
      flexShrink: 1,
      minWidth: 0,
    },
    valueLtr: {
      writingDirection: 'ltr',
      fontVariant: ['tabular-nums'],
    },
    inlineReturn: {
      marginTop: 2,
      fontSize: tokens.typography.caption2.size,
      fontWeight: tokens.typography.fontWeight.medium,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    inlineReturnValue: {
      fontWeight: tokens.typography.fontWeight.extrabold,
      fontVariant: ['tabular-nums'],
    },
    historyStart: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    historyVerb: {
      fontSize: tokens.typography.footnote.size,
      fontWeight: tokens.typography.fontWeight.bold,
      writingDirection: 'rtl',
    },
    historyDate: {
      fontSize: tokens.typography.caption.size,
      fontWeight: tokens.typography.fontWeight.medium,
      color: tokens.colors.text.tertiary,
      fontVariant: ['tabular-nums'],
      writingDirection: 'ltr',
    },
    historyAmount: {
      fontSize: tokens.typography.caption.size,
      fontWeight: tokens.typography.fontWeight.bold,
      color: tokens.colors.text.secondary,
      fontVariant: ['tabular-nums'],
      writingDirection: 'ltr',
      textAlign: 'left',
      flexShrink: 1,
      minWidth: 0,
    },
  });
}

function createStyles(
  tokens: ReturnType<typeof useDesignTokens>,
  bottomPadding: number
) {
  return StyleSheet.create({
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: tokens.layout.screenPadding,
      paddingTop: 4,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      direction: 'rtl',
      paddingHorizontal: tokens.layout.screenPadding,
      paddingTop: tokens.spacing.sm,
      paddingBottom: bottomPadding + 32,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    card: {
      marginBottom: tokens.spacing.md,
      borderRadius: tokens.borderRadius['2xl'],
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tokens.colors.border.subtle,
      ...tokens.shadows.sm,
    },
    section: {
      marginBottom: tokens.spacing.md,
    },
    personRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    personText: {
      flex: 1,
      flexBasis: 0,
      minWidth: 0,
      gap: 2,
    },
    personName: {
      ...hebrewText,
      fontSize: tokens.typography.titleXs.size,
      lineHeight: tokens.typography.titleXs.lineHeight,
      fontWeight: tokens.typography.fontWeight.bold,
      color: tokens.colors.text.primary,
    },
    personHint: {
      ...hebrewText,
      fontSize: tokens.typography.caption2.size,
      fontWeight: tokens.typography.fontWeight.medium,
      color: tokens.colors.text.tertiary,
    },
    action: {
      ...hebrewText,
      marginTop: 14,
      fontSize: tokens.typography.title2.size,
      lineHeight: tokens.typography.title2.lineHeight,
      fontWeight: tokens.typography.fontWeight.extrabold,
      color: tokens.colors.text.primary,
    },
    actionTicker: {
      color: tokens.colors.text.primary,
      letterSpacing: 0.3,
    },
    company: {
      ...hebrewText,
      marginTop: 2,
      fontSize: tokens.typography.footnote.size,
      fontWeight: tokens.typography.fontWeight.medium,
      color: tokens.colors.text.secondary,
    },
    dateChips: {
      marginTop: 12,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    dateChip: {
      ...hebrewText,
      fontSize: tokens.typography.caption2.size,
      fontWeight: tokens.typography.fontWeight.semibold,
      color: tokens.colors.text.secondary,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: tokens.borderRadius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tokens.colors.border.subtle,
      backgroundColor: tokens.colors.glass.card.bg,
      overflow: 'hidden',
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    priceStart: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flexShrink: 1,
      minWidth: 0,
    },
    priceTexts: { gap: 1, minWidth: 0 },
    priceTicker: {
      fontSize: tokens.typography.footnote.size,
      fontWeight: tokens.typography.fontWeight.extrabold,
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
      letterSpacing: 0.2,
    },
    priceCaption: {
      ...hebrewText,
      fontSize: tokens.typography.caption2.size,
      fontWeight: tokens.typography.fontWeight.medium,
      color: tokens.colors.text.tertiary,
    },
    priceEnd: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      flexShrink: 0,
    },
    priceValue: {
      fontSize: tokens.typography.titleXs.size,
      fontWeight: tokens.typography.fontWeight.extrabold,
      color: tokens.colors.text.primary,
      fontVariant: ['tabular-nums'],
      writingDirection: 'ltr',
      textAlign: 'right',
    },
    footnote: {
      ...hebrewText,
      marginTop: 10,
      paddingHorizontal: 2,
      fontSize: tokens.typography.caption2.size,
      lineHeight: 17,
      fontWeight: tokens.typography.fontWeight.medium,
      color: tokens.colors.text.tertiary,
    },
    emptyTitle: {
      ...hebrewText,
      fontSize: tokens.typography.titleXs.size,
      fontWeight: tokens.typography.fontWeight.bold,
      color: tokens.colors.text.primary,
    },
    emptyBody: {
      ...hebrewText,
      fontSize: tokens.typography.footnote.size,
      lineHeight: 20,
      fontWeight: tokens.typography.fontWeight.medium,
      color: tokens.colors.text.secondary,
    },
  });
}
