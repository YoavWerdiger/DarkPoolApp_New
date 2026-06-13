/**
 * BrokerOrdersTab
 * --------------------------------------------------------------------------
 * טאב בתיק מסונכרן מ-Colmex Pro שמציג:
 *   - מצב חשבון (Balance / Equity / Margin / Available funds)
 *   - פוזיציות פתוחות (SL/TP, P&L)
 *   - פקודות פתוחות (limit/stop/SL/TP)
 *   - מצב סנכרון אחרון + כפתור "סנכרן עכשיו"
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { useBrokerPortfolio } from '../../../hooks/useBrokerPortfolio';
import type {
  BrokerOpenOrder,
  BrokerPosition,
} from '../../../services/brokers';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import {
  formatCurrency,
  formatPercent,
  formatRelative,
  gainColor,
} from '../utils/format';

interface Props {
  portfolioId: string;
  currency: string;
}

export default function BrokerOrdersTab({ portfolioId, currency }: Props) {
  const tokens = useDesignTokens();
  const positive = tokens.colors.primary.main;
  const negative = tokens.colors.text.danger;
  const neutral = tokens.colors.text.secondary;

  const {
    summary,
    state,
    positions,
    openOrders,
    loading,
    refreshing,
    error,
    syncNow,
  } = useBrokerPortfolio(portfolioId);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { paddingBottom: 12 },
        section: { marginBottom: 16 },
        sectionHeader: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        },
        sectionTitle: {
          fontSize: 14,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        sectionAction: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 6,
        },
        sectionActionText: {
          fontSize: 12,
          color: tokens.colors.primary.main,
          fontWeight: '600',
        },
        kpiCard: {
          padding: 16,
          marginBottom: 0,
        },
        kpiGrid: {
          flexDirection: 'row-reverse',
          flexWrap: 'wrap',
          gap: 12,
          marginTop: 8,
        },
        kpiItem: {
          flexBasis: '47%',
          padding: 10,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderRadius: 14,
        },
        kpiLabel: {
          fontSize: 11,
          color: tokens.colors.text.tertiary,
          textAlign: 'right',
          writingDirection: 'rtl',
          marginBottom: 4,
        },
        kpiValue: {
          fontSize: 16,
          fontWeight: '800',
          color: tokens.colors.text.primary,
          textAlign: 'right',
          writingDirection: 'ltr',
        },
        statusBar: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 10,
          marginTop: 12,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: 'rgba(255,255,255,0.08)',
        },
        statusInfo: {
          flex: 1,
        },
        statusLabel: {
          fontSize: 11,
          color: tokens.colors.text.tertiary,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        statusValue: {
          fontSize: 12,
          color: tokens.colors.text.secondary,
          fontWeight: '600',
          textAlign: 'right',
          writingDirection: 'rtl',
          marginTop: 2,
        },
        syncBtn: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 20,
          backgroundColor: 'rgba(0, 200, 5, 0.15)',
          borderWidth: 1,
          borderColor: tokens.colors.primary.main,
        },
        syncBtnText: {
          fontSize: 12,
          color: tokens.colors.primary.main,
          fontWeight: '700',
        },
        positionRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 4,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: 'rgba(255,255,255,0.06)',
        },
        positionLeft: { flex: 1 },
        positionSymbol: {
          fontSize: 14,
          fontWeight: '800',
          color: tokens.colors.text.primary,
          textAlign: 'right',
          writingDirection: 'ltr',
        },
        positionMeta: {
          fontSize: 11,
          color: tokens.colors.text.tertiary,
          marginTop: 2,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        positionRight: {
          alignItems: 'flex-end',
        },
        positionPnl: {
          fontSize: 14,
          fontWeight: '800',
          writingDirection: 'ltr',
        },
        positionPrice: {
          fontSize: 11,
          color: tokens.colors.text.tertiary,
          marginTop: 2,
          writingDirection: 'ltr',
        },
        sideBadge: {
          paddingVertical: 2,
          paddingHorizontal: 8,
          borderRadius: 8,
          alignSelf: 'flex-start',
        },
        sideBadgeText: {
          fontSize: 10,
          fontWeight: '700',
          writingDirection: 'ltr',
        },
        orderRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 4,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: 'rgba(255,255,255,0.06)',
        },
        emptyText: {
          fontSize: 12,
          color: tokens.colors.text.tertiary,
          textAlign: 'center',
          writingDirection: 'rtl',
          paddingVertical: 16,
        },
        errorText: {
          fontSize: 12,
          color: tokens.colors.text.danger,
          textAlign: 'center',
          writingDirection: 'rtl',
          marginBottom: 12,
        },
      }),
    [tokens]
  );

  if (loading) {
    return (
      <View style={{ paddingVertical: 60, alignItems: 'center' }}>
        <ActivityIndicator color={tokens.colors.primary.main} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Account state */}
      <UICard variant="glass" glassIntensity="light" padding="none" style={styles.kpiCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>מצב חשבון Colmex</Text>
          <TouchableOpacity
            onPress={() => {
              void HapticFeedback.impactLight();
              void syncNow();
            }}
            disabled={refreshing}
            style={styles.syncBtn}
            activeOpacity={0.85}
          >
            <Ionicons
              name="sync"
              size={14}
              color={tokens.colors.primary.main}
              style={refreshing ? { transform: [{ rotate: '180deg' }] } : undefined}
            />
            <Text style={styles.syncBtnText}>
              {refreshing ? 'מסנכרן…' : 'סנכרן עכשיו'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.kpiGrid}>
          <KpiItem
            styles={styles}
            label="יתרה"
            value={formatCurrency(state?.balance ?? null, currency)}
          />
          <KpiItem
            styles={styles}
            label="הון (Equity)"
            value={formatCurrency(state?.equity ?? null, currency)}
          />
          <KpiItem
            styles={styles}
            label="זמין לשימוש"
            value={formatCurrency(state?.available_funds ?? null, currency)}
          />
          <KpiItem
            styles={styles}
            label="Margin בשימוש"
            value={formatCurrency(state?.margin_used ?? null, currency)}
          />
          <KpiItem
            styles={styles}
            label="רווח/הפסד פתוח"
            value={formatCurrency(state?.unrealized_pnl ?? null, currency)}
            color={gainColor(state?.unrealized_pnl ?? null, positive, negative, neutral)}
          />
          <KpiItem
            styles={styles}
            label="P&L יומי"
            value={formatCurrency(state?.realized_pnl_today ?? null, currency)}
            color={gainColor(state?.realized_pnl_today ?? null, positive, negative, neutral)}
          />
        </View>

        <View style={styles.statusBar}>
          <View style={styles.statusInfo}>
            <Text style={styles.statusLabel}>סנכרון אחרון</Text>
            <Text style={styles.statusValue}>
              {summary?.last_sync_at ? formatRelative(summary.last_sync_at) : 'טרם סונכרן'}
              {summary?.last_sync_status === 'failed' ? ' · שגיאה' : ''}
              {summary?.last_sync_status === 'partial' ? ' · חלקי' : ''}
            </Text>
          </View>
        </View>
      </UICard>

      {/* Positions */}
      <View style={[styles.section, { marginTop: 18 }]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            פוזיציות פתוחות ({positions.length})
          </Text>
        </View>
        <UICard variant="glass" glassIntensity="light" padding="md">
          {positions.length === 0 ? (
            <Text style={styles.emptyText}>אין פוזיציות פתוחות</Text>
          ) : (
            <FlatList
              data={positions}
              keyExtractor={(p) => p.id}
              renderItem={({ item }) => (
                <PositionRow
                  position={item}
                  styles={styles}
                  positive={positive}
                  negative={negative}
                  neutral={neutral}
                  currency={currency}
                />
              )}
              scrollEnabled={false}
            />
          )}
        </UICard>
      </View>

      {/* Open orders */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            פקודות פתוחות ({openOrders.length})
          </Text>
        </View>
        <UICard variant="glass" glassIntensity="light" padding="md">
          {openOrders.length === 0 ? (
            <Text style={styles.emptyText}>אין פקודות פתוחות</Text>
          ) : (
            <FlatList
              data={openOrders}
              keyExtractor={(o) => o.id}
              renderItem={({ item }) => (
                <OrderRow order={item} styles={styles} tokens={tokens} currency={currency} />
              )}
              scrollEnabled={false}
            />
          )}
        </UICard>
      </View>
    </View>
  );
}

interface KpiItemProps {
  styles: ReturnType<typeof StyleSheet.create>;
  label: string;
  value: string;
  color?: string;
}

function KpiItem({ styles, label, value, color }: KpiItemProps) {
  return (
    <View style={styles.kpiItem}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

interface PositionRowProps {
  position: BrokerPosition;
  styles: ReturnType<typeof StyleSheet.create>;
  positive: string;
  negative: string;
  neutral: string;
  currency: string;
}

function PositionRow({
  position: p,
  styles,
  positive,
  negative,
  neutral,
  currency,
}: PositionRowProps) {
  const sideColor = p.side === 'long' ? positive : negative;
  const pnlColor = gainColor(p.unrealized_pnl, positive, negative, neutral);
  const pctChange =
    p.avg_open_price && p.current_price
      ? ((p.current_price - p.avg_open_price) / p.avg_open_price) *
        (p.side === 'short' ? -1 : 1) *
        100
      : null;
  return (
    <View style={styles.positionRow}>
      <View style={styles.positionLeft}>
        <Text style={styles.positionSymbol}>{p.symbol ?? `#${p.tradable_instrument_id}`}</Text>
        <Text style={styles.positionMeta}>
          {p.quantity ?? 0} יח׳ @ {p.avg_open_price?.toFixed(2) ?? '—'}
          {p.stop_loss != null ? ` · SL ${p.stop_loss.toFixed(2)}` : ''}
          {p.take_profit != null ? ` · TP ${p.take_profit.toFixed(2)}` : ''}
        </Text>
        <View
          style={[
            styles.sideBadge,
            { backgroundColor: `${sideColor}22`, marginTop: 6 },
          ]}
        >
          <Text style={[styles.sideBadgeText, { color: sideColor }]}>
            {p.side?.toUpperCase() ?? '—'}
          </Text>
        </View>
      </View>
      <View style={styles.positionRight}>
        <Text style={[styles.positionPnl, { color: pnlColor }]}>
          {formatCurrency(p.unrealized_pnl, currency)}
        </Text>
        {pctChange != null ? (
          <Text style={[styles.positionPrice, { color: pnlColor }]}>
            {formatPercent(pctChange)}
          </Text>
        ) : null}
        <Text style={styles.positionPrice}>
          @ {p.current_price?.toFixed(2) ?? '—'}
        </Text>
      </View>
    </View>
  );
}

interface OrderRowProps {
  order: BrokerOpenOrder;
  styles: ReturnType<typeof StyleSheet.create>;
  tokens: ReturnType<typeof useDesignTokens>;
  currency: string;
}

function OrderRow({ order: o, styles, tokens, currency }: OrderRowProps) {
  const positive = tokens.colors.primary.main;
  const negative = tokens.colors.text.danger;
  const sideColor = o.side === 'buy' ? positive : negative;
  return (
    <View style={styles.orderRow}>
      <View style={styles.positionLeft}>
        <Text style={styles.positionSymbol}>{o.symbol ?? `#${o.tradable_instrument_id}`}</Text>
        <Text style={styles.positionMeta}>
          {o.order_type?.toUpperCase() ?? '—'} · {o.quantity ?? 0} יח׳
          {o.price != null ? ` @ ${o.price.toFixed(2)}` : ''}
          {o.stop_price != null ? ` · stop ${o.stop_price.toFixed(2)}` : ''}
        </Text>
        <Text style={styles.positionMeta}>
          {o.validity ?? 'DAY'} · {o.status ?? 'working'}
          {o.stop_loss != null ? ` · SL ${o.stop_loss.toFixed(2)}` : ''}
          {o.take_profit != null ? ` · TP ${o.take_profit.toFixed(2)}` : ''}
        </Text>
      </View>
      <View style={styles.positionRight}>
        <View style={[styles.sideBadge, { backgroundColor: `${sideColor}22` }]}>
          <Text style={[styles.sideBadgeText, { color: sideColor }]}>
            {o.side?.toUpperCase() ?? '—'}
          </Text>
        </View>
        {o.placed_at ? (
          <Text style={[styles.positionPrice, { marginTop: 6 }]}>
            {formatRelative(o.placed_at)}
          </Text>
        ) : null}
        {o.filled_quantity != null && o.filled_quantity > 0 ? (
          <Text style={styles.positionPrice}>
            מולא {o.filled_quantity}/{o.quantity}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
