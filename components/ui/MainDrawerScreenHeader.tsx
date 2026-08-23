import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from './DesignTokens';
import { DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE } from './DayNavBlurButton';

/** כמו מסך שווקים (בית) / רשימת צ׳אטים — מרווח אופקי לכותרת ול־section */
export const MAIN_SCREEN_HEADER_HP = 20;

/** טיפוגרפיית כותרת שורש — גודל/משקל לפני האיחוד (לא title2 הצר) */
export const MAIN_SCREEN_HEADER_TITLE_SIZE = 24;
export const MAIN_SCREEN_HEADER_TITLE_WEIGHT = '800' as const;
export const MAIN_SCREEN_HEADER_TITLE_LINE_HEIGHT = 30;

export type MainDrawerScreenHeaderProps = {
  title: string;
  /** מחליף את טקסט הכותרת במרכז (למשל לוגו קהילה) — אותה שורה/מרווחים */
  centerAccessory?: React.ReactNode;
  /** כותרת משנה מתחת לכותרת (למשל מדד פחד במסך שווקים) */
  subtitle?: string;
  /** לחיצה על כותרת המשנה (אופציונלי) */
  onSubtitlePress?: () => void;
  onMenuPress: () => void;
  /** תוכן מתחת לכותרת — באותו padding אופקי כמו `sectionPicker` בשווקים */
  section?: React.ReactNode;
  /** עקיפת מרווחים סביב ה־section (למשל חדשות — רשת קומפקטית) */
  sectionContainerStyle?: ViewStyle;
  style?: ViewStyle;
  /** כפתור/אייקון בצד ימין (מיושר ל־minWidth כמו כפתור התפריט) */
  rightAccessory?: React.ReactNode;
  /**
   * מסך בתוך עץ `direction: 'rtl'` (למשל Dark Pool) — האפל ב-LTR גלובלי,
   * אז הכותרת משתמשת ב-row במקום row-reverse.
   */
  inRtlTree?: boolean;
};

/**
 * שורת תפריט + כותרת ממורכזת כמו מסכי שורש (שווקים, חדשות, צ׳אטים).
 */
export function MainDrawerScreenHeader({
  title,
  centerAccessory,
  subtitle,
  onSubtitlePress,
  onMenuPress,
  section,
  sectionContainerStyle,
  style,
  rightAccessory,
  inRtlTree = false,
}: MainDrawerScreenHeaderProps) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens, inRtlTree), [tokens, inRtlTree]);
  const row = inRtlTree ? styles.rowLtrInRtlTree : styles.rowAppLtr;

  const subtitleEl = subtitle ? (
    onSubtitlePress ? (
      <Pressable
        onPress={onSubtitlePress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={subtitle}
        style={styles.subtitleRow}
      >
        <Text style={styles.appHeaderSubtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </Pressable>
    ) : (
      <View style={styles.subtitleRow}>
        <Text style={styles.appHeaderSubtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    )
  ) : null;

  return (
    <View style={style}>
      {/* שורת כותרת בלבד — אותו גובה כמו חדשות/קהילה גם כשיש subtitle מתחת */}
      <View style={[styles.appHeader, row]}>
        <View style={styles.appHeaderActionsMenu}>
          <DayNavBlurButton
            onPress={onMenuPress}
            glassIntensity="subtle"
            size={DRAWER_MENU_BUTTON_SIZE}
            accessibilityLabel="תפריט ראשי"
          >
            <Ionicons name="menu" size={24} color={tokens.colors.text.primary} />
          </DayNavBlurButton>
        </View>
        <View
          style={styles.titleBlock}
          accessibilityRole="header"
          accessibilityLabel={title}
        >
          {centerAccessory ?? (
            <Text style={styles.appHeaderTitle} numberOfLines={1}>
              {title}
            </Text>
          )}
        </View>
        <View style={styles.appHeaderActionsEnd} pointerEvents="box-none">
          {rightAccessory ?? <View style={styles.headerActionSpacer} />}
        </View>
      </View>
      {subtitleEl}
      {section != null ? (
        <View style={[styles.sectionPicker, sectionContainerStyle]}>{section}</View>
      ) : null}
    </View>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>, inRtlTree: boolean) {
  const menuEdgeMargin = inRtlTree
    ? { marginLeft: MAIN_SCREEN_HEADER_HP }
    : { marginRight: MAIN_SCREEN_HEADER_HP };
  const accessoryEdgeMargin = inRtlTree
    ? { marginRight: MAIN_SCREEN_HEADER_HP }
    : { marginLeft: MAIN_SCREEN_HEADER_HP };

  return StyleSheet.create({
    rowAppLtr: {
      flexDirection: 'row-reverse',
    },
    rowLtrInRtlTree: {
      flexDirection: 'row',
    },
    appHeader: {
      alignItems: 'center',
      paddingVertical: 14,
      gap: 8,
    },
    /** תפריט — מרווח נפרד מקצה המסך */
    appHeaderActionsMenu: {
      alignItems: 'center',
      justifyContent: 'center',
      ...menuEdgeMargin,
    },
    /** צד נגדי (rightAccessory) — מרווח נפרד מהקצה השני */
    appHeaderActionsEnd: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      ...accessoryEdgeMargin,
    },
    headerActionSpacer: {
      width: DRAWER_MENU_BUTTON_SIZE,
      height: DRAWER_MENU_BUTTON_SIZE,
    },
    titleBlock: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      minHeight: 48,
    },
    appHeaderTitle: {
      fontSize: MAIN_SCREEN_HEADER_TITLE_SIZE,
      fontWeight: MAIN_SCREEN_HEADER_TITLE_WEIGHT,
      color: tokens.colors.text.primary,
      letterSpacing: -0.35,
      lineHeight: MAIN_SCREEN_HEADER_TITLE_LINE_HEIGHT,
      textAlign: 'center',
    },
    /** מתחת לשורת הכותרת — לא בתוך titleBlock (מונע הזזת כותרת/כפתורים למעלה) */
    subtitleRow: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: MAIN_SCREEN_HEADER_HP,
      marginTop: -4,
      paddingBottom: 12,
    },
    appHeaderSubtitle: {
      fontSize: 13,
      fontWeight: '500' as const,
      color: tokens.colors.text.secondary,
      textAlign: 'center',
      lineHeight: 17,
    },
    sectionPicker: {
      paddingHorizontal: MAIN_SCREEN_HEADER_HP,
      paddingTop: 8,
      paddingBottom: 10,
    },
  });
}
