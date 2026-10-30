/**
 * פרופיל אדם מאוחד — גרף שווי תיק הוא ה-HERO.
 * politician / insider / fund_manager → אותו מבנה מסך.
 */

import { brandfetchTickerLogoUri } from '../../utils/brandfetch';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  type TextStyle,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { LIGHT_CANVAS } from '../../components/ui/designTokensStatic';
import { MotionNumber } from '../../components/ui/MotionNumber';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import {
  CHANGE_DOT_SIZE,
  changeToneColor,
  changeToneFromSigned,
  formatSignedChangePct,
} from '../../components/ui/ChangeDot';
import UICard from '../../components/ui/UICard';
import { chromeSurfaceCardStyle } from '../../components/ui/chromeControl';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { LineChartSkeleton, ListItemSkeleton, SkeletonBox } from '../../components/ui/SkeletonLoader';
import { useQuery } from '@tanstack/react-query';
import { appQueryKeys } from '../../lib/appQueryKeys';
import {
  CHART_DAILY_CLOSES_STALE_MS,
  PROFILE_QUERY_GC_MS,
  PROFILE_QUERY_STALE_MS,
} from '../../lib/profileQueryCache';
import { useDarkPoolInvestorProfile } from '../../hooks/useDarkPoolInvestorProfile';
import { useFundProfile } from '../../hooks/useFundProfile';
import {
  listCongressHoldingsByBioguide,
  listCongressTradesForPerson,
} from '../../services/darkpool/darkPoolDbCacheService';
import { listInsiderTradesForPerson } from '../../services/darkpool/darkPoolService';
import { PortfolioValueChart } from '../Portfolios/components/PortfolioValueChart';
import { TickerLogo } from '../Portfolios/components/TickerLogo';
import { build13FPositionDetail } from './utils/filingPositionDetail';
import type { PerformancePeriod } from '../Portfolios/portfolioTypes';
import {
  avgEntryPriceFromCost,
  formatHoldingsValueMeta,
  formatSharesCompact,
  formatUsdRawOrDash,
  impliedFilingPriceFrom13f,
} from './utils/darkPoolFormat';
import {
  filingHoldingReturnPct,
  quotesMapFromDailyCloses,
  replay13FAvgCost,
} from './utils/holdingEntryReturn';
import {
  lastCongressPurchaseByTicker,
  resolveCongressHoldingDisplayReturnPct,
} from './utils/congressHoldingSincePtr';
import { toDataIsland } from './utils/bidi';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';
import {
  appendLivePortfolioPoint,
  filterChartSeriesByPeriod,
  pickDefaultSnapshotChartPeriod,
  selectProfileSnapshotSeries,
  chartPointsFromMetricSeries,
  prepareReconstructedChartSeries,
  SNAPSHOT_CHART_PERIODS,
  snapshotChartEmptyCopy,
  type ChartPoint,
} from './utils/profileChartSeries';
import {
  build13FMarkToMarketSeries,
  latestBookRowsFromHoldings,
  scale13FChartToReportedBook,
  select13FPriceTickers,
} from './utils/filingChartSeries';
import {
  PROFILE_FOLLOW_DOCK_GAP,
  PROFILE_FOLLOW_DOCK_HPAD,
  PROFILE_FOLLOW_PILL_HEIGHT,
  profileFollowDockBottom,
  PROFILE_FOLLOW_PILL_RADIUS,
} from './utils/profileFollowBar';
import {
  DARK_POOL_TYPE,
  darkPoolPhysicalRightText,
  darkPoolRtlContent,
  darkPoolTextRtl,
  darkPoolSectionTitleStyle,
  darkPoolTransparentFill,
} from './darkPoolLayout';
import { withFeedRangeLabel } from './utils/feedTradeDisplay';
import {
  HoldingsListRow,
  HoldingsPieSection,
  useHoldingsPieColors,
} from './components/HoldingsPieSection';
import { PersonProfileHero } from './components/PersonProfileHero';
import { ScrubSubscriber, useScrubStore } from './components/ScrubSubscriber';
import {
  holdingsToDistributionSlices,
  type HoldingAllocationInput,
} from './utils/holdingsAllocation';
import {
  HOLDING_TAG_EXACT,
  CONGRESS_HOLDINGS_HELP_BODY,
  CONGRESS_HOLDINGS_HELP_TITLE,
  FORM4_HOLDINGS_HELP_BODY,
  FORM4_HOLDINGS_HELP_TITLE,
  buildCongressBasketMarkToMarketSeries,
  buildForm4Holdings,
  buildForm4MarkToMarketSeries,
  congressHoldingsFromQuiver,
  formatCongressDeltaUsd,
  formatCongressPortfolioHeroValue,
  formatForm4Value,
  formatForm4Weight,
  formatHoldingRowCells,
  formatHoldingValue,
  formatHoldingWeight,
  form4TradesFromInsiderRows,
  sumCongressPortfolioValue,
  type CongressModelHolding,
  type Form4TradeInput,
  type InsiderForm4Holding,
} from './utils/investorHoldings';
import {
  TRUMP_HOLDINGS_HELP_BODY,
  TRUMP_HOLDINGS_HELP_TITLE,
  buildTrumpHoldings,
  buildTrumpMarkToMarketSeries,
  formatExactUsdLabel,
  isTrumpPerson,
  sumTrumpPortfolioValue,
  trumpPortfolioUsesUnitWeight,
  trumpTradesFromRows,
  type TrumpModelHolding,
  type TrumpTradeInput,
} from './utils/trumpHoldings';
import {
  fetch13FDailyCloses,
  fetchCongressBasketDailyCloses,
  fetchForm4DailyCloses,
  fetchIntradayCloses,
  intradaySpecForPeriod,
  MAX_BASKET_TICKERS,
} from './utils/congressBasketPrices';
import { appendWeightedIntraday } from './utils/sessionSnapshots';
import { fetchFundHoldingsHistory } from '../../services/darkpool/uwFundProfileService';
import { portraitPhotoCandidates } from './utils/investorPlaceholder';
import { HapticFeedback } from '../../utils/hapticFeedback';
import {
  toggleFollowInvestor,
} from '../../services/darkpool/darkPoolFollowService';
import { useFollowedInvestors } from '../../hooks/useFollowedInvestors';
import { NotificationService } from '../../services/notificationService';
import { ensureNotificationCategoryOn } from '../../lib/notificationPrefs';
import { useAppDialog } from '../../components/ui/AppDialogProvider';
import { HelpSheet } from '../../components/ui/HelpSheet';
import ShareDestinationSheet from '../../components/share/ShareDestinationSheet';
import { buildPersonAttachment } from '../../types/shareableEntity';
import type { ShareableAttachment } from '../../types/shareableEntity';
import { useDarkPoolStackNav } from './hooks/useDarkPoolStackNav';
import {
  hasTradeDetailPayload,
  profileRecentToTradeDetail,
} from './utils/tradeDetailParams';

const HERO_HEIGHT_RATIO = 0.42;

export type PersonKind = 'politician' | 'insider' | 'fund_manager';

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
  shares?: number | null;
  current_price?: number | null;
  /** מחיר ממוצע לכניסה (cost_usd / qty) — רק כשיש בסיס עלות מדווח */
  avg_price?: number | null;
  /**
   * מחיר כניסה:
   * - Form4 עם מחיר מדווח: ממוצע משוקלל
   * - 13F: value/shares בדיווח
   * - קונגרס: רק שדה vendor — לא midpoint
   */
  entry_price?: number | null;
  vendor_shares?: number | null;
  vendor_avg_cost?: number | null;
  vendor_price_change_pct?: number | null;
  /** as-of של סנאפשוט Quiver — לא מחיר כניסה. */
  asOfDate?: string | null;
  /** true כשיש מניות מדווחות להצגה (Form4) גם בלי מחיר אמין */
  qty_disclosed?: boolean;
  /** תווית תאריך: «כניסה» (שחזור/שוק) / «דיווח» (נדיר) */
  dateLabel?: 'added' | 'reported' | null;
  honestyTag?: typeof HOLDING_TAG_EXACT | null;
};

type TradeRow = {
  key: string;
  sourceId: string;
  ticker: string;
  label: string;
  amount: string | null;
  amountRaw: string | null;
  date: string | null;
  traded_date: string | null;
};



/** מקטינים פונט לפי אורך המספר כדי שייכנס בשורה */
function heroFlowStyle(base: TextStyle, value: number | null | undefined): TextStyle {
  const chars = `$${Math.round(Math.abs(value ?? 0)).toLocaleString('en-US')}`.length;
  const avail = Dimensions.get('window').width - 40;
  const baseSize = base.fontSize ?? 32;
  const fit = avail / (chars * 0.62);
  const fontSize = Math.max(baseSize * 0.55, Math.min(baseSize, fit));
  const ratio = fontSize / baseSize;
  return {
    ...base,
    marginTop: 0,
    fontSize,
    lineHeight: base.lineHeight ? Math.round(base.lineHeight * ratio) : undefined,
    textAlign: 'right',
  };
}

function kindLabel(kind: PersonKind): string {
  if (kind === 'politician') return 'לוויתן';
  if (kind === 'fund_manager') return 'מנהל קרן';
  return 'בכיר';
}

/** «נכון לרבעון Q2 2026» — תקופת הדוח (13F) ולא תאריך ההגשה */
export function filingQuarterLabelHe(period: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(period?.trim() ?? '');
  if (!m) return null;
  const month = Number(m[2]);
  if (!(month >= 1 && month <= 12)) return null;
  return `נכון לרבעון ${toDataIsland(`Q${Math.ceil(month / 3)} ${m[1]}`)}`;
}

function kindDefaultSubtitle(kind: PersonKind): string {
  if (kind === 'politician') return 'לוויתן';
  if (kind === 'fund_manager') return 'אחזקות רבעוניות';
  return 'עסקאות מדווחות';
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
  const stackNav = useDarkPoolStackNav();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const heroHeight = Math.round(windowHeight * HERO_HEIGHT_RATIO);
  const heroScrollY = useRef(new Animated.Value(0)).current;
  const onHeroScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: heroScrollY } } }], {
        useNativeDriver: true,
      }),
    [heroScrollY]
  );
  /** מסך stack מעל הטאבים — רק home indicator. */
  const followDockBottom = profileFollowDockBottom({ safeBottom: insets.bottom });

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

  const profileDbOpts = {
    staleTime: PROFILE_QUERY_STALE_MS,
    gcTime: PROFILE_QUERY_GC_MS,
    refetchOnMount: false as const,
  };
  const chartPriceOpts = {
    staleTime: CHART_DAILY_CLOSES_STALE_MS,
    gcTime: PROFILE_QUERY_GC_MS,
    refetchOnMount: false as const,
  };

  const bioguideId = id.trim().toUpperCase();
  const quiverHoldingsQuery = useQuery({
    queryKey: appQueryKeys.congressHoldingsByBioguide(bioguideId),
    queryFn: () => listCongressHoldingsByBioguide(bioguideId),
    enabled: kind === 'politician' && /^[A-Z]\d{6}$/.test(bioguideId),
    ...profileDbOpts,
  });

  const insiderName = (investor.profile?.name ?? nameHint ?? '').trim();
  const form4TradesQuery = useQuery({
    queryKey: appQueryKeys.insiderPersonTrades(insiderName),
    queryFn: () => listInsiderTradesForPerson(insiderName, 400, id),
    enabled: kind === 'insider' && insiderName.length > 1,
    ...profileDbOpts,
  });

  const trumpProfile = isTrumpPerson(id, nameHint);
  const congressPersonTradesQuery = useQuery({
    queryKey: appQueryKeys.congressPersonTrades(id),
    queryFn: () => listCongressTradesForPerson(id),
    enabled: kind === 'politician',
    ...profileDbOpts,
  });

  const { list: followedList } = useFollowedInvestors();
  const { showDialog } = useAppDialog();
  const [followBusy, setFollowBusy] = useState(false);
  /** Immediate icon flip before AsyncStorage / permissions settle */
  const [optimisticFollowing, setOptimisticFollowing] = useState<boolean | null>(null);
  const togglingRef = useRef(false);
  const [period, setPeriod] = useState<PerformancePeriod>('1M');
  const [shareOpen, setShareOpen] = useState(false);
  const [shareAttachment, setShareAttachment] = useState<ShareableAttachment | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

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

  // חברה ציבורית שמגישה 13F (NVIDIA...) — אותו מנוע כמו קרן, תצוגה אחרת.
  // לפני שהפרופיל נטען: fund_manager עם טיקר בניווט = חברה (לקרנות אין טיקר)
  const isCompany =
    kind === 'fund_manager' &&
    (fund.profile?.entity_type != null
      ? fund.profile.entity_type === 'company'
      : !!ticker?.trim());
  const companyTicker = isCompany
    ? (fund.profile?.ticker ?? ticker ?? '').trim().toUpperCase() || undefined
    : undefined;

  const displayName =
    (kind === 'fund_manager' ? fund.profile?.name : investor.profile?.name) ??
    nameHint ??
    (isCompany ? 'חברה' : kindLabel(kind));

  const imageUrl =
    (kind === 'fund_manager' ? fund.profile?.image_url : investor.profile?.image_url) ??
    imageHint ??
    null;

  const subtitle = useMemo(() => {
    // חברה: בלי תת-כותרת (השם הרשמי מספיק)
    if (isCompany) return '';
    const raw =
      (kind === 'fund_manager' ? fund.profile?.subtitle : investor.profile?.subtitle) ??
      kindDefaultSubtitle(kind);
    return sanitizePublicSubtitle(raw, kind);
  }, [kind, isCompany, companyTicker, fund.profile?.subtitle, investor.profile?.subtitle]);

  /** אותם מועמדים כמו ProfileHeroAvatar — גם למרכז עוגת האחזקות */
  const portraitCandidates = useMemo(
    () =>
      portraitPhotoCandidates({
        imageUrl,
        imageHint,
        kind,
        personId: id,
        bioguideId: kind === 'politician' ? bioguideId : null,
        name: displayName,
        photoSize: '450x550',
      }),
    [imageUrl, imageHint, kind, id, bioguideId, displayName]
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
        void ensureNotificationCategoryOn('darkPoolNotifications');
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

  const {
    portfolioValue: basePortfolioValue,
    holdings: baseHoldings,
    trades,
    holdingsEngine,
    congressHoldings,
    form4Trades,
    trumpTrades,
  } =
    useMemo(() => {
      const emptyForm4: Form4TradeInput[] = [];
      const emptyTrump: TrumpTradeInput[] = [];
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
          const mark = impliedFilingPriceFrom13f(h.value_usd, h.shares);
          return {
            ticker: h.ticker,
            title: h.ticker,
            meta: formatHoldingsValueMeta(h.value_usd, h.shares),
            allocation_pct: h.allocation_pct,
            value_usd: h.value_usd,
            shares: h.shares ?? null,
            current_price: h.current_price ?? null,
            entry_price: mark,
            avg_price: mark,
            // תשואה מול מחיר חי מחושבת אחרי Yahoo closes — לא Yahoo@first_added.
            return_pct: null,
            first_added_date: firstAdded,
            dateLabel: firstAdded ? 'added' : null,
          };
        });
        return {
          portfolioValue: p?.stats.total_value_usd ?? null,
          fullChartSeries: series,
          holdings: holdingRows,
          trades: [] as TradeRow[],
          holdingsEngine: 'filing' as const,
          congressHoldings: [] as CongressModelHolding[],
          form4Trades: emptyForm4,
          trumpTrades: emptyTrump,
        };
      }

      const p = investor.profile;
      const m = p?.metrics ?? null;
      const isPolitician = kind === 'politician';
      const trump = isTrumpPerson(id, p?.name) || isTrumpPerson(id, nameHint);

      const tradeRows: TradeRow[] = (p?.recent_trades ?? []).slice(0, 50).map((t, i) => ({
        key: `${t.id}-${i}`,
        sourceId: t.id,
        ticker: t.ticker,
        label: t.txn_label,
        amount: trump
          ? formatExactUsdLabel(t.amount_label) ?? t.amount_label
          : isPolitician
            ? withFeedRangeLabel(t.amount_label) ?? t.amount_label
            : t.amount_label,
        amountRaw: t.amount_label,
        date: t.date,
        traded_date: t.traded_date ?? null,
      }));

      if (trump) {
        // השרת (materialize-trump-portfolio): כל העסקאות, בלי כפילויות, שווי משוער מטווחים
        // וכל ~1,000 הטיקרים — עדיף על חישוב בטלפון (500 עסקאות, «משקל שווה» של $1)
        const serverHoldings = m?.holdings ?? [];
        if (m && serverHoldings.length && m.portfolio_value > 0) {
          return {
            portfolioValue: m.portfolio_value,
            fullChartSeries: [] as ChartPoint[],
            holdings: serverHoldings.slice(0, 16).map((h): HoldingRow => ({
              ticker: h.ticker,
              title: h.ticker,
              meta: [formatForm4Value(h.market_value), formatForm4Weight(h.allocation_pct), 'משוער']
                .filter(Boolean)
                .join(' · '),
              allocation_pct: h.allocation_pct,
              market_value: h.market_value,
              value_usd: h.market_value,
              return_pct: h.return_pct ?? null,
              avg_price: h.entry_price ?? null,
              entry_price: h.entry_price ?? null,
              first_added_date: h.first_added_date ?? null,
              dateLabel: h.first_added_date ? ('added' as const) : null,
            })),
            trades: tradeRows,
            holdingsEngine: 'trump' as const,
            congressHoldings: [] as CongressModelHolding[],
            form4Trades: emptyForm4,
            trumpTrades: emptyTrump,
          };
        }
        const fromDb = trumpTradesFromRows(congressPersonTradesQuery.data ?? []);
        const fromRecent = trumpTradesFromRows(p?.recent_trades ?? []);
        const trumpInputs = fromDb.length ? fromDb : fromRecent;
        const trumpEngine = buildTrumpHoldings(trumpInputs);
        return {
          portfolioValue: sumTrumpPortfolioValue(trumpEngine),
          fullChartSeries: [] as ChartPoint[],
          holdings: trumpEngine.slice(0, 16).map((h) =>
            trumpHoldingToRow(h, trumpPortfolioUsesUnitWeight(trumpInputs))
          ),
          trades: tradeRows,
          holdingsEngine: trumpInputs.length ? ('trump' as const) : null,
          congressHoldings: [] as CongressModelHolding[],
          form4Trades: emptyForm4,
          trumpTrades: trumpInputs,
        };
      }

      if (isPolitician) {
        const fromCache = congressHoldingsFromQuiver(quiverHoldingsQuery.data ?? []);
        const allowProfileFallback =
          fromCache.length === 0 &&
          !quiverHoldingsQuery.isFetching &&
          quiverHoldingsQuery.isError &&
          p?.holdings_source === 'quiver_estimate';
        const fromProfile = allowProfileFallback
            ? congressHoldingsFromQuiver(
                (p.holdings ?? []).map((h) => ({
                  bioguideId,
                  ticker: h.ticker,
                  companyName: null,
                  currentValueUSD:
                    h.mid_usd_k != null && h.mid_usd_k > 0 ? h.mid_usd_k * 1000 : null,
                  portfolioPercent: h.allocation_pct ?? null,
                }))
              )
            : [];
        const congressEngine = fromCache.length ? fromCache : fromProfile;
        return {
          portfolioValue: sumCongressPortfolioValue(congressEngine),
          fullChartSeries: [] as ChartPoint[],
          holdings: congressEngine.slice(0, 16).map((h) =>
            congressHoldingToRow(
              h,
              earliestBuyDateFromRecent(h.ticker, p?.recent_trades ?? [])
            )
          ),
          trades: tradeRows,
          holdingsEngine: congressEngine.length ? ('congress' as const) : null,
          congressHoldings: congressEngine,
          form4Trades: emptyForm4,
          trumpTrades: emptyTrump,
        };
      }

      const form4Inputs = form4TradesFromInsiderRows(form4TradesQuery.data ?? []);
      const quotesByTicker = new Map<string, number>();
      for (const h of m?.holdings ?? []) {
        if (h.current_price > 0) quotesByTicker.set(h.ticker.toUpperCase(), h.current_price);
      }
      const form4Engine = buildForm4Holdings(form4Inputs, quotesByTicker);
      // יש אחזקות מהשרת מהמקור (SEC) — הן האמת; השחזור בטלפון מעסקאות form4api מערבב קווי אחזקה
      const secOwnership = m?.ownership_source === 'sec_edgar' && (m.holdings?.length ?? 0) > 0;

      if (!secOwnership && (form4Engine.length || form4Inputs.length)) {
        return {
          portfolioValue: form4Engine.length
            ? form4Engine.reduce((s, h) => s + h.calculatedValueUSD, 0)
            : null,
          fullChartSeries: [] as ChartPoint[],
          holdings: form4Engine.slice(0, 16).map(form4HoldingToRow),
          trades: tradeRows,
          holdingsEngine: 'form4' as const,
          congressHoldings: [] as CongressModelHolding[],
          form4Trades: form4Inputs,
          trumpTrades: emptyTrump,
        };
      }

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
          const reliable = h.basis_reliable === true;
          const qtyDisclosed = h.qty_disclosed === true || reliable;
          const entryFromMarket =
            !reliable &&
            h.entry_price != null &&
            Number.isFinite(h.entry_price) &&
            h.entry_price > 0
              ? h.entry_price
              : null;
          const hasReturn =
            reliable &&
            h.return_pct != null &&
            Number.isFinite(h.return_pct);
          return {
            ticker: h.ticker,
            title: h.ticker,
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
            honestyTag: qtyDisclosed ? HOLDING_TAG_EXACT : null,
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

      return {
        portfolioValue:
          m?.portfolio_value ?? p?.portfolio_snapshot?.estimated_value_usd ?? null,
        fullChartSeries: [] as ChartPoint[],
        holdings: holdingRows,
        holdingsEngine: holdingRows.some((h) => h.honestyTag === HOLDING_TAG_EXACT)
          ? ('form4' as const)
          : null,
        congressHoldings: [] as CongressModelHolding[],
        trades: tradeRows,
        // אחזקות SEC מהשרת — לא משחזרים בטלפון מעסקאות (זה דרס את השווי והגרף של המנכ"לים)
        form4Trades: secOwnership ? emptyForm4 : form4Inputs,
        trumpTrades: emptyTrump,
      };
    }, [
      kind,
      fund.profile,
      investor.profile,
      quiverHoldingsQuery.data,
      quiverHoldingsQuery.isFetching,
      quiverHoldingsQuery.isError,
      form4TradesQuery.data,
      congressPersonTradesQuery.data,
      bioguideId,
      id,
      nameHint,
    ]);

  const congressPricedHoldings = useMemo(
    () => congressHoldings.slice(0, MAX_BASKET_TICKERS),
    [congressHoldings]
  );
  const basketTickersKey = useMemo(
    () => congressPricedHoldings.map((h) => h.ticker).join(','),
    [congressPricedHoldings]
  );
  const basketPricesQuery = useQuery({
    queryKey: appQueryKeys.congressBasketPrices(bioguideId, basketTickersKey),
    queryFn: () => fetchCongressBasketDailyCloses(basketTickersKey.split(',')),
    enabled:
      kind === 'politician' &&
      holdingsEngine === 'congress' &&
      basketTickersKey.length > 0,
    ...chartPriceOpts,
  });

  const materializedChartSeries = useMemo(
    () => chartPointsFromMetricSeries(investor.profile?.metrics?.series),
    [investor.profile?.metrics?.series]
  );

  const congressMtmSeries = useMemo<ChartPoint[]>(() => {
    if (kind !== 'politician' || !congressPricedHoldings.length) return [];
    const prices = basketPricesQuery.data;
    if (prices) {
      const live = buildCongressBasketMarkToMarketSeries(congressPricedHoldings, prices);
      if (live.length >= 2) return live;
    }
    return materializedChartSeries.length >= 2 ? materializedChartSeries : [];
  }, [kind, congressPricedHoldings, basketPricesQuery.data, materializedChartSeries]);

  const form4TickersKey = useMemo(() => {
    const tickers = Array.from(new Set(form4Trades.map((t) => t.ticker.toUpperCase())));
    return tickers.slice(0, 20).join(',');
  }, [form4Trades]);

  const form4PricesQuery = useQuery({
    queryKey: appQueryKeys.insiderForm4Prices(insiderName, form4TickersKey),
    queryFn: () => fetchForm4DailyCloses(form4TickersKey.split(',')),
    enabled: kind === 'insider' && form4TickersKey.length > 0,
    ...chartPriceOpts,
  });

  const form4MtmSeries = useMemo<ChartPoint[]>(() => {
    if (kind !== 'insider' || holdingsEngine !== 'form4' || !form4Trades.length) return [];
    const prices = form4PricesQuery.data;
    if (prices) {
      const raw = buildForm4MarkToMarketSeries(form4Trades, prices);
      if (raw.length >= 2) {
        const prepared = prepareReconstructedChartSeries(
          raw.map((p) => ({ date: p.date, value: p.value })),
          { tradeCount: form4Trades.length, minSpanDays: 14 }
        );
        if (prepared.length >= 2) return prepared;
        return raw.map((p) => ({ date: p.date, value: p.value }));
      }
    }
    return materializedChartSeries.length >= 2 ? materializedChartSeries : [];
  }, [kind, holdingsEngine, form4Trades, form4PricesQuery.data, materializedChartSeries]);

  const trumpUnitWeighted = useMemo(
    () => trumpPortfolioUsesUnitWeight(trumpTrades),
    [trumpTrades]
  );

  const trumpTickersKey = useMemo(() => {
    const tickers = Array.from(new Set(trumpTrades.map((t) => t.ticker.toUpperCase())));
    return tickers.slice(0, 20).join(',');
  }, [trumpTrades]);

  const trumpPricesQuery = useQuery({
    queryKey: appQueryKeys.trumpNotionalPrices(trumpTickersKey),
    queryFn: () => fetchForm4DailyCloses(trumpTickersKey.split(',')),
    enabled: holdingsEngine === 'trump' && trumpTickersKey.length > 0,
    ...chartPriceOpts,
  });

  const trumpLiveHoldings = useMemo(() => {
    if (holdingsEngine !== 'trump' || !trumpTrades.length) return null;
    return buildTrumpHoldings(trumpTrades, trumpPricesQuery.data);
  }, [holdingsEngine, trumpTrades, trumpPricesQuery.data]);

  const form4LiveHoldings = useMemo(() => {
    if (holdingsEngine !== 'form4' || !form4Trades.length) return null;
    const quotes = quotesMapFromDailyCloses(form4PricesQuery.data);
    if (!quotes.size) return null;
    return buildForm4Holdings(form4Trades, quotes);
  }, [holdingsEngine, form4Trades, form4PricesQuery.data]);

  const holdings = trumpLiveHoldings
    ? trumpLiveHoldings.slice(0, 16).map((h) => trumpHoldingToRow(h, trumpUnitWeighted))
    : form4LiveHoldings
      ? form4LiveHoldings.slice(0, 16).map(form4HoldingToRow)
      : baseHoldings;
  const portfolioValue = trumpLiveHoldings
    ? sumTrumpPortfolioValue(trumpLiveHoldings)
    : form4LiveHoldings
      ? form4LiveHoldings.reduce((s, h) => s + h.calculatedValueUSD, 0)
      : basePortfolioValue;

  const trumpSnapshotSeries = useMemo(
    () =>
      holdingsEngine === 'trump'
        ? chartPointsFromMetricSeries(investor.profile?.metrics?.series)
        : [],
    [holdingsEngine, investor.profile?.metrics?.series]
  );

  const trumpMtmSeries = useMemo<ChartPoint[]>(() => {
    if (holdingsEngine !== 'trump' || !trumpTrades.length) {
      return trumpSnapshotSeries.length >= 2 ? trumpSnapshotSeries : [];
    }
    const prices = trumpPricesQuery.data;
    if (!prices) {
      return trumpSnapshotSeries.length >= 2 ? trumpSnapshotSeries : [];
    }
    const live = buildTrumpMarkToMarketSeries(trumpTrades, prices);
    return live.length >= 2 ? live : trumpSnapshotSeries;
  }, [holdingsEngine, trumpTrades, trumpPricesQuery.data, trumpSnapshotSeries]);

  const fundHistoryQuery = useQuery({
    queryKey: appQueryKeys.fundHoldingsHistory(id),
    queryFn: () => fetchFundHoldingsHistory(id),
    enabled: kind === 'fund_manager' && id.length > 0,
    ...profileDbOpts,
  });
  const filingAvgByTicker = useMemo(() => {
    if (kind !== 'fund_manager') return new Map();
    return replay13FAvgCost(fundHistoryQuery.data ?? []);
  }, [kind, fundHistoryQuery.data]);
  const fundTickersKey = useMemo(() => {
    const fromHistory = select13FPriceTickers(fundHistoryQuery.data ?? []);
    const fromRows = holdings
      .map((h) => h.ticker.toUpperCase().trim())
      .filter((t) => t.length > 0);
    return [...new Set([...fromHistory, ...fromRows])].slice(0, 40).join(',');
  }, [fundHistoryQuery.data, holdings]);
  const fundPricesQuery = useQuery({
    queryKey: appQueryKeys.fund13fPrices(id, fundTickersKey),
    queryFn: () => fetch13FDailyCloses(fundTickersKey.split(',')),
    enabled: kind === 'fund_manager' && fundTickersKey.length > 0,
    ...chartPriceOpts,
  });
  const fundMtmSeries = useMemo<ChartPoint[]>(() => {
    if (kind !== 'fund_manager') return [];
    const prices = fundPricesQuery.data;
    if (!prices) return [];
    const reportedBook =
      fund.profile?.stats.total_value_usd ??
      holdings.reduce((s, h) => s + (h.value_usd ?? 0), 0);
    const filingDate = fund.profile?.stats.filing_date?.slice(0, 10) ?? null;

    const finish = (raw: ReturnType<typeof build13FMarkToMarketSeries>) => {
      if (raw.length < 2) return [] as ChartPoint[];
      const scaled = scale13FChartToReportedBook(raw, reportedBook);
      return scaled.map((p) => ({ date: p.date, value: p.value }));
    };

    const history = fundHistoryQuery.data ?? [];
    if (history.length) {
      const fromHistory = finish(build13FMarkToMarketSeries(history, prices));
      if (fromHistory.length >= 2) return fromHistory;
    }
    const latestBook = latestBookRowsFromHoldings(
      holdings.map((h) => ({
        ticker: h.ticker,
        shares: h.shares ?? null,
        value_usd: h.value_usd ?? null,
      })),
      filingDate
    );
    if (!latestBook.length) return [];
    return finish(build13FMarkToMarketSeries(latestBook, prices));
  }, [
    kind,
    fund.profile?.stats.filing_date,
    fund.profile?.stats.total_value_usd,
    fundHistoryQuery.data,
    fundPricesQuery.data,
    holdings,
  ]);
  const fundSeriesLoading =
    kind === 'fund_manager' &&
    ((fundHistoryQuery.isLoading && !fundHistoryQuery.data) ||
      (fundTickersKey.length > 0 && fundPricesQuery.isLoading && !fundPricesQuery.data));
  const resolvedFundSeries = useMemo(() => {
    if (fundMtmSeries.length >= 2) return fundMtmSeries;
    const fromApi = (fund.profile?.value_series ?? [])
      .filter((p) => p.date && p.value > 0)
      .map((p) => ({ date: p.date.slice(0, 10), value: p.value }));
    return fromApi.length >= 2 ? fromApi : [];
  }, [fundMtmSeries, fund.profile?.value_series]);

  const sessionWeights = useMemo(() => {
    if (holdingsEngine === 'congress' && congressPricedHoldings.length) {
      return congressPricedHoldings
        .filter((h) => h.quiverBaselineHoldingUSD > 0)
        .map((h) => ({ ticker: h.ticker.toUpperCase(), weight: h.quiverBaselineHoldingUSD }));
    }
    return holdings
      .map((h) => ({
        ticker: h.ticker.toUpperCase(),
        weight: Number(h.market_value ?? h.value_usd ?? 0),
      }))
      .filter((h) => h.ticker.length > 0 && h.weight > 0)
      .slice(0, MAX_BASKET_TICKERS);
  }, [holdingsEngine, congressPricedHoldings, holdings]);
  const sessionTickersKey = sessionWeights.map((h) => h.ticker).join(',');
  const intradaySpec = useMemo(() => intradaySpecForPeriod(period), [period]);
  const sessionHourlyQuery = useQuery({
    // ברים לפי הטווח שנבחר (1D 5 דק׳ · 1W 15 דק׳ · 1M שעה) — נשלף רק לטווח המוצג, cache 5 דק׳
    queryKey: ['darkpool', 'intraday', intradaySpec.range, intradaySpec.interval, sessionTickersKey],
    queryFn: () => fetchIntradayCloses(sessionTickersKey.split(','), intradaySpec),
    enabled: sessionTickersKey.length > 0,
    staleTime: 5 * 60_000,
  });

  const chartSeries = useMemo(() => {
    const base = selectProfileSnapshotSeries({
      kind,
      holdingsEngine,
      congressMtm: congressMtmSeries,
      form4Mtm: form4MtmSeries,
      trumpMtm: trumpMtmSeries,
      fundSeries: resolvedFundSeries,
      materialized: materializedChartSeries,
    });
    const hourly = sessionHourlyQuery.data;
    if (!hourly || !sessionWeights.length) return base;
    return appendWeightedIntraday(
      base,
      sessionWeights.map((leg) => ({
        weight: leg.weight,
        bars: hourly[leg.ticker] ?? [],
      }))
    );
  }, [
    kind,
    holdingsEngine,
    congressMtmSeries,
    form4MtmSeries,
    trumpMtmSeries,
    resolvedFundSeries,
    materializedChartSeries,
    sessionHourlyQuery.data,
    sessionWeights,
  ]);

  const snapshotPricesLoading =
    (kind === 'politician' &&
      holdingsEngine === 'congress' &&
      congressHoldings.length > 0 &&
      basketPricesQuery.isLoading) ||
    (kind === 'politician' &&
      holdingsEngine === 'trump' &&
      trumpTrades.length > 0 &&
      trumpPricesQuery.isLoading) ||
    (kind === 'insider' &&
      holdingsEngine === 'form4' &&
      form4Trades.length > 0 &&
      form4PricesQuery.isLoading) ||
    fundSeriesLoading;

  // סקלטון לגרף כל עוד אין סדרה ומשהו שהגרף תלוי בו עדיין נטען — גם כשהשווי כבר מוצג מ-cache
  // (שאילתות המחירים מתחילות רק אחרי שהעסקאות הגיעו, ו-isLoading לבדו פספס את החלון הזה)
  const chartInputsFetching =
    snapshotPricesLoading ||
    investor.loading ||
    investor.refreshing ||
    form4TradesQuery.isFetching ||
    congressPersonTradesQuery.isFetching ||
    quiverHoldingsQuery.isFetching ||
    basketPricesQuery.isFetching ||
    form4PricesQuery.isFetching ||
    trumpPricesQuery.isFetching ||
    sessionHourlyQuery.isFetching;

  const rowEngine =
    holdingsEngine === 'congress' ||
    holdingsEngine === 'form4' ||
    holdingsEngine === 'trump'
      ? holdingsEngine
      : 'filing';

  const displayHoldings = useMemo(() => {
    if (rowEngine === 'trump' || rowEngine === 'form4') return holdings;
    if (rowEngine === 'filing') {
      const quotes = quotesMapFromDailyCloses(fundPricesQuery.data);
      return holdings.map((h) => {
        const sym = h.ticker.toUpperCase();
        const live = quotes.get(sym) ?? h.current_price ?? null;
        const replayed = filingAvgByTicker.get(sym);
        const lastMark = impliedFilingPriceFrom13f(h.value_usd, h.shares);
        const entry = replayed?.avgCost ?? lastMark;
        const ret = filingHoldingReturnPct(live, entry);
        return {
          ...h,
          avg_price: entry,
          entry_price: entry,
          return_pct: ret,
        };
      });
    }
    if (rowEngine === 'congress') {
      const quotes = quotesMapFromDailyCloses(basketPricesQuery.data);
      const prices = basketPricesQuery.data ?? {};
      const lastBuyByTicker = lastCongressPurchaseByTicker(
        congressPersonTradesQuery.data ?? []
      );
      return holdings.map((h) => {
        const sym = h.ticker.toUpperCase();
        const ret = resolveCongressHoldingDisplayReturnPct({
          vendorAvgCost: h.vendor_avg_cost,
          vendorShares: h.vendor_shares,
          currentHoldingUsd: h.market_value,
          livePrice: quotes.get(sym) ?? null,
          vendorPriceChangePct: h.vendor_price_change_pct,
          lastPurchase: lastBuyByTicker.get(sym),
          dailyBars: prices[sym],
        });
        return ret == null ? h : { ...h, return_pct: ret };
      });
    }
    return holdings;
  }, [
    holdings,
    rowEngine,
    fundPricesQuery.data,
    filingAvgByTicker,
    basketPricesQuery.data,
    congressPersonTradesQuery.data,
  ]);

  // גרירה על הגרף: מחוץ ל-state של המסך — אחרת כל פריים מרנדר את כל המסך (גרף, עוגה, אחזקות) והסמן נתקע.
  // רק בלוק השווי (ScrubSubscriber) מתרנדר.
  const scrubStore = useScrubStore();
  // ערך הגרירה ב-UI thread — למספר המתגלגל (בלי רינדור React בכל פריים)
  const scrubValueSV = useSharedValue(0);
  const scrubActiveSV = useSharedValue(0);
  const pickedPeriodFor = useRef<string | null>(null);
  useEffect(() => {
    pickedPeriodFor.current = null;
    setPeriod('1M');
  }, [id, kind]);
  useEffect(() => {
    const key = `${kind}:${id}`;
    if (pickedPeriodFor.current === key || chartSeries.length < 2) return;
    setPeriod(pickDefaultSnapshotChartPeriod(chartSeries));
    pickedPeriodFor.current = key;
  }, [id, kind, chartSeries]);

  const showChart = chartSeries.length >= 2;
  const periodSeries = useMemo(
    () => (showChart ? filterChartSeriesByPeriod(chartSeries, period) : []),
    [showChart, chartSeries, period]
  );
  const periodDelta = useMemo(() => {
    if (periodSeries.length < 2) return null;
    const first = periodSeries[0]?.value;
    const last = periodSeries[periodSeries.length - 1]?.value;
    if (!(first > 0) || last == null || !Number.isFinite(last)) return null;
    // נטו מקניות/מכירות בתוך התקופה — אחרת כסף חדש שנכנס (טראמפ: ‎$0.3M → ‎$200M) נראה כרווח
    let netFlow = 0;
    let invested = first;
    for (let i = 1; i < periodSeries.length; i++) {
      const f = periodSeries[i]?.external_flow ?? 0;
      if (!Number.isFinite(f)) continue;
      netFlow += f;
      if (f > 0) invested += f;
    }
    const usd = last - first - netFlow;
    return { usd, pct: invested > 0 ? (usd / invested) * 100 : 0 };
  }, [periodSeries]);

  const openTradeRow = useCallback(
    (row: TradeRow) => {
      const params = profileRecentToTradeDetail({
        personKind: kind,
        personId: id,
        personName: displayName,
        personImage: imageUrl,
        tickerHint: ticker,
        row: {
          id: row.sourceId,
          ticker: row.ticker,
          txn_label: row.label,
          amount_label: row.amountRaw,
          date: row.date,
          traded_date: row.traded_date,
        },
      });
      if (!hasTradeDetailPayload(params)) return;
      void HapticFeedback.impactLight();
      stackNav.navigate('DarkPoolTradeDetail', params);
    },
    [kind, id, displayName, imageUrl, ticker, stackNav]
  );

  // פרטי אחזקה (13F — קרן / חברה): מההיסטוריה שכבר נטענה, בלי קריאת שרת נוספת
  const canOpenPosition = kind === 'fund_manager' && (fundHistoryQuery.data?.length ?? 0) > 0;
  const openPosition = useCallback(
    (rowTicker: string) => {
      const detail = build13FPositionDetail(fundHistoryQuery.data ?? [], rowTicker);
      if (!detail) return;
      void HapticFeedback.impactLight();
      stackNav.navigate('DarkPoolPosition', {
        detail,
        personName: displayName,
        personImage: isCompany && companyTicker ? brandfetchTickerLogoUri(companyTicker) : portraitUri,
      });
    },
    [fundHistoryQuery.data, stackNav, displayName, isCompany, companyTicker, portraitUri]
  );

  const holdingsHelp = useMemo(() => {
    if (holdingsEngine === 'congress') {
      return {
        title: CONGRESS_HOLDINGS_HELP_TITLE,
        body: CONGRESS_HOLDINGS_HELP_BODY,
      };
    }
    if (holdingsEngine === 'trump') {
      return {
        title: TRUMP_HOLDINGS_HELP_TITLE,
        body: TRUMP_HOLDINGS_HELP_BODY,
      };
    }
    if (isCompany) {
      return {
        title: FORM4_HOLDINGS_HELP_TITLE,
        body: 'אחזקות אסטרטגיות מדוח 13F הרבעוני האחרון שהחברה הגישה ל-SEC: רק מניות שנסחרות בארה״ב. לא כולל השקעות בחברות פרטיות, מניות שנסחרות רק מחוץ לארה״ב, מזומן ונכסים אחרים. הדוח מוגש עד 45 יום אחרי סוף הרבעון.',
      };
    }
    if (kind === 'fund_manager') {
      return {
        title: FORM4_HOLDINGS_HELP_TITLE,
        body: 'אחזקות מדוח 13F הרבעוני האחרון של הקרן ל-SEC (מניות אמריקאיות בלבד, בלי מזומן, שורטים ונכסים אחרים). הדוח מוגש עד 45 יום אחרי סוף הרבעון.',
      };
    }
    return {
      title: FORM4_HOLDINGS_HELP_TITLE,
      body: FORM4_HOLDINGS_HELP_BODY,
    };
  }, [holdingsEngine, kind, isCompany]);

  const openHoldingsHelp = useCallback(() => {
    void HapticFeedback.selection();
    setHelpOpen(true);
  }, []);

  // טראמפ: הרשימה מוצגת ל-16, אבל לפילוח — כל האחזקות מהשרת (מאות), כדי שהמקרא יפרט את כולן
  const serverAllHoldings = investor.profile?.metrics?.holdings;
  const pieHoldings = useMemo<HoldingAllocationInput[]>(() => {
    if (trumpProfile && serverAllHoldings && serverAllHoldings.length > holdings.length) {
      return serverAllHoldings.map((h) => ({
        ticker: h.ticker,
        allocation_pct: h.allocation_pct,
        market_value: h.market_value,
      }));
    }
    return holdings.map((h) => ({
      ticker: h.ticker,
      allocation_pct: h.allocation_pct,
      market_value: h.market_value,
      value_usd: h.value_usd,
      trade_count: h.trade_count,
    }));
  }, [holdings, serverAllHoldings, trumpProfile]);
  const pieColors = useHoldingsPieColors(pieHoldings);

  const onShareProfile = useCallback(() => {
    void HapticFeedback.selection();
    const top = displayHoldings[0] ?? holdings[0];
    const shareChart = holdingsToDistributionSlices(pieHoldings, 6).map((s) => ({
      ticker: s.label,
      pct: s.percentage,
      color: s.color ?? 'rgba(255,255,255,0.35)',
    }));
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
        holdingsChart: shareChart,
      })
    );
    setShareOpen(true);
  }, [
    displayHoldings,
    holdings,
    pieHoldings,
    id,
    kind,
    displayName,
    subtitle,
    imageUrl,
    ticker,
    portfolioValue,
  ]);

  // ערך בנקודה על הגרף — גם לכותרת בזמן גרירה (מתגלגל + גוון ירוק/אדום)
  const formatChartValue = (v: number) =>
    holdingsEngine === 'trump' && trumpUnitWeighted
      ? formatSignedChangePct(
          chartSeries[0]?.value ? ((v - chartSeries[0].value) / chartSeries[0].value) * 100 : 0
        )
      : kind === 'politician'
        ? formatCongressPortfolioHeroValue(v)
        : formatUsdRawOrDash(v);

  const followLabel = isFollowing ? 'במעקב' : `עקוב אחרי ${displayName}`;
  const showCongressValue = kind === 'politician' && holdingsEngine === 'congress' && portfolioValue != null;
  const showTrumpValue =
    holdingsEngine === 'trump' &&
    !trumpUnitWeighted &&
    portfolioValue != null &&
    portfolioValue > 0;
  const showOtherValue = kind !== 'politician' && portfolioValue != null && portfolioValue > 0;
  // טווח שווי משוער מהשרת (טראמפ) — לפי טווחי הדיווח × מחיר ביום העסקה → מחיר נוכחי
  const trumpValueRange =
    holdingsEngine === 'trump'
      ? ((investor.profile?.metrics as { value_range?: { low: number; high: number } } | undefined)
          ?.value_range ?? null)
      : null;
  const valueLabel =
    trumpValueRange
      ? 'שווי תיק משוער'
      : holdingsEngine === 'trump' && trumpUnitWeighted
      ? 'מדד סל (משקל שווה לעסקה)'
      : holdingsEngine === 'form4' || holdingsEngine === 'trump'
        ? 'שווי פוזיציות מדווחות'
        : kind === 'insider'
          ? // מנכ"ל/דירקטור מדווח רק על חברות שבהן הוא מכהן — לא כל התיק הפרטי
            'שווי אחזקות מדווחות'
          : isCompany
            ? 'שווי אחזקות:'
            : 'שווי תיק:';
  const heroValueText = showCongressValue
    ? formatCongressPortfolioHeroValue(portfolioValue)
    : showTrumpValue
      ? formatCongressPortfolioHeroValue(portfolioValue)
      : showOtherValue
        ? holdingsEngine === 'form4'
          ? formatForm4Value(portfolioValue)
          : formatUsdRawOrDash(portfolioValue)
        : null;
  const deltaTone =
    changeToneFromSigned(periodDelta?.usd) !== 'neutral'
      ? changeToneFromSigned(periodDelta?.usd)
      : changeToneFromSigned(periodDelta?.pct);
  const deltaColor = changeToneColor(deltaTone, tokens);

  const heroProps = {
    name: displayName,
    photoCandidates: portraitCandidates,
    height: heroHeight,
    topInset: insets.top,
    onBack,
    onBell: () => {
      void HapticFeedback.selection();
      void onToggleAlerts();
    },
    onShare: onShareProfile,
    isFollowing,
    followBusy,
    bellA11yLabel: isFollowing
      ? 'כבה התראות על עסקאות ודיווחים'
      : 'קבל התראות על עסקאות ודיווחים',
    shareA11yLabel: 'שתף פרופיל',
    scrollY: heroScrollY,
    logoTicker: companyTicker,
  };

  const envelope = <PersonProfileHero {...heroProps} />;
  const chromeEnvelope = <PersonProfileHero {...heroProps} hidePhoto />;
  const chromeFollowStyle = useMemo(
    () => ({
      transform: [
        {
          translateY: heroScrollY.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -1],
            extrapolateLeft: 'clamp',
          }),
        },
      ],
    }),
    [heroScrollY]
  );
  const heroBackdrop = (
    <View
      pointerEvents="none"
      style={[styles.heroBackdrop, { height: heroHeight }]}
    >
      <PersonProfileHero {...heroProps} pinned photoOnly />
    </View>
  );
  const chromeOverlay = (
    <Animated.View
      pointerEvents="box-none"
      collapsable={false}
      style={[styles.heroChrome, { height: heroHeight }, chromeFollowStyle]}
    >
      {chromeEnvelope}
    </Animated.View>
  );

  const followDock = (
    <View
      pointerEvents="box-none"
      style={[styles.followDock, { paddingBottom: followDockBottom }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={followLabel}
        disabled={followBusy}
        onPress={() => {
          if (followBusy) return;
          void HapticFeedback.selection();
          void onToggleAlerts();
        }}
        style={({ pressed }) => [
          styles.followPill,
          { borderRadius: PROFILE_FOLLOW_PILL_RADIUS },
          followBusy && { opacity: 0.55 },
          pressed && !followBusy && { opacity: 0.88, transform: [{ scale: 0.985 }] },
        ]}
      >
        <View
          style={[
            chromeSurfaceCardStyle(tokens, {
              borderRadius: PROFILE_FOLLOW_PILL_RADIUS,
              width: '100%',
              overflow: 'hidden',
            }),
            styles.followPillInner,
          ]}
        >
          {followBusy ? (
            <ActivityIndicator size="small" color={tokens.colors.text.primary} />
          ) : (
            <Text style={styles.followPillText} numberOfLines={1}>
              {followLabel}
            </Text>
          )}
        </View>
      </Pressable>
    </View>
  );

  if (loading) {
    return (
      <ScreenChrome rtl>
        <View style={[styles.flex, darkPoolTransparentFill]}>
          {envelope}
          <ScrollView style={styles.flex} contentContainerStyle={[styles.body, { paddingBottom: 12 }]}>
            {/* כמו המסך האמיתי: תווית + שווי + שינוי, ואז הגרף ושורת התקופות */}
            <View style={{ marginTop: 8, alignItems: 'flex-end', gap: 8 }}>
              <SkeletonBox width={70} height={14} />
              <SkeletonBox width="62%" height={34} borderRadius={10} />
              <SkeletonBox width="44%" height={14} />
            </View>
            <View style={{ marginTop: 16 }}>
              <LineChartSkeleton height={kind === 'politician' ? 176 : 220} periods={SNAPSHOT_CHART_PERIODS.length} />
            </View>
            <View style={{ marginTop: 24, gap: 12 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <ListItemSkeleton key={i} delay={400 + i * 70} showAvatar={false} />
              ))}
            </View>
          </ScrollView>
          {followDock}
        </View>
      </ScreenChrome>
    );
  }

  return (
    <ScreenChrome rtl>
      <View style={[styles.flex, darkPoolTransparentFill]}>
        <Animated.ScrollView
          style={[styles.flex, darkPoolTransparentFill]}
          showsVerticalScrollIndicator={false}
          bounces
          alwaysBounceVertical
          overScrollMode="always"
          scrollEventThrottle={16}
          onScroll={onHeroScroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refetch()}
              tintColor={tokens.colors.primary.main}
            />
          }
          contentContainerStyle={[styles.scroll, { paddingBottom: 12 }]}
        >
          <Animated.View collapsable={false}>
          <View style={{ height: heroHeight }} collapsable={false} />

          <View style={styles.body}>
          {error ? (
            <UICard variant="outlined" padding="md" style={styles.errCard}>
              <Text style={styles.errText}>{error}</Text>
            </UICard>
          ) : null}

          {/* טראמפ: תיק משוער (טווחי הדיווח × מחיר ביום העסקה → מחיר נוכחי), כמו שאר הפוליטיקאים */}
          <>
          {showCongressValue ||
          showTrumpValue ||
          showOtherValue ||
          (holdingsEngine === 'trump' && trumpUnitWeighted && chartSeries.length >= 2) ? (
            <View style={styles.valueBlock}>
              <View style={styles.valueLabelRow}>
                <Text style={styles.valueLabel}>{valueLabel}</Text>
                {holdingsEngine === 'congress' ||
                holdingsEngine === 'form4' ||
                holdingsEngine === 'trump' ? (
                  <Pressable
                    onPress={openHoldingsHelp}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="על המספרים"
                    style={styles.valueHelpBtn}
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={16}
                      color={tokens.colors.text.secondary}
                    />
                  </Pressable>
                ) : null}
              </View>
              <ScrubSubscriber store={scrubStore}>
                {(scrubPoint) => {
                  // גרירה: שינוי מתחילת התקופה המוצגת עד הנקודה (בלי תיקון זרימות — כמו הגרף)
                  // נטו מכסף שנכנס/יצא עד הנקודה (קניות/מכירות) — כמו שינוי התקופה; אחרת קנייה נראית כרווח
                  const scrubFirst = periodSeries[0]?.value;
                  let scrubDelta: { usd: number; pct: number } | null = null;
                  if (scrubPoint && periodSeries.length >= 2 && scrubFirst > 0) {
                    let netFlow = 0;
                    let invested = scrubFirst;
                    for (let i = 1; i < periodSeries.length && periodSeries[i].date <= scrubPoint.date; i++) {
                      const f = periodSeries[i]?.external_flow ?? 0;
                      if (!Number.isFinite(f)) continue;
                      netFlow += f;
                      if (f > 0) invested += f;
                    }
                    const usd = scrubPoint.value - scrubFirst - netFlow;
                    scrubDelta = { usd, pct: invested > 0 ? (usd / invested) * 100 : 0 };
                  }
                  return (
                    <>
              {heroValueText ? (
                // שווי ב-UI thread: הגרירה מעדכנת SharedValue והטקסט מתחלף מיד — בלי React; motion blur קצר בכל שינוי
                <View style={styles.heroFlowContainer}>
                  <MotionNumber
                    scrubValue={scrubValueSV}
                    scrubActive={scrubActiveSV}
                    value={portfolioValue ?? 0}
                    style={heroFlowStyle(styles.heroValue, portfolioValue)}
                    upColor={tokens.colors.primary.main}
                    downColor={tokens.colors.text.danger}
                  />
                </View>
              ) : holdingsEngine === 'trump' && trumpUnitWeighted && periodDelta ? (
                <AnimatedNumber
                  text={toDataIsland(
                    scrubPoint ? formatChartValue(scrubPoint.value) : formatSignedChangePct(periodDelta.pct)
                  )}
                  value={scrubPoint ? scrubPoint.value : periodDelta.pct}
                  fast={!!scrubPoint}
                  style={styles.heroValue}
                />
              ) : null}
              {(showCongressValue ||
                showTrumpValue ||
                showOtherValue ||
                (holdingsEngine === 'trump' && trumpUnitWeighted)) &&
              scrubPoint ? (
                // בזמן גרירה — השינוי מתחילת התקופה עד הנקודה ($ ו-%) + התאריך, כמו InsiderWave
                <View style={styles.deltaRow}>
                  {scrubDelta ? (
                    <>
                      <Text
                        style={[styles.deltaFigure, { color: scrubDelta.usd >= 0 ? tokens.colors.primary.main : tokens.colors.text.danger }]}
                        numberOfLines={1}
                      >
                        {toDataIsland(formatCongressDeltaUsd(scrubDelta.usd))}
                      </Text>
                      <View style={[styles.deltaDot, { backgroundColor: scrubDelta.usd >= 0 ? tokens.colors.primary.main : tokens.colors.text.danger }]} />
                      <Text
                        style={[styles.deltaFigure, { color: scrubDelta.usd >= 0 ? tokens.colors.primary.main : tokens.colors.text.danger }]}
                        numberOfLines={1}
                      >
                        {toDataIsland(formatSignedChangePct(scrubDelta.pct))}
                      </Text>
                    </>
                  ) : null}
                  <Text style={[styles.deltaFigure, { color: tokens.colors.text.secondary }]}>
                    {toDataIsland(scrubPoint.date.split('-').reverse().join('.'))}
                  </Text>
                </View>
              ) : (showCongressValue ||
                showTrumpValue ||
                showOtherValue ||
                (holdingsEngine === 'trump' && trumpUnitWeighted)) &&
              periodDelta ? (
                // תשואה ורווח נטו — טקסט רגיל (בלי גלגול/הבהוב); האנימציה רק לשווי התיק
                <View style={styles.deltaRow}>
                  <Text style={[styles.deltaFigure, { color: deltaColor }]} numberOfLines={1}>
                    {toDataIsland(formatCongressDeltaUsd(periodDelta.usd))}
                  </Text>
                  <View style={[styles.deltaDot, { backgroundColor: deltaColor }]} />
                  <Text style={[styles.deltaFigure, { color: deltaColor }]} numberOfLines={1}>
                    {toDataIsland(formatSignedChangePct(periodDelta.pct))}
                  </Text>
                </View>
              ) : null}
                    </>
                  );
                }}
              </ScrubSubscriber>
            </View>
          ) : null}

          {showChart ? (
            <View style={styles.chartWrap}>
              {/* watermark של DarkPool (השור והדוב) מאחורי הקו — מסכת הלוגו המלאה (אותה של סמל הדרגה, הדוב שלם),
                  בצבע אחיד של הטקסט (כהה בבהיר, בהיר בכהה), שקיפות עדינה לפי ערכת הנושא. */}
              <View pointerEvents="none" style={[styles.chartWatermark, { height: kind === 'politician' ? 176 : 220 }]}>
                <Image
                  source={require('../../assets/badges/rank_mark.png')}
                  style={[
                    {
                      height: (kind === 'politician' ? 176 : 220) * 0.86,
                      aspectRatio: 686 / 512,
                      tintColor: tokens.colors.text.primary,
                      opacity: String(tokens.colors.background.primary) === LIGHT_CANVAS ? 0.045 : 0.055,
                    },
                  ]}
                  resizeMode="contain"
                />
              </View>
              <PortfolioValueChart
                series={chartSeries}
                height={kind === 'politician' ? 176 : 220}
                currency="USD"
                selectedPeriod={period}
                onPeriodChange={setPeriod}
                showHeader={false}
                formatValue={formatChartValue}
                onScrubPoint={scrubStore.set}
                scrubValue={scrubValueSV}
                scrubActive={scrubActiveSV}
                showPointMarkers={false}
                periods={SNAPSHOT_CHART_PERIODS}
              />
            </View>
          ) : chartInputsFetching ? (
            <View style={styles.chartWrap}>
              <LineChartSkeleton height={kind === 'politician' ? 176 : 220} periods={SNAPSHOT_CHART_PERIODS.length} />
            </View>
          ) : kind === 'fund_manager' ||
            holdingsEngine === 'congress' ||
            holdingsEngine === 'form4' ||
            holdingsEngine === 'trump' ||
            (kind === 'politician' &&
              quiverHoldingsQuery.isFetched &&
              !trumpProfile) ? (
            <UICard variant="soft" padding="md" style={styles.chartCard}>
              <Text style={[styles.muted]}>
                {snapshotChartEmptyCopy({
                  kind,
                  holdingsEngine,
                  hasHoldings:
                    congressHoldings.length > 0 ||
                    form4Trades.length > 0 ||
                    trumpTrades.length > 0 ||
                    (fundHistoryQuery.data?.length ?? 0) > 0,
                })}
              </Text>
            </UICard>
          ) : null}

          {/* אחזקות — עוגה כמו ביומן מסחר */}
          {pieHoldings.length > 0 ? (
            <HoldingsPieSection
              title={kind === 'insider' ? 'פילוח אחזקות מדווחות' : 'פילוח אחזקות'}
              holdings={pieHoldings}
              // חברה: הלוגו שלה במרכז הפילוח (לא האות הראשונה)
              avatarUrl={isCompany && companyTicker ? brandfetchTickerLogoUri(companyTicker) : portraitUri}
              avatarCandidates={
                isCompany && companyTicker
                  ? [brandfetchTickerLogoUri(companyTicker), ...(portraitCandidates ?? [])].filter(
                      (u): u is string => !!u,
                    )
                  : portraitCandidates
              }
              userInitial={userInitial}
              weightStyle={
                holdingsEngine === 'congress'
                  ? 'congress'
                  : holdingsEngine === 'form4' || holdingsEngine === 'trump'
                    ? 'form4'
                    : 'filing'
              }
              honestyTag={null}
              onHelpPress={
                holdingsEngine === 'congress' ||
                holdingsEngine === 'form4' ||
                holdingsEngine === 'trump'
                  ? openHoldingsHelp
                  : undefined
              }
              helpA11yLabel="על המספרים"
            />
          ) : null}

          {kind === 'politician' &&
          quiverHoldingsQuery.isLoading &&
          displayHoldings.length === 0 ? (
            <View style={styles.listPanel}>
              <ListItemSkeleton delay={80} showAvatar={false} />
              <ListItemSkeleton delay={140} showAvatar={false} />
              <ListItemSkeleton delay={200} showAvatar={false} />
            </View>
          ) : displayHoldings.length > 0 ? (
            <>
              <View style={styles.sectionTitleRow}>
                <Text style={[styles.sectionTitle, styles.sectionTitleInRow]}>
                  {holdingsEngine === 'congress'
                    ? 'רשימת אחזקות'
                    : kind === 'insider'
                      ? 'אחזקות בחברות שבהן מכהן'
                      : holdingsEngine === 'form4' || holdingsEngine === 'trump'
                        ? 'פוזיציות מדווחות'
                        : isCompany
                          ? 'אחזקות אסטרטגיות'
                          : 'אחזקות מובילות'}
                </Text>
              </View>
              <UICard
                variant="soft"
                glassIntensity="light"
                padding="none"
                style={styles.listPanel}
                contentContainerStyle={styles.listPanelInner}
              >
                {displayHoldings.map((h, index) => {
                  const cells = formatHoldingRowCells({
                    ticker: h.ticker,
                    engine: rowEngine,
                    allocationPct: h.allocation_pct,
                    valueUsd: h.market_value ?? h.value_usd ?? null,
                    returnPct: h.return_pct,
                  });
                  return (
                    <React.Fragment key={h.ticker}>
                      <Pressable
                        style={styles.listRowPress}
                        disabled={!canOpenPosition}
                        onPress={() => openPosition(h.ticker)}
                        accessibilityRole={canOpenPosition ? 'button' : undefined}
                        accessibilityLabel={canOpenPosition ? `פרטי אחזקה ${h.ticker}` : undefined}
                      >
                        <HoldingsListRow
                          ticker={cells.ticker}
                          allocationLabel={cells.allocationLabel}
                          valueLabel={cells.valueLabel}
                          returnLabel={cells.returnLabel}
                          returnPct={h.return_pct ?? null}
                          colorByTicker={pieColors}
                        />
                      </Pressable>
                      {index < displayHoldings.length - 1 ? (
                        <View style={styles.listRowDivider} />
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </UICard>
            </>
          ) : null}

          </>

          {/* עסקאות */}
          {trades.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>עסקאות אחרונות</Text>
              <UICard
                variant="soft"
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
                        onPress={() => openTradeRow(t)}
                        style={styles.listRowPress}
                        accessibilityRole="button"
                        accessibilityLabel={`פרטי עסקה ${t.ticker}`}
                      >
                        <View style={styles.listRow}>
                          <View style={styles.leadingIcon}>
                            <TickerLogo symbol={t.ticker} size={36} borderRadius={18} />
                          </View>
                          <View style={styles.iconTickerGap} />
                          <View style={styles.rowText}>
                            <Text style={styles.tradeTicker} numberOfLines={1}>
                              {toDataIsland(t.ticker)}
                            </Text>
                            <Text style={styles.rowMeta} numberOfLines={1}>
                              <Text style={[styles.rowMetaVerb, { color: sideColor }]}>
                                {sell ? 'מכירה' : 'קנייה'}
                              </Text>
                              {t.amount ? ` · ${t.amount}` : null}
                            </Text>
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
          </View>
          </Animated.View>
        </Animated.ScrollView>
        {heroBackdrop}
        {chromeOverlay}
        {followDock}
      </View>
      <ShareDestinationSheet
        visible={shareOpen && !!shareAttachment}
        attachment={shareAttachment}
        onClose={() => {
          setShareOpen(false);
          setShareAttachment(null);
        }}
      />
      <HelpSheet
        visible={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={holdingsHelp.title}
        body={holdingsHelp.body}
      />
    </ScreenChrome>
  );
}

function isSellTxnLabel(label: string): boolean {
  const l = label.toLowerCase();
  return /sell|sale|מכר|מכיר|dispose/.test(l);
}

function congressHoldingToRow(
  h: CongressModelHolding,
  firstKnownDate?: string | null
): HoldingRow {
  return {
    ticker: h.ticker,
    title: h.ticker,
    meta: [formatHoldingValue(h), formatHoldingWeight(h)].filter(Boolean).join(' · '),
    allocation_pct: h.quiverAllocationPercent,
    market_value: h.quiverBaselineHoldingUSD,
    return_pct: null,
    avg_price: h.vendorAvgCost ?? null,
    entry_price: h.vendorAvgCost ?? null,
    vendor_shares: h.vendorShares ?? null,
    vendor_avg_cost: h.vendorAvgCost ?? null,
    vendor_price_change_pct: h.vendorPriceChangePct ?? null,
    first_added_date: firstKnownDate ?? null,
    asOfDate: h.asOfDate ?? null,
    dateLabel: firstKnownDate ? 'added' : null,
    honestyTag: null,
  };
}

/** $76.7M / $1.2B — לטווח שווי משוער */
function trumpHoldingToRow(h: TrumpModelHolding, unitWeighted = false): HoldingRow {
  return {
    ticker: h.ticker,
    title: h.ticker,
    meta: unitWeighted
      ? `${formatForm4Weight(h.weightPct)} · משקל שווה לעסקה`
      : [formatForm4Value(h.marketValueUsd), formatForm4Weight(h.weightPct)]
          .filter(Boolean)
          .join(' · '),
    allocation_pct: h.weightPct,
    market_value: unitWeighted ? null : h.marketValueUsd,
    value_usd: unitWeighted ? null : h.marketValueUsd,
    return_pct: h.returnPct,
    avg_price: h.entryPrice,
    entry_price: h.entryPrice,
    first_added_date: h.firstAddedDate,
    dateLabel: h.firstAddedDate ? 'added' : null,
    honestyTag: unitWeighted ? null : HOLDING_TAG_EXACT,
  };
}

function form4HoldingToRow(h: InsiderForm4Holding): HoldingRow {
  const sharesLabel = formatSharesCompact(h.exactShares);
  return {
    ticker: h.ticker,
    title: h.ticker,
    meta: [
      formatHoldingValue(h),
      sharesLabel ? `${sharesLabel} מניות` : null,
      formatHoldingWeight(h),
    ]
      .filter(Boolean)
      .join(' · '),
    allocation_pct: h.exactPortfolioWeight,
    market_value: h.calculatedValueUSD,
    return_pct: h.entryReturnPct,
    avg_price: h.avgCost,
    entry_price: h.avgCost,
    first_added_date: null,
    dateLabel: null,
    honestyTag: HOLDING_TAG_EXACT,
    qty_disclosed: true,
  };
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
    flex: {
      flex: 1,
      backgroundColor: 'transparent',
      overflow: 'hidden',
      ...darkPoolRtlContent,
    },
    heroBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1,
      elevation: 1,
      // התמונה גדלה למטה במשיכה — לא לחתוך בגובה ה-hero
      overflow: 'visible',
    },
    heroChrome: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 2,
      elevation: 2,
    },
    scroll: {
      direction: 'rtl',
    },
    body: {
      paddingHorizontal: 16,
      paddingTop: 10,
      direction: 'rtl',
    },
    errCard: {
      marginBottom: 12,
      borderColor: tokens.colors.border.danger,
    },
    errText: {
      ...darkPoolPhysicalRightText,
      color: tokens.colors.text.danger,
      fontSize: DARK_POOL_TYPE.body.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.body.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      alignSelf: 'stretch',
    },
    valueBlock: {
      marginBottom: APP_LAYOUT.stackGapSmall,
      width: '100%',
      direction: 'ltr',
      alignItems: 'flex-end',
    },
    valueLabelRow: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      gap: APP_LAYOUT.stackGapSmall,
    },
    valueLabel: {
      ...darkPoolSectionTitleStyle,
      flexShrink: 1,
      width: undefined,
      color: tokens.colors.text.primary,
    },
    valueHelpBtn: {
      padding: 2,
    },
    heroFlowContainer: {
      alignSelf: 'stretch',
      marginTop: APP_LAYOUT.cardMetricLabelToValueGap,
    },
    heroValue: {
      direction: 'ltr',
      writingDirection: 'ltr',
      textAlign: 'right',
      marginTop: APP_LAYOUT.cardMetricLabelToValueGap,
      fontSize: DARK_POOL_TYPE.cardMetricValue.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.cardMetricValue.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardMetricValue.fontWeight,
      letterSpacing: DARK_POOL_TYPE.cardMetricValue.letterSpacing,
      color: tokens.colors.text.primary,
    },
    deltaRow: {
      marginTop: APP_LAYOUT.titleSubtitleGap,
      alignSelf: 'flex-end',
      direction: 'ltr',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    deltaFigure: {
      fontSize: DARK_POOL_TYPE.cardBody.fontSize,
      lineHeight: DARK_POOL_TYPE.cardBody.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      writingDirection: 'ltr',
      fontVariant: ['tabular-nums'],
    },
    deltaDot: {
      width: CHANGE_DOT_SIZE,
      height: CHANGE_DOT_SIZE,
      borderRadius: CHANGE_DOT_SIZE / 2,
    },
    followDock: {
      paddingHorizontal: PROFILE_FOLLOW_DOCK_HPAD,
      paddingTop: PROFILE_FOLLOW_DOCK_GAP,
      zIndex: 20,
      elevation: 12,
    },
    followPill: {
      alignSelf: 'stretch',
      width: '100%',
      overflow: 'hidden',
    },
    followPillInner: {
      height: PROFILE_FOLLOW_PILL_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    followPillText: {
      fontSize: DARK_POOL_TYPE.body.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.body.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
      textAlign: 'center',
    },
    chartWatermark: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chartWrap: {
      marginBottom: APP_LAYOUT.sectionGap,
      alignSelf: 'stretch',
    },
    chartCard: {
      marginBottom: APP_LAYOUT.sectionGap,
      borderRadius: UI_CARD_RADIUS,
      overflow: 'hidden',
    },
    sectionTitle: {
      ...darkPoolSectionTitleStyle,
      color: tokens.colors.text.primary,
      marginBottom: APP_LAYOUT.sectionHeaderToContent,
    },
    sectionTitleRow: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: APP_LAYOUT.stackGapSmall,
      marginBottom: APP_LAYOUT.sectionHeaderToContent,
    },
    // סגנון הכותרת רוחב מלא (100%) — בשורה עם תגית «נכון לרבעון» הוא דחף את התגית אל מחוץ למסך
    sectionTitleInRow: {
      marginBottom: 0,
      marginTop: 0,
      width: undefined,
      flexShrink: 1,
    },
    honestyTag: {
      ...darkPoolPhysicalRightText,
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.caption.lineHeight,
      fontWeight: DARK_POOL_TYPE.caption.fontWeight,
      color: tokens.colors.text.secondary,
    },
    honestyTagInRow: {
      flexShrink: 0,
    },
    rowHonestyTag: {
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.caption.lineHeight,
      fontWeight: DARK_POOL_TYPE.caption.fontWeight,
      color: tokens.colors.text.secondary,
    },
    listPanel: {
      marginBottom: APP_LAYOUT.sectionGap,
      borderRadius: UI_CARD_RADIUS,
      overflow: 'hidden',
      alignSelf: 'stretch',
      width: '100%',
    },
    listPanelInner: {
      width: '100%',
      alignSelf: 'stretch',
    },
    leadingIcon: {
      flexShrink: 0,
    },
    iconTickerGap: {
      width: 12,
      flexShrink: 0,
    },
    listRowPress: {
      width: '100%',
      alignSelf: 'stretch',
    },
    listRow: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      width: '100%',
      paddingVertical: APP_LAYOUT.cardTitleToBodyGap,
      paddingHorizontal: APP_LAYOUT.cardPadding,
      minHeight: 56,
    },
    listRowDivider: {
      // קו מפריד מפורש (לא border על Pressable) — נראה ברור יותר על רקע glass
      height: 1,
      backgroundColor: tokens.colors.border.divider,
      marginHorizontal: APP_LAYOUT.cardPadding,
      alignSelf: 'stretch',
    },
    rowText: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      justifyContent: 'center',
      alignItems: 'stretch',
    },
    tradeTicker: {
      direction: 'ltr',
      textAlign: 'right',
      writingDirection: 'ltr',
      fontSize: DARK_POOL_TYPE.cardBody.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.cardBody.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
      includeFontPadding: false,
    },
    rowMeta: {
      ...darkPoolPhysicalRightText,
      marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
      includeFontPadding: false,
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.caption.lineHeight,
      fontWeight: DARK_POOL_TYPE.caption.fontWeight,
      color: tokens.colors.text.secondary,
    },
    rowMetaVerb: {
      fontWeight: DARK_POOL_TYPE.cardMetricLabel.fontWeight,
    },
    tradeRight: { alignItems: 'stretch', flexShrink: 0 },
    tradeDate: {
      ...darkPoolPhysicalRightText,
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      lineHeight: DARK_POOL_TYPE.caption.lineHeight,
      fontWeight: DARK_POOL_TYPE.caption.fontWeight,
      color: tokens.colors.text.secondary,
      fontVariant: ['tabular-nums'],
    },
    muted: {
      ...darkPoolPhysicalRightText,
      fontSize: DARK_POOL_TYPE.cardSubtitle.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.cardSubtitle.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardSubtitle.fontWeight,
      color: tokens.colors.text.secondary,
    },
  });
}
