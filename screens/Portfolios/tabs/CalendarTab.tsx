import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { loadDerivedTrades } from '../../../services/portfolios/portfolioTradeDerive';
import type { DerivedTrade } from '../portfolioTypes';
import { formatCurrency } from '../utils/format';
import { HapticFeedback } from '../../../utils/hapticFeedback';

interface Props {
  portfolioId: string;
  currency: string;
}

const HEB_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

const HEB_DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

const TINT_ALPHA = '65';

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CalendarTab({ portfolioId, currency }: Props) {
  const tokens = useDesignTokens();
  const { width: windowWidth } = useWindowDimensions();
  const [trades, setTrades] = useState<DerivedTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<{ y: number; m: number }>(() => {
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await loadDerivedTrades(portfolioId);
        setTrades(data.filter((t) => !t.is_open && t.closed_at));
      } catch (err) {
        console.error('loadDerivedTrades calendar:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [portfolioId]);

  /** מפת yyyy-mm-dd → סיכום יומי */
  const dailyPnl = useMemo(() => {
    const map = new Map<string, { pnl: number; count: number }>();
    for (const t of trades) {
      if (!t.closed_at) continue;
      const key = ymd(new Date(t.closed_at));
      const cur = map.get(key) ?? { pnl: 0, count: 0 };
      cur.pnl += t.realized_pnl;
      cur.count += 1;
      map.set(key, cur);
    }
    return map;
  }, [trades]);

  const monthlyTotal = useMemo(() => {
    let sum = 0;
    let count = 0;
    let wins = 0;
    let losses = 0;
    for (const [key, v] of dailyPnl) {
      const [y, m] = key.split('-').map(Number);
      if (y === cursor.y && m - 1 === cursor.m) {
        sum += v.pnl;
        count += v.count;
        if (v.pnl > 0) wins += 1;
        else if (v.pnl < 0) losses += 1;
      }
    }
    return { sum, tradeCount: count, winDays: wins, lossDays: losses };
  }, [dailyPnl, cursor]);

  const grid = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const cells: Array<{ day: number; key: string } | null> = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(cursor.y, cursor.m, d);
      cells.push({ day: d, key: ymd(date) });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const gridLayout = useMemo(() => {
    /** PortfolioDetailScreen מוסיף paddingHorizontal: 16 על כל הטאב; הכרטיסיה מוסיפה padding נוסף */
    const screenPad = 16;
    const cardPad = 14;
    const inner = windowWidth - screenPad * 2 - cardPad * 2;
    const cellGap = 4;
    const dayWidth = Math.floor((inner - cellGap * 6) / 7);
    return { cellGap, dayWidth };
  }, [windowWidth]);

  const goPrev = useCallback(() => {
    setCursor((c) => {
      const m = c.m - 1;
      return m < 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m };
    });
    setSelectedDay(null);
  }, []);
  const goNext = useCallback(() => {
    setCursor((c) => {
      const m = c.m + 1;
      return m > 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m };
    });
    setSelectedDay(null);
  }, []);

  const selectedDayTrades = useMemo(() => {
    if (!selectedDay) return [];
    return trades
      .filter((t) => t.closed_at && ymd(new Date(t.closed_at)) === selectedDay)
      .sort(
        (a, b) =>
          new Date(b.closed_at!).getTime() - new Date(a.closed_at!).getTime()
      );
  }, [selectedDay, trades]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, paddingTop: 4 },
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
        navRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        },
        navBtn: {
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.06)',
        },
        monthTitle: {
          fontSize: 16,
          fontWeight: '800',
          color: tokens.colors.text.primary,
        },
        mainCard: {
          borderRadius: 20,
          overflow: 'hidden',
          marginBottom: 12,
        },
        cardPadding: {
          padding: 14,
        },
        divider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: tokens.colors.border.subtle,
          marginVertical: 12,
        },
        summaryRow: {
          flexDirection: 'row-reverse',
          gap: 6,
        },
        summaryCell: {
          flex: 1,
          alignItems: 'center',
          gap: 3,
        },
        summaryLabel: {
          fontSize: 10,
          fontWeight: '600',
          color: tokens.colors.text.tertiary,
        },
        summaryValue: {
          fontSize: 13,
          fontWeight: '800',
          color: tokens.colors.text.primary,
          writingDirection: 'ltr',
        },
        dayHeaderRow: {
          flexDirection: 'row',
          marginBottom: 4,
        },
        dayHeaderCell: {
          alignItems: 'center',
          justifyContent: 'center',
        },
        dayHeaderText: {
          fontSize: 10,
          fontWeight: '700',
          color: tokens.colors.text.tertiary,
        },
        gridRow: {
          flexDirection: 'row',
        },
        cell: {
          aspectRatio: 1,
          borderRadius: 7,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 3,
        },
        cellEmpty: {
          backgroundColor: 'transparent',
        },
        cellDefault: {
          backgroundColor: 'rgba(255,255,255,0.04)',
        },
        cellSelected: {
          borderWidth: 2,
          borderColor: tokens.colors.text.primary,
        },
        cellDay: {
          fontSize: 11,
          fontWeight: '700',
          color: tokens.colors.text.primary,
        },
        cellPnl: {
          fontSize: 8,
          fontWeight: '800',
          marginTop: 1,
          writingDirection: 'ltr',
        },
        selectedHeader: {
          marginTop: 18,
          flexDirection: 'row-reverse',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        },
        selectedTitle: {
          fontSize: 15,
          fontWeight: '800',
          color: tokens.colors.text.primary,
        },
        selectedSub: {
          fontSize: 12,
          fontWeight: '600',
          writingDirection: 'ltr',
        },
        tradeRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 14,
          backgroundColor: 'rgba(255,255,255,0.04)',
          marginTop: 8,
          gap: 10,
        },
        tradeSymbol: {
          fontSize: 14,
          fontWeight: '800',
          color: tokens.colors.text.primary,
          flex: 1,
          textAlign: 'right',
        },
        tradeDirPill: {
          paddingHorizontal: 7,
          paddingVertical: 2,
          borderRadius: 8,
          borderWidth: 1,
        },
        tradeDirText: {
          fontSize: 10,
          fontWeight: '700',
        },
        tradePnl: {
          fontSize: 13,
          fontWeight: '800',
          writingDirection: 'ltr',
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
          name="calendar-outline"
          size={42}
          color={tokens.colors.text.tertiary}
        />
        <Text style={styles.emptyTitle}>אין עדיין טריידים סגורים</Text>
        <Text style={styles.emptyText}>
          ברגע שתסגור פוזיציות, ה-P&L היומי שלהן יופיע כאן בלוח השנה.
        </Text>
      </View>
    );
  }

  const monthName = `${HEB_MONTHS[cursor.m]} ${cursor.y}`;
  const totalColor =
    monthlyTotal.sum > 0
      ? tokens.colors.primary.main
      : monthlyTotal.sum < 0
        ? tokens.colors.text.danger
        : tokens.colors.text.secondary;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.root}>
      <UICard
        variant="glass"
        glassIntensity="light"
        padding="none"
        style={styles.mainCard}
      >
        <View style={styles.cardPadding}>
          <View style={styles.navRow}>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => {
                void HapticFeedback.impactLight();
                goPrev();
              }}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={tokens.colors.text.primary}
              />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{monthName}</Text>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => {
                void HapticFeedback.impactLight();
                goNext();
              }}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={tokens.colors.text.primary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>סה״כ</Text>
              <Text
                style={[styles.summaryValue, { color: totalColor }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {formatCurrency(monthlyTotal.sum, currency)}
              </Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>טריידים</Text>
              <Text style={styles.summaryValue}>{monthlyTotal.tradeCount}</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>ירוקים</Text>
              <Text
                style={[
                  styles.summaryValue,
                  { color: tokens.colors.primary.main },
                ]}
              >
                {monthlyTotal.winDays}
              </Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>אדומים</Text>
              <Text
                style={[
                  styles.summaryValue,
                  { color: tokens.colors.text.danger },
                ]}
              >
                {monthlyTotal.lossDays}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.dayHeaderRow}>
            {HEB_DAYS.map((d, i) => (
              <View
                key={i}
                style={[
                  styles.dayHeaderCell,
                  {
                    width: gridLayout.dayWidth,
                    marginLeft: i === 0 ? 0 : gridLayout.cellGap,
                  },
                ]}
              >
                <Text style={styles.dayHeaderText}>{d}</Text>
              </View>
            ))}
          </View>

          {Array.from({ length: Math.ceil(grid.length / 7) }).map((_, rowIdx) => (
            <View
              key={rowIdx}
              style={[styles.gridRow, { marginBottom: gridLayout.cellGap }]}
            >
              {grid.slice(rowIdx * 7, rowIdx * 7 + 7).map((cell, colIdx) => {
                if (!cell) {
                  return (
                    <View
                      key={colIdx}
                      style={[
                        styles.cell,
                        styles.cellEmpty,
                        {
                          width: gridLayout.dayWidth,
                          marginLeft: colIdx === 0 ? 0 : gridLayout.cellGap,
                        },
                      ]}
                    />
                  );
                }
                const data = dailyPnl.get(cell.key);
                const pnl = data?.pnl ?? 0;
                const bg =
                  data == null
                    ? 'rgba(255,255,255,0.04)'
                    : pnl > 0
                      ? `${tokens.colors.primary.main}${TINT_ALPHA}`
                      : pnl < 0
                        ? `${tokens.colors.text.danger}${TINT_ALPHA}`
                        : 'rgba(255,255,255,0.06)';
                const isSelected = selectedDay === cell.key;
                return (
                  <TouchableOpacity
                    key={colIdx}
                    onPress={() => {
                      void HapticFeedback.selection();
                      setSelectedDay(isSelected ? null : cell.key);
                    }}
                    activeOpacity={0.7}
                    style={[
                      styles.cell,
                      {
                        width: gridLayout.dayWidth,
                        marginLeft: colIdx === 0 ? 0 : gridLayout.cellGap,
                        backgroundColor: bg,
                      },
                      isSelected && styles.cellSelected,
                    ]}
                  >
                    <Text style={styles.cellDay}>{cell.day}</Text>
                    {data ? (
                      <Text
                        style={[
                          styles.cellPnl,
                          {
                            color:
                              pnl > 0
                                ? tokens.colors.primary.main
                                : pnl < 0
                                  ? tokens.colors.text.danger
                                  : tokens.colors.text.tertiary,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {Math.abs(pnl) >= 1000
                          ? `${pnl > 0 ? '+' : ''}${(pnl / 1000).toFixed(1)}k`
                          : `${pnl > 0 ? '+' : ''}${pnl.toFixed(0)}`}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </UICard>

      {selectedDay && selectedDayTrades.length > 0 ? (
        <View>
          <View style={styles.selectedHeader}>
            <Text style={styles.selectedTitle}>
              {new Date(selectedDay).toLocaleDateString('he-IL', {
                day: '2-digit',
                month: 'long',
              })}
            </Text>
            <Text
              style={[
                styles.selectedSub,
                {
                  color:
                    (dailyPnl.get(selectedDay)?.pnl ?? 0) >= 0
                      ? tokens.colors.primary.main
                      : tokens.colors.text.danger,
                },
              ]}
            >
              {formatCurrency(dailyPnl.get(selectedDay)?.pnl ?? 0, currency)}
            </Text>
          </View>
          {selectedDayTrades.map((t) => {
            const isLong = t.direction === 'long';
            const accent = isLong
              ? tokens.colors.primary.main
              : tokens.colors.text.danger;
            const pnlColor =
              t.realized_pnl > 0
                ? tokens.colors.primary.main
                : t.realized_pnl < 0
                  ? tokens.colors.text.danger
                  : tokens.colors.text.secondary;
            return (
              <View key={t.key} style={styles.tradeRow}>
                <Text style={styles.tradeSymbol}>{t.symbol}</Text>
                <View
                  style={[
                    styles.tradeDirPill,
                    {
                      borderColor: `${accent}66`,
                      backgroundColor: `${accent}1F`,
                    },
                  ]}
                >
                  <Text style={[styles.tradeDirText, { color: accent }]}>
                    {isLong ? 'לונג' : 'שורט'}
                  </Text>
                </View>
                <Text style={[styles.tradePnl, { color: pnlColor }]}>
                  {formatCurrency(t.realized_pnl, t.currency)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}
