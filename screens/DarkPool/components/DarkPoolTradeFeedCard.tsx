/**
 * כרטיס פיד — תמונת פרופיל + טיקר + פעולה + פירוט.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import { DarkPoolFeedCard } from './DarkPoolFeedCard';
import { InvestorPortrait } from './InvestorPortrait';
import { formatRelativeTime } from '../utils/darkPoolFormat';
import {
  getFeedTradeSide,
  getFeedTradeVerb,
  type FeedTradeSide,
} from '../utils/feedTradeDisplay';

interface Props {
  ticker: string;
  personName: string;
  transactionType: string;
  detail: string | null;
  filedAt: string;
  sinceTradePct?: number | null;
  onPress?: () => void;
  personImageUrl?: string | null;
  personId?: string;
  personKind?: 'politician' | 'insider';
}

export function DarkPoolTradeFeedCard({
  ticker,
  personName,
  transactionType,
  detail,
  filedAt,
  sinceTradePct,
  onPress,
  personImageUrl,
  personId,
  personKind = 'insider',
}: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const side = getFeedTradeSide(transactionType);
  const verb = getFeedTradeVerb(side);

  const sincePctText =
    sinceTradePct == null
      ? null
      : `${sinceTradePct >= 0 ? '+' : ''}${(sinceTradePct * 100).toFixed(1)}%`;

  const a11y = [personName, verb, ticker, detail, formatRelativeTime(filedAt)]
    .filter(Boolean)
    .join(' ');

  return (
    <DarkPoolFeedCard onPress={onPress} accessibilityLabel={a11y}>
      <View style={styles.row}>
        <View style={styles.avatarCol}>
          <InvestorPortrait
            name={personName}
            imageUrl={personImageUrl}
            kind={personKind}
            personId={personId}
            ticker={ticker}
            layout="circle"
            size={48}
          />
          <View style={styles.tickerBadge}>
            <TickerLogo symbol={ticker} size={22} borderRadius={6} />
          </View>
        </View>
        <View style={styles.body}>
          <View style={styles.topLine}>
            <Text style={styles.ticker}>{ticker}</Text>
            <ActionChip side={side} label={verb} tokens={tokens} />
            <Text style={styles.time}>{formatRelativeTime(filedAt)}</Text>
          </View>
          <Text style={styles.person} numberOfLines={1}>
            {personName}
          </Text>
          {detail ? (
            <Text style={styles.detail} numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </View>
        {sincePctText ? (
          <Text
            style={[
              styles.since,
              {
                color:
                  sinceTradePct! >= 0
                    ? tokens.colors.primary.main
                    : tokens.colors.text.danger,
              },
            ]}
          >
            {sincePctText}
          </Text>
        ) : null}
      </View>
    </DarkPoolFeedCard>
  );
}

function ActionChip({
  side,
  label,
  tokens,
}: {
  side: FeedTradeSide;
  label: string;
  tokens: ReturnType<typeof useDesignTokens>;
}) {
  const isBuy = side === 'buy';
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: isBuy
          ? `${tokens.colors.primary.main}22`
          : `${tokens.colors.text.danger}22`,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '800',
          color: isBuy ? tokens.colors.primary.main : tokens.colors.text.danger,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatarCol: {
      width: 48,
      height: 48,
      position: 'relative',
    },
    tickerBadge: {
      position: 'absolute',
      bottom: -4,
      end: -4,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: tokens.colors.background.primary,
      backgroundColor: tokens.colors.background.primary,
      overflow: 'hidden',
    },
    body: { flex: 1, minWidth: 0 },
    topLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    ticker: {
      fontSize: 16,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      letterSpacing: 0.3,
    },
    time: {
      marginStart: 'auto',
      fontSize: 12,
      color: tokens.colors.text.tertiary,
    },
    person: {
      marginTop: 4,
      fontSize: 14,
      fontWeight: '600',
      color: tokens.colors.text.primary,
      textAlign: 'left',
    },
    detail: {
      marginTop: 2,
      fontSize: 13,
      color: tokens.colors.text.secondary,
      textAlign: 'left',
    },
    since: {
      fontSize: 12,
      fontWeight: '700',
      minWidth: 44,
      textAlign: 'left',
    },
  });
}
