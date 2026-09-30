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
import { formatCurrency } from '../utils/format';
import PortfolioTradesTable from '../components/PortfolioTradesTable';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import ExportTradeImage, {
  portfolioTradeToExportable,
  type ExportableTrade,
} from '../../../components/Journal/ExportTradeImage';
import {
  JOURNAL_LAYOUT,
  journalBodyTextStyle,
  journalCardMetricValueSecondaryStyle,
  journalPhysicalRightText,
  journalSectionSubtitleStyle,
  journalSectionTitleStyle,
} from '../../Journal/journalLayout';

interface Props {
  portfolioId: string;
  holdings?: PortfolioHolding[];
  /** מפתח שמשתנה בכל פעם שהמסך האב מרענן נתונים — מאלץ טעינה מחדש */
  refreshKey?: number;
}

/** טאב היסטוריה — טריידים סגורים, חיפוש לפי סימבול. */
export default function HistoryTab({ portfolioId, refreshKey }: Props) {
  const tokens = useDesignTokens();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [exportTrade, setExportTrade] = useState<ExportableTrade | null>(null);

  const openShareImage = useCallback((trade: Trade) => {
    const mapped = portfolioTradeToExportable(trade);
    if (!mapped) return;
    setExportTrade(mapped);
  }, []);

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
        root: {
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
          textAlign: 'center',
        },
        emptyText: {
          ...journalSectionSubtitleStyle,
          color: tokens.colors.text.tertiary,
          textAlign: 'center',
          paddingHorizontal: 30,
        },
        summaryCard: {
          marginBottom: JOURNAL_LAYOUT.cardStackGap,
          overflow: 'hidden',
        },
        summaryInner: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 10,
          paddingHorizontal: 16,
          paddingVertical: 14,
          width: '100%',
        },
        summaryLabel: {
          fontSize: 13,
          fontWeight: '600',
          color: tokens.colors.text.tertiary,
          ...journalPhysicalRightText,
        },
        summaryValue: {
          ...journalCardMetricValueSecondaryStyle,
          textAlign: 'right',
        },
        searchRow: { marginBottom: 10 },
        searchCardWrap: { borderRadius: tokens.borderRadius.search, overflow: 'hidden' },
        searchInner: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          minHeight: 40,
        },
        searchTextInput: {
          flex: 1,
          marginHorizontal: 8,
          color: tokens.colors.text.primary,
          ...journalPhysicalRightText,
          fontSize: 15,
          fontWeight: '400',
          lineHeight: 22,
          paddingVertical: 4,
        },
        emptyResults: {
          alignItems: 'center',
          paddingTop: 28,
          paddingHorizontal: 20,
          direction: 'rtl',
        },
        emptyResultsText: {
          ...journalSectionSubtitleStyle,
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
    <View style={layoutStyles.root}>
      {trades.length > 0 && (
        <UICard
          variant="soft"
          glassIntensity="light"
          padding="none"
          style={layoutStyles.summaryCard}
        >
          <View style={layoutStyles.summaryInner}>
            <Text style={layoutStyles.summaryLabel}>
              סך P&L ממומש ({trades.length} עסקאות)
            </Text>
            <Text
              style={[
                layoutStyles.summaryValue,
                {
                  color: pnlPositive
                    ? tokens.colors.primary.main
                    : pnlNegative
                      ? tokens.colors.text.danger
                      : tokens.colors.text.secondary,
                },
              ]}
            >
              {pnlPositive ? '+' : pnlNegative ? '−' : ''}
              {formatCurrency(Math.abs(totalPnl), 'USD')}
            </Text>
          </View>
        </UICard>
      )}

      <View style={layoutStyles.searchRow}>
        <UICard
          variant="soft"
          glassIntensity="light"
          padding="none"
          style={layoutStyles.searchCardWrap}
        >
          <View style={layoutStyles.searchInner}>
            <Ionicons
              name="search"
              size={18}
              color={tokens.colors.text.tertiary}
            />
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
        <PortfolioTradesTable
          mode="closed"
          trades={filteredTrades}
          onShare={openShareImage}
        />
      )}

      <ExportTradeImage
        trade={exportTrade}
        visible={!!exportTrade}
        onClose={() => setExportTrade(null)}
      />
    </View>
  );
}
