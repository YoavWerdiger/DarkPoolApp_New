import { listCongressTradesForPersonTicker } from '../../services/darkpool/darkPoolDbCacheService';
import { listInsiderTradesForPersonTicker } from '../../services/darkpool/darkPoolService';
import { getFeedTradeSide } from './utils/feedTradeDisplay';
import { describeInsiderCode, formatInsiderValue } from './utils/insiderTradeDisplay';
import { formatDisclosedAmountRange } from './utils/congressTradeDisplay';
/**
 * פרטי אחזקה (13F — קרן / חברה): כמה מניות, שווי שוק חי, מחיר ממוצע, תשואה היום וכוללת,
 * ו«עסקאות» = השינוי בכמות בין דיווח לדיווח.
 *
 * עלות: אפס קריאות שרת נוספות לנתוני הקרן — הפוזיציה מחושבת מההיסטוריה שהפרופיל כבר טען
 * (מתעדכנת בשרת ב-cron של סנכרון ה-13F, בלי שהמשתמש צריך להיכנס). רק ציטוט חי אחד לטיקר (cache 60s).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  Activity,
  ChartLine,
  CircleDollarSign,
  Layers,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import UICard from '../../components/ui/UICard';
import { DayNavBlurButton, HEADER_BACK_BTN_SIZE } from '../../components/ui/DayNavBlurButton';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { APP_TYPE } from '../../components/ui/appType';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { HelpSheet } from '../../components/ui/HelpSheet';
import { formatSignedChangePct } from '../../components/ui/ChangeDot';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { getQuotes } from '../../services/portfolios/portfolioPriceFeed';
import type { DarkPoolStackParamList } from '../../navigation/DarkPoolStack';
import { InsiderAvatar } from './components/InsiderAvatar';
import { DarkPoolNestedQuoteCard } from './components/DarkPoolNestedQuoteCard';
import { DarkPoolSectionHeader } from './components/DarkPoolSectionHeader';
import {
  createTradeHeroCardStyles,
  FEED_AVATAR_SIZE,
  FEED_RHYTHM,
  TRADE_HERO_UICARD,
  tradeHeroGlassFrameStyle,
  tradeHeroInnerCardStyle,
} from './components/darkPoolFeedCardStyles';
import { toDataIsland } from './utils/bidi';
import { DARK_POOL_UNAVAILABLE, formatTradeDate } from './utils/congressTradeDisplay';
import { formatCongressDeltaUsd } from './utils/investorHoldings';
import type { FilingPositionTxn } from './utils/filingPositionDetail';
import {
  DARK_POOL_TYPE,
  darkPoolPhysicalRightText,
  darkPoolRtlContent,
  darkPoolTransparentFill,
} from './darkPoolLayout';

type Nav = NativeStackNavigationProp<DarkPoolStackParamList, 'DarkPoolPosition'>;
type RP = RouteProp<DarkPoolStackParamList, 'DarkPoolPosition'>;

const TXN_PREVIEW = 6;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const usd = (v: number, digits = 0) =>
  `$${v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const sharesText = (v: number) => Math.round(v).toLocaleString('en-US');
/** $1.64B / $122.6M — לסכומי עסקאות בשורה צרה */
function compactUsd(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return usd(v);
}

const SIDE_VERB: Record<FilingPositionTxn['side'], string> = {
  new: 'פוזיציה חדשה',
  buy: 'הגדלה',
  sell: 'הקטנה',
  exit: 'יציאה מלאה',
};

const HONESTY_TITLE = 'איך מחושבת האחזקה?';
const HONESTY_BODY =
  'הנתונים מדוחות 13F שהגוף מגיש ל-SEC בסוף כל רבעון: כמה מניות הוא מחזיק ובאיזה שווי. ' +
  'הדוחות לא מפרטים עסקאות — «עסקה» כאן היא השינוי בכמות בין שני דוחות, במחיר סוף הרבעון. ' +
  'המחיר הממוצע לפי מחירי סוף הרבעון בכל שינוי. השווי והתשואה היום מחושבים לפי המחיר החי של המניה ' +
  'וכמות המניות בדוח האחרון.';

export default function DarkPoolPositionScreen() {
  const { params } = useRoute<RP>();
  return params.detail ? <FilingPositionView /> : <TradesPositionView />;
}

/** פוליטיקאי / בכיר: שווי, חלק מהתיק ותשואה מהשורה + רשימת העסקאות של האדם במניה */
function TradesPositionView() {
  const tokens = useDesignTokens();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RP>();
  const bottomPad = useMainTabsHeight();
  const styles = useMemo(() => createStyles(tokens, bottomPad), [tokens, bottomPad]);
  const heroStyles = useMemo(() => createTradeHeroCardStyles(tokens), [tokens]);
  const ticker = (params.ticker ?? '').toUpperCase();
  const isCongress = params.source === 'congress';

  const tradesQuery = useQuery({
    queryKey: ['darkpool', 'position-trades', params.source, params.personId ?? params.insiderName, ticker],
    queryFn: async () => {
      if (isCongress) {
        const rows = await listCongressTradesForPersonTicker(params.personId ?? '', ticker, 30);
        return rows.map((t) => ({
          key: String(t.id),
          buy: getFeedTradeSide(t.transaction_type ?? '') !== 'sell',
          date: t.transaction_date ?? t.filed_at ?? null,
          amount: formatDisclosedAmountRange(t.amount_label) ?? '—',
        }));
      }
      const rows = await listInsiderTradesForPersonTicker(params.insiderName ?? params.personName, ticker, 30);
      return rows.map((t) => {
        const tone = describeInsiderCode(t.transaction_type).tone;
        const value = formatInsiderValue({ shares: t.shares, price: t.price, value: t.value });
        return {
          key: String(t.id),
          buy: tone !== 'sell',
          date: t.transaction_date ?? null,
          amount: value ?? (t.shares ? `${Math.round(Math.abs(t.shares)).toLocaleString('en-US')} מניות` : '—'),
        };
      });
    },
    enabled: ticker.length > 0,
    staleTime: 5 * 60_000,
  });

  const quoteQuery = useQuery({
    queryKey: ['darkpool', 'trade-detail-quote', ticker],
    queryFn: async () => (await getQuotes([ticker])).get(ticker) ?? null,
    enabled: ticker.length > 0,
    staleTime: 60_000,
  });
  const price = quoteQuery.data?.price ?? null;
  const prevClose = quoteQuery.data?.previous_close ?? null;
  const todayPct = price && prevClose ? ((price - prevClose) / prevClose) * 100 : null;
  const ret = params.returnPct ?? null;
  // בלי כמות מהדיווח — השווי הנוכחי ÷ המחיר החי
  const shares =
    params.shares != null && params.shares > 0
      ? params.shares
      : params.marketValue != null && params.marketValue > 0 && price != null && price > 0
        ? params.marketValue / price
        : null;
  const toneColor = (v: number | null) =>
    v == null ? tokens.colors.text.secondary : v >= 0 ? tokens.colors.primary.main : tokens.colors.text.danger;

  return (
    <ScreenChrome rtl>
      <SafeAreaView style={[darkPoolTransparentFill, darkPoolRtlContent]} edges={['top']}>
        <View style={styles.topBar}>
          <DayNavBlurButton onPress={() => navigation.goBack()} glassIntensity="subtle" size={HEADER_BACK_BTN_SIZE} accessibilityLabel="חזרה">
            <Ionicons name="chevron-forward" size={22} color={tokens.colors.text.primary} />
          </DayNavBlurButton>
          <Text style={styles.topBarTitle} numberOfLines={1} accessibilityRole="header">
            פרטי אחזקה
          </Text>
          <View style={{ width: HEADER_BACK_BTN_SIZE }} />
        </View>
        <ScrollView style={darkPoolTransparentFill} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, tradeHeroGlassFrameStyle(tokens)]}>
            <UICard
              {...TRADE_HERO_UICARD}
              style={tradeHeroInnerCardStyle(tokens)}
              contentContainerStyle={styles.heroPad}
            >
              <View style={heroStyles.heroBody}>
                <View style={heroStyles.headerRow}>
                  <InsiderAvatar name={params.personName} logoUrl={params.personImage ?? null} size={FEED_AVATAR_SIZE} />
                  <View style={heroStyles.textCol}>
                    <Text style={heroStyles.personName} numberOfLines={2}>
                      {params.personName}
                    </Text>
                    <Text style={[heroStyles.action, heroStyles.actionAfterName]}>
                      <Text style={[heroStyles.actionVerb, { color: tokens.colors.primary.main }]}>מחזיק</Text>
                      <Text style={heroStyles.actionRest}>
                        {' '}
                        {shares != null
                          ? `${toDataIsland(sharesText(shares))} מניות`
                          : params.marketValue != null
                            ? `בשווי ${toDataIsland(usd(params.marketValue))}`
                            : 'במניה'}
                      </Text>
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => navigation.navigate('DarkPoolTicker', { ticker })}
                  accessibilityRole="button"
                  accessibilityLabel={`עמוד המניה ${ticker}`}
                >
                  <DarkPoolNestedQuoteCard
                    ticker={ticker}
                    priceText={price != null ? usd(price, 2) : null}
                    changeText={todayPct != null ? formatSignedChangePct(todayPct) : null}
                    changeColor={toneColor(todayPct)}
                    changeTone={todayPct == null ? undefined : todayPct >= 0 ? 'positive' : 'negative'}
                    loading={quoteQuery.isLoading && price == null}
                    missingText={!quoteQuery.isLoading && price == null ? DARK_POOL_UNAVAILABLE : null}
                  />
                </Pressable>
              </View>
            </UICard>
          </View>

          <View style={styles.section}>
            <DarkPoolSectionHeader variant="group" title="הפוזיציה" />
            <UICard variant="soft" glassIntensity="light" padding="none" contentContainerStyle={styles.rowsCard}>
              {shares != null ? <FieldRow icon={Layers} label="מניות" value={sharesText(shares)} /> : null}
              <FieldRow
                icon={Wallet}
                label="שווי אחזקה"
                value={params.marketValue != null ? usd(params.marketValue) : DARK_POOL_UNAVAILABLE}
              />
              <FieldRow
                icon={CircleDollarSign}
                label="חלק מהתיק"
                value={params.allocationPct != null ? `${params.allocationPct.toFixed(1)}%` : DARK_POOL_UNAVAILABLE}
                last
              />
            </UICard>
          </View>

          <View style={styles.section}>
            <DarkPoolSectionHeader variant="group" title="תשואת הפוזיציה" />
            <UICard variant="soft" glassIntensity="light" padding="none" contentContainerStyle={styles.rowsCard}>
              <FieldRow icon={Activity} label="תשואה היום" value={todayPct != null ? formatSignedChangePct(todayPct) : DARK_POOL_UNAVAILABLE} color={toneColor(todayPct)} />
              <FieldRow
                icon={ChartLine}
                label="תשואה כוללת"
                value={ret != null ? formatSignedChangePct(ret) : DARK_POOL_UNAVAILABLE}
                color={toneColor(ret)}
                last
              />
            </UICard>
          </View>

          {tradesQuery.data?.length ? (
            <View style={styles.section}>
              <DarkPoolSectionHeader variant="group" title="עסקאות במניה" />
              <UICard variant="soft" glassIntensity="light" padding="none" contentContainerStyle={styles.rowsCard}>
                {tradesQuery.data.map((t, i) => (
                  <View key={t.key} style={[styles.tradeRow, i < tradesQuery.data!.length - 1 && { borderBottomWidth: 1, borderBottomColor: tokens.colors.border.divider }]}>
                    <Text style={[styles.tradeAmount, { color: tokens.colors.text.primary }]} numberOfLines={1}>
                      {toDataIsland(t.amount)}
                    </Text>
                    <View style={styles.tradeStart}>
                      <Text style={[styles.tradeDate, { color: tokens.colors.text.secondary }]}>{toDataIsland(formatTradeDate(t.date) ?? '')}</Text>
                      <View style={[styles.sidePillInline, { backgroundColor: `${t.buy ? tokens.colors.primary.main : tokens.colors.text.danger}22` }]}>
                        <Text style={[styles.sidePillInlineText, { color: t.buy ? tokens.colors.primary.main : tokens.colors.text.danger }]}>
                          {t.buy ? 'קנייה' : 'מכירה'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </UICard>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ScreenChrome>
  );
}

function FilingPositionView() {
  const tokens = useDesignTokens();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RP>();
  const bottomPad = useMainTabsHeight();
  const styles = useMemo(() => createStyles(tokens, bottomPad), [tokens, bottomPad]);
  const heroStyles = useMemo(() => createTradeHeroCardStyles(tokens), [tokens]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [showAllTxns, setShowAllTxns] = useState(false);

  const { personName, personImage } = params;
  const detail = params.detail!;
  const ticker = detail.ticker;

  const quoteQuery = useQuery({
    queryKey: ['darkpool', 'trade-detail-quote', ticker],
    queryFn: async () => (await getQuotes([ticker])).get(ticker) ?? null,
    enabled: ticker.length > 0,
    staleTime: 60_000,
  });
  const price = quoteQuery.data?.price;
  const prevClose = quoteQuery.data?.previous_close;
  const livePrice = price != null && Number.isFinite(price) && price > 0 ? price : null;

  const shares = detail.shares;
  const held = shares > 0;
  // שווי: מחיר חי × כמות בדוח האחרון; בלי ציטוט — השווי המדווח
  const marketValue = held
    ? livePrice != null
      ? livePrice * shares
      : detail.reportedValueUsd
    : null;
  const todayUsd =
    held && livePrice != null && prevClose != null && prevClose > 0
      ? (livePrice - prevClose) * shares
      : null;
  const todayPct =
    livePrice != null && prevClose != null && prevClose > 0
      ? ((livePrice - prevClose) / prevClose) * 100
      : null;
  const costBasis = held && detail.avgCost != null && detail.avgCost > 0 ? detail.avgCost * shares : null;
  const totalUsd = marketValue != null && costBasis != null ? marketValue - costBasis : null;
  const totalPct = totalUsd != null && costBasis ? (totalUsd / costBasis) * 100 : null;

  const toneColor = (v: number | null) =>
    v == null
      ? tokens.colors.text.secondary
      : v >= 0
        ? tokens.colors.primary.main
        : tokens.colors.text.danger;

  const returnText = (u: number | null, p: number | null) =>
    u == null ? DARK_POOL_UNAVAILABLE : `${formatCongressDeltaUsd(u)} (${p != null ? formatSignedChangePct(p) : '—'})`;

  const txns = useMemo(() => [...detail.transactions].reverse(), [detail.transactions]);
  const visibleTxns = showAllTxns ? txns : txns.slice(0, TXN_PREVIEW);

  const openTicker = useCallback(() => {
    void HapticFeedback.impactLight();
    navigation.navigate('DarkPoolTicker', { ticker });
  }, [navigation, ticker]);

  return (
    <ScreenChrome rtl>
      <SafeAreaView style={[darkPoolTransparentFill, darkPoolRtlContent]} edges={['top']}>
        <View style={styles.topBar}>
          <DayNavBlurButton
            onPress={() => navigation.goBack()}
            glassIntensity="subtle"
            size={HEADER_BACK_BTN_SIZE}
            accessibilityLabel="חזרה"
          >
            <Ionicons name="chevron-forward" size={22} color={tokens.colors.text.primary} />
          </DayNavBlurButton>
          <Text style={styles.topBarTitle} numberOfLines={1} accessibilityRole="header">
            פרטי אחזקה
          </Text>
          <DayNavBlurButton
            onPress={() => {
              void HapticFeedback.selection();
              setHelpOpen(true);
            }}
            glassIntensity="subtle"
            size={HEADER_BACK_BTN_SIZE}
            accessibilityLabel="איך מחושבת האחזקה"
          >
            <Ionicons name="help-circle-outline" size={18} color={tokens.colors.text.secondary} />
          </DayNavBlurButton>
        </View>

        <ScrollView
          style={darkPoolTransparentFill}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, tradeHeroGlassFrameStyle(tokens)]}>
            <UICard
              {...TRADE_HERO_UICARD}
              style={tradeHeroInnerCardStyle(tokens)}
              contentContainerStyle={styles.heroPad}
            >
              <View style={heroStyles.heroBody}>
                <View style={heroStyles.headerRow}>
                  <InsiderAvatar name={personName} logoUrl={personImage ?? null} size={FEED_AVATAR_SIZE} />
                  <View style={heroStyles.textCol}>
                    <Text style={heroStyles.personName} numberOfLines={2}>
                      {personName}
                    </Text>
                    <Text style={[heroStyles.action, heroStyles.actionAfterName]}>
                      {held ? (
                        <>
                          <Text style={[heroStyles.actionVerb, { color: tokens.colors.primary.main }]}>
                            מחזיק
                          </Text>
                          <Text style={heroStyles.actionRest}>
                            {' '}
                            {toDataIsland(sharesText(shares))} מניות
                          </Text>
                        </>
                      ) : (
                        <Text style={[heroStyles.actionVerb, { color: tokens.colors.text.danger }]}>
                          יצא מהפוזיציה
                        </Text>
                      )}
                    </Text>
                  </View>
                </View>

                <Pressable onPress={openTicker} accessibilityRole="button" accessibilityLabel={`עמוד המניה ${ticker}`}>
                  <DarkPoolNestedQuoteCard
                    ticker={ticker}
                    priceText={livePrice != null ? usd(livePrice, 2) : null}
                    changeText={todayPct != null ? formatSignedChangePct(todayPct) : null}
                    changeColor={toneColor(todayPct)}
                    changeTone={todayPct == null ? undefined : todayPct >= 0 ? 'positive' : 'negative'}
                    loading={quoteQuery.isLoading && livePrice == null}
                    missingText={!quoteQuery.isLoading && livePrice == null ? DARK_POOL_UNAVAILABLE : null}
                  />
                </Pressable>
              </View>
            </UICard>
          </View>

          {held ? (
            <View style={styles.section}>
              <DarkPoolSectionHeader variant="group" title="הפוזיציה" />
              <UICard variant="soft" glassIntensity="light" padding="none" contentContainerStyle={styles.rowsCard}>
                <FieldRow icon={Layers} label="מניות" value={sharesText(shares)} />
                <FieldRow
                  icon={Wallet}
                  label="שווי אחזקה"
                  value={marketValue != null ? usd(marketValue) : DARK_POOL_UNAVAILABLE}
                />
                <FieldRow
                  icon={CircleDollarSign}
                  label="מחיר ממוצע"
                  value={detail.avgCost != null ? usd(detail.avgCost, 2) : DARK_POOL_UNAVAILABLE}
                  last
                />
              </UICard>
            </View>
          ) : null}

          {/* תשואת הפוזיציה — כרטיס נפרד מפרטי הפוזיציה */}
          {held ? (
            <View style={styles.section}>
              <DarkPoolSectionHeader variant="group" title="תשואת הפוזיציה" />
              <UICard variant="soft" glassIntensity="light" padding="none" contentContainerStyle={styles.rowsCard}>
                <FieldRow
                  icon={Activity}
                  label="תשואה היום"
                  value={returnText(todayUsd, todayPct)}
                  color={toneColor(todayUsd)}
                />
                <FieldRow
                  icon={ChartLine}
                  label="תשואה כוללת"
                  value={returnText(totalUsd, totalPct)}
                  color={toneColor(totalUsd)}
                  last
                />
              </UICard>
            </View>
          ) : null}

          {txns.length > 0 ? (
            <View style={styles.section}>
              <DarkPoolSectionHeader variant="group" title="שינויים בפוזיציה" />
              <UICard variant="soft" glassIntensity="light" padding="none" contentContainerStyle={styles.rowsCard}>
                {/* הרחבה/כיווץ עם מושן: השורות הנוספות נכנסות בדהייה והכרטיס מתארך בהחלקה */}
                {visibleTxns.map((t, i) => (
                  <Animated.View
                    key={`${t.date}-${t.side}`}
                    layout={LinearTransition.duration(240)}
                    entering={i >= TXN_PREVIEW ? FadeIn.duration(220).delay((i - TXN_PREVIEW) * 25) : undefined}
                    exiting={i >= TXN_PREVIEW ? FadeOut.duration(140) : undefined}
                  >
                    <TxnRow txn={t} last={i === visibleTxns.length - 1} />
                  </Animated.View>
                ))}
              </UICard>
              {txns.length > TXN_PREVIEW ? (
                <AnimatedPressable
                  layout={LinearTransition.duration(240)}
                  onPress={() => {
                    void HapticFeedback.selection();
                    setShowAllTxns((v) => !v);
                  }}
                  style={styles.moreBtn}
                  accessibilityRole="button"
                >
                  <Text style={styles.moreText}>{showAllTxns ? 'הצג פחות' : `הצג הכל (${txns.length})`}</Text>
                </AnimatedPressable>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      <HelpSheet
        visible={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={HONESTY_TITLE}
        body={HONESTY_BODY}
        gotItLabel="הבנתי"
      />
    </ScreenChrome>
  );
}

function FieldRow({
  icon: Icon,
  label,
  value,
  color,
  last = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  color?: string;
  last?: boolean;
}) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => rowStyles(tokens), [tokens]);
  const missing = value === DARK_POOL_UNAVAILABLE;
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={styles.labelCluster}>
        <Icon size={20} color={tokens.colors.text.primary} strokeWidth={2} />
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={[styles.value, !missing && styles.valueLtr, color ? { color } : null]} numberOfLines={1}>
        {missing ? value : toDataIsland(value)}
      </Text>
    </View>
  );
}

function TxnRow({ txn, last }: { txn: FilingPositionTxn; last: boolean }) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => rowStyles(tokens), [tokens]);
  const up = txn.side === 'new' || txn.side === 'buy';
  const color = up ? tokens.colors.primary.main : tokens.colors.text.danger;
  return (
    <View style={[styles.txnRow, last && styles.rowLast]}>
      <View style={styles.txnHead}>
        {/* תגית על רקע רך — כמו «מכה / מפספסת» בשיט הדוח הרבעוני */}
        <View style={[styles.sidePill, { backgroundColor: `${color}22` }]}>
          <Text style={[styles.sidePillText, { color }]} numberOfLines={1}>
            {SIDE_VERB[txn.side]}
          </Text>
        </View>
        <Text style={styles.historyDate} numberOfLines={1}>
          {toDataIsland(formatTradeDate(txn.date) ?? '')}
        </Text>
      </View>
      <View style={styles.txnCols}>
        <TxnCol label="מניות" value={sharesText(txn.shares)} />
        <TxnCol label="מחיר" value={txn.price != null ? usd(txn.price, 2) : '—'} />
        <TxnCol label="סה״כ" value={txn.totalUsd != null ? compactUsd(txn.totalUsd) : '—'} />
      </View>
    </View>
  );
}

function TxnCol({ label, value }: { label: string; value: string }) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => rowStyles(tokens), [tokens]);
  return (
    <View style={styles.txnCol}>
      <Text style={styles.txnColLabel}>{label}</Text>
      <Text style={styles.txnColValue} numberOfLines={1}>
        {toDataIsland(value)}
      </Text>
    </View>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>, bottomPadding: number) {
  return StyleSheet.create({
    topBar: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: tokens.layout.screenPadding,
      paddingTop: 4,
    },
    topBarTitle: {
      flex: 1,
      fontSize: DARK_POOL_TYPE.screenTitle.fontSize,
      lineHeight: DARK_POOL_TYPE.screenTitle.lineHeight,
      fontWeight: DARK_POOL_TYPE.screenTitle.fontWeight,
      letterSpacing: DARK_POOL_TYPE.screenTitle.letterSpacing,
      color: tokens.colors.text.primary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    scrollContent: {
      direction: 'rtl',
      paddingHorizontal: tokens.layout.screenPadding,
      paddingTop: APP_LAYOUT.componentGap + 12,
      paddingBottom: bottomPadding + 32,
    },
    card: { marginBottom: APP_LAYOUT.sectionGap },
    heroPad: {
      paddingHorizontal: FEED_RHYTHM.cardPadH,
      paddingVertical: FEED_RHYTHM.cardPadV,
    },
    rowsCard: {
      paddingHorizontal: APP_LAYOUT.cardPadding,
      paddingVertical: 4,
    },
    section: { marginBottom: APP_LAYOUT.sectionGap },
    tradeRow: {
      direction: 'ltr',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: APP_LAYOUT.cardTitleToBodyGap,
    },
    tradeStart: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tradeAmount: {
      fontSize: DARK_POOL_TYPE.cardBody.fontSize,
      lineHeight: DARK_POOL_TYPE.cardBody.lineHeight,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
      flexShrink: 1,
    },
    tradeDate: {
      fontSize: DARK_POOL_TYPE.cardSubtitle.fontSize,
      lineHeight: DARK_POOL_TYPE.cardSubtitle.lineHeight,
      fontVariant: ['tabular-nums'],
    },
    sidePillInline: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
    sidePillInlineText: { ...APP_TYPE.caption, fontWeight: '600' },
    moreBtn: {
      alignSelf: 'center',
      paddingVertical: APP_LAYOUT.stackGapSmall,
      paddingHorizontal: APP_LAYOUT.cardPadding,
      marginTop: APP_LAYOUT.stackGapSmall,
    },
    moreText: {
      fontSize: DARK_POOL_TYPE.cardBody.fontSize,
      lineHeight: DARK_POOL_TYPE.cardBody.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.secondary,
    },
  });
}

function rowStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    row: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: APP_LAYOUT.cardTitleToBodyGap,
      paddingVertical: APP_LAYOUT.cardTitleToBodyGap,
      borderBottomWidth: 1,
      borderBottomColor: tokens.colors.border.divider,
    },
    rowLast: { borderBottomWidth: 0 },
    labelCluster: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flexShrink: 1,
      minWidth: 0,
    },
    label: {
      ...darkPoolPhysicalRightText,
      fontSize: DARK_POOL_TYPE.cardBody.fontSize,
      lineHeight: DARK_POOL_TYPE.cardBody.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
      flexShrink: 0,
    },
    value: {
      fontSize: DARK_POOL_TYPE.cardBody.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.cardBody.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardBody.fontWeight,
      color: tokens.colors.text.secondary,
      flexShrink: 1,
      minWidth: 0,
      textAlign: 'left',
    },
    valueLtr: { writingDirection: 'ltr' },
    txnRow: {
      direction: 'rtl',
      gap: APP_LAYOUT.stackGapSmall,
      paddingVertical: APP_LAYOUT.cardTitleToBodyGap,
      borderBottomWidth: 1,
      borderBottomColor: tokens.colors.border.divider,
    },
    txnHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sidePill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, flexShrink: 1 },
    sidePillText: { ...APP_TYPE.caption, fontWeight: '600' },
    historyDate: {
      fontSize: DARK_POOL_TYPE.cardSubtitle.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.cardSubtitle.lineHeight,
      color: tokens.colors.text.secondary,
    },
    txnCols: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: APP_LAYOUT.stackGapSmall,
    },
    txnCol: { flex: 1, minWidth: 0, gap: 2 },
    txnColLabel: {
      ...darkPoolPhysicalRightText,
      fontSize: DARK_POOL_TYPE.cardSubtitle.fontSize,
      lineHeight: DARK_POOL_TYPE.cardSubtitle.lineHeight,
      color: tokens.colors.text.secondary,
    },
    txnColValue: {
      ...darkPoolPhysicalRightText,
      fontSize: DARK_POOL_TYPE.cardBody.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.cardBody.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
    },
  });
}
