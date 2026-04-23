import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import UICard from './UICard';

/** ברירת מחדל — ניווט תאריכים / שיעור (~40pt) */
export const DAY_NAV_BUTTON_SIZE = 40;
/** כפתור תפריט מגירה — קצת גדול יותר */
export const DRAWER_MENU_BUTTON_SIZE = 46;

type Props = {
  onPress?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** רוחב/גובה עגול (ברירת מחדל DAY_NAV_BUTTON_SIZE) */
  size?: number;
  /** עדין יותר בשורת תאריך (פחות משקל ויזואלי) */
  glassIntensity?: 'subtle' | 'light' | 'medium' | 'strong';
  accessibilityLabel?: string;
};

/**
 * כפתור ניווט יום/בלוק — עיגול מלא: מיכל חיתוך קשיח + UICard blur בפנים
 * (מונע מ-BlurView/צל להיראות כמו מלבן או אליפסה בשורות flex).
 */
export function DayNavBlurButton({
  onPress,
  children,
  disabled,
  style,
  size = DAY_NAV_BUTTON_SIZE,
  glassIntensity = 'light',
  accessibilityLabel,
}: Props) {
  const r = size / 2;
  const dim = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    borderRadius: r,
  };
  return (
    <View
      style={[dim, styles.clip, disabled && styles.disabled, style]}
      pointerEvents={disabled ? 'none' : 'auto'}
    >
      <UICard
        variant="blur"
        glassIntensity={glassIntensity}
        padding="none"
        onPress={disabled ? undefined : onPress}
        style={[dim, styles.innerCard]}
        contentContainerStyle={[dim, styles.innerContent]}
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </UICard>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    flexShrink: 0,
    alignSelf: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  innerCard: {
    overflow: 'hidden',
  },
  innerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
