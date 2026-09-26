import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from './DesignTokens';
import { APP_LAYOUT } from './appLayout';
import { appScreenTitleStyle, appScreenSubtitleStyle, APP_TYPE } from './appType';
import { DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE } from './DayNavBlurButton';

/** כמו מסך שווקים (בית) / רשימת צ׳אטים — מרווח אופקי לכותרת ול־section */
export const MAIN_SCREEN_HEADER_HP = APP_LAYOUT.screenPaddingHorizontal;

/** @deprecated — השתמש ב-APP_TYPE.screenTitle / appScreenTitleStyle */
export const MAIN_SCREEN_HEADER_TITLE_SIZE = APP_TYPE.screenTitle.fontSize;
export const MAIN_SCREEN_HEADER_TITLE_WEIGHT = APP_TYPE.screenTitle.fontWeight;
export const MAIN_SCREEN_HEADER_TITLE_LINE_HEIGHT = APP_TYPE.screenTitle.lineHeight;

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
   * אז שורת הכפתורים משתמשת ב-row במקום row-reverse.
   * כותרת המסך תמיד ממורכזת — inRtlTree לא משנה textAlign.
   */
  inRtlTree?: boolean;
};

/**
 * שורת תפריט + כותרת ממורכזת כמו מסכי שורש (שווקים, חדשות, צ׳אטים).
 * כותרת (וכותרת משנה בכרום ההדר) = center. טקסט גוף במסך = hebrewText.
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

  const subtitleNode = subtitle ? (
    onSubtitlePress ? (
      <Pressable
        onPress={onSubtitlePress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={subtitle}
      >
        <Text style={styles.appHeaderSubtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </Pressable>
    ) : (
      <Text style={styles.appHeaderSubtitle} numberOfLines={2}>
        {subtitle}
      </Text>
    )
  ) : null;

  return (
    <View style={style}>
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
          {subtitleNode}
        </View>
        <View style={styles.appHeaderActionsEnd} pointerEvents="box-none">
          {rightAccessory ?? <View style={styles.headerActionSpacer} />}
        </View>
      </View>
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
      paddingTop: 8,
      paddingBottom: 12,
      gap: APP_LAYOUT.stackGapSmall,
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
      alignItems: 'stretch',
      justifyContent: 'center',
      paddingHorizontal: 4,
      minHeight: 44,
    },
    appHeaderTitle: {
      ...appScreenTitleStyle,
      color: tokens.colors.text.primary,
      width: '100%',
    },
    appHeaderSubtitle: {
      ...appScreenSubtitleStyle,
      color: tokens.colors.text.secondary,
    },
    sectionPicker: {
      paddingHorizontal: MAIN_SCREEN_HEADER_HP,
      paddingTop: APP_LAYOUT.stackGapTight,
      paddingBottom: APP_LAYOUT.componentGap,
    },
  });
}
