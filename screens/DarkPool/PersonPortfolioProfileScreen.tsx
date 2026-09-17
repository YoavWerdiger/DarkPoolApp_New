/**
 * פרופיל אדם מאוחד — גרף שווי תיק הוא ה-HERO.
 * politician / insider / fund_manager → אותו מבנה מסך.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
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
import { ProfileSkeleton, ChartSkeleton, ListItemSkeleton } from '../../components/ui/SkeletonLoader';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { useDarkPoolInvestorProfile } from '../../hooks/useDarkPoolInvestorProfile';
import { useFundProfile } from '../../hooks/useFundProfile';
import { PortfolioValueChart } from '../Portfolios/components/PortfolioValueChart';
import { TickerLogo } from '../Portfolios/components/TickerLogo';
import type { PerformancePeriod } from '../Portfolios/portfolioTypes';
import {
  avgEntryPriceFromCost,
  formatAvgEntryUsd,
  formatHoldingsValueMeta,
  formatUsdCompact,
} from './utils/darkPoolFormat';
import {
  appendLivePortfolioPoint,
  pickDefaultChartPeriod,
  prepareReconstructedChartSeries,
  type ChartPoint,
} from './utils/profileChartSeries';
import { hebrewText } from './utils/bidi';
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
import ShareDestinationSheet from '../../components/share/ShareDestinationSheet';
import { buildPersonAttachment } from '../../types/shareableEntity';
import type { ShareableAttachment } from '../../types/shareableEntity';
import { DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';

export type PersonKind = 'politician' | 'insider' | 'fund_manager';

/** גודל זהה לאווטאר ולכפתור הפעמון בכרטיס זהות — עיגול אמיתי */
const IDENTITY_CIRCLE_SIZE = 48;
const IDENTITY_CIRCLE_RADIUS = IDENTITY_CIRCLE_SIZE / 2;

interface Props {
  id: string;
  kind: PersonKind;
  ticker?: string;
  nameHint?: string;
  imageHint?: string | null;
  onBack: () => void;
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
   * מחיר כניסה מוצר:
   * - Form4 עם מחיר מדווח: מחיר ממוצע (cost/qty)
   * - אחרת (קונגרס / Form4 בלי מחיר / 13F): מחיר שוק ב־first_added_date
   */
  entry_price?: number | null;
  /** true כשיש מניות מדווחות להצגה (Form4) גם בלי מחיר אמין */
  qty_disclosed?: boolean;
  /** תווית תאריך: «כניסה» (שחזור/שוק) / «דיווח» (נדיר) */
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
  if (kind === 'politician') return 'לוויתן';
  if (kind === 'fund_manager') return 'מנהל קרן';
  return 'בכיר';
}

function kindDefaultSubtitle(kind: PersonKind): string {
  if (kind === 'politician') return 'לוויתן';
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

/** אומדן תאריך הוספה מעסקאות אחרונות — לפי Traded (לא Filed) */
function earliestBuyDateFromRecent(
  ticker: string,
  recent: Array<{
    ticker: string;
    txn_label: string;
    date: string | null;
    traded_date?: string | null;
  }>
): string | null {
  const sym = ticker.toUpperCase();
  let best: string | null = null;
  for (const t of recent) {
    if (t.ticker.toUpperCase() !== sym) continue;
    if (isSellTxnLabel(t.txn_label)) continue;
    const d = (t.traded_date || t.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    if (!best || d < best) best = d;
  }
  return best;
}

/** מסיר מקורות טכניים (UW / Form 4 וכו') מתת־כותרת שחוזרת מהשרת */
function sanitizePublicSubtitle(raw: string, kind: PersonKind): string {
  if (kind === 'politician') return 'לוויתן';

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
  if (!cleaned) return kindDefaultSubtitle(kind);

  const parts = cleaned
    .split(/\s*·\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  // בכיר / מנהל קרן: שורת תפקיד קצרה אחת
  return parts[0] || kindDefaultSubtitle(kind);
}

export function PersonPortfolioProfileScreen({
  id,
  kind,
  ticker,
  nameHint,
  imageHint,
  onBack,
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
  const [shareOpen, setShareOpen] = useState(false);
  const [shareAttachment, setShareAttachment] = useState<ShareableAttachment | null>(null);

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

  const { portfolioValue, fullChartSeries, holdings, trades } =
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
          // אותה שורת אחזקה כמו פוליטיקאים: שווי + מניות בסוגריים; % הקצאה רק בעוגה
          const entry =
            h.entry_price != null && Number.isFinite(h.entry_price) && h.entry_price > 0
              ? h.entry_price
              : null;
          const returnPct =
            h.return_pct != null && Number.isFinite(h.return_pct) ? h.return_pct : null;
          return {
            ticker: h.ticker,
            title: h.ticker,
            meta: formatHoldingsValueMeta(h.value_usd, h.shares),
            allocation_pct: h.allocation_pct,
            value_usd: h.value_usd,
            // Yahoo ב־first_added — כמו פוליטיקאים
            entry_price: entry,
            return_pct: returnPct,
            first_added_date: firstAdded,
            dateLabel: firstAdded ? 'added' : null,
          };
        });
        return {
          portfolioValue: p?.stats.total_value_usd ?? null,
          fullChartSeries: series,
          holdings: holdingRows,
          trades: [] as TradeRow[],
        };
      }

      const p = investor.profile;
      const m = p?.metrics ?? null;
      // דילול + נטרול הפקדות — בלי appendLive ששובר את העקומה
      const rawSeries: ChartPoint[] = (m?.series ?? []).map((pt) => ({
        date: pt.date,
        value: pt.value,
        ...(pt.external_flow != null && pt.external_flow !== 0
          ? { external_flow: pt.external_flow }
          : {}),
      }));
      const series = prepareReconstructedChartSeries(rawSeries, {
        tradeCount: m?.trade_count ?? p?.recent_trades?.length ?? 0,
        chartReliable: m?.chart_reliable,
      });

      const holdingsByTicker = new Map(
        (p?.holdings ?? []).map((h) => [h.ticker.toUpperCase(), h])
      );

      let holdingRows: HoldingRow[] = [];
      // Quiver snapshot עדיף על holdings משוחזרים מטווחי STOCK Act
      if (
        p?.holdings_source === 'quiver_estimate' &&
        (p?.holdings?.length ?? 0) > 0
      ) {
        holdingRows = (p.holdings ?? []).slice(0, 16).map((h) => {
          const firstAdded =
            h.first_added_date?.slice(0, 10) ||
            earliestBuyDateFromRecent(h.ticker, p?.recent_trades ?? []) ||
            null;
          const reported =
            !firstAdded ? h.last_trade_date?.slice(0, 10) || null : null;
          const dateShown = firstAdded || reported;
          const entry =
            h.entry_price != null &&
            Number.isFinite(h.entry_price) &&
            h.entry_price > 0
              ? h.entry_price
              : null;
          return {
            ticker: h.ticker,
            title: h.ticker,
            meta: formatHoldingsListMeta({
              amountLabel: h.amount_label,
              tradeCount: h.trade_count,
              fromTradesOnly: false,
            }),
            allocation_pct: h.allocation_pct,
            trade_count: h.trade_count,
            market_value:
              h.mid_usd_k != null && h.mid_usd_k > 0
                ? h.mid_usd_k * 1000
                : undefined,
            return_pct: null,
            avg_price: null,
            entry_price: entry,
            first_added_date: dateShown,
            dateLabel: firstAdded ? 'added' : reported ? 'reported' : null,
          };
        });
      } else if (m?.holdings?.length) {
        holdingRows = m.holdings.slice(0, 16).map((h) => {
          const fromList = holdingsByTicker.get(h.ticker.toUpperCase());
          const firstAdded =
            h.first_added_date?.slice(0, 10) ||
            fromList?.first_added_date?.slice(0, 10) ||
            earliestBuyDateFromRecent(h.ticker, p?.recent_trades ?? []) ||
            null;
          const reliable = h.basis_reliable === true;
          const qtyDisclosed = h.qty_disclosed === true || reliable;
          const entryFromMarket =
            !reliable &&
            h.entry_price != null &&
            Number.isFinite(h.entry_price) &&
            h.entry_price > 0
              ? h.entry_price
              : null;
          // תשואה רק עם basis אמין — לא NVDA +1300% מ־Yahoo על qty מוערך
          const hasReturn =
            reliable &&
            h.return_pct != null &&
            Number.isFinite(h.return_pct);
          return {
            ticker: h.ticker,
            title: h.ticker,
            // qty אמיתי כשמניות מדווחות (Form 4) — גם בלי מחיר Form4.
            // STOCK Act: טווח $ בלבד — לא ממציאים «X מניות» מ־Yahoo.
            // שווי קודם + מניות קומפקטיות בסוגריים כדי שלא ייחתך מול עמודת תשואה.
            meta: formatHoldingsValueMeta(
              h.market_value,
              qtyDisclosed ? h.qty : null
            ),
            allocation_pct: h.allocation_pct,
            market_value: h.market_value,
            return_pct: hasReturn ? h.return_pct : null,
            avg_price: avgEntryPriceFromCost(
              h.cost_usd,
              h.qty,
              reliable
            ),
            entry_price: entryFromMarket,
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
          const entry =
            h.entry_price != null &&
            Number.isFinite(h.entry_price) &&
            h.entry_price > 0
              ? h.entry_price
              : null;
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
            entry_price: entry,
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
          <ScrollView contentContainerStyle={styles.scroll}>
            <ProfileSkeleton delay={0} />
            <View style={{ marginTop: 24 }}>
              <ChartSkeleton delay={200} height={280} />
            </View>
            <View style={{ marginTop: 24, gap: 12 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <ListItemSkeleton key={i} delay={400 + i * 70} showAvatar={false} />
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </ScreenChrome>
    );
  }

  return (
    <ScreenChrome rtl>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ChatSubScreenHeader
          inRtlTree
          title={kindLabel(kind)}
          onBack={onBack}
          rightSlot={
            <DayNavBlurButton
              onPress={() => {
                void HapticFeedback.selection();
                const top = holdings[0];
                setShareAttachment(
                  buildPersonAttachment({
                    id,
                    kind,
                    name: displayName,
                    subtitle,
                    imageUrl,
                    ticker: ticker ?? null,
                    portfolioValue,
                    topHolding: top?.ticker ?? null,
                    topHoldingValue: top?.value_usd ?? top?.market_value ?? null,
                  })
                );
                setShareOpen(true);
              }}
              size={DRAWER_MENU_BUTTON_SIZE}
              glassIntensity="subtle"
              accessibilityLabel="שתף פרופיל"
            >
              <Ionicons name="share-outline" size={22} color={tokens.colors.text.primary} />
            </DayNavBlurButton>
          }
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
                size={IDENTITY_CIRCLE_SIZE}
              />
              <View style={styles.identityText}>
                <Text style={[styles.name, styles.rtlRightText]} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={[styles.sub, styles.rtlRightText]} numberOfLines={1}>
                  {subtitle}
                </Text>
              </View>
              {/*
                עיגול אמיתי: הסגנון הוויזואלי על View פנימי (לא על Pressable).
                Pressable לבד לא תמיד חותך background/ripple ל-borderRadius (במיוחד Android).
              */}
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
                android_ripple={
                  Platform.OS === 'android'
                    ? {
                        color: 'rgba(255,255,255,0.14)',
                        borderless: false,
                        radius: IDENTITY_CIRCLE_RADIUS,
                      }
                    : undefined
                }
                style={({ pressed }) => [
                  styles.alertBtnHit,
                  pressed && { opacity: 0.85 },
                  followBusy && { opacity: 0.5 },
                ]}
              >
                <View
                  collapsable={false}
                  style={[styles.alertBtn, isFollowing && styles.alertBtnOn]}
                >
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
                headerTitle="שווי תיק"
                headerTitleAlign="right"
                formatValue={(v) => formatUsdCompact(v)}
                showPointMarkers={kind !== 'fund_manager'}
              />
            ) : (
              <Text style={[styles.muted, styles.rtlRightText]}>
                {kind === 'fund_manager'
                  ? 'עדיין אין מספיק דיווחים לבניית גרף שווי.'
                  : portfolioValue == null && !error
                    ? 'אין מספיק דיווחים לבניית שווי מוערך'
                    : 'אין מספיק דיווחים אמינים לגרף ביצועים מוערך.'}
              </Text>
            )}
          </UICard>

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
              <Text style={[styles.sectionTitle, styles.rtlRightText]}>אחזקות מובילות</Text>
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
                      <View style={styles.listRowPress}>
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
                              <Text style={styles.rowMeta} numberOfLines={2}>
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
                                  מחיר ממוצע{' '}
                                  <Text style={styles.holdingAvgPrice}>{avgStr}</Text>
                                </Text>
                              ) : null}
                              {entryStr ? (
                                <Text style={styles.holdingAvg} numberOfLines={1}>
                                  מחיר כניסה{' '}
                                  <Text style={styles.holdingAvgPrice}>{entryStr}</Text>
                                </Text>
                              ) : null}
                              {dateStr ? (
                                <Text style={styles.holdingDate} numberOfLines={1}>
                                  {datePrefix} {dateStr}
                                </Text>
                              ) : null}
                            </View>
                          ) : null}
                        </View>
                      </View>
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
              <Text style={[styles.sectionTitle, styles.rtlRightText, { marginTop: 8 }]}>עסקאות אחרונות</Text>
              <Text style={[styles.sectionHint, styles.rtlRightText]}>
                תאריך = דיווח (Filed). קנייה/מכירה = סוג העסקה המדווחת, לא פוזיציית שורט
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
                      <View style={styles.listRowPress}>
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
                      </View>
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
      <ShareDestinationSheet
        visible={shareOpen && !!shareAttachment}
        attachment={shareAttachment}
        onClose={() => {
          setShareOpen(false);
          setShareAttachment(null);
        }}
      />
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
    rtlRightText: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    errCard: {
      marginBottom: 12,
      borderColor: tokens.colors.border.danger,
    },
    errText: {
      color: tokens.colors.text.danger,
      fontSize: 14,
      fontWeight: '700',
      alignSelf: 'stretch',
      ...hebrewText,
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
      alignItems: 'flex-end',
    },
    // Hit target עגול — חייב overflow כדי לחתוך ripple ב-Android
    alertBtnHit: {
      width: IDENTITY_CIRCLE_SIZE,
      height: IDENTITY_CIRCLE_SIZE,
      borderRadius: IDENTITY_CIRCLE_RADIUS,
      overflow: 'hidden',
      flexShrink: 0,
    },
    // עיגול ויזואלי זהה לאווטאר: size קבוע + radius=size/2 + overflow
    alertBtn: {
      width: IDENTITY_CIRCLE_SIZE,
      height: IDENTITY_CIRCLE_SIZE,
      borderRadius: IDENTITY_CIRCLE_RADIUS,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1.5,
      borderColor: tokens.colors.primary.main,
    },
    alertBtnOn: {
      backgroundColor: `${tokens.colors.primary.main}22`,
      borderColor: tokens.colors.primary.main,
    },
    name: {
      fontSize: 18,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      alignSelf: 'stretch',
      textAlign: 'right',
      writingDirection: 'rtl',
      ...hebrewText,
    },
    sub: {
      fontSize: 13,
      color: tokens.colors.text.secondary,
      alignSelf: 'stretch',
      textAlign: 'right',
      writingDirection: 'rtl',
      ...hebrewText,
    },
    chartCard: {
      marginBottom: 8,
      borderRadius: tokens.borderRadius['2xl'],
      overflow: 'hidden',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      alignSelf: 'stretch',
      textAlign: 'right',
      writingDirection: 'rtl',
      ...hebrewText,
      marginBottom: 10,
      marginTop: 4,
    },
    sectionHint: {
      fontSize: 11,
      lineHeight: 15,
      color: tokens.colors.text.tertiary,
      alignSelf: 'stretch',
      ...hebrewText,
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
    tradeRight: { alignItems: 'flex-end', flexShrink: 0 },
    tradeDate: {
      fontSize: 11,
      lineHeight: 14,
      color: tokens.colors.text.tertiary,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    holdingRight: {
      alignItems: 'flex-end',
      flexShrink: 0,
      minWidth: 72,
      gap: 2,
    },
    holdingReturn: {
      fontSize: 13,
      fontWeight: '800',
      textAlign: 'right',
      writingDirection: 'ltr',
    },
    holdingAvg: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '600',
      color: tokens.colors.text.secondary,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    /** מחיר קומפקטי ($1.1K) כיחידת LTR — מונע מ־K/M/B להידבק לעברית */
    holdingAvgPrice: {
      writingDirection: 'ltr',
    },
    holdingDate: {
      fontSize: 11,
      lineHeight: 14,
      color: tokens.colors.text.tertiary,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    muted: {
      marginTop: 8,
      fontSize: 13,
      lineHeight: 20,
      color: tokens.colors.text.tertiary,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
  });
}
