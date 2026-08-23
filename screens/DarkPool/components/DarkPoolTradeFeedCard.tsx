/**
 * כרטיס עסקה בפיד — קומפקטי:
 * [אווטאר] שם                         זמן
 *           קנייה · NVDA · $1,001–$15,000
 */

import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import { DarkPoolFeedCard } from './DarkPoolFeedCard';
import { InvestorPortrait } from './InvestorPortrait';
import { formatRelativeTime } from '../utils/darkPoolFormat';
import { formatInsiderDisplayName } from '../utils/investorPlaceholder';
import { getFeedTradeSide, getFeedTradeVerb } from '../utils/feedTradeDisplay';

/** Left-to-right mark — שומר טיקר/$ בלי ערבוב RTL */
const LRM = '\u200E';

interface Props {
  ticker: string;
  personName: string;
  transactionType: string;
  sharesLabel?: string | null;
  amountLabel?: string | null;
  filedAt: string;
  sinceTradePct?: number | null;
  onPress?: () => void;
  personImageUrl?: string | null;
  personId?: string;
  personKind?: 'politician' | 'insider';
}

export const DarkPoolTradeFeedCard = memo(function DarkPoolTradeFeedCard({
  ticker,
  personName,
  transactionType,
  sharesLabel,
  amountLabel,
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
  const isBuy = side === 'buy';
  const verb = getFeedTradeVerb(side);
  const displayName =
    personKind === 'insider' ? formatInsiderDisplayName(personName) : personName;
  const sideColor = isBuy ? tokens.colors.primary.main : tokens.colors.text.danger;
  const tickerSym = ticker.toUpperCase();

  const sincePctText =
    sinceTradePct == null
      ? null
      : `${sinceTradePct >= 0 ? '+' : ''}${(sinceTradePct * 100).toFixed(1)}%`;

  const a11y = [
    displayName,
    verb,
    sharesLabel,
    tickerSym,
    amountLabel,
    sincePctText,
    formatRelativeTime(filedAt),
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <DarkPoolFeedCard onPress={onPress} accessibilityLabel={a11y}>
      <View style={styles.row}>
        <View style={styles.avatarCol}>
          <InvestorPortrait
            name={displayName}
            imageUrl={personImageUrl}
            kind={personKind}
            personId={personId}
            ticker={ticker}
            layout="circle"
            size={40}
          />
          <View style={styles.tickerBadge}>
            <TickerLogo symbol={ticker} size={18} borderRadius={9} />
          </View>
        </View>

        <View style={styles.main}>
          <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
            {displayName}
          </Text>
          <Text style={styles.sub} numberOfLines={1} ellipsizeMode="tail">
            <Text style={{ color: sideColor, fontWeight: '800' }}>{verb}</Text>
            {sharesLabel ? (
              <Text style={styles.muted}>{` · ${sharesLabel}`}</Text>
            ) : null}
            <Text style={styles.muted}>{' · '}</Text>
            <Text style={styles.ticker}>
              {LRM}
              {tickerSym}
            </Text>
            {amountLabel ? (
              <Text style={styles.muted}>
                {' · '}
                {LRM}
                {amountLabel}
              </Text>
            ) : null}
          </Text>
        </View>

        <View style={styles.meta}>
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
              numberOfLines={1}
            >
              {sincePctText}
            </Text>
          ) : null}
          <Text style={styles.time} numberOfLines={1}>
            {formatRelativeTime(filedAt)}
          </Text>
        </View>
      </View>
    </DarkPoolFeedCard>
  );
});

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    avatarCol: {
      width: 40,
      height: 40,
      position: 'relative',
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tickerBadge: {
      position: 'absolute',
      bottom: -2,
      end: -2,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: tokens.colors.background.primary,
      backgroundColor: '#FFFFFF',
      overflow: 'hidden',
    },
    main: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    name: {
      fontSize: 14,
      fontWeight: '700',
      color: tokens.colors.text.primary,
      textAlign: 'left',
    },
    sub: {
      fontSize: 12,
      fontWeight: '500',
      color: tokens.colors.text.secondary,
      textAlign: 'left',
    },
    ticker: {
      fontWeight: '800',
      color: tokens.colors.text.primary,
      letterSpacing: 0.2,
    },
    muted: {
      color: tokens.colors.text.tertiary,
      fontWeight: '500',
    },
    meta: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 2,
      flexShrink: 0,
      maxWidth: 88,
    },
    since: {
      fontSize: 13,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
      textAlign: 'right',
    },
    time: {
      fontSize: 11,
      fontWeight: '500',
      color: tokens.colors.text.tertiary,
      textAlign: 'right',
    },
  });
}
