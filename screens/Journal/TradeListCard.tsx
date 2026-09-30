import React, { memo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import UICard from '../../components/ui/UICard';
import { UI_CARD_RADIUS } from '../../components/ui/appLayout';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { brandfetchTickerLogoUri } from '../../utils/brandfetch';
import { HapticFeedback } from '../../utils/hapticFeedback';
import TradeShareButton from '../../components/Journal/TradeShareButton';
import type { Trade } from './tradeTypes';
import {
  JOURNAL_LAYOUT,
  JOURNAL_TYPE,
  journalCardMetricLabelStyle,
  journalCardMetricValueSecondaryStyle,
} from './journalLayout';

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
            fontSize: JOURNAL_TYPE.caption2.fontSize,
            fontWeight: JOURNAL_TYPE.caption2.fontWeight,
            lineHeight: JOURNAL_TYPE.caption2.lineHeight,
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
  const directionText = item.direction === 'long' ? 'לונג' : 'שורט';
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
    <UICard variant="soft" padding="md" disableBlur style={styles.tradeCard}>
      <View style={styles.rtlWrap}>
        <View style={styles.tradeHeader}>
          <View style={styles.tradeHeaderMain}>
            <SymbolLogo
              symbol={item.symbol}
              size={40}
              fallbackColor={DesignTokens.colors.text.primary}
              backgroundColor={DesignTokens.colors.background.primary}
            />
            <Text style={styles.tradeSymbol} numberOfLines={1}>
              {item.symbol}
            </Text>
            <View
              style={[
                styles.directionBadge,
                { backgroundColor: DesignTokens.colors.background.primary },
              ]}
            >
              <Text style={[styles.directionText, { color: directionColor }]}>
                {directionText}
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TradeShareButton
              onPress={() => onShare(item)}
              size={28}
              accessibilityLabel="שתף טרייד"
            />
            <TouchableOpacity
              onPress={() => {
                void HapticFeedback.warning();
                onDelete(item.id);
              }}
              style={[styles.iconBtn, { backgroundColor: DesignTokens.colors.background.primary }]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="מחק טרייד"
            >
              <Ionicons name="trash-outline" size={16} color={DesignTokens.colors.text.danger} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.metricsGrid}>
          <View style={styles.metricCell}>
            <Text style={styles.metricLabel} numberOfLines={1}>כניסה</Text>
            <Text style={styles.metricValueMoney} numberOfLines={1}>
              ${formatUsd(item.entry_price)}
            </Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.metricLabel} numberOfLines={1}>יציאה</Text>
            <Text style={styles.metricValueMoney} numberOfLines={1}>
              ${formatUsd(item.exit_price)}
            </Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.metricLabel} numberOfLines={1}>כמות</Text>
            <Text style={styles.metricValuePlain} numberOfLines={1}>
              {item.quantity}
            </Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.metricLabel} numberOfLines={1}>תאריך יציאה</Text>
            <Text style={styles.metricValuePlain} numberOfLines={1}>
              {formatDate(item.exit_date)}
            </Text>
          </View>
        </View>

        <View style={styles.pnlBand}>
          <View style={styles.pnlBandCell}>
            <Text style={styles.pnlBandLabel} numberOfLines={1}>
              {isProfit ? 'רווח נטו' : 'הפסד נטו'}
            </Text>
            <Text
              style={[styles.pnlBandValue, isProfit ? styles.pnlProfit : styles.pnlLoss]}
              numberOfLines={1}
            >
              ${formatUsd(item.pnl)}
            </Text>
          </View>
          <View style={styles.pnlBandDivider} />
          <View style={styles.pnlBandCell}>
            <Text style={styles.pnlBandLabel} numberOfLines={1}>תשואה</Text>
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
      marginBottom: JOURNAL_LAYOUT.cardStackGap,
      borderRadius: UI_CARD_RADIUS,
      borderWidth: 0,
      overflow: 'hidden',
      backgroundColor: tokens.colors.background.cardSolid,
      ...tokens.shadows.none,
    },
    rtlWrap: {
      direction: 'rtl',
    },
    tradeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      marginBottom: JOURNAL_LAYOUT.cardTitleToBodyGap,
    },
    /**
     * ב־RTL (שורה): לוגו ימין → סימול → Long/Short משמאל לסימול
     */
    tradeHeaderMain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
      maxWidth: '70%',
      zIndex: 2,
    },
    tradeSymbol: {
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
      fontSize: JOURNAL_TYPE.cardTitle.fontSize,
      fontWeight: JOURNAL_TYPE.cardTitle.fontWeight,
      lineHeight: JOURNAL_TYPE.cardTitle.lineHeight,
      letterSpacing: JOURNAL_TYPE.cardTitle.letterSpacing,
      color: tokens.colors.text.primary,
      direction: 'ltr',
      writingDirection: 'ltr',
      textAlign: 'right',
      includeFontPadding: false,
    },
    directionBadge: {
      flexShrink: 0,
      alignSelf: 'center',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
    },
    directionText: {
      fontSize: JOURNAL_TYPE.cardSubtitle.fontSize,
      fontWeight: JOURNAL_TYPE.cardSubtitle.fontWeight,
      lineHeight: JOURNAL_TYPE.cardSubtitle.lineHeight,
      textAlign: 'center',
      writingDirection: 'rtl',
      includeFontPadding: false,
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
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: JOURNAL_LAYOUT.cardStackGap,
      width: '100%',
    },
    metricCell: {
      flexBasis: '44%',
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      maxWidth: '48%',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    metricLabel: {
      ...journalCardMetricLabelStyle,
      width: '100%',
      textAlign: 'center',
      color: tokens.colors.text.secondary,
      includeFontPadding: false,
    },
    metricValueMoney: {
      ...journalCardMetricValueSecondaryStyle,
      marginTop: JOURNAL_LAYOUT.cardMetricLabelToValueGap,
      color: tokens.colors.primary.main,
      includeFontPadding: false,
      fontVariant: ['tabular-nums'],
    },
    metricValuePlain: {
      ...journalCardMetricValueSecondaryStyle,
      marginTop: JOURNAL_LAYOUT.cardMetricLabelToValueGap,
      color: tokens.colors.text.primary,
      includeFontPadding: false,
      fontVariant: ['tabular-nums'],
    },
    pnlBand: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'center',
      marginTop: JOURNAL_LAYOUT.cardTitleToBodyGap,
      paddingTop: JOURNAL_LAYOUT.cardTitleToBodyGap,
      borderTopWidth: 1,
      borderTopColor: tokens.colors.border.divider,
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
      width: 1,
      backgroundColor: tokens.colors.border.divider,
      marginVertical: 6,
    },
    pnlBandLabel: {
      ...journalCardMetricLabelStyle,
      width: '100%',
      textAlign: 'center',
      color: tokens.colors.text.secondary,
      includeFontPadding: false,
    },
    pnlBandValue: {
      ...journalCardMetricValueSecondaryStyle,
      marginTop: JOURNAL_LAYOUT.cardMetricLabelToValueGap,
      includeFontPadding: false,
      fontVariant: ['tabular-nums'],
    },
    pnlProfit: { color: tokens.colors.primary.main },
    pnlLoss: { color: tokens.colors.text.danger },
  });
}
