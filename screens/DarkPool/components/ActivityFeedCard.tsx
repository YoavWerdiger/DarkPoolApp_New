import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import type { FollowingActivityItem } from '../../../services/darkpool/uwFollowingFeedService';
import { DarkPoolFeedCard } from './DarkPoolFeedCard';
import { darkPoolHeaderStyles } from './darkPoolCardMetrics';
import { InvestorPortrait } from './InvestorPortrait';

interface Props {
  item: FollowingActivityItem;
  onPersonPress?: () => void;
  onTickerPress?: (ticker: string) => void;
  showDivider?: boolean;
}

export function ActivityFeedCard({
  item,
  onPersonPress,
  onTickerPress,
}: Props) {
  const tokens = useDesignTokens();
  const h = useMemo(() => darkPoolHeaderStyles(tokens), [tokens]);
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  return (
    <DarkPoolFeedCard
      onPress={
        onTickerPress
          ? () => onTickerPress(item.ticker)
          : onPersonPress
            ? () => {
                void HapticFeedback.impactLight();
                onPersonPress();
              }
            : undefined
      }
      accessibilityLabel={`${item.person_name} ${item.ticker}`}
    >
      <Pressable
        onPress={() => {
          if (onPersonPress) {
            void HapticFeedback.impactLight();
            onPersonPress();
          }
        }}
        style={h.header}
      >
        <InvestorPortrait
          name={item.person_name}
          imageUrl={item.person_image_url}
          kind={item.person_kind}
          personId={item.person_id}
          layout="circle"
          size={40}
          style={styles.avatar}
        />
        <View style={h.headerMain}>
          <Text style={styles.name} numberOfLines={1}>
            {item.person_name}
          </Text>
          <Text style={h.subtitle} numberOfLines={1}>
            {item.source === 'congress' ? 'קונגרס' : 'בכיר'} · {item.txn_label}
            {item.filed_label ? ` · ${item.filed_label}` : ''}
          </Text>
        </View>
      </Pressable>

      <View style={styles.tickerRow}>
        <TickerLogo symbol={item.ticker} size={36} borderRadius={10} />
        <View style={styles.tickerText}>
          <Text style={styles.ticker}>{item.ticker}</Text>
          {item.issuer ? (
            <Text style={styles.issuer} numberOfLines={1}>
              {item.issuer}
            </Text>
          ) : null}
          {item.amount_label ? (
            <Text style={styles.amount}>{item.amount_label}</Text>
          ) : null}
        </View>
        {item.activity_date ? (
          <Text style={styles.date}>{item.activity_date}</Text>
        ) : null}
      </View>
    </DarkPoolFeedCard>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    avatar: {},
    name: {
      fontSize: 15,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      textAlign: 'left',
      writingDirection: 'rtl',
    },
    tickerRow: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tokens.colors.border.subtle,
    },
    tickerText: { flex: 1, alignItems: 'flex-start' },
    ticker: {
      fontSize: 16,
      fontWeight: '800',
      color: tokens.colors.primary.main,
      writingDirection: 'ltr',
    },
    issuer: {
      fontSize: 12,
      color: tokens.colors.text.secondary,
      marginTop: 2,
      writingDirection: 'rtl',
      textAlign: 'left',
    },
    amount: {
      fontSize: 11,
      color: tokens.colors.text.tertiary,
      marginTop: 4,
      writingDirection: 'rtl',
      textAlign: 'left',
    },
    date: {
      fontSize: 11,
      color: tokens.colors.text.tertiary,
      writingDirection: 'rtl',
    },
  });
}
