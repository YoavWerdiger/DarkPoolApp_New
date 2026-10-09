import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { legacyAlert } from '../../../utils/appDialog';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { PortfoliosStackParamList } from '../../../navigation/PortfoliosStack';
import BottomSheet, {
  BOTTOM_SHEET_EDGE_HANDLE_HEIGHT,
  resolveFitContentSnapPoint,
} from '../../../components/ui/BottomSheet/BottomSheet';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import ExportTradeImage, {
  portfolioTradeToExportable,
  type ExportableTrade,
} from '../../../components/Journal/ExportTradeImage';
import {
  SHEET_BACKDROP_OPACITY,
  sheetContentBottomPadding,
} from '../../../components/ui/BottomSheet/sheetGlass';
import UIButton from '../../../components/ui/UIButton';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../../components/ui/appLayout';
import {
  appCardMetricLabelStyle,
  appFormFieldLabelStyle,
} from '../../../components/ui/appType';
import {
  formFieldInputStyle,
  formFieldNumericInputStyle,
  formFieldPlaceholderColor,
  formFieldShellStyle,
} from '../../../components/ui/formControl';
import { useTheme } from '../../../context/ThemeContext';
import {
  loadTrades,
  closeTrade,
  deleteTrade,
} from '../../../services/portfolios/portfolioTradeDerive';
import { getQuotes } from '../../../services/portfolios/portfolioPriceFeed';
import { clearHistoricalSeriesCache } from '../../../services/portfolios';
import type {
  Trade,
  PortfolioHolding,
} from '../portfolioTypes';
import { formatCurrency, formatPercent } from '../utils/format';
import { TickerLogo } from '../components/TickerLogo';
import PortfolioTradesTable from '../components/PortfolioTradesTable';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import {
  JOURNAL_TYPE,
  journalPhysicalRightText,
  journalSectionSubtitleStyle,
  journalSectionTitleStyle,
} from '../../Journal/journalLayout';

const SCREEN_HEIGHT = Dimensions.get('window').height;
/** גובה תוכן שיט הסגירה האחרון — הפתיחה הבאה עולה ישר בגובה הנכון */
let lastCloseSheetHeight = 0;

interface Props {
  portfolioId: string;
  holdings: PortfolioHolding[];
  onChanged?: () => void;
  /** מסך לקריאה בלבד (תיק של מישהו אחר / Colmex) — לא להציג סגירה/עריכה */
  readOnly?: boolean;
  /** מפתח שמשתנה כל פעם שהמסך האב מרענן נתונים — גורם לטעינה מחדש של הטריידים */
  refreshKey?: number;
}

type Nav = NativeStackNavigationProp<PortfoliosStackParamList, 'PortfolioDetail'>;

export default function OpenTradesTab({
  portfolioId,
  holdings,
  onChanged,
  readOnly = false,
  refreshKey,
}: Props) {
  const tokens = useDesignTokens();
  const { isDarkMode } = useTheme();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [closeSheetH, setCloseSheetH] = useState(lastCloseSheetHeight);
  const closeSheetSnap = useMemo(
    () => [
      resolveFitContentSnapPoint({
        contentHeight: closeSheetH,
        screenHeight: SCREEN_HEIGHT,
        handlePx: BOTTOM_SHEET_EDGE_HANDLE_HEIGHT,
        initialEstimate: 0.62,
        maxSnap: 0.92,
      }),
    ],
    [closeSheetH],
  );
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [closingTrade, setClosingTrade] = useState<Trade | null>(null);
  const [exitPriceText, setExitPriceText] = useState('');
  const [exitDate, setExitDate] = useState<Date>(new Date());
  const [showExitDatePicker, setShowExitDatePicker] = useState(false);
  const [showExitTimePicker, setShowExitTimePicker] = useState(false);
  const [tempExitDate, setTempExitDate] = useState<Date>(new Date());
  const [busy, setBusy] = useState(false);
  /** מחירים שנטענו ישירות מ-Finnhub/Yahoo עבור סימבולים שאינם ב-holdings */
  const [fetchedPrices, setFetchedPrices] = useState<Record<string, number>>({});
  const [exportTrade, setExportTrade] = useState<ExportableTrade | null>(null);

  // priceMap = holdings (מגיע מ-WebSocket realtime) + fetchedPrices (REST fallback)
  const priceMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const [sym, price] of Object.entries(fetchedPrices)) {
      if (price > 0) m[sym] = price;
    }
    for (const h of holdings) {
      if (h.last_price && h.symbol) m[h.symbol] = h.last_price;
    }
    return m;
  }, [holdings, fetchedPrices]);

  const load = useCallback(async () => {
    try {
      const data = await loadTrades(portfolioId, 'OPEN');
      setTrades(data);

      const symbols = Array.from(new Set(data.map((t) => t.symbol)));
      if (symbols.length > 0) {
        void getQuotes(symbols).then((quotesMap) => {
          const prices: Record<string, number> = {};
          for (const [sym, q] of quotesMap) {
            if (q.price > 0) prices[sym] = q.price;
          }
          setFetchedPrices(prices);
        });
      }
    } catch (err) {
      console.error('loadTrades (OPEN):', err);
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    void load();
  }, [load]);

  // רענון מחירים חי כל 30ש — קריטי לתיקי Colmex (holdings ריקים, בלי WS)
  useEffect(() => {
    if (trades.length === 0) return;
    const symbols = Array.from(new Set(trades.map((t) => t.symbol)));
    if (symbols.length === 0) return;

    const refreshPrices = () => {
      void getQuotes(symbols).then((quotesMap) => {
        const prices: Record<string, number> = {};
        for (const [sym, q] of quotesMap) {
          if (q.price > 0) prices[sym] = q.price;
        }
        if (Object.keys(prices).length > 0) setFetchedPrices(prices);
      });
    };

    const id = setInterval(refreshPrices, 30_000);
    return () => clearInterval(id);
  }, [trades]);

  const refreshKeyInitialized = useRef(false);
  useEffect(() => {
    if (!refreshKeyInitialized.current) {
      refreshKeyInitialized.current = true;
      return;
    }
    void load();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCloseModal = useCallback(
    (trade: Trade) => {
      const guess = priceMap[trade.symbol];
      const now = new Date();
      setExitPriceText(guess ? guess.toFixed(2) : '');
      setExitDate(now);
      setTempExitDate(now);
      setShowExitDatePicker(false);
      setShowExitTimePicker(false);
      setClosingTrade(trade);
    },
    [priceMap]
  );

  const handleEditTrade = useCallback(
    (trade: Trade) => {
      void HapticFeedback.impactLight();
      navigation.navigate('AddTransaction', {
        portfolioId: trade.portfolio_id,
        initialMode: 'asset',
        editTradeId: trade.id,
      });
    },
    [navigation]
  );

  const handleDeleteTrade = useCallback(
    (trade: Trade) => {
      void HapticFeedback.impactLight();
      legacyAlert(
        'מחיקת פוזיציה',
        `האם למחוק את פוזיציית ${trade.symbol}? הפעולה תחזיר את ה-Cash ולא ניתנת לביטול.`,
        [
          { text: 'ביטול', style: 'cancel' },
          {
            text: 'מחק',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteTrade(trade.id);
                await load();
                onChanged?.();
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                legacyAlert('שגיאה', `מחיקה נכשלה: ${msg}`);
              }
            },
          },
        ]
      );
    },
    [load, onChanged]
  );

  const openShareImage = useCallback(
    (trade: Trade) => {
      void HapticFeedback.impactLight();
      const mapped = portfolioTradeToExportable(trade, {
        currentPrice: priceMap[trade.symbol],
      });
      if (!mapped) {
        legacyAlert('שיתוף', 'ממתין למחיר נוכחי — נסה שוב בעוד רגע');
        return;
      }
      setExportTrade(mapped);
    },
    [priceMap]
  );

  function formatDateForInput(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const handleConfirmClose = useCallback(async () => {
    if (!closingTrade) return;
    const px = parseFloat(exitPriceText);
    if (!px || px <= 0) {
      legacyAlert('שגיאה', 'מחיר יציאה לא תקין');
      return;
    }
    const finalDate = exitDate;

    const openedAt = new Date(closingTrade.entry_date);
    if (finalDate < openedAt) {
      legacyAlert(
        'תאריך לא תקין',
        `לא ניתן לסגור לפני תאריך הפתיחה (${formatDateForInput(openedAt)})`
      );
      return;
    }
    if (finalDate > new Date()) {
      legacyAlert('תאריך לא תקין', 'לא ניתן לסגור בתאריך עתידי');
      return;
    }

    try {
      setBusy(true);
      await closeTrade(closingTrade.id, px, finalDate.toISOString());
      clearHistoricalSeriesCache(closingTrade.portfolio_id);
      setClosingTrade(null);
      setExitPriceText('');
      await new Promise((r) => setTimeout(r, 400));
      await load();
      onChanged?.();
    } catch (err: any) {
      console.error('quickCloseTrade error:', JSON.stringify(err), err?.message, err?.code);
      const msg =
        err?.message === 'not_authenticated'
          ? 'לא מחובר'
          : err?.message === 'trade_not_open'
            ? 'הטרייד כבר סגור'
            : err?.message === 'trade_not_found'
              ? 'לא נמצא הטרייד'
              : err?.message === 'trade_update_failed'
                ? 'עדכון הטרייד נכשל — ייתכן בעיית הרשאות'
                : `שגיאה: ${err?.message ?? err?.code ?? 'לא ידוע'}`;
      legacyAlert('שגיאת סגירה', msg);
    } finally {
      setBusy(false);
    }
  }, [closingTrade, exitDate, exitPriceText, load, onChanged]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          paddingTop: 4,
          direction: 'rtl',
        },
        loading: { paddingVertical: 60, alignItems: 'center' },
        empty: {
          alignItems: 'center',
          paddingVertical: 60,
          gap: 8,
          direction: 'rtl',
        },
        emptyTitle: {
          ...journalSectionTitleStyle,
          color: tokens.colors.text.primary,
          alignSelf: 'stretch',
          textAlign: 'center',
        },
        emptyText: {
          ...journalSectionSubtitleStyle,
          color: tokens.colors.text.tertiary,
          alignSelf: 'stretch',
          textAlign: 'center',
          paddingHorizontal: 30,
        },
        dirPill: {
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 999,
          borderWidth: 0,
          flexShrink: 0,
        },
        dirPillText: {
          ...appCardMetricLabelStyle,
          textAlign: 'center',
        },
        sheetBody: {
          paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
          paddingTop: APP_LAYOUT.componentGap,
          gap: APP_LAYOUT.componentGap,
          direction: 'rtl',
        },
        sheetHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        },
        sheetHeaderText: {
          flex: 1,
          minWidth: 0,
        },
        sheetHeaderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        },
        sheetTitle: {
          ...journalSectionTitleStyle,
          color: tokens.colors.text.primary,
        },
        sheetSub: {
          ...journalSectionSubtitleStyle,
          marginTop: 2,
          color: tokens.colors.text.tertiary,
        },
        sheetInputBlock: {
          gap: APP_LAYOUT.stackGapSmall,
        },
        sheetLabel: {
          ...appFormFieldLabelStyle,
          color: tokens.colors.text.secondary,
        },
        sheetInputWrap: {
          ...formFieldShellStyle({ tokens, focused: false }),
          flexDirection: 'row',
          gap: 8,
          borderRadius: tokens.borderRadius.search,
          paddingHorizontal: 16,
          minHeight: 52,
          direction: 'ltr',
        },
        sheetInputPrefix: {
          ...formFieldInputStyle(tokens),
          color: tokens.colors.text.secondary,
          writingDirection: 'ltr',
        },
        sheetInput: {
          ...formFieldNumericInputStyle(tokens),
          flex: 1,
          minHeight: 52,
          textAlign: 'left',
          color: tokens.colors.text.primary,
        },
        pnlPreview: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: APP_LAYOUT.cardPadding,
          backgroundColor: tokens.colors.background.cardSolid,
          borderRadius: UI_CARD_RADIUS,
        },
        pnlPreviewLabel: {
          ...appCardMetricLabelStyle,
          color: tokens.colors.text.secondary,
        },
        pnlPreviewValue: {
          fontSize: JOURNAL_TYPE.cardMetricValueSecondary.fontSize,
          fontWeight: JOURNAL_TYPE.cardMetricValueSecondary.fontWeight,
          lineHeight: JOURNAL_TYPE.cardMetricValueSecondary.lineHeight,
          writingDirection: 'ltr',
          textAlign: 'right',
          fontVariant: ['tabular-nums'],
        },
        sheetActions: {
          gap: APP_LAYOUT.stackGapSmall,
          paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
          paddingTop: APP_LAYOUT.componentGap,
        },
        dateRow: {
          flexDirection: 'row',
          gap: 8,
        },
        datePill: {
          ...formFieldShellStyle({ tokens, focused: false }),
          flex: 1,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 8,
          borderRadius: tokens.borderRadius.search,
          paddingHorizontal: 16,
          minHeight: 52,
        },
        datePillText: {
          ...formFieldInputStyle(tokens),
          color: tokens.colors.text.primary,
          textAlign: 'center',
          writingDirection: 'ltr',
        },
        exitPickerOverlay: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          top: 0,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'flex-end',
          zIndex: 100,
        },
        exitPickerSheet: {
          backgroundColor: tokens.colors.background.primary,
          borderTopLeftRadius: tokens.borderRadius.xl,
          borderTopRightRadius: tokens.borderRadius.xl,
          paddingTop: APP_LAYOUT.componentGap,
          paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
          // safe area — הבורר יושב על קצה המסך
          paddingBottom: sheetContentBottomPadding(insets.bottom),
          direction: 'rtl',
        },
        exitPickerTitle: {
          ...journalSectionTitleStyle,
          color: tokens.colors.text.primary,
          textAlign: 'center',
          marginBottom: 8,
        },
      }),
    [tokens, insets.bottom]
  );

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={tokens.colors.primary.main} />
      </View>
    );
  }

  if (trades.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons
          name="document-text-outline"
          size={42}
          color={tokens.colors.text.tertiary}
        />
        <Text style={styles.emptyTitle}>אין פוזיציות פתוחות</Text>
        <Text style={styles.emptyText}>
          פתח טרייד חדש (לונג או שורט) מהכרטיסיה הראשית והוא יופיע כאן.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <PortfolioTradesTable
        mode="open"
        trades={trades}
        priceMap={priceMap}
        readOnly={readOnly}
        onClose={readOnly ? undefined : openCloseModal}
        onDelete={readOnly ? undefined : handleDeleteTrade}
        onShare={openShareImage}
        onEdit={readOnly ? undefined : handleEditTrade}
      />

      <ExportTradeImage
        trade={exportTrade}
        visible={!!exportTrade}
        onClose={() => setExportTrade(null)}
      />

      <BottomSheet
        isOpen={!!closingTrade}
        onClose={() => {
          setClosingTrade(null);
        }}
        snapPoints={closeSheetSnap}
        fitContent
        showHandle
        enablePanDownToClose
        topCornerRadius={tokens.borderRadius.xl}
        useModal
        edgeToEdge
        backgroundColor={tokens.colors.background.primary}
        backdropOpacity={SHEET_BACKDROP_OPACITY}
        showBrandBackground={false}
        showBrandWatermark={false}
        avoidKeyboard
        contentPaddingBottom={0}
      >
        {closingTrade ? (
          <View
            style={{
              position: 'relative',
              // safe area בתוך התוכן הנמדד — הגובה כולל אותו, הכפתורים לא נדחפים מתחת לקצה
              paddingBottom: sheetContentBottomPadding(insets.bottom),
            }}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (!(h > 0)) return;
              lastCloseSheetHeight = h;
              setCloseSheetH((prev) => (Math.abs(prev - h) < 1 ? prev : h));
            }}
          >
            <View style={styles.sheetBody}>
              <View style={styles.sheetHeader}>
                <TickerLogo symbol={closingTrade.symbol} size={48} />
                <View style={styles.sheetHeaderText}>
                  <View style={styles.sheetHeaderRow}>
                    <Text style={styles.sheetTitle}>{closingTrade.symbol}</Text>
                    <View
                      style={[
                        styles.dirPill,
                        {
                          borderColor:
                            closingTrade.direction === 'long'
                              ? `${tokens.colors.primary.main}66`
                              : `${tokens.colors.text.danger}66`,
                          backgroundColor:
                            closingTrade.direction === 'long'
                              ? `${tokens.colors.primary.main}1F`
                              : `${tokens.colors.text.danger}1F`,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dirPillText,
                          {
                            color:
                              closingTrade.direction === 'long'
                                ? tokens.colors.primary.main
                                : tokens.colors.text.danger,
                          },
                        ]}
                      >
                        {closingTrade.direction === 'long' ? 'לונג' : 'שורט'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.sheetSub}>
                    סגירת {closingTrade.quantity} יח׳ · כניסה{' '}
                    {formatCurrency(
                      closingTrade.entry_price,
                      closingTrade.currency
                    )}
                  </Text>
                </View>
              </View>

              <View style={styles.sheetInputBlock}>
                <Text style={styles.sheetLabel}>מחיר יציאה</Text>
                <View style={styles.sheetInputWrap}>
                  <Text style={styles.sheetInputPrefix}>
                    {closingTrade.currency === 'USD' ? '$' : closingTrade.currency}
                  </Text>
                  <TextInput
                    value={exitPriceText}
                    onChangeText={setExitPriceText}
                    placeholder="0.00"
                    placeholderTextColor={formFieldPlaceholderColor(tokens)}
                    keyboardType="decimal-pad"
                    style={styles.sheetInput}
                  />
                </View>
              </View>

              <View style={styles.sheetInputBlock}>
                <Text style={styles.sheetLabel}>תאריך ושעת יציאה</Text>
                <View style={styles.dateRow}>
                  <TouchableOpacity
                    style={styles.datePill}
                    activeOpacity={0.8}
                    onPress={() => {
                      void HapticFeedback.impactLight();
                      setTempExitDate(exitDate);
                      setShowExitDatePicker(true);
                    }}
                  >
                    <Ionicons name="calendar-outline" size={18} color={tokens.colors.text.tertiary} />
                    <Text style={styles.datePillText}>
                      {exitDate.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.datePill}
                    activeOpacity={0.8}
                    onPress={() => {
                      void HapticFeedback.impactLight();
                      setTempExitDate(exitDate);
                      setShowExitTimePicker(true);
                    }}
                  >
                    <Ionicons name="time-outline" size={18} color={tokens.colors.text.tertiary} />
                    <Text style={styles.datePillText}>
                      {exitDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                </View>
                {Platform.OS === 'android' && showExitDatePicker && (
                  <DateTimePicker
                    value={exitDate}
                    mode="date"
                    display="default"
                    maximumDate={new Date()}
                    minimumDate={(() => { const d = closingTrade ? new Date(closingTrade.entry_date) : null; return d && d.getFullYear() > 2000 ? d : undefined; })()}
                    onChange={(_, d) => {
                      setShowExitDatePicker(false);
                      if (d && d.getFullYear() > 2000) {
                        const combined = new Date(exitDate);
                        combined.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                        setExitDate(combined);
                      }
                    }}
                  />
                )}
                {Platform.OS === 'android' && showExitTimePicker && (
                  <DateTimePicker
                    value={exitDate}
                    mode="time"
                    display="default"
                    is24Hour
                    onChange={(_, d) => {
                      setShowExitTimePicker(false);
                      if (d) {
                        const combined = new Date(exitDate);
                        combined.setHours(d.getHours(), d.getMinutes(), 0, 0);
                        setExitDate(combined);
                      }
                    }}
                  />
                )}
              </View>

              {(() => {
                const px = parseFloat(exitPriceText);
                if (!px || px <= 0) return null;
                const pnl =
                  closingTrade.direction === 'long'
                    ? (px - closingTrade.entry_price) *
                      closingTrade.quantity * closingTrade.leverage
                    : (closingTrade.entry_price - px) *
                      closingTrade.quantity * closingTrade.leverage;
                const pnlPct =
                  closingTrade.entry_price > 0
                    ? (pnl /
                        (closingTrade.entry_price *
                          closingTrade.quantity)) *
                      100
                    : 0;
                const c =
                  pnl > 0
                    ? tokens.colors.primary.main
                    : pnl < 0
                      ? tokens.colors.text.danger
                      : tokens.colors.text.secondary;
                return (
                  <View style={styles.pnlPreview}>
                    <Text style={styles.pnlPreviewLabel}>תוצאה צפויה</Text>
                    <Text style={[styles.pnlPreviewValue, { color: c }]}>
                      {formatCurrency(pnl, closingTrade.currency)} (
                      {formatPercent(pnlPct)})
                    </Text>
                  </View>
                );
              })()}
            </View>

            <View style={styles.sheetActions}>
              <UIButton
                title={busy ? 'סוגר…' : 'סגור פוזיציה'}
                variant="primary"
                fullWidth
                loading={busy}
                disabled={busy}
                onPress={() => {
                  void HapticFeedback.medium();
                  void handleConfirmClose();
                }}
              />
              <UIButton
                title="ביטול"
                variant="secondary"
                fullWidth
                disabled={busy}
                onPress={() => setClosingTrade(null)}
              />
            </View>

            {Platform.OS === 'ios' && showExitDatePicker && (
              <View style={styles.exitPickerOverlay}>
                <View style={styles.exitPickerSheet}>
                  <Text style={styles.exitPickerTitle}>בחר תאריך</Text>
                  <DateTimePicker
                    value={tempExitDate}
                    mode="date"
                    display="spinner"
                    locale="he-IL"
                    themeVariant={isDarkMode ? 'dark' : 'light'}
                    maximumDate={new Date()}
                    minimumDate={(() => { const d = closingTrade ? new Date(closingTrade.entry_date) : null; return d && d.getFullYear() > 2000 ? d : undefined; })()}
                    onChange={(_, d) => {
                      if (d && d.getFullYear() > 2000) {
                        const combined = new Date(tempExitDate);
                        combined.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                        setTempExitDate(combined);
                      }
                    }}
                    style={{ alignSelf: 'stretch' }}
                  />
                  <UIButton
                    title="אישור"
                    variant="primary"
                    fullWidth
                    style={{ marginTop: APP_LAYOUT.cardTitleToBodyGap }}
                    onPress={() => {
                      setExitDate(tempExitDate);
                      setShowExitDatePicker(false);
                    }}
                  />
                </View>
              </View>
            )}

            {Platform.OS === 'ios' && showExitTimePicker && (
              <View style={styles.exitPickerOverlay}>
                <View style={styles.exitPickerSheet}>
                  <Text style={styles.exitPickerTitle}>בחר שעה</Text>
                  <DateTimePicker
                    value={tempExitDate}
                    mode="time"
                    display="spinner"
                    locale="he-IL"
                    themeVariant={isDarkMode ? 'dark' : 'light'}
                    is24Hour
                    onChange={(_, d) => {
                      if (d && d.getFullYear() > 1971) {
                        const combined = new Date(tempExitDate);
                        combined.setHours(d.getHours(), d.getMinutes(), 0, 0);
                        setTempExitDate(combined);
                      }
                    }}
                    style={{ alignSelf: 'stretch' }}
                  />
                  <UIButton
                    title="אישור"
                    variant="primary"
                    fullWidth
                    style={{ marginTop: APP_LAYOUT.cardTitleToBodyGap }}
                    onPress={() => {
                      setExitDate(tempExitDate);
                      setShowExitTimePicker(false);
                    }}
                  />
                </View>
              </View>
            )}
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}
