import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import UICard from '../../../components/ui/UICard';
import type { Trade } from '../portfolioTypes';
import {
  formatCurrency,
  formatDateShort,
  formatNumber,
  formatPercent,
} from '../utils/format';
import { TickerLogo } from './TickerLogo';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import { journalPhysicalRightText } from '../../Journal/journalLayout';
import {
  APP_TYPE,
} from '../../../components/ui/appType';

type Mode = 'open' | 'closed';

export type PortfolioTradesTableProps = {
  mode: Mode;
  trades: Trade[];
  /** מחירים חיים — רק ל-open (uP&L) */
  priceMap?: Record<string, number>;
  readOnly?: boolean;
  onClose?: (trade: Trade) => void;
  onDelete?: (trade: Trade) => void;
  onShare?: (trade: Trade) => void;
  onEdit?: (trade: Trade) => void;
};

const COL = {
  symbol: 108,
  type: 78,
  qty: 56,
  price: 78,
  date: 92,
  sl: 72,
  tp: 72,
  exit: 78,
  pnl: 86,
  actionsOpen: 96,
  actionsClosed: 40,
} as const;

function formatQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : formatNumber(qty, 4);
}

function dash(value: string | null | undefined): string {
  return value && value !== '—' ? value : '—';
}

function TypePill({
  isLong,
  longColor,
  shortColor,
}: {
  isLong: boolean;
  longColor: string;
  shortColor: string;
}) {
  const accent = isLong ? longColor : shortColor;
  return (
    <View
      style={[
        styles.typePill,
        {
          borderColor: `${accent}55`,
          backgroundColor: `${accent}22`,
        },
      ]}
    >
      <Ionicons
        name={isLong ? 'trending-up' : 'trending-down'}
        size={11}
        color={accent}
      />
      <Text style={[styles.typePillText, { color: accent }]}>
        {isLong ? 'LONG' : 'SHORT'}
      </Text>
    </View>
  );
}

function ActionIcon({
  name,
  color,
  onPress,
  label,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
  label: string;
}) {
  return (
    <TouchableOpacity
      onPress={() => {
        void HapticFeedback.impactLight();
        onPress();
      }}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.actionHit}
    >
      <Ionicons name={name} size={16} color={color} />
    </TouchableOpacity>
  );
}

/**
 * טבלת פוזיציות/עסקאות קומפקטית — גלילה אופקית במובייל, RTL.
 */
export default function PortfolioTradesTable({
  mode,
  trades,
  priceMap = {},
  readOnly = false,
  onClose,
  onDelete,
  onShare,
  onEdit,
}: PortfolioTradesTableProps) {
  const tokens = useDesignTokens();

  const tableMinWidth = useMemo(() => {
    if (mode === 'open') {
      return (
        COL.symbol +
        COL.type +
        COL.qty +
        COL.price +
        COL.date +
        COL.sl +
        COL.tp +
        COL.pnl +
        (readOnly ? 0 : COL.actionsOpen)
      );
    }
    return (
      COL.symbol +
      COL.type +
      COL.qty +
      COL.price +
      COL.exit +
      COL.date +
      COL.pnl +
      COL.actionsClosed
    );
  }, [mode, readOnly]);

  const headerCell = (label: string, width: number, align: 'left' | 'center' = 'left') => (
    <View style={[styles.cell, { width, alignItems: align === 'center' ? 'center' : 'stretch' }]}>
      <Text
        style={[
          styles.headerText,
          { color: tokens.colors.text.tertiary },
          align === 'center' ? { textAlign: 'center' } : null,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );

  const dataCell = (
    content: React.ReactNode,
    width: number,
    align: 'left' | 'center' = 'left'
  ) => (
    <View
      style={[
        styles.cell,
        { width, alignItems: align === 'center' ? 'center' : 'stretch' },
      ]}
    >
      {typeof content === 'string' ? (
        <Text
          style={[
            styles.cellText,
            { color: tokens.colors.text.primary },
            align === 'center' ? { textAlign: 'center' } : null,
          ]}
          numberOfLines={1}
        >
          {content}
        </Text>
      ) : (
        content
      )}
    </View>
  );

  return (
    <UICard
      variant="glass"
      glassIntensity="light"
      padding="none"
      style={[
        styles.card,
        {
          borderColor: `${tokens.colors.primary.main}18`,
          borderRadius: tokens.borderRadius.xl,
        },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{ minWidth: '100%' }}
      >
        <View style={[styles.table, { minWidth: Math.max(tableMinWidth, 360), direction: 'rtl' }]}>
          {/* Header */}
          <View
            style={[
              styles.headerRow,
              { borderBottomColor: 'rgba(255,255,255,0.08)' },
            ]}
          >
            {headerCell('סימבול', COL.symbol)}
            {headerCell('סוג', COL.type, 'center')}
            {headerCell('כמות', COL.qty, 'center')}
            {headerCell('כניסה', COL.price)}
            {mode === 'open' ? (
              <>
                {headerCell('תאריך', COL.date)}
                {headerCell('SL', COL.sl)}
                {headerCell('TP', COL.tp)}
                {headerCell('P&L', COL.pnl)}
                {!readOnly ? headerCell('', COL.actionsOpen, 'center') : null}
              </>
            ) : (
              <>
                {headerCell('יציאה', COL.exit)}
                {headerCell('תאריך', COL.date)}
                {headerCell('P&L', COL.pnl)}
                {headerCell('', COL.actionsClosed, 'center')}
              </>
            )}
          </View>

          {trades.map((t, index) => {
            const isLong = t.direction === 'long';
            const zebra = index % 2 === 1 ? 'rgba(255,255,255,0.03)' : 'transparent';
            const entryStr = formatCurrency(t.entry_price, t.currency, 2);
            const qtyStr = formatQty(t.quantity);
            const slStr =
              t.stop_loss != null
                ? formatCurrency(t.stop_loss, t.currency, 2)
                : null;
            const tpStr =
              t.target_price != null
                ? formatCurrency(t.target_price, t.currency, 2)
                : null;

            let pnlDisplay = '—';
            let pnlColor = tokens.colors.text.secondary;
            let pnlPct: string | null = null;

            if (mode === 'open') {
              const lastPrice = priceMap[t.symbol];
              if (lastPrice != null) {
                const upnl = isLong
                  ? (lastPrice - t.entry_price) * t.quantity * t.leverage
                  : (t.entry_price - lastPrice) * t.quantity * t.leverage;
                const pct =
                  t.entry_price > 0
                    ? (upnl / (t.entry_price * t.quantity)) * 100
                    : 0;
                pnlColor =
                  upnl > 0
                    ? tokens.colors.primary.main
                    : upnl < 0
                      ? tokens.colors.text.danger
                      : tokens.colors.text.secondary;
                pnlDisplay = `${upnl > 0 ? '+' : upnl < 0 ? '−' : ''}${formatCurrency(Math.abs(upnl), t.currency)}`;
                pnlPct = formatPercent(pct);
              }
            } else {
              const pnl = t.profit_loss ?? 0;
              pnlColor =
                pnl > 0
                  ? tokens.colors.primary.main
                  : pnl < 0
                    ? tokens.colors.text.danger
                    : tokens.colors.text.secondary;
              pnlDisplay = `${pnl > 0 ? '+' : pnl < 0 ? '−' : ''}${formatCurrency(Math.abs(pnl), t.currency)}`;
              if (t.exit_price != null && t.entry_price > 0) {
                const pct = isLong
                  ? ((t.exit_price - t.entry_price) / t.entry_price) * 100 * t.leverage
                  : ((t.entry_price - t.exit_price) / t.entry_price) * 100 * t.leverage;
                pnlPct = formatPercent(pct);
              }
            }

            const dateStr =
              mode === 'open'
                ? formatDateShort(t.entry_date)
                : formatDateShort(t.exit_date ?? t.entry_date);
            const exitStr =
              t.exit_price != null
                ? formatCurrency(t.exit_price, t.currency, 2)
                : '—';

            const symbolNode =
              onEdit && !readOnly ? (
                <TouchableOpacity
                  style={styles.symbolCell}
                  activeOpacity={0.7}
                  onPress={() => {
                    void HapticFeedback.selection();
                    onEdit(t);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`ערוך ${t.symbol}`}
                >
                  <TickerLogo symbol={t.symbol} size={26} />
                  <Text
                    style={[styles.symbolText, { color: tokens.colors.text.primary }]}
                    numberOfLines={1}
                  >
                    {t.symbol}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.symbolCell}>
                  <TickerLogo symbol={t.symbol} size={26} />
                  <Text
                    style={[styles.symbolText, { color: tokens.colors.text.primary }]}
                    numberOfLines={1}
                  >
                    {t.symbol}
                  </Text>
                </View>
              );

            return (
              <View
                key={t.id}
                style={[styles.dataRow, { backgroundColor: zebra }]}
              >
                {dataCell(symbolNode, COL.symbol)}
                {dataCell(
                  <TypePill
                    isLong={isLong}
                    longColor={tokens.colors.primary.main}
                    shortColor={tokens.colors.text.danger}
                  />,
                  COL.type,
                  'center'
                )}
                {dataCell(qtyStr, COL.qty, 'center')}
                {dataCell(entryStr, COL.price)}
                {mode === 'open' ? (
                  <>
                    {dataCell(dateStr, COL.date)}
                    {dataCell(dash(slStr), COL.sl)}
                    {dataCell(dash(tpStr), COL.tp)}
                    {dataCell(
                      <View>
                        <Text
                          style={[styles.cellText, { color: pnlColor }]}
                          numberOfLines={1}
                        >
                          {pnlDisplay}
                        </Text>
                        {pnlPct ? (
                          <Text
                            style={[styles.pnlPct, { color: pnlColor }]}
                            numberOfLines={1}
                          >
                            {pnlPct}
                          </Text>
                        ) : null}
                      </View>,
                      COL.pnl
                    )}
                    {!readOnly ? (
                      <View
                        style={[
                          styles.cell,
                          styles.actionsCell,
                          { width: COL.actionsOpen },
                        ]}
                      >
                        {onClose ? (
                          <ActionIcon
                            name="close"
                            color={tokens.colors.text.secondary}
                            label={`סגור ${t.symbol}`}
                            onPress={() => onClose(t)}
                          />
                        ) : null}
                        {onDelete ? (
                          <ActionIcon
                            name="trash-outline"
                            color={tokens.colors.text.danger}
                            label={`מחק ${t.symbol}`}
                            onPress={() => onDelete(t)}
                          />
                        ) : null}
                        {onShare ? (
                          <ActionIcon
                            name="share-outline"
                            color={tokens.colors.text.secondary}
                            label={`שתף ${t.symbol}`}
                            onPress={() => onShare(t)}
                          />
                        ) : null}
                      </View>
                    ) : null}
                  </>
                ) : (
                  <>
                    {dataCell(exitStr, COL.exit)}
                    {dataCell(dateStr, COL.date)}
                    {dataCell(
                      <View>
                        <Text
                          style={[styles.cellText, { color: pnlColor }]}
                          numberOfLines={1}
                        >
                          {pnlDisplay}
                        </Text>
                        {pnlPct ? (
                          <Text
                            style={[styles.pnlPct, { color: pnlColor }]}
                            numberOfLines={1}
                          >
                            {pnlPct}
                          </Text>
                        ) : null}
                      </View>,
                      COL.pnl
                    )}
                    <View
                      style={[
                        styles.cell,
                        styles.actionsCell,
                        { width: COL.actionsClosed },
                      ]}
                    >
                      {onShare ? (
                        <ActionIcon
                          name="share-outline"
                          color={tokens.colors.text.secondary}
                          label={`שתף ${t.symbol}`}
                          onPress={() => onShare(t)}
                        />
                      ) : null}
                    </View>
                  </>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </UICard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 0,
    overflow: 'hidden',
    borderWidth: 0,
  },
  table: {
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 52,
  },
  cell: {
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  headerText: {
    fontSize: APP_TYPE.caption2.fontSize,
    fontWeight: APP_TYPE.caption2.fontWeight,
    lineHeight: APP_TYPE.caption2.lineHeight,
    letterSpacing: 0.2,
    ...journalPhysicalRightText,
  },
  cellText: {
    fontSize: APP_TYPE.sectionSubtitle.fontSize,
    fontWeight: '600',
    lineHeight: APP_TYPE.sectionSubtitle.lineHeight,
    writingDirection: 'ltr',
    textAlign: 'right',
  },
  pnlPct: {
    fontSize: APP_TYPE.caption2.fontSize,
    fontWeight: '600',
    lineHeight: APP_TYPE.caption2.lineHeight,
    marginTop: 1,
    writingDirection: 'ltr',
    textAlign: 'right',
  },
  symbolCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
  },
  symbolText: {
    fontSize: 13,
    fontWeight: '800',
    flexShrink: 1,
    writingDirection: 'ltr',
    textAlign: 'right',
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 0,
  },
  typePillText: {
    fontSize: APP_TYPE.caption2.fontSize,
    fontWeight: '800',
    lineHeight: APP_TYPE.caption2.lineHeight,
    letterSpacing: 0.3,
  },
  actionsCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  actionHit: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
