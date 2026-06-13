import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import UICard from '../../../components/ui/UICard';
import type {
  Portfolio,
  PortfolioHolding,
  HoldingsViewMode,
  HoldingsGroupBy,
} from '../portfolioTypes';
import {
  HOLDINGS_VIEW_MODES,
  ASSET_TYPE_LABELS,
} from '../portfolioConstants';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  gainColor,
  formatCompactNumber,
} from '../utils/format';
import { TickerLogo } from '../components/TickerLogo';
import { HapticFeedback } from '../../../utils/hapticFeedback';

interface Props {
  portfolio: Portfolio;
  holdings: PortfolioHolding[];
}

const GROUP_BY_OPTIONS: { id: HoldingsGroupBy; label: string }[] = [
  { id: 'none', label: 'ללא קיבוץ' },
  { id: 'asset_type', label: 'סוג נכס' },
  { id: 'currency', label: 'מטבע' },
  { id: 'exchange', label: 'בורסה' },
];

export default function HoldingsTab({ portfolio, holdings }: Props) {
  const tokens = useDesignTokens();
  const [viewMode, setViewMode] = useState<HoldingsViewMode>('position');
  const [groupBy, setGroupBy] = useState<HoldingsGroupBy>('none');
  const [showSold, setShowSold] = useState(false);
  const tableScrollRef = useRef<ScrollView | null>(null);

  const filteredHoldings = useMemo(() => {
    return showSold ? holdings : holdings.filter((h) => !h.is_closed);
  }, [holdings, showSold]);

  const grouped = useMemo(() => {
    if (groupBy === 'none')
      return [{ key: 'all', label: 'כל הנכסים', items: filteredHoldings }];
    const map = new Map<string, PortfolioHolding[]>();
    for (const h of filteredHoldings) {
      let key: string;
      switch (groupBy) {
        case 'asset_type':
          key = h.asset_type ? ASSET_TYPE_LABELS[h.asset_type] : 'לא ידוע';
          break;
        case 'currency':
          key = 'USD';
          break;
        case 'exchange':
          key = h.exchange ?? 'NASDAQ';
          break;
        default:
          key = 'all';
      }
      const arr = map.get(key) ?? [];
      arr.push(h);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      label: key,
      items,
    }));
  }, [filteredHoldings, groupBy]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        modeRow: {
          flexDirection: 'row-reverse',
          gap: 6,
          marginBottom: 12,
          flexWrap: 'wrap',
        },
        modeChip: {
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
        },
        modeChipActive: {
          borderColor: tokens.colors.primary.main,
          backgroundColor: 'rgba(0, 200, 5, 0.10)',
        },
        modeChipText: {
          fontSize: 12,
          color: tokens.colors.text.secondary,
        },
        modeChipTextActive: {
          color: tokens.colors.primary.main,
          fontWeight: '700',
        },
        controlsRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        },
        controlBtn: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 5,
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 14,
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
        },
        controlBtnText: {
          fontSize: 12,
          color: tokens.colors.text.primary,
          fontWeight: '500',
        },
        groupHeader: {
          fontSize: 12,
          fontWeight: '700',
          color: tokens.colors.text.tertiary,
          marginTop: 12,
          marginBottom: 6,
          paddingHorizontal: 4,
          textAlign: 'right',
        },
        tableHeader: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingVertical: 8,
          paddingHorizontal: 8,
          gap: 8,
        },
        tableHeaderText: {
          fontSize: 10,
          fontWeight: '700',
          color: tokens.colors.text.tertiary,
        },
        row: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingVertical: 12,
          paddingHorizontal: 8,
          borderTopWidth: 1,
          borderTopColor: tokens.colors.border.subtle,
          gap: 8,
        },
        symbolCol: {
          width: 96,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 8,
        },
        symbolTextWrap: {
          flex: 1,
        },
        symbolText: {
          fontSize: 13,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          textAlign: 'right',
        },
        symbolMeta: {
          fontSize: 10,
          color: tokens.colors.text.tertiary,
          textAlign: 'right',
          marginTop: 2,
        },
        cellWrap: {
          flex: 1,
          alignItems: 'center',
        },
        cellPrimary: {
          fontSize: 12,
          fontWeight: '600',
          color: tokens.colors.text.primary,
          textAlign: 'center',
        },
        cellSecondary: {
          fontSize: 10,
          color: tokens.colors.text.tertiary,
          marginTop: 2,
          textAlign: 'center',
        },
        emptyState: {
          alignItems: 'center',
          paddingVertical: 50,
        },
        emptyTitle: {
          fontSize: 16,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          marginTop: 12,
          marginBottom: 4,
        },
        emptyText: {
          fontSize: 13,
          color: tokens.colors.text.tertiary,
          textAlign: 'center',
          paddingHorizontal: 20,
          lineHeight: 18,
        },
        scrollHint: {
          fontSize: 11,
          color: tokens.colors.text.tertiary,
          textAlign: 'center',
          marginTop: 6,
        },
      }),
    [tokens]
  );

  if (filteredHoldings.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons
          name="layers-outline"
          size={42}
          color={tokens.colors.text.tertiary}
        />
        <Text style={styles.emptyTitle}>אין נכסים</Text>
        <Text style={styles.emptyText}>
          הוסף עסקת קנייה ראשונה כדי לראות את הנכסים שלך.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {/* Mode selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.modeRow}
      >
        {HOLDINGS_VIEW_MODES.map((m) => {
          const active = viewMode === m.id;
          return (
            <TouchableOpacity
              key={m.id}
              onPress={() => {
                if (!active) void HapticFeedback.selection();
                setViewMode(m.id);
              }}
              style={[styles.modeChip, active && styles.modeChipActive]}
            >
              <Text
                style={[
                  styles.modeChipText,
                  active && styles.modeChipTextActive,
                ]}
              >
                {m.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Controls */}
      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => {
            void HapticFeedback.selection();
            const next = (
              ['none', 'asset_type', 'currency', 'exchange'] as HoldingsGroupBy[]
            ).indexOf(groupBy);
            const opts: HoldingsGroupBy[] = ['none', 'asset_type', 'currency', 'exchange'];
            setGroupBy(opts[(next + 1) % opts.length]);
          }}
        >
          <Ionicons name="layers-outline" size={14} color={tokens.colors.text.primary} />
          <Text style={styles.controlBtnText}>
            {GROUP_BY_OPTIONS.find((g) => g.id === groupBy)?.label}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => {
            void HapticFeedback.selection();
            setShowSold((v) => !v);
          }}
        >
          <Ionicons
            name={showSold ? 'eye' : 'eye-off-outline'}
            size={14}
            color={tokens.colors.text.primary}
          />
          <Text style={styles.controlBtnText}>
            {showSold ? 'מציג סגורות' : 'מסתיר סגורות'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={tableScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => {
          tableScrollRef.current?.scrollToEnd({ animated: false });
        }}
      >
        <View>
          {grouped.map((group) => (
            <View key={group.key}>
              {groupBy !== 'none' && (
                <Text style={styles.groupHeader}>{group.label}</Text>
              )}
              <UICard
                variant="glass"
                glassIntensity="light"
                padding="none"
                style={{ marginBottom: 12, borderRadius: 14, overflow: 'hidden' }}
              >
                <HoldingsTableHeader viewMode={viewMode} styles={styles} />
                {group.items.map((h) => (
                  <HoldingRow
                    key={h.symbol}
                    holding={h}
                    viewMode={viewMode}
                    currency={portfolio.currency}
                    styles={styles}
                    tokens={tokens}
                  />
                ))}
              </UICard>
            </View>
          ))}
        </View>
      </ScrollView>
      <Text style={styles.scrollHint}>← גלילה שמאלה להצגת עמודות נוספות</Text>
    </View>
  );
}

interface HeaderProps {
  viewMode: HoldingsViewMode;
  styles: ReturnType<typeof StyleSheet.create>;
}

function HoldingsTableHeader({ viewMode, styles }: HeaderProps) {
  const headers = getColumnsForMode(viewMode).map((c) => c.label);
  return (
    <View style={styles.tableHeader}>
      <View style={styles.symbolCol}>
        <Text style={styles.tableHeaderText}>סימבול</Text>
      </View>
      {headers.map((h) => (
        <View key={h} style={[styles.cellWrap, { minWidth: 80 }]}>
          <Text style={styles.tableHeaderText}>{h}</Text>
        </View>
      ))}
    </View>
  );
}

interface RowProps {
  holding: PortfolioHolding;
  viewMode: HoldingsViewMode;
  currency: string;
  styles: ReturnType<typeof StyleSheet.create>;
  tokens: ReturnType<typeof useDesignTokens>;
}

function HoldingRow({ holding, viewMode, currency, styles, tokens }: RowProps) {
  const cells = getCellsForMode(viewMode, holding, currency, tokens);
  return (
    <View style={styles.row}>
      <View style={styles.symbolCol}>
        <TickerLogo symbol={holding.symbol} size={28} />
        <View style={styles.symbolTextWrap}>
          <Text style={styles.symbolText}>{holding.symbol}</Text>
          <Text style={styles.symbolMeta} numberOfLines={1}>
            {formatNumber(holding.quantity, 4)} יח׳ · ממוצע{' '}
            {formatCurrency(holding.avg_price, currency, 2)}
          </Text>
        </View>
      </View>
      {cells.map((c, idx) => (
        <View key={idx} style={[styles.cellWrap, { minWidth: 80 }]}>
          <Text style={[styles.cellPrimary, c.color ? { color: c.color } : null]}>
            {c.primary}
          </Text>
          {c.secondary ? (
            <Text style={[styles.cellSecondary, c.color ? { color: c.color } : null]}>
              {c.secondary}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function getColumnsForMode(mode: HoldingsViewMode): { label: string }[] {
  switch (mode) {
    case 'position':
      return [
        { label: 'מחיר שוק' },
        { label: 'הקצאה' },
        { label: 'שווי' },
        { label: 'הושקע' },
        { label: 'לא ממומש' },
        { label: 'יומי' },
        { label: 'תשואה שנתית' },
      ];
    case 'price':
      return [
        { label: 'מחיר שוק' },
        { label: 'שינוי' },
        { label: 'שינוי %' },
      ];
    case 'financials':
      return [
        { label: 'מחיר שוק' },
        { label: 'מחיר ממוצע' },
        { label: 'דיבידנד' },
        { label: 'רווח כולל' },
      ];
    case 'performance':
      return [
        { label: 'מחיר שוק' },
        { label: 'רווח כולל' },
        { label: 'רווח %' },
        { label: 'תשואה שנתית' },
      ];
    case 'risk':
      return [
        { label: 'מחיר שוק' },
        { label: 'הקצאה' },
        { label: 'שווי' },
        { label: 'יומי %' },
      ];
    case 'technicals':
      return [
        { label: 'מחיר שוק' },
        { label: 'שינוי %' },
        { label: 'הקצאה' },
      ];
  }
}

interface Cell {
  primary: string;
  secondary?: string;
  color?: string;
}

function getCellsForMode(
  mode: HoldingsViewMode,
  h: PortfolioHolding,
  currency: string,
  tokens: ReturnType<typeof useDesignTokens>
): Cell[] {
  const positive = tokens.colors.primary.main;
  const negative = tokens.colors.text.danger;
  const neutral = tokens.colors.text.primary;
  switch (mode) {
    case 'position':
      return [
        {
          primary: formatCurrency(h.last_price, currency, 2),
          secondary:
            h.previous_close != null
              ? formatPercent(h.daily_gain_pct)
              : undefined,
          color: gainColor(h.daily_gain_pct, positive, negative, neutral),
        },
        { primary: formatPercent(h.allocation, 1, false) },
        { primary: formatCurrency(h.value, currency) },
        { primary: formatCurrency(h.invested, currency) },
        {
          primary: formatCurrency(h.unrealized_gain, currency),
          secondary: formatPercent(h.unrealized_gain_pct),
          color: gainColor(h.unrealized_gain, positive, negative, neutral),
        },
        {
          primary: formatCurrency(h.daily_gain, currency),
          secondary: formatPercent(h.daily_gain_pct),
          color: gainColor(h.daily_gain, positive, negative, neutral),
        },
        {
          primary: formatPercent(h.annualized_yield),
          color: gainColor(h.annualized_yield, positive, negative, neutral),
        },
      ];
    case 'price':
      return [
        { primary: formatCurrency(h.last_price, currency, 2) },
        {
          primary:
            h.previous_close != null
              ? formatCurrency(h.last_price - h.previous_close, currency, 2)
              : '—',
          color: gainColor(
            h.previous_close != null ? h.last_price - h.previous_close : null,
            positive,
            negative,
            neutral
          ),
        },
        {
          primary: formatPercent(h.daily_gain_pct),
          color: gainColor(h.daily_gain_pct, positive, negative, neutral),
        },
      ];
    case 'financials':
      return [
        {
          primary: formatCurrency(h.last_price, currency, 2),
          secondary:
            h.previous_close != null
              ? formatPercent(h.daily_gain_pct)
              : undefined,
          color: gainColor(h.daily_gain_pct, positive, negative, neutral),
        },
        { primary: formatCurrency(h.avg_price, currency, 2) },
        { primary: formatCurrency(h.total_dividends, currency) },
        {
          primary: formatCurrency(h.total_gain, currency),
          color: gainColor(h.total_gain, positive, negative, neutral),
        },
      ];
    case 'performance':
      return [
        {
          primary: formatCurrency(h.last_price, currency, 2),
          secondary:
            h.previous_close != null
              ? formatPercent(h.daily_gain_pct)
              : undefined,
          color: gainColor(h.daily_gain_pct, positive, negative, neutral),
        },
        {
          primary: formatCurrency(h.total_gain, currency),
          color: gainColor(h.total_gain, positive, negative, neutral),
        },
        {
          primary: formatPercent(h.total_gain_pct),
          color: gainColor(h.total_gain, positive, negative, neutral),
        },
        {
          primary: formatPercent(h.annualized_yield),
          color: gainColor(h.annualized_yield, positive, negative, neutral),
        },
      ];
    case 'risk':
      return [
        { primary: formatCurrency(h.last_price, currency, 2) },
        { primary: formatPercent(h.allocation, 1, false) },
        { primary: formatCompactNumber(h.value) },
        {
          primary: formatPercent(h.daily_gain_pct),
          color: gainColor(h.daily_gain_pct, positive, negative, neutral),
        },
      ];
    case 'technicals':
      return [
        { primary: formatCurrency(h.last_price, currency, 2) },
        {
          primary: formatPercent(h.daily_gain_pct),
          color: gainColor(h.daily_gain_pct, positive, negative, neutral),
        },
        { primary: formatPercent(h.allocation, 1, false) },
      ];
  }
}
