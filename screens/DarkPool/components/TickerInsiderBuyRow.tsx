import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import { UI_CARD_RADIUS } from '../../../components/ui/appLayout';
import {
  DARK_POOL_TYPE,
  darkPoolPhysicalRightText,
} from '../darkPoolLayout';
import { formatRelativeTime, formatUsdCompact } from '../utils/darkPoolFormat';
import { formatInsiderDisplayName } from '../utils/investorPlaceholder';
import { toDataIsland } from '../utils/bidi';
import {
  formatFeedTickerDisplay,
  getFeedTradeSide,
  getFeedTradeVerb,
} from '../utils/feedTradeDisplay';
import type { InsiderBuyRow } from '../../../types/darkpool.types';

interface Props {
  item: InsiderBuyRow;
  onPress?: () => void;
}

export function TickerInsiderBuyRow({ item, onPress }: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const side = getFeedTradeSide(item.transaction_type);
  const isBuy = side === 'buy';
  const verb = getFeedTradeVerb(side);
  const sideColor = isBuy ? tokens.colors.primary.main : tokens.colors.text.danger;
  const displayName = formatInsiderDisplayName(item.insider_name?.trim() || 'בכיר');
  const tickerSym = formatFeedTickerDisplay(item.ticker);

  return (
    <UICard
      variant="soft"
      glassIntensity="light"
      padding="md"
      disableBlur
      style={styles.card}
      onPress={onPress}
      accessibilityLabel={`${displayName} ${verb} ${tickerSym}`}
    >
      <View style={styles.row}>
        <TickerLogo symbol={item.ticker} size={40} borderRadius={20} />
        <View style={styles.main}>
          <Text style={styles.primary} numberOfLines={1}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={{ color: sideColor, fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight }}>{` ${verb} `}</Text>
            <Text style={styles.ticker}>{toDataIsland(tickerSym)}</Text>
          </Text>
          {item.insider_role?.trim() ? (
            <Text style={styles.role} numberOfLines={1}>
              {item.insider_role.trim()}
            </Text>
          ) : null}
          <Text style={styles.date}>
            {formatRelativeTime(item.transaction_date || item.filed_at)}
          </Text>
        </View>
        <View style={styles.valueCol}>
          <Text style={styles.value}>{formatUsdCompact(item.value)}</Text>
          {item.shares > 0 ? (
            <Text style={styles.shares}>
              {item.shares.toLocaleString('en-US')} מניות
            </Text>
          ) : null}
        </View>
      </View>
    </UICard>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    card: {
      marginBottom: 8,
      borderRadius: UI_CARD_RADIUS,
      backgroundColor: 'transparent',
    },
    row: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    main: {
      flex: 1,
      minWidth: 0,
      alignItems: 'stretch',
    },
    primary: {
      ...darkPoolPhysicalRightText,
      fontSize: DARK_POOL_TYPE.body.fontSize,
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
    },
    name: {
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
    },
    ticker: {
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
      letterSpacing: 0.2,
    },
    role: {
      marginTop: 2,
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      fontWeight: DARK_POOL_TYPE.caption.fontWeight,
      color: tokens.colors.text.tertiary,
      ...darkPoolPhysicalRightText,
    },
    date: {
      marginTop: 4,
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      fontWeight: DARK_POOL_TYPE.caption.fontWeight,
      color: tokens.colors.text.tertiary,
      ...darkPoolPhysicalRightText,
    },
    valueCol: {
      alignItems: 'stretch',
      minWidth: 72,
    },
    value: {
      fontSize: DARK_POOL_TYPE.body.fontSize,
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
      textAlign: 'right',
    },
    shares: {
      marginTop: 3,
      fontSize: DARK_POOL_TYPE.caption2.fontSize,
      fontWeight: DARK_POOL_TYPE.caption.fontWeight,
      color: tokens.colors.text.tertiary,
      ...darkPoolPhysicalRightText,
    },
  });
}
