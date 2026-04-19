import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { useDesignTokens } from '../ui/DesignTokens';
import { MainDrawerScreenHeader } from '../ui/MainDrawerScreenHeader';

export type AcademyScreenHeaderProps = {
  onMenuPress: () => void;
  /** כותרת ממורכזת בלבד (למשל «אקדמיה») */
  title: string;
  sectionTitle?: string;
  sectionCount?: number | string | null;
  sectionCountPending?: boolean;
  style?: ViewStyle;
};

/** שורת תפריט + כותרת ממורכזת כמו שווקים/יומן — אותו רכיב כמו `MainDrawerScreenHeader` */
export function AcademyScreenHeader({
  onMenuPress,
  title,
  sectionTitle,
  sectionCount,
  sectionCountPending,
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

  return <MainDrawerScreenHeader title={title} onMenuPress={onMenuPress} section={section} style={style} />;
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

export function AcademySubScreenBar({ onBackPress, title, subtitle, style }: AcademySubScreenBarProps) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createSubBarStyles(tokens), [tokens]);

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBackPress}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="חזרה"
        >
          <ArrowRight size={20} color={tokens.colors.text.primary} strokeWidth={2} />
        </TouchableOpacity>
        {title ? (
          <Text style={styles.barTitle} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          <View style={styles.flexSpacer} />
        )}
      </View>
      {subtitle ? (
        <Text style={styles.subBarSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const BACK_BTN = 44;

function createSubBarStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    wrap: {
      paddingHorizontal: tokens.spacing.lg,
      paddingTop: tokens.spacing.md,
      marginBottom: tokens.spacing.md,
    },
    row: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: tokens.spacing.md,
    },
    backBtn: {
      width: BACK_BTN,
      height: BACK_BTN,
      borderRadius: BACK_BTN / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.colors.background.secondary,
      borderWidth: 1,
      borderColor: tokens.colors.border.strong,
      ...tokens.shadows.sm,
    },
    flexSpacer: {
      flex: 1,
    },
    barTitle: {
      flex: 1,
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: '800' as const,
      color: tokens.colors.text.primary,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    subBarSubtitle: {
      marginTop: tokens.spacing.xs,
      paddingEnd: BACK_BTN + tokens.spacing.md,
      fontSize: tokens.typography.fontSize.sm,
      color: tokens.colors.text.secondary,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
  });
}
