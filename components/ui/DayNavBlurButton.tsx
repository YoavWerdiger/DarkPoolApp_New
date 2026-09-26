import React from 'react';
import { View, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { NavGlassSurface } from './NavGlassSurface';
import type { NavGlassIntensity } from './navGlass';
import { HapticFeedback } from '../../utils/hapticFeedback';

/** ברירת מחדל — ניווט תאריכים / שיעור (~40pt) */
export const DAY_NAV_BUTTON_SIZE = 40;
/** כפתור תפריט מגירה — קצת גדול יותר */
export const DRAWER_MENU_BUTTON_SIZE = 46;
/** כפתור חזרה / פעולה בכותרת מסך פרטים (אחיד לכל ה-stack screens) */
export const HEADER_BACK_BTN_SIZE = 40;

type Props = {
  onPress?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** רוחב/גובה עגול (ברירת מחדל DAY_NAV_BUTTON_SIZE) */
  size?: number;
  /** עדין יותר בשורת תאריך / תפריט (פחות משקל ויזואלי) */
  glassIntensity?: NavGlassIntensity;
  accessibilityLabel?: string;
};

/**
 * כפתור ניווט עגול — Blur + tint (NavGlassSurface), לא slab אטום של navChrome.
 * מיכל חיתוך קשיח כדי שה-blur יישאר עיגול מלא בשורות flex.
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
  const flatUser = StyleSheet.flatten(style) as ViewStyle | undefined;
  const userBg = flatUser?.backgroundColor;
  const { backgroundColor: _drop, ...restUser } = flatUser ?? {};
  const hasSolidOverride =
    typeof userBg === 'string' && userBg.length > 0 && userBg !== 'transparent';

  const dim: ViewStyle = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    borderRadius: r,
    flexShrink: 0,
    alignSelf: 'center',
    ...restUser,
  };

  if (hasSolidOverride) {
    const face: ViewStyle = {
      ...dim,
      backgroundColor: userBg,
      borderWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    };
    const handlePress = onPress
      ? () => {
          void HapticFeedback.impactLight();
          onPress();
        }
      : undefined;

    if (!handlePress || disabled) {
      return (
        <View
          style={[face, disabled && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          pointerEvents={disabled ? 'none' : 'auto'}
        >
          {children}
        </View>
      );
    }

    return (
      <Pressable
        style={({ pressed }) => [pressed && styles.pressed]}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <View style={face}>{children}</View>
      </Pressable>
    );
  }

  return (
    <View style={[dim, styles.clip]} pointerEvents={disabled ? 'none' : 'auto'}>
      <NavGlassSurface
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
        glassIntensity={glassIntensity}
        accessibilityLabel={accessibilityLabel}
        style={[StyleSheet.absoluteFill, { borderRadius: r }]}
        contentContainerStyle={[styles.innerContent, { width: size, height: size }]}
      >
        {children}
      </NavGlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    position: 'relative',
  },
  innerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.45,
  },
});
