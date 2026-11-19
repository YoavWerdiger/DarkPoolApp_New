import { ROOT_DIR, UI_DIR } from '../../../lib/i18n/direction';
import i18n from '../../../lib/i18n';
import { JournalListSkeleton } from '../../../components/ui/SkeletonLoader';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { ActivityIndicator } from '../../../components/ui/AppSpinner';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { loadTrades } from '../../../services/portfolios/portfolioTradeDerive';
import type { Trade, PortfolioHolding } from '../portfolioTypes';
import PortfolioTradesTable from '../components/PortfolioTradesTable';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import { EmptyState } from '../../../components/ui/EmptyState';
import ExportTradeImage, {
  portfolioTradeToExportable,
  type ExportableTrade,
} from '../../../components/Journal/ExportTradeImage';
import {
  journalPhysicalRightText,
  journalSectionSubtitleStyle,
  journalSectionTitleStyle,
} from '../../Journal/journalLayout';

interface Props {
  portfolioId: string;
  holdings?: PortfolioHolding[];
  /** מפתח שמשתנה בכל פעם שהמסך האב מרענן נתונים — מאלץ טעינה מחדש */
  refreshKey?: number;
  /** משולב בטאב עם טרנזקציות — כשאין טריידים לא מציג מצב ריק משלו (מונע כפילות) */
  hideEmpty?: boolean;
  onHasTradesChange?: (hasTrades: boolean) => void;
}

/** טאב היסטוריה — טריידים סגורים, חיפוש לפי סימבול. */
export default function HistoryTab({ portfolioId, refreshKey, hideEmpty, onHasTradesChange }: Props) {
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

  const filteredTrades = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return trades;
    return trades.filter((t) => t.symbol.toLowerCase().includes(q));
  }, [trades, searchQuery]);

  const layoutStyles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          direction: UI_DIR,
        },
        loading: { paddingVertical: 60, alignItems: 'center' },
        empty: {
          alignItems: 'center',
          paddingVertical: 60,
          gap: 8,
          direction: UI_DIR,
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
        searchRow: { marginBottom: 10 },
        searchCardWrap: { borderRadius: tokens.borderRadius.search, overflow: 'hidden' },
        searchInner: {
          direction: ROOT_DIR,
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
          direction: UI_DIR,
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

  useEffect(() => {
    if (!loading) onHasTradesChange?.(trades.length > 0);
  }, [loading, trades.length, onHasTradesChange]);

  if (loading) {
    return (
      <JournalListSkeleton />
    );
  }

  if (trades.length === 0) {
    if (hideEmpty) return null;
    return (
      <EmptyState
        icon="time-outline"
        title={i18n.t('auto.screens__Portfolios__tabs__HistoryTab.s1')}
        subtitle={i18n.t('auto.screens__Portfolios__tabs__HistoryTab.s2')}
      />
    );
  }

  const hasQuery = searchQuery.trim().length > 0;

  return (
    <View style={layoutStyles.root}>
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
              placeholder={i18n.t('auto.screens__Portfolios__tabs__HistoryTab.s3')}
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
          <Text style={layoutStyles.emptyResultsText}>{i18n.t('auto.screens__Portfolios__tabs__HistoryTab.s4', { v0: searchQuery.trim() })}</Text>
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
