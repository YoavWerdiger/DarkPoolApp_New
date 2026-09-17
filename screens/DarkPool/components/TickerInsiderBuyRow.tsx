import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import { darkPoolTextRtl } from '../darkPoolLayout';
import { formatRelativeTime, formatUsdCompact } from '../utils/darkPoolFormat';
import { formatInsiderDisplayName } from '../utils/investorPlaceholder';
import {
  formatFeedTickerDisplay,
  getFeedTradeSide,
  getFeedTradeVerb,
} from '../utils/feedTradeDisplay';
import type { InsiderBuyRow } from '../../../types/darkpool.types';

/** Left-to-right mark — שומר טיקר/$ בלי ערבוב RTL */
const LRM = '\u200E';

interface Props {
  item: InsiderBuyRow;
}

export function TickerInsiderBuyRow({ item }: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const side = getFeedTradeSide(item.transaction_type);
  const isBuy = side === 'buy';
  const verb = getFeedTradeVerb(side);
  const sideColor = isBuy ? tokens.colors.primary.main : tokens.colors.text.danger;
  const displayName = formatInsiderDisplayName(item.insider_name?.trim() || 'בכיר');
  const tickerSym = formatFeedTickerDisplay(item.ticker);

  return (
    <UICard variant="glass" glassIntensity="light" padding="md" style={styles.card}>
      <View style={styles.row}>
        <TickerLogo symbol={item.ticker} size={40} borderRadius={20} />
        <View style={styles.main}>
          <Text style={styles.primary} numberOfLines={1}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={{ color: sideColor, fontWeight: '800' }}>{` ${verb} `}</Text>
            <Text style={styles.ticker}>
              {LRM}
              {tickerSym}
            </Text>
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
      borderRadius: tokens.borderRadius.lg,
      borderWidth: 1,
      borderColor: tokens.colors.border.subtle,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    main: {
      flex: 1,
      minWidth: 0,
      alignItems: 'flex-start',
    },
    primary: {
      ...darkPoolTextRtl,
      fontSize: 15,
      fontWeight: '700',
      color: tokens.colors.text.primary,
    },
    name: {
      fontWeight: '700',
      color: tokens.colors.text.primary,
    },
    ticker: {
      fontWeight: '800',
      color: tokens.colors.text.primary,
      letterSpacing: 0.2,
    },
    role: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '500',
      color: tokens.colors.text.tertiary,
      ...darkPoolTextRtl,
    },
    date: {
      marginTop: 4,
      fontSize: 12,
      fontWeight: '500',
      color: tokens.colors.text.tertiary,
      ...darkPoolTextRtl,
    },
    valueCol: {
      alignItems: 'flex-end',
      minWidth: 72,
    },
    value: {
      fontSize: 15,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
    },
    shares: {
      marginTop: 3,
      fontSize: 11,
      fontWeight: '500',
      color: tokens.colors.text.tertiary,
      ...darkPoolTextRtl,
    },
  });
}
