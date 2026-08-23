import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';
import { MainDrawerScreenHeader } from '../ui/MainDrawerScreenHeader';
import { ChatSubScreenHeader } from '../chat/ChatScreenShell';

export type AcademyScreenHeaderProps = {
  onMenuPress: () => void;
  /** כותרת ממורכזת בלבד (למשל «האקדמיה») */
  title: string;
  /** שורת הקשר מתחת לכותרת — כמו Dark Pool / הערות */
  subtitle?: string;
  sectionTitle?: string;
  sectionCount?: number | string | null;
  sectionCountPending?: boolean;
  /** כפתור חיפוש / פעולה בצד הנגדי לתפריט */
  rightAccessory?: React.ReactNode;
  style?: ViewStyle;
};

/** שורת תפריט + כותרת ממורכזת כמו שווקים/יומן — אותו רכיב כמו `MainDrawerScreenHeader` */
export function AcademyScreenHeader({
  onMenuPress,
  title,
  subtitle,
  sectionTitle,
  sectionCount,
  sectionCountPending,
  rightAccessory,
  style,
}: AcademyScreenHeaderProps) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const countDisplay =
    sectionCountPending === true
      ? '…'
      : sectionCount !== undefined && sectionCount !== null
        ? String(sectionCount)
        : null;

  const section =
    sectionTitle != null && sectionTitle !== '' ? (
      <View style={styles.sectionRow}>
        <Text style={[styles.sectionTitle, { color: tokens.colors.text.primary }]}>{sectionTitle}</Text>
        {countDisplay !== null ? (
          <View style={[styles.countBadge, { backgroundColor: tokens.colors.primary.dim }]}>
            <Text style={[styles.countBadgeText, { color: tokens.colors.primary.main }]}>{countDisplay}</Text>
          </View>
        ) : null}
      </View>
    ) : undefined;

  return (
    <MainDrawerScreenHeader
      title={title}
      subtitle={subtitle}
      onMenuPress={onMenuPress}
      section={section}
      rightAccessory={rightAccessory}
      style={style}
    />
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    sectionRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: {
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: '800' as const,
      textAlign: 'right',
      lineHeight: Math.round(tokens.typography.fontSize.lg * 1.25),
    },
    countBadge: {
      minWidth: 32,
      paddingHorizontal: tokens.spacing.sm,
      paddingVertical: tokens.spacing.xs,
      borderRadius: tokens.borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    countBadgeText: {
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: '800' as const,
    },
  });
}

export type AcademySubScreenBarProps = {
  onBackPress: () => void;
  title?: string;
  subtitle?: string;
  style?: ViewStyle;
};

/** כותרת משנה — אותו רכיב גלובלי כמו צ׳אט/פרופיל */
export function AcademySubScreenBar({ onBackPress, title, subtitle, style }: AcademySubScreenBarProps) {
  return (
    <ChatSubScreenHeader
      title={title ?? ''}
      subtitle={subtitle}
      onBack={onBackPress}
      style={style}
    />
  );
}
