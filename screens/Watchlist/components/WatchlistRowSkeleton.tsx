import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox } from '../../../components/ui/SkeletonLoader';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import {
  colChg,
  colChgPct,
  colDrag,
  colLast,
  colSymbol,
  colVol,
  quoteRow,
} from '../watchlistTheme';

type Props = {
  delay?: number;
  index?: number;
};

/**
 * אותה טופולוגיה כמו WatchlistRow — לא היפוך שלה.
 * Yoga של המסך LTR: `quoteRow` הוא `row-reverse` בלי `direction: 'rtl'`.
 * ילד ראשון (סימבול+לוגו) מימין; מחיר / % / ווליום משמאל.
 */
function WatchlistRowSkeletonInner({ delay = 0, index = 0 }: Props) {
  const tokens = useDesignTokens();

  return (
    <View
      style={[
        quoteRow,
        styles.row,
        {
          borderBottomColor: tokens.colors.border.divider,
          borderBottomWidth: 1,
        },
        index % 2 === 1 ? styles.rowAlt : null,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={colSymbol}>
        <View style={styles.identity}>
          <View style={styles.logoWrap}>
            <SkeletonBox width={30} height={30} borderRadius={8} delay={delay} />
          </View>
          <View style={styles.textBlock}>
            <SkeletonBox width={52} height={13} delay={delay + 40} />
            <SkeletonBox width={72} height={10} delay={delay + 80} />
          </View>
        </View>
      </View>
      <View style={colLast}>
        <SkeletonBox width={48} height={13} delay={delay + 100} />
      </View>
      <View style={colChg}>
        <SkeletonBox width={40} height={12} delay={delay + 120} />
      </View>
      <View style={colChgPct}>
        <SkeletonBox width={42} height={12} delay={delay + 140} />
      </View>
      <View style={colVol}>
        <SkeletonBox width={36} height={11} delay={delay + 160} />
      </View>
      <View style={colDrag}>
        <SkeletonBox width={16} height={14} borderRadius={4} delay={delay + 180} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 8,
    minHeight: 48,
  },
  rowAlt: { backgroundColor: 'rgba(255,255,255,0.015)' },
  logoWrap: {
    marginLeft: 12,
  },
  identity: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    minWidth: 0,
    flex: 1,
  },
  textBlock: {
    flexShrink: 1,
    minWidth: 0,
    gap: 4,
    alignItems: 'flex-end',
  },
});

export const WatchlistRowSkeleton = memo(WatchlistRowSkeletonInner);
