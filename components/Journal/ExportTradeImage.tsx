import { legacyAlert } from '../../utils/appDialog';
import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  InteractionManager,
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
import UICard from '../ui/UICard';
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
const SHARE_CTA_LINE = 'הצטרף לקהילת הסוחרים של DarkPool';
const SHARE_CTA_SUB = 'סרוק להורדת האפליקציה';

/** התמונה תמיד בעיצוב הכהה — גם כשהאפליקציה בלייט */
const SHARE_CARD_TOKENS = createDesignTokensForTheme(true);

/** מה מוצג בתמונה — נשמר בין שיתופים */
type ShareOptions = { showPnl: boolean; showReturn: boolean; showPrices: boolean };
const SHARE_OPTIONS_KEY = 'tradeShare:options';
const DEFAULT_SHARE_OPTIONS: ShareOptions = { showPnl: true, showReturn: true, showPrices: false };

/**
 * רקע סטטי לכרטיס — אותה פלטה כמו שיידר האורורה (כהה → ירוק כהה → ניאון),
 * אבל SVG: view-shot לא לוכד GLView (יוצא שחור/מפוקסל).
 */
function ShareCardBackground({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="glowTop" cx="50%" cy="0%" rx="85%" ry="55%">
          <Stop offset="0" stopColor="#00E63D" stopOpacity="0.55" />
          <Stop offset="0.45" stopColor="#004717" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#000A04" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="glowBottom" cx="15%" cy="100%" rx="70%" ry="40%">
          <Stop offset="0" stopColor="#00E63D" stopOpacity="0.18" />
          <Stop offset="1" stopColor="#000A04" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width={width} height={height} fill="#000A04" />
      <Rect width={width} height={height} fill="url(#glowTop)" />
      <Rect width={width} height={height} fill="url(#glowBottom)" />
    </Svg>
  );
}

/** לוגו שור־ודוב / קהילת DarkPool — מעל כרטיסיית הזכוכית */
const BRAND_LOGO = require('../../assets/darkpool-drawer-logo.png');

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
    return { isOpen, isProfit, ret, dirColor, pnlColor, retColor, logoUri };
  }, [normalized]);

  const handleExport = useCallback(async () => {
    if (!viewShotRef.current || !layoutReady) {
      legacyAlert('שגיאה', 'נא להמתין רגע עד שהתצוגה מוכנה');
      return;
    }

    try {
      setIsExporting(true);
      void HapticFeedback.impactLight();
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => {
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
          dialogTitle: 'שתף טרייד',
          UTI: 'public.png',
        });
        void HapticFeedback.success();
      } else {
        legacyAlert('שגיאה', 'שיתוף לא זמין במכשיר זה');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      legacyAlert('שגיאה', 'לא ניתן ליצור תמונה: ' + msg);
    } finally {
      setIsExporting(false);
    }
  }, [layoutReady]);

  if (!normalized || !visible || !snapshot) {
    return null;
  }

  const { isOpen, isProfit, ret, dirColor, pnlColor, retColor, logoUri } = snapshot;
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
            accessibilityLabel="חזרה"
          >
            <Ionicons name="chevron-forward" size={22} color={DesignTokens.colors.text.primary} />
          </DayNavBlurButton>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>שתף תמונה</Text>
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
                <ShareCardBackground width={cardSize?.w ?? cardW} height={cardSize?.h ?? cardH} />

                <View style={[styles.cardContent, { minHeight: cardH - 8 }]}>
                  {/* לוגו DarkPool / שור־ודוב — מעל הזכוכית, ממורכז */}
                  <Image
                    source={BRAND_LOGO}
                    style={styles.brandLogoAbove}
                    contentFit="contain"
                    transition={0}
                    accessibilityLabel="קהילת הסוחרים DarkPool"
                  />

                  {/* זכוכית סטנדרטית — disableBlur כדי ש־view-shot ילכוד נכון */}
                  <UICard
                    variant="blur"
                    padding="none"
                    disableBlur
                    style={styles.pnlHeroCard}
                    contentContainerStyle={styles.pnlHero}
                  >
                    {/* ממורכז: לוגו חברה → טיקר → LONG/SHORT → רווח/הפסד → תשואה */}
                    <View style={styles.symbolBlock}>
                      {logoUri ? (
                        <View style={styles.logoRing}>
                          <Image
                            source={{ uri: logoUri }}
                            style={styles.logoImg}
                            contentFit="cover"
                            transition={120}
                          />
                        </View>
                      ) : (
                        <View style={[styles.logoRing, styles.logoFallback]}>
                          <Text
                            style={[
                              styles.logoFallbackText,
                              { color: SHARE_CARD_TOKENS.colors.text.secondary },
                            ]}
                          >
                            {normalized.symbol.trim().slice(0, 4).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text
                        style={[styles.symbolBig, { color: SHARE_CARD_TOKENS.colors.text.primary }]}
                        numberOfLines={1}
                      >
                        {normalized.symbol}
                      </Text>
                      <View style={styles.dirPillRow}>
                        <View style={[styles.dirPill, { backgroundColor: `${dirColor}28` }]}>
                          <Text style={[styles.dirPillText, { color: dirColor }]}>
                            {normalized.direction === 'long' ? 'LONG' : 'SHORT'}
                          </Text>
                        </View>
                        {isOpen ? (
                          <View
                            style={[styles.dirPill, { backgroundColor: 'rgba(255,255,255,0.10)' }]}
                          >
                            <Text
                              style={[
                                styles.dirPillText,
                                { color: SHARE_CARD_TOKENS.colors.text.secondary },
                              ]}
                            >
                              OPEN
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {options.showPnl ? (
                      <>
                        <Text style={styles.pnlHeroLabel}>רווח/הפסד:</Text>
                        <Text style={[styles.pnlHeroValue, { color: pnlColor }]}>
                          {isProfit ? '+' : '−'}${formatCurrencyPlain(normalized.pnl)}
                        </Text>
                        {options.showReturn ? (
                          <View style={[styles.retChip, { backgroundColor: `${retColor}22` }]}>
                            <Text style={[styles.retChipText, { color: retColor }]}>
                              {ret >= 0 ? '+' : ''}
                              {ret.toFixed(2)}%
                            </Text>
                          </View>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <Text style={styles.pnlHeroLabel}>תשואה:</Text>
                        <Text style={[styles.pnlHeroValue, { color: retColor }]}>
                          {ret >= 0 ? '+' : ''}
                          {ret.toFixed(2)}%
                        </Text>
                      </>
                    )}
                    {options.showPrices ? (
                      <View style={styles.pricesRow}>
                        <View style={styles.priceCol}>
                          <Text style={styles.priceLabel}>כניסה</Text>
                          <Text style={styles.priceValue}>${formatCurrencyPlain(normalized.entry_price)}</Text>
                        </View>
                        <View style={styles.priceCol}>
                          <Text style={styles.priceLabel}>{isOpen ? 'נוכחי' : 'יציאה'}</Text>
                          <Text style={styles.priceValue}>${formatCurrencyPlain(normalized.exit_price)}</Text>
                        </View>
                      </View>
                    ) : null}
                  </UICard>

                  <View style={styles.spacer} />

                  {/* Footer: טקסט שיווקי + QR */}
                  <View style={styles.ctaBar}>
                    <View style={styles.ctaTextCol}>
                      <Text style={styles.ctaHeadline} numberOfLines={2}>
                        {SHARE_CTA_LINE}
                      </Text>
                      <Text style={styles.ctaSub}>{SHARE_CTA_SUB}</Text>
                    </View>
                    <View style={styles.qrWrap}>
                      <QRCode
                        value={APP_LINKS.appDownload}
                        size={64}
                        backgroundColor="#FFFFFF"
                        color="#0A0E0A"
                        ecl="M"
                      />
                    </View>
                  </View>
                </View>
              </View>
              </ForceDarkTheme>
            </View>
          </View>

          <View style={styles.optionsBlock}>
            <SettingsSectionTitle title="מה להציג בתמונה" />
            <SettingsGlassCard style={{ marginBottom: 0 }}>
              <SettingsSwitchRow
                title="רווח/הפסד בדולרים"
                value={options.showPnl}
                disabled={options.showPnl && !options.showReturn}
                onValueChange={(v) => setOption('showPnl', v)}
              />
              <SettingsSwitchRow
                title="תשואה באחוזים"
                value={options.showReturn}
                disabled={options.showReturn && !options.showPnl}
                onValueChange={(v) => setOption('showReturn', v)}
              />
              <SettingsSwitchRow
                title="מחירי כניסה ויציאה"
                value={options.showPrices}
                showDivider={false}
                onValueChange={(v) => setOption('showPrices', v)}
              />
            </SettingsGlassCard>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: footerPadBottom }]}>
          <UIButton
            title={isExporting ? 'מייצא…' : 'שתף תמונה'}
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
      direction: 'rtl',
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
      direction: 'ltr',
      textAlign: 'center',
      writingDirection: 'rtl',
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
      backgroundColor: '#0A0E0A',
      borderRadius: 24,
      overflow: 'hidden',
    },
    cardRoot: {
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: '#0A0E0A',
    },
    cardContent: {
      paddingTop: 5,
      paddingHorizontal: 16,
      paddingBottom: 10,
      zIndex: 2,
      position: 'relative',
      justifyContent: 'flex-start',
      alignItems: 'center',
      gap: 6,
      overflow: 'visible',
    },
    /** גדול במכוון — מרווח שלילי קל בלבד; לא לכסות את תוכן הזכוכית */
    brandLogoAbove: {
      width: 168,
      height: 168,
      marginBottom: -44,
      alignSelf: 'center',
      opacity: 0.96,
      zIndex: 3,
    },
    symbolBlock: {
      alignItems: 'center',
      width: '100%',
      marginBottom: 8,
      gap: 7,
    },
    dirPillRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    logoRing: {
      width: 58,
      height: 58,
      borderRadius: 29,
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.14)',
    },
    logoImg: {
      width: 58,
      height: 58,
    },
    logoFallback: {},
    logoFallbackText: {
      fontSize: 14,
      fontWeight: '700',
    },
    symbolBig: {
      flexShrink: 1,
      fontSize: 24,
      fontWeight: '700',
      textAlign: 'center',
      letterSpacing: -0.5,
    },
    dirPill: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 999,
      flexShrink: 0,
    },
    dirPillText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
    /** UICard מספק את הזכוכית — מרווח עליון מול הלוגו, תחתון מול פס ה־QR */
    pnlHeroCard: {
      width: '100%',
      alignSelf: 'stretch',
      overflow: 'hidden',
      marginTop: 2,
      marginBottom: 6,
    },
    pnlHero: {
      alignItems: 'center',
      paddingTop: 14,
      paddingBottom: 12,
      paddingHorizontal: 16,
      gap: 0,
      overflow: 'hidden',
      position: 'relative',
    },
    pnlHeroLabel: {
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.2,
      marginTop: 2,
      marginBottom: 5,
      textAlign: 'center',
      writingDirection: 'rtl',
      color: 'rgba(255,255,255,0.58)',
    },
    pnlHeroValue: {
      fontSize: 36,
      fontWeight: '700',
      letterSpacing: -0.8,
      writingDirection: 'ltr',
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    retChip: {
      marginTop: 8,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    retChipText: {
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 0.2,
      writingDirection: 'ltr',
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    pricesRow: {
      flexDirection: 'row',
      alignSelf: 'stretch',
      justifyContent: 'center',
      gap: 28,
      marginTop: 12,
    },
    priceCol: {
      alignItems: 'center',
      gap: 2,
    },
    priceLabel: {
      fontSize: APP_TYPE.caption.fontSize,
      fontWeight: APP_TYPE.caption.fontWeight,
      lineHeight: APP_TYPE.caption.lineHeight,
      color: 'rgba(255,255,255,0.58)',
      textAlign: 'center',
    },
    priceValue: {
      fontSize: APP_TYPE.cardBody.fontSize,
      fontWeight: APP_TYPE.cardTitle.fontWeight,
      lineHeight: APP_TYPE.cardBody.lineHeight,
      color: 'rgba(255,255,255,0.92)',
      writingDirection: 'ltr',
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    /** שורות ההגדרות בנויות לעץ LTR (כמו מסך ההגדרות) — בתוך שיט RTL הן מתהפכות */
    optionsBlock: {
      direction: 'ltr',
      alignSelf: 'stretch',
      marginTop: tokens.spacing.xl,
    },
    spacer: {
      flexGrow: 1,
      minHeight: 4,
    },
    /** row + RTL parent: טקסט מימין, QR משמאל (הפוך מ־row-reverse הקודם) */
    ctaBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      gap: 12,
      maxWidth: '100%',
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(255,255,255,0.12)',
    },
    qrWrap: {
      padding: 5,
      borderRadius: 10,
      backgroundColor: '#FFFFFF',
      flexShrink: 0,
    },
    ctaTextCol: {
      flexShrink: 1,
      minWidth: 0,
      maxWidth: 210,
      alignItems: 'flex-start',
      gap: 3,
    },
    ctaHeadline: {
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
      color: 'rgba(255,255,255,0.92)',
      textAlign: 'left',
      writingDirection: 'rtl',
      width: '100%',
    },
    ctaSub: {
      fontSize: 11,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.50)',
      textAlign: 'left',
      writingDirection: 'rtl',
      width: '100%',
    },
    footer: {
      flexShrink: 0,
      paddingHorizontal: 16,
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tokens.colors.border.divider,
      backgroundColor: 'transparent',
    },
    exportButton: {
      borderRadius: 999,
      minHeight: 52,
      overflow: 'hidden',
    },
    exportButtonContent: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'center',
      gap: tokens.spacing.sm,
      minHeight: 52,
      paddingVertical: 14,
      paddingHorizontal: tokens.spacing.lg,
    },
    exportButtonDisabled: {
      opacity: 0.55,
    },
    exportButtonText: {
      fontSize: tokens.typography.fontSize.base,
      fontWeight: tokens.typography.fontWeight.bold as any,
      color: tokens.colors.primary.main,
    },
  });
