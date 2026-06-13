/**
 * פרופיל מנהל קרן — תיק 13F מ-sec-api.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import UICard from '../../components/ui/UICard';
import UIButton from '../../components/ui/UIButton';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { TickerLogo } from '../Portfolios/components/TickerLogo';
import { useFundProfile } from '../../hooks/useFundProfile';
import { PortfolioValueChart } from '../Portfolios/components/PortfolioValueChart';
import type { PerformancePeriod } from '../Portfolios/portfolioTypes';
import { formatUsdCompact } from './utils/darkPoolFormat';
import { ProfileHeroAvatar } from './components/ProfileHeroAvatar';
import {
  HoldingsPieSection,
  HoldingTickerDot,
  useHoldingsPieColors,
} from './components/HoldingsPieSection';
import { HapticFeedback } from '../../utils/hapticFeedback';
import {
  isFollowingInvestor,
  toggleFollowInvestor,
  type FollowedInvestor,
} from '../../services/darkpool/darkPoolFollowService';

interface Props {
  cik: string;
  nameHint?: string;
  imageHint?: string | null;
  onBack: () => void;
  onTickerPress: (ticker: string) => void;
}

export function FundManagerProfileScreen({
  cik,
  nameHint,
  imageHint,
  onBack,
  onTickerPress,
}: Props) {
  const tokens = useDesignTokens();
  const { profile, loading, refreshing, error, refetch } = useFundProfile(cik);
  const [following, setFollowing] = useState(false);
  const [period, setPeriod] = useState<PerformancePeriod>('All');

  const displayName = profile?.name ?? nameHint ?? 'מנהל קרן';
  const imageUrl = profile?.image_url ?? imageHint ?? null;
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const chartSeries = useMemo(
    () => (profile?.value_series ?? []).map((p) => ({ date: p.date, value: p.value })),
    [profile?.value_series]
  );
  const fundPieColors = useHoldingsPieColors(profile?.holdings ?? []);

  React.useEffect(() => {
    void isFollowingInvestor(cik, 'fund_manager').then(setFollowing);
  }, [cik]);

  const onFollow = useCallback(async () => {
    void HapticFeedback.impactMedium();
    const person: FollowedInvestor = {
      id: cik,
      kind: 'fund_manager',
      name: displayName,
      image_url: imageUrl,
    };
    setFollowing(await toggleFollowInvestor(person));
  }, [cik, displayName, imageUrl]);

  const openTicker = useCallback(
    (sym: string) => {
      void HapticFeedback.impactLight();
      onTickerPress(sym);
    },
    [onTickerPress]
  );

  if (loading && !profile) {
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

  const stats = profile?.stats;
  const emptyHoldings = !profile?.holdings.length;
  const periodKey = period === 'All' ? 'ALL' : period;
  const periodReturn =
    stats?.period_returns?.[periodKey] ?? stats?.total_return_pct ?? null;

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
              kind="fund_manager"
              personId={cik}
            />
            <Text style={styles.heroName}>{displayName}</Text>
            {profile?.subtitle ? (
              <Text style={styles.heroSub}>{profile.subtitle}</Text>
            ) : (
              <Text style={styles.heroSub}>תיק 13F · רבעוני</Text>
            )}

            {stats?.total_value_usd != null ? (
              <>
                <Text style={styles.heroValue}>{formatUsdCompact(stats.total_value_usd)}</Text>
                <Text style={styles.heroValueHint}>שווי אחזקות מדווח (13F)</Text>
                {periodReturn != null ? (
                  <Text
                    style={[
                      styles.heroDelta,
                      {
                        color:
                          periodReturn >= 0
                            ? tokens.colors.primary.main
                            : tokens.colors.text.danger,
                      },
                    ]}
                  >
                    {periodReturn >= 0 ? '▲' : '▼'} {Math.abs(periodReturn).toFixed(2)}%
                    {period !== 'All' ? ` · ${period}` : ' · ALL'}
                  </Text>
                ) : null}
              </>
            ) : null}

            {stats ? (
              <Text style={styles.heroActivity}>
                {stats.holdings_count} אחזקות
                {stats.filing_date ? ` · דיווח ${formatDateHe(stats.filing_date)}` : ''}
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
          ) : null}

          {emptyHoldings ? (
            <UICard variant="outlined" padding="md">
              <Text style={styles.muted}>
                אין נתוני 13F ב-DB עדיין. משוך לרענון — הסנכרון רץ אוטומטית פעם ביום.
              </Text>
            </UICard>
          ) : (
            <>
              <Text style={styles.sectionTitle}>אחזקות מובילות (13F)</Text>
              <HoldingsPieSection
                title="פילוח לפי שווי 13F"
                holdings={profile!.holdings.map((h) => ({
                  ticker: h.ticker,
                  allocation_pct: h.allocation_pct,
                  value_usd: h.value_usd,
                }))}
              />
              {profile!.holdings.map((h) => (
                <Pressable
                  key={h.ticker}
                  onPress={() => openTicker(h.ticker)}
                  style={({ pressed }) => pressed && { opacity: 0.92 }}
                >
                  <UICard variant="glass" padding="sm" style={styles.listCard}>
                    <View style={styles.listRow}>
                      <TickerLogo symbol={h.ticker} size={40} borderRadius={10} />
                      <View style={styles.listMid}>
                        <View style={styles.listTopLine}>
                          <Text style={styles.listTicker}>{h.ticker}</Text>
                          <HoldingTickerDot ticker={h.ticker} colorByTicker={fundPieColors} />
                        </View>
                        {h.issuer_name ? (
                          <Text style={styles.listSub} numberOfLines={1}>
                            {h.issuer_name}
                          </Text>
                        ) : null}
                        {h.shares != null ? (
                          <Text style={styles.listMeta}>
                            {Math.round(h.shares).toLocaleString('en-US')} מניות
                          </Text>
                        ) : null}
                      </View>
                      {h.value_usd != null ? (
                        <Text style={styles.listAmt}>{formatUsdCompact(h.value_usd)}</Text>
                      ) : null}
                    </View>
                  </UICard>
                </Pressable>
              ))}
            </>
          )}

          <Text style={styles.disclaimer}>
            מ-Form 13F (SEC). עיכוב עד 45 יום — לא ייעוץ.
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
      <Text style={[headerStyles.title, { color: tokens.colors.text.primary }]}>קרן / 13F</Text>
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
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800' },
});

function formatDateHe(raw: string): string {
  const d = raw.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return raw;
  return `${m[3]}.${m[2]}.${m[1]}`;
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
    errCard: { marginBottom: 12 },
    errText: { color: tokens.colors.text.danger, fontSize: 13, textAlign: 'left' },
    hero: { alignItems: 'center', marginBottom: 20 },
    heroName: {
      marginTop: 12,
      fontSize: 22,
      fontWeight: '900',
      color: tokens.colors.text.primary,
      textAlign: 'center',
    },
    heroSub: { marginTop: 6, fontSize: 13, color: tokens.colors.text.tertiary, textAlign: 'center' },
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
    heroActivity: {
      marginTop: 10,
      fontSize: 14,
      fontWeight: '600',
      color: tokens.colors.text.secondary,
      textAlign: 'center',
    },
    heroActions: { marginTop: 14, alignItems: 'center' },
    heroDelta: {
      marginTop: 8,
      fontSize: 15,
      fontWeight: '800',
      textAlign: 'center',
    },
    chartCard: {
      marginBottom: 16,
      borderRadius: tokens.borderRadius.lg,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      textAlign: 'left',
      marginBottom: 10,
    },
    listCard: { marginBottom: tokens.spacing.sm, borderRadius: tokens.borderRadius.lg },
    listRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    listMid: { flex: 1, alignItems: 'flex-start', minWidth: 0 },
    listTopLine: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      gap: 8,
    },
    listTicker: { fontSize: 15, fontWeight: '800', color: tokens.colors.text.primary },
    listPct: { fontSize: 13, fontWeight: '800', color: tokens.colors.primary.main },
    listSub: { fontSize: 12, color: tokens.colors.text.tertiary, marginTop: 2 },
    listMeta: { fontSize: 11, color: tokens.colors.text.secondary, marginTop: 4 },
    listAmt: { fontSize: 13, fontWeight: '700', color: tokens.colors.text.primary },
    muted: { fontSize: 13, color: tokens.colors.text.tertiary, textAlign: 'left', lineHeight: 20 },
    disclaimer: {
      marginTop: 24,
      fontSize: 11,
      color: tokens.colors.text.tertiary,
      textAlign: 'center',
      lineHeight: 16,
    },
  });
}
