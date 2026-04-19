import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from './DesignTokens';

/** כמו `MarketsScreen` / רשימת צ׳אטים — מרווח אופקי לכותרת ול־section */
export const MAIN_SCREEN_HEADER_HP = 20;

const HEADER_SIDE = 72;
const MENU_SIZE = 46;

const circleMenuBtn = (tokens: ReturnType<typeof useDesignTokens>) => ({
  width: MENU_SIZE,
  height: MENU_SIZE,
  borderRadius: MENU_SIZE / 2,
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
  backgroundColor: tokens.colors.background.secondary,
  borderWidth: 1,
  borderColor: tokens.colors.border.strong,
  shadowColor: '#000',
  shadowOpacity: 0.28,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 4 },
  elevation: 6,
});

export type MainDrawerScreenHeaderProps = {
  title: string;
  onMenuPress: () => void;
  /** תוכן מתחת לכותרת — באותו padding אופקי כמו `sectionPicker` בשווקים */
  section?: React.ReactNode;
  style?: ViewStyle;
};

/**
 * שורת תפריט + כותרת ממורכזת כמו מסכי שורש (שווקים, יומן, צ׳אטים) — לא כמו חדשות.
 */
export function MainDrawerScreenHeader({ title, onMenuPress, section, style }: MainDrawerScreenHeaderProps) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  return (
    <View style={style}>
      <View style={styles.appHeader}>
        <View style={styles.appHeaderActions}>
          <TouchableOpacity
            style={styles.headerMenuBtn}
            onPress={onMenuPress}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="תפריט ראשי"
          >
            <Ionicons name="menu" size={28} color={tokens.colors.text.primary} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.appHeaderTitle, styles.appHeaderTitleCenter]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.appHeaderActions} />
      </View>
      {section != null ? <View style={styles.sectionPicker}>{section}</View> : null}
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
    headerMenuBtn: circleMenuBtn(tokens),
    appHeaderTitle: {
      fontSize: 22,
      fontWeight: '700' as const,
      color: tokens.colors.text.primary,
      letterSpacing: -0.3,
    },
    appHeaderTitleCenter: {
      flex: 1,
      textAlign: 'center',
    },
    sectionPicker: {
      paddingHorizontal: MAIN_SCREEN_HEADER_HP,
      paddingTop: 6,
      paddingBottom: 10,
    },
  });
}
