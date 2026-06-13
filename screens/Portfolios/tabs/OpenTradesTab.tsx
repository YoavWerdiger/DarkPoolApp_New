import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  TextInput,
  Dimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../../components/ui/UICard';
import BottomSheet from '../../../components/ui/BottomSheet/BottomSheet';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import {
  loadDerivedTrades,
  quickCloseTrade,
} from '../../../services/portfolios/portfolioTradeDerive';
import type {
  DerivedTrade,
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
}

export default function OpenTradesTab({
  portfolioId,
  holdings,
  onChanged,
  readOnly = false,
}: Props) {
  const tokens = useDesignTokens();
  const [trades, setTrades] = useState<DerivedTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [closingTrade, setClosingTrade] = useState<DerivedTrade | null>(null);
  const [exitPriceText, setExitPriceText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sheetContentHeight, setSheetContentHeight] = useState(0);

  /**
   * snap-point דינמי לפי גובה תוכן השיט.
   * מודדים את תוכן השיט ב-onLayout, ומחשבים אחוז מהמסך
   * (כולל handle + safe-area-bottom + מעט מרווח).
   */
  const sheetSnapPoints = useMemo<[number]>(() => {
    const screenH = Dimensions.get('window').height;
    if (sheetContentHeight <= 0) return [0.55];
    // 88px handle/drag area + ~60px safe-area+padding תחתון
    const totalH = sheetContentHeight + 88 + 60;
    const fraction = totalH / screenH;
    return [Math.min(0.9, Math.max(0.3, fraction))];
  }, [sheetContentHeight]);

  const handleSheetContentLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setSheetContentHeight((prev) => (Math.abs(prev - h) > 2 ? h : prev));
  }, []);

  const priceMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const h of holdings) {
      if (h.last_price && h.symbol) m[h.symbol] = h.last_price;
    }
    return m;
  }, [holdings]);

  const load = useCallback(async () => {
    try {
      const data = await loadDerivedTrades(portfolioId, priceMap);
      setTrades(data.filter((t) => t.is_open));
    } catch (err) {
      console.error('loadDerivedTrades:', err);
    } finally {
      setLoading(false);
    }
  }, [portfolioId, priceMap]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCloseModal = useCallback(
    (trade: DerivedTrade) => {
      const guess = priceMap[trade.symbol];
      setExitPriceText(guess ? guess.toFixed(2) : '');
      setClosingTrade(trade);
    },
    [priceMap]
  );

  const handleConfirmClose = useCallback(async () => {
    if (!closingTrade) return;
    const px = parseFloat(exitPriceText);
    if (!px || px <= 0) {
      Alert.alert('שגיאה', 'מחיר יציאה לא תקין');
      return;
    }
    try {
      setBusy(true);
      await quickCloseTrade(closingTrade, px);
      setClosingTrade(null);
      setExitPriceText('');
      await load();
      onChanged?.();
    } catch (err: any) {
      console.error('quickCloseTrade:', err);
      const msg =
        err?.message === 'not_owner'
          ? 'אינך הבעלים של התיק — לא ניתן לסגור פוזיציה'
          : 'סגירת הטרייד נכשלה';
      Alert.alert('שגיאה', msg);
    } finally {
      setBusy(false);
    }
  }, [closingTrade, exitPriceText, load, onChanged]);

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
        sheetBody: {
          paddingHorizontal: 22,
          paddingTop: 6,
          paddingBottom: 28,
          gap: 18,
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
          gap: 10,
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
        const upnl = t.unrealized_pnl ?? 0;
        const pct =
          t.entry_avg_price > 0
            ? (upnl / (t.entry_avg_price * t.open_quantity)) * 100
            : 0;
        const upnlColor =
          upnl > 0
            ? tokens.colors.primary.main
            : upnl < 0
              ? tokens.colors.text.danger
              : tokens.colors.text.secondary;
        const lastPrice = priceMap[t.symbol];
        const curValue =
          (lastPrice ?? t.entry_avg_price) * t.open_quantity;
        const dayOpened = new Date(t.opened_at).toLocaleDateString('he-IL', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit',
        });
        return (
          <UICard
            key={t.key}
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
                    {t.unrealized_pnl != null
                      ? formatCurrency(upnl, t.currency)
                      : '—'}
                  </Text>
                  <Text style={[styles.pnlPct, { color: upnlColor }]}>
                    {t.unrealized_pnl != null ? formatPercent(pct) : '—'}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>כניסה</Text>
                  <Text style={styles.statValue}>
                    {formatCurrency(t.entry_avg_price, t.currency)}
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
                    {Number.isInteger(t.open_quantity)
                      ? t.open_quantity
                      : t.open_quantity.toFixed(4)}
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
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => {
                    void HapticFeedback.impactLight();
                    openCloseModal(t);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.closeBtnText}>סגור פוזיציה</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </UICard>
        );
      })}

      <BottomSheet
        isOpen={!!closingTrade}
        onClose={() => {
          setClosingTrade(null);
          setSheetContentHeight(0);
        }}
        snapPoints={sheetSnapPoints}
        showHandle
      >
        {closingTrade ? (
          <View style={styles.sheetBody} onLayout={handleSheetContentLayout}>
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
                  סגירת {closingTrade.open_quantity} יח׳ · כניסה{' '}
                  {formatCurrency(
                    closingTrade.entry_avg_price,
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
                  autoFocus
                />
              </View>
              {(() => {
                const px = parseFloat(exitPriceText);
                if (!px || px <= 0) return null;
                const pnl =
                  closingTrade.direction === 'long'
                    ? (px - closingTrade.entry_avg_price) *
                      closingTrade.open_quantity
                    : (closingTrade.entry_avg_price - px) *
                      closingTrade.open_quantity;
                const pnlPct =
                  closingTrade.entry_avg_price > 0
                    ? (pnl /
                        (closingTrade.entry_avg_price *
                          closingTrade.open_quantity)) *
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
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}
