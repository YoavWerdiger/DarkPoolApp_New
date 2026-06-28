import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import { MainDrawerScreenHeader, MAIN_SCREEN_HEADER_HP } from '../ui/MainDrawerScreenHeader';
import { DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE } from '../ui/DayNavBlurButton';

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

const SUB_SCREEN_HEADER_SIDE = 72;

export type AcademySubScreenBarProps = {
  onBackPress: () => void;
  title?: string;
  subtitle?: string;
  style?: ViewStyle;
};

/** כותרת משנה — כמו צ׳אט: כפתור זכוכית, כותרת ממורכזת, מקום סימטרי */
export function AcademySubScreenBar({ onBackPress, title, subtitle, style }: AcademySubScreenBarProps) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createSubBarStyles(tokens), [tokens]);

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.row}>
        <View style={styles.sideSlot}>
          <DayNavBlurButton
            onPress={onBackPress}
            size={DRAWER_MENU_BUTTON_SIZE}
            glassIntensity="subtle"
            accessibilityLabel="חזרה"
          >
            <Ionicons name="chevron-forward" size={24} color={tokens.colors.text.primary} />
          </DayNavBlurButton>
        </View>
        <View style={styles.titleBlock}>
          {title ? (
            <Text style={styles.barTitle} numberOfLines={2}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text style={styles.subBarSubtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.sideSlotEnd} pointerEvents="none">
          <View style={styles.sideSpacer} />
        </View>
      </View>
    </View>
  );
}

function createSubBarStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      marginBottom: tokens.spacing.sm,
    },
    row: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      paddingHorizontal: MAIN_SCREEN_HEADER_HP,
      paddingVertical: 14,
    },
    sideSlot: {
      minWidth: SUB_SCREEN_HEADER_SIDE,
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    sideSlotEnd: {
      minWidth: SUB_SCREEN_HEADER_SIDE,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    sideSpacer: {
      width: DRAWER_MENU_BUTTON_SIZE,
      height: DRAWER_MENU_BUTTON_SIZE,
    },
    titleBlock: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
      paddingHorizontal: 4,
    },
    barTitle: {
      fontSize: 22,
      fontWeight: '700' as const,
      color: tokens.colors.text.primary,
      letterSpacing: -0.3,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    subBarSubtitle: {
      marginTop: 3,
      fontSize: 13,
      fontWeight: '500' as const,
      color: tokens.colors.text.secondary,
      textAlign: 'center',
      lineHeight: 17,
      writingDirection: 'rtl',
    },
  });
}
