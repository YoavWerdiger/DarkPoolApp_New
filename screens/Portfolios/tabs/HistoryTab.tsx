import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { loadTrades } from '../../../services/portfolios/portfolioTradeDerive';
import type { Trade, PortfolioHolding } from '../portfolioTypes';
import {
  formatCurrency,
  formatPercent,
  formatNumber,
} from '../utils/format';
import { TickerLogo } from '../components/TickerLogo';
import { HapticFeedback } from '../../../utils/hapticFeedback';

interface Props {
  portfolioId: string;
  holdings?: PortfolioHolding[];
  /** מפתח שמשתנה בכל פעם שהמסך האב מרענן נתונים — מאלץ טעינה מחדש */
  refreshKey?: number;
}

function formatQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : formatNumber(qty, 4);
}

function ClosedTradeCard({
  trade: t,
  styles,
}: {
  trade: Trade;
  styles: ReturnType<typeof createCardStyles>;
}) {
  const tokens = useDesignTokens();
  const isLong = t.direction === 'long';
  const pnl = t.profit_loss ?? 0;
  const pnlPositive = pnl > 0;
  const pnlNegative = pnl < 0;
  const pnlColor = pnlPositive
    ? tokens.colors.primary.main
    : pnlNegative
      ? tokens.colors.text.danger
      : tokens.colors.text.secondary;

  const exitStr =
    t.exit_price != null
      ? formatCurrency(t.exit_price, t.currency, 2)
      : '—';
  const entryStr = formatCurrency(t.entry_price, t.currency, 2);
  let subtitle = `${formatQty(t.quantity)} × ${entryStr} → ${exitStr}`;
  if (t.commission > 0) {
    subtitle += ` · עמלות ${formatCurrency(t.commission, t.currency, 2)}`;
  }

  // אחוז P&L
  const pnlPct =
    t.exit_price != null && t.entry_price > 0
      ? isLong
        ? ((t.exit_price - t.entry_price) / t.entry_price) * 100 * t.leverage
        : ((t.entry_price - t.exit_price) / t.entry_price) * 100 * t.leverage
      : null;

  return (
    <UICard
      variant="glass"
      glassIntensity="light"
      padding="none"
      style={styles.cardWrap}
    >
      <View style={styles.row}>
        <TickerLogo symbol={t.symbol} size={36} />
        <View style={styles.rowMain}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {t.symbol}
            <Text style={styles.rowTitleMuted}>
              {' · '}
              {isLong ? 'לונג' : 'שורט'}
            </Text>
          </Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <View style={styles.rowSide}>
          <Text style={[styles.rowAmount, { color: pnlColor }]}>
            {pnlPositive ? '+' : pnlNegative ? '−' : ''}
            {formatCurrency(Math.abs(pnl), t.currency)}
          </Text>
          {pnlPct != null ? (
            <Text style={[styles.rowPct, { color: pnlColor }]}>
              {formatPercent(pnlPct)}
            </Text>
          ) : null}
        </View>
      </View>
    </UICard>
  );
}

function createCardStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    cardWrap: {
      borderRadius: 28,
      marginBottom: 8,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      minHeight: 64,
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 12,
    },
    rowMain: {
      flex: 1,
      justifyContent: 'center',
      minWidth: 0,
    },
    rowTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: tokens.colors.text.primary,
      textAlign: 'right',
      lineHeight: 18,
    },
    rowTitleMuted: {
      fontWeight: '600',
      color: tokens.colors.text.tertiary,
    },
    rowSub: {
      fontSize: 11,
      color: tokens.colors.text.tertiary,
      marginTop: 2,
      lineHeight: 14,
      textAlign: 'right',
      writingDirection: 'ltr',
    },
    rowSide: {
      justifyContent: 'center',
      alignItems: 'flex-start',
      flexShrink: 0,
    },
    rowAmount: {
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 16,
      textAlign: 'left',
      writingDirection: 'ltr',
    },
    rowPct: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
      lineHeight: 14,
      textAlign: 'left',
      writingDirection: 'ltr',
    },
  });
}


/** טאב היסטוריה — טריידים סגורים, חיפוש לפי סימבול. */
export default function HistoryTab({ portfolioId, refreshKey }: Props) {
  const tokens = useDesignTokens();
  const cardStyles = useMemo(() => createCardStyles(tokens), [tokens]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await loadTrades(portfolioId, 'CLOSED');
      const sorted = [...data].sort(
        (a, b) =>
          new Date(b.exit_date!).getTime() -
          new Date(a.exit_date!).getTime()
      );
      setTrades(sorted);
    } catch (err) {
      console.error('history loadTrades:', err);
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    void load();
  }, [load]);

  // רענון כשהמסך האב מעדכן נתונים (למשל אחרי סגירת פוזיציה)
  const refreshKeyRef = useRef(false);
  useEffect(() => {
    if (!refreshKeyRef.current) {
      refreshKeyRef.current = true;
      return;
    }
    void load();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPnl = useMemo(
    () => trades.reduce((s, t) => s + (t.profit_loss ?? 0), 0),
    [trades]
  );

  const filteredTrades = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return trades;
    return trades.filter((t) => t.symbol.toLowerCase().includes(q));
  }, [trades, searchQuery]);

  const layoutStyles = useMemo(
    () =>
      StyleSheet.create({
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
        searchRow: { marginBottom: 8 },
        searchCardWrap: { borderRadius: 20, overflow: 'hidden' },
        searchInner: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingHorizontal: 12,
          minHeight: 40,
        },
        searchTextInput: {
          flex: 1,
          marginHorizontal: 8,
          color: tokens.colors.text.primary,
          fontSize: 14,
          textAlign: 'right',
          writingDirection: 'rtl',
          paddingVertical: 4,
        },
        emptyResults: {
          alignItems: 'center',
          paddingTop: 28,
          paddingHorizontal: 20,
        },
        emptyResultsText: {
          fontSize: 13,
          color: tokens.colors.text.tertiary,
          textAlign: 'center',
          marginTop: 8,
        },
      }),
    [tokens]
  );

  if (loading) {
    return (
      <View style={layoutStyles.loading}>
        <ActivityIndicator color={tokens.colors.primary.main} />
      </View>
    );
  }

  if (trades.length === 0) {
    return (
      <View style={layoutStyles.empty}>
        <Ionicons
          name="time-outline"
          size={42}
          color={tokens.colors.text.tertiary}
        />
        <Text style={layoutStyles.emptyTitle}>אין טריידים סגורים עדיין</Text>
        <Text style={layoutStyles.emptyText}>
          כשתסגור פוזיציות (קנייה+מכירה / שורט+כיסוי) הן יופיעו כאן עם תוצאה מומשת.
        </Text>
      </View>
    );
  }

  const hasQuery = searchQuery.trim().length > 0;
  const pnlPositive = totalPnl > 0;
  const pnlNegative = totalPnl < 0;

  return (
    <View>
      {/* סיכום P&L כולל */}
      {trades.length > 0 && (
        <UICard variant="glass" glassIntensity="light" padding="none" style={{ borderRadius: 20, marginBottom: 12, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: tokens.colors.text.tertiary, textAlign: 'right' }}>
              סך P&L ממומש ({trades.length} עסקאות)
            </Text>
            <Text style={{
              fontSize: 16,
              fontWeight: '800',
              writingDirection: 'ltr',
              color: pnlPositive
                ? tokens.colors.primary.main
                : pnlNegative
                  ? tokens.colors.text.danger
                  : tokens.colors.text.secondary,
            }}>
              {pnlPositive ? '+' : pnlNegative ? '−' : ''}
              {formatCurrency(Math.abs(totalPnl), 'USD')}
            </Text>
          </View>
        </UICard>
      )}

      <View style={layoutStyles.searchRow}>
        <UICard
          variant="glass"
          glassIntensity="light"
          padding="none"
          style={layoutStyles.searchCardWrap}
        >
          <View style={layoutStyles.searchInner}>
            {hasQuery ? (
              <TouchableOpacity
                onPress={() => {
                  void HapticFeedback.selection();
                  setSearchQuery('');
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={tokens.colors.text.tertiary}
                />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 20 }} />
            )}
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="חיפוש לפי סימבול..."
              placeholderTextColor={tokens.colors.text.tertiary}
              style={layoutStyles.searchTextInput}
              returnKeyType="search"
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Ionicons
              name="search"
              size={18}
              color={tokens.colors.text.tertiary}
            />
          </View>
        </UICard>
      </View>

      {filteredTrades.length === 0 ? (
        <View style={layoutStyles.emptyResults}>
          <Ionicons
            name="search-outline"
            size={36}
            color={tokens.colors.text.tertiary}
          />
          <Text style={layoutStyles.emptyResultsText}>
            לא נמצאו טריידים עבור "{searchQuery.trim()}"
          </Text>
        </View>
      ) : (
        filteredTrades.map((t) => (
          <ClosedTradeCard key={t.id} trade={t} styles={cardStyles} />
        ))
      )}
    </View>
  );
}
