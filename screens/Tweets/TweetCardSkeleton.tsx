import React, { memo } from 'react';
import { View, type ViewStyle } from 'react-native';
import { SkeletonBox } from '../../components/ui/SkeletonLoader';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';

const DIVIDER = 'rgba(255, 255, 255, 0.12)';

/**
 * אותה טופולוגיה כמו PostCard ב-TweetsFeed:
 * שורש האפליקציה LTR — `row-reverse` בלי `direction: 'rtl'` (היפוך כפול).
 * ילד ראשון (אווטאר) מימין; שם/טקסט מיושרים לימין; מדיה מתחת; פעולות בשורה LTR.
 */
export const tweetCardSkeletonHeaderRow: ViewStyle = {
  flexDirection: 'row-reverse',
  alignItems: 'center',
  gap: 10,
};

export const tweetCardSkeletonTextBlock: ViewStyle = {
  flex: 1,
  minWidth: 0,
  gap: 6,
  alignItems: 'flex-end',
};

export const tweetCardSkeletonBody: ViewStyle = {
  gap: 8,
  alignItems: 'flex-end',
};

export const tweetCardSkeletonActionsRow: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: 8,
};

export const TWEET_CARD_SKELETON_LAYOUT = {
  headerRowDirection: 'row-reverse' as const,
  /** App root is LTR — never stack with direction:'rtl'. */
  headerDirection: undefined,
  avatarFirst: true,
  textAlignItems: 'flex-end' as const,
  actionsRowDirection: 'row' as const,
};

type Props = {
  delay?: number;
};

function TweetCardSkeletonInner({ delay = 0 }: Props) {
  const tokens = useDesignTokens();
  const pad = tokens.layout?.screenPadding ?? 20;
  const contentPad = tokens.spacing.md;

  return (
    <View
      style={{ marginHorizontal: pad, marginBottom: 12 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <UICard
        variant="soft"
        padding="none"
        disableBlur
        style={{
          borderRadius: tokens.borderRadius['2xl'],
          backgroundColor: tokens.colors.background.cardSolid,
          overflow: 'hidden',
          ...tokens.shadows.none,
        }}
      >
        <View style={{ padding: contentPad, gap: 10 }}>
          <View style={tweetCardSkeletonHeaderRow}>
            <SkeletonBox width={42} height={42} borderRadius={21} delay={delay} />
            <View style={tweetCardSkeletonTextBlock}>
              <SkeletonBox width="52%" height={15} delay={delay + 40} />
              <SkeletonBox width="34%" height={12} delay={delay + 80} />
            </View>
          </View>

          <View style={tweetCardSkeletonBody}>
            <SkeletonBox width="100%" height={14} delay={delay + 120} />
            <SkeletonBox width="82%" height={14} delay={delay + 160} />
          </View>

          <SkeletonBox
            width="100%"
            height={132}
            borderRadius={tokens.borderRadius['2xl']}
            delay={delay + 200}
          />
        </View>

        <View style={{ height: 1, backgroundColor: DIVIDER }} />

        <View
          style={{
            ...tweetCardSkeletonActionsRow,
            paddingHorizontal: tokens.spacing.lg,
            paddingVertical: tokens.spacing.md,
          }}
        >
          <SkeletonBox width={60} height={36} borderRadius={tokens.borderRadius.button} delay={delay + 240} />
          <SkeletonBox width={48} height={36} borderRadius={tokens.borderRadius.button} delay={delay + 270} />
          <SkeletonBox width={36} height={36} borderRadius={tokens.borderRadius.full} delay={delay + 300} />
        </View>
      </UICard>
    </View>
  );
}

export const TweetCardSkeleton = memo(TweetCardSkeletonInner);
