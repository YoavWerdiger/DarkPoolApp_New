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
import UICard from '../../../components/ui/UICard';
import BottomSheet from '../../../components/ui/BottomSheet/BottomSheet';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
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
import { HapticFeedback } from '../../../utils/hapticFeedback';

interface Props {
  portfolioId: string;
  holdings: PortfolioHolding[];
  onChanged?: () => void;
  /** מסך לקריאה בלבד (תיק של מישהו אחר) — לא להציג כפתורי סגירה */
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

  // priceMap = holdings (מגיע מ-WebSocket realtime) + fetchedPrices (REST fallback)
  // holdings מכסה סימבולים שב-portfolio_transactions; fetchedPrices מכסה trades-only symbols
  const priceMap = useMemo(() => {
    const m: Record<string, number> = {};
    // קודם fetchedPrices כבסיס, אחר כך holdings מדרוס (עדיפות גבוהה יותר — live WS)
    for (const [sym, price] of Object.entries(fetchedPrices)) {
      if (price > 0) m[sym] = price;
    }
    for (const h of holdings) {
      if (h.last_price && h.symbol) m[h.symbol] = h.last_price;
    }
    return m;
  }, [holdings, fetchedPrices]);

  // ref תמיד מעודכן למחיר אחרון — מונע יצירת load חדש בכל tick מחיר
  const priceMapRef = useRef(priceMap);
  useEffect(() => { priceMapRef.current = priceMap; }, [priceMap]);

  // load תלוי רק ב-portfolioId, לא ב-priceMap.
  // כך נמנע race condition שבו fetch ישן (לפני UPDATE הסגירה) מדרוס fetch נכון.
  const load = useCallback(async () => {
    try {
      const data = await loadTrades(portfolioId, 'OPEN');
      setTrades(data);

      // מביא מחירים עדכניים לכל הסימבולים בטריידים הפתוחים,
      // במיוחד עבור סימבולים שאינם ב-portfolio_transactions (ולכן לא ב-holdings).
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

  // מרענן את רשימת הטריידים כשהמסך האב טוען נתונים מחדש (לאחר הוספת/עריכת טרנזקציה)
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

    // ולידציה: תאריך סגירה לא יכול להיות לפני תאריך הפתיחה
    const openedAt = new Date(closingTrade.entry_date);
    if (finalDate < openedAt) {
      Alert.alert(
        'תאריך לא תקין',
        `לא ניתן לסגור לפני תאריך הפתיחה (${formatDateForInput(openedAt)})`
      );
      return;
    }
    // ולידציה: תאריך סגירה לא יכול להיות בעתיד
    if (finalDate > new Date()) {
      Alert.alert('תאריך לא תקין', 'לא ניתן לסגור בתאריך עתידי');
      return;
    }

    try {
      setBusy(true);
      await closeTrade(closingTrade.id, px, finalDate.toISOString());
      // נקה cache גרף כדי שהגרף ייבנה מחדש עם הסגירה החדשה
      clearHistoricalSeriesCache(closingTrade.portfolio_id);
      setClosingTrade(null);
      setExitPriceText('');
      // small delay to ensure DB write is visible before re-read
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
        root: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
        loading: { paddingVertical: 60, alignItems: 'center' },
        empty: {
          alignItems: 'center',
          paddingVertical: 60,
          gap: 8,
        },
        emptyTitle: {
          fontSize: 16,
          fontWeight: '700',
          color: tokens.colors.text.primary,
        },
        emptyText: {
          fontSize: 13,
          color: tokens.colors.text.tertiary,
          textAlign: 'center',
          paddingHorizontal: 30,
        },
        card: {
          marginBottom: 10,
          borderRadius: tokens.borderRadius.xl,
          overflow: 'hidden',
        },
        cardInner: {
          padding: 14,
          gap: 10,
        },
        topRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        },
        symbolBlock: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 10,
          flex: 1,
        },
        symbolHeaderRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 8,
        },
        symbol: {
          fontSize: 17,
          fontWeight: '800',
          color: tokens.colors.text.primary,
        },
        symbolMeta: {
          fontSize: 11,
          color: tokens.colors.text.tertiary,
          textAlign: 'right',
        },
        dirPill: {
          paddingHorizontal: 9,
          paddingVertical: 3,
          borderRadius: 10,
          borderWidth: 1,
        },
        dirPillText: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.3,
        },
        pnlBlock: {
          alignItems: 'flex-start',
        },
        pnlValue: {
          fontSize: 15,
          fontWeight: '800',
          writingDirection: 'ltr',
        },
        pnlPct: {
          fontSize: 12,
          fontWeight: '600',
          writingDirection: 'ltr',
        },
        divider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: tokens.colors.border.subtle,
          marginVertical: 2,
        },
        statsRow: {
          flexDirection: 'row-reverse',
          gap: 8,
        },
        stat: {
          flex: 1,
        },
        statLabel: {
          fontSize: 10,
          fontWeight: '600',
          color: tokens.colors.text.tertiary,
          textAlign: 'right',
          marginBottom: 2,
        },
        statValue: {
          fontSize: 13,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          textAlign: 'right',
          writingDirection: 'ltr',
        },
        closeBtn: {
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 11,
          borderRadius: 14,
          backgroundColor: `${tokens.colors.primary.main}1F`,
          borderWidth: 1,
          borderColor: `${tokens.colors.primary.main}55`,
        },
        closeBtnText: {
          color: tokens.colors.primary.main,
          fontSize: 13,
          fontWeight: '700',
        },
        iconBtn: {
          width: 40,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 14,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.12)',
          backgroundColor: 'rgba(255,255,255,0.06)',
        },
        sheetBody: {
          paddingHorizontal: 20,
          paddingTop: 24,
          gap: 14,
        },
        sheetHeader: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 12,
        },
        sheetHeaderRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 8,
        },
        sheetTitle: {
          fontSize: 20,
          fontWeight: '800',
          color: tokens.colors.text.primary,
        },
        sheetSub: {
          fontSize: 12,
          color: tokens.colors.text.tertiary,
          textAlign: 'right',
          marginTop: 2,
        },
        sheetInputBlock: {
          gap: 6,
        },
        sheetLabel: {
          fontSize: 13,
          fontWeight: '600',
          color: tokens.colors.text.tertiary,
          textAlign: 'right',
        },
        sheetInputWrap: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 8,
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderRadius: 14,
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
          paddingHorizontal: 14,
          paddingVertical: 8,
        },
        sheetInputPrefix: {
          fontSize: 18,
          fontWeight: '700',
          color: tokens.colors.text.tertiary,
        },
        sheetInput: {
          flex: 1,
          fontSize: 22,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          textAlign: 'right',
          writingDirection: 'ltr',
          paddingVertical: 4,
        },
        pnlPreview: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 14,
          paddingVertical: 10,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderRadius: 12,
        },
        pnlPreviewLabel: {
          fontSize: 12,
          fontWeight: '600',
          color: tokens.colors.text.tertiary,
        },
        pnlPreviewValue: {
          fontSize: 14,
          fontWeight: '800',
          writingDirection: 'ltr',
        },
        sheetActions: {
          flexDirection: 'row-reverse',
          gap: 10,
          paddingHorizontal: 20,
          paddingTop: 6,
          paddingBottom: 0,
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
        sheetBtnText: { fontSize: 15, fontWeight: '800' },
        dateRow: {
          flexDirection: 'row-reverse',
          gap: 8,
        },
        datePill: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderRadius: 28,
          paddingHorizontal: 14,
          paddingVertical: 14,
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
        },
        datePillText: {
          fontSize: 14,
          fontWeight: '600',
          color: tokens.colors.text.primary,
          textAlign: 'center',
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
          backgroundColor: '#1A201A',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: 16,
          paddingHorizontal: 16,
          paddingBottom: 36,
        },
        exitPickerTitle: {
          fontSize: 16,
          fontWeight: '700',
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
          fontSize: 15,
          fontWeight: '700',
          color: tokens.colors.text.inverse,
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
      {trades.map((t) => {
        const isLong = t.direction === 'long';
        const accent = isLong
          ? tokens.colors.primary.main
          : tokens.colors.text.danger;
        const lastPrice = priceMap[t.symbol];
        // מחשב P&L לא-ממומש ישירות מ-priceMap (מתעדכן בזמן אמת עם כל tick מחיר)
        const upnl =
          lastPrice != null
            ? isLong
              ? (lastPrice - t.entry_price) * t.quantity * t.leverage
              : (t.entry_price - lastPrice) * t.quantity * t.leverage
            : 0;
        const pct =
          t.entry_price > 0
            ? (upnl / (t.entry_price * t.quantity)) * 100
            : 0;
        const upnlColor =
          upnl > 0
            ? tokens.colors.primary.main
            : upnl < 0
              ? tokens.colors.text.danger
              : tokens.colors.text.secondary;
        const curValue =
          (lastPrice ?? t.entry_price) * t.quantity;
        const dayOpened = new Date(t.entry_date).toLocaleDateString('he-IL', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit',
        });
        return (
          <UICard
            key={t.id}
            variant="glass"
            glassIntensity="light"
            padding="none"
            style={styles.card}
          >
            <View style={styles.cardInner}>
              <View style={styles.topRow}>
                <View style={styles.symbolBlock}>
                  <TickerLogo symbol={t.symbol} size={36} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.symbolHeaderRow}>
                      <Text style={styles.symbol}>{t.symbol}</Text>
                      <View
                        style={[
                          styles.dirPill,
                          {
                            borderColor: `${accent}66`,
                            backgroundColor: `${accent}1F`,
                          },
                        ]}
                      >
                        <Text style={[styles.dirPillText, { color: accent }]}>
                          {isLong ? 'לונג' : 'שורט'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.symbolMeta} numberOfLines={1}>
                      נפתח · {dayOpened}
                    </Text>
                  </View>
                </View>
                <View style={styles.pnlBlock}>
                  <Text style={[styles.pnlValue, { color: upnlColor }]}>
                    {lastPrice != null
                      ? formatCurrency(upnl, t.currency)
                      : '—'}
                  </Text>
                  <Text style={[styles.pnlPct, { color: upnlColor }]}>
                    {lastPrice != null
                      ? formatPercent(pct)
                      : '—'}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>כניסה</Text>
                  <Text style={styles.statValue}>
                    {formatCurrency(t.entry_price, t.currency)}
                  </Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>מחיר נוכחי</Text>
                  <Text style={styles.statValue}>
                    {lastPrice != null
                      ? formatCurrency(lastPrice, t.currency)
                      : '—'}
                  </Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>כמות</Text>
                  <Text style={styles.statValue}>
                    {Number.isInteger(t.quantity)
                      ? t.quantity
                      : t.quantity.toFixed(4)}
                  </Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>שווי</Text>
                  <Text style={styles.statValue}>
                    {formatCurrency(curValue, t.currency)}
                  </Text>
                </View>
              </View>

              {!readOnly ? (
                <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.closeBtn, { flex: 1 }]}
                    onPress={() => {
                      void HapticFeedback.impactLight();
                      openCloseModal(t);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.closeBtnText}>סגור פוזיציה</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => handleEditTrade(t)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="pencil-outline" size={16} color={tokens.colors.text.secondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.iconBtn, { borderColor: `${tokens.colors.text.danger}44` }]}
                    onPress={() => handleDeleteTrade(t)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="trash-outline" size={16} color={tokens.colors.text.danger} />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </UICard>
        );
      })}

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
        useGlassBackground
        showBrandBackground={false}
        avoidKeyboard
        contentPaddingBottom={insets.bottom}
      >
        {closingTrade ? (
          <View style={{ position: 'relative' }}>
            <View style={styles.sheetBody}>
              {/* Header — תמיד מוצג */}
              <View style={styles.sheetHeader}>
                <TickerLogo symbol={closingTrade.symbol} size={48} />
                <View style={{ flex: 1 }}>
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


              {/* ===== מחיר יציאה ===== */}
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

              {/* ===== תאריך ושעת יציאה ===== */}
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
                        // שמור את התאריך הקיים — עדכן רק את השעה
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

            {/* iOS absolute overlay — Date */}
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
                        // שמור את הזמן הנוכחי מ-tempExitDate — עדכן רק את התאריך
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

            {/* iOS absolute overlay — Time */}
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
                        // שמור את התאריך הנוכחי מ-tempExitDate — עדכן רק את השעה
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
