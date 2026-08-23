/**
 * פרופיל אדם מאוחד — גרף שווי תיק הוא ה-HERO.
 * politician / insider / fund_manager → אותו מבנה מסך.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { useDarkPoolInvestorProfile } from '../../hooks/useDarkPoolInvestorProfile';
import { useFundProfile } from '../../hooks/useFundProfile';
import { PortfolioValueChart } from '../Portfolios/components/PortfolioValueChart';
import { TickerLogo } from '../Portfolios/components/TickerLogo';
import type { PerformancePeriod } from '../Portfolios/portfolioTypes';
import {
  avgEntryPriceFromCost,
  formatAvgEntryUsd,
  formatUsdCompact,
  impliedFilingPriceFrom13f,
} from './utils/darkPoolFormat';
import {
  appendLivePortfolioPoint,
  pickDefaultChartPeriod,
  type ChartPoint,
} from './utils/profileChartSeries';
import {
  HoldingsPieSection,
  HoldingTickerDot,
  useHoldingsPieColors,
} from './components/HoldingsPieSection';
import type { HoldingAllocationInput } from './utils/holdingsAllocation';
import { ProfileHeroAvatar } from './components/ProfileHeroAvatar';
import { portraitPhotoCandidates } from './utils/investorPlaceholder';
import { HapticFeedback } from '../../utils/hapticFeedback';
import {
  toggleFollowInvestor,
} from '../../services/darkpool/darkPoolFollowService';
import { useFollowedInvestors } from '../../hooks/useFollowedInvestors';
import { NotificationService } from '../../services/notificationService';
import { useAppDialog } from '../../components/ui/AppDialogProvider';

export type PersonKind = 'politician' | 'insider' | 'fund_manager';

interface Props {
  id: string;
  kind: PersonKind;
  ticker?: string;
  nameHint?: string;
  imageHint?: string | null;
  onBack: () => void;
  onTickerPress: (ticker: string) => void;
}

type HoldingRow = {
  ticker: string;
  title: string;
  meta: string;
  allocation_pct?: number | null;
  market_value?: number | null;
  value_usd?: number | null;
  trade_count?: number;
  return_pct?: number | null;
  first_added_date?: string | null;
  /** מחיר ממוצע לכניסה (cost_usd / qty) — רק כשיש בסיס עלות משחזור */
  avg_price?: number | null;
  /**
   * מחיר כניסה מ־13F (value_usd / shares) — החלטת מוצר לקרנות.
   * רק למנהלי קרן כשיש שני השדות מהדיווח.
   */
  entry_price?: number | null;
  /** תווית תאריך: «כניסה» (שחזור) / «דיווח» (13F) */
  dateLabel?: 'added' | 'reported' | null;
};

type TradeRow = {
  key: string;
  ticker: string;
  label: string;
  amount: string | null;
  date: string | null;
};

function kindLabel(kind: PersonKind): string {
  if (kind === 'politician') return 'פוליטיקאי';
  if (kind === 'fund_manager') return 'מנהל קרן';
  return 'בכיר';
}

function kindDefaultSubtitle(kind: PersonKind): string {
  if (kind === 'politician') return 'דיווחי קונגרס';
  if (kind === 'fund_manager') return 'אחזקות רבעוניות';
  return 'עסקאות מדווחות';
}

function formatHoldingDateHe(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

/** תווית שווי אחזקה ליד סכום $ — בלי «הערכה» */
function formatHoldingValueLabel(v: number | null | undefined): string | null {
  if (v == null || !Number.isFinite(v)) return null;
  return `שווי אחזקה ${formatUsdCompact(v)}`;
}

/** אומדן תאריך הוספה מעסקאות אחרונות — עד שה־edge מחזיר first_added_date מלא */
function earliestBuyDateFromRecent(
  ticker: string,
  recent: Array<{ ticker: string; txn_label: string; date: string | null }>
): string | null {
  const sym = ticker.toUpperCase();
  let best: string | null = null;
  for (const t of recent) {
    if (t.ticker.toUpperCase() !== sym || !t.date) continue;
    if (isSellTxnLabel(t.txn_label)) continue;
    const d = t.date.slice(0, 10);
    if (!best || d < best) best = d;
  }
  return best;
}

/** מסיר מקורות טכניים (UW / Form 4 וכו') מתת־כותרת שחוזרת מהשרת */
function sanitizePublicSubtitle(raw: string, kind: PersonKind): string {
  const cleaned = raw
    .replace(/\bUnusual\s*Whales\b/gi, '')
    .replace(/\bUW\b/g, '')
    .replace(/\bForm\s*4\b/gi, '')
    .replace(/\bSTOCK\s*Act\b/gi, '')
    .replace(/\b13F\b/gi, '')
    .replace(/\bSEC\b/gi, '')
    .replace(/\s*[·|/]\s*/g, ' · ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[·\s]+|[·\s]+$/g, '')
    .trim();
  return cleaned || kindDefaultSubtitle(kind);
}

export function PersonPortfolioProfileScreen({
  id,
  kind,
  ticker,
  nameHint,
  imageHint,
  onBack,
  onTickerPress,
}: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const investor = useDarkPoolInvestorProfile(
    kind === 'fund_manager' ? '' : id,
    kind === 'fund_manager' ? 'insider' : kind,
    ticker
  );
  const fund = useFundProfile(kind === 'fund_manager' ? id : '');

  const loading =
    kind === 'fund_manager'
      ? fund.loading && !fund.profile
      : investor.loading && !investor.profile;
  const refreshing = kind === 'fund_manager' ? fund.refreshing : investor.refreshing;
  const error = kind === 'fund_manager' ? fund.error : investor.error;

  const refetch = useCallback(() => {
    if (kind === 'fund_manager') return fund.refetch();
    return investor.refetch();
  }, [kind, fund, investor]);

  const { list: followedList } = useFollowedInvestors();
  const { showDialog } = useAppDialog();
  const [followBusy, setFollowBusy] = useState(false);
  /** Immediate icon flip before AsyncStorage / permissions settle */
  const [optimisticFollowing, setOptimisticFollowing] = useState<boolean | null>(null);
  const togglingRef = useRef(false);
  const [period, setPeriod] = useState<PerformancePeriod>('3M');

  const listFollowing = useMemo(
    () => followedList.some((x) => x.id === id && x.kind === kind),
    [followedList, id, kind]
  );
  const isFollowing = optimisticFollowing ?? listFollowing;

  // Drop optimistic override once the followed list catches up
  useEffect(() => {
    if (optimisticFollowing == null) return;
    if (listFollowing === optimisticFollowing) {
      setOptimisticFollowing(null);
    }
  }, [listFollowing, optimisticFollowing]);

  const displayName =
    (kind === 'fund_manager' ? fund.profile?.name : investor.profile?.name) ??
    nameHint ??
    kindLabel(kind);

  const imageUrl =
    (kind === 'fund_manager' ? fund.profile?.image_url : investor.profile?.image_url) ??
    imageHint ??
    null;

  const subtitle = useMemo(() => {
    const raw =
      (kind === 'fund_manager' ? fund.profile?.subtitle : investor.profile?.subtitle) ??
      kindDefaultSubtitle(kind);
    return sanitizePublicSubtitle(raw, kind);
  }, [kind, fund.profile?.subtitle, investor.profile?.subtitle]);

  /** אותם מועמדים כמו ProfileHeroAvatar — גם למרכז עוגת האחזקות */
  const portraitCandidates = useMemo(
    () =>
      portraitPhotoCandidates({
        imageUrl,
        imageHint,
        kind,
        personId: id,
        name: displayName,
      }),
    [imageUrl, imageHint, kind, id, displayName]
  );
  const portraitUri = portraitCandidates[0] ?? null;

  const userInitial = useMemo(() => {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  }, [displayName]);

  const onToggleAlerts = useCallback(async () => {
    if (togglingRef.current) return;
    togglingRef.current = true;

    const prev = isFollowing;
    setOptimisticFollowing(!prev);

    // Spinner only if local write takes >150ms — never wait on push registration
    const spinnerTimer = setTimeout(() => setFollowBusy(true), 150);

    try {
      const next = await toggleFollowInvestor({
        id,
        kind,
        name: displayName,
        image_url: imageUrl,
        ticker,
      });
      setOptimisticFollowing(next);

      if (next) {
        // Permissions + Expo token + Supabase RPC — fire-and-forget after local persist
        void NotificationService.registerDeviceToken().then((ok) => {
          if (!ok) {
            void showDialog({
              title: 'התראות',
              message:
                'הוספנו למעקב, אבל צריך לאשר הרשאת התראות במכשיר כדי לקבל עדכון על עסקאות ודיווחים חדשים.',
              type: 'info',
            });
          }
        });
      }
    } catch {
      setOptimisticFollowing(prev);
    } finally {
      clearTimeout(spinnerTimer);
      setFollowBusy(false);
      togglingRef.current = false;
    }
  }, [isFollowing, id, kind, displayName, imageUrl, ticker, showDialog]);

  const { portfolioValue, fullChartSeries, holdings, trades, disclaimer } =
    useMemo(() => {
      if (kind === 'fund_manager') {
        const p = fund.profile;
        const series: ChartPoint[] = appendLivePortfolioPoint(
          (p?.value_series ?? []).map((pt) => ({ date: pt.date, value: pt.value })),
          p?.stats.total_value_usd
        );
        const filingDate = p?.stats.filing_date?.slice(0, 10) ?? null;
        const holdingRows: HoldingRow[] = (p?.holdings ?? []).slice(0, 16).map((h) => {
          const firstAdded =
            h.first_added_date?.slice(0, 10) || filingDate || null;
          // 13F מדווח מניות אמיתיות — מציגים כשיש מספר (לא Yahoo/mock)
          const sharesLabel =
            h.shares != null && Number.isFinite(h.shares) && h.shares > 0
              ? `${Math.round(h.shares).toLocaleString('en-US')} מניות`
              : null;
          const entry =
            h.entry_price != null && Number.isFinite(h.entry_price) && h.entry_price > 0
              ? h.entry_price
              : impliedFilingPriceFrom13f(h.value_usd, h.shares);
          const returnPct =
            h.return_pct != null && Number.isFinite(h.return_pct) ? h.return_pct : null;
          return {
            ticker: h.ticker,
            title: h.ticker,
            meta: [
              sharesLabel,
              formatHoldingValueLabel(h.value_usd),
              h.allocation_pct != null ? `${h.allocation_pct.toFixed(1)}%` : null,
            ]
              .filter(Boolean)
              .join(' · '),
            allocation_pct: h.allocation_pct,
            value_usd: h.value_usd,
            // value/shares מהדוח — מחיר כניסה מוצר לחישוב תשואה
            entry_price: entry,
            return_pct: returnPct,
            first_added_date: firstAdded,
            dateLabel: firstAdded ? 'reported' : null,
          };
        });
        return {
          portfolioValue: p?.stats.total_value_usd ?? null,
          fullChartSeries: series,
          holdings: holdingRows,
          trades: [] as TradeRow[],
          disclaimer:
            'מבוסס על דיווחי 13F ציבוריים — לא תיק בזמן אמת. «מחיר כניסה» = שווי/מניות מהדוח; תשואה מול מחיר שוק נוכחי.',
        };
      }

      const p = investor.profile;
      const m = p?.metrics ?? null;
      // גרף = אלגוריתם שחזור שלנו (גם מטווחי $) — לא 1:1 MTM; תמיד מציגים כשיש סדרה.
      // מחיר ממוצע / תשואה בשורות אחזקה נשארים מאחורי basis_reliable בלבד.
      const series = appendLivePortfolioPoint(
        (m?.series ?? []).map((pt) => ({ date: pt.date, value: pt.value })),
        m?.portfolio_value
      );

      const holdingsByTicker = new Map(
        (p?.holdings ?? []).map((h) => [h.ticker.toUpperCase(), h])
      );

      let holdingRows: HoldingRow[] = [];
      if (m?.holdings?.length) {
        holdingRows = m.holdings.slice(0, 16).map((h) => {
          const fromList = holdingsByTicker.get(h.ticker.toUpperCase());
          const firstAdded =
            h.first_added_date?.slice(0, 10) ||
            fromList?.first_added_date?.slice(0, 10) ||
            earliestBuyDateFromRecent(h.ticker, p?.recent_trades ?? []) ||
            null;
          return {
            ticker: h.ticker,
            title: h.ticker,
            // qty אמיתי רק כש־basis_reliable (Form 4 / מניות מדווחות).
            // STOCK Act: טווח $ בלבד — לא ממציאים «X מניות» מ־Yahoo.
            meta: h.basis_reliable
              ? [
                  `${Math.round(h.qty).toLocaleString('en-US')} מניות`,
                  formatHoldingValueLabel(h.market_value),
                ]
                  .filter(Boolean)
                  .join(' · ')
              : // טווח STOCK Act — לא מציגים כמות מניות מומצאת
                formatHoldingValueLabel(h.market_value) ?? '',
            allocation_pct: h.allocation_pct,
            market_value: h.market_value,
            // תשואה מטווח $ מעגלית (≈ תנודת מחיר) — מסתירים יחד עם avg
            return_pct: h.basis_reliable ? h.return_pct : null,
            avg_price: avgEntryPriceFromCost(
              h.cost_usd,
              h.qty,
              h.basis_reliable === true
            ),
            first_added_date: firstAdded,
            dateLabel: firstAdded ? 'added' : null,
          };
        });
      } else if (p?.holdings?.length) {
        holdingRows = p.holdings.slice(0, 16).map((h) => {
          const firstAdded =
            h.first_added_date?.slice(0, 10) ||
            earliestBuyDateFromRecent(h.ticker, p?.recent_trades ?? []) ||
            null;
          const reported =
            !firstAdded
              ? h.last_trade_date?.slice(0, 10) || null
              : null;
          const dateShown = firstAdded || reported;
          // txn_mix (קנייה/מכירה) שייך לעסקאות בלבד — לא לשורת אחזקה.
          // avg/return רק משחזור עם cost/qty — לא ממציאים ממכירה/טווח disclosure.
          return {
            ticker: h.ticker,
            title: h.ticker,
            meta: formatHoldingsListMeta({
              amountLabel: h.amount_label,
              tradeCount: h.trade_count,
              fromTradesOnly: p.holdings_source !== 'snapshot',
            }),
            allocation_pct: h.allocation_pct,
            trade_count: h.trade_count,
            return_pct: h.return_pct ?? null,
            avg_price: null,
            first_added_date: dateShown,
            dateLabel: firstAdded ? 'added' : reported ? 'reported' : null,
          };
        });
      }

      const tradeRows: TradeRow[] = (p?.recent_trades ?? []).slice(0, 50).map((t, i) => ({
        key: `${t.id}-${i}`,
        ticker: t.ticker,
        label: t.txn_label,
        amount: t.amount_label,
        date: t.date,
      }));

      return {
        portfolioValue: m?.portfolio_value ?? p?.portfolio_snapshot?.estimated_value_usd ?? null,
        fullChartSeries: series,
        holdings: holdingRows,
        trades: tradeRows,
        disclaimer:
          kind === 'politician'
            ? 'גרף שווי = אלגוריתם שחזור מטווחי $ (STOCK Act) + מחירי שוק — לא mark-to-market 1:1. מחיר ממוצע/תשואה לאחזקה מוצגים רק כשיש בסיס מדווח.'
            : 'הערכה על בסיס דיווחים ציבוריים + מחירי שוק — לא תיק רשמי. מחיר ממוצע/תשואה רק כשיש בסיס אמין.',
      };
    }, [kind, fund.profile, investor.profile]);

  useEffect(() => {
    if (fullChartSeries.length >= 2) {
      setPeriod(pickDefaultChartPeriod(fullChartSeries));
    }
  }, [id, fullChartSeries.length]);

  const showChart = fullChartSeries.length >= 2;

  const pieHoldings = useMemo<HoldingAllocationInput[]>(
    () =>
      holdings.map((h) => ({
        ticker: h.ticker,
        allocation_pct: h.allocation_pct,
        market_value: h.market_value,
        value_usd: h.value_usd,
        trade_count: h.trade_count,
      })),
    [holdings]
  );
  const pieColors = useHoldingsPieColors(pieHoldings);

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
          <ChatSubScreenHeader
            inRtlTree
            title={kindLabel(kind)}
            onBack={onBack}
          />
          <View style={styles.center}>
            <ActivityIndicator color={tokens.colors.primary.main} />
            <Text style={styles.loadingHint}>טוען שווי תיק…</Text>
          </View>
        </SafeAreaView>
      </ScreenChrome>
    );
  }

  return (
    <ScreenChrome rtl withBrandWatermark>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ChatSubScreenHeader
          inRtlTree
          title={kindLabel(kind)}
          onBack={onBack}
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

          {/* זהות + פעמון התראות על רכישות */}
          <UICard variant="glass" glassIntensity="light" padding="md" style={styles.identityCard}>
            <View style={styles.identityRow}>
              <ProfileHeroAvatar
                name={displayName}
                imageUrl={imageUrl}
                imageHint={imageHint}
                ticker={ticker}
                kind={kind}
                personId={id}
                size={48}
              />
              <View style={styles.identityText}>
                <Text style={styles.name} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {subtitle}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  void HapticFeedback.selection();
                  void onToggleAlerts();
                }}
                disabled={followBusy}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={
                  isFollowing
                    ? 'כבה התראות על עסקאות ודיווחים'
                    : 'קבל התראות על עסקאות ודיווחים'
                }
                style={({ pressed }) => [
                  pressed && { opacity: 0.85 },
                  followBusy && { opacity: 0.5 },
                ]}
              >
                <View style={[styles.alertBtn, isFollowing && styles.alertBtnOn]}>
                  {followBusy ? (
                    <ActivityIndicator size="small" color={tokens.colors.primary.main} />
                  ) : (
                    <Ionicons
                      name={isFollowing ? 'notifications' : 'notifications-outline'}
                      size={20}
                      color={
                        isFollowing
                          ? tokens.colors.primary.main
                          : tokens.colors.text.primary
                      }
                    />
                  )}
                </View>
              </Pressable>
            </View>
          </UICard>

          {/* גרף — HERO (שווי + תקופות בתוך הגרף) */}
          <UICard variant="glass" padding="md" style={styles.chartCard}>
            {showChart ? (
              <PortfolioValueChart
                series={fullChartSeries}
                height={220}
                currency="USD"
                selectedPeriod={period}
                onPeriodChange={setPeriod}
                showHeader
                formatValue={(v) => formatUsdCompact(v)}
              />
            ) : (
              <Text style={styles.muted}>
                {kind === 'fund_manager'
                  ? 'עדיין אין מספיק דיווחים לבניית גרף שווי.'
                  : portfolioValue == null && !error
                    ? 'אין מספיק דיווחים לבניית שווי מוערך'
                    : 'עדיין אין מספיק דיווחים לבניית גרף שווי מוערך.'}
              </Text>
            )}
          </UICard>

          <Text style={styles.disclaimer}>{disclaimer}</Text>

          {/* אחזקות — עוגה כמו ביומן מסחר */}
          {pieHoldings.length > 0 ? (
            <HoldingsPieSection
              title="פילוח אחזקות"
              holdings={pieHoldings}
              avatarUrl={portraitUri}
              avatarCandidates={portraitCandidates}
              userInitial={userInitial}
            />
          ) : null}

          {holdings.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>אחזקות מובילות</Text>
              <UICard
                variant="glass"
                glassIntensity="light"
                padding="none"
                style={styles.listPanel}
                contentContainerStyle={styles.listPanelInner}
              >
                {holdings.map((h, index) => {
                  const dateStr = formatHoldingDateHe(h.first_added_date);
                  const datePrefix =
                    h.dateLabel === 'reported' ? 'דיווח' : 'כניסה';
                  const hasReturn =
                    h.return_pct != null && Number.isFinite(h.return_pct);
                  const avgStr = formatAvgEntryUsd(h.avg_price);
                  const entryStr = formatAvgEntryUsd(h.entry_price);
                  const retColor =
                    hasReturn && (h.return_pct as number) >= 0
                      ? tokens.colors.primary.main
                      : tokens.colors.text.danger;
                  const showRightMeta =
                    hasReturn || !!avgStr || !!entryStr || !!dateStr;
                  return (
                    <React.Fragment key={h.ticker}>
                      <Pressable
                        onPress={() => openTicker(h.ticker)}
                        style={({ pressed }) => [
                          styles.listRowPress,
                          pressed && { opacity: 0.9 },
                        ]}
                      >
                        <View style={styles.listRow}>
                          <TickerLogo symbol={h.ticker} size={36} borderRadius={18} />
                          <View style={styles.rowText}>
                            <View style={styles.tickerLine}>
                              <Text style={styles.rowTitle} numberOfLines={1}>
                                {h.title}
                              </Text>
                              <HoldingTickerDot
                                ticker={h.ticker}
                                colorByTicker={pieColors}
                              />
                            </View>
                            {h.meta ? (
                              <Text style={styles.rowMeta} numberOfLines={1}>
                                {h.meta}
                              </Text>
                            ) : null}
                          </View>
                          {showRightMeta ? (
                            <View style={styles.holdingRight}>
                              {hasReturn ? (
                                <Text
                                  style={[styles.holdingReturn, { color: retColor }]}
                                  numberOfLines={1}
                                >
                                  {(h.return_pct as number) >= 0 ? '+' : ''}
                                  {(h.return_pct as number).toFixed(1)}%
                                </Text>
                              ) : null}
                              {avgStr ? (
                                <Text style={styles.holdingAvg} numberOfLines={1}>
                                  מחיר ממוצע {avgStr}
                                </Text>
                              ) : null}
                              {entryStr ? (
                                <Text style={styles.holdingAvg} numberOfLines={1}>
                                  מחיר כניסה {entryStr}
                                </Text>
                              ) : null}
                              {dateStr ? (
                                <Text style={styles.holdingDate} numberOfLines={1}>
                                  {datePrefix} {dateStr}
                                </Text>
                              ) : null}
                            </View>
                          ) : (
                            <Ionicons
                              name="chevron-back"
                              size={14}
                              color={tokens.colors.text.tertiary}
                            />
                          )}
                        </View>
                      </Pressable>
                      {index < holdings.length - 1 ? (
                        <View style={styles.listRowDivider} />
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </UICard>
            </>
          ) : null}

          {/* עסקאות */}
          {trades.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 8 }]}>עסקאות אחרונות</Text>
              <Text style={styles.sectionHint}>
                קנייה/מכירה = סוג העסקה המדווחת, לא פוזיציית שורט
              </Text>
              <UICard
                variant="glass"
                glassIntensity="light"
                padding="none"
                style={styles.listPanel}
                contentContainerStyle={styles.listPanelInner}
              >
                {trades.map((t, index) => {
                  const sell = isSellTxnLabel(t.label);
                  const sideColor = sell
                    ? tokens.colors.text.danger
                    : tokens.colors.primary.main;
                  return (
                    <React.Fragment key={t.key}>
                      <Pressable
                        onPress={() => openTicker(t.ticker)}
                        style={({ pressed }) => [
                          styles.listRowPress,
                          pressed && { opacity: 0.9 },
                        ]}
                      >
                        <View style={styles.listRow}>
                          <TickerLogo symbol={t.ticker} size={36} borderRadius={18} />
                          <View style={styles.rowText}>
                            <View style={styles.tickerLine}>
                              <Text style={[styles.sideVerb, { color: sideColor }]}>
                                {sell ? 'מכירה' : 'קנייה'}
                              </Text>
                              <Text style={styles.rowTitle} numberOfLines={1}>
                                {t.ticker}
                              </Text>
                            </View>
                            {t.amount ? (
                              <Text style={styles.rowMeta} numberOfLines={1}>
                                {t.amount}
                              </Text>
                            ) : null}
                          </View>
                          <View style={styles.tradeRight}>
                            {t.date ? (
                              <Text style={styles.tradeDate}>{t.date}</Text>
                            ) : null}
                          </View>
                        </View>
                      </Pressable>
                      {index < trades.length - 1 ? (
                        <View style={styles.listRowDivider} />
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </UICard>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ScreenChrome>
  );
}

function isSellTxnLabel(label: string): boolean {
  const l = label.toLowerCase();
  return /sell|sale|מכר|מכיר|dispose/.test(l);
}

/** Meta לשורת אחזקה — בלי קנייה/מכירה (אלה שייכים לרשימת עסקאות בלבד). */
function formatHoldingsListMeta(opts: {
  amountLabel?: string | null;
  tradeCount?: number | null;
  fromTradesOnly?: boolean;
}): string {
  const parts: string[] = [];
  if (opts.fromTradesOnly && opts.tradeCount != null && opts.tradeCount > 0) {
    parts.push(
      opts.tradeCount === 1 ? 'דיווח אחד' : `${opts.tradeCount} דיווחים`
    );
  }
  if (opts.amountLabel?.trim()) parts.push(opts.amountLabel.trim());
  return parts.join(' · ');
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    safe: { flex: 1 },
    scroll: {
      paddingHorizontal: 16,
      paddingBottom: 40,
      direction: 'rtl',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    loadingHint: {
      fontSize: 13,
      color: tokens.colors.text.tertiary,
    },
    errCard: {
      marginBottom: 12,
      borderColor: tokens.colors.border.danger,
    },
    errText: {
      color: tokens.colors.text.danger,
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'left',
    },
    identityCard: {
      marginBottom: 14,
      borderRadius: 36,
      overflow: 'hidden',
    },
    identityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    identityText: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    // אותו pill כמו periodBtn בגרף — rgba מפורש כדי שייראה מעל identity glass
    alertBtn: {
      width: 40,
      height: 40,
      minWidth: 40,
      minHeight: 40,
      borderRadius: 999,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    alertBtnOn: {
      backgroundColor: `${tokens.colors.primary.main}22`,
      borderColor: `${tokens.colors.primary.main}66`,
    },
    name: {
      fontSize: 18,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      textAlign: 'left',
    },
    sub: {
      fontSize: 13,
      color: tokens.colors.text.secondary,
      textAlign: 'left',
    },
    chartCard: {
      marginBottom: 8,
      borderRadius: tokens.borderRadius['2xl'],
      overflow: 'hidden',
    },
    disclaimer: {
      fontSize: 11,
      lineHeight: 16,
      color: tokens.colors.text.tertiary,
      textAlign: 'left',
      marginBottom: 16,
      paddingHorizontal: 2,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      textAlign: 'left',
      marginBottom: 10,
      marginTop: 4,
    },
    sectionHint: {
      fontSize: 11,
      lineHeight: 15,
      color: tokens.colors.text.tertiary,
      textAlign: 'left',
      marginTop: -6,
      marginBottom: 10,
      paddingHorizontal: 2,
    },
    listPanel: {
      marginBottom: 12,
      borderRadius: tokens.borderRadius['2xl'],
      overflow: 'hidden',
      alignSelf: 'stretch',
      width: '100%',
    },
    listPanelInner: {
      width: '100%',
      alignSelf: 'stretch',
    },
    listRowPress: {
      width: '100%',
      alignSelf: 'stretch',
    },
    listRow: {
      // שורת טיקר לטינית — LTR מפורש + row-reverse כדי למנוע קריסת מרווחים ב-RTL
      direction: 'ltr',
      flexDirection: 'row-reverse',
      alignItems: 'center',
      alignSelf: 'stretch',
      width: '100%',
      columnGap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      minHeight: 56,
    },
    listRowDivider: {
      // קו מפריד מפורש (לא border על Pressable) — נראה ברור יותר על רקע glass
      height: Math.max(StyleSheet.hairlineWidth * 2, 1),
      backgroundColor: tokens.colors.border.divider,
      marginHorizontal: 14,
      alignSelf: 'stretch',
    },
    rowText: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      justifyContent: 'center',
      alignItems: 'flex-end',
    },
    tickerLine: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      columnGap: 8,
      minWidth: 0,
      maxWidth: '100%',
    },
    sideVerb: {
      fontSize: 13,
      fontWeight: '800',
    },
    rowTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: tokens.colors.text.primary,
      textAlign: 'right',
      lineHeight: 18,
      flexShrink: 1,
    },
    rowMeta: {
      marginTop: 3,
      fontSize: 12,
      lineHeight: 15,
      color: tokens.colors.text.secondary,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    tradeRight: { alignItems: 'flex-start', flexShrink: 0 },
    tradeDate: {
      fontSize: 11,
      lineHeight: 14,
      color: tokens.colors.text.tertiary,
      textAlign: 'left',
    },
    holdingRight: {
      alignItems: 'flex-start',
      flexShrink: 0,
      minWidth: 72,
      gap: 2,
    },
    holdingReturn: {
      fontSize: 13,
      fontWeight: '800',
      textAlign: 'left',
      writingDirection: 'ltr',
    },
    holdingAvg: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '600',
      color: tokens.colors.text.secondary,
      textAlign: 'left',
      writingDirection: 'ltr',
    },
    holdingDate: {
      fontSize: 11,
      lineHeight: 14,
      color: tokens.colors.text.tertiary,
      textAlign: 'left',
    },
    muted: {
      marginTop: 8,
      fontSize: 13,
      lineHeight: 20,
      color: tokens.colors.text.tertiary,
      textAlign: 'left',
    },
  });
}
