import React, { memo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { brandfetchTickerLogoUri } from '../../utils/brandfetch';
import type { Trade } from './tradeTypes';

function SymbolLogo({
  symbol,
  size,
  fallbackColor,
  backgroundColor,
}: {
  symbol: string;
  size: number;
  fallbackColor: string;
  backgroundColor: string;
}) {
  const [failed, setFailed] = useState(false);
  const uri = !failed ? brandfetchTickerLogoUri(symbol) : null;
  const initials = symbol.trim().slice(0, 4).toUpperCase() || '—';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
          recyclingKey={symbol}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text
          style={{
            fontSize: Math.max(10, size * 0.28),
            fontWeight: '700',
            color: fallbackColor,
          }}
          numberOfLines={1}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

type Styles = ReturnType<typeof createTradeCardStyles>;

type Props = {
  item: Trade;
  styles: Styles;
  onShare: (t: Trade) => void;
  onDelete: (id: string) => void;
  formatDate: (iso: string) => string;
  formatUsd: (n: number) => string;
};

const TradeListCardInner = memo(function TradeListCardInner({
  item,
  styles,
  onShare,
  onDelete,
  formatDate,
  formatUsd,
}: Props) {
  const DesignTokens = useDesignTokens();

  const isProfit = item.pnl >= 0;
  const directionText = item.direction === 'long' ? 'Long' : 'Short';
  const directionColor =
    item.direction === 'long' ? DesignTokens.colors.primary.main : DesignTokens.colors.text.danger;

  let returnPct = 0;
  if (item.return_percentage != null) {
    returnPct = item.return_percentage;
  } else if (item.entry_price > 0) {
    returnPct =
      item.direction === 'long'
        ? ((item.exit_price - item.entry_price) / item.entry_price) * 100
        : ((item.entry_price - item.exit_price) / item.entry_price) * 100;
  }

  return (
    <UICard variant="glass" glassIntensity="light" padding="sm" style={styles.tradeCard}>
      <View style={styles.rtlWrap}>
        <View style={styles.tradeHeader}>
          <View style={styles.tradeHeaderMain}>
            <SymbolLogo
              symbol={item.symbol}
              size={40}
              fallbackColor={DesignTokens.colors.text.primary}
              backgroundColor="rgba(255,255,255,0.08)"
            />
            <Text style={styles.tradeSymbol} numberOfLines={1}>
              {item.symbol}
            </Text>
            <View style={[styles.directionBadge, { backgroundColor: `${directionColor}20` }]}>
              <Text style={[styles.directionText, { color: directionColor }]}>{directionText}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => onShare(item)} style={styles.iconBtn} hitSlop={8}>
              <Ionicons name="share-outline" size={17} color={DesignTokens.colors.primary.main} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.iconBtn} hitSlop={8}>
              <Ionicons name="trash-outline" size={17} color={DesignTokens.colors.text.danger} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.metricsGrid}>
          <View style={styles.metricCell}>
            <Text style={styles.metricLabel}>כניסה</Text>
            <Text style={styles.metricValueMoney} numberOfLines={1}>
              ${formatUsd(item.entry_price)}
            </Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.metricLabel}>יציאה</Text>
            <Text style={styles.metricValueMoney} numberOfLines={1}>
              ${formatUsd(item.exit_price)}
            </Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.metricLabel}>כמות</Text>
            <Text style={styles.metricValuePlain} numberOfLines={1}>
              {item.quantity}
            </Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.metricLabel}>יציאה (תאריך)</Text>
            <Text style={styles.metricValuePlain} numberOfLines={1}>
              {formatDate(item.exit_date)}
            </Text>
          </View>
        </View>

        <View style={styles.pnlBand}>
          <View style={styles.pnlBandCell}>
            <Text style={styles.pnlBandLabel}>{isProfit ? 'רווח נטו' : 'הפסד נטו'}</Text>
            <Text
              style={[styles.pnlBandValue, isProfit ? styles.pnlProfit : styles.pnlLoss]}
              numberOfLines={1}
            >
              ${formatUsd(item.pnl)}
            </Text>
          </View>
          <View style={styles.pnlBandDivider} />
          <View style={styles.pnlBandCell}>
            <Text style={styles.pnlBandLabel}>תשואה</Text>
            <Text
              style={[styles.pnlBandValue, returnPct >= 0 ? styles.pnlProfit : styles.pnlLoss]}
              numberOfLines={1}
            >
              {returnPct >= 0 ? '+' : ''}
              {returnPct.toFixed(2)}%
            </Text>
          </View>
        </View>
      </View>
    </UICard>
  );
});

export const TradeListCard = TradeListCardInner;

export function createTradeCardStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    tradeCard: {
      marginBottom: tokens.spacing.xs,
      borderRadius: tokens.borderRadius.xl,
      borderWidth: 1,
      borderColor: `${tokens.colors.primary.main}22`,
      overflow: 'hidden',
      ...tokens.shadows.sm,
    },
    rtlWrap: {
      direction: 'rtl',
    },
    tradeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      marginBottom: 8,
      /** ב־RTL: ריווח מהקצה שבו התמונה (ה־start של השורה) */
      paddingStart: tokens.spacing.sm,
      paddingEnd: tokens.spacing.xs,
    },
    /**
     * ב־RTL (שורה): לוגו ימין → סימול → Long/Short משמאל לסימול
     */
    tradeHeaderMain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.spacing.sm,
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
      maxWidth: '58%',
      zIndex: 2,
    },
    tradeSymbol: {
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: '800' as any,
      color: tokens.colors.text.primary,
      textAlign: 'right',
    },
    directionBadge: {
      flexShrink: 0,
      alignSelf: 'center',
      paddingHorizontal: tokens.spacing.sm,
      paddingVertical: 4,
      borderRadius: 999,
    },
    directionText: {
      fontSize: 10,
      fontWeight: '800' as any,
      textAlign: 'center',
    },
    /** שמאל (ב־RTL): שיתוף + מחיקה — נשארים בקצה הנגדי */
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 4,
      flexGrow: 0,
      flexShrink: 0,
      zIndex: 2,
    },
    iconBtn: {
      padding: 6,
    },
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 10,
      marginTop: 6,
      width: '100%',
    },
    metricCell: {
      flexBasis: '44%',
      flexGrow: 0,
      minWidth: 120,
      maxWidth: '48%',
      paddingVertical: 4,
      paddingHorizontal: 6,
      alignItems: 'center',
    },
    metricLabel: {
      fontSize: 10,
      fontWeight: '600' as any,
      color: tokens.colors.text.tertiary,
      textAlign: 'center',
      marginBottom: 3,
    },
    metricValueMoney: {
      fontSize: 14,
      fontWeight: '800' as any,
      color: tokens.colors.primary.main,
      textAlign: 'center',
      writingDirection: 'ltr',
    },
    metricValuePlain: {
      fontSize: 13,
      fontWeight: '700' as any,
      color: tokens.colors.text.primary,
      textAlign: 'center',
      writingDirection: 'ltr',
    },
    pnlBand: {
      flexDirection: 'row',
      alignItems: 'stretch',
      justifyContent: 'center',
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tokens.colors.border.primary,
      width: '100%',
    },
    pnlBandCell: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 6,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 0,
    },
    pnlBandDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: tokens.colors.border.primary,
      marginVertical: 6,
    },
    pnlBandLabel: {
      fontSize: 10,
      fontWeight: '600' as any,
      color: tokens.colors.text.tertiary,
      textAlign: 'center',
      marginBottom: 2,
    },
    pnlBandValue: {
      fontSize: 17,
      fontWeight: '800' as any,
      textAlign: 'center',
      writingDirection: 'ltr',
    },
    pnlProfit: { color: tokens.colors.primary.main },
    pnlLoss: { color: tokens.colors.text.danger },
  });
}
