/**
 * פרופיל פוליטיקאי — עיצוב אחיד עם פרופיל בכירים.
 */

import React, { useCallback, useMemo, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import UICard from '../../components/ui/UICard';
import UIButton from '../../components/ui/UIButton';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { PortfolioValueChart } from '../Portfolios/components/PortfolioValueChart';
import type { PerformancePeriod } from '../Portfolios/portfolioTypes';
import { TickerLogo } from '../Portfolios/components/TickerLogo';
import { usePoliticianMetrics } from '../../hooks/usePoliticianMetrics';
import { useDarkPoolInvestorProfile } from '../../hooks/useDarkPoolInvestorProfile';
import { formatUsdCompact } from './utils/darkPoolFormat';
import { valuesToSparklinePoints } from './utils/sparkline';
import { ProfileHeroAvatar } from './components/ProfileHeroAvatar';
import { HapticFeedback } from '../../utils/hapticFeedback';
import {
  isFollowingInvestor,
  toggleFollowInvestor,
  type FollowedInvestor,
} from '../../services/darkpool/darkPoolFollowService';

interface Props {
  politicianId: string;
  nameHint?: string;
  imageHint?: string | null;
  onBack: () => void;
  onTickerPress: (ticker: string) => void;
}

export function PoliticianProfileScreen({
  politicianId,
  nameHint,
  imageHint,
  onBack,
  onTickerPress,
}: Props) {
  const tokens = useDesignTokens();
  const { data: metricsData, loading: metricsLoading, refetch: refetchMetrics } =
    usePoliticianMetrics(politicianId);
  const { profile, refreshing, refetch: refetchProfile } = useDarkPoolInvestorProfile(
    politicianId,
    'politician'
  );

  const [period, setPeriod] = useState<PerformancePeriod>('All');
  const [following, setFollowing] = useState(false);
  const [chartW, setChartW] = useState(0);
  const sparkH = 72;

  const displayName = metricsData?.name ?? profile?.name ?? nameHint ?? 'פוליטיקאי';
  const imageUrl = metricsData?.image_url ?? profile?.image_url ?? imageHint ?? null;
  const m = metricsData?.metrics ?? profile?.metrics ?? null;
  const spark = profile?.sparkline_values ?? [];
  const polyPoints = useMemo(
    () =>
      chartW > 4 && spark.length >= 2
        ? valuesToSparklinePoints(spark, chartW, sparkH)
        : '',
    [chartW, sparkH, spark]
  );

  React.useEffect(() => {
    void isFollowingInvestor(politicianId, 'politician').then(setFollowing);
  }, [politicianId]);

  const onFollow = useCallback(async () => {
    void HapticFeedback.impactMedium();
    const person: FollowedInvestor = {
      id: politicianId,
      kind: 'politician',
      name: displayName,
      image_url: imageUrl,
    };
    setFollowing(await toggleFollowInvestor(person));
  }, [politicianId, displayName, imageUrl]);

  const chartSeries = useMemo(
    () => (m?.series ?? []).map((p) => ({ date: p.date, value: p.value })),
    [m?.series]
  );

  const periodKey = period === 'All' ? 'ALL' : period;
  const periodReturn = m?.period_returns?.[periodKey] ?? m?.total_return_pct ?? null;
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const loading = metricsLoading && !metricsData && !profile;

  const openTicker = useCallback(
    (sym: string) => {
      void HapticFeedback.impactLight();
      onTickerPress(sym);
    },
    [onTickerPress]
  );

  if (loading) {
    return (
      <ScreenChrome rtl>
        <StatusBar style="light" />
        <SafeAreaView style={styles.safe} edges={['top']}>
          <Header onBack={onBack} tokens={tokens} />
          <View style={styles.center}>
            <ActivityIndicator color={tokens.colors.primary.main} />
          </View>
        </SafeAreaView>
      </ScreenChrome>
    );
  }

  const hasMetrics = !!m && m.holdings.length > 0;
  const showProfileStats = !hasMetrics && (profile?.stats.total_trades ?? 0) > 0;

  return (
    <ScreenChrome rtl>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header onBack={onBack} tokens={tokens} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                void refetchProfile();
                void refetchMetrics();
              }}
              tintColor={tokens.colors.primary.main}
            />
          }
          contentContainerStyle={styles.scroll}
        >
          <View style={styles.hero}>
            <ProfileHeroAvatar
              name={displayName}
              imageUrl={metricsData?.image_url ?? profile?.image_url ?? null}
              imageHint={imageHint}
              kind="politician"
              personId={politicianId}
            />
            <Text style={styles.heroName}>{displayName}</Text>
            {profile?.subtitle ? (
              <Text style={styles.heroSub}>{profile.subtitle}</Text>
            ) : (
              <Text style={styles.heroSub}>פעילות מסחר · STIR</Text>
            )}

            {hasMetrics ? (
              <>
                <Text style={styles.heroValue}>{formatUsdCompact(m!.portfolio_value)}</Text>
                <Text style={styles.heroValueHint}>שווי משוער מעסקאות שדווחו</Text>
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
                  {periodReturn != null ? ` · ${periodReturn >= 0 ? '▲' : '▼'} ${Math.abs(periodReturn).toFixed(2)}%` : ''}
                </Text>
              </>
            ) : showProfileStats ? (
              <Text style={styles.heroActivity}>
                {profile!.stats.total_trades} עסקאות · {profile!.stats.unique_tickers} טיקרים
                {profile!.stats.last_active_days != null
                  ? ` · פעיל לפני ${profile!.stats.last_active_days} ימ׳`
                  : ''}
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
            </View>
          </View>

          {hasMetrics ? (
            <View style={styles.statsRow}>
              {m!.win_rate != null ? (
                <StatBox label="Win Rate" value={`${m!.win_rate}%`} tokens={tokens} />
              ) : null}
              {m!.avg_delay_days != null ? (
                <StatBox label="Avg Delay" value={`${m!.avg_delay_days}d`} tokens={tokens} />
              ) : null}
              <StatBox label="עסקאות" value={String(m!.trade_count)} tokens={tokens} />
            </View>
          ) : showProfileStats ? (
            <View style={styles.statsRow}>
              <StatBox label="עסקאות" value={String(profile!.stats.total_trades)} tokens={tokens} />
              <StatBox label="טיקרים" value={String(profile!.stats.unique_tickers)} tokens={tokens} />
              {profile!.stats.last_active_days != null ? (
                <StatBox
                  label="פעילות"
                  value={`לפני ${profile!.stats.last_active_days} ימ׳`}
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
                  style={({ pressed }) => pressed && { opacity: 0.92 }}
                >
                  <UICard variant="glass" padding="sm" style={styles.listCard}>
                    <View style={styles.listRow}>
                      <TickerLogo symbol={h.ticker} size={40} borderRadius={10} />
                      <View style={styles.listMid}>
                        <Text style={styles.listTicker}>{h.ticker}</Text>
                        <Text style={styles.listSub}>
                          {Math.round(h.qty).toLocaleString('en-US')} מניות ·{' '}
                          {formatUsdCompact(h.market_value)}
                        </Text>
                      </View>
                      <View style={styles.listEnd}>
                        <Text
                          style={[
                            styles.listRet,
                            {
                              color:
                                h.return_pct >= 0
                                  ? tokens.colors.primary.main
                                  : tokens.colors.text.danger,
                            },
                          ]}
                        >
                          {h.return_pct >= 0 ? '+' : ''}
                          {h.return_pct.toFixed(1)}%
                        </Text>
                        <Text style={styles.listDate}>{h.allocation_pct.toFixed(0)}%</Text>
                      </View>
                    </View>
                  </UICard>
                </Pressable>
              ))}
            </>
          ) : profile && profile.holdings.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>פוזיציות פתוחות</Text>
              {profile.holdings.slice(0, 16).map((h) => (
                <Pressable
                  key={h.ticker}
                  onPress={() => openTicker(h.ticker)}
                  style={({ pressed }) => pressed && { opacity: 0.92 }}
                >
                  <UICard variant="glass" padding="sm" style={styles.listCard}>
                    <View style={styles.listRow}>
                      <TickerLogo symbol={h.ticker} size={40} borderRadius={10} />
                      <View style={styles.listMid}>
                        <Text style={styles.listTicker}>{h.ticker}</Text>
                        {displayIssuer(h.issuer) ? (
                          <Text style={styles.listSub} numberOfLines={1}>
                            {displayIssuer(h.issuer)}
                          </Text>
                        ) : null}
                        <Text style={styles.listMeta} numberOfLines={2}>
                          {formatHoldingMeta(h)}
                        </Text>
                      </View>
                    </View>
                  </UICard>
                </Pressable>
              ))}
            </>
          ) : null}

          {profile && profile.recent_trades.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>עסקאות אחרונות</Text>
              {profile.recent_trades.slice(0, 10).map((t, index) => (
                <Pressable
                  key={`${t.id}-${index}`}
                  onPress={() => openTicker(t.ticker)}
                  style={({ pressed }) => pressed && { opacity: 0.92 }}
                >
                  <UICard variant="glass" padding="sm" style={styles.listCard}>
                    <View style={styles.listRow}>
                      <TickerLogo symbol={t.ticker} size={40} borderRadius={10} />
                      <View style={styles.listMid}>
                        <Text style={styles.listTicker}>{t.ticker}</Text>
                        <Text style={styles.listSub}>{t.txn_label}</Text>
                      </View>
                      <View style={styles.listEnd}>
                        {t.amount_label ? (
                          <Text style={styles.listAmt} numberOfLines={1}>
                            {t.amount_label}
                          </Text>
                        ) : null}
                        {t.date ? (
                          <Text style={styles.listDate}>{formatTradeDate(t.date)}</Text>
                        ) : null}
                      </View>
                    </View>
                  </UICard>
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
                style={styles.sparkBox}
                onLayout={(e: LayoutChangeEvent) => {
                  const w = Math.floor(e.nativeEvent.layout.width);
                  if (w > 0 && Math.abs(w - chartW) > 1) setChartW(w);
                }}
              >
                {polyPoints ? (
                  <Svg width={chartW} height={sparkH}>
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

          <Text style={styles.disclaimer}>
            מחושב מעסקאות STIR + מחירי Yahoo. לא ייעוץ — לא תיק רשמי.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </ScreenChrome>
  );
}

function Header({
  onBack,
  tokens,
}: {
  onBack: () => void;
  tokens: ReturnType<typeof useDesignTokens>;
}) {
  return (
    <View style={headerStyles.wrap}>
      <Pressable onPress={onBack} hitSlop={12} accessibilityLabel="חזרה">
        <Ionicons name="arrow-forward" size={24} color={tokens.colors.text.primary} />
      </Pressable>
      <Text style={[headerStyles.title, { color: tokens.colors.text.primary }]}>פוליטיקאי</Text>
      <View style={{ width: 24 }} />
    </View>
  );
}

const headerStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    direction: 'rtl',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
  },
});

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

function formatTradeDate(raw: string): string {
  const d = raw.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return raw;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function displayIssuer(issuer?: string | null): string | null {
  if (!issuer) return null;
  const l = issuer.trim().toLowerCase();
  if (['self', 'spouse', 'child', 'joint', 'dependent'].includes(l)) return null;
  return issuer.trim();
}

function formatHoldingMeta(h: {
  trade_count: number;
  txn_mix: string;
  owner_label?: string | null;
  last_trade_date?: string | null;
}): string {
  const parts: string[] = [`${h.trade_count} עסקאות`];
  const txn = simplifyTxnMix(h.txn_mix);
  if (txn) parts.push(txn);
  if (h.owner_label) parts.push(h.owner_label);
  if (h.last_trade_date) parts.push(`אחרון ${formatTradeDate(h.last_trade_date)}`);
  return parts.join(' · ');
}

function simplifyTxnMix(mix: string): string {
  const hasBuy = mix.includes('רכישה');
  const hasSell = mix.includes('מכירה');
  if (hasBuy && hasSell) return 'רכישה ומכירה';
  if (hasBuy) return 'רכישות';
  if (hasSell) return 'מכירות';
  return mix.replace(/,\s*/g, ' · ').slice(0, 40);
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    safe: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 200 },
    scroll: {
      direction: 'rtl',
      paddingHorizontal: tokens.layout.screenPadding,
      paddingBottom: 48,
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
      marginTop: 4,
      fontSize: 12,
      fontWeight: '600',
      color: tokens.colors.text.tertiary,
      textAlign: 'center',
    },
    heroDelta: {
      marginTop: 6,
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'center',
    },
    heroActivity: {
      marginTop: 10,
      fontSize: 14,
      fontWeight: '600',
      color: tokens.colors.text.secondary,
      textAlign: 'center',
      paddingHorizontal: 12,
    },
    heroActions: { marginTop: 14, alignItems: 'center' },
    statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    chartCard: { marginBottom: 16, borderRadius: tokens.borderRadius.xl },
    sparkBox: { marginTop: 8, height: 72, width: '100%' },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      textAlign: 'left',
      marginBottom: 10,
      marginTop: 8,
    },
    listCard: {
      marginBottom: tokens.spacing.sm,
      borderRadius: tokens.borderRadius.lg,
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    listMid: { flex: 1, alignItems: 'flex-start', minWidth: 0 },
    listTopLine: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      gap: 8,
    },
    listEnd: { alignItems: 'flex-end', maxWidth: '38%' },
    listTicker: {
      fontSize: 15,
      fontWeight: '800',
      color: tokens.colors.text.primary,
    },
    listPct: {
      fontSize: 13,
      fontWeight: '800',
      color: tokens.colors.primary.main,
    },
    listSub: { fontSize: 12, color: tokens.colors.text.tertiary, marginTop: 2 },
    listMeta: { fontSize: 11, color: tokens.colors.text.secondary, marginTop: 4, lineHeight: 16 },
    listAmt: { fontSize: 12, fontWeight: '600', color: tokens.colors.text.primary, textAlign: 'left' },
    listDate: { fontSize: 11, color: tokens.colors.text.tertiary, marginTop: 2 },
    listRet: { fontSize: 12, fontWeight: '700', marginTop: 2 },
    allocBar: {
      height: 4,
      borderRadius: 2,
      width: '100%',
      marginTop: 6,
      overflow: 'hidden',
    },
    allocFill: { height: '100%', borderRadius: 2 },
    disclaimer: {
      marginTop: 24,
      fontSize: 11,
      color: tokens.colors.text.tertiary,
      textAlign: 'center',
      lineHeight: 16,
    },
  });
}
