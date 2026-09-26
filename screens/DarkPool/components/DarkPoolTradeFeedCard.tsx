/**
 * כרטיס עסקה בפיד — קל יותר מגיבור פרטי העסקה:
 *
 *   UICard חיצוני (זכוכית)
 *     דיוקן + שם + רמז תפקיד + משפט (פועל צבעוני / rest מעומעם) + meta
 *
 * בלי קן טיקר/מחיר — זה נשאר בכרטיס הראשי של פרטי העסקה.
 * הקשה על הכרטיס = פרטי עסקה. הקשה על דיוקן/שם = פרופיל.
 * לא מניות מומצאות מטווח STOCK Act.
 */

import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { InsiderAvatar } from './InsiderAvatar';
import { DarkPoolFeedCard } from './DarkPoolFeedCard';
import { DarkPoolNestedQuoteCard } from './DarkPoolNestedQuoteCard';
import {
  DARK_POOL_UNAVAILABLE,
  formatReturnPct,
  returnTone,
} from '../utils/congressTradeDisplay';
import { formatFeedLivePriceText } from '../utils/feedQuoteSlots';
import {
  createTradeHeroCardStyles,
  FEED_AVATAR_SIZE,
} from './darkPoolFeedCardStyles';
import { formatInsiderDisplayName } from '../utils/investorPlaceholder';
import { resolveFeedPortraitUrl } from '../utils/feedPortrait';
import {
  buildCongressTradeDetailSummary,
  buildInsiderTradeDetailSummary,
} from '../utils/tradeDetailSummary';

interface Props {
  ticker: string;
  personName: string;
  transactionType: string;
  /** Form 4 `Shares` מדויק — לא midpoint של STOCK Act. */
  shares?: number | null;
  amountLabel?: string | null;
  /** Form 4 מחיר למניה — 0 בהענקה = אין מחיר, לא "$0". */
  price?: number | null;
  transactionDate?: string | null;
  changeSinceTradePct?: number | null;
  currentPrice?: number | null;
  portraitUrl?: string | null;
  personId?: string | null;
  onPersonPress?: () => void;
  onCardPress?: () => void;
  onTickerPress?: () => void;
  personKind?: 'politician' | 'insider';
  /** תפקיד בכיר — קונגרס מקבל «חבר קונגרס». */
  personHint?: string | null;
}

const CONGRESS_HINT = 'חבר קונגרס';

export function DarkPoolTradeFeedCard({
  ticker,
  personName,
  transactionType,
  shares,
  amountLabel,
  price,
  transactionDate,
  changeSinceTradePct,
  currentPrice,
  portraitUrl,
  personId,
  onPersonPress,
  onCardPress,
  onTickerPress,
  personKind = 'insider',
  personHint: personHintProp,
}: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createTradeHeroCardStyles(tokens), [tokens]);
  const isCongress = personKind === 'politician';
  const displayName =
    personKind === 'insider' ? formatInsiderDisplayName(personName) : personName;
  const personHint = isCongress ? CONGRESS_HINT : personHintProp ?? null;
  const logoUrl = resolveFeedPortraitUrl({
    storedUrl: portraitUrl,
    personKind,
    personId,
    personName: displayName,
  });

  const summary = isCongress
    ? buildCongressTradeDetailSummary({
        transactionType,
        ticker,
        amountLabel,
        transactionDate,
      })
    : buildInsiderTradeDetailSummary({
        transactionType,
        ticker,
        shares,
        price,
        transactionDate,
      });
  const tone = summary.tone;
  const toneColor =
    tone === 'buy'
      ? tokens.colors.primary.main
      : tone === 'sell'
        ? tokens.colors.text.danger
        : tokens.colors.text.primary;

  const a11y = [displayName, personHint, summary.sentence]
    .filter(Boolean)
    .join(', ');

  const priceText = formatFeedLivePriceText(currentPrice);
  const sinceTradeText = formatReturnPct(changeSinceTradePct);
  const sinceTradeTone = returnTone(changeSinceTradePct);
  const sinceTradeColor =
    sinceTradeTone === 'positive'
      ? tokens.colors.primary.main
      : sinceTradeTone === 'negative'
        ? tokens.colors.text.danger
        : tokens.colors.text.secondary;
  const openTicker = onTickerPress ?? onCardPress;

  return (
    <DarkPoolFeedCard
      style={styles.heroCard}
      onPress={onCardPress ?? onPersonPress}
      accessibilityLabel={a11y}
      haptic
    >
      <View style={styles.heroBody}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={onPersonPress}
            disabled={!onPersonPress}
            style={styles.avatarHit}
            accessibilityRole={onPersonPress ? 'button' : undefined}
            accessibilityLabel={onPersonPress ? `פרופיל ${displayName}` : undefined}
          >
            <InsiderAvatar
              name={displayName}
              logoUrl={logoUrl}
              size={FEED_AVATAR_SIZE}
            />
          </Pressable>
          <View style={styles.textCol}>
            <Pressable
              onPress={onPersonPress}
              disabled={!onPersonPress}
              accessibilityRole={onPersonPress ? 'button' : undefined}
              accessibilityLabel={onPersonPress ? `פרופיל ${displayName}` : undefined}
            >
              <Text style={styles.personName} numberOfLines={2} ellipsizeMode="tail">
                {displayName}
              </Text>
              {personHint ? (
                <Text
                  style={[
                    styles.personHint,
                    !isCongress ? styles.personHintLtr : null,
                  ]}
                  numberOfLines={1}
                >
                  {personHint}
                </Text>
              ) : null}
            </Pressable>
            <Text
              style={[styles.action, personHint ? null : styles.actionAfterName]}
              accessibilityLabel={summary.sentence}
            >
              <Text style={[styles.actionVerb, { color: toneColor }]}>
                {summary.verb}
              </Text>
              {summary.primaryRender ? (
                <Text style={styles.actionRest}> {summary.primaryRender}</Text>
              ) : null}
            </Text>
            {summary.metaRender ? (
              <Text style={styles.actionMeta}>{summary.metaRender}</Text>
            ) : null}
          </View>
        </View>

        <Pressable
          onPress={openTicker}
          disabled={!openTicker}
          accessibilityRole={openTicker ? 'button' : undefined}
          accessibilityLabel={openTicker ? `עמוד המניה ${ticker}` : undefined}
        >
          <DarkPoolNestedQuoteCard
            ticker={ticker}
            priceText={priceText}
            changeText={sinceTradeText}
            changeColor={sinceTradeColor}
            changeTone={sinceTradeText ? sinceTradeTone : undefined}
            missingText={!priceText ? DARK_POOL_UNAVAILABLE : null}
          />
        </Pressable>
      </View>
    </DarkPoolFeedCard>
  );
}
