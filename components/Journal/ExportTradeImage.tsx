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
import { createDesignTokensForTheme, useDesignTokens } from '../ui/DesignTokens';
import { ForceDarkTheme } from '../../context/ThemeContext';
import UIButton from '../ui/UIButton';
import { UI_CARD_RADIUS } from '../ui/appLayout';
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
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_LINKS } from '../../utils/appMeta';

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

/** התמונה תמיד בעיצוב הכהה — גם כשהאפליקציה בלייט */
const SHARE_CARD_TOKENS = createDesignTokensForTheme(true);

/** מה מוצג בתמונה — נשמר בין שיתופים */
type ShareOptions = { showPnl: boolean; showReturn: boolean; showPrices: boolean };
const SHARE_OPTIONS_KEY = 'tradeShare:options';
const DEFAULT_SHARE_OPTIONS: ShareOptions = { showPnl: true, showReturn: true, showPrices: false };

/**
 * רקע הכרטיס: גרפיט כמעט שחור + זוהר אחד בפינת תחילת הקריאה, בצבע התוצאה (רווח ירוק / הפסד אדום).
 * SVG ולא GLView / blur — view-shot לוכד אותו נקי.
 */
function ShareCardBackground({ width, height, tint }: { width: number; height: number; tint: string }) {
  const cx = UI_DIR === 'rtl' ? '100%' : '0%';
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="outcomeGlow" cx={cx} cy="0%" rx="95%" ry="70%">
          <Stop offset="0" stopColor={tint} stopOpacity="0.30" />
          <Stop offset="0.55" stopColor={tint} stopOpacity="0.06" />
          <Stop offset="1" stopColor={tint} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width={width} height={height} fill={CARD_BG} />
      <Rect width={width} height={height} fill="url(#outcomeGlow)" />
    </Svg>
  );
}

/** לוגו שור־ודוב / קהילת DarkPool — מעל כרטיסיית הזכוכית */
// לוגו מלא (שור־ודוב + DARKPOOL + «קהילת הסוחרים של ישראל») — מקומי ולא מ-Storage,
// כדי שיהיה טעון ברגע הצילום. עותק: app-media/branding/darkpool-share-logo.png
const BRAND_MARK = require('../../assets/branding/share-mark.png');
const BRAND_MARK_ASPECT = 218 / 160;
const CARD_BG = '#0B0D0C';
const INK = '#F2F2F2';
const INK_2 = 'rgba(242,242,242,0.62)';
const INK_3 = 'rgba(242,242,242,0.38)';
const HAIRLINE = 'rgba(255,255,255,0.10)';

/** תאריך קצר לכרטיס: 03.11.26 */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${String(d.getFullYear()).slice(2)}`;
}

/** ימי החזקה (פתוח — עד היום) */
function heldDays(entry: string, exit: string): number | null {
  const a = new Date(entry).getTime();
  const b = exit ? new Date(exit).getTime() : Date.now();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.round((b - a) / 86_400_000));
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
  const [cardSize, setCardSize] = useState<{ w: number; h: number } | null>(null);

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
    const T = SHARE_CARD_TOKENS;
    const dirColor =
      normalized.direction === 'long' ? T.colors.primary.main : T.colors.text.danger;
    const pnlColor = isProfit ? T.colors.primary.main : T.colors.text.danger;
    const retColor = ret >= 0 ? T.colors.primary.main : T.colors.text.danger;
    const logoUri = brandfetchTickerLogoUri(normalized.symbol);
    const days = heldDays(normalized.entry_date, normalized.exit_date);
    return { isOpen, isProfit, ret, dirColor, pnlColor, retColor, logoUri, days };
  }, [normalized]);

  const handleExport = useCallback(async () => {
    if (!viewShotRef.current || !layoutReady) {
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
  }, [layoutReady]);

  if (!normalized || !visible || !snapshot) {
    return null;
  }

  const { isOpen, isProfit, ret, dirColor, pnlColor, retColor, logoUri, days } = snapshot;
  // המספר הראשי: תשואה (אם מוצגת), אחרת רווח/הפסד — וצבע הזוהר לפיו
  const heroIsReturn = options.showReturn;
  const heroColor = heroIsReturn ? retColor : pnlColor;
  const retText = `${ret >= 0 ? '+' : '−'}${Math.abs(ret).toFixed(2)}%`;
  const pnlText = `${isProfit ? '+' : '−'}$${formatCurrencyPlain(normalized.pnl)}`;
  const dateText = isOpen
    ? shortDate(normalized.entry_date)
    : `${shortDate(normalized.entry_date)} – ${shortDate(normalized.exit_date)}`;
  const heldText =
    days == null
      ? ''
      : days === 0
        ? i18n.t('auto.components__Journal__ExportTradeImage.intraday')
        : i18n.t('auto.components__Journal__ExportTradeImage.heldDays', { count: days });
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
          <View style={styles.previewShadow}>
            <View
              key={normalized.id}
              ref={viewShotRef}
              collapsable={false}
              style={[styles.shotWrap, { width: cardW }]}
              onLayout={() => setLayoutReady(true)}
            >
              <ForceDarkTheme>
              <View
                style={[styles.cardRoot, { width: cardW, minHeight: cardH }]}
                onLayout={(e) => {
                  const { width, height } = e.nativeEvent.layout;
                  setCardSize((prev) =>
                    prev && prev.w === width && prev.h === height ? prev : { w: width, h: height },
                  );
                }}
              >
                <ShareCardBackground
                  width={cardSize?.w ?? cardW}
                  height={cardSize?.h ?? cardH}
                  tint={heroColor}
                />

                <View style={[styles.cardContent, { minHeight: cardH }]}>
                  {/* פס עליון: מותג בצד תחילת הקריאה, תאריכים בצד השני */}
                  <View style={styles.topBar}>
                    <View style={styles.brandRow}>
                      <Image
                        source={BRAND_MARK}
                        style={styles.brandMark}
                        contentFit="contain"
                        transition={0}
                        accessibilityLabel={i18n.t('auto.components__Journal__ExportTradeImage.s10')}
                      />
                      <Text style={styles.wordmark}>DARKPOOL</Text>
                    </View>
                    <Text style={styles.dateText}>{dateText}</Text>
                  </View>

                  {/* הנכס */}
                  <View style={styles.assetRow}>
                    {logoUri ? (
                      <View style={styles.logoTile}>
                        <Image source={{ uri: logoUri }} style={styles.logoImg} contentFit="cover" transition={120} />
                      </View>
                    ) : (
                      <View style={[styles.logoTile, styles.logoFallback]}>
                        <Text style={styles.logoFallbackText}>{normalized.symbol.trim().slice(0, 4).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.assetText}>
                      <Text style={styles.symbolBig} numberOfLines={1}>
                        {normalized.symbol}
                      </Text>
                      <View style={styles.metaRow}>
                        <Text style={[styles.dirText, { color: dirColor }]}>
                          {normalized.direction === 'long' ? '▲ LONG' : '▼ SHORT'}
                        </Text>
                        {isOpen ? <Text style={styles.metaDim}>· OPEN</Text> : null}
                        {heldText ? <Text style={styles.metaDim}>· {heldText}</Text> : null}
                      </View>
                    </View>
                  </View>

                  {/* המספר הראשי */}
                  <View style={styles.heroBlock}>
                    <Text style={styles.heroLabel}>
                      {heroIsReturn
                        ? i18n.t('auto.components__Journal__ExportTradeImage.returnLabel')
                        : i18n.t('auto.components__Journal__ExportTradeImage.pnlLabel')}
                    </Text>
                    <Text
                      style={[styles.heroValue, { color: heroColor }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.6}
                    >
                      {heroIsReturn ? retText : pnlText}
                    </Text>
                    {heroIsReturn && options.showPnl ? (
                      <Text style={[styles.subValue, { color: pnlColor }]}>{pnlText}</Text>
                    ) : null}
                  </View>

                  {/* מסלול המחיר: כניסה → יציאה */}
                  {options.showPrices ? (
                    <View style={styles.pathBlock}>
                      <View style={styles.pathTrack}>
                        <View style={[styles.pathDot, { borderColor: INK_2 }]} />
                        <View style={[styles.pathLine, { backgroundColor: heroColor }]} />
                        <View style={[styles.pathDot, styles.pathDotEnd, { backgroundColor: heroColor, borderColor: heroColor }]} />
                      </View>
                      <View style={styles.pathLabels}>
                        <View>
                          <Text style={styles.pathLabel}>{i18n.t('auto.components__Journal__ExportTradeImage.s13')}</Text>
                          <Text style={styles.pathValue}>${formatCurrencyPlain(normalized.entry_price)}</Text>
                        </View>
                        <View style={styles.pathLabelEnd}>
                          <Text style={[styles.pathLabel, styles.textEnd]}>
                            {isOpen
                              ? i18n.t('auto.components__Journal__ExportTradeImage.s14')
                              : i18n.t('auto.components__Journal__ExportTradeImage.s15')}
                          </Text>
                          <Text style={[styles.pathValue, styles.textEnd]}>${formatCurrencyPlain(normalized.exit_price)}</Text>
                        </View>
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.spacer} />

                  {/* תחתית: הזמנה + QR */}
                  <View style={styles.footerRow}>
                    <View style={styles.ctaTextCol}>
                      <Text style={styles.ctaHeadline} numberOfLines={2}>
                        {SHARE_CTA_LINE}
                      </Text>
                      <Text style={styles.ctaSub}>{SHARE_CTA_SUB}</Text>
                    </View>
                    <View style={styles.qrWrap}>
                      <QRCode value={APP_LINKS.appDownload} size={52} backgroundColor="#FFFFFF" color="#0A0E0A" ecl="M" />
                    </View>
                  </View>
                </View>
              </View>
              </ForceDarkTheme>
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
                onValueChange={(v) => setOption('showReturn', v)}
              />
              <SettingsSwitchRow
                title={i18n.t('auto.components__Journal__ExportTradeImage.s19')}
                value={options.showPrices}
                showDivider={false}
                onValueChange={(v) => setOption('showPrices', v)}
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
            disabled={isExporting || !layoutReady}
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
    shotWrap: {
      alignSelf: 'center',
      backgroundColor: CARD_BG,
      borderRadius: 24,
      overflow: 'hidden',
    },
    cardRoot: {
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: CARD_BG,
    },
    // כל הטקסט מיושר לצד תחילת הקריאה (alignItems: flex-start בעץ UI_DIR) — לא ממורכז
    cardContent: {
      direction: UI_DIR,
      paddingHorizontal: 22,
      paddingTop: 20,
      paddingBottom: 18,
      alignItems: 'stretch',
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    brandMark: {
      height: 18,
      width: Math.round(18 * BRAND_MARK_ASPECT),
    },
    wordmark: {
      color: INK,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 2.4,
    },
    dateText: {
      color: INK_3,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.3,
      writingDirection: 'ltr',
      fontVariant: ['tabular-nums'],
    },
    assetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 30,
    },
    logoTile: {
      width: 44,
      height: 44,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.14)',
    },
    logoImg: {
      width: 44,
      height: 44,
    },
    logoFallback: {},
    logoFallbackText: {
      color: INK_2,
      fontSize: 12,
      fontWeight: '700',
    },
    assetText: {
      flex: 1,
      minWidth: 0,
      alignItems: 'flex-start',
      gap: 2,
    },
    symbolBig: {
      color: INK,
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: -0.3,
      writingDirection: 'ltr',
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    dirText: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      writingDirection: 'ltr',
    },
    metaDim: {
      color: INK_3,
      fontSize: 11,
      fontWeight: '600',
      writingDirection: TEXT_DIR,
    },
    heroBlock: {
      marginTop: 26,
      alignItems: 'flex-start',
      gap: 2,
    },
    heroLabel: {
      color: INK_3,
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.2,
      writingDirection: TEXT_DIR,
    },
    heroValue: {
      fontSize: 58,
      lineHeight: 64,
      fontWeight: '800',
      letterSpacing: -2,
      writingDirection: 'ltr',
      fontVariant: ['tabular-nums'],
      alignSelf: 'stretch',
      textAlign: UI_DIR === 'rtl' ? 'right' : 'left',
    },
    subValue: {
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.2,
      writingDirection: 'ltr',
      fontVariant: ['tabular-nums'],
      opacity: 0.9,
    },
    pathBlock: {
      marginTop: 24,
      gap: 10,
    },
    pathTrack: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    pathDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      borderWidth: 1.5,
      backgroundColor: CARD_BG,
    },
    pathDotEnd: {},
    pathLine: {
      flex: 1,
      height: 2,
      borderRadius: 1,
      opacity: 0.7,
    },
    pathLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    pathLabelEnd: {
      alignItems: 'flex-end',
    },
    pathLabel: {
      color: INK_3,
      fontSize: 11,
      fontWeight: '600',
      writingDirection: TEXT_DIR,
    },
    pathValue: {
      color: INK,
      fontSize: 15,
      fontWeight: '700',
      writingDirection: 'ltr',
      fontVariant: ['tabular-nums'],
    },
    textEnd: {},
    spacer: {
      flexGrow: 1,
      minHeight: 20,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: HAIRLINE,
    },
    qrWrap: {
      padding: 5,
      borderRadius: 10,
      backgroundColor: '#FFFFFF',
      flexShrink: 0,
    },
    ctaTextCol: {
      flex: 1,
      minWidth: 0,
      alignItems: 'flex-start',
      gap: 3,
    },
    ctaHeadline: {
      color: INK,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
      writingDirection: TEXT_DIR,
    },
    ctaSub: {
      color: INK_3,
      fontSize: 11,
      fontWeight: '600',
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
