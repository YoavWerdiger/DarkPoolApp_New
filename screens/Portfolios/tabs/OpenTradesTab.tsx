import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { PortfoliosStackParamList } from '../../../navigation/PortfoliosStack';
import BottomSheet from '../../../components/ui/BottomSheet/BottomSheet';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import ExportTradeImage, {
  portfolioTradeToExportable,
  type ExportableTrade,
} from '../../../components/Journal/ExportTradeImage';
import {
  SHEET_BACKDROP_OPACITY,
  SHEET_GLASS_FLOOR,
  SHEET_GLASS_INTENSITY,
  SHEET_GLASS_OVERLAY,
  sheetContentBottomPadding,
} from '../../../components/ui/BottomSheet/sheetGlass';
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
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
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
      Alert.alert(
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
                Alert.alert('שגיאה', `מחיקה נכשלה: ${msg}`);
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
        Alert.alert('שיתוף', 'ממתין למחיר נוכחי — נסה שוב בעוד רגע');
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
      Alert.alert('שגיאה', 'מחיר יציאה לא תקין');
      return;
    }
    const finalDate = exitDate;

    const openedAt = new Date(closingTrade.entry_date);
    if (finalDate < openedAt) {
      Alert.alert(
        'תאריך לא תקין',
        `לא ניתן לסגור לפני תאריך הפתיחה (${formatDateForInput(openedAt)})`
      );
      return;
    }
    if (finalDate > new Date()) {
      Alert.alert('תאריך לא תקין', 'לא ניתן לסגור בתאריך עתידי');
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
      Alert.alert('שגיאת סגירה', msg);
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
        },
        emptyText: {
          ...journalSectionSubtitleStyle,
          color: tokens.colors.text.tertiary,
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
          fontSize: JOURNAL_TYPE.caption2.fontSize,
          fontWeight: '700',
          lineHeight: JOURNAL_TYPE.caption2.lineHeight,
          letterSpacing: 0.2,
          textAlign: 'center',
        },
        sheetBody: {
          paddingHorizontal: 20,
          paddingTop: 24,
          gap: 14,
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
          gap: 6,
        },
        sheetLabel: {
          fontSize: 13,
          fontWeight: '600',
          color: tokens.colors.text.tertiary,
          ...journalPhysicalRightText,
        },
        sheetInputWrap: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: tokens.colors.glass.card.bg,
          borderRadius: 14,
          borderWidth: 0,
          borderColor: tokens.colors.border.subtle,
          paddingHorizontal: 14,
          paddingVertical: 8,
          direction: 'ltr',
        },
        sheetInputPrefix: {
          fontSize: 18,
          fontWeight: '700',
          color: tokens.colors.text.tertiary,
          writingDirection: 'ltr',
        },
        sheetInput: {
          flex: 1,
          fontSize: 22,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          textAlign: 'left',
          writingDirection: 'ltr',
          paddingVertical: 4,
        },
        pnlPreview: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 14,
          paddingVertical: 10,
          backgroundColor: tokens.colors.glass.card.bg,
          borderRadius: 12,
        },
        pnlPreviewLabel: {
          fontSize: JOURNAL_TYPE.caption.fontSize,
          fontWeight: '600',
          lineHeight: JOURNAL_TYPE.caption.lineHeight,
          color: tokens.colors.text.tertiary,
          ...journalPhysicalRightText,
        },
        pnlPreviewValue: {
          fontSize: JOURNAL_TYPE.body.fontSize,
          fontWeight: '800',
          lineHeight: JOURNAL_TYPE.body.lineHeight,
          writingDirection: 'ltr',
          textAlign: 'right',
        },
        sheetActions: {
          flexDirection: 'row',
          gap: 10,
          paddingHorizontal: 20,
          paddingTop: 6,
          paddingBottom: 0,
          direction: 'rtl',
        },
        sheetBtn: {
          flex: 1,
          paddingVertical: 14,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
        },
        sheetBtnPrimary: {
          backgroundColor: tokens.colors.primary.main,
        },
        sheetBtnCancel: {
          backgroundColor: 'rgba(255,255,255,0.08)',
        },
        sheetBtnText: {
          fontSize: JOURNAL_TYPE.body.fontSize,
          fontWeight: '800',
          lineHeight: JOURNAL_TYPE.body.lineHeight,
          ...journalPhysicalRightText,
        },
        dateRow: {
          flexDirection: 'row',
          gap: 8,
        },
        datePill: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: tokens.colors.glass.card.bg,
          borderRadius: 28,
          paddingHorizontal: 14,
          paddingVertical: 14,
          borderWidth: 0,
          borderColor: tokens.colors.border.subtle,
        },
        datePillText: {
          fontSize: JOURNAL_TYPE.body.fontSize,
          fontWeight: '600',
          lineHeight: JOURNAL_TYPE.body.lineHeight,
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
          backgroundColor: SHEET_GLASS_FLOOR,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: 16,
          paddingHorizontal: 16,
          paddingBottom: 36,
          direction: 'rtl',
        },
        exitPickerTitle: {
          ...journalSectionTitleStyle,
          color: tokens.colors.text.primary,
          textAlign: 'center',
          marginBottom: 8,
        },
        exitPickerDoneBtn: {
          marginTop: 12,
          backgroundColor: tokens.colors.primary.main,
          borderRadius: 28,
          paddingVertical: 14,
          alignItems: 'center',
        },
        exitPickerDoneBtnText: {
          fontSize: JOURNAL_TYPE.body.fontSize,
          fontWeight: '700',
          lineHeight: JOURNAL_TYPE.body.lineHeight,
          color: tokens.colors.text.inverse,
          textAlign: 'center',
        },
      }),
    [tokens]
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
        fitContent
        showHandle
        enablePanDownToClose
        topCornerRadius={28}
        useModal
        edgeToEdge
        useGlassBackground
        glassIntensity={SHEET_GLASS_INTENSITY}
        glassOverlayColor={SHEET_GLASS_OVERLAY}
        backdropOpacity={SHEET_BACKDROP_OPACITY}
        showBrandBackground={false}
        showBrandWatermark={false}
        avoidKeyboard
        contentPaddingBottom={sheetContentBottomPadding(insets.bottom)}
      >
        {closingTrade ? (
          <View style={{ position: 'relative' }}>
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
                    placeholderTextColor={tokens.colors.text.tertiary}
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
                    style={[styles.datePill, { flex: 0.7 }]}
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
              <TouchableOpacity
                style={[styles.sheetBtn, styles.sheetBtnCancel]}
                onPress={() => {
                  void HapticFeedback.selection();
                  setClosingTrade(null);
                }}
                disabled={busy}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.sheetBtnText,
                    { color: tokens.colors.text.primary },
                  ]}
                >
                  ביטול
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetBtn, styles.sheetBtnPrimary]}
                onPress={() => {
                  void HapticFeedback.medium();
                  void handleConfirmClose();
                }}
                disabled={busy}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.sheetBtnText,
                    { color: tokens.colors.text.inverse },
                  ]}
                >
                  {busy ? 'סוגר…' : 'אישור סגירה'}
                </Text>
              </TouchableOpacity>
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
                    themeVariant="dark"
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
                  <TouchableOpacity
                    style={styles.exitPickerDoneBtn}
                    onPress={() => {
                      setExitDate(tempExitDate);
                      setShowExitDatePicker(false);
                    }}
                  >
                    <Text style={styles.exitPickerDoneBtnText}>אישור</Text>
                  </TouchableOpacity>
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
                    themeVariant="dark"
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
                  <TouchableOpacity
                    style={styles.exitPickerDoneBtn}
                    onPress={() => {
                      setExitDate(tempExitDate);
                      setShowExitTimePicker(false);
                    }}
                  >
                    <Text style={styles.exitPickerDoneBtnText}>אישור</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}
