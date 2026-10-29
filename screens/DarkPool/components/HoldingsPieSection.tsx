import React, { useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../../components/ui/UICard';
import { SignedChange } from '../../../components/ui/ChangeDot';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../../components/ui/appLayout';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { DistributionDonut } from '../../Portfolios/components/DistributionDonut';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import {
  holdingsToDistributionSlices,
  sliceColorByTicker,
  type HoldingAllocationInput,
  type HoldingWeightStyle,
} from '../utils/holdingsAllocation';
import { toDataIsland } from '../utils/bidi';
import { formatHoldingRowAllocation } from '../utils/investorHoldings';
import {
  DARK_POOL_TYPE,
  darkPoolPhysicalRightText,
  darkPoolSectionTitleStyle,
} from '../darkPoolLayout';

/** כמה שורות מקרא נראות בלי גלילה (≈ גובה העוגה) */
// חצי שורה גלויה בתחתית — רמז שאפשר לגלול
const LEGEND_VISIBLE_ROWS = 6.5;
const LEGEND_ROW_HEIGHT = 26;
/** מעבר לזה — השאר מתקבצים ל«אחר» (תיק של מאות מניות) */
const LEGEND_MAX_ROWS = 301;

interface Props {
  title?: string;
  holdings: HoldingAllocationInput[];
  /** תמונת האדם במרכז העוגה (כמו בתיק אישי) */
  avatarUrl?: string | null;
  /** מועמדים מאותו מקור כמו ProfileHeroAvatar — עם fallback בטעינה */
  avatarCandidates?: string[] | null;
  userInitial?: string;
  weightStyle?: HoldingWeightStyle;
  honestyTag?: string | null;
  onHelpPress?: () => void;
  helpA11yLabel?: string;
}

/**
 * פילוח אחזקות — donut + מקרא (במקום אחוזים + progress bar בכל שורה).
 */
export function HoldingsPieSection({
  title = 'פילוח אחזקות',
  holdings,
  avatarUrl,
  avatarCandidates,
  userInitial,
  weightStyle = 'filing',
  honestyTag,
  onHelpPress,
  helpA11yLabel,
}: Props) {
  const tokens = useDesignTokens();
  // כל אחזקה עם צבע משלה — בעוגה ובמקרא (בלי «אחר» אפור). «אחר» רק אם לא הגיעו כל האחזקות.
  const slices = useMemo(
    () =>
      holdingsToDistributionSlices(holdings, LEGEND_MAX_ROWS).map((sl) =>
        sl.key === '__other__' ? { ...sl, color: tokens.colors.text.tertiary } : sl
      ),
    [holdings, tokens.colors.text.tertiary]
  );
  const colorByTicker = useMemo(() => sliceColorByTicker(slices), [slices]);
  const legendRows = slices;
  const scrollable = legendRows.length > LEGEND_VISIBLE_ROWS;
  // פס גלילה קבוע (iOS מציג את המובנה רק בזמן גלילה) — שיהיה ברור שיש עוד
  const scrollY = useRef(new Animated.Value(0)).current;
  const [viewH, setViewH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const thumbH = contentH > 0 && viewH > 0 ? Math.max(24, (viewH * viewH) / contentH) : 0;
  const maxScroll = Math.max(1, contentH - viewH);
  const thumbY = scrollY.interpolate({
    inputRange: [0, maxScroll],
    outputRange: [0, Math.max(0, viewH - thumbH)],
    extrapolate: 'clamp',
  });
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const allocByTicker = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of holdings) {
      if (h.allocation_pct != null && Number.isFinite(h.allocation_pct)) {
        map.set(h.ticker.toUpperCase(), h.allocation_pct);
      }
    }
    return map;
  }, [holdings]);

  if (slices.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {honestyTag && honestyTag !== 'משוער' ? (
          <Text style={styles.honestyTag}>{honestyTag}</Text>
        ) : null}
        {onHelpPress ? (
          <Pressable
            onPress={onHelpPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={helpA11yLabel ?? honestyTag ?? 'על המספרים'}
            style={styles.helpBtn}
          >
            <Ionicons
              name="help-circle-outline"
              size={16}
              color={tokens.colors.text.secondary}
            />
          </Pressable>
        ) : null}
      </View>
      <UICard
        variant="soft"
        padding="md"
        style={styles.card}
        contentContainerStyle={styles.cardContent}
      >
        <View style={styles.donutWrap}>
        <DistributionDonut
          slices={slices}
          size={128}
          strokeWidth={18}
          avatarUrl={avatarUrl}
          avatarCandidates={avatarCandidates}
          userInitial={userInitial}
        />
        <View style={styles.legendBox}>
        <ScrollView
          style={styles.legendScroll}
          contentContainerStyle={[styles.legend, scrollable && styles.legendWithBar]}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          scrollEnabled={scrollable}
          scrollEventThrottle={16}
          onLayout={(e) => setViewH(e.nativeEvent.layout.height)}
          onContentSizeChange={(_, h) => setContentH(h)}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: false,
          })}
        >
          {legendRows.map((s) => {
            const raw = s.key === '__other__' ? s.percentage : allocByTicker.get(s.key) ?? s.percentage;
            return (
              <View key={s.key} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                <Text style={styles.legendLabel} numberOfLines={1}>
                  {s.label}
                </Text>
                <Text style={styles.legendPct}>
                  {formatHoldingRowAllocation(raw, weightStyle)}
                </Text>
              </View>
            );
          })}
        </ScrollView>
        {scrollable && thumbH > 0 ? (
          <View style={[styles.scrollTrack, { backgroundColor: tokens.colors.border.divider }]} pointerEvents="none">
            <Animated.View
              style={[
                styles.scrollThumb,
                { height: thumbH, backgroundColor: tokens.colors.text.tertiary, transform: [{ translateY: thumbY }] },
              ]}
            />
          </View>
        ) : null}
        </View>
        </View>
      </UICard>
    </View>
  );
}

/**
 * שורת אחזקה RTL:
 *   [לוגו] TICKER                 $שווי
 *          הקצאה%                 תשואה
 * לוגו+טיקר מימין הפיזי (textAlign ימין); שווי+תשואה משמאל הפיזי.
 */
export function HoldingsListRow({
  ticker,
  allocationLabel,
  valueLabel,
  returnLabel,
  returnPct,
  colorByTicker,
}: {
  ticker: string;
  allocationLabel: string;
  valueLabel: string;
  returnLabel: string;
  returnPct?: number | null;
  colorByTicker: Map<string, string>;
}) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createRowStyles(tokens), [tokens]);
  const hasReturn = returnPct != null && Number.isFinite(returnPct);
  const retColor = !hasReturn
    ? tokens.colors.text.secondary
    : (returnPct as number) >= 0
      ? tokens.colors.primary.main
      : tokens.colors.text.danger;

  return (
    <View style={styles.holdingRow}>
      <View style={styles.leadingIcon}>
        <TickerLogo symbol={ticker} size={36} borderRadius={18} />
      </View>
      <View style={styles.iconTickerGap} />
      <View style={styles.holdingTickerCol}>
        <View style={styles.tickerLine}>
          <Text style={styles.ticker} numberOfLines={1}>
            {toDataIsland(ticker)}
          </Text>
          <HoldingTickerDot ticker={ticker} colorByTicker={colorByTicker} />
        </View>
        <Text style={styles.allocation} numberOfLines={1}>
          {toDataIsland(allocationLabel)}
        </Text>
      </View>
      <View style={styles.holdingValueCol}>
        <Text style={styles.holdingValue} numberOfLines={1}>
          {toDataIsland(valueLabel)}
        </Text>
        {hasReturn ? (
          <SignedChange
            value={returnPct}
            style={styles.holdingReturnRow}
            textStyle={styles.holdingReturn}
            isolate={toDataIsland}
          >
            {returnLabel}
          </SignedChange>
        ) : null}
      </View>
    </View>
  );
}

/** נקודת צבע ליד טיקר ברשימה — תואמת ל-slice בעוגה */
export function HoldingTickerDot({
  ticker,
  colorByTicker,
}: {
  ticker: string;
  colorByTicker: Map<string, string>;
}) {
  const color = colorByTicker.get(ticker.toUpperCase());
  if (!color) return null;
  return (
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: color,
        flexShrink: 0,
      }}
    />
  );
}

export function useHoldingsPieColors(holdings: HoldingAllocationInput[]) {
  return useMemo(() => {
    const slices = holdingsToDistributionSlices(holdings, LEGEND_MAX_ROWS);
    return sliceColorByTicker(slices);
  }, [holdings]);
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    section: {
      marginBottom: APP_LAYOUT.sectionGap,
    },
    card: {
      borderRadius: UI_CARD_RADIUS,
    },
    /** UICard שכבת תוכן עם overflow:hidden חותכת שורת מקרא תחתונה (אחר) ליד מסגרת הזכוכית */
    cardContent: {
      overflow: 'visible',
    },
    titleRow: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      gap: APP_LAYOUT.stackGapSmall,
      marginBottom: APP_LAYOUT.sectionHeaderToContent,
    },
    title: {
      ...darkPoolSectionTitleStyle,
      color: tokens.colors.text.primary,
      flexShrink: 1,
    },
    honestyTag: {
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.caption.lineHeight,
      fontWeight: DARK_POOL_TYPE.caption.fontWeight,
      color: tokens.colors.text.secondary,
      ...darkPoolPhysicalRightText,
    },
    helpBtn: {
      padding: 2,
    },
    donutWrap: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      gap: APP_LAYOUT.componentGap,
    },
    // גלילה בתוך הכרטיס — לא חורג מגבולותיו
    legendBox: {
      flex: 1,
      // פס הגלילה בצד השמאלי הפיזי — direction ltr כדי ש-left יהיה פיזי
      direction: 'ltr',
    },
    legendScroll: {
      maxHeight: LEGEND_VISIBLE_ROWS * LEGEND_ROW_HEIGHT,
    },
    // מרווח בין האחוזים לפס הגלילה
    legendWithBar: {
      paddingLeft: 14,
    },
    scrollTrack: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
      borderRadius: 1.5,
      overflow: 'hidden',
    },
    scrollThumb: {
      width: 3,
      borderRadius: 1.5,
    },
    legend: {
      gap: APP_LAYOUT.stackGapSmall,
      paddingBottom: 2,
    },
    legendRow: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendLabel: {
      flex: 1,
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.caption.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
      ...darkPoolPhysicalRightText,
    },
    legendPct: {
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      lineHeight: DARK_POOL_TYPE.caption.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.secondary,
      writingDirection: 'ltr',
      fontVariant: ['tabular-nums'],
    },
  });
}

function createRowStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    holdingRow: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      width: '100%',
      paddingVertical: APP_LAYOUT.cardTitleToBodyGap,
      paddingHorizontal: APP_LAYOUT.cardPadding,
      minHeight: 56,
    },
    leadingIcon: {
      flexShrink: 0,
    },
    iconTickerGap: {
      width: 12,
      flexShrink: 0,
    },
    holdingTickerCol: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      justifyContent: 'center',
      alignItems: 'stretch',
    },
    tickerLine: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: 8,
      minWidth: 0,
      maxWidth: '100%',
    },
    ticker: {
      direction: 'ltr',
      textAlign: 'right',
      writingDirection: 'ltr',
      fontSize: DARK_POOL_TYPE.cardBody.fontSize,
      fontVariant: ['tabular-nums'],
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
      lineHeight: DARK_POOL_TYPE.cardBody.lineHeight,
      flexShrink: 1,
    },
    allocation: {
      direction: 'ltr',
      textAlign: 'right',
      writingDirection: 'ltr',
      marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
      includeFontPadding: false,
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.caption.lineHeight,
      fontWeight: DARK_POOL_TYPE.caption.fontWeight,
      color: tokens.colors.text.secondary,
    },
    holdingValueCol: {
      flexShrink: 0,
      minWidth: 72,
      gap: APP_LAYOUT.cardTitleToSubtitleGap,
      direction: 'ltr',
      alignItems: 'stretch',
    },
    holdingValue: {
      direction: 'ltr',
      textAlign: 'right',
      writingDirection: 'ltr',
      fontSize: DARK_POOL_TYPE.cardBody.fontSize,
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
      lineHeight: DARK_POOL_TYPE.cardBody.lineHeight,
      fontVariant: ['tabular-nums'],
    },
    holdingReturnRow: {
      alignSelf: 'stretch',
      justifyContent: 'flex-end',
    },
    holdingReturn: {
      direction: 'ltr',
      textAlign: 'right',
      writingDirection: 'ltr',
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      lineHeight: DARK_POOL_TYPE.caption.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      fontVariant: ['tabular-nums'],
    },
  });
}
