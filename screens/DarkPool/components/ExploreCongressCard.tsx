import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { UI_CARD_RADIUS } from '../../../components/ui/appLayout';
import { APP_TYPE } from '../../../components/ui/appType';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import UICard from '../../../components/ui/UICard';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import type { CongressTradeCard } from '../../../services/darkpool/uwExploreService';

interface Props {
  trade: CongressTradeCard;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function ExploreCongressCard({ trade, onPress, style }: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const tickerSym = trade.ticker.toUpperCase();

  const body = (
    <UICard
      variant="soft"
      glassIntensity="light"
      padding="none"
      disableBlur
      style={[styles.card, style]}
    >
      <View style={styles.top}>
        <TickerLogo symbol={trade.ticker} size={44} borderRadius={22} />
        <View style={styles.topText}>
          <Text style={styles.name} numberOfLines={1}>
            {trade.politician_name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {trade.txn_label}
            {trade.amount_label ? ` · ${trade.amount_label}` : ''}
          </Text>
        </View>
      </View>
      <View style={styles.tickerRow}>
        <Text style={styles.ticker} numberOfLines={1}>
          {tickerSym}
        </Text>
        <Text style={styles.issuer} numberOfLines={1}>
          {trade.issuer || trade.filed_label}
        </Text>
      </View>
    </UICard>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.92 }}>
      {body}
    </Pressable>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    card: {
      width: 200,
      borderRadius: UI_CARD_RADIUS,
      backgroundColor: 'transparent',
    },
    top: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 10,
      padding: 12,
    },
    topText: { flex: 1, alignItems: 'flex-end' },
    name: {
      fontSize: APP_TYPE.cardTitle.fontSize,
      lineHeight: APP_TYPE.cardTitle.lineHeight,
      fontWeight: APP_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
      textAlign: 'right',
    },
    meta: {
      marginTop: 2,
      fontSize: APP_TYPE.caption2.fontSize,
      lineHeight: APP_TYPE.caption2.lineHeight,
      fontWeight: APP_TYPE.caption2.fontWeight,
      color: tokens.colors.text.tertiary,
      textAlign: 'right',
    },
    tickerRow: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: tokens.colors.border.divider,
      backgroundColor: tokens.colors.background.tertiary,
      alignItems: 'flex-end',
      gap: 2,
    },
    ticker: {
      fontSize: APP_TYPE.cardBody.fontSize,
      lineHeight: APP_TYPE.cardBody.lineHeight,
      fontWeight: APP_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
      textAlign: 'right',
    },
    issuer: {
      fontSize: APP_TYPE.caption2.fontSize,
      lineHeight: APP_TYPE.caption2.lineHeight,
      fontWeight: APP_TYPE.caption2.fontWeight,
      color: tokens.colors.text.tertiary,
      textAlign: 'right',
    },
  });
}
