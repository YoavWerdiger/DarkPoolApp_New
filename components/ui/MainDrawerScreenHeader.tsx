import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from './DesignTokens';
import { DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE } from './DayNavBlurButton';

/** כמו מסך שווקים (בית) / רשימת צ׳אטים — מרווח אופקי לכותרת ול־section */
export const MAIN_SCREEN_HEADER_HP = 20;

const HEADER_SIDE = 72;

export type MainDrawerScreenHeaderProps = {
  title: string;
  /** כותרת משנה מתחת לכותרת (למשל מדד פחד במסך שווקים) */
  subtitle?: string;
  onMenuPress: () => void;
  /** תוכן מתחת לכותרת — באותו padding אופקי כמו `sectionPicker` בשווקים */
  section?: React.ReactNode;
  /** עקיפת מרווחים סביב ה־section (למשל חדשות — רשת קומפקטית) */
  sectionContainerStyle?: ViewStyle;
  style?: ViewStyle;
  /** כפתור/אייקון בצד ימין (מיושר ל־minWidth כמו כפתור התפריט) */
  rightAccessory?: React.ReactNode;
};

/**
 * שורת תפריט + כותרת ממורכזת כמו מסכי שורש (שווקים, חדשות, צ׳אטים).
 */
export function MainDrawerScreenHeader({
  title,
  subtitle,
  onMenuPress,
  section,
  sectionContainerStyle,
  style,
  rightAccessory,
}: MainDrawerScreenHeaderProps) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  return (
    <View style={style}>
      <View style={styles.appHeader}>
        <View style={styles.appHeaderActions}>
          <DayNavBlurButton
            onPress={onMenuPress}
            glassIntensity="subtle"
            size={DRAWER_MENU_BUTTON_SIZE}
            accessibilityLabel="תפריט ראשי"
          >
            <Ionicons name="menu" size={24} color={tokens.colors.text.primary} />
          </DayNavBlurButton>
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.appHeaderTitle} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.appHeaderSubtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.appHeaderActions} pointerEvents="box-none">
          {rightAccessory}
        </View>
      </View>
      {section != null ? (
        <View style={[styles.sectionPicker, sectionContainerStyle]}>{section}</View>
      ) : null}
    </View>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    appHeader: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      paddingHorizontal: MAIN_SCREEN_HEADER_HP,
      paddingVertical: 14,
    },
    appHeaderActions: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      minWidth: HEADER_SIDE,
    },
    titleBlock: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      minHeight: 48,
    },
    appHeaderTitle: {
      fontSize: 22,
      fontWeight: '700' as const,
      color: tokens.colors.text.primary,
      letterSpacing: -0.3,
      textAlign: 'center',
    },
    appHeaderSubtitle: {
      marginTop: 3,
      fontSize: 13,
      fontWeight: '500' as const,
      color: tokens.colors.text.secondary,
      textAlign: 'center',
      lineHeight: 17,
    },
    sectionPicker: {
      paddingHorizontal: MAIN_SCREEN_HEADER_HP,
      paddingTop: 6,
      paddingBottom: 10,
    },
  });
}
