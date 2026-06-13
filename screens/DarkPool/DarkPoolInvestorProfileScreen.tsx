/**
 * פרופיל «תיק» של פוליטיקאי / בכיר — holdings ועסקאות מ-UW (לא תיק משתמש).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import UICard from '../../components/ui/UICard';
import UIButton from '../../components/ui/UIButton';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useDarkPoolInvestorProfile } from '../../hooks/useDarkPoolInvestorProfile';
import { useDarkPoolStackNav } from './hooks/useDarkPoolStackNav';
import { TickerLogo } from '../Portfolios/components/TickerLogo';
import { PortfolioValueChart } from '../Portfolios/components/PortfolioValueChart';
import type { PerformancePeriod } from '../Portfolios/portfolioTypes';
import { formatUsdCompact } from './utils/darkPoolFormat';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { ProfileHeroAvatar } from './components/ProfileHeroAvatar';
import type { DarkPoolStackParamList } from '../../navigation/DarkPoolStack';
import {
  isFollowingInvestor,
  toggleFollowInvestor,
  type FollowedInvestor,
} from '../../services/darkpool/darkPoolFollowService';
import { valuesToSparklinePoints } from './utils/sparkline';
import { PoliticianProfileScreen } from './PoliticianProfileScreen';
import { FundManagerProfileScreen } from './FundManagerProfileScreen';

type Route = RouteProp<DarkPoolStackParamList, 'DarkPoolInvestor'>;

export default function DarkPoolInvestorProfileScreen() {
  const stackNav = useDarkPoolStackNav();
  const route = useRoute<Route>();
  const { id, kind, ticker, nameHint, imageHint } = route.params;

  if (kind === 'politician') {
    return (
      <PoliticianProfileScreen
        politicianId={id}
        nameHint={nameHint}
        imageHint={imageHint}
        onBack={() => stackNav.goBack()}
        onTickerPress={(t) => stackNav.navigate('DarkPoolTicker', { ticker: t })}
      />
    );
  }

  if (kind === 'fund_manager') {
    return (
      <FundManagerProfileScreen
        cik={id}
        nameHint={nameHint}
        imageHint={imageHint}
        onBack={() => stackNav.goBack()}
        onTickerPress={(t) => stackNav.navigate('DarkPoolTicker', { ticker: t })}
      />
    );
  }

  return (
    <InsiderInvestorProfileBody
      id={id}
      kind={kind}
      ticker={ticker}
      nameHint={nameHint}
      imageHint={imageHint}
    />
  );
}

function InsiderInvestorProfileBody({
  id,
  kind,
  ticker,
  nameHint,
  imageHint,
}: {
  id: string;
  kind: 'insider';
  ticker?: string;
  nameHint?: string;
  imageHint?: string | null;
}) {
  const tokens = useDesignTokens();
  const stackNav = useDarkPoolStackNav();
  const { profile, loading, refreshing, error, refetch } = useDarkPoolInvestorProfile(
    id,
    kind,
    ticker
  );

  const [following, setFollowing] = useState(false);
  const [period, setPeriod] = useState<PerformancePeriod>('All');
  const [chartW, setChartW] = useState(0);
  const chartH = 72;

  useEffect(() => {
    void isFollowingInvestor(id, kind).then(setFollowing);
  }, [id, kind]);

  const displayName = profile?.name ?? nameHint ?? 'משקיע';
  const imageUrl = profile?.image_url ?? imageHint ?? null;
  const m = profile?.metrics ?? null;
  const spark = profile?.sparkline_values ?? [];
  const chartSeries = useMemo(
    () => (m?.series ?? []).map((p) => ({ date: p.date, value: p.value })),
    [m?.series]
  );
  const periodKey = period === 'All' ? 'ALL' : period;
  const periodReturn = m?.period_returns?.[periodKey] ?? m?.total_return_pct ?? null;
  const hasMetrics = !!m && m.holdings.length > 0;
  const polyPoints = useMemo(
    () =>
      chartW > 4 && spark.length >= 2
        ? valuesToSparklinePoints(spark, chartW, chartH)
        : '',
    [chartW, chartH, spark]
  );

  const onFollow = useCallback(async () => {
    void HapticFeedback.impactMedium();
    const person: FollowedInvestor = {
      id,
      kind,
      name: displayName,
      image_url: imageUrl,
      ticker,
    };
    const next = await toggleFollowInvestor(person);
    setFollowing(next);
  }, [id, kind, displayName, imageUrl, ticker]);

  const openTicker = useCallback(
    (sym: string) => {
      void HapticFeedback.impactLight();
      stackNav.navigate('DarkPoolTicker', { ticker: sym, tab: 'insider' });
    },
    [stackNav]
  );

  const styles = useMemo(() => createStyles(tokens), [tokens]);

  if (loading && !profile) {
    return (
      <ScreenChrome rtl>
        <StatusBar style="light" />
        <SafeAreaView style={styles.safe} edges={['top']}>
          <Header onBack={() => stackNav.goBack()} title="פרופיל" tokens={tokens} />
          <View style={styles.center}>
            <ActivityIndicator color={tokens.colors.primary.main} />
          </View>
        </SafeAreaView>
      </ScreenChrome>
    );
  }

  return (
    <ScreenChrome rtl withBrandWatermark>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header
          onBack={() => stackNav.goBack()}
          title={kind === 'politician' ? 'פוליטיקאי' : 'בכיר'}
          tokens={tokens}
        />
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refetch()}
              tintColor={tokens.colors.primary.main}
            />
          }
          contentContainerStyle={styles.scroll}
        >
          {error ? (
            <UICard variant="outlined" padding="md" style={styles.errCard}>
              <Text style={styles.errText}>{error}</Text>
            </UICard>
          ) : null}

          <View style={styles.hero}>
            <ProfileHeroAvatar
              name={displayName}
              imageUrl={profile?.image_url ?? null}
              imageHint={imageHint}
              ticker={ticker}
              kind="insider"
              personId={id}
            />
            <Text style={styles.heroName}>{displayName}</Text>
            {profile?.subtitle ? (
              <Text style={styles.heroSub}>{profile.subtitle}</Text>
            ) : null}
            {hasMetrics ? (
              <>
                <Text style={styles.heroValue}>{formatUsdCompact(m!.portfolio_value)}</Text>
                <Text style={styles.heroValueHint}>שווי מוערך מעסקאות Form 4</Text>
                <Text
                  style={[
                    styles.heroDelta,
                    {
                      color:
                        (m!.total_return_usd ?? 0) >= 0
                          ? tokens.colors.primary.main
                          : tokens.colors.text.danger,
                    },
                  ]}
                >
                  {(m!.total_return_usd >= 0 ? '+' : '') + formatUsdCompact(m!.total_return_usd)}
                  {periodReturn != null
                    ? ` · ${periodReturn >= 0 ? '▲' : '▼'} ${Math.abs(periodReturn).toFixed(2)}%`
                    : ''}
                </Text>
              </>
            ) : profile?.portfolio_snapshot ? (
              <Text style={styles.heroValue}>
                {profile.portfolio_snapshot.estimated_value_label}
                <Text style={styles.heroValueHint}> שווי מדווח משוער</Text>
              </Text>
            ) : null}
            <View style={styles.heroActions}>
              <UIButton
                title={following ? 'במעקב' : 'עקוב'}
                variant={following ? 'secondary' : 'primary'}
                size="sm"
                onPress={() => void onFollow()}
                icon={following ? 'checkmark' : 'person-add'}
              />
              <Text style={styles.copyHint}>
                {hasMetrics
                  ? 'מבוסס על עסקאות שדווחו + מחירי שוק — לא תיק מלא'
                  : profile?.portfolio_snapshot
                    ? `תיק מדווח ${profile.portfolio_snapshot.disclosure_year ?? ''} · UW`
                    : profile?.holdings_source === 'trades'
                      ? 'מבוסס עסקאות Form 4 (אין snapshot שנתי)'
                      : 'מבוסס דיווחי Form 4'}
              </Text>
            </View>
          </View>

          {profile ? (
            <>
              {profile.stats.total_trades > 0 ? (
                <View style={styles.statsRow}>
                  <StatBox
                    label="עסקאות"
                    value={String(profile.stats.total_trades)}
                    tokens={tokens}
                  />
                  <StatBox
                    label="טיקרים"
                    value={String(profile.stats.unique_tickers)}
                    tokens={tokens}
                  />
                  {profile.stats.last_active_days != null ? (
                    <StatBox
                      label="פעילות"
                      value={`לפני ${profile.stats.last_active_days} ימ׳`}
                      tokens={tokens}
                    />
                  ) : null}
                </View>
              ) : null}

              {hasMetrics && m!.holdings.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>פוזיציות פתוחות</Text>
                  {m!.holdings.slice(0, 16).map((h) => (
                    <Pressable
                      key={h.ticker}
                      onPress={() => openTicker(h.ticker)}
                      style={({ pressed }) => [styles.holdingRow, pressed && { opacity: 0.9 }]}
                    >
                      <TickerLogo symbol={h.ticker} size={40} borderRadius={10} />
                      <View style={styles.holdingText}>
                        <Text style={styles.holdingTicker}>{h.ticker}</Text>
                        <Text style={styles.holdingMeta}>
                          {Math.round(h.qty).toLocaleString('en-US')} מניות ·{' '}
                          {formatUsdCompact(h.market_value)} ·{' '}
                          {h.return_pct >= 0 ? '+' : ''}
                          {h.return_pct.toFixed(1)}%
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-back"
                        size={16}
                        color={tokens.colors.text.tertiary}
                      />
                    </Pressable>
                  ))}
                </>
              ) : profile.holdings.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>פוזיציות פתוחות</Text>
                  {profile.holdings.slice(0, 16).map((h) => (
                    <Pressable
                      key={h.ticker}
                      onPress={() => openTicker(h.ticker)}
                      style={({ pressed }) => [styles.holdingRow, pressed && { opacity: 0.9 }]}
                    >
                      <TickerLogo symbol={h.ticker} size={40} borderRadius={10} />
                      <View style={styles.holdingText}>
                        <Text style={styles.holdingTicker}>{h.ticker}</Text>
                        {h.issuer ? (
                          <Text style={styles.holdingIssuer} numberOfLines={1}>
                            {h.issuer}
                          </Text>
                        ) : null}
                        <Text style={styles.holdingMeta}>
                          {profile.holdings_source === 'snapshot'
                            ? [h.amount_label, h.txn_mix].filter(Boolean).join(' · ')
                            : `${h.trade_count} עסקאות · ${h.txn_mix}${h.amount_label ? ` · ${h.amount_label}` : ''}${h.last_trade_date ? ` · ${h.last_trade_date}` : ''}`}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-back"
                        size={16}
                        color={tokens.colors.text.tertiary}
                      />
                    </Pressable>
                  ))}
                </>
              ) : null}

              {profile.recent_trades.length > 0 ? (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: 16 }]}>עסקאות אחרונות</Text>
                  {profile.recent_trades.slice(0, 10).map((t, index) => (
                    <Pressable
                      key={`${t.id}-${index}`}
                      onPress={() => openTicker(t.ticker)}
                      style={({ pressed }) => [styles.tradeRow, pressed && { opacity: 0.9 }]}
                    >
                      <View style={styles.tradeLeft}>
                        <Text style={styles.tradeTicker}>{t.ticker}</Text>
                        <Text style={styles.tradeTxn}>{t.txn_label}</Text>
                      </View>
                      <View style={styles.tradeRight}>
                        {t.amount_label ? (
                          <Text style={styles.tradeAmt}>{t.amount_label}</Text>
                        ) : null}
                        {t.date ? <Text style={styles.tradeDate}>{t.date}</Text> : null}
                      </View>
                    </Pressable>
                  ))}
                </>
              ) : null}

              {chartSeries.length >= 2 ? (
                <UICard variant="glass" padding="md" style={styles.chartCard}>
                  <PortfolioValueChart
                    series={chartSeries}
                    height={160}
                    currency="USD"
                    selectedPeriod={period}
                    onPeriodChange={setPeriod}
                  />
                </UICard>
              ) : spark.length >= 2 ? (
                <UICard variant="glass" padding="md" style={styles.chartCard}>
                  <Text style={styles.sectionTitle}>פעילות דיווחים</Text>
                  <View
                    style={styles.chartBox}
                    onLayout={(e: LayoutChangeEvent) => {
                      const w = Math.floor(e.nativeEvent.layout.width);
                      if (w > 0 && Math.abs(w - chartW) > 1) setChartW(w);
                    }}
                  >
                    {polyPoints ? (
                      <Svg width={chartW} height={chartH}>
                        <Polyline
                          points={polyPoints}
                          stroke={tokens.colors.primary.main}
                          strokeWidth={2.5}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          fill="none"
                        />
                      </Svg>
                    ) : null}
                  </View>
                </UICard>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ScreenChrome>
  );
}

function Header({
  onBack,
  title,
  tokens,
}: {
  onBack: () => void;
  title: string;
  tokens: ReturnType<typeof useDesignTokens>;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        direction: 'rtl',
      }}
    >
      <Pressable onPress={onBack} hitSlop={12} accessibilityLabel="חזרה">
        <Ionicons name="arrow-forward" size={24} color={tokens.colors.text.primary} />
      </Pressable>
      <Text
        style={{
          flex: 1,
          textAlign: 'center',
          fontSize: 17,
          fontWeight: '800',
          color: tokens.colors.text.primary,
        }}
      >
        {title}
      </Text>
      <View style={{ width: 24 }} />
    </View>
  );
}

function StatBox({
  label,
  value,
  tokens,
}: {
  label: string;
  value: string;
  tokens: ReturnType<typeof useDesignTokens>;
}) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'flex-start',
        padding: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: tokens.colors.border.subtle,
      }}
    >
      <Text style={{ fontSize: 11, color: tokens.colors.text.tertiary }}>{label}</Text>
      <Text
        style={{
          marginTop: 4,
          fontSize: 15,
          fontWeight: '800',
          color: tokens.colors.text.primary,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    safe: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: {
      direction: 'rtl',
      paddingHorizontal: tokens.layout.screenPadding,
      paddingBottom: 40,
    },
    errCard: { marginBottom: 12 },
    errText: {
      color: tokens.colors.text.danger,
      textAlign: 'left',
      fontSize: 13,
    },
    hero: { alignItems: 'center', marginBottom: 20 },
    heroName: {
      marginTop: 12,
      fontSize: 22,
      fontWeight: '900',
      color: tokens.colors.text.primary,
      textAlign: 'center',
    },
    heroSub: {
      marginTop: 6,
      fontSize: 13,
      color: tokens.colors.text.tertiary,
      textAlign: 'center',
    },
    heroValue: {
      marginTop: 10,
      fontSize: 28,
      fontWeight: '900',
      color: tokens.colors.primary.main,
      textAlign: 'center',
    },
    heroValueHint: {
      fontSize: 12,
      fontWeight: '600',
      color: tokens.colors.text.tertiary,
    },
    heroDelta: {
      marginTop: 8,
      fontSize: 15,
      fontWeight: '800',
      textAlign: 'center',
    },
    heroActions: { marginTop: 14, alignItems: 'center', gap: 8 },
    copyHint: {
      fontSize: 11,
      color: tokens.colors.text.tertiary,
      textAlign: 'center',
      paddingHorizontal: 16,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    chartCard: {
      marginBottom: 20,
      borderRadius: tokens.borderRadius.xl,
    },
    chartBox: { marginTop: 8, height: 72, width: '100%' },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      textAlign: 'left',
      marginBottom: 10,
    },
    sourceNote: {
      marginTop: 8,
      fontSize: 11,
      color: tokens.colors.text.tertiary,
      textAlign: 'left',
    },
    muted: {
      fontSize: 13,
      color: tokens.colors.text.tertiary,
      textAlign: 'left',
      marginBottom: 12,
    },
    holdingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: tokens.colors.border.subtle,
    },
    holdingText: { flex: 1, alignItems: 'flex-start' },
    holdingTopLine: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      gap: 8,
    },
    holdingTicker: {
      fontSize: 16,
      fontWeight: '800',
      color: tokens.colors.text.primary,
    },
    holdingPct: {
      fontSize: 13,
      fontWeight: '800',
      color: tokens.colors.primary.main,
    },
    allocBar: {
      height: 4,
      borderRadius: 2,
      width: '100%',
      marginTop: 6,
      overflow: 'hidden',
    },
    allocFill: { height: '100%', borderRadius: 2 },
    holdingIssuer: {
      fontSize: 12,
      color: tokens.colors.text.tertiary,
      marginTop: 2,
    },
    holdingMeta: {
      fontSize: 11,
      color: tokens.colors.text.secondary,
      marginTop: 4,
    },
    tradeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: tokens.colors.border.subtle,
    },
    tradeLeft: { alignItems: 'flex-start' },
    tradeRight: { alignItems: 'flex-start' },
    tradeTicker: {
      fontSize: 15,
      fontWeight: '800',
      color: tokens.colors.primary.main,
    },
    tradeTxn: { fontSize: 12, color: tokens.colors.text.secondary, marginTop: 2 },
    tradeAmt: { fontSize: 12, color: tokens.colors.text.primary },
    tradeDate: { fontSize: 11, color: tokens.colors.text.tertiary, marginTop: 2 },
  });
}
