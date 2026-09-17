/**
 * שורת עסקה בפיד — שלוש שכבות בעלות רוחב יציב:
 *
 *   [דיוקן]  שם האדם                                    ← יעד הקשה: פרופיל האדם
 *            נחשף לפני 22 שעות · בוצע לפני 4 שבועות      ← עיכוב הדיווח
 *   קנה את $NVDA · בשווי: $15K–$50K                      ← עד 2 שורות, ellipsis
 *   ┌ [לוגו] $NVDA · $231.40 ······· מאז העסקה +24.1% ┐  ← פס מידע, לא לחיץ
 *
 * הקשה על הכרטיס פותחת את פרטי העסקה; הקשה על הדיוקן/השם פותחת את הפרופיל.
 * פס הטיקר אינפורמטיבי בלבד — אין ניווט לתיק המניה (הוסר בכוונה).
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import { DarkPoolFeedCard } from './DarkPoolFeedCard';
import { InsiderAvatar } from './InsiderAvatar';
import { darkPoolTextRtl } from '../darkPoolLayout';
import { formatInsiderDisplayName } from '../utils/investorPlaceholder';
import { toDataIsland } from '../utils/bidi';
import {
  buildDualDateLine,
  formatReturnPct,
  returnTone,
} from '../utils/congressTradeDisplay';
import {
  formatFeedTickerDisplay,
  getFeedTradeSide,
  getFeedTradeVerb,
} from '../utils/feedTradeDisplay';

/** רוחב קבוע לעמודת התשואה — שם עברי ארוך לא יכול לדחוף אותה החוצה. */
const RETURN_COL_WIDTH = 86;

interface Props {
  ticker: string;
  personName: string;
  transactionType: string;
  sharesLabel?: string | null;
  amountLabel?: string | null;
  filedAt: string;
  /** תאריך ביצוע — מפעיל את שורת התאריך הכפול */
  transactionDate?: string | null;
  /** שינוי מחיר מאז יום העסקה, באחוזים. null = לא מוצג (לעולם לא 0 מזויף). */
  changeSinceTradePct?: number | null;
  /** מחיר מניה נוכחי מה-quote; null = הפס מציג רק את הטיקר */
  currentPrice?: number | null;
  portraitUrl?: string | null;
  /** פרופיל האדם */
  onPersonPress?: () => void;
  /** פרטי העסקה — יעד ההקשה הראשי של הכרטיס */
  onCardPress?: () => void;
  personKind?: 'politician' | 'insider';
}

/** function (לא memo) — יציב ל־Fast Refresh אחרי החלפת לוגו/ExpoImage */
export function DarkPoolTradeFeedCard({
  ticker,
  personName,
  transactionType,
  sharesLabel,
  amountLabel,
  filedAt,
  transactionDate,
  changeSinceTradePct,
  currentPrice,
  portraitUrl,
  onPersonPress,
  onCardPress,
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
  const tickerSym = formatFeedTickerDisplay(ticker);
  const kindLabel = personKind === 'politician' ? 'קונגרס' : 'בכיר';

  const dates = useMemo(
    () => buildDualDateLine({ filedAt, transactionDate }),
    [filedAt, transactionDate]
  );

  const changeText = formatReturnPct(changeSinceTradePct);
  const tone = returnTone(changeSinceTradePct);
  const changeColor =
    tone === 'positive'
      ? tokens.colors.primary.main
      : tone === 'negative'
        ? tokens.colors.text.danger
        : tokens.colors.text.secondary;

  const priceText =
    currentPrice != null && Number.isFinite(currentPrice) && currentPrice > 0
      ? `$${currentPrice.toFixed(2)}`
      : null;

  const detailParts = [sharesLabel, amountLabel, kindLabel].filter(Boolean) as string[];
  const showStrip = Boolean(priceText || changeText);

  const a11y = [
    displayName,
    dates.text,
    verb,
    tickerSym,
    sharesLabel,
    amountLabel,
    kindLabel,
    changeText ? `מאז העסקה ${changeText}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <DarkPoolFeedCard onPress={onCardPress ?? onPersonPress} accessibilityLabel={a11y}>
      <View style={styles.personRow}>
        <Pressable
          onPress={onPersonPress}
          disabled={!onPersonPress}
          accessibilityRole={onPersonPress ? 'button' : undefined}
          accessibilityLabel={onPersonPress ? `פרופיל ${displayName}` : undefined}
          hitSlop={6}
          style={styles.personTarget}
        >
          <InsiderAvatar name={displayName} logoUrl={portraitUrl} size={40} />
          <View style={styles.personText}>
            <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
              {displayName}
            </Text>
            {dates.text ? (
              <Text style={styles.dates} numberOfLines={1} ellipsizeMode="tail">
                {dates.text}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </View>

      <Text style={styles.action} numberOfLines={2} ellipsizeMode="tail">
        <Text style={{ color: sideColor, fontWeight: '800' }}>{verb} את </Text>
        <Text style={styles.ticker}>{toDataIsland(tickerSym)}</Text>
        {detailParts.length > 0 ? (
          <Text style={styles.actionMeta}>
            {` · ${detailParts
              .map((part) => (/\$|\d/.test(part) ? toDataIsland(part) : part))
              .join(' · ')}`}
          </Text>
        ) : null}
      </Text>

      {showStrip ? (
        <View style={styles.strip} accessibilityRole="summary">
          <View style={styles.stripStart}>
            <TickerLogo symbol={ticker} size={18} borderRadius={9} />
            <Text style={styles.stripTicker} numberOfLines={1}>
              {toDataIsland(tickerSym)}
            </Text>
            {priceText ? (
              <Text style={styles.stripPrice} numberOfLines={1}>
                {toDataIsland(priceText)}
              </Text>
            ) : null}
          </View>
          {changeText ? (
            <View style={styles.stripEnd}>
              <Text style={styles.stripLabel} numberOfLines={1}>
                מאז העסקה
              </Text>
              <Text
                style={[styles.stripChange, { color: changeColor }]}
                numberOfLines={1}
              >
                {toDataIsland(changeText)}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </DarkPoolFeedCard>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    personRow: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
    },
    personTarget: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      flexBasis: 0,
      minWidth: 0,
    },
    personText: {
      flex: 1,
      flexBasis: 0,
      minWidth: 0,
      gap: 1,
    },
    name: {
      ...darkPoolTextRtl,
      fontSize: tokens.typography.subhead.size,
      lineHeight: 20,
      fontWeight: tokens.typography.fontWeight.bold,
      color: tokens.colors.text.primary,
    },
    dates: {
      ...darkPoolTextRtl,
      fontSize: tokens.typography.caption2.size,
      lineHeight: 15,
      fontWeight: tokens.typography.fontWeight.medium,
      color: tokens.colors.text.tertiary,
    },
    action: {
      ...darkPoolTextRtl,
      marginTop: 8,
      fontSize: tokens.typography.subhead.size,
      lineHeight: 20,
      fontWeight: tokens.typography.fontWeight.bold,
      color: tokens.colors.text.primary,
    },
    ticker: {
      fontWeight: tokens.typography.fontWeight.extrabold,
      color: tokens.colors.text.primary,
      letterSpacing: 0.2,
    },
    actionMeta: {
      fontSize: tokens.typography.caption.size,
      fontWeight: tokens.typography.fontWeight.medium,
      color: tokens.colors.text.secondary,
    },
    strip: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: tokens.borderRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tokens.colors.border.subtle,
      backgroundColor: tokens.colors.glass.card.bg,
    },
    stripStart: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
      flexBasis: 0,
      minWidth: 0,
    },
    stripTicker: {
      fontSize: tokens.typography.caption.size,
      fontWeight: tokens.typography.fontWeight.extrabold,
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
      letterSpacing: 0.2,
    },
    stripPrice: {
      fontSize: tokens.typography.caption.size,
      fontWeight: tokens.typography.fontWeight.medium,
      color: tokens.colors.text.secondary,
      fontVariant: ['tabular-nums'],
      writingDirection: 'ltr',
    },
    stripEnd: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      width: RETURN_COL_WIDTH,
      minWidth: RETURN_COL_WIDTH,
      maxWidth: RETURN_COL_WIDTH,
      flexGrow: 0,
      flexShrink: 0,
    },
    stripLabel: {
      fontSize: tokens.typography.caption2.size,
      lineHeight: 13,
      fontWeight: tokens.typography.fontWeight.medium,
      color: tokens.colors.text.tertiary,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    stripChange: {
      fontSize: tokens.typography.footnote.size,
      lineHeight: 17,
      fontWeight: tokens.typography.fontWeight.extrabold,
      fontVariant: ['tabular-nums'],
      textAlign: 'right',
      writingDirection: 'ltr',
    },
  });
}
