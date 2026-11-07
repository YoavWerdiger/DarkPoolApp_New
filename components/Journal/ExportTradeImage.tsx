import { ROOT_DIR, UI_DIR, dirIcon } from '../../lib/i18n/direction';
import i18n from '../../lib/i18n';
import { TEXT_DIR } from '../../lib/i18n/language';
import { runAfterInteractions } from '../../utils/runAfterInteractions';
import { legacyAlert } from '../../utils/appDialog';
import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import QRCode from 'react-native-qrcode-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDesignTokens } from '../ui/DesignTokens';
import { ForceDarkTheme } from '../../context/ThemeContext';
import UIButton from '../ui/UIButton';
import { SettingsGlassCard, SettingsSwitchRow, SettingsSectionTitle } from '../profile/ProfileSettingsUI';
import { APP_TYPE } from '../ui/appType';
import type { Trade as JournalTrade } from '../../screens/Journal/tradeTypes';
import type { Trade as PortfolioTrade } from '../../screens/Portfolios/portfolioTypes';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '../ui/BottomSheet/BottomSheet';
import { useBottomSheetClose } from '../ui/BottomSheet/BottomSheet';
import {
  SHEET_BACKDROP_OPACITY,
  sheetContentBottomPadding,
} from '../ui/BottomSheet/sheetGlass';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE } from '../ui/DayNavBlurButton';
import { brandfetchTickerLogoUri } from '../../utils/brandfetch';
import Svg, { Circle, Defs, LinearGradient, Mask, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { APP_FONT } from '../ui/appFont';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_LINKS } from '../../utils/appMeta';
import {
  getHistoricalPrices,
  type YahooHistoryInterval,
  type YahooHistoryRange,
} from '../../services/portfolios/portfolioPriceFeed';

/** נתונים מינימליים לכרטיס שיתוף ויזואלי */
export type ExportableTrade = {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  entry_price: number;
  /** סגור: מחיר יציאה. פתוח: מחיר נוכחי (mark). */
  exit_price: number;
  quantity: number;
  entry_date: string;
  /** סגור: תאריך יציאה. פתוח: מחרוזת ריקה. */
  exit_date: string;
  pnl: number;
  return_percentage?: number | null;
  /** ברירת מחדל CLOSED — יומן / היסטוריה */
  status?: 'OPEN' | 'CLOSED';
};

interface ExportTradeImageProps {
  trade: ExportableTrade | JournalTrade | null;
  visible: boolean;
  onClose: () => void;
}

/** משפט שיווקי קצר ליד ה־QR — מקצועי, לא זול */
const SHARE_CTA_LINE = i18n.t('auto.components__Journal__ExportTradeImage.s1');
const SHARE_CTA_SUB = i18n.t('auto.components__Journal__ExportTradeImage.s2');


/** מה מוצג בתמונה — נשמר בין שיתופים */
type ShareOptions = { showPnl: boolean; showReturn: boolean; showPrices: boolean };
const SHARE_OPTIONS_KEY = 'tradeShare:options';
const DEFAULT_SHARE_OPTIONS: ShareOptions = { showPnl: true, showReturn: true, showPrices: false }; // showPrices: הוסר מהכרטיס, נשאר לתאימות ל-AsyncStorage

/** מידות העיצוב — הכרטיס מצויר ב-viewBox 340×425 ומוקטן/מוגדל באחידות */
const ART_W = 340;
const ART_H = 425;
const CHART_TOP = 256;
const CHART_BOT = 392;
const CHART_PAD_X = 22;
const FOOTER_H = 72;
/** מרווח של ההזמנה וה-QR מהתחתית */
const FOOTER_BOTTOM = 12;

const CARD_BG = '#0A0C0B';
const INK = '#F2F2F2';
const INK_2 = 'rgba(242,242,242,0.5)';
const QR_SIZE = 56;
/** אזור ה-QR בקואורדינטות הציור — קו הגרף נעצר שם כדי שלא יעבור על הקוד */
const QR_CLEAR = {
  x: UI_DIR === 'rtl' ? 8 : ART_W - 8 - (QR_SIZE + 12),
  y: ART_H - FOOTER_BOTTOM - FOOTER_H / 2 - (QR_SIZE + 12) / 2,
  size: QR_SIZE + 12,
};
const WIN = '#00D64B';
const LOSS = '#FF4D4D';

// הלוגו המלא (שור־ודוב + DARKPOOL + «קהילת הסוחרים של ישראל») — מקומי, כדי שיהיה טעון ברגע הצילום
const BRAND_LOGO = require('../../assets/darkpool-share-logo.png');
const BRAND_LOGO_ASPECT = 1330 / 595;
// שור ודוב יחד — צללית אחת בצבע התוצאה
const BULL_BEAR = require('../../assets/branding/share-bullbear.png');
const BULL_BEAR_ASPECT = 575 / 420;


/** מספר אקראי דטרמיניסטי (mulberry32) — אותו טרייד תמיד מקבל אותו גרף */
function seededRandom(seedText: string) {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * קו המחיר על הכרטיס: תנועת המחיר האמיתית מהכניסה ליציאה (real), ואם אין נתונים —
 * קו דקורטיבי דטרמיניסטי באותו כיוון (עולה אם המחיר עלה, גם בשורט).
 */
function priceArt(seedText: string, priceUp: boolean, real?: number[] | null) {
  let v: number[];
  if (real && real.length >= 3) {
    v = real;
  } else {
    const rnd = seededRandom(seedText);
    v = [0];
    for (let i = 1; i < 34; i++) v.push(v[i - 1] + (rnd() * 2 - 1) * 0.9 + (priceUp ? 0.35 : -0.35));
  }
  const n = v.length;
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  const pts = v.map((val, i) => ({
    x: CHART_PAD_X + ((ART_W - 2 * CHART_PAD_X) * i) / (n - 1),
    y: CHART_BOT - (CHART_BOT - CHART_TOP) * ((val - lo) / (hi - lo || 1)),
  }));
  const first = pts[0];
  const last = pts[n - 1];
  const line = `M0 ${first.y.toFixed(1)} ` + pts.map((p) => `L${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ` L${ART_W} ${last.y.toFixed(1)}`;
  const area = `${line} L${ART_W} ${ART_H} L0 ${ART_H} Z`;
  return { line, area, first, last };
}

const DAY_MS = 86_400_000;

/** טווח ורזולוציה ל-Yahoo: הטווח נספר אחורה מהיום, אז הוא חייב לכסות את תאריך הכניסה */
function historyQuery(entryMs: number, endMs: number): { range: YahooHistoryRange; interval: YahooHistoryInterval } {
  const ageDays = (Date.now() - entryMs) / DAY_MS;
  const spanDays = (endMs - entryMs) / DAY_MS;
  const range: YahooHistoryRange =
    ageDays <= 4 ? '5d' : ageDays <= 28 ? '1mo' : ageDays <= 88 ? '3mo' : ageDays <= 178 ? '6mo' : ageDays <= 360 ? '1y' : ageDays <= 1800 ? '5y' : 'max';
  // Yahoo: 15m עד 60 יום אחורה, 1h עד 730
  let interval: YahooHistoryInterval = '1d';
  if (spanDays <= 2 && ageDays <= 28) interval = '15m';
  else if (spanDays <= 20 && ageDays <= 360) interval = '1h';
  return { range, interval };
}

/** מחירי סגירה בין הכניסה ליציאה (או עכשיו), כשהקצוות הם מחירי הכניסה והיציאה עצמם */
async function loadTradePath(trade: ExportableTrade): Promise<number[] | null> {
  const entryMs = new Date(trade.entry_date).getTime();
  let endMs = trade.exit_date ? new Date(trade.exit_date).getTime() : Date.now();
  // תאריך בלי שעה (YYYY-MM-DD) — יום היציאה נספר עד סופו, אחרת עסקה תוך-יומית לא מקבלת נקודות
  if (trade.exit_date && trade.exit_date.length <= 10) endMs += DAY_MS - 1;
  if (!Number.isFinite(entryMs) || !Number.isFinite(endMs) || endMs < entryMs) return null;
  const { range, interval } = historyQuery(entryMs, endMs);
  const points = await getHistoricalPrices(trade.symbol, range, { interval });
  const daily = interval === '1d';
  const startKey = trade.entry_date.slice(0, 10);
  const endKey = (trade.exit_date || new Date().toISOString()).slice(0, 10);
  const inside = points.filter((p) => {
    if (daily) return p.date >= startKey && p.date <= endKey;
    const t = new Date(p.date).getTime();
    return t >= entryMs && t <= endMs;
  });
  if (inside.length < 2) return null;
  let closes = inside.map((p) => p.close);
  // עד ~80 נקודות — מספיק לקו חלק בכרטיס
  if (closes.length > 80) {
    const step = closes.length / 80;
    closes = Array.from({ length: 80 }, (_, i) => closes[Math.floor(i * step)]);
  }
  return [trade.entry_price, ...closes, trade.exit_price];
}

/** אייקון מגמה בתוך הפיל של LONG / SHORT (כמו Ionicons trending-up/down) */
function TrendGlyph({ up, color }: { up: boolean; color: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24">
      <Path
        d={up ? 'M3 17 L9 11 L13 15 L21 7 M15 7 L21 7 L21 13' : 'M3 7 L9 13 L13 9 L21 17 M15 17 L21 17 L21 11'}
        stroke={color}
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function journalTradeToExportable(trade: JournalTrade): ExportableTrade {
  return {
    id: trade.id,
    symbol: trade.symbol,
    direction: trade.direction,
    entry_price: trade.entry_price,
    exit_price: trade.exit_price,
    quantity: trade.quantity,
    entry_date: trade.entry_date,
    exit_date: trade.exit_date,
    pnl: trade.pnl,
    return_percentage: trade.return_percentage,
    status: 'CLOSED',
  };
}

/**
 * ממפה טרייד תיק לכרטיס שיתוף.
 * CLOSED: דורש יציאה. OPEN: דורש currentPrice לחישוב unrealized.
 */
export function portfolioTradeToExportable(
  trade: PortfolioTrade,
  opts?: { currentPrice?: number | null }
): ExportableTrade | null {
  if (trade.status === 'OPEN') {
    const mark = opts?.currentPrice;
    if (mark == null || !(mark > 0)) return null;
    const isLong = trade.direction === 'long';
    const lev = trade.leverage || 1;
    const pnl = isLong
      ? (mark - trade.entry_price) * trade.quantity * lev
      : (trade.entry_price - mark) * trade.quantity * lev;
    let return_percentage: number | null = null;
    if (trade.entry_price > 0) {
      const raw = isLong
        ? ((mark - trade.entry_price) / trade.entry_price) * 100
        : ((trade.entry_price - mark) / trade.entry_price) * 100;
      return_percentage = raw * lev;
    }
    return {
      id: trade.id,
      symbol: trade.symbol,
      direction: trade.direction,
      entry_price: trade.entry_price,
      exit_price: mark,
      quantity: trade.quantity,
      entry_date: trade.entry_date,
      exit_date: '',
      pnl,
      return_percentage,
      status: 'OPEN',
    };
  }

  if (trade.exit_price == null || !trade.exit_date) {
    return null;
  }
  const pnl = trade.profit_loss ?? 0;
  let return_percentage: number | null = null;
  if (trade.entry_price > 0) {
    const raw =
      trade.direction === 'long'
        ? ((trade.exit_price - trade.entry_price) / trade.entry_price) * 100
        : ((trade.entry_price - trade.exit_price) / trade.entry_price) * 100;
    return_percentage = raw * (trade.leverage || 1);
  }
  return {
    id: trade.id,
    symbol: trade.symbol,
    direction: trade.direction,
    entry_price: trade.entry_price,
    exit_price: trade.exit_price,
    quantity: trade.quantity,
    entry_date: trade.entry_date,
    exit_date: trade.exit_date,
    pnl,
    return_percentage,
    status: 'CLOSED',
  };
}

function normalizeExportable(trade: ExportableTrade | JournalTrade): ExportableTrade {
  if ('status' in trade && (trade.status === 'OPEN' || trade.status === 'CLOSED')) {
    return trade as ExportableTrade;
  }
  if ('pnl' in trade && typeof (trade as JournalTrade).exit_price === 'number') {
    return journalTradeToExportable(trade as JournalTrade);
  }
  return { ...(trade as ExportableTrade), status: 'CLOSED' };
}

function getReturnPercentage(trade: ExportableTrade): number {
  if (trade.return_percentage !== undefined && trade.return_percentage !== null) {
    return trade.return_percentage;
  }
  if (trade.entry_price > 0) {
    if (trade.direction === 'long') {
      return ((trade.exit_price - trade.entry_price) / trade.entry_price) * 100;
    }
    return ((trade.entry_price - trade.exit_price) / trade.entry_price) * 100;
  }
  return 0;
}

export default function ExportTradeImage({ trade, visible, onClose }: ExportTradeImageProps) {
  const DesignTokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const animatedClose = useBottomSheetClose();
  const viewShotRef = useRef<View>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [layoutReady, setLayoutReady] = useState(false);
  const [options, setOptions] = useState<ShareOptions>(DEFAULT_SHARE_OPTIONS);
  // תנועת המחיר האמיתית לגרף; historyReady — גם כשנכשל / אין נתונים (אז קו דקורטיבי)
  const [pricePath, setPricePath] = useState<number[] | null>(null);
  const [historyReady, setHistoryReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SHARE_OPTIONS_KEY)
      .then((raw) => {
        if (raw) setOptions({ ...DEFAULT_SHARE_OPTIONS, ...JSON.parse(raw) });
      })
      .catch(() => {});
  }, []);

  /** חייב להישאר לפחות רווח או תשואה — אחרת אין מה לשתף */
  const setOption = useCallback((key: keyof ShareOptions, value: boolean) => {
    setOptions((prev) => {
      const next = { ...prev, [key]: value };
      if (!next.showPnl && !next.showReturn) return prev;
      AsyncStorage.setItem(SHARE_OPTIONS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  /** Footer מנהל את ה-safe-area — BottomSheet עם contentPaddingBottom={0} */
  const footerPadBottom = useMemo(
    () => sheetContentBottomPadding(insets.bottom),
    [insets.bottom]
  );

  const cardW = Math.min(340, Dimensions.get('window').width - 48);
  /** יחס ~4:5 — נוח לפיד אינסטגרם ולסטוריז */
  const cardH = Math.round(cardW * 1.25);

  const normalized = useMemo(
    () => (trade ? normalizeExportable(trade) : null),
    [trade]
  );

  useEffect(() => {
    if (visible) {
      setLayoutReady(false);
    }
  }, [visible, normalized?.id]);

  useEffect(() => {
    if (!visible || !normalized) return;
    let cancelled = false;
    setPricePath(null);
    setHistoryReady(false);
    // לא מחכים יותר מ-4 שניות — אחרי זה הכרטיס נשאר עם הקו הדקורטיבי
    const timeout = setTimeout(() => {
      if (!cancelled) setHistoryReady(true);
    }, 4000);
    loadTradePath(normalized)
      .then((path) => {
        if (!cancelled) setPricePath(path);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          clearTimeout(timeout);
          setHistoryReady(true);
        }
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [visible, normalized]);

  const formatCurrencyPlain = (value: number) =>
    Math.abs(value).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const snapshot = useMemo(() => {
    if (!normalized) return null;
    const isOpen = normalized.status === 'OPEN';
    const isProfit = normalized.pnl >= 0;
    const ret = getReturnPercentage(normalized);
    const dirColor = normalized.direction === 'long' ? WIN : LOSS;
    const pnlColor = isProfit ? WIN : LOSS;
    const retColor = ret >= 0 ? WIN : LOSS;
    const logoUri = brandfetchTickerLogoUri(normalized.symbol);
    return { isOpen, isProfit, ret, dirColor, pnlColor, retColor, logoUri };
  }, [normalized]);

  const handleExport = useCallback(async () => {
    if (!viewShotRef.current || !layoutReady || !historyReady) {
      legacyAlert(i18n.t('auto.components__Journal__ExportTradeImage.s3'), i18n.t('auto.components__Journal__ExportTradeImage.s4'));
      return;
    }

    try {
      setIsExporting(true);
      void HapticFeedback.impactLight();
      await new Promise<void>((resolve) => {
        runAfterInteractions(() => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
      });
      await new Promise((r) => setTimeout(r, Platform.OS === 'android' ? 450 : 150));

      const uri = await captureRef(viewShotRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: i18n.t('auto.components__Journal__ExportTradeImage.s5'),
          UTI: 'public.png',
        });
        void HapticFeedback.success();
      } else {
        legacyAlert(i18n.t('auto.components__Journal__ExportTradeImage.s3'), i18n.t('auto.components__Journal__ExportTradeImage.s6'));
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      legacyAlert(i18n.t('auto.components__Journal__ExportTradeImage.s3'), i18n.t('auto.components__Journal__ExportTradeImage.s7') + msg);
    } finally {
      setIsExporting(false);
    }
  }, [layoutReady, historyReady]);

  if (!normalized || !visible || !snapshot) {
    return null;
  }

  const { isProfit, ret, dirColor, pnlColor, retColor, logoUri } = snapshot;
  // המספר הראשי: תשואה (אם מוצגת), אחרת רווח/הפסד — וצבע הזוהר לפיו
  const heroIsReturn = options.showReturn;
  const heroColor = heroIsReturn ? retColor : pnlColor;
  const retText = `${ret >= 0 ? '+' : '−'}${Math.abs(ret).toFixed(2)}%`;
  const pnlText = `${isProfit ? '+' : '−'}$${formatCurrencyPlain(normalized.pnl)}`;
  const art = priceArt(`${normalized.id}:${normalized.symbol}`, normalized.exit_price >= normalized.entry_price, pricePath);
  const scale = cardW / ART_W;

  const handleHeaderClose = () => {
    (animatedClose ?? onClose)();
  };

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[0.92]}
      fitContent
      edgeToEdge
      showHandle
      enablePanDownToClose
      useModal
      backgroundColor={DesignTokens.colors.background.primary}
      topCornerRadius={DesignTokens.borderRadius.xl}
      backdropOpacity={SHEET_BACKDROP_OPACITY}
      showBrandBackground={false}
      showBrandWatermark={false}
      contentPaddingBottom={0}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <DayNavBlurButton
            onPress={handleHeaderClose}
            size={DAY_NAV_BUTTON_SIZE}
            glassIntensity="subtle"
            style={styles.headerIconButton}
            accessibilityLabel={i18n.t('auto.components__Journal__ExportTradeImage.s8')}
          >
            <Ionicons name={dirIcon('chevron-forward')} size={22} color={DesignTokens.colors.text.primary} />
          </DayNavBlurButton>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{i18n.t('auto.components__Journal__ExportTradeImage.s9')}</Text>
          </View>
          <View style={styles.headerSideSpacer} />
        </View>

        <ScrollView
          style={styles.previewContainer}
          contentContainerStyle={styles.previewContent}
          showsVerticalScrollIndicator={false}
        >
          {/* העיגול רק בתצוגה — התמונה שמשותפת היא מלבן מלא (בלי פינות שקופות שנראות שחורות בוואטסאפ) */}
          <View style={styles.previewShadow}>
            <View style={styles.previewClip}>
            <View
              key={normalized.id}
              ref={viewShotRef}
              collapsable={false}
              style={[styles.shotWrap, { width: cardW }]}
              onLayout={() => setLayoutReady(true)}
            >
              <ForceDarkTheme>
              <View style={[styles.cardRoot, { width: cardW, height: cardH }]}>
                {/* שכבת האמנות: רקע, זוהר, רשת וגרף המחיר — viewBox אחד שמוקטן באחידות */}
                <Svg width={cardW} height={cardH} viewBox={`0 0 ${ART_W} ${ART_H}`} style={StyleSheet.absoluteFill}>
                  <Defs>
                    <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor={heroColor} stopOpacity="0.34" />
                      <Stop offset="1" stopColor={heroColor} stopOpacity="0.02" />
                    </LinearGradient>
                    {/* הצללה עדינה בתחתית — הטקסט וה-QR יושבים על הגרדיאנט של הגרף */}
                    <LinearGradient id="footScrim" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor={CARD_BG} stopOpacity="0" />
                      <Stop offset="1" stopColor={CARD_BG} stopOpacity="0.7" />
                    </LinearGradient>
                    <RadialGradient id="centerGlow" cx="50%" cy="38%" rx="60%" ry="60%">
                      <Stop offset="0" stopColor={heroColor} stopOpacity="0.16" />
                      <Stop offset="1" stopColor={heroColor} stopOpacity="0" />
                    </RadialGradient>
                    <Mask id="qrClear">
                      <Rect width={ART_W} height={ART_H} fill="#fff" />
                      <Rect x={QR_CLEAR.x} y={QR_CLEAR.y} width={QR_CLEAR.size} height={QR_CLEAR.size} rx={10} fill="#000" />
                    </Mask>
                  </Defs>
                  <Rect width={ART_W} height={ART_H} fill={CARD_BG} />
                  <Rect width={ART_W} height={ART_H} fill="url(#centerGlow)" />
                  <Path d={art.area} fill="url(#areaFill)" />
                  <Rect y={ART_H - FOOTER_H - 16} width={ART_W} height={FOOTER_H + 16} fill="url(#footScrim)" />
                  <Path d={art.line} stroke={heroColor} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" fill="none" mask="url(#qrClear)" />
                  <Circle cx={art.first.x} cy={art.first.y} r={3.6} fill={CARD_BG} stroke="rgba(242,242,242,0.75)" strokeWidth={1.6} />
                  <Circle cx={art.last.x} cy={art.last.y} r={10} fill={heroColor} opacity={0.18} />
                  <Circle cx={art.last.x} cy={art.last.y} r={4.2} fill={heroColor} />
                </Svg>

                {/* שור ודוב — צללית אחת ממורכזת, בצבע התוצאה */}
                <View style={styles.animalWrap} pointerEvents="none">
                  <Image
                    source={BULL_BEAR}
                    tintColor={heroColor}
                    contentFit="contain"
                    style={[styles.animal, { width: 240 * scale, height: (240 * scale) / BULL_BEAR_ASPECT, marginTop: 116 * scale }]}
                  />
                </View>

                {/* תוכן מוצמד לצד תחילת הקריאה — רק flexbox (flex-start בעץ UI_DIR), בלי textAlign שמתהפך ב-forceRTL */}
                <View
                  style={[
                    styles.cardContent,
                    { paddingTop: 28 * scale, paddingHorizontal: 24 * scale },
                  ]}
                >
                  {/* הלוגו ממורכז; מתחתיו התוכן מוצמד לצד הקריאה */}
                  <View style={styles.logoRow}>
                    <Image
                      source={BRAND_LOGO}
                      style={{ width: 144 * scale, height: (144 * scale) / BRAND_LOGO_ASPECT }}
                      contentFit="contain"
                      transition={0}
                      accessibilityLabel={i18n.t('auto.components__Journal__ExportTradeImage.s10')}
                    />
                  </View>

                  <View style={styles.assetRow}>
                    <View style={styles.logoCircle}>
                      {logoUri ? (
                        <Image source={{ uri: logoUri }} style={styles.logoImg} contentFit="cover" transition={120} />
                      ) : (
                        <Text style={styles.logoFallbackText}>{normalized.symbol.trim().slice(0, 4).toUpperCase()}</Text>
                      )}
                    </View>
                    <Text style={styles.symbolBig} numberOfLines={1}>
                      {normalized.symbol}
                    </Text>
                    <View style={[styles.dirPill, { backgroundColor: `${dirColor}26` }]}>
                      <TrendGlyph up={normalized.direction === 'long'} color={dirColor} />
                      <Text style={[styles.dirPillText, { color: dirColor }]}>
                        {normalized.direction === 'long' ? 'LONG' : 'SHORT'}
                      </Text>
                    </View>
                  </View>

                  {/* View ברוחב מלא שמצמיד את הטקסט לתחילתו; הטקסט ברוחב התוכן ומתכווץ אם ארוך */}
                  <View style={styles.heroWrap}>
                    <Text
                      style={[styles.heroValue, { color: heroColor, fontSize: 44 * scale, lineHeight: 50 * scale }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.6}
                    >
                      {heroIsReturn ? retText : pnlText}
                    </Text>
                  </View>
                  {heroIsReturn && options.showPnl ? (
                    <View style={styles.pnlRow}>
                      <Text style={styles.pnlLabel}>{i18n.t('auto.components__Journal__ExportTradeImage.pnlLabel')}</Text>
                      <Text style={[styles.pnlValue, { color: pnlColor }]}>{pnlText}</Text>
                    </View>
                  ) : !heroIsReturn ? (
                    <Text style={styles.pnlLabel}>{i18n.t('auto.components__Journal__ExportTradeImage.pnlLabel')}</Text>
                  ) : null}
                </View>

                {/* תחתית: הזמנה + QR על פס כהה ברוחב מלא */}
                <View style={[styles.footerStrip, { height: FOOTER_H * scale, bottom: FOOTER_BOTTOM * scale }]}>
                  <View style={styles.ctaTextCol}>
                    <Text style={styles.ctaHeadline} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                      {SHARE_CTA_LINE}
                    </Text>
                    <Text style={styles.ctaSub}>{SHARE_CTA_SUB}</Text>
                  </View>
                  <View style={styles.qrWrap}>
                    {/* QR הפוך (נקודות בהירות על רקע כהה) — משתלב בכרטיס; נבדק שמצלמת iPhone / Vision קוראת אותו */}
                    <QRCode value={APP_LINKS.appDownload} size={QR_SIZE * scale} backgroundColor="transparent" color={INK} ecl="M" quietZone={0} />
                  </View>
                </View>
              </View>
              </ForceDarkTheme>
              </View>
          </View>
          </View>

          <View style={styles.optionsBlock}>
            <SettingsSectionTitle title={i18n.t('auto.components__Journal__ExportTradeImage.s16')} />
            <SettingsGlassCard style={{ marginBottom: 0 }}>
              <SettingsSwitchRow
                title={i18n.t('auto.components__Journal__ExportTradeImage.s17')}
                value={options.showPnl}
                disabled={options.showPnl && !options.showReturn}
                onValueChange={(v) => setOption('showPnl', v)}
              />
              <SettingsSwitchRow
                title={i18n.t('auto.components__Journal__ExportTradeImage.s18')}
                value={options.showReturn}
                disabled={options.showReturn && !options.showPnl}
                showDivider={false}
                onValueChange={(v) => setOption('showReturn', v)}
              />

            </SettingsGlassCard>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: footerPadBottom }]}>
          <UIButton
            title={isExporting ? i18n.t('auto.components__Journal__ExportTradeImage.s20') : i18n.t('auto.components__Journal__ExportTradeImage.s9')}
            variant="primary"
            icon="share-outline"
            fullWidth
            loading={isExporting}
            disabled={isExporting || !layoutReady || !historyReady}
            onPress={handleExport}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      minHeight: 0,
      direction: UI_DIR,
      backgroundColor: 'transparent',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.colors.border.divider,
      gap: 10,
    },
    headerIconButton: {
      alignSelf: 'center',
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerSideSpacer: {
      width: DAY_NAV_BUTTON_SIZE,
      height: DAY_NAV_BUTTON_SIZE,
    },
    headerTitle: {
      fontSize: APP_TYPE.sectionTitle.fontSize,
      fontWeight: APP_TYPE.sectionTitle.fontWeight,
      lineHeight: APP_TYPE.sectionTitle.lineHeight,
      letterSpacing: APP_TYPE.sectionTitle.letterSpacing,
      color: tokens.colors.text.primary,
      direction: ROOT_DIR,
      textAlign: 'center',
      writingDirection: TEXT_DIR,
      width: '100%',
    },
    previewContainer: {
      flex: 1,
      minHeight: 0,
      backgroundColor: 'transparent',
    },
    previewContent: {
      padding: tokens.spacing.lg,
      alignItems: 'center',
      paddingBottom: tokens.spacing.xl,
    },
    /** צל חיצוני בלבד — לא נכנס ל־capture (מחוץ ל־viewShotRef) */
    previewShadow: {
      borderRadius: 24,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.35,
          shadowRadius: 24,
        },
        android: { elevation: 10 },
        default: {},
      }),
    },
    previewClip: {
      borderRadius: 26,
      overflow: 'hidden',
    },
    shotWrap: {
      alignSelf: 'center',
      backgroundColor: CARD_BG,
    },
    cardRoot: {
      overflow: 'hidden',
      backgroundColor: CARD_BG,
      direction: UI_DIR,
    },
    animalWrap: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
    },
    animal: {
      opacity: 0.08,
    },
    cardContent: {
      ...StyleSheet.absoluteFill,
      direction: UI_DIR,
      alignItems: 'flex-start',
    },
    assetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 24,
    },
    logoCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: '#1A1D1C',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoImg: {
      width: 36,
      height: 36,
    },
    logoFallbackText: {
      color: 'rgba(242,242,242,0.7)',
      fontSize: 11,
      fontWeight: '700',
    },
    logoRow: {
      alignSelf: 'stretch',
      alignItems: 'center',
    },
    symbolBig: {
      color: INK,
      fontSize: 22,
      lineHeight: 26,
      fontWeight: '700',
      flexShrink: 1,
    },
    dirPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      height: 22,
      paddingHorizontal: 9,
      borderRadius: 11,
    },
    dirPillText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.6,
    },
    heroWrap: {
      alignSelf: 'stretch',
      alignItems: 'flex-start',
      marginTop: 10,
    },
    heroValue: {
      fontWeight: '700',
      letterSpacing: -1,
      writingDirection: 'ltr',
      fontVariant: ['tabular-nums'],
      maxWidth: '100%',
    },
    pnlRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 7,
      marginTop: 4,
    },
    pnlLabel: {
      color: 'rgba(242,242,242,0.62)',
      fontSize: 13,
      fontWeight: '600',
      writingDirection: TEXT_DIR,
    },
    pnlValue: {
      fontSize: 20,
      fontWeight: '700',
      writingDirection: 'ltr',
      fontVariant: ['tabular-nums'],
    },
    footerStrip: {
      position: 'absolute',
      start: 0,
      end: 0,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingStart: 18,
      paddingEnd: 14,
    },
    qrWrap: {},
    ctaTextCol: {
      flex: 1,
      minWidth: 0,
      alignItems: 'flex-start',
      gap: 2,
    },
    ctaHeadline: {
      color: INK,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '700',
      writingDirection: TEXT_DIR,
    },
    ctaSub: {
      color: 'rgba(242,242,242,0.72)',
      fontSize: 12.5,
      fontWeight: '500',
      writingDirection: TEXT_DIR,
    },
    /** שורות ההגדרות בנויות לעץ LTR (כמו מסך ההגדרות) — בתוך שיט RTL הן מתהפכות */
    optionsBlock: {
      direction: ROOT_DIR,
      alignSelf: 'stretch',
      marginTop: tokens.spacing.xl,
    },
    footer: {
      flexShrink: 0,
      paddingHorizontal: 16,
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tokens.colors.border.divider,
      backgroundColor: 'transparent',
    },
  });
