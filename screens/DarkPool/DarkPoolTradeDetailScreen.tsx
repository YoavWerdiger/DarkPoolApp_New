/**
 * פרטי עסקה — קונגרס (STOCK Act) או בכיר חברה (Form 4).
 *
 * שני המקורות **לא** מכילים את אותם שדות, ולכן המסך מתפצל לפי `kind`:
 *
 *   קונגרס  — נכס, שני תאריכים, **טווח** סכום. אין כמות, אין מחיר.
 *   בכיר    — שני תאריכים, כמות ומחיר אמיתיים (בלי שורת אות Form 4).
 *             אין דגל 10b5-1 ואין `security_title`.
 *             מחיר 0 בהענקה / מתנה / המרה = «אין מחיר» — לא "$0".
 *
 * גיבור = כרטיס אחד (כמו פיד): דיוקן + שם + משפט באותה עמודה,
 * קן טיקר/מחיר-חי/מאז-העסקה בפנים. התאריך במשפט כ«בתאריך», לא כצ'יפ.
 * כנות ארוכה מאחורי `?` בכותרת, לא כפסקה.
 */

import React, { useCallback, useMemo, useState } from 'react';
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
import { DayNavBlurButton, HEADER_BACK_BTN_SIZE } from '../../components/ui/DayNavBlurButton';
import { ChangeDot } from '../../components/ui/ChangeDot';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { HelpSheet } from '../../components/ui/HelpSheet';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { appQueryKeys } from '../../lib/appQueryKeys';
import { listCongressTradesForPersonTicker } from '../../services/darkpool/darkPoolDbCacheService';
import { listInsiderTradesForPersonTicker } from '../../services/darkpool/darkPoolService';
import { prefetchPersonPortfolio } from '../../services/darkpool/prefetchPersonPortfolio';
import type { CongressFeedTrade } from '../../services/darkpool/uwCongressFeedService';
import type { InsiderBuyRow } from '../../types/darkpool.types';
import { getQuotes } from '../../services/portfolios/portfolioPriceFeed';
import { fetchOpenOnTransactionDate } from './utils/congressTradeOpens';
import { resolveCongressSinceTradePct } from './utils/congressSinceTrade';
import type { DarkPoolStackParamList } from '../../navigation/DarkPoolStack';
import { InsiderAvatar } from './components/InsiderAvatar';
import { DarkPoolNestedQuoteCard } from './components/DarkPoolNestedQuoteCard';
import { DarkPoolSectionHeader } from './components/DarkPoolSectionHeader';
import { QuiverAttribution } from './components/QuiverAttribution';
import {
  createTradeHeroCardStyles,
  FEED_AVATAR_SIZE,
  FEED_CARD_TYPE,
  TRADE_HERO_UICARD,
  tradeHeroGlassFrameStyle,
  tradeHeroInnerCardStyle,
} from './components/darkPoolFeedCardStyles';
import { ltrNameText, toDataIsland, tradeActivitySubtitleParts } from './utils/bidi';
import {
  DARK_POOL_TYPE,
  darkPoolPhysicalRightText,
  darkPoolRtlContent,
  darkPoolSectionTitleStyle,
  darkPoolTransparentFill,
} from './darkPoolLayout';
import {
  DARK_POOL_UNAVAILABLE,
  formatDisclosedAmountRange,
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
import { calcSinceTradePct } from './utils/insiderFeedCalc';
import {
  describeInsiderCode,
  formatInsiderPrice,
  formatInsiderRole,
  formatInsiderShares,
  formatInsiderValue,
  insiderValueFieldLabel,
} from './utils/insiderTradeDisplay';
import { formatInsiderDisplayName } from './utils/investorPlaceholder';
import {
  CONGRESS_TRADE_HONESTY_BODY,
  CONGRESS_TRADE_HONESTY_TITLE,
  INSIDER_TRADE_HONESTY_BODY,
  INSIDER_TRADE_HONESTY_TITLE,
  TRADE_DETAIL_HONESTY_A11Y,
  TRADE_DETAIL_HONESTY_GOT_IT,
} from './utils/tradeDetailHonestyCopy';
import { hasTradeDetailPayload } from './utils/tradeDetailParams';
import {
  buildCongressTradeDetailSummary,
  buildInsiderTradeDetailSummary,
  buildTradeDetailFieldRows,
} from './utils/tradeDetailSummary';

type Nav = NativeStackNavigationProp<DarkPoolStackParamList, 'DarkPoolTradeDetail'>;
type RP = RouteProp<DarkPoolStackParamList, 'DarkPoolTradeDetail'>;

export default function DarkPoolTradeDetailScreen() {
  const tokens = useDesignTokens();
  const [helpOpen, setHelpOpen] = useState(false);
  const navigation = useNavigation<Nav>();
  const route = useRoute<RP>();
  const bottomPad = useMainTabsHeight();
  const styles = useMemo(() => createStyles(tokens, bottomPad), [tokens, bottomPad]);
  const heroStyles = useMemo(() => createTradeHeroCardStyles(tokens), [tokens]);

  const params = route.params;
  const isCongress = params?.kind === 'congress';
  const congressTrade = params?.kind === 'congress' ? params.trade : null;
  const insiderTrade = params?.kind === 'insider' ? params.trade : null;
  const trade = params?.trade;
  const ticker = (trade?.ticker ?? '').toUpperCase();
  const tickerSym = formatFeedTickerDisplay(ticker);

  const summary = isCongress
    ? buildCongressTradeDetailSummary({
        transactionType: congressTrade?.transaction_type ?? 'buy',
        ticker,
        amountLabel: congressTrade?.amount_label,
        transactionDate: trade?.transaction_date,
      })
    : buildInsiderTradeDetailSummary({
        transactionType: insiderTrade?.transaction_type,
        ticker,
        shares: insiderTrade?.shares,
        price: insiderTrade?.price,
        transactionDate: trade?.transaction_date,
      });
  const tone = summary.tone;
  const toneColor =
    tone === 'buy'
      ? tokens.colors.primary.main
      : tone === 'sell'
        ? tokens.colors.text.danger
        : tokens.colors.text.primary;

  const insiderNameRaw = insiderTrade?.insider_name?.trim() || 'בכיר';
  const personName = isCongress
    ? (congressTrade?.politician_name ?? '')
    : formatInsiderDisplayName(insiderNameRaw);
  const personImage = isCongress
    ? (congressTrade?.politician_image_url ?? null)
    : (insiderTrade?.insider_logo_url ?? null);
  const personRole = formatInsiderRole(insiderTrade?.insider_role);
  const personHint = isCongress ? 'חבר קונגרס' : personRole;

  const quoteQuery = useQuery({
    queryKey: ['darkpool', 'trade-detail-quote', ticker],
    queryFn: async () => (await getQuotes([ticker])).get(ticker) ?? null,
    enabled: ticker.length > 0,
    staleTime: 60_000,
  });

  const congressTxDay = (congressTrade?.transaction_date ?? '').slice(0, 10);
  const congressOpenQuery = useQuery({
    queryKey: appQueryKeys.congressTradeOpen(ticker, congressTxDay),
    queryFn: () => fetchOpenOnTransactionDate(ticker, congressTxDay),
    enabled:
      isCongress &&
      ticker.length > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(congressTxDay),
    staleTime: 60 * 60_000,
  });

  const congressHistoryQuery = useQuery({
    queryKey: appQueryKeys.congressPersonTickerTrades(
      congressTrade?.politician_id ?? '',
      ticker
    ),
    queryFn: () =>
      listCongressTradesForPersonTicker(congressTrade!.politician_id, ticker),
    enabled: Boolean(congressTrade?.politician_id) && ticker.length > 0,
    staleTime: 5 * 60_000,
  });

  const insiderHistoryQuery = useQuery({
    queryKey: appQueryKeys.insiderPersonTickerTrades(insiderNameRaw, ticker),
    queryFn: () => listInsiderTradesForPersonTicker(insiderNameRaw, ticker),
    enabled: !isCongress && Boolean(insiderTrade?.insider_name) && ticker.length > 0,
    staleTime: 5 * 60_000,
  });

  const openPerson = useCallback(() => {
    void HapticFeedback.impactLight();
    if (congressTrade?.politician_id) {
      prefetchPersonPortfolio({
        id: congressTrade.politician_id,
        kind: 'politician',
        nameHint: congressTrade.politician_name,
      });
      navigation.navigate('DarkPoolInvestor', {
        id: congressTrade.politician_id,
        kind: 'politician',
        nameHint: congressTrade.politician_name,
        imageHint: congressTrade.politician_image_url,
      });
      return;
    }
    if (insiderTrade) {
      const name = insiderTrade.insider_name?.trim() || 'בכיר';
      prefetchPersonPortfolio({
        id: `${insiderTrade.ticker}:${name}`,
        kind: 'insider',
        ticker: insiderTrade.ticker,
        nameHint: name,
      });
      navigation.navigate('DarkPoolInvestor', {
        id: `${insiderTrade.ticker}:${name}`,
        kind: 'insider',
        ticker: insiderTrade.ticker,
        nameHint: name,
      });
    }
  }, [navigation, congressTrade, insiderTrade]);

  const openTicker = useCallback(() => {
    if (!ticker) return;
    void HapticFeedback.impactLight();
    navigation.navigate('DarkPoolTicker', { ticker });
  }, [navigation, ticker]);

  const openHonesty = useCallback(() => {
    void HapticFeedback.selection();
    setHelpOpen(true);
  }, []);

  if (!hasTradeDetailPayload(params) || !trade) {
    return (
      <ScreenChrome rtl>
        <StatusBar style="light" />
        <SafeAreaView style={[darkPoolTransparentFill, darkPoolRtlContent]} edges={['top']}>
          <View style={styles.topBar}>
            <DayNavBlurButton
              onPress={() => navigation.goBack()}
              glassIntensity="subtle"
              size={HEADER_BACK_BTN_SIZE}
              accessibilityLabel="חזרה"
            >
              <Ionicons
                name="chevron-forward"
                size={22}
                color={tokens.colors.text.primary}
              />
            </DayNavBlurButton>
          </View>
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>העסקה לא נמצאה</Text>
            <Text style={styles.emptyBody}>
              אין מספיק פרטים לפתוח את דיווח העסקה. זה לא פרופיל האדם — חזרו לפיד ונסו שורה אחרת.
            </Text>
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

  /**
   * שינוי מאז יום העסקה.
   * קונגרס: Quiver PriceChange אם קיים; אחרת פתיחת יום הביצוע מול חי.
   * בכיר: מחיר Form 4 אמיתי מול ציטוט חי — רק כשהמחיר > 0.
   */
  const sinceTradePct = congressTrade
    ? resolveCongressSinceTradePct({
        vendorPriceChangePct: congressTrade.price_change_pct,
        openOnTransactionDate: congressOpenQuery.data ?? null,
        currentPrice,
      })
    : (() => {
        const pct = calcSinceTradePct(insiderTrade?.price, currentPrice);
        return pct == null ? null : pct * 100;
      })();
  const sinceTradeText = formatReturnPct(sinceTradePct);
  const sinceTradeTone = returnTone(sinceTradePct);
  const sinceTradeColor =
    sinceTradeTone === 'positive'
      ? tokens.colors.primary.main
      : sinceTradeTone === 'negative'
        ? tokens.colors.text.danger
        : tokens.colors.text.secondary;

  const amountRange = congressTrade
    ? formatDisclosedAmountRange(congressTrade.amount_label)
    : null;
  const insiderValueInput = {
    shares: insiderTrade?.shares,
    price: insiderTrade?.price,
    value: insiderTrade?.value,
  };

  const otherCongressTrades = (congressHistoryQuery.data ?? []).filter(
    (t) => t.id !== trade.id
  );
  const otherInsiderTrades = (insiderHistoryQuery.data ?? []).filter(
    (t) => t.id !== trade.id
  );
  const historyLoading = isCongress
    ? congressHistoryQuery.isLoading
    : insiderHistoryQuery.isLoading;
  const historyCount = isCongress
    ? otherCongressTrades.length
    : otherInsiderTrades.length;
  const activitySubtitle = tradeActivitySubtitleParts(personName, ticker);

  return (
    <ScreenChrome rtl>
      <StatusBar style="light" />
      <SafeAreaView style={[darkPoolTransparentFill, darkPoolRtlContent]} edges={['top']}>
        <View style={styles.topBar}>
          <DayNavBlurButton
            onPress={() => navigation.goBack()}
            glassIntensity="subtle"
            size={HEADER_BACK_BTN_SIZE}
            accessibilityLabel="חזרה"
          >
            <Ionicons
              name="chevron-forward"
              size={22}
              color={tokens.colors.text.primary}
            />
          </DayNavBlurButton>
          <View style={styles.topBarSpacer} />
          <DayNavBlurButton
            onPress={openHonesty}
            glassIntensity="subtle"
            size={HEADER_BACK_BTN_SIZE}
            accessibilityLabel={TRADE_DETAIL_HONESTY_A11Y}
          >
            <Ionicons
              name="help-circle-outline"
              size={18}
              color={tokens.colors.text.tertiary}
            />
          </DayNavBlurButton>
        </View>

        <ScrollView
          style={darkPoolTransparentFill}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, tradeHeroGlassFrameStyle(tokens)]}>
            <UICard {...TRADE_HERO_UICARD} style={tradeHeroInnerCardStyle(tokens)}>
            <View style={heroStyles.heroBody}>
              <View style={heroStyles.headerRow}>
                <Pressable
                  onPress={openPerson}
                  style={heroStyles.avatarHit}
                  accessibilityRole="button"
                  accessibilityLabel={`פרופיל ${personName}`}
                >
                  <InsiderAvatar
                    name={personName}
                    logoUrl={personImage}
                    size={FEED_AVATAR_SIZE}
                  />
                </Pressable>
                <View style={heroStyles.textCol}>
                  <Pressable
                    onPress={openPerson}
                    accessibilityRole="button"
                    accessibilityLabel={`פרופיל ${personName}`}
                  >
                    <Text
                      style={heroStyles.personName}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {personName}
                    </Text>
                    {personHint ? (
                      <Text
                        style={[
                          heroStyles.personHint,
                          !isCongress ? heroStyles.personHintLtr : null,
                        ]}
                        numberOfLines={1}
                      >
                        {personHint}
                      </Text>
                    ) : null}
                  </Pressable>
                  <Text
                    style={[
                      heroStyles.action,
                      personHint ? null : heroStyles.actionAfterName,
                    ]}
                    accessibilityLabel={summary.sentence}
                  >
                    <Text style={[heroStyles.actionVerb, { color: toneColor }]}>
                      {summary.verb}
                    </Text>
                    {summary.primaryRender ? (
                      <Text style={heroStyles.actionRest}> {summary.primaryRender}</Text>
                    ) : null}
                  </Text>
                  {summary.metaRender ? (
                    <Text style={heroStyles.actionMeta}>{summary.metaRender}</Text>
                  ) : null}
                </View>
              </View>

              <Pressable
                onPress={openTicker}
                accessibilityRole="button"
                accessibilityLabel={`עמוד המניה ${ticker}`}
              >
                <DarkPoolNestedQuoteCard
                  ticker={ticker}
                  priceText={priceText}
                  changeText={sinceTradeText}
                  changeColor={sinceTradeColor}
                  changeTone={sinceTradeText ? sinceTradeTone : undefined}
                  loading={
                    (quoteQuery.isLoading && !priceText) ||
                    (isCongress && congressOpenQuery.isLoading && !sinceTradeText)
                  }
                  missingText={
                    !quoteQuery.isLoading && !priceText ? DARK_POOL_UNAVAILABLE : null
                  }
                />
              </Pressable>
            </View>
          </UICard>
          </View>

          <View style={styles.section}>
            <DarkPoolSectionHeader title="פרטי העסקה" />
            <UICard variant="glass" glassIntensity="light" padding="md">
              {buildTradeDetailFieldRows({
                isCongress,
                tickerSym,
                amountRange,
                shares: formatInsiderShares(insiderTrade?.shares),
                price: formatInsiderPrice(insiderTrade?.price),
                value: formatInsiderValue(insiderValueInput),
                valueLabel: insiderValueFieldLabel(insiderValueInput),
                traded: formatTradeDate(trade.transaction_date),
                filed: formatTradeDate(trade.filed_at),
              }).map((row, i, all) => (
                <DetailRow
                  key={row.label}
                  label={row.label}
                  value={row.value}
                  ltr={row.ltr}
                  last={i === all.length - 1}
                />
              ))}
            </UICard>
          </View>

          {congressTrade &&
          (hasAnyReturn(congressTrade) || sinceTradePct != null) ? (
            <View style={styles.section}>
              <DarkPoolSectionHeader
                title="תשואה מאז העסקה"
                subtitle="שינוי מחיר המניה מפתיחת יום העסקה מול חי — לא רווח/הפסד של הפוזיציה"
              />
              <UICard variant="glass" glassIntensity="light" padding="md">
                <ReturnRow
                  label="מחיר המניה"
                  pct={sinceTradePct ?? congressTrade.price_change_pct}
                />
                <ReturnRow label="S&P 500" pct={congressTrade.spy_change_pct} />
                <ReturnRow
                  label="עודף תשואה מול המדד"
                  pct={congressTrade.excess_return_pct}
                  last
                />
              </UICard>
            </View>
          ) : null}

          {historyLoading || historyCount > 0 ? (
            <View style={styles.historySection}>
              <DarkPoolSectionHeader
                title="פעילות אחרונה"
                subtitleA11y={activitySubtitle.sentence}
                subtitle={
                  <>
                    {activitySubtitle.lead}
                    <Text style={styles.subtitleName}>{activitySubtitle.name}</Text>
                    {activitySubtitle.mid}
                    {activitySubtitle.tickerIsolated}
                  </>
                }
              />
              {historyLoading ? (
                <View style={styles.historyLoading}>
                  <ActivityIndicator color={tokens.colors.primary.main} />
                </View>
              ) : (
                <UICard variant="glass" glassIntensity="light" padding="md">
                  {otherCongressTrades.map((t, i) => (
                    <CongressHistoryRow
                      key={t.id}
                      trade={t}
                      last={i === otherCongressTrades.length - 1}
                    />
                  ))}
                  {otherInsiderTrades.map((t, i) => (
                    <InsiderHistoryRow
                      key={t.id}
                      trade={t}
                      last={i === otherInsiderTrades.length - 1}
                    />
                  ))}
                </UICard>
              )}
            </View>
          ) : null}

          <QuiverAttribution />
        </ScrollView>
      </SafeAreaView>
      <HelpSheet
        visible={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={isCongress ? CONGRESS_TRADE_HONESTY_TITLE : INSIDER_TRADE_HONESTY_TITLE}
        body={isCongress ? CONGRESS_TRADE_HONESTY_BODY : INSIDER_TRADE_HONESTY_BODY}
        gotItLabel={TRADE_DETAIL_HONESTY_GOT_IT}
      />
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
}: {
  label: string;
  value: string | null | undefined;
  ltr?: boolean;
  last?: boolean;
}) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => rowStyles(tokens), [tokens]);
  const text = orUnavailable(value);
  const missing = text === DARK_POOL_UNAVAILABLE;
  const color = missing ? tokens.colors.text.tertiary : tokens.colors.text.primary;

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
      {text ? (
        <View style={styles.returnValueRow}>
          <ChangeDot tone={tone} />
          <Text style={[styles.value, styles.valueLtr, { color }]} numberOfLines={1}>
            {toDataIsland(text)}
          </Text>
        </View>
      ) : (
        <Text style={[styles.value, { color }]} numberOfLines={1}>
          {DARK_POOL_UNAVAILABLE}
        </Text>
      )}
    </View>
  );
}

function ReturnLine({
  label,
  pct,
}: {
  label: string;
  pct: number | null | undefined;
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
    <View style={styles.sinceBlock}>
      <Text style={styles.inlineReturnLabel} numberOfLines={2}>
        {label}
      </Text>
      <View style={styles.returnValueRow}>
        <ChangeDot tone={tone} />
        <Text
          style={[styles.inlineReturnValue, { color }]}
          numberOfLines={1}
          ellipsizeMode="clip"
        >
          {toDataIsland(text)}
        </Text>
      </View>
    </View>
  );
}

function CongressHistoryRow({
  trade,
  last,
}: {
  trade: CongressFeedTrade;
  last: boolean;
}) {
  const tokens = useDesignTokens();
  const side = getFeedTradeSide(trade.transaction_type);
  return (
    <HistoryRow
      last={last}
      verb={getFeedTradeVerb(side)}
      color={side === 'buy' ? tokens.colors.primary.main : tokens.colors.text.danger}
      date={formatTradeDate(trade.transaction_date)}
      amount={formatDisclosedAmountRange(trade.amount_label)}
    />
  );
}

function InsiderHistoryRow({ trade, last }: { trade: InsiderBuyRow; last: boolean }) {
  const tokens = useDesignTokens();
  const meaning = describeInsiderCode(trade.transaction_type);
  const color =
    meaning.tone === 'buy'
      ? tokens.colors.primary.main
      : meaning.tone === 'sell'
        ? tokens.colors.text.danger
        : tokens.colors.text.secondary;
  const shares = formatInsiderShares(trade.shares);
  const value = formatInsiderValue({
    shares: trade.shares,
    price: trade.price,
    value: trade.value,
  });

  return (
    <HistoryRow
      last={last}
      verb={
        meaning.code === 'P' || (meaning.tone === 'buy' && !meaning.code)
          ? 'קנה'
          : meaning.code === 'S'
            ? 'מכר'
            : meaning.label
      }
      color={color}
      date={formatTradeDate(trade.transaction_date)}
      amount={value ?? (shares ? `${shares} מניות` : null)}
      amountIsData={Boolean(value)}
    />
  );
}

function HistoryRow({
  last,
  verb,
  color,
  date,
  amount,
  amountIsData = true,
}: {
  last: boolean;
  verb: string;
  color: string;
  date: string | null;
  amount: string | null;
  amountIsData?: boolean;
}) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => rowStyles(tokens), [tokens]);

  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={styles.historyStart}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.historyVerb, { color }]} numberOfLines={1}>
          {verb}
        </Text>
        <Text style={styles.historyDate} numberOfLines={1}>
          {date ? toDataIsland(date) : DARK_POOL_UNAVAILABLE}
        </Text>
      </View>
      <Text
        style={[styles.historyAmount, amountIsData ? styles.historyAmountData : null]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {amount
          ? amountIsData
            ? toDataIsland(amount)
            : amount
          : DARK_POOL_UNAVAILABLE}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */

function rowStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    row: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.colors.border.subtle,
    },
    rowLast: { borderBottomWidth: 0, paddingBottom: 0 },
    label: {
      ...darkPoolPhysicalRightText,
      fontSize: FEED_CARD_TYPE.dates.fontSize,
      lineHeight: FEED_CARD_TYPE.dates.lineHeight,
      fontWeight: DARK_POOL_TYPE.caption.fontWeight,
      color: tokens.colors.text.tertiary,
      flexShrink: 0,
    },
    value: {
      fontSize: FEED_CARD_TYPE.action.fontSize,
      lineHeight: FEED_CARD_TYPE.action.lineHeight,
      fontWeight: '700',
      color: tokens.colors.text.primary,
      flexShrink: 1,
      minWidth: 0,
      textAlign: 'left',
    },
    valueLtr: {
      writingDirection: 'ltr',
      fontVariant: ['tabular-nums'],
    },
    returnValueRow: {
      direction: 'ltr',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      flexShrink: 1,
      minWidth: 0,
    },
    sinceBlock: {
      marginTop: 2,
      alignItems: 'stretch',
      minWidth: 0,
    },
    inlineReturnValue: {
      ...darkPoolPhysicalRightText,
      fontSize: DARK_POOL_TYPE.footnote.fontSize,
      lineHeight: 17,
      fontWeight: tokens.typography.fontWeight.extrabold,
      fontVariant: ['tabular-nums'],
      writingDirection: 'ltr',
    },
    inlineReturnLabel: {
      fontSize: DARK_POOL_TYPE.caption2.fontSize,
      lineHeight: DARK_POOL_TYPE.caption2.lineHeight,
      fontWeight: DARK_POOL_TYPE.caption.fontWeight,
      ...darkPoolPhysicalRightText,
    },
    historyStart: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 1,
      minWidth: 0,
    },
    dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
    historyVerb: {
      ...darkPoolPhysicalRightText,
      fontSize: DARK_POOL_TYPE.footnote.fontSize,
      fontWeight: '700',
      flexShrink: 1,
      minWidth: 0,
    },
    historyDate: {
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      fontWeight: DARK_POOL_TYPE.caption.fontWeight,
      color: tokens.colors.text.tertiary,
      fontVariant: ['tabular-nums'],
      writingDirection: 'ltr',
      flexShrink: 0,
    },
    historyAmount: {
      ...darkPoolPhysicalRightText,
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      fontWeight: '700',
      color: tokens.colors.text.secondary,
      flexShrink: 0,
    },
    historyAmountData: {
      fontVariant: ['tabular-nums'],
      writingDirection: 'ltr',
    },
  });
}

function createStyles(
  tokens: ReturnType<typeof useDesignTokens>,
  bottomPadding: number
) {
  return StyleSheet.create({
    topBar: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: tokens.layout.screenPadding,
      paddingTop: 4,
    },
    topBarSpacer: { flex: 1 },
    scrollContent: {
      direction: 'rtl',
      paddingHorizontal: tokens.layout.screenPadding,
      paddingTop: tokens.spacing.sm,
      paddingBottom: bottomPadding + 32,
    },
    center: {
      direction: 'rtl',
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    card: {
      marginBottom: 16,
    },
    section: {
      marginBottom: tokens.spacing.md,
    },
    historySection: {
      marginTop: tokens.spacing.sm,
      marginBottom: tokens.spacing.lg,
    },
    subtitleName: {
      ...ltrNameText,
      fontSize: DARK_POOL_TYPE.sectionSubtitle.fontSize,
      lineHeight: DARK_POOL_TYPE.sectionSubtitle.lineHeight,
      fontWeight: DARK_POOL_TYPE.sectionSubtitle.fontWeight,
    },
    priceRow: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    priceStart: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      flexBasis: 0,
      minWidth: 0,
    },
    priceTexts: { gap: 1, minWidth: 0, flexShrink: 1 },
    priceTicker: {
      fontSize: DARK_POOL_TYPE.footnote.fontSize,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
      letterSpacing: 0.2,
    },
    priceCaption: {
      ...darkPoolPhysicalRightText,
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      fontWeight: DARK_POOL_TYPE.caption.fontWeight,
      color: tokens.colors.text.tertiary,
    },
    priceEnd: {
      alignItems: 'stretch',
      justifyContent: 'center',
      minWidth: 104,
      flexGrow: 0,
      flexShrink: 0,
    },
    priceValue: {
      ...darkPoolPhysicalRightText,
      fontSize: DARK_POOL_TYPE.body.fontSize,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      fontVariant: ['tabular-nums'],
    },
    priceMissing: {
      ...darkPoolPhysicalRightText,
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      fontWeight: DARK_POOL_TYPE.caption.fontWeight,
      color: tokens.colors.text.tertiary,
    },
    historyLoading: {
      paddingVertical: 12,
      alignItems: 'center',
    },
    emptyTitle: {
      ...darkPoolSectionTitleStyle,
      color: tokens.colors.text.primary,
    },
    emptyBody: {
      ...darkPoolPhysicalRightText,
      fontSize: DARK_POOL_TYPE.footnote.fontSize,
      lineHeight: 20,
      fontWeight: DARK_POOL_TYPE.caption.fontWeight,
      color: tokens.colors.text.secondary,
    },
  });
}
