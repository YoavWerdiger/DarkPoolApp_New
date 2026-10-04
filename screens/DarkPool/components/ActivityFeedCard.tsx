import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import type { FollowingActivityItem } from '../../../services/darkpool/uwFollowingFeedService';
import { DarkPoolFeedCard } from './DarkPoolFeedCard';
import { APP_LAYOUT } from '../../../components/ui/appLayout';
import { APP_TYPE } from '../../../components/ui/appType';
import { FEED_CARD_TYPE } from './darkPoolFeedCardStyles';
import { darkPoolPhysicalRightText } from '../darkPoolLayout';
import { isolateData, ltrNameText } from '../utils/bidi';
import { formatInsiderDisplayName } from '../utils/investorPlaceholder';
import {
  formatFeedDisclosureRange,
  formatFeedTickerDisplay,
  getFeedTradeSide,
  getFeedTradeVerb,
  withFeedValueLabel,
} from '../utils/feedTradeDisplay';

/** Left-to-right mark — שומר טיקר/$ בלי ערבוב RTL */
const LRM = '\u200E';

interface Props {
  item: FollowingActivityItem;
  onPersonPress?: () => void;
  /** פרטי עסקה — יעד ההקשה הראשי כשקיים. */
  onDetailPress?: () => void;
  showDivider?: boolean;
  currentPrice?: number | null;
}

function formatActivityAmountLabel(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  // כמות מניות — לא שווי כספי
  if (/מניות/.test(trimmed)) return trimmed;
  return withFeedValueLabel(formatFeedDisclosureRange(trimmed) ?? trimmed);
}

export function ActivityFeedCard({
  item,
  onPersonPress,
  onDetailPress,
}: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const tickerSym = formatFeedTickerDisplay(item.ticker);
  const displayName =
    item.person_kind === 'insider'
      ? formatInsiderDisplayName(item.person_name)
      : item.person_name;
  const sourceLabel = item.source === 'congress' ? 'קונגרס' : 'בכיר';
  const side = getFeedTradeSide(item.txn_label || '');
  const verb = getFeedTradeVerb(side);
  const sideColor =
    side === 'buy' ? tokens.colors.primary.main : tokens.colors.text.danger;

  const amountLabel = formatActivityAmountLabel(item.amount_label);
  const detailParts = [amountLabel, sourceLabel].filter(Boolean);

  const a11y = [
    displayName,
    verb,
    tickerSym,
    sourceLabel,
    amountLabel,
    item.filed_label,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <DarkPoolFeedCard onPress={onDetailPress ?? onPersonPress} accessibilityLabel={a11y}>
      <View style={styles.row}>
        <View style={styles.tickerCol}>
          <TickerLogo symbol={item.ticker} size={40} borderRadius={20} />
        </View>

        <View style={styles.main}>
          <View style={styles.sentence}>
            <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
              {displayName}
            </Text>
            <Text style={styles.wordSpace}>{'\u00A0'}</Text>
            <Text style={[styles.verb, { color: sideColor }]} numberOfLines={1}>
              {verb}
            </Text>
            {tickerSym ? (
              <>
                <Text style={styles.wordSpace}>{'\u00A0'}</Text>
                <Text style={styles.ticker} numberOfLines={1}>
                  {isolateData(tickerSym)}
                </Text>
              </>
            ) : null}
          </View>
          {detailParts.length > 0 ? (
            <Text style={styles.sub} numberOfLines={1} ellipsizeMode="tail">
              {detailParts
                .map((part) => (/\$|\d/.test(part!) ? `${LRM}${part}` : part))
                .join(' · ')}
            </Text>
          ) : null}
        </View>

        <View style={styles.meta}>
          {item.filed_label || item.activity_date ? (
            <Text style={styles.time} numberOfLines={1}>
              {item.filed_label || item.activity_date}
            </Text>
          ) : null}
        </View>
      </View>
    </DarkPoolFeedCard>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    row: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      gap: APP_LAYOUT.cardTitleToBodyGap,
    },
    tickerCol: {
      width: 40,
      height: 40,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    main: {
      flex: 1,
      minWidth: 0,
      direction: 'ltr',
      alignItems: 'stretch',
      gap: APP_LAYOUT.cardTitleToSubtitleGap,
    },
    sentence: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      minWidth: 0,
    },
    wordSpace: {
      flexShrink: 0,
      fontSize: FEED_CARD_TYPE.action.fontSize,
      lineHeight: FEED_CARD_TYPE.action.lineHeight,
    },
    name: {
      ...ltrNameText,
      flexShrink: 1,
      minWidth: 0,
      fontSize: FEED_CARD_TYPE.action.fontSize,
      lineHeight: FEED_CARD_TYPE.action.lineHeight,
      fontWeight: APP_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
    },
    verb: {
      flexShrink: 0,
      writingDirection: 'rtl',
      fontSize: FEED_CARD_TYPE.action.fontSize,
      lineHeight: FEED_CARD_TYPE.action.lineHeight,
      fontWeight: FEED_CARD_TYPE.action.fontWeight,
    },
    sub: {
      ...darkPoolPhysicalRightText,
      width: '100%',
      fontSize: FEED_CARD_TYPE.dates.fontSize,
      lineHeight: FEED_CARD_TYPE.dates.lineHeight,
      fontWeight: FEED_CARD_TYPE.dates.fontWeight,
      color: tokens.colors.text.secondary,
    },
    ticker: {
      flexShrink: 0,
      writingDirection: 'ltr',
      fontSize: FEED_CARD_TYPE.action.fontSize,
      lineHeight: FEED_CARD_TYPE.action.lineHeight,
      fontWeight: FEED_CARD_TYPE.name.fontWeight,
      color: tokens.colors.text.primary,
      letterSpacing: 0,
    },
    muted: {
      color: tokens.colors.text.secondary,
      fontWeight: FEED_CARD_TYPE.dates.fontWeight,
    },
    meta: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      flexShrink: 0,
      maxWidth: 88,
    },
    time: {
      fontSize: APP_TYPE.caption.fontSize,
      lineHeight: APP_TYPE.caption.lineHeight,
      fontWeight: APP_TYPE.caption.fontWeight,
      color: tokens.colors.text.secondary,
      textAlign: 'right',
      fontVariant: ['tabular-nums'],
    },
  });
}
