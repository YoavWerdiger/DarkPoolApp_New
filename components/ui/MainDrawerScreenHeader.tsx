import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from './DesignTokens';
import { APP_LAYOUT } from './appLayout';
import { appPageTitleStyle, appScreenTitleStyle, appScreenSubtitleStyle, APP_TYPE } from './appType';
import {
  DayNavBlurButton,
  DRAWER_MENU_BUTTON_SIZE,
  drawerMenuFaceColor,
} from './DayNavBlurButton';

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
  /** פעולה בשורת הכותרת הגדולה, בצד שמאל — מתחת לכפתור הצד (למשל + ליצירה) */
  titleAccessory?: React.ReactNode;
};

/**
 * שורת תפריט, ומתחתיה כותרת מערכת גדולה מיושרת לימין — כמו «פרופיל».
 * לוגו במרכז השורה (צ׳אט) נשאר במקום כותרת הטקסט.
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
  titleAccessory,
}: MainDrawerScreenHeaderProps) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens, inRtlTree), [tokens, inRtlTree]);
  const row = inRtlTree ? styles.rowLtrInRtlTree : styles.rowAppLtr;
  const menuFace = drawerMenuFaceColor(tokens.colors.background.cardSolid);

  const showPageTitle = title.length > 0 && centerAccessory == null;

  const subtitleNode = (align: 'center' | 'right') =>
    subtitle ? (
      onSubtitlePress ? (
        <Pressable
          onPress={onSubtitlePress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={subtitle}
        >
          <Text
            style={align === 'right' ? styles.pageSubtitle : styles.appHeaderSubtitle}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        </Pressable>
      ) : (
        <Text
          style={align === 'right' ? styles.pageSubtitle : styles.appHeaderSubtitle}
          numberOfLines={2}
        >
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
            glass={!menuFace}
            glassIntensity="subtle"
            size={DRAWER_MENU_BUTTON_SIZE}
            style={menuFace ? { backgroundColor: menuFace } : undefined}
            accessibilityLabel="תפריט ראשי"
          >
            <Ionicons name="menu" size={24} color={tokens.colors.text.primary} />
          </DayNavBlurButton>
        </View>
        <View
          style={styles.titleBlock}
          accessibilityRole={showPageTitle ? undefined : 'header'}
          accessibilityLabel={showPageTitle ? undefined : title}
        >
          {centerAccessory ??
            (showPageTitle ? null : (
              <Text style={styles.appHeaderTitle} numberOfLines={1}>
                {title}
              </Text>
            ))}
          {showPageTitle ? null : subtitleNode('center')}
        </View>
        <View style={styles.appHeaderActionsEnd} pointerEvents="box-none">
          {rightAccessory ?? <View style={styles.headerActionSpacer} />}
        </View>
      </View>
      {showPageTitle ? (
        <View style={styles.pageTitleWrap} accessibilityRole="header" accessibilityLabel={title}>
          {titleAccessory ? (
            <View style={styles.pageTitleRow}>
              <View style={styles.pageTitleAccessory}>{titleAccessory}</View>
              <Text style={[styles.pageTitle, styles.pageTitleFlex, { color: tokens.colors.text.primary }]} numberOfLines={1}>
                {title}
              </Text>
            </View>
          ) : (
            <Text style={[styles.pageTitle, { color: tokens.colors.text.primary }]} numberOfLines={1}>
              {title}
            </Text>
          )}
          {subtitleNode('right')}
        </View>
      ) : null}
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
    pageTitleWrap: {
      direction: 'ltr',
      width: '100%',
      alignSelf: 'stretch',
      alignItems: 'stretch',
      paddingHorizontal: MAIN_SCREEN_HEADER_HP,
      paddingBottom: APP_LAYOUT.cardPadding,
    },
    pageTitle: {
      ...appPageTitleStyle,
    },
    pageTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: APP_LAYOUT.stackGapSmall,
    },
    pageTitleFlex: {
      flex: 1,
    },
    pageTitleAccessory: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    pageSubtitle: {
      ...appScreenSubtitleStyle,
      direction: 'ltr',
      textAlign: 'right',
      writingDirection: 'rtl',
      width: '100%',
      color: tokens.colors.text.secondary,
    },
    sectionPicker: {
      paddingHorizontal: MAIN_SCREEN_HEADER_HP,
      paddingTop: APP_LAYOUT.stackGapTight,
      paddingBottom: APP_LAYOUT.componentGap,
    },
  });
}
